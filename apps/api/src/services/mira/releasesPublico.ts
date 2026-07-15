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
 * Busca a pegada publica recente de UM Alvo e devolve os releases relevantes
 * ao catalogo do cliente. Retorna também quantas buscas consumiu (orcamento).
 */
export async function buscarReleasesPublicos(
  organizationId: string,
  alvo: { id: string; nome: string; nomeFantasia?: string | null; municipio?: string | null; uf?: string | null },
  catalogo: { nome: string }[],
  sinais?: SinaisDoPerfil
): Promise<{ drafts: ReleaseDraft[]; buscas: number; erro?: string }> {
  if (!buscaPublicaDisponivel()) return { drafts: [], buscas: 0, erro: 'fonte_indisponivel' };
  const empresa = String(alvo.nomeFantasia || alvo.nome || '').trim();
  if (empresa.length < 2) return { drafts: [], buscas: 0 };

  // Duas trilhas: posts do LinkedIn (o pedido do cliente) + noticias/novidades.
  const queries = [
    `"${empresa}" site:linkedin.com/posts`,
    `"${empresa}" (lancamento OR expansao OR investimento OR contratacao OR inauguracao OR parceria OR aquisicao OR novo)`,
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
      // Não aborta o laço (a outra trilha pode responder), mas nunca esconde
      // que a fonte falhou: 0 resultados por busca quebrada não é a mesma
      // coisa que 0 resultados porque a conta não publicou nada. Quem chama
      // (cron varrendo várias contas x manual do Aprofundar) decide o que
      // fazer com `erro` — o cron loga e segue; o botão avisa o cliente.
      logger.warn(`[MiraReleasesPublico] busca falhou alvo=${alvo.id}: ${err?.message ?? err}`);
      falhas.push(String(err?.message ?? err));
    }
  }
  if (resultados.length === 0) {
    return { drafts: [], buscas, ...(falhas.length ? { erro: falhas[0] } : {}) };
  }

  const fontesTxt = resultados
    .slice(0, 10)
    .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.snippet}\n    fonte: ${r.url}`)
    .join('\n');

  const system = [
    'Voce e o analista de sinais do Mira Prospects. Seleciona novidades RELEVANTES de uma conta-alvo para quem vende um catalogo especifico.',
    'REGRAS INEGOCIAVEIS:',
    '1. Use SOMENTE o que aparece nos resultados. NUNCA invente fato, numero, data ou citacao.',
    '2. So inclua o item se ele for plausivelmente relevante para ao menos um produto do catalogo do cliente.',
    '3. "produtoRelacionado" deve ser um nome EXATO do catalogo, ou null.',
    '4. Portugues do Brasil, frases curtas, sem travessao.',
    '5. Responda EXCLUSIVAMENTE com o JSON pedido, sem texto antes ou depois, sem cercas de codigo.',
  ].join('\n');

  const user = [
    `CONTA-ALVO: ${empresa}${alvo.municipio ? ` (${[alvo.municipio, alvo.uf].filter(Boolean).join('/')})` : ''}`,
    `CATALOGO DO CLIENTE: ${catalogo.map((c) => `"${c.nome}"`).join(', ') || '(nao informado)'}`,
    ...montarLinhasSinais(sinais),
    '',
    'RESULTADOS PUBLICOS RECENTES:',
    fontesTxt,
    '',
    'Selecione no maximo 2 novidades relevantes. Devolva este JSON:',
    '{',
    '  "releases": [',
    '    {"fonteIndice": 1, "titulo": "titulo curto do fato", "resumo": "1-2 frases so com o que esta no resultado", "relevancia": "por que importa para ESTE cliente (1 frase)", "angulo": "gancho de abordagem (1 frase)", "produtoRelacionado": "nome EXATO do catalogo ou null"}',
    '  ]',
    '}',
  ].join('\n');

  let parsed: any = null;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 700,
      temperature: 0.3,
      forceProvider: 'anthropic-sonnet' as any,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
  } catch (e) {
    logger.warn(`[MiraReleasesPublico] LLM falhou alvo=${alvo.id}: ${String(e)}`);
    return { drafts: [], buscas };
  }

  const catalogoNorm = new Map(catalogo.map((c) => [norm(c.nome), c.nome]));
  const drafts: ReleaseDraft[] = [];
  for (const r of Array.isArray(parsed?.releases) ? parsed.releases.slice(0, 2) : []) {
    const idx = Number(r?.fonteIndice);
    const fonte = resultados[idx - 1];
    if (!fonte) continue; // verificador: precisa apontar para uma fonte real
    const titulo = String(r?.titulo ?? '').trim();
    const resumo = String(r?.resumo ?? '').trim();
    if (titulo.length < 4 || resumo.length < 10) continue;
    const prodBruto = r?.produtoRelacionado ? norm(String(r.produtoRelacionado)) : '';
    const produtoRelacionado = prodBruto ? catalogoNorm.get(prodBruto) ?? null : null;
    const ehLinkedin = /linkedin\.com/.test(fonte.url);
    drafts.push({
      titulo: (ehLinkedin ? 'LinkedIn: ' : '') + titulo.slice(0, 180),
      resumo: resumo.slice(0, 600),
      url: fonte.url,
      relevancia: String(r?.relevancia ?? '').slice(0, 400) || 'Novidade recente da conta no radar publico.',
      anguloAbordagem: r?.angulo ? String(r.angulo).slice(0, 300) : null,
      produtoRelacionado,
      confianca: 60, // pegada publica (web), abaixo do diff oficial da Receita (90)
    });
  }

  return { drafts, buscas };
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
