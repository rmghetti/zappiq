'use client';

/* ══════════════════════════════════════════════════════════════════════
 * AccountDrawer — perfil de conta 360 (Área Clientes / Fase 2, §3/§4).
 * --------------------------------------------------------------------
 * Reusa o layout do TenantDrawer (unit-economics) mas consome o endpoint
 * /api/admin/clientes/:orgId, que já corrige o stripeCustomerId real (colunas
 * novas da Fase 1) e agrega org + tenant-usage + crm_account.
 *
 * Seções entregues (§3): A identidade, B plano, C cobrança Stripe (D/E consumo
 * + custo/margem reais com mini-chart 6m), F link de conversas, G timeline
 * (crm_account_activity), H/I owner + próxima ação.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ExternalLink, User, Target, ArrowRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ClienteDetailResponse, HealthBreakdown, clientesApi } from '../../../../lib/adminApi';

interface AccountDrawerProps {
  isOpen: boolean;
  accountId: string; // orgId OU crmAccountId
  onClose: () => void;
  data: ClienteDetailResponse | null;
  loading: boolean;
  onOwnerChanged?: () => void;
  /** quando 'health', o drawer rola até a seção "Saúde da conta" ao abrir. */
  scrollTo?: 'health' | 'billing' | null;
}

const stageLabel: Record<string, { label: string; cls: string }> = {
  NOVO: { label: 'Novo', cls: 'bg-blue-100 text-blue-800' },
  EM_TRIAL: { label: 'Em trial', cls: 'bg-purple-100 text-purple-800' },
  PAGO: { label: 'Pago', cls: 'bg-green-100 text-green-800' },
  ATIVO: { label: 'Pago', cls: 'bg-green-100 text-green-800' },
  TRIAL_EXPIRADO: { label: 'Trial expirado', cls: 'bg-orange-100 text-orange-800' },
  PAST_DUE: { label: 'Inadimplente', cls: 'bg-red-100 text-red-800' },
  CHURNED: { label: 'Churn', cls: 'bg-gray-200 text-gray-700' },
};

const healthDot: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value ?? '—'}</span>
    </div>
  );
}

export function AccountDrawer({
  isOpen,
  accountId,
  onClose,
  data,
  loading,
  onOwnerChanged,
  scrollTo = null,
}: AccountDrawerProps) {
  const [savingOwner, setSavingOwner] = useState(false);
  const healthRef = useRef<HTMLDivElement | null>(null);
  const billingRef = useRef<HTMLDivElement | null>(null);
  const ownerRef = useRef<HTMLDivElement | null>(null);

  const stripeCustomerId = data?.billing.stripeCustomerId ?? null;
  const stage = data?.plan.stage ?? 'NOVO';
  const badge = stageLabel[stage] ?? stageLabel.NOVO;

  // Ao carregar o detalhe, rola até a seção pedida (Health / Cobrança).
  useEffect(() => {
    if (!isOpen || loading || !data) return;
    const target = scrollTo === 'health' ? healthRef.current : scrollTo === 'billing' ? billingRef.current : null;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isOpen, loading, data, scrollTo]);

  // Playbook aponta risco para '#owner' (ação no próprio drawer): rola pro owner.
  const goToPlaybookLink = (href: string) => {
    if (href === '#owner') {
      ownerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false; // não navega
    }
    return true; // link real → deixa o <Link> navegar
  };

  const handleSetOwner = async (ownerUserId: string) => {
    if (!accountId) return;
    setSavingOwner(true);
    try {
      await clientesApi.setOwner(accountId, ownerUserId || null);
      onOwnerChanged?.();
    } catch (err) {
      console.error('Erro ao setar owner:', err);
    } finally {
      setSavingOwner(false);
    }
  };

  const marginText = useMemo(() => {
    const m = data?.usage.current?.grossMarginPercent;
    return m == null ? '—' : `${m.toFixed(1)}%`;
  }, [data]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

      <div className="absolute right-0 top-0 bottom-0 w-[460px] bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {data?.identity.name ?? '—'}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded ${badge.cls}`}>
                {badge.label}
              </span>
              {data?.plan.plan && (
                <span className="px-2.5 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded">
                  {data.plan.plan}
                </span>
              )}
              {data && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${healthDot[data.plan.healthColor]}`} />
                  Health {data.plan.healthScore}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Fechar">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-48 bg-gray-200 rounded" />
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Sem dados disponíveis
            </div>
          ) : (
            <>
              {/* A — Identidade */}
              <Section title="Identidade">
                <Row label="Empresa" value={data.identity.company} />
                <Row
                  label="Email"
                  value={
                    <a href={`mailto:${data.identity.email}`} className="text-primary-600 hover:underline">
                      {data.identity.email}
                    </a>
                  }
                />
                <Row label="CNPJ" value={data.identity.cnpj} />
                <Row label="Segmento" value={data.identity.niche} />
                <Row label="Prontidão IA" value={data.identity.aiReadinessScore != null ? `${data.identity.aiReadinessScore}/100` : '—'} />
                <Row
                  label="Cadastrado"
                  value={new Date(data.identity.createdAt).toLocaleDateString('pt-BR')}
                />
              </Section>

              {/* B — Plano & assinatura */}
              <Section title="Plano & assinatura">
                <Row label="Plano" value={data.plan.plan} />
                <Row
                  label="Trial expira"
                  value={
                    data.plan.trialEndsAt
                      ? `${new Date(data.plan.trialEndsAt).toLocaleDateString('pt-BR')}${
                          data.plan.trialDaysLeft != null ? ` (${data.plan.trialDaysLeft}d)` : ''
                        }`
                      : '—'
                  }
                />
                <Row label="Teto de custo trial (USD)" value={data.plan.trialCostCapUsd != null ? `$${data.plan.trialCostCapUsd}` : '—'} />
              </Section>

              {/* Saúde da conta — health decomposto + playbook (Fase 2) */}
              <div ref={healthRef} className="scroll-mt-4">
                <HealthSection health={data.health} onPlaybookClick={goToPlaybookLink} />
              </div>

              {/* C — Cobrança Stripe (colunas reais Fase 1) */}
              <div ref={billingRef} className="scroll-mt-4">
              <Section title="Cobrança Stripe">
                {stripeCustomerId ? (
                  <a
                    href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 underline"
                  >
                    Abrir no Stripe <ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="text-xs text-gray-400">Sem assinatura Stripe vinculada</p>
                )}
                <Row label="Status assinatura" value={data.billing.subscriptionStatus} />
                <Row label="MRR" value={data.billing.mrrCents > 0 ? `R$ ${(data.billing.mrrCents / 100).toFixed(2)}` : '—'} />
                <Row label="Primeiro pagamento" value={data.billing.paidAt ? new Date(data.billing.paidAt).toLocaleDateString('pt-BR') : '—'} />
                <Row label="Churn em" value={data.billing.churnedAt ? new Date(data.billing.churnedAt).toLocaleDateString('pt-BR') : '—'} />
              </Section>
              </div>

              {/* D/E — Consumo real + custo/margem + mini-chart */}
              <Section title="Consumo & margem (real)">
                {data.usage.current ? (
                  <>
                    <Row label="Mensagens IA (mês)" value={data.usage.current.aiMessagesProcessed.toLocaleString('pt-BR')} />
                    <Row label="Conversas abertas" value={data.usage.current.conversationsOpened} />
                    <Row label="Resolvidas por IA" value={data.usage.current.conversationsAiResolved} />
                    <Row label="Resolvidas por humano" value={data.usage.current.conversationsHumanResolved} />
                    <Row label="Handoffs" value={data.usage.current.handoffsCount} />
                    <Row label="Custo LLM (USD)" value={`$${data.usage.current.llmCostUsd.toFixed(2)}`} />
                    <Row label="Margem bruta" value={marginText} />
                  </>
                ) : (
                  <p className="text-xs text-gray-400">Sem consumo agregado neste período</p>
                )}
                {data.usage.history.length > 0 && <UsageChart history={data.usage.history} />}
              </Section>

              {/* F — Conversas */}
              {data.links.izaConversations && (
                <Link
                  href={data.links.izaConversations}
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                >
                  Ver conversas da Iza <ExternalLink size={14} />
                </Link>
              )}

              {/* H — Owner ZappIQ (alvo do link de risco '#owner') */}
              <div ref={ownerRef} id="owner" className="scroll-mt-4">
              <Section title="Owner ZappIQ">
                {data.owner.candidates.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    <select
                      value={data.owner.ownerUserId ?? ''}
                      disabled={savingOwner}
                      onChange={(e) => handleSetOwner(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                    >
                      <option value="">Sem owner</option>
                      {data.owner.candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.email} ({c.role})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Sem usuários candidatos (conta sem org)</p>
                )}
              </Section>
              </div>

              {/* G — Timeline */}
              <Section title="Atividades">
                {data.activities.length === 0 ? (
                  <p className="text-xs text-gray-400">Sem atividades registradas</p>
                ) : (
                  <ul className="space-y-2">
                    {data.activities.map((a) => (
                      <li key={a.id} className="text-xs text-gray-600 flex justify-between gap-3">
                        <span className="font-medium text-gray-800">{a.type}</span>
                        <span className="text-gray-400">
                          {new Date(a.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-2 bg-gray-50 rounded-lg p-4">{children}</div>
    </div>
  );
}

/** Mini-chart 6 meses: mensagens IA (azul) + custo LLM (vermelho). */
function UsageChart({
  history,
}: {
  history: ClienteDetailResponse['usage']['history'];
}) {
  const data = [...history].reverse().slice(-6);
  if (data.length === 0) return null;

  const maxMsgs = Math.max(...data.map((d) => d.aiMessagesProcessed), 1);
  const maxCost = Math.max(...data.map((d) => d.llmCostUsd), 1);

  const chartW = 360;
  const chartH = 180;
  const padding = 28;
  const innerW = chartW - padding * 2;
  const innerH = chartH - padding * 2;

  return (
    <div className="mt-3 bg-white rounded-lg p-3 border border-gray-100">
      <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={r}
            x1={padding}
            y1={padding + innerH * (1 - r)}
            x2={padding + innerW}
            y2={padding + innerH * (1 - r)}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        {data.map((row, idx) => {
          const x = padding + (idx * innerW) / data.length;
          const bw = innerW / data.length - 6;
          const msgH = (row.aiMessagesProcessed / maxMsgs) * innerH;
          const costH = (row.llmCostUsd / maxCost) * innerH;
          return (
            <g key={idx}>
              <rect x={x + 2} y={padding + innerH - msgH} width={bw * 0.55} height={msgH} fill="#3b82f6" opacity="0.85" />
              <rect x={x + 2 + bw * 0.55} y={padding + innerH - costH} width={bw * 0.45} height={costH} fill="#ef4444" opacity="0.85" />
              <text x={x + bw / 2} y={padding + innerH + 14} fontSize="9" fill="#666" textAnchor="middle">
                {row.period.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 mt-2 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded" />Mensagens IA</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded" />Custo LLM</span>
      </div>
    </div>
  );
}

// ─── Saúde da conta (Fase 2) — health decomposto + playbook acionável ────────

const HEALTH_HEADER: Record<HealthBreakdown['color'], { bar: string; text: string; label: string }> = {
  green: { bar: 'bg-green-500', text: 'text-green-700', label: 'Saudável' },
  amber: { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Atenção' },
  red: { bar: 'bg-red-500', text: 'text-red-700', label: 'Em risco' },
};

const DIM_COLOR: Record<string, string> = {
  adocao: 'bg-indigo-500',
  uso: 'bg-sky-500',
  financeiro: 'bg-emerald-500',
};

/**
 * HealthSection — mostra o health como BARRA DECOMPOSTA nas 3 dimensões
 * (adoção/uso/financeiro) com nota, peso e contribuição de cada; explica o teto
 * de risco quando aplicado; lista o PLAYBOOK (diagnóstico → ação clicável); a
 * NEXT ACTION em destaque; e a META PRO VERDE.
 */
function HealthSection({
  health,
  onPlaybookClick,
}: {
  health: HealthBreakdown;
  /** retorna false quando o link é '#owner' (rola no drawer, não navega). */
  onPlaybookClick: (href: string) => boolean;
}) {
  const hd = HEALTH_HEADER[health.color] ?? HEALTH_HEADER.amber;
  // Ordena barra por contribuição (maior primeiro) só p/ leitura; larguras somam ≤100.
  const dims = health.dimensions;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Saúde da conta</h3>
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${hd.text}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${hd.bar}`} />
          {health.total} · {hd.label}
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        {/* Barra decomposta: cada segmento = contribuição da dimensão (score*peso) */}
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
            {dims.map((d) =>
              d.contributionPoints > 0 ? (
                <div
                  key={d.key}
                  className={DIM_COLOR[d.key] ?? 'bg-gray-400'}
                  style={{ width: `${d.contributionPoints}%` }}
                  title={`${d.label}: ${d.contributionPoints} pts`}
                />
              ) : null,
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Barra = pontos que cada dimensão soma ao total (nota × peso).
          </p>
        </div>

        {/* Detalhe por dimensão: nota, peso e contribuição */}
        <div className="space-y-2.5">
          {dims.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DIM_COLOR[d.key] ?? 'bg-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-gray-800">{d.label}</span>
                  <span className="text-[11px] text-gray-500">
                    <span className="font-bold text-gray-800">{d.score}</span>/100 · peso {Math.round(d.weight * 100)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className={`h-full ${DIM_COLOR[d.key] ?? 'bg-gray-400'}`} style={{ width: `${d.score}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Contribui <span className="font-semibold">{d.contributionPoints} pts</span> · faltam {d.gapPoints} pts
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Teto de risco explicado (quando o estágio limitou o score) */}
        {health.ceilingApplied && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-[12px] text-red-800">
            <ShieldAlert size={15} className="flex-shrink-0 mt-0.5" />
            <p>
              Teto de risco aplicado: o estágio{' '}
              <span className="font-bold">{stageLabel[health.ceilingApplied.stage]?.label ?? health.ceilingApplied.stage}</span>{' '}
              limita o health a <span className="font-bold">{health.ceilingApplied.cap}</span>. A conta não pode
              ficar verde enquanto o risco comercial não for resolvido.
            </p>
          </div>
        )}

        {/* Next action em destaque */}
        {health.nextAction && (
          <div className="rounded-lg bg-primary-50 border border-primary-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700 mb-1 flex items-center gap-1">
              <ArrowRight size={12} /> Próxima ação
            </p>
            <p className="text-[13px] text-primary-900 font-medium">{health.nextAction.action}</p>
            <PlaybookLink href={health.nextAction.linkHref} onClick={onPlaybookClick} className="mt-1.5" />
          </div>
        )}

        {/* Playbook completo (diagnóstico → ação) */}
        {health.playbook.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Playbook</p>
            <ul className="space-y-2">
              {health.playbook.map((p, i) => (
                <li
                  key={`${p.dimension}-${i}`}
                  className={`rounded-lg border p-3 ${
                    p.dimension === 'risco' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="text-[12px] font-semibold text-gray-800">{p.diagnosis}</p>
                  <p className="text-[12px] text-gray-600 mt-0.5">{p.action}</p>
                  <PlaybookLink href={p.linkHref} onClick={onPlaybookClick} className="mt-1.5" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Meta pro verde */}
        {health.targetToGreen && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-900">
            <Target size={15} className="flex-shrink-0 mt-0.5" />
            <p>
              Faltam <span className="font-bold">{health.targetToGreen.pointsNeeded} pontos</span> para o verde.
              Maior ganho investindo em{' '}
              <span className="font-bold">
                {dims.find((d) => d.key === health.targetToGreen!.bestDimension)?.label ?? health.targetToGreen.bestDimension}
              </span>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Link do playbook: '#owner' rola no drawer; qualquer outro navega via <Link>. */
function PlaybookLink({
  href,
  onClick,
  className = '',
}: {
  href: string;
  onClick: (href: string) => boolean;
  className?: string;
}) {
  const cls = `inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer ${className}`;
  if (href === '#owner') {
    return (
      <button type="button" onClick={() => onClick(href)} className={cls}>
        Atribuir dono / criar tarefa <ArrowRight size={11} />
      </button>
    );
  }
  return (
    <Link href={href} onClick={() => onClick(href)} className={cls}>
      Ir para a tela <ExternalLink size={11} />
    </Link>
  );
}
