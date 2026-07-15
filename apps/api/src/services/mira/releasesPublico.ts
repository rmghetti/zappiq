/**
 * Mira Prospects — Releases por PEGADA PUBLICA (2o nivel).
 *
 * Depois que a empresa ja e um Alvo, o monitoramento semanal olha a pegada
 * publica DAQUELA conta e traz o que ela publica/o que sai sobre ela: posts
 * de LinkedIn quando indexados publicamente + noticias/site. Le so o indice
 * de busca (nunca sessao logada), um LLM seleciona o que e relevante para o
 * catalogo do cliente e o verificador exige que cada item aponte para uma
 * fonte real. Confianca menor que o diff oficial da Receita (web publica).
 *
 * Orcamento: poucas buscas por Alvo, poucos Alvos por org (teto no cron),
 * para caber no tier gratuito do provedor de busca (100/dia).
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { llmRouter } from '../llm/LLMRouter.js';
import { webSearch, buscaPublicaDisponivel, type SerpResult } from './buscaPublica.js';

export interface ReleaseDraft {
  titulo: string;
  resumo: string;
  url: string;
  relevancia: string;
  anguloAbordagem: string | null;
  produtoRelacionado: string | null;
  confianca: number;
}

/** Fornecedor que a conta JÁ usa, achado na pegada pública (nunca presumido). */
export interface IncumbenteDraft {
  fornecedor: string;
  categoria: string | null;
  evidencia: string;
  fonte: string;
  /** ALTA | MEDIA | BAIXA + motivo curto. */
  deslocabilidade: string | null;
}

/** Demanda com EVIDÊNCIA externa (diferente da presumida pelo analista). */
export interface DemandaDraft {
  descricao: string;
  evidencia: string;
  fonte: string;
  confianca: number;
}

export interface PegadaPublicaResult {
  releases: ReleaseDraft[];
  incumbentes: IncumbenteDraft[];
  demandas: DemandaDraft[];
  /** Gatilho de janela de entrada, quando o material sustenta um. */
  janela: string | null;
  buscas: number;
  /** A busca quebrou (fonte fora do ar). Distinto de "não achou nada". */
  erro?: string;
}

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function extractJson(text: string): any | null {
  const cleaned = (text || '').replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let slice = cleaned.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1');
  slice = slice.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

/** Sinais do Perfil que calibram a relevancia dos releases. */
export interface SinaisDoPerfil {
  doresResolvidas?: string[];
  sinaisIntencao?: string[];
}

/**
 * Linhas do prompt que levam os sinais do Perfil ao analista: a relevancia de
 * uma novidade nao e absoluta, e relativa ao que o cliente resolve e ao que
 * ele declarou como sinal de timing de compra.
 */
export function montarLinhasSinais(sinais?: SinaisDoPerfil): string[] {
  const lista = (v: unknown, max = 10) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max) : [];
  const dores = lista(sinais?.doresResolvidas);
  const intencao = lista(sinais?.sinaisIntencao);
  const linhas: string[] = [];
  if (dores.length) linhas.push(`DORES QUE O CLIENTE RESOLVE (novidade que toca nelas vale mais): ${dores.join('; ')}`);
  if (intencao.length) linhas.push(`SINAIS DE INTENCAO QUE O CLIENTE PRIORIZA (procure-os nas novidades): ${intencao.join('; ')}`);
  return linhas;
}

/**
 * Pesquisa a pegada publica de UM Alvo e extrai TUDO que a web sustenta:
 * novidades (releases), fornecedor atual (incumbente), demandas com evidencia
 * e o gatilho de janela de entrada.
 *
 * Uma passada so de proposito: as 3 buscas e a UNICA chamada de LLM servem
 * aos quatro. O orcamento de busca e real (o plano Free da Brave da ~1000
 * buscas/mes para a plataforma inteira), entao pesquisar 3x a mesma conta
 * para colher coisas diferentes seria desperdicio puro.
 *
 * O verificador e o mesmo em todos: item que nao aponta para um resultado
 * REAL da busca nao passa. Incumbente ganha uma trava extra (o nome do
 * fornecedor precisa aparecer literalmente no texto da fonte), porque dizer
 * "quem atende essa conta hoje e a Empresa X" errado e pior que nao dizer.
 */
export async function pesquisarPegadaPublica(
  organizationId: string,
  alvo: { id: string; nome: string; nomeFantasia?: string | null; municipio?: string | null; uf?: string | null },
  catalogo: { nome: string }[],
  sinais?: SinaisDoPerfil
): Promise<PegadaPublicaResult> {
  const vazio: PegadaPublicaResult = { releases: [], incumbentes: [], demandas: [], janela: null, buscas: 0 };
  if (!buscaPublicaDisponivel()) return { ...vazio, erro: 'fonte_indisponivel' };
  const empresa = String(alvo.nomeFantasia || alvo.nome || '').trim();
  if (empresa.length < 2) return vazio;

  // Tres trilhas: posts do LinkedIn (o pedido do cliente), noticias/novidades
  // e a pegada de FORNECEDOR (quem ja atende a conta hoje).
  const queries = [
    `"${empresa}" site:linkedin.com/posts`,
    `"${empresa}" (lancamento OR expansao OR investimento OR contratacao OR inauguracao OR parceria OR aquisicao OR novo)`,
    `"${empresa}" (fornecedor OR parceiro OR "em parceria com" OR contratou OR implantou OR "cliente da")`,
  ];

  const resultados: SerpResult[] = [];
  const vistos = new Set<string>();
  const falhas: string[] = [];
  let buscas = 0;
  for (const q of queries) {
    try {
      const hits = await webSearch(organizationId, q, { limit: 6, alvoId: alvo.id });
      buscas++;
      for (const h of hits) {
        if (vistos.has(h.url)) continue;
        vistos.add(h.url);
        resultados.push(h);
      }
    } catch (err: any) {
      // Não aborta o laço (as outras trilhas podem responder), mas nunca
      // esconde que a fonte falhou: 0 resultados por busca quebrada não é a
      // mesma coisa que 0 resultados porque a conta não publicou nada. Quem
      // chama (cron varrendo várias contas x manual do Aprofundar) decide o
      // que fazer com `erro` — o cron loga e segue; o botão avisa o cliente.
      logger.warn(`[MiraPegadaPublica] busca falhou alvo=${alvo.id}: ${err?.message ?? err}`);
      falhas.push(String(err?.message ?? err));
    }
  }
  if (resultados.length === 0) {
    return { ...vazio, buscas, ...(falhas.length ? { erro: falhas[0] } : {}) };
  }

  const fontesTxt = resultados
    .slice(0, 12)
    .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.snippet}\n    fonte: ${r.url}`)
    .join('\n');

  const system = [
    'Voce e o analista de sinais do Mira Prospects. Le resultados de busca publicos sobre uma conta-alvo e extrai o que serve para quem vende um catalogo especifico.',
    'REGRAS INEGOCIAVEIS:',
    '1. Use SOMENTE o que aparece nos resultados. NUNCA invente fato, numero, data, fornecedor ou citacao.',
    '2. So inclua o item se ele for plausivelmente relevante para ao menos um produto do catalogo do cliente.',
    '3. "produtoRelacionado" deve ser um nome EXATO do catalogo, ou null.',
    '4. Em "incumbentes", so cite fornecedor cujo NOME aparece literalmente no resultado. Se o texto nao nomeia quem atende a conta, devolva lista vazia. NUNCA presuma o fornecedor pelo setor.',
    '5. Em "demandas", so inclua o que o resultado EVIDENCIA (a conta disse/publicou/saiu na noticia). Presuncao sua nao entra aqui.',
    '6. Portugues do Brasil, frases curtas, sem travessao.',
    '7. Responda EXCLUSIVAMENTE com o JSON pedido, sem texto antes ou depois, sem cercas de codigo.',
  ].join('\n');

  const user = [
    `CONTA-ALVO: ${empresa}${alvo.municipio ? ` (${[alvo.municipio, alvo.uf].filter(Boolean).join('/')})` : ''}`,
    `CATALOGO DO CLIENTE: ${catalogo.map((c) => `"${c.nome}"`).join(', ') || '(nao informado)'}`,
    ...montarLinhasSinais(sinais),
    '',
    'RESULTADOS PUBLICOS RECENTES:',
    fontesTxt,
    '',
    'Devolva este JSON (listas vazias quando os resultados nao sustentarem nada):',
    '{',
    '  "releases": [',
    '    {"fonteIndice": 1, "titulo": "titulo curto do fato", "resumo": "1-2 frases so com o que esta no resultado", "relevancia": "por que importa para ESTE cliente (1 frase)", "angulo": "gancho de abordagem (1 frase)", "produtoRelacionado": "nome EXATO do catalogo ou null"}',
    '  ],',
    '  "incumbentes": [',
    '    {"fonteIndice": 1, "fornecedor": "nome EXATO como aparece no resultado", "categoria": "o que ele fornece (curto) ou null", "evidencia": "o trecho/fato que mostra a relacao (1 frase)", "deslocabilidade": "ALTA|MEDIA|BAIXA + motivo curto"}',
    '  ],',
    '  "demandas": [',
    '    {"fonteIndice": 1, "descricao": "a necessidade que o resultado EVIDENCIA (1 frase)", "evidencia": "o trecho/fato que sustenta (1 frase)"}',
    '  ],',
    '  "janela": "o gatilho de entrada AGORA (1 frase), ou null se os resultados nao mostrarem nenhum"',
    '}',
  ].join('\n');

  let parsed: any = null;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1200,
      temperature: 0.3,
      forceProvider: 'anthropic-sonnet' as any,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
  } catch (e) {
    logger.warn(`[MiraPegadaPublica] LLM falhou alvo=${alvo.id}: ${String(e)}`);
    return { ...vazio, buscas };
  }

  const catalogoNorm = new Map(catalogo.map((c) => [norm(c.nome), c.nome]));
  /** Corpus para o verificador: só o que veio de fonte real. */
  const corpusNorm = norm(resultados.map((r) => `${r.title} ${r.snippet}`).join(' \n '));

  const releases: ReleaseDraft[] = [];
  for (const r of Array.isArray(parsed?.releases) ? parsed.releases.slice(0, 2) : []) {
    const fonte = resultados[Number(r?.fonteIndice) - 1];
    if (!fonte) continue; // verificador: precisa apontar para uma fonte real
    const titulo = String(r?.titulo ?? '').trim();
    const resumo = String(r?.resumo ?? '').trim();
    if (titulo.length < 4 || resumo.length < 10) continue;
    const prodBruto = r?.produtoRelacionado ? norm(String(r.produtoRelacionado)) : '';
    const produtoRelacionado = prodBruto ? catalogoNorm.get(prodBruto) ?? null : null;
    const ehLinkedin = /linkedin\.com/.test(fonte.url);
    releases.push({
      titulo: (ehLinkedin ? 'LinkedIn: ' : '') + titulo.slice(0, 180),
      resumo: resumo.slice(0, 600),
      url: fonte.url,
      relevancia: String(r?.relevancia ?? '').slice(0, 400) || 'Novidade recente da conta no radar publico.',
      anguloAbordagem: r?.angulo ? String(r.angulo).slice(0, 300) : null,
      produtoRelacionado,
      confianca: 60, // pegada publica (web), abaixo do diff oficial da Receita (90)
    });
  }

  const incumbentes: IncumbenteDraft[] = [];
  for (const i of Array.isArray(parsed?.incumbentes) ? parsed.incumbentes.slice(0, 3) : []) {
    const fonte = resultados[Number(i?.fonteIndice) - 1];
    if (!fonte) continue;
    const fornecedor = String(i?.fornecedor ?? '').trim();
    if (fornecedor.length < 2) continue;
    // Trava extra: o NOME do fornecedor tem que aparecer literalmente numa
    // fonte. Apontar o concorrente errado dentro da conta do cliente destroi
    // a confianca no dossie inteiro.
    if (!corpusNorm.includes(norm(fornecedor))) continue;
    // O proprio Alvo nao e fornecedor dele mesmo.
    if (norm(fornecedor) === norm(empresa)) continue;
    const evidencia = String(i?.evidencia ?? '').trim();
    if (evidencia.length < 10) continue;
    incumbentes.push({
      fornecedor: fornecedor.slice(0, 160),
      categoria: i?.categoria ? String(i.categoria).slice(0, 120) : null,
      evidencia: evidencia.slice(0, 500),
      fonte: fonte.url,
      deslocabilidade: i?.deslocabilidade ? String(i.deslocabilidade).slice(0, 200) : null,
    });
  }

  const demandas: DemandaDraft[] = [];
  for (const d of Array.isArray(parsed?.demandas) ? parsed.demandas.slice(0, 2) : []) {
    const fonte = resultados[Number(d?.fonteIndice) - 1];
    if (!fonte) continue;
    const descricao = String(d?.descricao ?? '').trim();
    const evidencia = String(d?.evidencia ?? '').trim();
    if (descricao.length < 10 || evidencia.length < 10) continue;
    demandas.push({
      descricao: descricao.slice(0, 500),
      evidencia: evidencia.slice(0, 500),
      fonte: fonte.url,
      // Acima da presuncao do analista (55), abaixo do registro oficial (90):
      // e fato publicado, mas de fonte web.
      confianca: 70,
    });
  }

  const janelaBruta = parsed?.janela ? String(parsed.janela).trim() : '';
  const janela = janelaBruta && norm(janelaBruta) !== 'null' && janelaBruta.length >= 10 ? janelaBruta.slice(0, 400) : null;

  return { releases, incumbentes, demandas, janela, buscas };
}

/**
 * Fachada para o cron semanal, que só quer os releases. Mantida para o cron
 * não precisar conhecer incumbente/demanda: ele publica novidade, não monta
 * dossiê.
 */
export async function buscarReleasesPublicos(
  organizationId: string,
  alvo: { id: string; nome: string; nomeFantasia?: string | null; municipio?: string | null; uf?: string | null },
  catalogo: { nome: string }[],
  sinais?: SinaisDoPerfil
): Promise<{ drafts: ReleaseDraft[]; buscas: number; erro?: string }> {
  const r = await pesquisarPegadaPublica(organizationId, alvo, catalogo, sinais);
  return { drafts: r.releases, buscas: r.buscas, ...(r.erro ? { erro: r.erro } : {}) };
}

/**
 * Grava os drafts como MiraRelease, com o MESMO dedup do cron (mesma URL nos
 * últimos 45 dias não repete). Compartilhado entre o cron semanal e o botão
 * "Aprofundar com IA" (Fase 2) para as duas trilhas gravarem exatamente igual.
 */
export async function persistirReleaseDrafts(
  organizationId: string,
  alvoId: string,
  drafts: ReleaseDraft[]
): Promise<{ criados: number }> {
  let criados = 0;
  for (const d of drafts) {
    const dup = await (prisma as any).miraRelease.findFirst({
      where: { alvoId, url: d.url, createdAt: { gte: new Date(Date.now() - 45 * 86400000) } },
      select: { id: true },
    });
    if (dup) continue;
    await prisma.miraRelease.create({
      data: {
        organizationId,
        alvoId,
        titulo: d.titulo,
        resumo: d.resumo,
        url: d.url,
        relevancia: d.relevancia,
        anguloAbordagem: d.anguloAbordagem,
        produtoRelacionado: d.produtoRelacionado,
        confianca: d.confianca,
      },
    });
    criados++;
  }
  return { criados };
}
