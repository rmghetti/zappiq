/* ══════════════════════════════════════════════════════════════════════
 * billingCoupons.util — lógica PURA da emissão de cupons pelo SUPERADMIN.
 * --------------------------------------------------------------------
 * Geração de código único (charset sem ambíguos) e montagem/validação dos
 * params do Stripe Coupon. Sem I/O — a chamada Stripe fica no route.
 * ══════════════════════════════════════════════════════════════════════ */

export type CouponDuration = 'once' | 'repeating' | 'forever';

export const ALLOWED_PERCENTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export type AllowedPercent = (typeof ALLOWED_PERCENTS)[number];

// Sem 0/O/1/I/L pra não confundir na hora de copiar/digitar.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function isAllowedPercent(n: unknown): n is AllowedPercent {
  return typeof n === 'number' && (ALLOWED_PERCENTS as readonly number[]).includes(n);
}

export function isCouponDuration(d: unknown): d is CouponDuration {
  return d === 'once' || d === 'repeating' || d === 'forever';
}

/**
 * Gera um code legível mesclando letras e números, com prefixo curto do produto
 * pra leitura ("GRW-XXXXXXXX"). `randomChars` é injetável pra teste determinístico;
 * em produção passe bytes de crypto mapeados no CODE_ALPHABET.
 */
export function generateCouponCode(productKey: string, randomPart: string): string {
  const prefix = productKey.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'ZAP';
  const body = randomPart.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return `${prefix}-${body}`;
}

/** Amostra `len` chars do alfabeto seguro a partir de bytes aleatórios. */
export function bytesToCode(bytes: Uint8Array, len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[bytes[i % bytes.length] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Nome interno do coupon (aparece no dashboard Stripe). A Stripe LIMITA name a
 * 40 caracteres — por isso truncamos. Ex.: "100% off · Impulso Pro — campanh…".
 */
export function buildCouponName(percentOff: number, productLabel: string): string {
  const full = `${percentOff}% off · ${productLabel}`;
  if (full.length <= 40) return full;
  return `${full.slice(0, 39)}…`;
}

export interface CouponCreateInput {
  percentOff: number;
  productId: string;
  duration: CouponDuration;
  /** Obrigatório quando duration === 'repeating' (nº de meses). */
  durationInMonths?: number | null;
}

export interface StripeCouponParams {
  percent_off: number;
  duration: CouponDuration;
  duration_in_months?: number;
  applies_to: { products: string[] };
  max_redemptions: number;
  metadata: Record<string, string>;
}

/**
 * Valida a entrada e monta os params do stripe.coupons.create. Lança Error com
 * mensagem clara em entrada inválida (o route traduz pra 400). Sempre escopa ao
 * produto (applies_to) e trava uso único (max_redemptions=1).
 */
export function buildCouponCreateParams(input: CouponCreateInput): StripeCouponParams {
  if (!isAllowedPercent(input.percentOff)) {
    throw new Error('invalid_percent'); // só 10..100 em passos de 10
  }
  if (!input.productId || typeof input.productId !== 'string') {
    throw new Error('invalid_product');
  }
  if (!isCouponDuration(input.duration)) {
    throw new Error('invalid_duration');
  }
  const params: StripeCouponParams = {
    percent_off: input.percentOff,
    duration: input.duration,
    applies_to: { products: [input.productId] },
    max_redemptions: 1,
    metadata: { source: 'superadmin_coupon', productId: input.productId },
  };
  if (input.duration === 'repeating') {
    const months = input.durationInMonths;
    if (!Number.isInteger(months) || (months as number) < 1) {
      throw new Error('invalid_duration_months');
    }
    params.duration_in_months = months as number;
  }
  return params;
}
