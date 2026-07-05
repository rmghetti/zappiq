/**
 * AI Readiness Score — quão "treinada" está a IA de conversação do cliente.
 *
 * Estratégia de produto:
 *   O cliente alimenta a própria IA via survey de onboarding, upload de
 *   documentos/contratos, URLs do site e pares de perguntas & respostas.
 *   Quanto mais rico esse conjunto, melhor a IA responde. Mas o cliente
 *   precisa de um sinal tangível de "quanto falta para a IA ficar boa" —
 *   caso contrário ele não sabe quando parar de configurar nem percebe o
 *   valor de continuar enriquecendo.
 *
 *   Esse score é esse sinal. É o "termômetro" que aparece no dashboard e
 *   induz o cliente a completar os passos seguintes — sem depender de
 *   consultor, sem onboarding pago, sem suporte externo. É o DNA do
 *   produto: autonomia do cliente.
 *
 * Composição do score (100 pontos):
 *   30  —  Survey de qualificação (niche + respostas estruturadas)
 *          10pt por niche definido, 20pt proporcional ao volume de
 *          respostas preenchidas no surveyAnswers.
 *   20  —  Tom de voz & identidade (agentName, tone, businessHours,
 *          greetingMessage, handoffMessage). 4pt cada.
 *   25  —  Documentos/URLs ingeridos (max 10pt por 1 doc + 5pt cada extra
 *          até 25pt, teto). Mede profundidade da base RAG.
 *   20  —  Q&A estruturado ativo (4pt a cada 3 pares até 20pt, teto).
 *   5   —  WhatsApp conectado (1 ou mais números).
 *
 * ── Gate de RAG real (W3.8) ─────────────────────────────
 *   As linhas em kb_documents / qa_pairs no Postgres NÃO garantem que a IA
 *   consegue usar aquele conteúdo — ela só o enxerga via retrieval no serviço
 *   RAG (rag_chunks, namespace org_<orgId>). Antes deste fix, 45 dos 100 pontos
 *   (25 docs + 20 Q&A) contavam linhas do Postgres que, com o RAG antes morto,
 *   nunca viravam chunks — o score era "teatro". Agora docs/Q&A só pontuam se
 *   houver CHUNKS REAIS no namespace da org. Assim o readiness (e o Health da
 *   Área Clientes que lê esse score) reflete o que a IA REALMENTE usa.
 *
 *   Distinção doc vs Q&A por source: a rota de Q&A ingere com source
 *   `qa-<id>.txt` (ver routes/aiTraining.ts); documentos usam o filename/URL.
 *   Então gate de docs = existência de chunks de source NÃO-qa; gate de Q&A =
 *   existência de chunks de source qa-*.
 *
 * Recomendações geradas:
 *   O service também retorna a lista de próximas ações sugeridas — base
 *   para o "guia de maturação" no UI (checklist estilo Duolingo).
 */
import { prisma } from '@zappiq/database';
import { namespaceFor } from './ragService.js';
import { logger } from '../utils/logger.js';

export interface AIReadinessResult {
  score: number;                 // 0..100
  level: 'initial' | 'learning' | 'ready' | 'expert';
  breakdown: {
    survey: number;
    identity: number;
    documents: number;
    qaPairs: number;
    channel: number;
  };
  nextActions: Array<{
    id: string;
    title: string;
    description: string;
    impact: number;              // pontos que essa ação soma ao score
    cta: string;
    completed: boolean;
  }>;
  stats: {
    documentsCount: number;
    qaPairsCount: number;
    surveyAnswers: number;
    whatsappConnections: number;
    // Chunks REAIS indexados no RAG por namespace (o que a IA consegue usar).
    // docChunks = chunks de documentos/URLs; qaChunks = chunks de Q&A (source qa-*).
    docChunks: number;
    qaChunks: number;
  };
}

/**
 * Pontuação de documentos (0..25) a partir da contagem de docs.
 * Gate W3.8: sem chunks REAIS de documento no RAG, a IA não enxerga nada —
 * então o score é 0 mesmo que existam linhas em kb_documents. Puro (testável).
 */
export function documentsScoreFor(documentsCount: number, docChunks: number): number {
  if (docChunks <= 0) return 0; // nada indexado no RAG → IA não usa → 0 pontos
  let s = 0;
  if (documentsCount >= 1) s += 10;
  if (documentsCount >= 2) s += Math.min(15, (documentsCount - 1) * 5);
  return Math.min(25, s);
}

/**
 * Pontuação de Q&A (0..20) a partir da contagem de pares ativos.
 * Gate W3.8: sem chunks REAIS de Q&A no RAG (source qa-*), a IA não recupera
 * essas respostas — score 0. Puro (testável).
 */
export function qaScoreFor(qaPairsCount: number, qaChunks: number): number {
  if (qaChunks <= 0) return 0; // nada indexado no RAG → IA não usa → 0 pontos
  return Math.min(20, Math.floor(qaPairsCount / 3) * 4);
}

function levelFromScore(score: number): AIReadinessResult['level'] {
  if (score >= 85) return 'expert';
  if (score >= 60) return 'ready';
  if (score >= 30) return 'learning';
  return 'initial';
}

export async function computeAIReadiness(organizationId: string): Promise<AIReadinessResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      settings: true,
      // Colunas de canal — base pra contar a CONFIGURAÇÃO salva no score
      // (não só o proxy de mensagem outbound). Self-serve multi-tenant.
      whatsappPhoneNumberId: true,
      whatsappAccessToken: true,
      instagramAccountId: true,
      instagramAccessToken: true,
    } as any,
  });

  if (!org) throw new Error(`Organization not found: ${organizationId}`);

  const settings = (org.settings as any) || {};
  const surveyAnswers = settings.surveyAnswers || {};
  const niche: string | undefined = settings.niche;
  const orgAny = org as any;

  // Intenção de ativação escolhida pelo cliente: 'whatsapp' | 'instagram' | 'both'.
  // Default: se já tem phoneNumberId de WhatsApp, assume whatsapp; senão whatsapp
  // (canal padrão). Persistida em settings.channelActivation pelo painel /settings.
  const channelIntent: 'whatsapp' | 'instagram' | 'both' =
    settings.channelActivation === 'instagram' || settings.channelActivation === 'both'
      ? settings.channelActivation
      : 'whatsapp';

  // ── 1. Survey (até 30 pontos) ─────────────────────────
  let surveyScore = 0;
  if (niche && String(niche).trim()) surveyScore += 10;

  const surveyValuesCount = countFilledAnswers(surveyAnswers);
  // Cresce até 20pt; cada resposta útil soma 2pt.
  surveyScore += Math.min(20, surveyValuesCount * 2);

  // ── 2. Identidade & tom (até 20 pontos) ───────────────
  const identityFields = ['agentName', 'tone', 'businessHours', 'greetingMessage', 'handoffMessage'];
  const identityFilled = identityFields.filter((f) => {
    const v = settings[f];
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }).length;
  const identityScore = Math.min(20, identityFilled * 4);

  // Gate W3.8: chunks REAIS indexados no RAG por namespace. docs/Q&A só pontuam
  // se a IA de fato consegue recuperar aquele conteúdo (senão o score é teatro).
  const { docChunks, qaChunks } = await countRagChunksByNamespace(organizationId);

  // ── 3. Documentos/URLs ingeridos (até 25 pontos) ──────
  const documentsCount = await prisma.kBDocument.count({
    where: { knowledgeBase: { organizationId } },
  });
  // Só pontua se há chunks REAIS de documento no RAG (docChunks > 0).
  const documentsScore = documentsScoreFor(documentsCount, docChunks);

  // ── 4. Q&A ativos (até 20 pontos) ─────────────────────
  const qaPairsCount = await (prisma as any).QAPair.count({
    where: { organizationId, isActive: true },
  });
  // 4pt a cada 3 Q&As ativos, teto 20 — mas só se há chunks REAIS de Q&A no RAG.
  const qaScore = qaScoreFor(qaPairsCount, qaChunks);

  // ── 5. Canal conectado (5 pontos) — WhatsApp e/ou Instagram ────────────
  // Conta a CONFIGURAÇÃO salva (phoneNumberId+token de WA, accountId+token de IG)
  // conforme a intenção do cliente. Fallback legado: proxy de outbound real
  // (cobre a Iza dogfood, que usa token global sem campos próprios na org).
  const waConfigured = !!(orgAny.whatsappPhoneNumberId && orgAny.whatsappAccessToken);
  const igConfigured = !!(orgAny.instagramAccountId && orgAny.instagramAccessToken);

  const outboundExists = await prisma.message.count({
    where: { conversation: { organizationId }, direction: 'OUTBOUND' },
    take: 1,
  });

  // Canal "pronto" conforme a intenção escolhida:
  //   whatsapp  → WA configurado
  //   instagram → IG configurado
  //   both      → ambos configurados
  let channelReady = false;
  if (channelIntent === 'whatsapp') channelReady = waConfigured;
  else if (channelIntent === 'instagram') channelReady = igConfigured;
  else channelReady = waConfigured && igConfigured;

  // Fallback legado: se há outbound real, o canal está de fato funcional
  // (Iza dogfood via token global). Garante que orgs já ativas não percam o ponto.
  if (!channelReady && outboundExists > 0) channelReady = true;

  const channelScore = channelReady ? 5 : 0;
  const whatsappConnections = outboundExists; // mantém shape do stats legado

  const score =
    surveyScore + identityScore + documentsScore + qaScore + channelScore;

  // ── Próximas ações recomendadas ───────────────────────
  const nextActions: AIReadinessResult['nextActions'] = [];

  if (surveyScore < 30) {
    nextActions.push({
      id: 'complete_survey',
      title: 'Complete o questionário de qualificação',
      description:
        'Quanto mais respostas ricas sobre seu negócio, serviços, público e diferenciais, melhor sua IA responderá sem supervisão.',
      impact: 30 - surveyScore,
      cta: 'Responder agora',
      completed: false,
    });
  }

  if (identityScore < 20) {
    nextActions.push({
      id: 'define_identity',
      title: 'Defina tom de voz e identidade do agente',
      description:
        'Nome do agente, tom (formal, amigável, técnico), horários e mensagens de saudação e transbordo. Isso é o que faz sua IA "soar como sua marca".',
      impact: 20 - identityScore,
      cta: 'Ajustar agora',
      completed: false,
    });
  }

  if (documentsScore < 25) {
    // Caso "teatro": há docs no Postgres mas nenhum chunk indexado no RAG —
    // a IA não consegue usar esse material. Sinaliza reindexação, não novo upload.
    const docsNotIndexed = documentsCount > 0 && docChunks === 0;
    nextActions.push({
      id: 'upload_documents',
      title: docsNotIndexed
        ? 'Reprocesse seus documentos para a IA'
        : 'Envie documentos, contratos e materiais do seu negócio',
      description: docsNotIndexed
        ? 'Seus documentos foram enviados mas ainda não estão indexados na base da IA, então ela não consegue usá-los nas respostas. Reenvie ou reprocesse para que virem conhecimento consultável.'
        : 'PDFs, URLs, planilhas, contratos, FAQ, políticas, catálogos. Tudo que sua equipe já consulta deve alimentar a IA. Sem limite de uploads no plano atual.',
      impact: 25 - documentsScore,
      cta: docsNotIndexed ? 'Reprocessar documentos' : 'Enviar documentos',
      completed: false,
    });
  }

  if (qaScore < 20) {
    // Caso "teatro": há Q&A no Postgres mas nenhum chunk qa-* no RAG.
    const qaNotIndexed = qaPairsCount > 0 && qaChunks === 0;
    nextActions.push({
      id: 'add_qa_pairs',
      title: qaNotIndexed
        ? 'Reprocesse suas perguntas e respostas'
        : 'Crie perguntas e respostas prontas',
      description: qaNotIndexed
        ? 'Suas perguntas e respostas foram cadastradas mas ainda não estão indexadas na base da IA. Reprocesse para que ela possa usá-las nas conversas.'
        : 'Use Q&A para fixar respostas exatas a perguntas recorrentes — horário, preços, prazo de entrega. Garante consistência total, sem alucinação.',
      impact: 20 - qaScore,
      cta: qaNotIndexed ? 'Reprocessar Q&A' : 'Criar Q&A',
      completed: false,
    });
  }

  if (channelScore === 0) {
    // Título/descrição conforme a intenção de ativação escolhida pelo cliente.
    const channelTitle =
      channelIntent === 'instagram'
        ? 'Conecte sua Conta Instagram'
        : channelIntent === 'whatsapp'
          ? 'Conecte seu número de WhatsApp e sua Conta Instagram'
          : 'Conecte seu número de WhatsApp e sua Conta Instagram';
    const channelDesc =
      channelIntent === 'instagram'
        ? 'Sem o canal conectado, sua IA não responde DMs. Conexão direta via Meta — escolha o que ativar e leva poucos minutos.'
        : 'Sem o canal conectado, sua IA não fala com clientes. Conecte WhatsApp e/ou Instagram Direct via Meta — você escolhe o que ativar.';
    nextActions.push({
      // Mantém id 'connect_whatsapp' pra preservar o deep-link existente do
      // frontend (ACTION_TARGET/ACTION_HREFS). O texto agora cobre WA + IG.
      id: 'connect_whatsapp',
      title: channelTitle,
      description: channelDesc,
      impact: 5,
      cta: 'Conectar canais',
      completed: false,
    });
  }

  return {
    score,
    level: levelFromScore(score),
    breakdown: {
      survey: surveyScore,
      identity: identityScore,
      documents: documentsScore,
      qaPairs: qaScore,
      channel: channelScore,
    },
    nextActions,
    stats: {
      documentsCount,
      qaPairsCount,
      surveyAnswers: surveyValuesCount,
      whatsappConnections: whatsappConnections > 0 ? 1 : 0,
      docChunks,
      qaChunks,
    },
  };
}

/** Recalcula e persiste score + timestamp. Chamado após mutação relevante. */
export async function refreshAIReadiness(organizationId: string): Promise<AIReadinessResult> {
  const result = await computeAIReadiness(organizationId);

  // Marco de "pronto" quando atinge 60 pela primeira vez.
  const now = new Date();
  const org = (await prisma.organization.findUnique({
    where: { id: organizationId },
  })) as any;

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      aiReadinessScore: result.score,
      aiReadinessUpdatedAt: now,
      aiTrainingReadyAt:
        result.score >= 60 && !org?.aiTrainingReadyAt ? now : undefined,
    } as any,
  });

  return result;
}

// ── helpers ─────────────────────────────────────────────

export interface RagChunkCounts {
  docChunks: number;
  qaChunks: number;
}

/**
 * Conta chunks REAIS indexados no serviço RAG para o namespace da org.
 *
 * A tabela rag_chunks vive no MESMO Postgres (Supabase) que o resto do schema
 * (o serviço Python usa o mesmo DATABASE_URL — ver services/rag/main.py), então
 * consultamos direto via SQL, sem depender de um endpoint de contagem no RAG.
 *
 * Separa em docChunks (documentos/URLs) e qaChunks (Q&A, source `qa-*`) porque
 * o gate de docs e o de Q&A são independentes no score.
 *
 * FAIL-SOFT: se a tabela não existir (dev sem RAG provisionado) ou a query
 * falhar, retorna 0/0. Isso NÃO derruba o readiness — apenas não concede os
 * pontos de docs/Q&A, que é exatamente o comportamento seguro (não inflar o
 * score com conteúdo que a IA comprovadamente não consegue recuperar).
 */
export async function countRagChunksByNamespace(
  organizationId: string,
): Promise<RagChunkCounts> {
  const namespace = namespaceFor(organizationId);
  try {
    const rows = await prisma.$queryRaw<Array<{ is_qa: boolean; n: bigint | number }>>`
      SELECT (source LIKE 'qa-%') AS is_qa, COUNT(*)::int AS n
      FROM rag_chunks
      WHERE namespace = ${namespace}
      GROUP BY (source LIKE 'qa-%')
    `;
    let docChunks = 0;
    let qaChunks = 0;
    for (const r of rows) {
      const n = Number(r.n) || 0;
      if (r.is_qa) qaChunks += n;
      else docChunks += n;
    }
    return { docChunks, qaChunks };
  } catch (err: any) {
    // Ex.: relação rag_chunks inexistente em ambientes sem RAG. Não é fatal.
    logger.warn(`[AIReadiness] contagem de rag_chunks falhou (ns=${namespace}): ${err?.message}`);
    return { docChunks: 0, qaChunks: 0 };
  }
}

function countFilledAnswers(surveyAnswers: Record<string, any>): number {
  let count = 0;
  for (const value of Object.values(surveyAnswers || {})) {
    if (value == null) continue;
    if (typeof value === 'string') {
      if (value.trim()) count++;
    } else if (Array.isArray(value)) {
      count += value.filter((x) => String(x).trim()).length;
    } else if (typeof value === 'object') {
      count += countFilledAnswers(value as Record<string, any>);
    } else {
      count++;
    }
  }
  return count;
}
