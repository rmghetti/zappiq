/**
 * AI Training — self-service.
 *
 * Filosofia de produto: o CLIENTE treina a IA dele. Sem consultor, sem
 * onboarding pago, sem SLA de suporte para começar. Ele sobe documento,
 * cria Q&A, ajusta o tom de voz e vê o "AI Readiness Score" subir em
 * tempo real — feedback imediato de maturação.
 *
 * Rotas:
 *   GET    /status              — score + breakdown + próximas ações
 *   GET    /documents           — lista documentos ingeridos (só metadata)
 *   GET    /documents/:id       — detalhe com o conteúdo (para ver/editar)
 *   POST   /documents           — upload (multipart/form-data: file)
 *   POST   /documents/url       — ingesta URL pública (site do cliente)
 *   POST   /documents/text      — texto colado direto
 *   PUT    /documents/:id       — edita texto colado (re-sincroniza o RAG)
 *   DELETE /documents/:id       — remove documento + chunks
 *   GET    /qa                  — lista pares Q&A
 *   POST   /qa                  — cria Q&A (propaga pro vector store)
 *   PUT    /qa/:id              — atualiza
 *   DELETE /qa/:id              — desativa (soft)
 *   PUT    /identity            — atualiza tom, nome do agente, horários, mensagens
 *
 * Segurança:
 *   Todas as rotas exigem auth + tenant scoping. Upload limita tamanho
 *   (20MB) e tipos: PDF, TXT, MD e CSV, que é o que a ingestão consegue ler.
 *   O filtro aceita por mime OU por extensão, porque o navegador rotula .csv
 *   como Excel no Windows e .md como octet-stream ou vazio.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { authMiddleware } from '../middleware/auth.js';
import { UnsupportedFileTypeError } from '../middleware/errorHandler.js';
import { MAX_UPLOAD_BYTES } from '../config/upload.js';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import * as ragService from '../services/ragService.js';
import { computeAIReadiness, refreshAIReadiness } from '../services/aiReadinessService.js';
import { countAnsweredQuestions } from '../services/knowledgeBaseBuilder.js';
import {
  agendarReingestaoDoQuestionario,
  marcarSincronizacaoPendente,
} from '../services/surveyReingest.js';
import { logAuditEvent } from '../services/auditService.js';
import {
  buildAgentContextForContact,
  pickTierAndOverride,
  resolveSchedulingRuntime,
  toolsDaPolitica,
} from '../agents/agentOrchestrator.js';
// C1a (Passo 12): o Testar minha IA passa pelo mesmo motor de contexto e pela
// mesma política de modelo do WhatsApp, atrás dos interruptores.
import { flagLigada } from '../agents/agentContextLoader.js';
import { isZappIQOrg } from '../config/zappiqOrg.js';
import { routeIzaTurn } from '../services/llm/izaTurnRouter.js';
// Rede de crise (P62): vale também no Testar minha IA, porque o dono precisa
// ver o que o cliente final dele veria.
import {
  acionarRedeDeCrise,
  acrescentarAcolhimento,
} from '../services/llm/crisisSafetyNet.js';
import { testMessageSchema, buildPlaygroundResult } from './aiTraining.playground.js';
import { registrarAlertasDeSaida } from '../services/alertasDeSaida.js';
import {
  textDocSchema,
  isEditableDocument,
  normalizeQaUpdate,
  isUploadAllowed,
} from './aiTraining.text.util.js';
import {
  MENSAGEM_TITULO_REPETIDO,
  sourceDoDocumento,
  sourceLegado,
  nomeDeArquivoDoUpload,
  donosDoSourceLegado,
  trechosDoDocumento,
  tituloDeUrl,
  type DocumentoParaSource,
} from './aiTraining.documents.util.js';
import {
  appointmentTypeSchema,
  schedulingConfigSchema,
  buildSchedulingKnowledge,
  SCHEDULING_RAG_SOURCE,
} from './scheduling.util.js';
import { getToolsForContext } from '../services/llm/tools.js';
import { resolveSchedulingAccess, type PlanId } from '@zappiq/shared';
import { syncAgentIdentity } from '../services/agentIdentitySync.js';

// Entitlement do Agendamento: incluído no GROWTH+; no Lite exige o add-on
// SCHEDULING_AGENT (settings.addons). Lê plano + add-ons ativos da org.
async function schedulingAccessFor(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, settings: true } });
  const addons = Array.isArray((org?.settings as any)?.addons) ? (org!.settings as any).addons as string[] : [];
  return resolveSchedulingAccess((org?.plan as PlanId) || 'IZA_LITE', addons);
}

const router = Router();
router.use(authMiddleware);

// 2026-05-20 — helper de log de treinamento. Reusa a cadeia append-only
// (hash-chained) de audit_logs: histórico INALTERÁVEL com usuário, data/hora.
// Fail-soft: nunca quebra a request principal se o log falhar.
async function logTraining(
  req: Request,
  action: string,
  resource: string,
  resourceId: string | undefined,
  summary: string,
  extra?: { before?: unknown; after?: unknown },
): Promise<void> {
  try {
    await logAuditEvent(req, {
      action,            // ex: "kb.qa.update"
      resource,          // ex: "qa_pair"
      resourceId,
      details: { summary, area: 'ai-training' },
      before: extra?.before,
      after: extra?.after,
    });
  } catch (err: any) {
    logger.warn(`[AITraining] log falhou (${action}): ${err?.message}`);
  }
}

// ── Multer config ───────────────────────────────────────
// A lista de formatos vive em aiTraining.text.util.ts, com teste: é ela que
// mantém a tela, o accept do input e o filtro dizendo a mesma coisa. Word
// (.docx) e Excel (.xlsx) entraram nela em 14/09/2026, quando os conversores
// passaram a existir de verdade no motor de indexação. Ficam fora de propósito
// 'application/msword' (.doc) e 'application/vnd.ms-excel' (.xls), os binários
// do Office 97: o mammoth e o openpyxl leem só OOXML, e aceitar na porta
// adiava a recusa para depois do upload inteiro.
//
// O limite vive em config/upload.ts, porque o errorHandler precisa do MESMO
// número para escrever a mensagem de 413 que o cliente lê.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  // Erro TIPADO: o errorHandler transforma em 415 com mensagem em português.
  // Antes era um Error cru, que virava 500 "Internal Server Error" e fazia o
  // cliente achar que a plataforma tinha caído.
  fileFilter: (_req, file, cb) => {
    if (isUploadAllowed(file.mimetype, file.originalname)) return cb(null, true);
    // UnsupportedFileTypeError já traz statusCode 415 e a mensagem em
    // português, sem ecoar o mimetype: o valor não é do cliente, é do
    // navegador, e mostrá-lo só confunde quem mandou o arquivo certo.
    cb(new UnsupportedFileTypeError());
  },
});

// ═══════════════════════════════════════════════════════════
// GET /api/ai-training/status
// Score + breakdown + próximas ações sugeridas.
// ═══════════════════════════════════════════════════════════
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const result = await computeAIReadiness(orgId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/ai-training/test — Playground "Testar minha IA"
// ─────────────────────────────────────────────────────────
// FEATURE 5a.2. O dono do negócio testa o treino ANTES de conectar o
// WhatsApp: manda uma mensagem, ela roda pela MESMA IA da org (prompt do
// Agent live + retrieval RAG real + roteamento de tier/provider), e volta a
// resposta — SEM WhatsApp e SEM criar Conversation/Contact reais.
//
// Reuso deliberado do caminho de produção (agentOrchestrator):
//   - buildSystemPromptForContact → CORE rules + facts gating + Agent live + RAG
//   - pickTierAndOverride         → mesmo tier/forceProvider do bot real
//   - routeIzaTurn                → mesmo pre-filter + classify + cascade LLM
// A única diferença: usamos um contactId sintético que NÃO existe no banco.
// O lookup de Contact retorna null (fail-soft no orchestrator) → o prompt cai
// no comportamento de "primeiro contato", que é exatamente o teste desejado.
// Nada é persistido: sem Message, sem Conversation, sem Contact.
// ═══════════════════════════════════════════════════════════
router.post('/test', validate(testMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { message, history } = req.body as {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    // Settings da org (niche/agentName/tone) pro fallback do promptEngine
    // quando a org ainda não tem Agent seedado.
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const orgSettings = (org?.settings as any) || {};

    // 1. Retrieval RAG real (namespace da org) + fontes estruturadas pra UI.
    // Mesma função da produção: com a versão da organização na chave, o
    // playground e o WhatsApp param de divergir depois de uma edição (A033).
    const {
      context: ragContext,
      sources,
      status: ragStatus,
    } = await ragService.searchDetailed(orgId, message, 5);

    // C1a: com qualquer um dos dois interruptores ligado, o estado REAL do
    // agendamento entra no teste como entra no WhatsApp (tipo ativo E direito
    // ao recurso), e não só o interruptor das settings (A072). Desligados,
    // nada é consultado a mais.
    const [contextoUnico, modeloPorPolitica] = await Promise.all([
      flagLigada(orgId, 'contextoUnico'),
      flagLigada(orgId, 'modeloPorPolitica'),
    ]);
    const agendamento =
      contextoUnico || modeloPorPolitica ? await resolveSchedulingRuntime(orgId, orgSettings) : null;
    const turnosDaSessao = history?.length ?? 0;

    // 2. System prompt idêntico ao de produção. contactId sintético → sem DB write.
    //    Com o motor único (A072): a memória é a da SESSÃO de teste. Primeiro
    //    contato só no primeiro turno; a contagem de mensagens é a de turnos
    //    enviados. Sem o motor, o contato sintético não existe no banco e o
    //    prompt cai no "primeiro contato" em todo turno, como antes.
    const contexto = await buildAgentContextForContact({
      origem: 'playground',
      organizationId: orgId,
      contactId: `playground:${orgId}`,
      orgSettings,
      ragContext,
      ragStatus,
      agendamento: agendamento ?? undefined,
      contato: {
        nome: null,
        leadStatus: 'NEW',
        primeiroContato: turnosDaSessao === 0,
        totalMensagens: turnosDaSessao + 1,
      },
      temHistoricoNoContexto: turnosDaSessao > 0,
    });
    const systemPrompt = contexto.systemPrompt;

    // 3. Mesmo roteamento de tier/provider do bot real. Com modeloPorPolitica
    //    ligado, a política do turno vem junto (canal 'playground').
    const { tier, forceProvider, politica } = await pickTierAndOverride(orgId, {
      canal: 'playground',
      agendamentoAtivo: agendamento?.ativo ?? false,
    });

    // Agendamento no playground: só a tool de CONSULTA (read-only) — o teste
    // mostra a IA oferecendo horários reais, mas NÃO cria agendamentos de
    // verdade (create_appointment fica fora pra não poluir a agenda com testes).
    // Com a política ligada, quem decide é resolveTurnPolicy (canal
    // 'playground' devolve só check_availability, e só com o agendamento de pé).
    const schedulingOn = Boolean(orgSettings?.scheduling?.enabled) && !orgSettings?.scheduling?.optOut;
    const playgroundTools = politica
      ? toolsDaPolitica(politica, isZappIQOrg(orgId))
      : schedulingOn
        ? getToolsForContext({ hasScheduling: true }).filter((t) => t.name === 'check_availability')
        : undefined;

    // 4. Mesmo turno da Iza (pre-filter + classify + cascade). O histórico da
    // sessão de teste dá memória entre turnos (o cliente pergunta o nome, o dono
    // responde, a IA não repergunta). conversationId null: nada é persistido — o
    // histórico vem do frontend, não do banco. Cap de 20 turnos garantido pelo
    // schema (testMessageSchema).
    const turn = await routeIzaTurn({
      systemPrompt,
      userMessage: message,
      history: history ?? [],
      tier,
      forceProvider,
      orgId,
      conversationId: null,
      tools: playgroundTools,
    });

    // Vertical bloqueada (apostas/cripto/...) devolve template estático, sem LLM.
    const rawText = turn.kind === 'blocked' ? turn.response : turn.response.text;

    // C1b (A189): o mesmo pós-processador dos outros canais, com a guarda de
    // marca sobre a resposta real e o alerta registrado para o Raio-X.
    const result = buildPlaygroundResult({
      rawLlmText: rawText,
      sources,
      organizacao: {
        id: orgId,
        ehZappIQ: isZappIQOrg(orgId),
        nome: orgSettings?.businessName ?? null,
      },
      agente: { nome: contexto.contexto?.agente?.name ?? orgSettings?.agentName ?? null },
    });
    await registrarAlertasDeSaida({
      organizationId: orgId,
      conversationId: null,
      canal: 'playground',
      alertas: result.alertas,
      bloqueada: result.bloqueada,
    });

    // P62: rede de crise no playground.
    // A linha do CVV entra DEPOIS da limpeza das tags, no texto que a tela
    // mostra. `comTransbordo: false` de propósito: aqui não existe fila de
    // atendimento, e prometer uma pessoa seria inventar recurso (CR-7).
    // Registramos o evento sem conversa (não há conversa real) só para o
    // dono conseguir consultar que a regra disparou no teste dele.
    if (turn.kind === 'llm' && turn.crise) {
      result.reply = acrescentarAcolhimento(result.reply, { comTransbordo: false });
      await acionarRedeDeCrise({
        organizationId: orgId,
        conversationId: null,
        canal: 'playground',
        regra: turn.crise.regra,
      }).catch((err) =>
        logger.warn('[AITraining] registro da rede de crise falhou', { err: String(err) }),
      );
    }

    await logTraining(req, 'kb.playground.test', 'ai_playground', undefined,
      `Teste de IA executado (${result.usedContext ? 'com' : 'sem'} contexto RAG)`,
      // Rastro do contexto (C1a): o hash liga o teste ao Raio-X e ao WhatsApp.
      { after: { contextoHash: contexto.hash, viaContextoUnico: contexto.viaContextoUnico } });

    res.json(result);
  } catch (err) {
    logger.warn('[AITraining] Playground test falhou', { err: String(err) });
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// DOCUMENTOS
// ═══════════════════════════════════════════════════════════

// Campos do documento que a tela lista. `status` e `motivo` existem desde a
// migração 20260914000040: o documento nasce em 'processando' antes da
// ingestão e termina em 'pronto' ou 'falhou' com o motivo em português.
const SELECT_DOCUMENTO = {
  id: true,
  title: true,
  sourceType: true,
  sourceUrl: true,
  status: true,
  motivo: true,
  createdAt: true,
} as const;

/**
 * Documento em `falhou` não ocupa lugar nenhum.
 *
 * Ele existe só para o cliente ler o motivo e tentar de novo. Contá-lo como
 * repetido fazia o reenvio do MESMO arquivo virar 409 "Já existe um documento
 * com este título": o cliente ficava com uma linha que não indexa e que ele
 * não consegue substituir. A tela manda tentar de novo e a API recusava.
 */
const SO_OS_QUE_VALEM = { status: { not: 'falhou' } } as const;

/** Chave pela qual um reenvio reconhece o documento que já tentou entrar. */
type ChaveDoDocumento = { title: string } | { sourceUrl: string };

/**
 * Recusa título repetido na mesma organização (409).
 *
 * Sem isto, dois documentos com o mesmo título dividiam o mesmo lugar no vetor
 * e um apagava os trechos do outro (achado A001). Agora o source é o id, mas o
 * título continua sendo como o cliente reconhece o documento na tela: dois
 * "Proposta.pdf" seriam indistinguíveis para ele.
 */
async function garantirTituloLivre(
  orgId: string,
  title: string,
  ignorarId?: string,
): Promise<boolean> {
  // `count` e nao `findFirst`: o findFirst desta rota e o do tenant scoping, e
  // misturar os dois deixa o proposito de cada consulta ilegivel.
  const repetidos = await prisma.kBDocument.count({
    where: {
      title,
      ...SO_OS_QUE_VALEM,
      knowledgeBase: { organizationId: orgId },
      ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
    },
  });
  return repetidos === 0;
}

/** A mesma página já está na base? URL casa por endereço, não por título. */
async function paginaJaNaBase(orgId: string, url: string): Promise<boolean> {
  const repetidas = await prisma.kBDocument.count({
    where: {
      sourceUrl: url,
      ...SO_OS_QUE_VALEM,
      knowledgeBase: { organizationId: orgId },
    },
  });
  return repetidas > 0;
}

/**
 * A linha que este mesmo documento já tem na base e ficou em `falhou`.
 *
 * O reenvio reaproveita ela em vez de criar outra: duas linhas do mesmo
 * arquivo, uma vermelha e uma verde, é lixo na tela do cliente e faz a
 * contagem de documentos do score mentir.
 */
async function linhaQueFalhou(
  orgId: string,
  chave: ChaveDoDocumento,
): Promise<{ id: string } | null> {
  return prisma.kBDocument.findFirst({
    where: { ...chave, status: 'falhou', knowledgeBase: { organizationId: orgId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
}

/** Os outros documentos da organização, para saber quem divide qual source. */
async function outrosDocumentos(orgId: string, exceto?: string): Promise<DocumentoParaSource[]> {
  return prisma.kBDocument.findMany({
    where: {
      knowledgeBase: { organizationId: orgId },
      ...(exceto ? { NOT: { id: exceto } } : {}),
    },
    select: { id: true, title: true, sourceType: true, sourceUrl: true },
  });
}

/**
 * Remove do vetor os trechos de um documento.
 *
 * Apaga o source novo (doc-<id>) sempre. O source antigo (título, ou
 * hostname+caminho para URL) só sai quando NENHUM outro documento da base
 * divide ele: apagar o source por título era exatamente o que derrubava o
 * conhecimento do documento vizinho (achado A001). Enquanto o
 * reprocessamento do RAG não roda, os trechos antigos ainda estão lá, e
 * deixá-los para trás seria dado do cliente indexado depois de ele mandar
 * apagar (LGPD Art. 18).
 */
async function removerDoVetor(orgId: string, doc: DocumentoParaSource): Promise<void> {
  const novo = sourceDoDocumento(doc.id);
  await ragService
    .deleteDocument(orgId, novo)
    .catch((err: any) => logger.warn(`[AITraining] RAG remove doc falhou: ${err.message}`));

  const legado = sourceLegado(doc);
  if (legado === novo) return;

  const donos = donosDoSourceLegado(await outrosDocumentos(orgId, doc.id));
  if ((donos.get(legado) ?? 0) > 0) {
    logger.info(
      `[AITraining] source antigo "${legado}" mantido: outro documento da org ainda usa`,
    );
    return;
  }
  await ragService
    .deleteDocument(orgId, legado)
    .catch((err: any) => logger.warn(`[AITraining] RAG remove source antigo falhou: ${err.message}`));
}

/**
 * Grava o desfecho da ingestão no documento e responde.
 *
 * Em caso de falha o documento FICA na lista, marcado como 'falhou' e com o
 * motivo: antes disso o cliente via um alerta que sumia, sem linha na base,
 * sem motivo e sem botão para tentar de novo (achados A004 e A142).
 */
async function concluirIngestao(
  res: Response,
  orgId: string,
  docId: string,
  erro: unknown | null,
  opcoes: { statusDeSucesso?: number; tituloNovo?: string } = {},
) {
  if (!erro) {
    const documento = await prisma.kBDocument.update({
      where: { id: docId },
      data: {
        status: 'pronto',
        motivo: null,
        ...(opcoes.tituloNovo ? { title: opcoes.tituloNovo } : {}),
      },
      select: SELECT_DOCUMENTO,
    });
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.status(opcoes.statusDeSucesso ?? 201).json({ document: documento, readiness });
    return;
  }

  const falha = ragService.falhaDeIngestao(erro);
  logger.warn(`[AITraining] ingestão falhou (${falha.status}): ${(erro as any)?.message}`);
  const documento = await prisma.kBDocument
    .update({
      where: { id: docId },
      data: { status: 'falhou', motivo: falha.mensagem },
      select: SELECT_DOCUMENTO,
    })
    .catch(() => null);
  // O score muda na falha também: o documento saiu de 'processando' e a
  // contagem de documentos prontos da organização não é mais a mesma. Deixar
  // de recalcular aqui fazia a tela mostrar o número de antes do envio até o
  // cliente recarregar a página.
  const readiness = await refreshAIReadiness(orgId).catch(() => null);
  res.status(falha.status).json({ error: falha.mensagem, document: documento, readiness });
}

/**
 * A linha do documento para esta tentativa: a que falhou antes, ou uma nova.
 *
 * Reaproveitar a linha em `falhou` é o que faz o botão "enviar de novo"
 * funcionar sem deixar duas linhas do mesmo arquivo na tela.
 */
async function abrirDocumento(
  orgId: string,
  chave: ChaveDoDocumento,
  dados: Record<string, unknown>,
) {
  const anterior = await linhaQueFalhou(orgId, chave);
  if (anterior) {
    return prisma.kBDocument.update({
      where: { id: anterior.id },
      data: { ...dados, status: 'processando', motivo: null },
      select: SELECT_DOCUMENTO,
    });
  }

  const kb = await ensureKnowledgeBase(orgId);
  return prisma.kBDocument.create({
    data: { ...(dados as any), status: 'processando', knowledgeBaseId: kb.id },
    select: SELECT_DOCUMENTO,
  });
}

// Contagem de chunks por source no vector store (mesma instância Postgres).
// É o que torna o status por item HONESTO: "indexado" só se chunks > 0 de fato.
async function ragChunkCounts(orgId: string): Promise<Map<string, number>> {
  const namespace = ragService.namespaceFor(orgId);
  const rows = await prisma.$queryRaw<Array<{ source: string; n: bigint }>>`
    SELECT source, count(*)::bigint AS n
      FROM rag_chunks
     WHERE namespace = ${namespace}
     GROUP BY source`;
  return new Map(rows.map((r) => [r.source, Number(r.n)]));
}

// GET /api/ai-training/documents
router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const docs = await prisma.kBDocument.findMany({
      where: { knowledgeBase: { organizationId: orgId } },
      orderBy: { createdAt: 'desc' },
      select: SELECT_DOCUMENTO,
    });
    // `null` em vez de Map vazio: uma consulta que falha não pode pintar a base
    // inteira de "não indexado" e mandar o cliente reenviar o que já está lá
    // (achado A017).
    const counts = await ragChunkCounts(orgId).catch((err: any) => {
      logger.warn(`[AITraining] contagem de trechos falhou: ${err?.message}`);
      return null;
    });
    const donos = donosDoSourceLegado(docs);
    const documents = docs.map((d) => ({
      ...d,
      ragChunks: trechosDoDocumento(d, counts, donos),
    }));
    res.json({ documents });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai-training/documents  (multipart form-data)
router.post(
  '/documents',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Arquivo ausente (campo "file" obrigatório)' });
        return;
      }

      // O multer entrega o nome em latin1: sem a correção, "editável" vira
      // "editaÌvel" no título, no vetor e na lista (achado A014).
      const title = nomeDeArquivoDoUpload(file.originalname);

      if (!(await garantirTituloLivre(orgId, title))) {
        res.status(409).json({ error: MENSAGEM_TITULO_REPETIDO });
        return;
      }

      // O documento nasce ANTES da ingestão. Assim o source do vetor pode ser
      // o id (único por definição) e uma falha deixa rastro na tela em vez de
      // um alerta que some (achados A001, A017b e A142). Se já existe uma
      // tentativa que falhou com este título, ela é reaproveitada.
      const doc = await abrirDocumento(
        orgId,
        { title },
        {
          title,
          sourceType: file.mimetype,
          content: '', // chunks ficam no vector store; contrato mínimo aqui
        },
      );

      let erro: unknown = null;
      try {
        await ragService.ingestDocument(orgId, {
          filename: title,
          content: file.buffer,
          mimeType: file.mimetype,
          source: sourceDoDocumento(doc.id),
          metadata: { titulo: title },
        });
        logger.info(`[AITraining] Doc ingestado: ${title} (${file.size}b) org=${orgId}`);
      } catch (falha) {
        erro = falha;
      }

      await logTraining(req, 'kb.document.create', 'kb_document', doc.id,
        `Documento enviado: "${title}"`);

      await concluirIngestao(res, orgId, doc.id, erro);
    } catch (err: any) {
      logger.warn(`[AITraining] Upload falhou: ${err.message}`);
      next(err);
    }
  },
);

// POST /api/ai-training/documents/url
const urlSchema = z.object({ url: z.string().url() });
router.post(
  '/documents/url',
  validate(urlSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const { url } = req.body as { url: string };

      // A mesma URL duas vezes duplicava trechos na base e disputava o top 5
      // com o conteúdo bom (achado A012). A comparação é pelo ENDEREÇO: o
      // título deixa de ser a URL assim que a página é lida.
      if (await paginaJaNaBase(orgId, url)) {
        res.status(409).json({ error: MENSAGEM_TITULO_REPETIDO });
        return;
      }

      // O título nasce sendo a própria URL e é trocado quando a leitura der
      // certo: assim, se falhar, o cliente vê o endereço exato para conferir.
      const doc = await abrirDocumento(
        orgId,
        { sourceUrl: url },
        { title: url, sourceType: 'url', sourceUrl: url, content: '' },
      );

      let erro: unknown = null;
      let tituloNovo: string | undefined;
      try {
        const resposta = await ragService.ingestUrl(orgId, url, {
          source: sourceDoDocumento(doc.id),
          titulo: url,
        });
        // "https://cmj.com.br/cursos/conselho-do-futuro" ocupa a linha inteira
        // da lista e não diz que página é aquela. O <title> da página diz; sem
        // ele, hostname mais o último trecho do caminho já diz mais.
        const detectado = (resposta as { titulo_detectado?: unknown } | null)?.titulo_detectado;
        const candidato =
          typeof detectado === 'string' && detectado.trim() ? detectado.trim() : tituloDeUrl(url);
        if (candidato !== doc.title && (await garantirTituloLivre(orgId, candidato, doc.id))) {
          tituloNovo = candidato;
        }
      } catch (falha) {
        erro = falha;
      }

      await logTraining(req, 'kb.url.create', 'kb_document', doc.id, `URL ingerida: ${url}`);

      await concluirIngestao(res, orgId, doc.id, erro, { tituloNovo });
    } catch (err: any) {
      logger.warn(`[AITraining] URL ingest falhou: ${err.message}`);
      next(err);
    }
  },
);

// POST /api/ai-training/documents/text
// Texto colado direto (sem arquivo/URL). Vira documento e chunks no RAG igual
// a um upload. `source` = título → a contagem de chunks (GET /documents) e o
// DELETE reaproveitam o mesmo caminho dos arquivos.
router.post(
  '/documents/text',
  validate(textDocSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const { title, content } = req.body as { title: string; content: string };

      if (!(await garantirTituloLivre(orgId, title))) {
        res.status(409).json({ error: MENSAGEM_TITULO_REPETIDO });
        return;
      }

      const doc = await abrirDocumento(
        orgId,
        { title },
        {
          title,
          sourceType: 'text',
          content, // texto colado é curto: guardamos o canônico aqui também
        },
      );

      let erro: unknown = null;
      try {
        await ragService.ingestDocument(orgId, {
          filename: title,
          content: Buffer.from(content, 'utf-8'),
          mimeType: 'text/plain',
          source: sourceDoDocumento(doc.id),
          metadata: { titulo: title },
        });
      } catch (falha) {
        erro = falha;
      }

      await logTraining(req, 'kb.text.create', 'kb_document', doc.id,
        `Texto colado: "${title}"`);

      await concluirIngestao(res, orgId, doc.id, erro);
    } catch (err: any) {
      logger.warn(`[AITraining] Texto colado falhou: ${err.message}`);
      next(err);
    }
  },
);

// GET /api/ai-training/documents/:id
// Detalhe com o CONTEÚDO. A listagem (GET /documents) devolve só metadata —
// carregar o texto de todos os documentos de uma vez seria caro e inútil.
router.get('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;

    const doc = await prisma.kBDocument.findFirst({
      where: { id, knowledgeBase: { organizationId: orgId } },
      select: {
        id: true,
        title: true,
        sourceType: true,
        sourceUrl: true,
        content: true,
        createdAt: true,
      },
    });
    if (!doc) {
      res.status(404).json({ error: 'Documento não encontrado' });
      return;
    }

    // Só o texto colado guarda o canônico no Postgres; arquivo e URL têm
    // content vazio (o texto vive no vector store). editable diz à UI se o
    // modal abre em modo edição ou só leitura.
    res.json({ document: { ...doc, editable: isEditableDocument(doc.sourceType) } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai-training/documents/:id
// Edita texto colado (título + conteúdo) e re-sincroniza o RAG. Sem isso o
// cliente só conseguia apagar e recolar o texto para corrigir uma informação.
router.put(
  '/documents/:id',
  validate(textDocSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const { id } = req.params;
      const { title, content } = req.body as { title: string; content: string };

      const existing = await prisma.kBDocument.findFirst({
        where: { id, knowledgeBase: { organizationId: orgId } },
        select: { id: true, title: true, sourceType: true, sourceUrl: true, content: true },
      });
      if (!existing) {
        res.status(404).json({ error: 'Documento não encontrado' });
        return;
      }
      if (!isEditableDocument(existing.sourceType)) {
        res.status(400).json({
          error: 'Só textos colados podem ser editados. Para arquivo ou URL, remova e envie de novo.',
        });
        return;
      }
      if (title !== existing.title && !(await garantirTituloLivre(orgId, title, id))) {
        res.status(409).json({ error: MENSAGEM_TITULO_REPETIDO });
        return;
      }

      // 'processando' enquanto a reingestão roda. Antes daqui a rota marcava
      // 'pronto' ANTES de reingerir e engolia o erro: uma reingestão que
      // falhava deixava o documento verde na tela com o conteúdo velho, ou
      // nenhum, no vetor (achado da revisão PI-3).
      await prisma.kBDocument.update({
        where: { id },
        data: { title, content, status: 'processando', motivo: null },
        select: SELECT_DOCUMENTO,
      });

      let erro: unknown = null;
      try {
        await ragService.ingestDocument(orgId, {
          filename: title,
          content: Buffer.from(content, 'utf-8'),
          mimeType: 'text/plain',
          source: sourceDoDocumento(id),
          metadata: { titulo: title },
        });
      } catch (falha) {
        erro = falha;
      }

      // O source é doc-<id>, então mudar o título não move mais os trechos de
      // lugar: a reingestão substitui o conteúdo no mesmo source. O que sai é
      // o source ANTIGO (título), que ainda existe enquanto o reprocessamento
      // do RAG não roda, e só quando ninguém mais divide ele (achado A001).
      //
      // SÓ depois do sucesso: apagar antes trocava o conteúdo velho por nada
      // quando a reingestão falhava.
      const legado = sourceLegado({ ...existing, sourceType: existing.sourceType });
      if (!erro && legado !== sourceDoDocumento(id)) {
        const donos = donosDoSourceLegado(await outrosDocumentos(orgId, id));
        if ((donos.get(legado) ?? 0) === 0) {
          await ragService
            .deleteDocument(orgId, legado)
            .catch((err: any) =>
              logger.warn(`[AITraining] RAG remove source antigo do texto falhou: ${err.message}`),
            );
        }
      }

      await logTraining(req, 'kb.text.update', 'kb_document', id,
        `Texto editado: "${title}"`,
        { before: { title: existing.title, content: existing.content }, after: { title, content } });

      await concluirIngestao(res, orgId, id, erro, { statusDeSucesso: 200 });
    } catch (err: any) {
      logger.warn(`[AITraining] Edição de texto falhou: ${err.message}`);
      next(err);
    }
  },
);

// DELETE /api/ai-training/documents/:id
router.delete('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;

    // Tenant scoping: só apaga se o doc pertence à KB da org.
    const doc = await prisma.kBDocument.findFirst({
      where: { id, knowledgeBase: { organizationId: orgId } },
      select: { id: true, title: true, sourceType: true, sourceUrl: true },
    });
    if (!doc) {
      res.status(404).json({ error: 'Documento não encontrado' });
      return;
    }

    await prisma.kBDocument.delete({ where: { id } });

    // Apaga os trechos DESTE documento. Nunca os de outro que compartilhe o
    // título, que era o defeito do CMJ em 21/08 (achado A001).
    await removerDoVetor(orgId, doc);

    await logTraining(req, 'kb.document.delete', 'kb_document', id,
      `Documento removido: "${doc.title}"`);

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ ok: true, readiness });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// Q&A PAIRS
// ═══════════════════════════════════════════════════════════

// GET /api/ai-training/qa
router.get('/qa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const pairs = await (prisma as any).QAPair.findMany({
      where: { organizationId: orgId },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
    const counts = await ragChunkCounts(orgId).catch(() => new Map<string, number>());
    res.json({
      qaPairs: pairs.map((p: any) => ({ ...p, ragChunks: counts.get(`qa-${p.id}.txt`) ?? 0 })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Opções de ingestão de um par de Q&A.
 *
 * A009: a prioridade (0 a 10) só ordenava a lista na tela. O trecho ia para o
 * vetor sem ela, e o re-rank aplicava o mesmo fator a todo source qa-*. Agora
 * prioridade e categoria viajam na metadata e viram bônus proporcional (com
 * teto) no ranking do serviço.
 *
 * A011: a resposta pode ter 4.000 caracteres e o chunk é de 512 tokens. Um Q&A
 * longo virava 2 ou 3 trechos e só o primeiro carregava "Pergunta:"; os demais
 * eram pedaços soltos que não casavam com a pergunta do cliente. `singleChunk`
 * manda o serviço não fatiar.
 */
export function qaIngestOptions(pair: {
  priority?: number | null;
  category?: string | null;
}): { metadata: Record<string, unknown>; singleChunk: true } {
  const priority = Number.isFinite(Number(pair?.priority)) ? Number(pair.priority) : 0;
  return {
    metadata: {
      kind: 'qa',
      priority: Math.max(0, Math.min(10, priority)),
      category: pair?.category ?? null,
    },
    singleChunk: true,
  };
}

const qaSchema = z.object({
  question: z.string().min(3).max(500),
  answer: z.string().min(3).max(4000),
  category: z.string().max(80).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  isActive: z.boolean().optional(),
});

// POST /api/ai-training/qa
router.post('/qa', validate(qaSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { question, answer, category, priority = 0 } = req.body;

    const pair = await (prisma as any).QAPair.create({
      data: {
        question,
        answer,
        category: category || null,
        priority,
        organizationId: orgId,
      },
    });

    // Propaga pro vector store como documento textual estruturado.
    const content = `Pergunta: ${question}\n\nResposta: ${answer}`;
    await ragService
      .ingestDocument(
        orgId,
        {
          filename: `qa-${pair.id}.txt`,
          content: Buffer.from(content),
          mimeType: 'text/plain',
          // A pergunta vai no cabeçalho de TODOS os trechos: resposta longa é
          // fatiada, e sem isso o trecho 2 era pedaço solto que não casava com a
          // pergunta do cliente (achado A011).
          metadata: { titulo: 'Perguntas e respostas', pergunta: question },
        },
        qaIngestOptions(pair),
      )
      .catch((err: any) => logger.warn(`[AITraining] RAG sync Q&A falhou: ${err.message}`));

    await logTraining(req, 'kb.qa.create', 'qa_pair', pair.id,
      `Q&A criado: "${String(question).slice(0, 80)}"`);

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.status(201).json({ qaPair: pair, readiness });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai-training/qa/:id
router.put('/qa/:id', validate(qaSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;

    const existing = await (prisma as any).QAPair.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Q&A não encontrado' });
      return;
    }

    const pair = await (prisma as any).QAPair.update({
      where: { id },
      data: normalizeQaUpdate(req.body),
    });

    // Sincroniza o vector store com o ESTADO FINAL do par:
    //  - ativo   → re-ingere (filename estável qa-{id}.txt substitui a versão anterior)
    //  - inativo → REMOVE do RAG; sem isso o toggle "Desativar" era cosmético
    //    (só mexia no banco) e a IA continuava respondendo com o Q&A desativado.
    if (pair.isActive === false) {
      await ragService
        .deleteDocument(orgId, `qa-${pair.id}.txt`)
        .catch((err: any) => logger.warn(`[AITraining] RAG remove Q&A (desativado) falhou: ${err.message}`));
    } else {
      const content = `Pergunta: ${pair.question}\n\nResposta: ${pair.answer}`;
      await ragService
        .ingestDocument(
          orgId,
          {
            filename: `qa-${pair.id}.txt`,
            content: Buffer.from(content),
            mimeType: 'text/plain',
            metadata: { titulo: 'Perguntas e respostas', pergunta: pair.question },
          },
          qaIngestOptions(pair),
        )
        .catch((err: any) => logger.warn(`[AITraining] RAG re-sync Q&A (update) falhou: ${err.message}`));
    }

    await logTraining(req, 'kb.qa.update', 'qa_pair', pair.id,
      `Q&A editado: "${String(pair.question).slice(0, 80)}"`,
      { before: { question: existing.question, answer: existing.answer }, after: { question: pair.question, answer: pair.answer } });

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ qaPair: pair, readiness });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ai-training/qa/:id
router.delete('/qa/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;

    const existing = await (prisma as any).QAPair.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, question: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Q&A não encontrado' });
      return;
    }

    await (prisma as any).QAPair.delete({ where: { id } });

    // 2026-05-20 FIX — remove o doc correspondente do RAG. Antes o Q&A
    // deletado continuava na base vetorial (a IA seguia respondendo com ele).
    // Best-effort: o RAG externo dedupe/identifica pelo filename estável.
    await ragService
      .deleteDocument(orgId, `qa-${id}.txt`)
      .catch((err: any) => logger.warn(`[AITraining] RAG remove Q&A falhou: ${err.message}`));

    await logTraining(req, 'kb.qa.delete', 'qa_pair', id,
      `Q&A removido: "${String(existing.question).slice(0, 80)}"`);

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ ok: true, readiness });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// SURVEY DE QUALIFICAÇÃO (editável pós-onboarding)
// 2026-05-20 — antes as respostas só eram ingeridas 1x no onboarding e
// sumiam. Agora persistem em organization.settings.surveyAnswers e podem
// ser re-completadas/editadas a qualquer momento, re-alimentando o RAG.
// ═══════════════════════════════════════════════════════════

// GET /api/ai-training/survey — retorna as respostas salvas (frontend cruza
// com o catálogo local de perguntas pra calcular faltantes/destaque vermelho).
router.get('/survey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const settings = (org?.settings as any) || {};
    const surveyAnswers = settings.surveyAnswers || {};
    res.json({
      surveyAnswers,
      answeredCount: countAnsweredQuestions(surveyAnswers),
      niche: settings.niche || 'geral',
      segmento: settings.segmento || settings.niche || 'geral',
      subsegmentos: Array.isArray(settings.subsegmentos) ? settings.subsegmentos : [],
      // Estado da última sincronização com a IA (A008). Sem isto, a tela
      // dizia 'salvo automaticamente' mesmo quando a ingestão falhava.
      surveySync: settings.surveySync ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/** Teto de uma resposta. Caixa de texto de questionário, não anexo (A118). */
export const MAX_CHARS_POR_RESPOSTA = 8_000;

/** Teto do questionário inteiro. Ele viaja no JSON de settings da organização. */
export const MAX_BYTES_DO_QUESTIONARIO = 200 * 1024;

/** O que passou do teto, se passou. Null quando o envio cabe. */
export interface ExcessoDoQuestionario {
  erro: 'resposta_longa_demais' | 'questionario_grande_demais';
  mensagem: string;
  campo?: string;
}

/**
 * Mede o questionário antes de gravar.
 *
 * Sem isto o autosave aceitava qualquer coisa: uma colagem de documento
 * inteiro numa caixa de texto ia parar no JSON de settings da organização,
 * que é lido em todo turno de conversa.
 */
export function medirQuestionario(
  surveyAnswers: Record<string, any>,
): ExcessoDoQuestionario | null {
  const grande = primeiraRespostaLongaDemais(surveyAnswers);
  if (grande) {
    return {
      erro: 'resposta_longa_demais',
      campo: grande,
      mensagem:
        `Uma das respostas passou de ${MAX_CHARS_POR_RESPOSTA.toLocaleString('pt-BR')} caracteres. ` +
        'Resuma o texto nesta caixa e, se precisar do conteúdo inteiro, envie o arquivo em Documentos.',
    };
  }

  const bytes = Buffer.byteLength(JSON.stringify(surveyAnswers ?? {}), 'utf8');
  if (bytes > MAX_BYTES_DO_QUESTIONARIO) {
    return {
      erro: 'questionario_grande_demais',
      mensagem:
        'O questionário inteiro passou de 200 KB. Encurte as respostas mais longas e ' +
        'envie o material extenso em Documentos, que é onde ele é indexado.',
    };
  }

  return null;
}

/** Devolve o id do primeiro campo que estourou o teto, em qualquer nível. */
function primeiraRespostaLongaDemais(valor: unknown, chave = '', nivel = 0): string | null {
  if (typeof valor === 'string') return valor.length > MAX_CHARS_POR_RESPOSTA ? chave : null;
  // 24 níveis: o corte é contra ciclo e recursão absurda, não contra profundidade
  // legítima; o teto de 8.000 tem de valer em qualquer nível (re-revisão do #373).
  if (nivel > 24 || !valor || typeof valor !== 'object') return null;

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const achado = primeiraRespostaLongaDemais(item, chave, nivel + 1);
      if (achado) return achado;
    }
    return null;
  }

  for (const [sub, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    const achado = primeiraRespostaLongaDemais(conteudo, sub, nivel + 1);
    if (achado) return achado;
  }
  return null;
}

// PUT /api/ai-training/survey: salva o conjunto completo de respostas e
// AGENDA a reingestão. A ingestão não acontece mais aqui dentro: o autosave
// da tela dispara a cada 1,5 s e cada requisição reembedava o questionário
// inteiro, sem trava, com duas ingestões podendo terminar fora de ordem
// (A007, A118). Agora um job por organização junta a rajada e lê do banco.
const surveySchema = z.object({ surveyAnswers: z.record(z.any()) });
router.put('/survey', validate(surveySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { surveyAnswers } = req.body as { surveyAnswers: Record<string, any> };

    const excesso = medirQuestionario(surveyAnswers);
    if (excesso) {
      res.status(422).json({ error: excesso.erro, message: excesso.mensagem, campo: excesso.campo });
      return;
    }

    // A leitura serve SÓ para o 'antes' da auditoria. A gravação não pode
    // sair daqui: entre esta leitura e a escrita cabem outras requisições.
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const before = ((org?.settings as any) || {}).surveyAnswers || {};

    // Gravação POR CHAVE, dentro de uma instrução só. Ler settings inteiro,
    // fundir e regravar apagava o businessHoursConfig e o llm_routing que
    // outra requisição gravou no meio, e desfazia o surveySync que o job da
    // fila acabara de escrever (A155, A156).
    await prisma.$executeRaw`
      UPDATE organizations
         SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{surveyAnswers}', ${JSON.stringify(surveyAnswers)}::jsonb, true)
       WHERE id = ${orgId}
    `;

    // Leitura FRESCA, depois da escrita: os sources registrados são os que a
    // IA tem AGORA, e o job da fila pode tê-los trocado desde a leitura de
    // cima. Reaproveitar o settings antigo repõe uma lista vencida.
    const depois = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const sourcesAtuais = ((depois?.settings as any) || {}).surveySync?.sources;

    // 'pendente' já no salvamento: a tela precisa poder dizer "a IA ainda
    // não recebeu" em vez de "salvo automaticamente" (A008). Também por
    // chave, pelo mesmo motivo da gravação acima.
    const surveySync = await marcarSincronizacaoPendente(orgId, {
      sources: Array.isArray(sourcesAtuais) ? sourcesAtuais : undefined,
    }).catch((err: any) => {
      logger.warn(`[AITraining] marcar sincronização pendente falhou: ${err?.message}`);
      return null;
    });

    // Agenda (ou reagenda) a reingestão. Falha aqui não derruba o salvamento:
    // a resposta do cliente já está gravada, e o estado fica 'pendente'.
    const agendamento = await agendarReingestaoDoQuestionario(orgId).catch((err: any) => {
      logger.warn(`[AITraining] agendar reingestão do questionário falhou: ${err?.message}`);
      return null;
    });

    const answeredCount = countAnsweredQuestions(surveyAnswers);
    await logTraining(req, 'kb.survey.update', 'survey', undefined,
      `Questionário atualizado (${answeredCount} respostas preenchidas)`,
      { before: { answered: countAnsweredQuestions(before) }, after: { answered: answeredCount } });

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({
      surveyAnswers,
      answeredCount,
      readiness,
      surveySync,
      reingestaoAgendada: Boolean(agendamento),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ai-training/activity — histórico inalterável (hash-chained) de
// tudo que alimentou a base de conhecimento: quem, o quê, quando.
router.get('/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: orgId, action: { startsWith: 'kb.' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, action: true, resource: true, resourceId: true,
        details: true, createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    res.json({ activity: logs });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// IDENTIDADE DO AGENTE
// ═══════════════════════════════════════════════════════════
const identitySchema = z.object({
  agentName: z.string().min(1).max(60).optional(),
  tone: z.enum(['friendly', 'formal', 'technical']).optional(),
  // Horário: strings livres por período (ex.: "09:00 às 18:00"). Objeto
  // fechado evita lixo entrando no prompt (o buildHoursSection lê essas chaves).
  businessHours: z
    .object({
      weekdays: z.string().max(120).optional(),
      saturday: z.string().max(120).optional(),
      sunday: z.string().max(120).optional(),
      holidays: z.string().max(120).optional(),
    })
    .partial()
    .optional(),
  greetingMessage: z.string().max(1000).optional(),
  handoffMessage: z.string().max(1000).optional(),
});

// GET /identity — devolve os campos de identidade atuais (org.settings) para
// pré-preencher o painel. Sem isso o cliente não consegue EDITAR o que já
// existe, só sobrescrever do zero.
router.get('/identity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const s = (org?.settings as any) || {};
    res.json({
      identity: {
        agentName: s.agentName || '',
        tone: (s.tone as 'friendly' | 'formal' | 'technical') || 'friendly',
        greetingMessage: s.greetingMessage || '',
        handoffMessage: s.handoffMessage || '',
        // Horário alimenta a seção "HORÁRIO DE FUNCIONAMENTO" do prompt
        // (promptEngine.buildHoursSection). Sem devolver aqui, o cliente não
        // conseguia EDITAR o que já tinha salvo.
        businessHours: {
          weekdays: s.businessHours?.weekdays || '',
          saturday: s.businessHours?.saturday || '',
          sunday: s.businessHours?.sunday || '',
          holidays: s.businessHours?.holidays || '',
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/identity', validate(identitySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const current = (org?.settings as any) || {};
    const merged = { ...current, ...req.body };

    await prisma.organization.update({
      where: { id: orgId },
      data: { settings: merged },
    });

    // Até 14/07/2026 o save parava aqui, e o agente que roda em produção nunca
    // ficava sabendo: o cliente renomeava a IA e ela continuava se apresentando
    // com o nome antigo, porque o orchestrator lê o Agent do banco, não as
    // settings. Agora a identidade que o cliente edita chega ao agente dele.
    const identitySync =
      req.body?.agentName !== undefined
        ? await syncAgentIdentity(prisma, orgId, req.body.agentName)
        : { synced: false };

    await logTraining(req, 'kb.identity.update', 'agent_identity', undefined,
      identitySync.synced
        ? `Identidade do agente atualizada: ${Object.keys(req.body).join(', ')}. Agente renomeado de "${identitySync.nomeAntigo}" para "${req.body.agentName}" em produção.`
        : `Identidade do agente atualizada: ${Object.keys(req.body).join(', ')}`,
      { before: current, after: merged });

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ settings: merged, readiness, identitySync });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// AGENDAMENTO — o dono do negócio define os tipos que a IA pode agendar.
// A config vira documento no RAG (a IA "sabe" as regras). Fonte estável
// `agendamento-config.txt` (replace-on-ingest). Opt-out remove do RAG.
// ═══════════════════════════════════════════════════════════

// Reconstrói o doc de RAG a partir do estado atual dos tipos. Se opt-out ou
// nenhum tipo ativo, remove o doc do RAG (a IA deixa de oferecer agendamento).
async function resyncSchedulingRag(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const optOut = Boolean((org?.settings as any)?.scheduling?.optOut);
  const types = optOut
    ? []
    : await (prisma as any).appointmentType.findMany({ where: { organizationId: orgId, active: true } });

  if (types.length === 0) {
    await ragService
      .deleteDocument(orgId, SCHEDULING_RAG_SOURCE)
      .catch((err: any) => logger.warn(`[AITraining] RAG remove agendamento falhou: ${err.message}`));
    return;
  }
  const doc = buildSchedulingKnowledge(types);
  await ragService
    .ingestDocument(orgId, {
      filename: SCHEDULING_RAG_SOURCE,
      content: Buffer.from(doc, 'utf-8'),
      mimeType: 'text/plain',
      metadata: { titulo: 'Agendamento' },
    })
    .catch((err: any) => logger.warn(`[AITraining] RAG sync agendamento falhou: ${err.message}`));
}

// GET /api/ai-training/scheduling — config (opt-out) + tipos cadastrados.
router.get('/scheduling', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const optOut = Boolean((org?.settings as any)?.scheduling?.optOut);
    const types = await (prisma as any).appointmentType.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
    const access = await schedulingAccessFor(orgId);
    res.json({ optOut, types, entitled: access.entitled, accessReason: access.reason });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai-training/scheduling — liga/desliga o agendamento (opt-out).
router.put('/scheduling', validate(schedulingConfigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { optOut } = req.body as { optOut: boolean };
    // Ativar (optOut=false) exige entitlement. Desativar é sempre permitido.
    if (!optOut) {
      const access = await schedulingAccessFor(orgId);
      if (!access.entitled) {
        res.status(402).json({ error: 'agendamento_requer_addon', addonKey: 'SCHEDULING_AGENT', message: 'O Agendamento pela IA está incluído a partir do plano Growth. No Lite, ative como add-on por R$ 49/mês.' });
        return;
      }
    }
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const settings = (org?.settings as any) || {};
    const merged = { ...settings, scheduling: { ...(settings.scheduling || {}), optOut, enabled: !optOut } };
    await prisma.organization.update({ where: { id: orgId }, data: { settings: merged } });

    await resyncSchedulingRag(orgId);
    await logTraining(req, 'kb.scheduling.config', 'scheduling', undefined,
      optOut ? 'Agendamento desativado' : 'Agendamento ativado');

    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ optOut, readiness });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai-training/appointment-types — cria um tipo.
router.post('/appointment-types', validate(appointmentTypeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const access = await schedulingAccessFor(orgId);
    if (!access.entitled) {
      res.status(402).json({ error: 'agendamento_requer_addon', addonKey: 'SCHEDULING_AGENT', message: 'O Agendamento pela IA está incluído a partir do plano Growth. No Lite, ative como add-on por R$ 49/mês.' });
      return;
    }
    const t = await (prisma as any).appointmentType.create({
      data: { ...req.body, organizationId: orgId },
    });
    await resyncSchedulingRag(orgId);
    await logTraining(req, 'kb.scheduling.type.create', 'appointment_type', t.id, `Tipo de agendamento criado: "${t.name}"`);
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.status(201).json({ type: t, readiness });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai-training/appointment-types/:id — atualiza.
router.put('/appointment-types/:id', validate(appointmentTypeSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    const existing = await (prisma as any).appointmentType.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      res.status(404).json({ error: 'Tipo não encontrado' });
      return;
    }
    const t = await (prisma as any).appointmentType.update({ where: { id }, data: req.body });
    await resyncSchedulingRag(orgId);
    await logTraining(req, 'kb.scheduling.type.update', 'appointment_type', t.id, `Tipo de agendamento editado: "${t.name}"`);
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ type: t, readiness });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ai-training/appointment-types/:id — remove.
router.delete('/appointment-types/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    const existing = await (prisma as any).appointmentType.findFirst({ where: { id, organizationId: orgId }, select: { id: true, name: true } });
    if (!existing) {
      res.status(404).json({ error: 'Tipo não encontrado' });
      return;
    }
    await (prisma as any).appointmentType.delete({ where: { id } });
    await resyncSchedulingRag(orgId);
    await logTraining(req, 'kb.scheduling.type.delete', 'appointment_type', id, `Tipo de agendamento removido: "${existing.name}"`);
    const readiness = await refreshAIReadiness(orgId).catch(() => null);
    res.json({ ok: true, readiness });
  } catch (err) {
    next(err);
  }
});

// ── util ────────────────────────────────────────────────
async function ensureKnowledgeBase(organizationId: string) {
  const existing = await prisma.knowledgeBase.findFirst({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.knowledgeBase.create({
    data: { organizationId, name: 'Base Principal' },
    select: { id: true },
  });
}

export default router;
