/* ══════════════════════════════════════════════════════════════════════════
 * izaFactsService — Camada 2: single source-of-truth pra "fatos atuais"
 * --------------------------------------------------------------------------
 * Problema que resolve:
 *   System prompt seedado em DB tende a entrar em drift quando produto muda
 *   (canal novo lança, tier muda, preço ajusta, feature sai de beta).
 *   Quando a Iza foi questionada sobre Instagram Direct em 2026-05-17 — JÁ
 *   em operação real com piloto — ela respondeu "não está no roadmap oficial"
 *   porque o prompt v7.6 (seedado em maio) ainda dizia "WhatsApp only".
 *
 * Solução:
 *   Tabela `iza_facts` com SECTION + KEY + STATUS + LABEL + URL.
 *   Este service carrega os ativos (cache 60s) e renderiza um bloco
 *   "# FATOS ATUAIS (sincronizado runtime)" injetado no system prompt
 *   ANTES do CORE_AGENT_RULES_V1 + agent.system_prompt.
 *
 *   Mudou um fato (ex: IG saiu de piloto pra GA público) → UPDATE em 1 row.
 *   Próximo turno (até 60s) já reflete. Zero re-deploy, zero re-seed.
 *
 * Próximos passos (não neste PR):
 *   - UI admin /admin/iza-knowledge pra editar facts via dashboard
 *   - Webhook do GitHub: PR que toca landing/planConfig dispara prompt pra
 *     review + atualização dos facts
 *   - Camada 1 (RAG): indexar CHANGELOG/blog posts em embeddings
 * ══════════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import {
  PLAN_CONFIG,
  PLAN_IDS,
  ADDONS,
  ADDONS_V4_LIST,
  VOICE_ADDON_META,
  listActivePlans,
  planAnnualMonthlyEquivalent,
  type PlanConfig,
  type AddonV4,
} from '@zappiq/shared';
import { logger } from '../utils/logger.js';

interface IzaFact {
  id: string;
  section: string;
  fact_key: string;
  label: string;
  status: string;
  description: string | null;
  url: string | null;
  order_idx: number;
}

/* Cache em memória — refresh a cada 60s. */
let cachedBlock: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

/* Labels amigáveis pra cada section no markdown final. */
const SECTION_TITLES: Record<string, string> = {
  canais: 'CANAIS ATIVOS',
  features: 'FEATURES GA',
  urls: 'LINKS CANÔNICOS (use SEMPRE em formato Markdown)',
  compliance: 'COMPLIANCE & PARCERIAS',
  pricing: 'PRICING',
  parcerias: 'PARCERIAS',
};

const STATUS_BADGE: Record<string, string> = {
  live: 'LIVE',
  beta: 'BETA',
  rollout: 'ROLLOUT',
  pending: 'PENDING',
  sunset: 'SUNSET',
};

/* Section ordering — controla a ordem de aparição no bloco. */
const SECTION_ORDER = ['canais', 'features', 'urls', 'compliance', 'pricing', 'parcerias'];

async function loadFactsFromDb(): Promise<IzaFact[]> {
  const rows = await prisma.$queryRawUnsafe<IzaFact[]>(
    `SELECT id, section, fact_key, label, status, description, url, order_idx
     FROM iza_facts
     WHERE active = true
     ORDER BY section, order_idx, fact_key`,
  );
  return rows;
}

/* ══════════════════════════════════════════════════════════════════════
 * Seção PRICING: gerada do catálogo, nunca do banco (achado A229).
 * --------------------------------------------------------------------
 * O prompt da Iza carregava uma tabela de planos gravada à mão em 16/06
 * com Scale a R$ 997 e planos já descontinuados, enquanto a seção
 * `pricing` de `iza_facts` estava VAZIA. Duas fontes de verdade para
 * preço, e a que falava com o lead era a errada.
 *
 * Agora a fonte é uma só: `packages/shared/src/planConfig.ts`. Preço,
 * cota, desconto anual e add-on saem de lá em runtime. Nada do Stripe
 * (lá moram ids de preço, não a política comercial) e nada digitado aqui.
 *
 * QUAL CHAVE DO BANCO PERDE: qualquer fato da seção `pricing` que cite um
 * plano (Lite, Starter, Growth, Scale, Business, Enterprise) junto com um
 * valor em reais, além das chaves reservadas listadas em
 * CHAVES_DE_PRECO_RESERVADAS. Esses fatos são descartados com aviso no
 * log. Fato de preço que NÃO é de plano (por exemplo a tarifa da Meta de
 * 01/10) continua valendo e é renderizado normalmente.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Chaves da seção `pricing` que o código passou a mandar. Um registro com
 * uma destas chaves é ignorado mesmo que não tenha valor em reais.
 */
const CHAVES_DE_PRECO_RESERVADAS = new Set([
  'planos',
  'precos',
  'pricing',
  'planos_tabela',
  'tabela_precos',
  'tabela_de_precos',
  'pricing_planos',
]);

/** Nomes nus dos planos, sem o sufixo "(legado)" que o catálogo usa. */
const NOMES_DE_PLANOS = PLAN_IDS.map((id) => PLAN_CONFIG[id].name.split(' ')[0]);

/**
 * "Business" também é o sobrenome de WhatsApp Business e de Meta Business
 * Partner. Tiramos essas expressões antes de procurar nome de plano, senão
 * um fato legítimo de canal ou de parceria cairia junto.
 */
const COMPOSTOS_QUE_NAO_SAO_PLANO =
  /\b(?:whatsapp|meta|instagram|facebook|google)\s+business(?:\s+partner)?\b/gi;

/** Valor em reais no formato pt-BR, sem centavos quando o número é inteiro. */
function brl(v: number): string {
  return Number.isInteger(v)
    ? `R$ ${v.toLocaleString('pt-BR')}`
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Corta o sufixo descritivo do nome do catálogo (o que vem depois do traço). */
function nomeCurto(nome: string): string {
  return nome.split(/\s+[—–-]\s+/)[0].trim();
}

/**
 * Quantos caracteres separam o valor do nome do plano para contar como "o
 * valor é DESTE plano". Acima disso são dois assuntos na mesma frase.
 */
const DISTANCIA_MAXIMA_DO_PLANO = 40;

/**
 * Este fato da seção `pricing` fala de preço de PLANO? Se fala, o código
 * vence e o registro do banco é ignorado.
 *
 * A proximidade importa. A versão anterior derrubava o fato assim que ele
 * tivesse um "R$" em qualquer lugar E um nome de plano em qualquer outro, por
 * mais longe que estivessem, e levava junto fato legítimo que só ENCOSTA num
 * plano: "No Growth o fair use é de 12 respostas por atendimento; acima disso
 * a Meta cobra R$ 0,035 por resposta" não é tabela de preço de plano, é
 * política de consumo. Agora o nome do plano precisa estar a até 40
 * caracteres do valor, que é a distância de uma tabela de verdade ("Starter
 * R$ 197, Growth R$ 497").
 */
export function ehFatoDePrecoDePlano(f: Pick<IzaFact, 'section' | 'fact_key' | 'label' | 'description'>): boolean {
  if (f.section !== 'pricing') return false;
  if (CHAVES_DE_PRECO_RESERVADAS.has(f.fact_key)) return true;

  const texto = `${f.fact_key} ${f.label} ${f.description ?? ''}`.replace(
    COMPOSTOS_QUE_NAO_SAO_PLANO,
    ' ',
  );

  const valores = /R\$\s*[0-9]/g;
  let m: RegExpExecArray | null;
  while ((m = valores.exec(texto)) !== null) {
    const ini = Math.max(0, m.index - DISTANCIA_MAXIMA_DO_PLANO);
    const fim = Math.min(texto.length, m.index + m[0].length + DISTANCIA_MAXIMA_DO_PLANO);
    const janela = texto.slice(ini, fim);
    if (NOMES_DE_PLANOS.some((nome) => new RegExp(`\\b${nome}\\b`, 'i').test(janela))) {
      return true;
    }
  }

  return false;
}

/**
 * Onde este add-on se contrata e onde ele já vem dentro do plano.
 *
 * Sem a segunda metade a Iza ofereceria a venda de algo que o cliente já tem:
 * o Radar 360 Pro está no `availableFor` do Enterprise, mas também no
 * `includedIn` dele. Plano que já traz o add-on sai da lista de "contrata no"
 * e aparece como "já incluído".
 */
function planosDoAddon(availableFor: readonly string[], inclusoEm: readonly string[] = []): string {
  const ativos = listActivePlans();
  const inclusos = ativos.filter((p) => inclusoEm.includes(p.id));
  const contrata = ativos.filter(
    (p) => availableFor.includes(p.id) && !inclusoEm.includes(p.id),
  );

  const partes: string[] = [];
  if (contrata.length > 0) partes.push(`contrata no ${contrata.map((p) => p.name).join(', ')}`);
  if (inclusos.length > 0) partes.push(`já incluído no ${inclusos.map((p) => p.name).join(' e no ')}`);
  return partes.length === 0 ? '' : ` (${partes.join('; ')})`;
}

/** Uma linha por plano ativo: preço, equivalente anual, cota e trial. */
function linhaDoPlano(p: PlanConfig): string {
  if (p.priceMonthly === null) {
    return `- **${p.name}**: sob consulta, o time comercial fecha o valor · mensagens de IA sem teto fixo`;
  }
  const partes = [`${brl(p.priceMonthly)}/mês`];
  const anual = planAnnualMonthlyEquivalent(p);
  if (anual !== null && p.annualDiscountPercent > 0) {
    partes.push(`no anual ${brl(anual)}/mês (${p.annualDiscountPercent}% de desconto)`);
  }
  if (p.limits.aiMessagesPerMonth > 0) {
    partes.push(`${p.limits.aiMessagesPerMonth.toLocaleString('pt-BR')} mensagens de IA por mês`);
  }
  if (p.trialDays && p.trialDays > 0) {
    partes.push(`${p.trialDays} dias grátis`);
  }
  return `- **${p.name}**: ${partes.join(' · ')}`;
}

/**
 * Famílias de add-on que a ZappIQ vende em público (as mesmas do seletor da
 * página de preços). A lista diz QUAIS famílias são públicas; o preço de
 * cada item continua vindo do catálogo.
 */
const FAMILIAS_PUBLICAS: AddonV4['family'][] = ['MIRA', 'IMPULSO', 'FEATURE', 'CHANNEL'];

function linhasDosAddonsPublicos(): string[] {
  const idsAtivos = new Set(listActivePlans().map((p) => p.id));

  const linhas = ADDONS_V4_LIST.filter(
    (a) =>
      a.pricingMode === 'recurring_monthly' &&
      FAMILIAS_PUBLICAS.includes(a.family) &&
      a.availableFor.some((id) => idsAtivos.has(id)),
  ).map((a) => `- **${nomeCurto(a.name)}**: ${brl(a.amountBrl)}/mês${planosDoAddon(a.availableFor)}`);

  // O Radar é o único add-on renderizado que tem `includedIn` no catálogo.
  // O `planConfig` guarda o mesmo fato em dois lugares e eles DIVERGEM: o
  // `includedIn` do add-on diz Business e Enterprise, e `features.radar360`
  // (que é o que a página de preços lê para escrever "incluído") diz Scale,
  // Business e Enterprise. Na dúvida vale a união: errar para o lado de não
  // vender o que o cliente já tem é barato; o contrário é venda indevida.
  const radar = ADDONS.RADAR_360;
  if (radar?.priceMonthly != null) {
    const inclusoEm = listActivePlans()
      .filter((p) => p.features.radar360 || radar.includedIn.includes(p.id))
      .map((p) => p.id);
    linhas.push(
      `- **${nomeCurto(radar.name)}**: ${brl(radar.priceMonthly)}/mês${planosDoAddon(radar.availableFor, inclusoEm)}`,
    );
  }

  // Voz outbound tem seis faixas no catálogo. Para o lead, a faixa de
  // entrada basta; o resto sai na proposta.
  const precosDeVoz = Object.keys(VOICE_ADDON_META)
    .map((k) => ADDONS[k]?.priceMonthly)
    .filter((v): v is number => typeof v === 'number');
  if (precosDeVoz.length > 0) {
    linhas.push(`- **Voz nativa (outbound)**: a partir de ${brl(Math.min(...precosDeVoz))}/mês`);
  }

  return linhas;
}

/**
 * Bloco de preços da Iza, inteiro derivado do `planConfig`.
 *
 * Função pura: não lê banco, não lê Stripe, não guarda estado. É o que o
 * teste cobra valor por valor.
 */
export function renderSecaoPrecosDoPlanConfig(): string {
  const ativos = listActivePlans();
  const descontoPadrao = PLAN_CONFIG.GROWTH.annualDiscountPercent;

  return [
    '## PRICING (gerado do catálogo comercial a cada turno)',
    '',
    '> Estes são os ÚNICOS preços de PLANO e de ADD-ON que você pode dizer ao',
    '> cliente. Eles saem do catálogo oficial da ZappIQ e mudam junto com ele. Se',
    '> um valor de plano ou de add-on não estiver aqui, diga que vai confirmar com',
    '> o time e NÃO chute. Nunca repita preço de memória, de conversa antiga ou de',
    '> qualquer tabela escrita em outro lugar deste prompt: se divergir, o que vale',
    '> é esta lista.',
    '',
    '### Planos ativos',
    ...ativos.map(linhaDoPlano),
    '',
    `> O plano anual tem ${descontoPadrao}% de desconto sobre o mensal.`,
    '> Só existem os planos acima. Qualquer outro nome de plano que apareça numa',
    '> conversa está fora do catálogo: não ofereça e não cite preço para ele.',
    '',
    '### Add-ons públicos',
    ...linhasDosAddonsPublicos(),
    '',
    '> Add-on é cobrado à parte da mensalidade do plano.',
    '> Outros preços (por exemplo a tarifa do WhatsApp cobrada pela Meta) aparecem',
    '> em "Outros fatos de preço" logo abaixo, quando existirem.',
    '',
  ].join('\n');
}

function renderFact(f: IzaFact): string {
  const badge = `[${STATUS_BADGE[f.status] || f.status.toUpperCase()}]`;
  const linkPart = f.url
    ? ` — link Markdown: \`[${f.label}](${f.url})\``
    : '';
  const descPart = f.description ? ` ${f.description}` : '';
  return `- ${badge} **${f.label}**${descPart}${linkPart}`;
}

function renderBlock(facts: IzaFact[]): string {
  const bySection = new Map<string, IzaFact[]>();
  for (const f of facts) {
    // Preço de plano vindo do banco perde para o catálogo, sempre.
    if (ehFatoDePrecoDePlano(f)) {
      logger.warn(
        '[izaFacts] fato de preço de plano ignorado: a seção PRICING vem do planConfig',
        { fact_key: f.fact_key, section: f.section, label: f.label },
      );
      continue;
    }
    if (!bySection.has(f.section)) bySection.set(f.section, []);
    bySection.get(f.section)!.push(f);
  }

  const parts: string[] = [
    '# FATOS ATUAIS DA PLATAFORMA (sincronizado runtime — fonte de verdade)',
    '',
    '> Esta seção é gerada a cada turno: a seção de preços vem do catálogo comercial,',
    '> as demais vêm do banco de dados.',
    '> Os fatos abaixo SOBREESCREVEM qualquer informação conflitante nas seções fixas',
    '> que vêm depois. Se um canal está LIVE aqui, ele ESTÁ disponível — mesmo que',
    '> outras seções mais antigas digam o contrário.',
    '',
    '> **Regra de formatação de links**: sempre que você enviar um URL listado abaixo,',
    '> use formato Markdown `[label](url)` pro frontend renderizar como link clicável.',
    '> Exemplo certo: `[Trial 14 dias grátis](https://zappiq.com.br/cadastro)`',
    '> Exemplo errado: `https://zappiq.com.br/cadastro` (vira texto plano).',
    '',
  ];

  for (const section of SECTION_ORDER) {
    // A seção de preços é gerada do catálogo e sai SEMPRE, mesmo quando o
    // banco não tem nenhum fato ativo: a Iza nunca pode ficar sem preço.
    if (section === 'pricing') {
      parts.push(renderSecaoPrecosDoPlanConfig());
    }

    const items = bySection.get(section);
    if (!items || items.length === 0) continue;
    if (section === 'pricing') {
      parts.push('### Outros fatos de preço (banco)');
      parts.push('');
    } else {
      parts.push(`## ${SECTION_TITLES[section] || section.toUpperCase()}`);
      parts.push('');
    }
    for (const f of items.sort((a, b) => a.order_idx - b.order_idx)) {
      parts.push(renderFact(f));
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Exposto só para teste: renderiza o bloco a partir de uma lista de fatos,
 * sem tocar no banco nem no cache.
 */
export const renderBlockParaTeste = renderBlock;

/**
 * Retorna o bloco "# FATOS ATUAIS" formatado pra injeção no system prompt.
 * Cache de 60 segundos, para não bombardear o banco.
 *
 * Em erro de banco, devolve o último bloco bom e, se nem isso existir, o bloco
 * montado SEM fato nenhum, que já traz a seção de preços inteira: ela vem do
 * `planConfig` e não depende do banco para nada. Antes o fail-soft devolvia
 * string vazia com o cache frio, e aí o banco fora do ar deixava a Iza sem
 * saber o preço de nenhum plano, que é justamente o achado A229 acontecendo de
 * novo por outro caminho.
 */
export async function getIzaFactsBlock(): Promise<string> {
  const now = Date.now();
  if (cachedBlock !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedBlock;
  }
  try {
    const facts = await loadFactsFromDb();
    cachedBlock = renderBlock(facts);
    cachedAt = now;
    return cachedBlock;
  } catch (err) {
    logger.warn(
      '[izaFacts] Falha ao carregar facts do banco. Devolvendo o último bloco bom, ou só a seção de preços do catálogo.',
      { err, temCache: cachedBlock !== null },
    );
    return cachedBlock ?? renderBlock([]);
  }
}

/**
 * Invalida o cache. Use após UPDATE manual via admin tool — o próximo turno
 * já recarrega do DB sem esperar TTL.
 */
export function invalidateIzaFactsCache(): void {
  cachedBlock = null;
  cachedAt = 0;
}
