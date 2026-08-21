/**
 * costGuardService: teto de custo Meta por organização (PR-H, decisão D5 do
 * plano Resposta Meta 2026, docs/resposta-meta-2026/PLANO-RESPOSTA-META.md).
 *
 * O que faz, de hora em hora (job `cost-guard` na fila cron):
 *   1. Para cada org com eventos tarifados no mês corrente no ledger
 *      (meta_billing_events), soma o custo do mês: contagem por categoria,
 *      billable=true, tarifa do metaRateCard vigente NA DATA do deliveredAt.
 *   2. Projeta linearmente o custo até o fim do mês.
 *   3. Cruza o custo REAL com o teto efetivo: >=70% alerta uma vez, >=90%
 *      alerta uma vez, >=100% marca soft-stop. A projeção entra no copy do
 *      alerta como aviso de ritmo, mas quem dispara os degraus é o gasto
 *      já realizado (ninguém leva soft-stop por extrapolação).
 *
 * Teto efetivo da org, nesta ordem:
 *   - settings.billing.metaCostCapBrl, quando o cliente definiu (mínimo
 *     R$ 10 via PATCH /api/billing/cost-guard; null volta ao derivado);
 *   - senão, o teto DERIVADO do desenho do plano (deriveMetaCostCapBrl).
 *   - Modo pico: se settings.billing.peakWindows cobrir a data atual, o teto
 *     efetivo multiplica pelo multiplier da janela (datas fortes tipo Black
 *     Friday sem rebaixar o teto do ano inteiro).
 *
 * SOFT-STOP (>=100%): grava a flag Redis `zappiq:metacap:{orgId}` com TTL de
 * 48h (a carência da D5) e registra settings.billing.metaCapState. Este job
 * NÃO bloqueia envio nenhum: quem vai consumir a flag é o caminho de envio
 * (dispatcher/webhook), numa etapa futura. Conversa aberta nunca cai.
 */
import { prisma } from '@zappiq/database';
import {
  META_RATE_CARD,
  PLAN_CONFIG,
  estimateMetaCostBrl,
  getMetaRatePerMessage,
  type MetaBillingCategory,
  type PlanConfig,
} from '@zappiq/shared';

import { logger } from '../utils/logger.js';
import redis from '../utils/redis.js';
import { sendEmail } from './email/emailProvider.js';

// ─── Constantes ────────────────────────────────────────────────

/** Fator de segurança do teto derivado (D5: desenho do plano × 1,3). */
export const META_CAP_SAFETY_FACTOR = 1.3;

/**
 * Início da cobrança da categoria service (01/10/2026). Antes dessa data o
 * rate card devolve service = 0 (é o valor histórico correto para o ledger),
 * mas o teto derivado precisa nascer já no mundo em que service é cobrada:
 * derivar com service = 0 daria um teto minúsculo que estouraria no dia 1º
 * de outubro, exatamente a surpresa que a D5 existe para impedir. Por isso a
 * derivação usa EXPLICITAMENTE a vigência de 01/10 para datas anteriores.
 */
const SERVICE_CHARGE_START = new Date('2026-10-01T00:00:00Z');

/** Degraus de alerta, do mais crítico para o mais leve (primeiro hit vale). */
export const COST_GUARD_THRESHOLDS = [100, 90, 70] as const;
export type CostGuardThreshold = (typeof COST_GUARD_THRESHOLDS)[number];

/** Carência do soft-stop (D5): 48 horas. */
export const SOFT_STOP_TTL_SECONDS = 48 * 3600;

/** TTL do hash mensal de idempotência: 60 dias (padrão usageReconciliation). */
const GUARD_HASH_TTL_SECONDS = 60 * 24 * 3600;

const DASH_BILLING_URL = 'https://zappiq.com.br/settings#billing';

/** Frase obrigatória da D5 em todo alerta: o teto nunca corta conversa. */
const OPEN_CONVERSATION_PROMISE =
  'Conversa aberta nunca cai: o teto nunca interrompe um atendimento em andamento, ele apenas segura o início de novos envios tarifados.';

const KNOWN_CATEGORIES: readonly MetaBillingCategory[] = [
  'marketing',
  'utility',
  'authentication',
  'service',
];

// ─── Chaves Redis ──────────────────────────────────────────────

function currentYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Hash mensal de idempotência/observabilidade por org. */
function costGuardKey(orgId: string, yearMonth: string): string {
  return `zappiq:costguard:${orgId}:${yearMonth}`;
}

/** Flag de soft-stop que o caminho de envio vai consumir no futuro. */
export function metaCapFlagKey(orgId: string): string {
  return `zappiq:metacap:${orgId}`;
}

function thresholdField(threshold: CostGuardThreshold): string {
  return `notify_pct_${threshold}`;
}

// ─── Tipos ─────────────────────────────────────────────────────

/** Janela de modo pico configurável pelo cliente (settings.billing). */
export interface PeakWindow {
  /** Início (inclusive), ISO date ou datetime. */
  start: string;
  /** Fim (inclusive; data sem hora cobre o dia inteiro). */
  end: string;
  /** Multiplicador do teto durante a janela (ex.: 2 dobra o teto). */
  multiplier: number;
}

interface CostGuardBillingSettings {
  /** Teto em R$ definido pelo cliente. null/ausente = usa o derivado. */
  metaCostCapBrl?: number | null;
  peakWindows?: PeakWindow[];
  metaCapState?: { hitAt: string; capBrl: number; acknowledged: boolean };
  [k: string]: unknown;
}

export interface EffectiveMetaCap {
  /** Teto efetivo em R$ inteiros. null = sem teto derivável nem definido. */
  capBrl: number | null;
  capSource: 'custom' | 'derived';
  /** true quando uma janela de pico válida cobre a data avaliada. */
  peakActive: boolean;
}

/** Shape do GET /api/billing/cost-guard. */
export interface CostGuardStatus {
  capBrl: number | null;
  capSource: 'custom' | 'derived';
  spentBrl: number;
  projectedBrl: number;
  percent: number;
  softStop: boolean;
  peakActive: boolean;
}

export interface CostGuardCycleResult {
  orgsProcessed: number;
  orgsFailed: number;
  orgsSkippedNoCap: number;
  alertsSent: number;
  softStopsSet: number;
  durationMs: number;
  periodYearMonth: string;
}

// ─── Teto derivado (função pura) ───────────────────────────────

/**
 * Teto DERIVADO do desenho do plano (D5, corrigida pela S3): cobre TODAS as
 * mensagens tarifadas que o plano vende, não só a franquia de atendimentos:
 *
 *   (aiMessagesPerMonth × tarifa service) + (broadcastsPerMonth × tarifa
 *   marketing), tudo × 1,3, arredondado a R$ inteiro.
 *
 * Disparos usam a tarifa de marketing (a pior) de propósito: teto derivado é
 * proteção, subestimar disparo utility como marketing só deixa a folga maior.
 *
 * Para datas antes de 01/10/2026 a tarifa vem da vigência de 01/10 (ver
 * comentário de SERVICE_CHARGE_START): sem isso o teto nasceria quase zero
 * porque service ainda custa R$ 0 no rate card histórico.
 *
 * Devolve null quando o plano é desconhecido ou tem limite ilimitado (-1):
 * não existe teto derivável, o guard só atua se o cliente definir o dele.
 */
export function deriveMetaCostCapBrl(plan: string, date: Date): number | null {
  const cfg = (PLAN_CONFIG as Record<string, PlanConfig>)[plan];
  if (!cfg) return null;

  const aiMessages = cfg.limits.aiMessagesPerMonth;
  const broadcasts = cfg.limits.broadcastsPerMonth;
  if (aiMessages === -1 || broadcasts === -1) return null;

  // Antes de 01/10, deriva com a vigência de 01/10 (service já cobrada).
  const rateDate = date.getTime() < SERVICE_CHARGE_START.getTime() ? SERVICE_CHARGE_START : date;

  const serviceRate = getMetaRatePerMessage('service', rateDate, 'BRL');
  const marketingRate = getMetaRatePerMessage('marketing', rateDate, 'BRL');

  const raw = (aiMessages * serviceRate + broadcasts * marketingRate) * META_CAP_SAFETY_FACTOR;
  return Math.round(raw);
}

// ─── Modo pico ─────────────────────────────────────────────────

/** Epoch ms do fim INCLUSIVO da janela: data sem hora cobre o dia inteiro. */
function windowEndMs(end: string): number {
  const parsed = Date.parse(end);
  if (!Number.isFinite(parsed)) return NaN;
  // 'YYYY-MM-DD' interpreta meia-noite UTC; estende até o fim do dia.
  return /^\d{4}-\d{2}-\d{2}$/.test(end) ? parsed + 24 * 3600 * 1000 - 1 : parsed;
}

/**
 * Multiplicador de pico vigente em `date`. Sem janela cobrindo (ou janelas
 * malformadas), devolve 1. Com mais de uma janela cobrindo, vale a de maior
 * multiplicador (determinístico e a favor do cliente).
 */
export function peakMultiplierFor(windows: unknown, date: Date): number {
  if (!Array.isArray(windows)) return 1;
  const t = date.getTime();
  let multiplier = 1;
  for (const w of windows) {
    if (!w || typeof w !== 'object') continue;
    const { start, end, multiplier: m } = w as Partial<PeakWindow>;
    if (typeof start !== 'string' || typeof end !== 'string') continue;
    if (typeof m !== 'number' || !Number.isFinite(m) || m <= 0) continue;
    const startMs = Date.parse(start);
    const endMs = windowEndMs(end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    if (startMs <= t && t <= endMs) {
      multiplier = Math.max(multiplier, m);
    }
  }
  return multiplier;
}

/** Existe janela de pico VÁLIDA cobrindo a data? (mesmo com multiplier 1) */
function hasPeakWindowCovering(windows: unknown, date: Date): boolean {
  if (!Array.isArray(windows)) return false;
  const t = date.getTime();
  return windows.some((w) => {
    if (!w || typeof w !== 'object') return false;
    const { start, end, multiplier: m } = w as Partial<PeakWindow>;
    if (typeof start !== 'string' || typeof end !== 'string') return false;
    if (typeof m !== 'number' || !Number.isFinite(m) || m <= 0) return false;
    const startMs = Date.parse(start);
    const endMs = windowEndMs(end);
    return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= t && t <= endMs;
  });
}

// ─── Teto efetivo ──────────────────────────────────────────────

function readCostGuardBilling(settings: unknown): CostGuardBillingSettings {
  const b = (settings as { billing?: unknown } | null)?.billing;
  return b && typeof b === 'object' ? (b as CostGuardBillingSettings) : {};
}

/**
 * Teto efetivo da org em `date`: custom do cliente quando definido, senão o
 * derivado do plano, e o modo pico multiplica por cima do que valer.
 */
export function resolveEffectiveMetaCap(input: {
  plan: string;
  settings: unknown;
  date: Date;
}): EffectiveMetaCap {
  const billing = readCostGuardBilling(input.settings);

  const custom =
    typeof billing.metaCostCapBrl === 'number' &&
    Number.isFinite(billing.metaCostCapBrl) &&
    billing.metaCostCapBrl > 0
      ? billing.metaCostCapBrl
      : null;

  const capSource: EffectiveMetaCap['capSource'] = custom !== null ? 'custom' : 'derived';
  const base = custom !== null ? custom : deriveMetaCostCapBrl(input.plan, input.date);

  if (base === null) {
    return { capBrl: null, capSource, peakActive: false };
  }

  const peakActive = hasPeakWindowCovering(billing.peakWindows, input.date);
  const multiplier = peakMultiplierFor(billing.peakWindows, input.date);
  return { capBrl: Math.round(base * multiplier), capSource, peakActive };
}

// ─── Custo do mês + projeção ───────────────────────────────────

function monthBoundsUtc(now: Date): { monthStart: Date; nextMonthStart: Date } {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, nextMonthStart };
}

/**
 * Segmentos do mês por vigência do rate card. Se uma vigência começar no
 * meio do mês, o mês vira dois segmentos e cada contagem multiplica pela
 * tarifa vigente no próprio segmento: é o que garante "tarifa na data do
 * deliveredAt" sem varrer evento a evento.
 */
function monthRateSegments(monthStart: Date, nextMonthStart: Date): Array<{ from: Date; to: Date }> {
  const boundaries: number[] = [monthStart.getTime()];
  for (const vigencia of META_RATE_CARD) {
    const inicio = Date.parse(`${vigencia.inicio}T00:00:00Z`);
    if (inicio > monthStart.getTime() && inicio < nextMonthStart.getTime()) {
      boundaries.push(inicio);
    }
  }
  boundaries.sort((a, b) => a - b);
  boundaries.push(nextMonthStart.getTime());

  const segments: Array<{ from: Date; to: Date }> = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    segments.push({ from: new Date(boundaries[i]), to: new Date(boundaries[i + 1]) });
  }
  return segments;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Custo Meta do mês corrente da org, em R$: contagem de eventos billable
 * entregues, por categoria, × tarifa vigente na data da entrega. Categoria
 * desconhecida/nula fica de fora (sem tarifa não há custo estimável).
 */
export async function computeMonthSpendBrl(orgId: string, now: Date): Promise<number> {
  const { monthStart, nextMonthStart } = monthBoundsUtc(now);
  let total = 0;

  for (const segment of monthRateSegments(monthStart, nextMonthStart)) {
    // Sem cast no retorno: o generic do groupBy do Prisma infere pelo shape
    // pedido, e um `as` aqui contamina a inferência do próprio argumento.
    const rows = await prisma.metaBillingEvent.groupBy({
      by: ['category'],
      where: {
        organizationId: orgId,
        billable: true,
        deliveredAt: { gte: segment.from, lt: segment.to },
      },
      _count: { _all: true },
    });

    for (const row of rows) {
      const category = row.category as MetaBillingCategory | null;
      if (!category || !KNOWN_CATEGORIES.includes(category)) continue;
      total += estimateMetaCostBrl(category, row._count._all, segment.from);
    }
  }

  return round2(total);
}

/** Projeção linear do custo até o fim do mês, pelo ritmo do que já passou. */
export function projectLinearToMonthEnd(spentBrl: number, now: Date): number {
  const { monthStart, nextMonthStart } = monthBoundsUtc(now);
  const elapsedMs = now.getTime() - monthStart.getTime();
  const totalMs = nextMonthStart.getTime() - monthStart.getTime();
  if (elapsedMs <= 0) return round2(spentBrl);
  return round2(spentBrl * (totalMs / elapsedMs));
}

// ─── Alerta (padrão quotaAlertsService: e-mail pro admin, fail-soft) ─

export interface CostGuardAlertPayload {
  orgId: string;
  orgName: string;
  threshold: CostGuardThreshold;
  spentBrl: number;
  projectedBrl: number;
  capBrl: number;
  percent: number;
  peakActive: boolean;
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildAlertEmail(p: CostGuardAlertPayload): { subject: string; html: string; text: string } {
  const tone: Record<CostGuardThreshold, { label: string; cta: string }> = {
    70: { label: 'Aviso preventivo', cta: 'Acompanhar o medidor' },
    90: { label: 'Teto próximo', cta: 'Revisar o teto agora' },
    100: { label: 'Teto atingido', cta: 'Ver ações no painel' },
  };
  const t = tone[p.threshold];
  const subject = `ZappIQ Conta Clara: ${t.label}, custo Meta em ${p.percent.toFixed(0)}% do teto (${p.orgName})`;

  const peakNote = p.peakActive
    ? '<p style="margin:12px 0;color:#374151;font-size:14px">Modo pico ativo: o teto desta janela já está multiplicado conforme a sua configuração.</p>'
    : '';

  const softStopNote =
    p.threshold === 100
      ? `<p style="margin:12px 0;color:#374151;font-size:14px"><strong>Soft-stop com carência de 48 horas:</strong> registramos o teto atingido e abrimos uma carência de 48 horas para você ajustar o teto ou confirmar que quer seguir. Nenhum envio foi bloqueado por este aviso.</p>`
      : '';

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="font-size:24px;margin-bottom:8px">${t.label}</div>
    <h1 style="margin:0 0 16px;font-size:22px;color:#111827;line-height:1.3">
      ${p.orgName}: custo Meta do mês em ${p.percent.toFixed(0)}% do teto
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.5;margin:0 0 16px">
      Gasto do mês até agora: <strong>R$ ${formatBrl(p.spentBrl)}</strong> de um teto de
      <strong>R$ ${formatBrl(p.capBrl)}</strong>. No ritmo atual, a projeção para o fim do mês é
      <strong>R$ ${formatBrl(p.projectedBrl)}</strong>.
    </p>
    ${peakNote}
    ${softStopNote}
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0;color:#374151;font-size:13px;line-height:1.5">
        ${OPEN_CONVERSATION_PROMISE}
      </p>
    </div>
    <a href="${DASH_BILLING_URL}" style="display:inline-block;background:linear-gradient(90deg,#7c3aed,#2563eb);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${t.cta}</a>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;line-height:1.5">
      Você está recebendo este aviso porque administra a conta ${p.orgName} na ZappIQ.
      A tarifa do WhatsApp é cobrada pela Meta direto na sua conta, sem markup da ZappIQ.
      Para ajustar o teto: <a href="${DASH_BILLING_URL}" style="color:#7c3aed">acessar configurações</a>.
    </p>
  </div>
</body></html>`;

  const text = [
    `ZappIQ Conta Clara: ${t.label}`,
    '',
    `${p.orgName}: custo Meta do mês em ${p.percent.toFixed(0)}% do teto.`,
    `Gasto até agora: R$ ${formatBrl(p.spentBrl)} de R$ ${formatBrl(p.capBrl)}.`,
    `Projeção para o fim do mês: R$ ${formatBrl(p.projectedBrl)}.`,
    p.threshold === 100
      ? 'Soft-stop registrado com carência de 48 horas. Nenhum envio foi bloqueado por este aviso.'
      : '',
    OPEN_CONVERSATION_PROMISE,
    '',
    `Ajustar o teto: ${DASH_BILLING_URL}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

/**
 * Dispara o alerta por e-mail ao admin da org (mesmo padrão de resolução do
 * quotaAlertsService: ADMIN/SUPERADMIN mais antigo). Fail-soft: devolve
 * false em qualquer falha, o ciclo tenta de novo na próxima hora.
 */
export async function dispatchCostGuardAlert(payload: CostGuardAlertPayload): Promise<boolean> {
  let adminEmail: string | null = null;
  try {
    const admin = (await prisma.user.findFirst({
      where: {
        organizationId: payload.orgId,
        role: { in: ['ADMIN', 'SUPERADMIN'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    })) as { email: string } | null;
    adminEmail = admin?.email ?? null;
  } catch (err: any) {
    logger.warn(`[CostGuard] falhou ao buscar admin org=${payload.orgId}: ${err?.message}`);
  }

  if (!adminEmail) {
    logger.warn(`[CostGuard] sem admin pra org=${payload.orgId}, alerta não enviado`);
    return false;
  }

  try {
    const { subject, html, text } = buildAlertEmail(payload);
    const r = await sendEmail({ to: adminEmail, subject, html, text });
    const sent = Boolean((r as any)?.success ?? r);
    logger.info(
      `[CostGuard] alerta ${payload.threshold}% org=${payload.orgId} email=${sent} gasto=R$${payload.spentBrl} teto=R$${payload.capBrl}`,
    );
    return sent;
  } catch (err: any) {
    logger.warn(`[CostGuard] email fail org=${payload.orgId}: ${err?.message}`);
    return false;
  }
}

// ─── Soft-stop ─────────────────────────────────────────────────

/**
 * Marca o soft-stop da org: flag Redis com TTL de 48h (a carência) + estado
 * em settings.billing.metaCapState. Merge cuidadoso do Json: relê a org na
 * hora do update e preserva todo o resto de settings e de settings.billing.
 *
 * IMPORTANTE: nada é bloqueado aqui. O consumo da flag no caminho de envio
 * (segurar início de NOVO envio tarifado quando `zappiq:metacap:{orgId}`
 * existir e o cliente não tiver dado o aceite) é etapa futura do plano.
 */
async function applySoftStop(orgId: string, capBrl: number, now: Date): Promise<void> {
  const hitAt = now.toISOString();

  await redis.set(
    metaCapFlagKey(orgId),
    JSON.stringify({ hitAt, capBrl }),
    'EX',
    SOFT_STOP_TTL_SECONDS,
  );

  // Relê settings na hora do update pra não sobrescrever escrita concorrente
  // com o snapshot velho do começo do ciclo.
  const fresh = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })) as { settings: unknown } | null;

  const settings =
    fresh?.settings && typeof fresh.settings === 'object'
      ? (fresh.settings as Record<string, unknown>)
      : {};
  const billing = readCostGuardBilling(settings);

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      settings: {
        ...settings,
        billing: {
          ...billing,
          metaCapState: { hitAt, capBrl, acknowledged: false },
        },
      } as any,
    },
  });
}

// ─── Ciclo por organização ─────────────────────────────────────

interface OrgSnapshot {
  id: string;
  name: string;
  plan: string;
  settings: unknown;
}

export interface OrgGuardResult {
  skippedNoCap: boolean;
  capBrl: number | null;
  spentBrl: number;
  percent: number;
  alerted: CostGuardThreshold | null;
  softStopSet: boolean;
}

export async function checkOrgCostGuard(
  org: OrgSnapshot,
  now: Date,
  periodYearMonth: string,
): Promise<OrgGuardResult> {
  const cap = resolveEffectiveMetaCap({ plan: org.plan, settings: org.settings, date: now });

  if (cap.capBrl === null || cap.capBrl <= 0) {
    // Plano ilimitado/desconhecido e sem teto custom: nada a vigiar.
    logger.debug?.(`[CostGuard] org=${org.id} sem teto derivável nem custom, skip`);
    return {
      skippedNoCap: true,
      capBrl: null,
      spentBrl: 0,
      percent: 0,
      alerted: null,
      softStopSet: false,
    };
  }

  const spentBrl = await computeMonthSpendBrl(org.id, now);
  const projectedBrl = projectLinearToMonthEnd(spentBrl, now);
  const percent = (spentBrl / cap.capBrl) * 100;

  const key = costGuardKey(org.id, periodYearMonth);
  let alerted: CostGuardThreshold | null = null;
  let softStopSet = false;

  try {
    await redis.hset(key, {
      last_run_at: now.toISOString(),
      spent_brl: spentBrl.toFixed(2),
      projected_brl: projectedBrl.toFixed(2),
      cap_brl: String(cap.capBrl),
      cap_source: cap.capSource,
      percent: percent.toFixed(2),
    });
    await redis.expire(key, GUARD_HASH_TTL_SECONDS);

    // Primeiro degrau atingido (do mais crítico pro mais leve).
    let threshold: CostGuardThreshold | null = null;
    for (const t of COST_GUARD_THRESHOLDS) {
      if (percent >= t) {
        threshold = t;
        break;
      }
    }
    if (threshold === null) {
      return { skippedNoCap: false, capBrl: cap.capBrl, spentBrl, percent, alerted, softStopSet };
    }

    const field = thresholdField(threshold);
    const alreadyNotified = await redis.hget(key, field);
    if (alreadyNotified) {
      return { skippedNoCap: false, capBrl: cap.capBrl, spentBrl, percent, alerted, softStopSet };
    }

    // Soft-stop ANTES do e-mail e com marcador próprio: se o e-mail falhar,
    // a próxima hora reenvia o alerta sem rearmar a flag (rearmar renovaria o
    // TTL e esticaria a carência de 48h sem querer).
    if (threshold === 100) {
      const alreadyStopped = await redis.hget(key, 'soft_stop_at');
      if (!alreadyStopped) {
        await applySoftStop(org.id, cap.capBrl, now);
        await redis.hset(key, { soft_stop_at: now.toISOString() });
        softStopSet = true;
      }
    }

    const sent = await dispatchCostGuardAlert({
      orgId: org.id,
      orgName: org.name,
      threshold,
      spentBrl,
      projectedBrl,
      capBrl: cap.capBrl,
      percent,
      peakActive: cap.peakActive,
    });

    if (sent) {
      await redis.hset(key, { [field]: now.toISOString() });
      alerted = threshold;
    }
  } catch (err: any) {
    logger.warn(`[CostGuard] Redis falhou para org=${org.id}: ${err?.message}`);
  }

  return { skippedNoCap: false, capBrl: cap.capBrl, spentBrl, percent, alerted, softStopSet };
}

// ─── Ciclo completo (job `cost-guard` da fila cron) ────────────

export async function runCostGuardCycle(): Promise<CostGuardCycleResult> {
  const started = Date.now();
  const now = new Date();
  const periodYearMonth = currentYearMonth(now);
  const { monthStart, nextMonthStart } = monthBoundsUtc(now);

  // Só orgs com evento TARIFADO entregue no mês corrente: quem não gastou
  // nada não tem o que cruzar com teto (e o alerta de 0% seria ruído).
  const orgRows = await prisma.metaBillingEvent.groupBy({
    by: ['organizationId'],
    where: {
      billable: true,
      deliveredAt: { gte: monthStart, lt: nextMonthStart },
    },
  });

  let orgsProcessed = 0;
  let orgsFailed = 0;
  let orgsSkippedNoCap = 0;
  let alertsSent = 0;
  let softStopsSet = 0;

  for (const row of orgRows) {
    try {
      const org = (await prisma.organization.findUnique({
        where: { id: row.organizationId },
        select: { id: true, name: true, plan: true, settings: true },
      })) as OrgSnapshot | null;
      if (!org) continue;

      const result = await checkOrgCostGuard(org, now, periodYearMonth);
      orgsProcessed++;
      if (result.skippedNoCap) orgsSkippedNoCap++;
      if (result.alerted !== null) alertsSent++;
      if (result.softStopSet) softStopsSet++;
    } catch (err: any) {
      orgsFailed++;
      logger.warn(`[CostGuard] falha ao processar org=${row.organizationId}: ${err?.message}`);
    }
  }

  const durationMs = Date.now() - started;
  logger.info(
    `[CostGuard] Ciclo concluído, período=${periodYearMonth}: ok=${orgsProcessed}, semTeto=${orgsSkippedNoCap}, falha=${orgsFailed}, alertas=${alertsSent}, softStops=${softStopsSet}, ${durationMs}ms`,
  );

  return {
    orgsProcessed,
    orgsFailed,
    orgsSkippedNoCap,
    alertsSent,
    softStopsSet,
    durationMs,
    periodYearMonth,
  };
}

// ─── Consulta e ajuste (endpoint /api/billing/cost-guard) ──────

/** Estado corrente do Cost Guard da org, no shape do GET. */
export async function getCostGuardStatus(orgId: string, now = new Date()): Promise<CostGuardStatus> {
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, settings: true },
  })) as { plan: string; settings: unknown } | null;
  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  const cap = resolveEffectiveMetaCap({ plan: org.plan, settings: org.settings, date: now });
  const spentBrl = await computeMonthSpendBrl(orgId, now);
  const projectedBrl = projectLinearToMonthEnd(spentBrl, now);
  const percent =
    cap.capBrl !== null && cap.capBrl > 0
      ? Math.round((spentBrl / cap.capBrl) * 1000) / 10
      : 0;

  let softStop = false;
  try {
    softStop = (await redis.exists(metaCapFlagKey(orgId))) === 1;
  } catch (err: any) {
    logger.warn(`[CostGuard] leitura da flag falhou org=${orgId}: ${err?.message}`);
  }

  return {
    capBrl: cap.capBrl,
    capSource: cap.capSource,
    spentBrl,
    projectedBrl,
    percent,
    softStop,
    peakActive: cap.peakActive,
  };
}

/**
 * Define o teto custom da org (R$ inteiros, mínimo 10 validado na rota) ou
 * volta ao derivado (null). Merge cuidadoso do Json de settings: preserva
 * tudo que já existe em settings e em settings.billing.
 */
export async function setMetaCostCapBrl(orgId: string, capBrl: number | null): Promise<void> {
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })) as { settings: unknown } | null;
  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  const settings =
    org.settings && typeof org.settings === 'object'
      ? (org.settings as Record<string, unknown>)
      : {};
  const billing = readCostGuardBilling(settings);

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      settings: {
        ...settings,
        billing: {
          ...billing,
          metaCostCapBrl: capBrl === null ? null : Math.round(capBrl),
        },
      } as any,
    },
  });

  logger.info(
    `[CostGuard] teto custom ${capBrl === null ? 'removido (volta ao derivado)' : `definido em R$ ${Math.round(capBrl)}`} org=${orgId}`,
  );
}
