/**
 * Mira Prospects — auto-preenchimento do Perfil de Prospecção.
 *
 * O cliente já descreveu o próprio negócio no cadastro e no Treinar IA.
 * Pedir tudo de novo na tela do Perfil é atrito puro. Aqui a gente lê o que
 * ELE já declarou e devolve um rascunho dos campos que falam do negócio dele
 * e do catálogo.
 *
 * O que NÃO entra: os campos de alvo (B2B/B2C). "Quem eu atendo hoje" não é
 * "quem eu quero prospectar" — o survey descreve o primeiro, o Perfil pede o
 * segundo. Preencher alvo com dado de público atual seria palpite disfarçado
 * de dado.
 *
 * Nada é persistido: devolve rascunho, o cliente revisa/edita/apaga e salva
 * pelo PUT /perfil. Mesmo desenho do flowGenerator.
 *
 * ─── Isolamento entre tenants ─────────────────────────────────────────────
 * Este serviço lê o material do cliente e joga num LLM, que é exatamente a
 * receita do incidente de 14/07 (a Iza vazando para o agente do cliente).
 * As travas aqui:
 *
 *  1. Toda leitura é escopada em organizationId. A org vem por findUnique no
 *     id; não existe findMany entre orgs neste arquivo.
 *  2. A IA vê o material de UMA org por chamada. Nunca um lote de orgs.
 *  3. Org sem material devolve vazio. Não existe fallback que empreste de
 *     template, de org parecida ou de exemplo embutido no prompt.
 *  4. Nome de produto e concorrente precisam estar ancorados no texto de
 *     origem daquela org (ver ancorado()).
 *
 * Sobre (4): o guard de marca (assertNoForeignBrand) seria a escolha errada
 * nesta superfície. Ele barra "ZappIQ"/"Iza" no conteúdo de qualquer org que
 * não seja a ZappIQ — e a MACHIA vende ZappIQ, então "ZappIQ" no catálogo
 * dela é dado legítimo, não vazamento. Aquele guard existe para o prompt do
 * agente, onde o problema é de identidade ("não diga que você é da ZappIQ").
 * Aqui o problema é de procedência, e procedência se resolve com ancoragem:
 * derruba alucinação de qualquer marca sem punir quem legitimamente fala de
 * uma.
 */
import { prisma } from '@zappiq/database';
import { llmRouter } from '../llm/LLMRouter.js';
import { extractJson } from '../../agents/flowGenerator.js';

/**
 * Blocos do survey que falam do negócio: estrutura comercial (com_),
 * posicionamento (pos_) e público (pub_). Os outros 9 blocos (tom de voz,
 * regras da IA, escalonamento...) não dizem nada sobre o que a empresa vende.
 */
const PREFIXOS_NEGOCIO = ['com_', 'pos_', 'pub_'];

/** Teto de caracteres do material mandado para a IA. */
const MAX_MATERIAL = 24_000;

/** Teto de itens por lista sugerida. */
const MAX_ITENS = 12;

export interface SugestaoPerfil {
  segmento: string | null;
  subsegmentos: string[];
  catalogo: { nome: string; descricao: string }[];
  doresResolvidas: string[];
  resultadosEsperados: string[];
  casosDeUso: string[];
  diferenciais: string[];
  concorrentes: string[];
  ticketMedio: string | null;
  /** {campo: 'cadastro' | 'treinamento'} — sustenta o selo "sugerido" na tela. */
  origem: Record<string, string>;
  /** Quantos campos vieram preenchidos. A faixa no topo da tela usa isso. */
  totalCampos: number;
}

function vazia(): SugestaoPerfil {
  return {
    segmento: null,
    subsegmentos: [],
    catalogo: [],
    doresResolvidas: [],
    resultadosEsperados: [],
    casosDeUso: [],
    diferenciais: [],
    concorrentes: [],
    ticketMedio: null,
    origem: {},
    totalCampos: 0,
  };
}

/**
 * Monta o rascunho do perfil para UMA org.
 *
 * Duas camadas: a exata (cadastro, sem IA, vale para toda org) e a de IA
 * (respostas de treinamento, que são texto livre). Se a IA falhar, o cliente
 * ainda recebe a camada exata — nunca devolve erro para a tela.
 */
export async function sugerirPerfil(organizationId: string): Promise<SugestaoPerfil> {
  const out = vazia();

  // ── Camada exata ────────────────────────────────────────────────────────
  // Única leitura de organization, por id. Não tem como pegar outra org.
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  if (!org) return out;

  const settings = (org.settings as Record<string, any>) || {};

  const segmento = typeof settings.segmento === 'string' ? settings.segmento.trim() : '';
  if (segmento) {
    out.segmento = segmento;
    out.origem.segmento = 'cadastro';
  }

  const subsegmentos = Array.isArray(settings.subsegmentos)
    ? settings.subsegmentos.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  if (subsegmentos.length) {
    out.subsegmentos = subsegmentos.slice(0, MAX_ITENS);
    out.origem.subsegmentos = 'cadastro';
  }

  // ── Camada IA ───────────────────────────────────────────────────────────
  const material = await coletarMaterial(organizationId, settings);
  if (!material) {
    // Org sem material declarado. Devolve o que tem e para por aqui: não
    // existe "chutar um catálogo pelo segmento".
    out.totalCampos = contarCampos(out);
    return out;
  }

  try {
    const bruto = await extrair(organizationId, material);
    if (bruto) aplicar(out, bruto, material);
  } catch {
    // Fail-soft: IA fora do ar não pode derrubar a tela do Perfil.
  }

  out.totalCampos = contarCampos(out);
  return out;
}

/**
 * O material declarado pela org, e só por ela.
 *
 * De propósito não usamos loadBusinessContext(): ele corta o survey em 24
 * respostas, e as orgs que usam o Mira têm ~200 — o corte por volume jogaria
 * fora quase tudo que interessa. Aqui a seleção é por bloco.
 */
async function coletarMaterial(organizationId: string, settings: Record<string, any>): Promise<string> {
  const linhas: string[] = [];

  // O survey guarda TODOS os blocos globais achatados sob "identidade_empresa",
  // com a chave da pergunta preservando o prefixo do bloco (com_/pos_/pub_...).
  // O nome da chave é enganoso: não é só o bloco de identidade.
  const respostas = settings?.surveyAnswers?.identidade_empresa;
  if (respostas && typeof respostas === 'object' && !Array.isArray(respostas)) {
    for (const [chave, valor] of Object.entries(respostas)) {
      if (!PREFIXOS_NEGOCIO.some((p) => chave.startsWith(p))) continue;
      const texto = achatar(valor);
      if (texto) linhas.push(`${chave}: ${texto}`);
    }
  }

  // Q&A do Treinar IA — escopado por organizationId, como todo o resto.
  const qa = await prisma.qAPair.findMany({
    where: { organizationId, isActive: true },
    select: { question: true, answer: true },
    orderBy: { priority: 'desc' },
    take: 30,
  });
  for (const par of qa) linhas.push(`FAQ: ${par.question} -> ${par.answer}`);

  return linhas.join('\n').slice(0, MAX_MATERIAL).trim();
}

/** Respostas do survey podem ser string, lista ou objeto aninhado. */
function achatar(valor: unknown, profundidade = 0): string {
  if (valor == null || profundidade > 3) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (Array.isArray(valor)) {
    return valor
      .map((v) => achatar(v, profundidade + 1))
      .filter(Boolean)
      .join('; ');
  }
  if (typeof valor === 'object') {
    return Object.values(valor as Record<string, unknown>)
      .map((v) => achatar(v, profundidade + 1))
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

/**
 * Chama a IA com o material de uma org só.
 *
 * orgId + operation entram no LLMCallLog: custo por org sai de graça e a
 * chamada fica auditável. Sem tools/JSON-mode de propósito — o cascade cai
 * para o Gemini em algumas rotas, e o Gemini ignora tools em silêncio. O
 * padrão da casa (JSON pedido no prompt + extractJson) funciona em qualquer
 * provider.
 */
async function extrair(organizationId: string, material: string): Promise<any | null> {
  const system = [
    'Você organiza, em campos, o que uma empresa declarou sobre si mesma.',
    '',
    'Regras inegociáveis:',
    '- Use SOMENTE o que está no material. Nunca invente, nunca complete com conhecimento geral do setor.',
    '- Campo sem base no material: devolva lista vazia ou null. Lista vazia é resposta correta.',
    '- Não deduza concorrente, preço ou diferencial que não esteja escrito.',
    '- Escreva em português do Brasil.',
    '- Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto antes ou depois, sem cercas de código.',
  ].join('\n');

  const user = [
    'Material declarado pela empresa:',
    '---',
    material,
    '---',
    '',
    'Devolva exatamente esta estrutura:',
    '{',
    '  "catalogo": [{"nome": "produto ou serviço", "descricao": "o que resolve, em uma linha"}],',
    '  "doresResolvidas": ["dor ou problema que a empresa resolve para o cliente"],',
    '  "resultadosEsperados": ["resultado ou benefício, de preferência quantificável"],',
    '  "casosDeUso": ["situação ou gatilho que leva alguém a comprar"],',
    '  "diferenciais": ["diferencial declarado"],',
    '  "concorrentes": ["concorrente citado pelo nome"],',
    '  "ticketMedio": "faixa de investimento como está declarada, ou null"',
    '}',
    '',
    `No máximo ${MAX_ITENS} itens por lista.`,
  ].join('\n');

  const resp = await llmRouter.complete({
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: 2000,
    temperature: 0.2,
    orgId: organizationId,
    operation: 'extract',
  });

  return extractJson(resp.text);
}

/**
 * Ancoragem: o valor precisa estar apoiado no material de origem.
 *
 * Metade das palavras significativas (4+ letras, sem acento, minúsculas)
 * precisa aparecer no texto que a IA recebeu. Não é comparação literal: a
 * IA parafraseia, e parafrasear é o trabalho dela. É um piso contra invenção.
 */
export function ancorado(valor: string, material: string): boolean {
  const normalizar = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const fonte = normalizar(material);
  const alvo = normalizar(valor).trim();
  if (!alvo) return false;

  const palavras = alvo.split(/[^a-z0-9]+/).filter((p) => p.length >= 4);
  // Valor curto demais para ter palavra significativa (ex.: "SLA", "TI"):
  // exige que apareça inteiro.
  if (!palavras.length) return fonte.includes(alvo);

  const achadas = palavras.filter((p) => fonte.includes(p)).length;
  return achadas / palavras.length >= 0.5;
}

function listaDeStrings(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of valor) {
    if (typeof item !== 'string') continue;
    const v = item.trim().replace(/\s+/g, ' ');
    if (!v || v.length > 300) continue;
    const chave = v.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(v);
    if (out.length >= MAX_ITENS) break;
  }
  return out;
}

/**
 * Passa o que a IA devolveu para o rascunho, campo a campo.
 *
 * Ancoragem só nos campos factuais (nome de produto, concorrente). Dores,
 * resultados, casos de uso e diferenciais são paráfrase por natureza — cobrar
 * ancoragem literal deles derrubaria justamente a leitura boa. Esses o cliente
 * revisa na tela, que é onde a decisão final tem que estar mesmo.
 */
function aplicar(out: SugestaoPerfil, bruto: any, material: string): void {
  if (Array.isArray(bruto?.catalogo)) {
    const vistos = new Set<string>();
    for (const item of bruto.catalogo) {
      const nome = typeof item?.nome === 'string' ? item.nome.trim().replace(/\s+/g, ' ') : '';
      if (!nome || nome.length > 160) continue;
      const chave = nome.toLowerCase();
      if (vistos.has(chave)) continue;
      // Nome de produto é fato declarado: sem âncora, fora.
      if (!ancorado(nome, material)) continue;
      vistos.add(chave);
      const descricao = typeof item?.descricao === 'string' ? item.descricao.trim().slice(0, 600) : '';
      out.catalogo.push({ nome, descricao });
      if (out.catalogo.length >= MAX_ITENS) break;
    }
    if (out.catalogo.length) out.origem.catalogo = 'treinamento';
  }

  // Concorrente é nome próprio: idem catálogo.
  const concorrentes = listaDeStrings(bruto?.concorrentes).filter((c) => ancorado(c, material));
  if (concorrentes.length) {
    out.concorrentes = concorrentes;
    out.origem.concorrentes = 'treinamento';
  }

  const parafraseaveis: [keyof SugestaoPerfil, unknown][] = [
    ['doresResolvidas', bruto?.doresResolvidas],
    ['resultadosEsperados', bruto?.resultadosEsperados],
    ['casosDeUso', bruto?.casosDeUso],
    ['diferenciais', bruto?.diferenciais],
  ];
  for (const [campo, valor] of parafraseaveis) {
    const lista = listaDeStrings(valor);
    if (!lista.length) continue;
    (out[campo] as string[]) = lista;
    out.origem[campo as string] = 'treinamento';
  }

  if (typeof bruto?.ticketMedio === 'string') {
    const t = bruto.ticketMedio.trim().slice(0, 120);
    if (t && t.toLowerCase() !== 'null') {
      out.ticketMedio = t;
      out.origem.ticketMedio = 'treinamento';
    }
  }
}

function contarCampos(s: SugestaoPerfil): number {
  return Object.keys(s.origem).length;
}
