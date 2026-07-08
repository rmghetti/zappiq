/**
 * Addons compráveis "no pacote" — os recorrentes MENSAIS que anexam à assinatura
 * do plano. Resolvemos os price IDs SEMPRE no servidor (nunca confiar em price
 * vindo do cliente): o front manda só a KEY do addon.
 *
 * Os pacotes one-shot (mensagens/disparos) e o overage metered NÃO entram aqui —
 * não são line items recorrentes de assinatura (são top-ups pós-contratação).
 */
import { ADDONS_V4_LIST, ADDONS_V4_STRIPE } from '@zappiq/shared';

export interface PurchasableAddon {
  key: string;
  name: string;
  amountBrl: number;
  priceId: string;
}

/** Resolve o price ID mensal de um addon recorrente pela sua key. null se não houver. */
function monthlyPriceIdFor(addonKey: string): string | null {
  const entry = (ADDONS_V4_STRIPE as Record<string, { priceIds?: Record<string, string> }>)[addonKey];
  return entry?.priceIds?.monthly ?? null;
}

/** Lista os addons recorrentes mensais que têm price real (compráveis no pacote). */
export function listPurchasableAddons(): PurchasableAddon[] {
  return ADDONS_V4_LIST.filter((a) => a.pricingMode === 'recurring_monthly')
    .map((a) => {
      const priceId = monthlyPriceIdFor(a.key);
      return priceId ? { key: a.key, name: a.name, amountBrl: a.amountBrl, priceId } : null;
    })
    .filter((a): a is PurchasableAddon => a !== null);
}

/**
 * Dado um array de keys vindas do cliente, devolve os line items Stripe válidos
 * (price + quantity). Keys inválidas/desconhecidas são ignoradas em silêncio.
 */
export function resolveAddonLineItems(keys: unknown): Array<{ price: string; quantity: number }> {
  if (!Array.isArray(keys)) return [];
  const valid = new Map(listPurchasableAddons().map((a) => [a.key, a.priceId]));
  const seen = new Set<string>();
  const items: Array<{ price: string; quantity: number }> = [];
  for (const k of keys) {
    if (typeof k !== 'string' || seen.has(k)) continue;
    const priceId = valid.get(k);
    if (priceId) {
      items.push({ price: priceId, quantity: 1 });
      seen.add(k);
    }
  }
  return items;
}
