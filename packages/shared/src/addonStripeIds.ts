// ─────────────────────────────────────────────────────────
// Addon Stripe IDs V4 (Onda 1) — aprovados 2026-05-27
// GERADO automaticamente pelo .command. Nao editar manual.
// Margens calculadas em QUOTA_MGMT_V4_2026_05_27.docx
// ─────────────────────────────────────────────────────────

export const ADDONS_V4_STRIPE_MODE: 'LIVE' | 'TEST' = 'LIVE';

export interface AddonStripeIds {
  productId: string;
  priceIds: Record<string, string>;
}

export const ADDONS_V4_STRIPE: Record<string, AddonStripeIds & { meterId?: string }> = {
  AI_MSG: {
    productId: 'prod_Ub3TSfGM7eEych',
    meterId:   'mtr_61UlFW8uWEGkFIiGL41Klp5SWv74XVgG',  // Stripe Meter pra reportar eventos de overage (event_name=zappiq_ai_msg_processed)
    priceIds: {
      overage:  'price_1TbrbrKlp5SWv74XC6VEpVh0',  // metered R$ 0,03/msg vinculado ao meter acima
      pack_5k:  'price_1TbrbtKlp5SWv74XaYeXvtmk',       // R$ 99 one-shot
      pack_10k: 'price_1TbrbuKlp5SWv74XuOZetzuj',      // R$ 179 one-shot
      pack_50k: 'price_1TbrbvKlp5SWv74XbRJZYM7k',      // R$ 749 one-shot
    },
  },
  BROADCAST: {
    productId: 'prod_Ub3j9CH9UCN1SW',
    priceIds: {
      pack_1k:  'price_1TbrbyKlp5SWv74XXDoGHpc8',   // R$ 99 one-shot
      pack_5k:  'price_1TbrbzKlp5SWv74XtFAE3XPz',   // R$ 449 one-shot
      pack_10k: 'price_1Tbrc0Klp5SWv74XDFjVYoeO',  // R$ 829 one-shot
    },
  },
  EXTRA_WA_NUMBER: {
    productId: 'prod_Ub3jykHTYnd6Dw',
    // annual = mensal*12*0.8 (mesmo 20% off do plano); criados 2026-07-08, lookup zappiq_addon_*_annual
    priceIds: { monthly: 'price_1Tbrc3Klp5SWv74XCTvhW4Ro', annual: 'price_1TqviQKlp5SWv74XUbNcdgU8' },  // R$ 137/mes | R$ 1315,20/ano
  },
  EXTRA_IG_DIRECT: {
    productId: 'prod_Ub3jIefVN1DFAx',
    priceIds: { monthly: 'price_1Tbrc5Klp5SWv74XuJUMCkyZ', annual: 'price_1TqviRKlp5SWv74Xa6hqvgoE' },  // R$ 97/mes | R$ 931,20/ano
  },
  CONTACTS_PACK_5K: {
    productId: 'prod_Ub3jsL80jMMSZ0',
    priceIds: { monthly: 'price_1Tbrc8Klp5SWv74XdYyibw1F', annual: 'price_1TqviRKlp5SWv74XTcX6Tk3J' },  // R$ 59/mes | R$ 566,40/ano
  },
  CONTACTS_PACK_25K: {
    productId: 'prod_Ub3jPuIhVX3IkQ',
    priceIds: { monthly: 'price_1TbrcAKlp5SWv74X3DBQ9xSa', annual: 'price_1TqviSKlp5SWv74XGqVSnN6c' },  // R$ 199/mes | R$ 1910,40/ano
  },
  FLOWS_PACK_5: {
    productId: 'prod_Ub3jyljRbIRcJm',
    priceIds: { monthly: 'price_1TbrcDKlp5SWv74Xl0h8HzfY', annual: 'price_1TqviTKlp5SWv74XU1t6LrLj' },  // R$ 47/mes | R$ 451,20/ano
  },
  KB_DOCS_PACK_25: {
    productId: 'prod_Ub3j6q1wGAR7QX',
    priceIds: { monthly: 'price_1TbrcFKlp5SWv74XAP0mD3vX', annual: 'price_1TqviTKlp5SWv74X6FSgmDbe' },  // R$ 99/mes | R$ 950,40/ano
  },
  KB_DOCS_PACK_100: {
    productId: 'prod_Ub3jlnuDb2vlWp',
    priceIds: { monthly: 'price_1TbrcJKlp5SWv74XMxZXKu1N', annual: 'price_1TqviUKlp5SWv74X9owluYmz' },  // R$ 297/mes | R$ 2851,20/ano
  },
  AGENT_SEAT: {
    productId: 'prod_Ub3jl89x5QlVga',
    priceIds: { monthly: 'price_1TbrcLKlp5SWv74XoMB5Mqcb', annual: 'price_1TqviUKlp5SWv74XzZlgTzCr' },  // R$ 79/seat/mes | R$ 758,40/ano
  },
  INTEGRATIONS_PACK_5: {
    productId: 'prod_Ub3jKfnI4ylmF6',
    priceIds: { monthly: 'price_1TbrcOKlp5SWv74XSalzcP8g', annual: 'price_1TqviVKlp5SWv74XeBaepmaR' },  // R$ 147/mes | R$ 1411,20/ano
  },
  // Agendamento pela IA (add-on Lite; incluido do Growth pra cima). LIVE, criado
  // 2026-07-08 via API (lookup zappiq_addon_scheduling_*). annual = mensal*12*0.8.
  SCHEDULING_AGENT: {
    productId: 'prod_Uqo1QOYhDsEBXI',
    priceIds: { monthly: 'price_1Tr6PBKlp5SWv74XtN7kuDAF', annual: 'price_1Tr6PCKlp5SWv74XXAT7OdyO' },  // R$ 49/mes | R$ 470,40/ano
  },

  // ─────────────────────────────────────────────────────────
  // Impulso (add-on de campanhas premium) — criado via
  // apps/api/scripts/impulso-stripe-setup.ts. ADDONS_V4_STRIPE_MODE='LIVE',
  // entao estes sao os IDs de PRODUCAO (sk_live_, 2026-07-06).
  // IDs de TESTE (sandbox) p/ referencia, caso precise rodar em test mode:
  //   START prod_Upv6bRLFAiDBJC / price_1TqFFvKlp5SWv74Xt8IYu1Z3
  //   PRO   prod_Upv6acWtLxMcmk / price_1TqFFwKlp5SWv74XvWRN4w6o
  //   SCALE prod_Upv6LhKZR8Yoyd / price_1TqFFxKlp5SWv74XUJ3519kr
  // ─────────────────────────────────────────────────────────
  IMPULSO_START: {
    productId: 'prod_Upxg7QwSAF4AwV',
    priceIds: { monthly: 'price_1TqHl2Klp5SWv74XtGvDttlw' },  // R$ 197/mes (LIVE)
  },
  IMPULSO_PRO: {
    productId: 'prod_Upxg2WAOdMB7NN',
    priceIds: { monthly: 'price_1TqHl4Klp5SWv74XCR9JRVxk' },  // R$ 497/mes (LIVE)
  },
  IMPULSO_SCALE: {
    productId: 'prod_UpxguUhshUR7wM',
    priceIds: { monthly: 'price_1TqHl5Klp5SWv74X2yjIAWSs' },  // R$ 997/mes (LIVE)
  },
};
