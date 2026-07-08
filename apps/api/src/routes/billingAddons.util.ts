/**
 * Addons compráveis "no pacote" — os recorrentes que anexam à assinatura do
 * plano. Resolvemos os price IDs SEMPRE no servidor (nunca confiar em price
 * vindo do cliente): o front manda só a KEY do addon.
 *
 * INTERVALO: o addon precisa casar o ciclo do plano (o Stripe proíbe misturar
 * mensal + anual na mesma assinatura). resolveAddonLineItems recebe o ciclo e
 * resolve o price correspondente; se um addon não tiver price naquele ciclo, é
 * EXCLUÍDO (defesa: nunca montamos line items de intervalos diferentes).
 *
 * Os pacotes one-shot (mensagens/disparos) e o overage metered NÃO entram aqui —
 * não são line items recorrentes de assinatura (são top-ups pós-contratação).
 */
import { ADDONS_V4_LIST, ADDONS_V4_STRIPE } from '@zappiq/shared';

export type BillingCycle = 'monthly' | 'annual';

export interface PurchasableAddon {
  key: string;
  name: string;
  amountBrl: number;
  priceId: string;
}

/** Price ID de um addon recorrente pela key + ciclo. null se não houver. */
export function addonPriceIdFor(addonKey: string, cycle: BillingCycle): string | null {
  const entry = (ADDONS_V4_STRIPE as Record<string, { priceIds?: Record<string, string> }>)[addonKey];
  return entry?.priceIds?.[cycle] ?? null;
}

/**
 * Lista os addons recorrentes compráveis no pacote para um ciclo. Só entram os
 * que têm price real naquele ciclo. Default mensal (catálogo exibido em /mês).
 */
export function listPurchasableAddons(cycle: BillingCycle = 'monthly'): PurchasableAddon[] {
  return ADDONS_V4_LIST.filter((a) => a.pricingMode === 'recurring_monthly')
    .map((a) => {
      const priceId = addonPriceIdFor(a.key, cycle);
      return priceId ? { key: a.key, name: a.name, amountBrl: a.amountBrl, priceId } : null;
    })
    .filter((a): a is PurchasableAddon => a !== null);
}

/**
 * Dado um array de keys vindas do cliente + o ciclo do plano, devolve os line
 * items Stripe válidos (price + quantity) NO MESMO CICLO do plano. Keys
 * inválidas/desconhecidas OU sem price no ciclo pedido são ignoradas em
 * silêncio (nunca mistura intervalos).
 */
export function resolveAddonLineItems(
  keys: unknown,
  cycle: BillingCycle = 'monthly',
): Array<{ price: string; quantity: number }> {
  if (!Array.isArray(keys)) return [];
  const valid = new Map(listPurchasableAddons(cycle).map((a) => [a.key, a.priceId]));
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
