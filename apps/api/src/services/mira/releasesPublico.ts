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
  /** Data em que o fato foi PUBLICADO, quando a própria fonte a mostra. */
  dataPublicacao: Date | null;
  /** A necessidade que ESTE fato evidencia (vira MiraDemanda ligada). */
  demandaGerada: string | null;
  /** O espaço que ESTE fato abre no catálogo (vira MiraOportunidade ligada). */
  oportunidade: { produto: string; racional: string } | null;
}

/**
 * Confiança de um release pela QUALIDADE da fonte, não fixa.
 *
 * Antes era 60 para tudo que viesse da web. Mas "a Exame publicou que a
 * empresa investiu R$ 40mi, em 12/06" e "a própria empresa postou no
 * Instagram que está crescendo" não valem a mesma coisa, e o vendedor merece
 * enxergar a diferença antes de citar o fato numa reunião.
 *
 * O 90 fica reservado ao registro oficial (Receita), que o cron grava.
 */
export function confiancaDaFonte(url: string, temDataVerificada: boolean): number {
  const u = (url || '').toLowerCase();
  // Post da própria conta: é a empresa falando de si. Fato real, viés óbvio.
  if (/linkedin\.com|instagram\.com|facebook\.com|twitter\.com|x\.com/.test(u)) return 60;
  // Matéria/site de terceiro com data que a fonte mostra: o melhor que a web dá.
  if (temDataVerificada) return 75;
  return 65;
}

/**
 * Aceita a data só se a fonte realmente a sustenta.
 *
 * O LLM só deve devolver data que aparece no resultado, mas "deve" não é
 * garantia: data inventada num dossiê é pior que data ausente, porque o
 * vendedor cita "vi que vocês anunciaram em março" numa reunião e queima a
 * conta. Então o verificador é burro de propósito: data não parseável, no
 * futuro, ou velha demais para ser novidade não entra.
 */
export function verificarDataPublicacao(bruta: unknown, agora = new Date()): Date | null {
  if (typeof bruta !== 'string') return null;
  const txt = bruta.trim();
  if (!txt || norm(txt) === 'null') return null;
  // Só formato ISO (YYYY-MM-DD): é o que o prompt pede, e aceitar formato
  // livre aqui abriria margem para "12/06" virar mês errado.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txt)) return null;
  const d = new Date(`${txt}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > agora.getTime()) return null; // futuro não é notícia
  const CINCO_ANOS_MS = 5 * 365 * 86400000;
  if (agora.getTime() - d.getTime() > CINCO_ANOS_MS) return null; // não é novidade
  return d;
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
  /**
   * Resultados que citavam o nome mas não puderam ser confirmados como ESTA
   * empresa (homônimo). Reportado porque "0 releases" sem isto esconderia que
   * a busca ACHOU coisas e nós as recusamos: são fatos que existem, de uma
   * empresa que provavelmente não é a do dossiê.
   */
  descartadosPorHomonimo?: number;
  /** A busca quebrou (fonte fora do ar). Distinto de "não achou nada". */
  erro?: string;
}

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Id estável a partir da URL da matéria, para a demanda/oportunidade nascida
 * dela serem idempotentes: a mesma matéria reencontrada atualiza a linha em vez
 * de empilhar uma cópia. Curto de propósito (o id do Prisma tem limite prático
 * e o alvoId já vai junto no prefixo); colisão entre duas URLs DO MESMO Alvo é
 * improvável e o custo dela seria uma demanda sobrescrita, não um vazamento.
 */
export function hashUrl(url: string): string {
  let h = 2166136261; // FNV-1a
  const s = (url || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

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

/**
 * Palavras que não identificam ninguém: toda razão social brasileira tem.
 * Buscar por "COFEL COMERCIAL E INDUSTRIAL DE FERRO LIGAS LTDA" inteiro não
 * acha nada (ninguém escreve isso numa matéria), e o núcleo "COFEL" é o que
 * de fato distingue.
 */
const RUIDO_RAZAO_SOCIAL = new Set([
  'ltda', 'sa', 's', 'a', 'me', 'epp', 'eireli', 'mei', 'cia', 'e', 'de', 'da', 'do', 'das', 'dos', 'em',
  'comercio', 'comercial', 'industria', 'industrial', 'servicos', 'servico', 'empreendimentos',
  'participacoes', 'holdings', 'holding', 'distribuidora', 'importacao', 'exportacao', 'representacoes',
  'brasil', 'brasileira', 'nacional', 'group', 'grupo',
]);

/**
 * Palavras de SETOR: identificam o ramo, não a empresa. Sobrevivem no núcleo
 * (ajudam a busca: "cofel ferro ligas" acha mais que "cofel" sozinho, que
 * trazia Copel e Cofen), mas nunca podem ser o token distintivo.
 *
 * Achado na sonda de produção (15/07/2026): "INDUSTRIA E COMERCIO DE MOVEIS
 * ORNATTO LTDA" dava núcleo ["moveis", "ornatto"], e como o filtro de menção
 * usa o PRIMEIRO token, ele passou a filtrar por "moveis" — que casa com
 * qualquer moveleira do Brasil. O token que identifica é "ornatto", e ele
 * estava em segundo.
 */
const PALAVRAS_DE_SETOR = new Set([
  'moveis', 'metais', 'metalurgica', 'metalurgia', 'ferro', 'ligas', 'ferroligas', 'laminados',
  'aco', 'acos', 'maquinas', 'equipamentos', 'ferramentas', 'transportes', 'transporte', 'logistica',
  'alimentos', 'construcao', 'engenharia', 'tecnologia', 'sistemas', 'solucoes', 'produtos',
  'materiais', 'estruturas', 'montagem', 'manutencao', 'agricolas', 'perfilados', 'fundicao',
]);

/**
 * O NÚCLEO identificador do nome, para a BUSCA: o que sobra depois de tirar o
 * ruído societário, com o token distintivo na frente.
 *
 * "COFEL COMERCIAL E INDUSTRIAL DE FERRO LIGAS LTDA" → ["cofel","ferro","ligas"]
 * "INDUSTRIA E COMERCIO DE MOVEIS ORNATTO LTDA"      → ["ornatto","moveis"]
 *
 * As palavras de setor ficam (ajudam a busca a desambiguar), mas nunca à
 * frente: `nucleo[0]` é o que o filtro de menção usa, e filtrar por "moveis"
 * não filtra nada.
 */
export function nucleoDoNome(nome: string): string[] {
  const tokens = norm(nome)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !RUIDO_RAZAO_SOCIAL.has(t));
  const distintivos = tokens.filter((t) => !PALAVRAS_DE_SETOR.has(t));
  const setoriais = tokens.filter((t) => PALAVRAS_DE_SETOR.has(t));
  // Só setor no nome ("INDUSTRIA DE MOVEIS LTDA"): não há o que identificar, e
  // buscar por "moveis" varreria o Brasil. Melhor devolver nada.
  if (distintivos.length === 0) return [];
  return [...distintivos, ...setoriais].slice(0, 4);
}

/**
 * O resultado FALA da conta-alvo?
 *
 * Achado na prova de produção (15/07/2026): buscar o COFEL trazia o Instagram
 * da "COFEL Loja de Departamentos", da "Cofel Laminados", da "Metalúrgica
 * Cofelma" — e com o nome curto vinha até Copel, Cofen e Ronaldinho. A Brave
 * não honra aspas como frase exata. Sem este filtro o analista recebe uma dúzia
 * de resultados de empresas homônimas e pode atribuir "a Cofel Laminados
 * anunciou X" ao Alvo de ferro ligas. Atribuir fato de outra empresa à conta é
 * pior que não achar nada: o vendedor cita numa reunião e queima a conta.
 *
 * O `decisoresPublico.ts` já fazia isto por nome de pessoa desde 15/07; aqui o
 * padrão simplesmente não tinha sido aplicado.
 *
 * Camada 1 (necessária): o token mais distintivo do nome aparece no texto.
 */
export function mencionaAConta(r: SerpResult, nucleo: string[]): boolean {
  if (nucleo.length === 0) return false;
  const txt = norm(`${r.title} ${r.snippet} ${r.url}`);
  return txt.includes(nucleo[0]);
}

/**
 * É a MESMA empresa, e não uma homônima? (camada 2, desambiguação)
 *
 * Menção não basta: "Cofel Laminados" também menciona "cofel". Exige um
 * segundo sinal que ligue o resultado a ESTE CNPJ. Sem nenhum sinal, o
 * resultado não entra — o produto já vive do princípio "dado sem fonte não
 * entra no dossiê", e "fonte de outra empresa" é pior que fonte nenhuma.
 *
 * Sinais, do mais forte ao mais fraco:
 *  - CNPJ no texto (irrefutável; aparece em rodapé de site institucional)
 *  - nome de um decisor do QSA (registro oficial)
 *  - município + UF (a Cofel de Atibaia não é a Cofel de outra cidade)
 *  - telefone da conta
 */
export interface SinaisDaConta {
  cnpj?: string | null;
  municipio?: string | null;
  uf?: string | null;
  telefone?: string | null;
  decisores?: string[];
  /** Site oficial do Alvo, quando já descoberto (ver siteOficial.ts). */
  site?: string | null;
}

export function confirmaAConta(r: SerpResult, sinais: SinaisDaConta): { confirma: boolean; por: string | null } {
  const txt = norm(`${r.title} ${r.snippet} ${r.url}`);
  const soDigitos = (r.title + r.snippet + r.url).replace(/\D/g, '');

  // O domínio próprio é o sinal mais forte: se a matéria está no site da
  // empresa, é a empresa. Só vale porque `alvo.site` passa por um crivo alto
  // antes de ser gravado (siteOficial.ts) — site errado aqui confirmaria a
  // empresa errada.
  const hostDoAlvo = hostDe(sinais.site);
  const hostDoResultado = hostDe(r.url);
  if (hostDoAlvo && hostDoResultado && hostDoResultado === hostDoAlvo) {
    return { confirma: true, por: 'publicado no site oficial da conta' };
  }

  const cnpj = (sinais.cnpj ?? '').replace(/\D/g, '');
  if (cnpj.length === 14 && soDigitos.includes(cnpj)) return { confirma: true, por: 'CNPJ na fonte' };

  for (const d of sinais.decisores ?? []) {
    const nd = norm(d);
    // Nome de sócio PJ ("OKRA HOLDINGS LTDA.") não identifica pessoa: pula.
    if (nd.length < 6 || /ltda|s\/a|holdings?/.test(nd)) continue;
    if (txt.includes(nd)) return { confirma: true, por: `decisor citado: ${d}` };
  }

  // Município só vale junto com a menção ao núcleo do nome, que o chamador já
  // garantiu: "Atibaia" sozinho não diz nada, "cofel" + "Atibaia" diz muito.
  const mun = norm(sinais.municipio ?? '');
  if (mun.length >= 4 && txt.includes(mun)) return { confirma: true, por: `município: ${sinais.municipio}` };

  const tel = (sinais.telefone ?? '').replace(/\D/g, '');
  if (tel.length >= 10 && soDigitos.includes(tel)) return { confirma: true, por: 'telefone da conta na fonte' };

  return { confirma: false, por: null };
}

/** Host sem `www.`, ou null se a URL não parseia. */
function hostDe(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
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
  alvo: {
    id: string;
    nome: string;
    nomeFantasia?: string | null;
    municipio?: string | null;
    uf?: string | null;
    cnpj?: string | null;
    telefone?: string | null;
    site?: string | null;
    decisores?: { nome: string }[];
  },
  catalogo: { nome: string }[],
  sinais?: SinaisDoPerfil
): Promise<PegadaPublicaResult> {
  const vazio: PegadaPublicaResult = { releases: [], incumbentes: [], demandas: [], janela: null, buscas: 0 };
  if (!buscaPublicaDisponivel()) return { ...vazio, erro: 'fonte_indisponivel' };
  const empresa = String(alvo.nomeFantasia || alvo.nome || '').trim();
  if (empresa.length < 2) return vazio;

  // O NÚCLEO é o que a busca e o verificador usam. A razão social inteira não é
  // frase de busca: ninguém escreve "COFEL COMERCIAL E INDUSTRIAL DE FERRO
  // LIGAS LTDA" numa matéria, e pedir isso à Brave devolve homônimos.
  const nucleo = nucleoDoNome(empresa);
  if (nucleo.length === 0) return vazio;
  const termoBusca = nucleo.join(' ');

  // Quatro trilhas. As duas primeiras sao a conta FALANDO DE SI (redes), a
  // terceira e o que SAI SOBRE ela (imprensa), a quarta e quem ja a atende.
  //
  // O Instagram entrou a pedido do Rodrigo (15/07/2026): muita PME brasileira
  // anuncia obra, expansao e contratacao la e em nenhum outro lugar. So pega o
  // que o buscador indexou publicamente, nunca sessao logada.
  //
  // Custo: 4 buscas por Alvo (era 3). Com o teto do ciclo em 60 buscas, sao
  // 15 Alvos por ciclo em vez de 20 — cabe no plano da Brave e o cron ja
  // ordena por score, entao os 15 sao os melhores.
  // O município NÃO entra na query. Eu tentei (parecia o desempate óbvio de
  // homônimo) e a prova em produção reprovou: a Brave faz AND dos termos, e
  // `"cofel ferro ligas" Atibaia SP (lancamento OR ...)` devolveu ZERO hits,
  // contra 6 sem ele. Matéria de PME quase nunca escreve a cidade junto do
  // nome. O município segue valendo como sinal de CONFIRMAÇÃO no texto do
  // resultado, que é onde ele de fato aparece.
  const queries = [
    `"${termoBusca}" (site:linkedin.com/posts OR site:instagram.com)`,
    `"${termoBusca}" (lancamento OR expansao OR investimento OR contratacao OR inauguracao OR parceria OR aquisicao OR novo)`,
    `"${termoBusca}" (noticia OR anuncio OR "anunciou" OR "vai investir" OR "assinou" OR entrevista)`,
    `"${termoBusca}" (fornecedor OR parceiro OR "em parceria com" OR contratou OR implantou OR "cliente da")`,
  ];

  const sinaisConta: SinaisDaConta = {
    cnpj: alvo.cnpj ?? null,
    municipio: alvo.municipio ?? null,
    uf: alvo.uf ?? null,
    telefone: alvo.telefone ?? null,
    site: alvo.site ?? null,
    decisores: (alvo.decisores ?? []).map((d) => d.nome),
  };

  const resultados: SerpResult[] = [];
  const vistos = new Set<string>();
  const falhas: string[] = [];
  let descartadosPorHomonimo = 0;
  let buscas = 0;
  for (const q of queries) {
    try {
      const hits = await webSearch(organizationId, q, { limit: 6, alvoId: alvo.id });
      buscas++;
      for (const h of hits) {
        if (vistos.has(h.url)) continue;
        vistos.add(h.url);
        // Camada 1: fala da conta? Mata Copel/Cofen/Ronaldinho de graça.
        if (!mencionaAConta(h, nucleo)) continue;
        // Camada 2: é ESTA conta, e não uma homônima? Sem sinal, não entra.
        // Esta é a diferença entre um dossiê e uma armadilha: "Cofel Laminados
        // anunciou X" no dossiê da COFEL Ferro Ligas faz o vendedor citar o
        // fato errado numa reunião.
        if (!confirmaAConta(h, sinaisConta).confirma) {
          descartadosPorHomonimo++;
          continue;
        }
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
    return {
      ...vazio,
      buscas,
      ...(descartadosPorHomonimo ? { descartadosPorHomonimo } : {}),
      ...(falhas.length ? { erro: falhas[0] } : {}),
    };
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
    '6. "dataPublicacao": SO se a data aparecer no resultado, no formato AAAA-MM-DD. Se o resultado nao mostra data, devolva null. NUNCA estime, NUNCA use a data de hoje.',
    '7. "demandaGerada": a necessidade concreta que ESTE fato evidencia (ex.: "vai inaugurar unidade nova" evidencia demanda de montagem/equipar a unidade). Null se o fato nao evidencia necessidade nenhuma.',
    '8. "oportunidade": o espaco que ESTE fato abre para UM produto do catalogo, com o racional ligando o fato ao produto. "produto" precisa ser nome EXATO do catalogo. Null se nenhum produto do catalogo se conecta ao fato.',
    '9. Portugues do Brasil, frases curtas, sem travessao.',
    '10. Responda EXCLUSIVAMENTE com o JSON pedido, sem texto antes ou depois, sem cercas de codigo.',
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
    '    {"fonteIndice": 1, "titulo": "titulo curto do fato", "resumo": "1-2 frases so com o que esta no resultado", "dataPublicacao": "AAAA-MM-DD se aparecer no resultado, senao null", "relevancia": "por que importa para ESTE cliente (1 frase)", "angulo": "gancho de abordagem (1 frase)", "produtoRelacionado": "nome EXATO do catalogo ou null", "demandaGerada": "a necessidade que este fato evidencia (1 frase) ou null", "oportunidade": {"produto": "nome EXATO do catalogo", "racional": "por que este fato abre espaco para este produto (1 frase)"}}',
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
    const dataPublicacao = verificarDataPublicacao(r?.dataPublicacao);

    // Sinergia: a demanda e a oportunidade que ESTE fato sustenta. Passam pelo
    // mesmo crivo do resto — a oportunidade so vale se o produto existe no
    // catalogo (nome exato), senao e o LLM inventando linha de produto.
    const demandaBruta = r?.demandaGerada ? String(r.demandaGerada).trim() : '';
    const demandaGerada = demandaBruta.length >= 10 && norm(demandaBruta) !== 'null' ? demandaBruta.slice(0, 500) : null;

    let oportunidade: { produto: string; racional: string } | null = null;
    const oProdBruto = r?.oportunidade?.produto ? norm(String(r.oportunidade.produto)) : '';
    const oProduto = oProdBruto ? catalogoNorm.get(oProdBruto) ?? null : null;
    const oRacional = r?.oportunidade?.racional ? String(r.oportunidade.racional).trim() : '';
    if (oProduto && oRacional.length >= 10) {
      oportunidade = { produto: oProduto, racional: oRacional.slice(0, 500) };
    }

    const prefixo = /instagram\.com/.test(fonte.url) ? 'Instagram: ' : /linkedin\.com/.test(fonte.url) ? 'LinkedIn: ' : '';
    releases.push({
      titulo: prefixo + titulo.slice(0, 180),
      resumo: resumo.slice(0, 600),
      url: fonte.url,
      relevancia: String(r?.relevancia ?? '').slice(0, 400) || 'Novidade recente da conta no radar publico.',
      anguloAbordagem: r?.angulo ? String(r.angulo).slice(0, 300) : null,
      produtoRelacionado,
      confianca: confiancaDaFonte(fonte.url, dataPublicacao !== null),
      dataPublicacao,
      demandaGerada,
      oportunidade,
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

  return { releases, incumbentes, demandas, janela, buscas, ...(descartadosPorHomonimo ? { descartadosPorHomonimo } : {}) };
}

/**
 * Grava a pegada pública INTEIRA de um Alvo: releases (com a demanda e a
 * oportunidade que cada um gera), incumbentes e as demandas evidenciadas que
 * não vieram de release.
 *
 * Existe para o cron semanal e o botão "Aprofundar com IA" gravarem
 * exatamente igual. Antes cada um tinha o seu caminho: o botão persistia o
 * dossiê inteiro, o cron só os releases e jogava fora demanda e incumbente que
 * o MESMO LLM já tinha produzido na MESMA chamada. Não era decisão de custo,
 * era divergência de código — e é a família de bug que já custou caro aqui.
 */
export async function persistirPegadaPublica(
  organizationId: string,
  alvoId: string,
  r: PegadaPublicaResult
): Promise<{
  releases: number;
  demandasDeRelease: number;
  oportunidades: number;
  incumbentes: number;
  demandasEvidenciadas: number;
}> {
  const res = await persistirReleaseDrafts(organizationId, alvoId, r.releases);

  // Incumbentes: substitui o que a pesquisa anterior achou (a foto atual da
  // conta é o que vale; fornecedor que saiu não deve seguir no dossiê). Só
  // apaga quando achou alguém — senão uma busca ruim zeraria o que já sabíamos.
  if (r.incumbentes.length > 0) {
    await prisma.miraIncumbente.deleteMany({ where: { alvoId } });
    for (const i of r.incumbentes) {
      await prisma.miraIncumbente.create({
        data: {
          alvoId,
          fornecedor: i.fornecedor,
          categoria: i.categoria,
          evidencia: i.evidencia,
          fonte: i.fonte,
          deslocabilidade: i.deslocabilidade,
        },
      });
    }
  }

  // Demandas evidenciadas convivem com as presumidas da Fase 1, em rank
  // próprio: a presumida (confiança 55) diz "provavelmente dói isto"; a
  // evidenciada (70) diz "a conta publicou que dói isto".
  //
  // Uma demanda cuja fonte JÁ virou release com demanda ligada é pulada: o
  // mesmo LLM devolve `demandas[]` e `releases[].demandaGerada` lendo o mesmo
  // material, então sem este filtro a mesma necessidade entraria duas vezes
  // (uma sem FK, outra com) e `demandasEvidenciadas` contaria em dobro,
  // inflando o score com evidência que é uma só.
  const urlsComDemandaDeRelease = new Set(r.releases.filter((rel) => rel.demandaGerada).map((rel) => rel.url));
  let demandasEvidenciadas = 0;
  for (let idx = 0; idx < r.demandas.length; idx++) {
    const d = r.demandas[idx];
    if (urlsComDemandaDeRelease.has(d.fonte)) continue;
    const id = `${alvoId}-evidenciada-${idx + 1}`;
    await prisma.miraDemanda.upsert({
      where: { id },
      create: {
        id,
        alvoId,
        rank: idx + 1,
        descricao: d.descricao,
        evidencia: d.evidencia,
        fonte: d.fonte,
        dataFonte: new Date(),
        confianca: d.confianca,
      },
      update: { descricao: d.descricao, evidencia: d.evidencia, fonte: d.fonte, confianca: d.confianca },
    });
    demandasEvidenciadas++;
  }

  return {
    releases: res.criados,
    demandasDeRelease: res.demandasCriadas,
    oportunidades: res.oportunidadesCriadas,
    incumbentes: r.incumbentes.length,
    demandasEvidenciadas,
  };
}

/**
 * Fachada para o cron semanal.
 *
 * Era "o cron só quer os releases, ele publica novidade e não monta dossiê".
 * Isso jogava fora demandas e incumbentes que a MESMA busca e o MESMO LLM já
 * tinham produzido e que já tinham sido pagos — a diferença entre o cron e o
 * botão "Aprofundar" não era de custo, era de código. Agora devolve tudo, e
 * quem chama decide o que persistir.
 */
export async function buscarReleasesPublicos(
  organizationId: string,
  alvo: { id: string; nome: string; nomeFantasia?: string | null; municipio?: string | null; uf?: string | null },
  catalogo: { nome: string }[],
  sinais?: SinaisDoPerfil
): Promise<PegadaPublicaResult & { drafts: ReleaseDraft[] }> {
  const r = await pesquisarPegadaPublica(organizationId, alvo, catalogo, sinais);
  return { ...r, drafts: r.releases };
}

/**
 * Grava os drafts como MiraRelease e, quando o fato sustenta, a DEMANDA e a
 * OPORTUNIDADE que ele gera — ligadas ao release por FK.
 *
 * Compartilhado entre o cron semanal e o botão "Aprofundar com IA" (Fase 2)
 * para as duas trilhas gravarem exatamente igual. Até 15/07/2026 este era o
 * ponto onde a inteligência se perdia: o LLM já devolvia a sinergia, e aqui a
 * gente gravava só o título e o link. O vendedor via "saiu uma matéria" e
 * tinha que descobrir sozinho o que fazer com ela.
 *
 * Dedup por URL nos últimos 45 dias (mesmo critério do cron desde a
 * unificação): a mesma matéria não vira duas linhas.
 */
export async function persistirReleaseDrafts(
  organizationId: string,
  alvoId: string,
  drafts: ReleaseDraft[]
): Promise<{ criados: number; demandasCriadas: number; oportunidadesCriadas: number }> {
  let criados = 0;
  let demandasCriadas = 0;
  let oportunidadesCriadas = 0;

  for (const d of drafts) {
    const dup = await (prisma as any).miraRelease.findFirst({
      where: { alvoId, url: d.url, createdAt: { gte: new Date(Date.now() - 45 * 86400000) } },
      select: { id: true },
    });
    if (dup) continue;

    // A demanda nasce ANTES do release, para o release já apontar para ela.
    // Id determinístico pela URL: se a mesma matéria voltar (fora da janela de
    // dedup), atualiza a demanda em vez de empilhar outra igual.
    let demandaId: string | null = null;
    if (d.demandaGerada) {
      const id = `${alvoId}-release-${hashUrl(d.url)}`;
      const dem = await prisma.miraDemanda.upsert({
        where: { id },
        create: {
          id,
          alvoId,
          // rank 3: as demandas nascidas de matéria convivem com a presumida
          // (rank 1-2 da Fase 1) em vez de sobrescrevê-la. São coisas
          // diferentes: uma é "achamos que dói", a outra é "saiu na imprensa".
          rank: 3,
          descricao: d.demandaGerada,
          evidencia: d.resumo,
          fonte: d.url,
          // A data da FONTE é a da publicação, não a de hoje. `null` quando a
          // fonte não mostrou data é honesto; `new Date()` seria mentira.
          dataFonte: d.dataPublicacao,
          confianca: d.confianca,
        },
        update: {
          descricao: d.demandaGerada,
          evidencia: d.resumo,
          fonte: d.url,
          dataFonte: d.dataPublicacao,
          confianca: d.confianca,
        },
      });
      demandaId = dem.id;
      demandasCriadas++;
    }

    await prisma.miraRelease.create({
      data: {
        organizationId,
        alvoId,
        titulo: d.titulo,
        resumo: d.resumo,
        url: d.url,
        dataPublicacao: d.dataPublicacao,
        relevancia: d.relevancia,
        anguloAbordagem: d.anguloAbordagem,
        produtoRelacionado: d.produtoRelacionado,
        demandaId,
        confianca: d.confianca,
      },
    });
    criados++;

    // Oportunidade com origem RELEASE: sobrevive ao próximo "Aprofundar com
    // IA", que apaga só as de origem ANALISE (a presunção da Fase 1).
    if (d.oportunidade) {
      const oid = `${alvoId}-release-op-${hashUrl(d.url)}`;
      await prisma.miraOportunidade.upsert({
        where: { id: oid },
        create: {
          id: oid,
          alvoId,
          rank: 3,
          produto: d.oportunidade.produto,
          demandaRank: demandaId ? 3 : null,
          racional: d.oportunidade.racional,
          origem: 'RELEASE',
          fonte: d.url,
        },
        update: { produto: d.oportunidade.produto, racional: d.oportunidade.racional, fonte: d.url },
      });
      oportunidadesCriadas++;
    }
  }
  return { criados, demandasCriadas, oportunidadesCriadas };
}
