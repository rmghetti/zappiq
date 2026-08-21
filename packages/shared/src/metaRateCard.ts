/**
 * metaRateCard — rate card LOCAL e versionado das tarifas por mensagem da
 * Meta (WhatsApp Business Platform), mercado Brasil, em BRL e USD.
 *
 * Por que local: a Meta não expõe API pública de tarifa. O ledger de custo
 * (Resposta Meta 2026, plano 8.1 item 1) precisa de uma referência auditável
 * para projetar custo por contagem × tarifa, e ela mora aqui, com histórico
 * de vigências. Shared de propósito: API (ledger, Conta Clara) e site
 * (calculadora "Outubro sem susto") têm que concordar no número.
 *
 * Fonte: rate card oficial da Meta vigente desde 01/07/2026, consolidado em
 * docs/resposta-meta-2026/PLANO-RESPOSTA-META.md (seção 4.1). Ao sair tabela
 * nova da Meta, ADICIONE uma vigência — nunca edite as passadas, o histórico
 * é o que permite recalcular projeções antigas.
 */

/** Categoria de cobrança da Meta, como vem em `pricing.category` do webhook. */
export type MetaBillingCategory = 'marketing' | 'utility' | 'authentication' | 'service';

/** Moedas suportadas pelo rate card local. */
export type MetaRateCurrency = 'BRL' | 'USD';

/** Tarifa por MENSAGEM (entregue) de cada categoria, numa moeda. */
export type MetaRateTable = Record<MetaBillingCategory, number>;

/** Uma vigência do rate card: vale de `inicio` (inclusive) até a próxima. */
export interface MetaRateVigencia {
  /** Início da vigência (inclusive), ISO YYYY-MM-DD, comparado em UTC. */
  inicio: string;
  /** Nota curta de origem/motivo, para auditoria humana. */
  nota: string;
  tarifas: Record<MetaRateCurrency, MetaRateTable>;
}

/**
 * Vigências em ordem cronológica (a última cujo `inicio` <= data vence).
 *
 * ATENÇÃO (service a partir de 01/10/2026): a Meta confirmou que a categoria
 * service passa a ser COBRADA por mensagem entregue em 01/10/2026, mas a
 * coluna Service oficial do rate card só sai até 01/09/2026. Até lá usamos a
 * MESMA tarifa de utility como referência (0.0350 BRL / 0.0068 USD, o número
 * que a própria Meta citou como referência de mercado). Quando a tabela
 * oficial sair, RECALIBRE aqui (nova vigência se o valor divergir).
 */
export const META_RATE_CARD: readonly MetaRateVigencia[] = [
  {
    inicio: '2026-07-01',
    nota: 'Rate card oficial Brasil desde 01/07/2026; service grátis desde 11/2024.',
    tarifas: {
      BRL: { marketing: 0.3217, utility: 0.035, authentication: 0.035, service: 0 },
      USD: { marketing: 0.0625, utility: 0.0068, authentication: 0.0068, service: 0 },
    },
  },
  {
    inicio: '2026-10-01',
    nota: 'Service passa a ser cobrada por mensagem entregue; valor de REFERÊNCIA = tarifa utility (recalibrar quando a coluna Service oficial sair, até 01/09).',
    tarifas: {
      BRL: { marketing: 0.3217, utility: 0.035, authentication: 0.035, service: 0.035 },
      USD: { marketing: 0.0625, utility: 0.0068, authentication: 0.0068, service: 0.0068 },
    },
  },
];

/** Início da vigência em epoch ms (meia-noite UTC do dia). */
function inicioMs(vigencia: MetaRateVigencia): number {
  return Date.parse(`${vigencia.inicio}T00:00:00Z`);
}

/**
 * Vigência que vale em `date`: a última cujo início <= date. Datas anteriores
 * à primeira vigência caem na primeira (melhor tarifa conhecida — serve para
 * projeção retroativa, que é o uso do ledger).
 */
export function getMetaRateVigencia(date: Date): MetaRateVigencia {
  const t = date.getTime();
  let atual = META_RATE_CARD[0];
  for (const vigencia of META_RATE_CARD) {
    if (inicioMs(vigencia) <= t) atual = vigencia;
    else break;
  }
  return atual;
}

/** Tarifa por mensagem da categoria, na moeda, vigente em `date`. */
export function getMetaRatePerMessage(
  category: MetaBillingCategory,
  date: Date,
  currency: MetaRateCurrency,
): number {
  return getMetaRateVigencia(date).tarifas[currency][category];
}

/**
 * Custo estimado em BRL: contagem × tarifa vigente em `date`. Arredonda a
 * 4 casas (a tarifa tem 4 casas e a contagem é inteira, então o valor exato
 * cabe em 4 casas — o arredondamento só tira ruído de float).
 */
export function estimateMetaCostBrl(
  category: MetaBillingCategory,
  count: number,
  date: Date,
): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const rate = getMetaRatePerMessage(category, date, 'BRL');
  return Math.round(count * rate * 1e4) / 1e4;
}
