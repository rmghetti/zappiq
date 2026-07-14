/**
 * Mira Prospects — agentes de qualificação profunda (doc 08).
 *
 * Camadas: (1) especialista LLM gera análise ESTRUTURADA sobre dados já
 * verificados (nunca pesquisa inventada); (2) VERIFICADOR programático
 * derruba qualquer saída que cite produto fora do catálogo, decisor fora
 * do comitê ou contato inventado; (3) persistência com confiança honesta
 * (inferência = 55, nunca herda a confiança do registro oficial).
 *
 * Model-agnostic via llmRouter da casa (Sonnet → fallbacks), auditado em
 * LLMCallLog como toda chamada da plataforma. Custo-consciente: UMA
 * chamada por Alvo (fit de portfólio + roteiro + resumo juntos), acionada
 * por botão no dossiê (não em lote automático nesta fase).
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { llmRouter } from '../llm/LLMRouter.js';

const CONFIANCA_INFERENCIA = 55;

function extractJson(text: string): any | null {
  const cleaned = (text || '').replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let slice = cleaned.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1');
  // remove caracteres de controle que quebram JSON.parse (preserva tab/newline)
  slice = slice.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/** Linha "Rótulo: a; b; c" só quando a lista tem conteúdo (vazio some do prompt). */
function linhaLista(rotulo: string, valores: unknown, max = 12): string | null {
  if (!Array.isArray(valores)) return null;
  const lista = valores
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max);
  return lista.length ? `${rotulo}: ${lista.join('; ')}` : null;
}

function linhaTexto(rotulo: string, v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? `${rotulo}: ${v.trim()}` : null;
}

const ROTULO_CICLO: Record<string, string> = { CURTO: 'curto', MEDIO: 'médio', LONGO: 'longo' };

/**
 * Bloco "CLIENTE" do prompt do especialista: o Perfil de Prospecção inteiro
 * do caminho do Alvo (comum + B2B ou comum + B2C). É o que faz cada campo
 * preenchido na tela pesar de verdade na análise: dores e casos de uso guiam
 * o rank das oportunidades, objeções e ciclo moldam o roteiro, ticket e
 * faturamento calibram a leitura de capacidade. Campo vazio some do prompt
 * em vez de virar "não informado" (menos ruído para o modelo).
 */
export function montarContextoPerfil(perfil: any, kind: 'B2B' | 'B2C'): string {
  const catalogo: { nome: string; descricao?: string }[] = Array.isArray(perfil?.catalogo) ? perfil.catalogo : [];
  const b2b = perfil?.alvoB2B ?? {};
  const b2c = perfil?.alvoB2C ?? {};

  const comum = [
    `Quem vende: segmento "${perfil?.segmento ?? 'não informado'}"`,
    linhaLista('Subsegmentos', perfil?.subsegmentos),
    catalogo.length
      ? `Catálogo: ${catalogo.map((c) => `"${c.nome}"${c.descricao ? ` (${c.descricao})` : ''}`).join('; ')}`
      : null,
    linhaLista('Dores que o cliente resolve', perfil?.doresResolvidas),
    linhaLista('Resultados que costuma entregar', perfil?.resultadosEsperados),
    linhaLista('Casos de uso e gatilhos de compra', perfil?.casosDeUso),
    linhaLista('Diferenciais', perfil?.diferenciais),
    linhaLista('Concorrentes comuns', perfil?.concorrentes),
    linhaTexto('Ticket médio praticado', perfil?.ticketMedio),
  ];

  const blocoB2B = [
    linhaTexto('Faixa de faturamento das contas-alvo', b2b?.faturamentoAnual),
    linhaTexto('Faixa de funcionários das contas-alvo', b2b?.numFuncionarios),
    linhaLista('Maturidade digital e tecnologias que indicam fit', b2b?.technographics),
    linhaLista('Sinais de intenção que priorizam a conta', b2b?.sinaisIntencao),
    linhaLista('Influenciadores típicos da compra', b2b?.influenciadores),
    linhaLista('Usuário final típico', b2b?.usuarioFinal),
    linhaTexto('Objeções comuns e como contornar', b2b?.objecoes),
    b2b?.cicloVenda ? `Ciclo de venda típico: ${ROTULO_CICLO[String(b2b.cicloVenda)] ?? String(b2b.cicloVenda)}` : null,
    linhaLista('Clientes-referência (procurar contas parecidas)', b2b?.clientesReferencia),
  ];

  const blocoB2C = [
    linhaTexto('Faixa etária do público', b2c?.faixaEtaria),
    b2c?.genero && b2c.genero !== 'TODOS' ? `Gênero predominante do público: ${String(b2c.genero).toLowerCase()}` : null,
    linhaTexto('Faixa de renda do público', b2c?.faixaRenda),
    linhaLista('Ocupações típicas do público', b2c?.ocupacao),
    linhaLista('Composição familiar típica', b2c?.composicaoFamiliar),
    linhaLista('Tipo de região e raio de atendimento', b2c?.tipoRegiao),
    linhaLista('Interesses do público', b2c?.interesses),
    linhaLista('Canais onde o público está', b2c?.canais),
    linhaLista('Hábitos de consumo', b2c?.habitosConsumo),
    linhaLista('Momento de vida que dispara a compra', b2c?.momentoDeVida),
    linhaLista('Dores e desejos do consumidor', b2c?.doresDesejos),
    linhaTexto('Capacidade de pagamento do público', b2c?.capacidadePagamento),
    linhaLista('Influenciadores na decisão do consumidor', b2c?.influenciadoresB2C),
  ];

  return [...comum, ...(kind === 'B2C' ? blocoB2C : blocoB2B)].filter((l): l is string => Boolean(l)).join('\n');
}

/** Red flags e must-haves do caminho, exatamente como o cliente os declarou. */
export function criteriosDeCorte(perfil: any, kind: 'B2B' | 'B2C'): { redFlags: string[]; mustHaves: string[] } {
  const lista = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : [];
  if (kind === 'B2C') return { redFlags: lista(perfil?.alvoB2C?.redFlagsB2C), mustHaves: [] };
  return { redFlags: lista(perfil?.alvoB2B?.redFlagsB2B), mustHaves: lista(perfil?.alvoB2B?.mustHavesB2B) };
}

export interface AprofundarResult {
  ok: boolean;
  oportunidades: number;
  roteiros: number;
  descartadosPeloVerificador: string[];
  /** Critérios de corte do Perfil que o analista confirmou nos dados. */
  alertasCorte?: string[];
  motivo?: string;
}

export async function aprofundarAlvo(organizationId: string, alvoId: string): Promise<AprofundarResult> {
  const alvo = await (prisma as any).miraAlvo.findFirst({
    where: { id: alvoId, organizationId },
    include: { decisores: { orderBy: { confianca: 'desc' } } },
  });
  if (!alvo) {
    const err: any = new Error('alvo_not_found');
    err.status = 404;
    throw err;
  }
  const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId } });
  const catalogo: { nome: string; descricao?: string }[] = Array.isArray(perfil?.catalogo) ? perfil.catalogo : [];
  if (catalogo.length === 0) {
    const err: any = new Error('catalogo_vazio');
    err.status = 412;
    throw err;
  }

  // O caminho do Alvo decide qual bloco do Perfil entra na análise: um Alvo
  // B2C (negócio local) se cruza com o público consumidor declarado, não com
  // firmografia de empresa.
  const kind: 'B2B' | 'B2C' = alvo.kind === 'B2C' ? 'B2C' : 'B2B';
  const corte = criteriosDeCorte(perfil, kind);
  const temCorte = corte.redFlags.length > 0 || corte.mustHaves.length > 0;

  // ── Camada 1: especialista (uma chamada, saída estruturada) ────────
  const system = [
    'Você é o analista de inteligência comercial do Mira Prospects (ZappIQ).',
    'Sua tarefa: cruzar os DADOS VERIFICADOS de uma conta-alvo com o perfil de prospecção do cliente e produzir a análise de abordagem.',
    'REGRAS INEGOCIÁVEIS:',
    '1. Use SOMENTE os dados fornecidos. NUNCA invente fato, telefone, e-mail, nome ou notícia.',
    '2. Em "produto", use EXATAMENTE um nome do catálogo fornecido (cópia literal).',
    '3. Em cada roteiro, "decisor" deve ser EXATAMENTE um nome da lista de decisores.',
    '4. Se os dados não sustentarem uma conclusão, escreva "dados insuficientes" no campo.',
    '5. Português do Brasil, tom humano e direto, frases curtas. NUNCA use travessão (o caractere de traço longo).',
    '6. Responda EXCLUSIVAMENTE com o JSON pedido, sem texto antes ou depois, sem cercas de código.',
    ...(temCorte
      ? ['7. Em "corte", cite SOMENTE itens copiados literalmente das listas de critérios fornecidas. Se os dados não confirmarem nada, devolva listas vazias.']
      : []),
  ].join('\n');

  const dadosConta = [
    `Conta: ${alvo.nome}${alvo.nomeFantasia ? ` (${alvo.nomeFantasia})` : ''}`,
    alvo.cnae ? `Atividade (CNAE ${alvo.cnae})${alvo.situacaoCadastral ? `, situação ${alvo.situacaoCadastral}` : ''}` : null,
    alvo.porte ? `Porte: ${alvo.porte}` : null,
    alvo.municipio ? `Local: ${[alvo.municipio, alvo.uf].filter(Boolean).join('/')}` : null,
    `Decisores (fonte: quadro societário oficial): ${alvo.decisores.length ? alvo.decisores.map((d: any) => `${d.nome} [${d.papel}]`).join('; ') : 'nenhum mapeado'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const dadosCliente = montarContextoPerfil(perfil, kind);

  const user = [
    'DADOS VERIFICADOS DA CONTA-ALVO:',
    dadosConta,
    '',
    'CLIENTE (quem vai prospectar) E SEU PERFIL DE PROSPECÇÃO:',
    dadosCliente,
    ...(temCorte
      ? [
          '',
          'CRITÉRIOS DE CORTE DECLARADOS PELO CLIENTE:',
          ...(corte.redFlags.length
            ? [`Red flags (se os dados verificados confirmarem alguma, a conta perde prioridade): ${corte.redFlags.join('; ')}`]
            : []),
          ...(corte.mustHaves.length
            ? [`Must-haves (condições sem as quais não vale prospectar): ${corte.mustHaves.join('; ')}`]
            : []),
        ]
      : []),
    '',
    'Use o perfil de prospecção de verdade: as dores e casos de uso guiam o rank das oportunidades; objeções e ciclo de venda moldam o roteiro; ticket, faturamento e porte calibram a leitura de capacidade.',
    '',
    'Devolva este JSON:',
    '{',
    '  "resumo": "parágrafo executivo do alvo para o vendedor (3-4 frases, só fatos fornecidos + leitura honesta)",',
    '  "oportunidades": [',
    '    {"rank": 1, "produto": "nome EXATO do catálogo", "racional": "por que este produto encaixa nesta conta (2-3 frases, ancorado na atividade/porte/local E nas dores/casos de uso do perfil)", "demandaPresumida": "a dor provável que sustenta o encaixe (1 frase, honesta: é presunção, não fato)"},',
    '    {"rank": 2, "produto": "outro nome EXATO do catálogo", "racional": "...", "demandaPresumida": "..."}',
    '  ],',
    '  "roteiros": [',
    '    {"decisor": "nome EXATO da lista", "mensagem": "primeira mensagem de abordagem (3-5 frases, SPICED: situação, dor provável, impacto, gancho; antecipe a objeção declarada quando houver; sem travessão; sem inventar fatos; terminar com pergunta leve)"}',
    temCorte ? '  ],' : '  ]',
    ...(temCorte
      ? [
          '  "corte": {"redFlagsConfirmadas": ["cópia EXATA de uma red flag da lista, SÓ se os dados verificados a confirmarem"], "mustHavesNaoConfirmados": ["cópia EXATA de um must-have que os dados verificados NÃO confirmam"]}',
        ]
      : []),
    '}',
  ].join('\n');

  let parsed: any = null;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1600,
      temperature: 0.4,
      forceProvider: 'anthropic-sonnet' as any,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
  } catch (e) {
    logger.warn(`[MiraAgentes] LLM falhou alvo=${alvoId}: ${String(e)}`);
    return { ok: false, oportunidades: 0, roteiros: 0, descartadosPeloVerificador: [], motivo: 'llm_indisponivel' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, oportunidades: 0, roteiros: 0, descartadosPeloVerificador: [], motivo: 'saida_invalida' };
  }

  // ── Camada 2: VERIFICADOR programático (derruba invenção) ──────────
  const descartados: string[] = [];
  const catalogoNorm = new Map(catalogo.map((c) => [norm(c.nome), c.nome]));
  const decisoresNorm = new Map(alvo.decisores.map((d: any) => [norm(d.nome), d]));

  const oportunidadesOk: { rank: number; produto: string; racional: string; demandaPresumida: string }[] = [];
  for (const o of Array.isArray(parsed.oportunidades) ? parsed.oportunidades.slice(0, 2) : []) {
    const produtoCanonico = catalogoNorm.get(norm(String(o?.produto ?? '')));
    if (!produtoCanonico) {
      descartados.push(`oportunidade com produto fora do catálogo: "${String(o?.produto ?? '')}"`);
      continue;
    }
    const racional = String(o?.racional ?? '').trim();
    if (racional.length < 20) {
      descartados.push(`oportunidade "${produtoCanonico}" sem racional`);
      continue;
    }
    oportunidadesOk.push({
      rank: oportunidadesOk.length + 1,
      produto: produtoCanonico,
      racional: racional.slice(0, 900),
      demandaPresumida: String(o?.demandaPresumida ?? '').slice(0, 400),
    });
  }

  const contatoInventado = /\b\d{8,}\b|@[a-z0-9.-]+\.[a-z]{2,}/i; // telefone/e-mail não vem dos dados
  const roteirosOk: { decisorId: string; decisor: string; mensagem: string }[] = [];
  for (const r of Array.isArray(parsed.roteiros) ? parsed.roteiros.slice(0, 3) : []) {
    const dec: any = decisoresNorm.get(norm(String(r?.decisor ?? '')));
    if (!dec) {
      descartados.push(`roteiro para decisor fora do comitê: "${String(r?.decisor ?? '')}"`);
      continue;
    }
    const msg = String(r?.mensagem ?? '').trim();
    if (msg.length < 40) {
      descartados.push(`roteiro para ${dec.nome} curto demais`);
      continue;
    }
    if (contatoInventado.test(msg)) {
      descartados.push(`roteiro para ${dec.nome} continha contato inventado`);
      continue;
    }
    roteirosOk.push({ decisorId: dec.id, decisor: dec.nome, mensagem: msg.replace(/—/g, ',').slice(0, 1200) });
  }

  // Critérios de corte: só passa o que estiver ancorado na lista DECLARADA
  // pelo cliente (cópia literal, ignorando caixa/acento). Citação fora da
  // lista é invenção e cai como qualquer outra.
  const alertasCorte: string[] = [];
  if (temCorte) {
    const redFlagsNorm = new Map(corte.redFlags.map((f) => [norm(f), f]));
    const mustHavesNorm = new Map(corte.mustHaves.map((f) => [norm(f), f]));
    const vistosCorte = new Set<string>();
    for (const f of Array.isArray(parsed?.corte?.redFlagsConfirmadas) ? parsed.corte.redFlagsConfirmadas.slice(0, 8) : []) {
      const canonico = redFlagsNorm.get(norm(String(f ?? '')));
      if (!canonico) {
        descartados.push(`corte citou red flag fora da lista: "${String(f ?? '')}"`);
        continue;
      }
      if (vistosCorte.has(`rf:${canonico}`)) continue;
      vistosCorte.add(`rf:${canonico}`);
      alertasCorte.push(`Red flag confirmada: ${canonico}`);
    }
    for (const f of Array.isArray(parsed?.corte?.mustHavesNaoConfirmados) ? parsed.corte.mustHavesNaoConfirmados.slice(0, 8) : []) {
      const canonico = mustHavesNorm.get(norm(String(f ?? '')));
      if (!canonico) {
        descartados.push(`corte citou must-have fora da lista: "${String(f ?? '')}"`);
        continue;
      }
      if (vistosCorte.has(`mh:${canonico}`)) continue;
      vistosCorte.add(`mh:${canonico}`);
      alertasCorte.push(`Must-have não confirmado nos dados: ${canonico}`);
    }
  }

  // ── Camada 3: persistência com confiança honesta ───────────────────
  const agora = new Date().toISOString();
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.miraOportunidade.deleteMany({ where: { alvoId: alvo.id } });
    for (const o of oportunidadesOk) {
      await tx.miraOportunidade.create({
        data: {
          alvoId: alvo.id,
          rank: o.rank,
          produto: o.produto,
          racional: o.racional,
          roteiro:
            o.rank === 1 && roteirosOk.length
              ? { porSponsor: roteirosOk, confianca: CONFIANCA_INFERENCIA, geradoEm: agora }
              : undefined,
        },
      });
      // Demanda presumida vira MiraDemanda com confiança de inferência
      if (o.demandaPresumida && norm(o.demandaPresumida) !== 'dados insuficientes') {
        await tx.miraDemanda.upsert({
          where: { id: `${alvo.id}-presumida-${o.rank}` },
          create: {
            id: `${alvo.id}-presumida-${o.rank}`,
            alvoId: alvo.id,
            rank: o.rank,
            descricao: o.demandaPresumida,
            evidencia: 'Presunção analítica sobre firmografia oficial (sem fonte externa ainda)',
            confianca: CONFIANCA_INFERENCIA,
          },
          update: { descricao: o.demandaPresumida },
        });
      }
    }
    const resumoLlm = String(parsed.resumo ?? '').trim();
    // O corte confirmado entra no resumo do dossiê: é onde o vendedor lê a
    // qualificação, e red flag escondida em log não protege ninguém.
    const resumoBase = resumoLlm.length >= 40 ? resumoLlm.replace(/—/g, ',') : String(alvo.resumo ?? '');
    const avisoCorte = alertasCorte.length ? `Atenção do verificador: ${alertasCorte.join('; ')}.` : '';
    const resumoFinal = [resumoBase, avisoCorte].filter(Boolean).join(' ').slice(0, 1200);
    const fontes = Array.isArray(alvo.fontes) ? alvo.fontes : [];
    fontes.push({ campo: 'analise_ia', url: 'inferencia:llm', data: agora, confianca: CONFIANCA_INFERENCIA });
    await tx.miraAlvo.update({
      where: { id: alvo.id },
      data: {
        resumo: resumoFinal || alvo.resumo,
        fontes,
      },
    });
  });

  logger.info(
    `[MiraAgentes] alvo=${alvoId} aprofundado: ${oportunidadesOk.length} oportunidades, ${roteirosOk.length} roteiros, ${alertasCorte.length} alertas de corte, ${descartados.length} descartados pelo verificador`
  );
  return {
    ok: true,
    oportunidades: oportunidadesOk.length,
    roteiros: roteirosOk.length,
    descartadosPeloVerificador: descartados,
    alertasCorte,
  };
}
