/**
 * Quota Overage Service (#147 — Onda 1.A).
 *
 * Reporta uso excedente pra Stripe via Billing Meter Events. Cada mensagem
 * acima do limite do plano vira 1 event, agregado pelo Stripe Meter
 * mtr_61UlFW... e cobrado no fim do ciclo via Price overage AI_MSG.
 *
 * Princípios:
 *   - Fail-soft: erro de Stripe NAO crasha o request. Loga warning e segue.
 *   - Idempotente: identifier unico por orgId+ym+counter (Stripe deduplica).
 *   - Audit em logger estruturado (Grafana Loki captura).
 *
 * Pre-condicoes pra cobranca real funcionar:
 *   - env.QUOTA_OVERAGE_MODE === 'enforce'
 *   - org.settings.billing.autoOverage === true
 *   - org.settings.stripeCustomerId presente (vem do checkout.session.completed)
 *   - org.settings.stripeSubscriptionId com price overage AI_MSG ativo
 *
 * Quando alguma pre-condicao falta, o reportador loga skip + razao e nao
 * dispara HTTP. Idempotente: ok rodar varias vezes sem efeito colateral.
 */

import { prisma } from '@zappiq/database';
import { ADDONS_V4_STRIPE } from '@zappiq/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

interface OverageReportInput {
  orgId: string;
  /** Quantidade de mensagens excedentes a reportar (>= 1) */
  count: number;
  /** Timestamp opcional (default now). Stripe aceita ate 24h no passado. */
  timestamp?: Date;
}

interface OverageReportResult {
  reported: boolean;
  skipped?: string;
  meterEventId?: string;
}

function currentYearMonth(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Reporta evento de overage pro Stripe Meter.
 *
 * Identifier idempotency: `zappiq_overage_${orgId}_${yyyy-mm}_${counter}`
 * onde counter eh o segundo do dia (pra granularidade adequada sem duplicar
 * dois events do mesmo segundo do mesmo org). Stripe dedup garante 1 cobranca.
 */
export async function reportOverageMeterEvent(
  input: OverageReportInput,
): Promise<OverageReportResult> {
  const { orgId, count } = input;
  const timestamp = input.timestamp ?? new Date();

  if (count <= 0) {
    return { reported: false, skipped: 'count_zero_or_negative' };
  }

  // Feature flag — fora do modo enforce, nao dispara nada
  if (env.QUOTA_OVERAGE_MODE !== 'enforce') {
    logger.debug(
      `[overage] mode=${env.QUOTA_OVERAGE_MODE}, skip report org=${orgId} count=${count}`,
    );
    return { reported: false, skipped: 'mode_audit_only' };
  }

  if (!env.STRIPE_SECRET_KEY) {
    logger.warn('[overage] STRIPE_SECRET_KEY ausente — skip');
    return { reported: false, skipped: 'no_stripe_key' };
  }

  try {
    const org = (await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, settings: true },
    })) as any;

    if (!org) {
      return { reported: false, skipped: 'org_not_found' };
    }

    const billing = (org.settings as any)?.billing ?? {};
    if (!billing.autoOverage) {
      return { reported: false, skipped: 'autoOverage_disabled' };
    }

    const stripeCustomerId = (org.settings as any)?.stripeCustomerId as string | undefined;
    if (!stripeCustomerId) {
      logger.warn(
        `[overage] org=${orgId} sem stripeCustomerId — checkout ainda nao concluido`,
      );
      return { reported: false, skipped: 'no_stripe_customer' };
    }

    const eventName = 'zappiq_ai_msg_processed';
    const ym = currentYearMonth(timestamp);
    const secondOfDay =
      timestamp.getUTCHours() * 3600 +
      timestamp.getUTCMinutes() * 60 +
      timestamp.getUTCSeconds();
    const identifier = `zappiq_overage_${orgId}_${ym}_${secondOfDay}_${count}`;

    // POST form-encoded pra Stripe
    const body = new URLSearchParams();
    body.set('event_name', eventName);
    body.set('identifier', identifier);
    body.set('timestamp', String(Math.floor(timestamp.getTime() / 1000)));
    body.set('payload[stripe_customer_id]', stripeCustomerId);
    body.set('payload[value]', String(count));

    const resp = await fetch(`${STRIPE_API_BASE}/billing/meter_events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      logger.warn(
        `[overage] Stripe meter_event falhou org=${orgId} count=${count} status=${resp.status} body=${text.slice(0, 300)}`,
      );
      return { reported: false, skipped: `stripe_${resp.status}` };
    }

    const data = (await resp.json()) as { id?: string };
    logger.info(
      `[overage] reported org=${orgId} count=${count} eventId=${data.id ?? 'unknown'} (meter=${ADDONS_V4_STRIPE.AI_MSG.meterId})`,
    );

    return { reported: true, meterEventId: data.id };
  } catch (err: any) {
    logger.warn(`[overage] exception org=${orgId}: ${err?.message ?? err}`);
    return { reported: false, skipped: 'exception' };
  }
}

/**
 * Helper: estima custo BRL do overage (pra checar contra hardCeilingBrl).
 *
 * Usa o unit_amount cents fixo do Price overage AI_MSG = R$ 0,03/msg.
 */
export function estimateOverageBrl(overageCount: number): number {
  const unitBrl = 0.03;
  return overageCount * unitBrl;
}
