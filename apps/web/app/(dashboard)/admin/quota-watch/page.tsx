'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/quota-watch — Painel operacional Onda 6 (audit-only)
 * --------------------------------------------------------------------
 * Lista todas as organizações em produção com:
 *   - plano + trial flag
 *   - consumo do mês (aiMessagesProcessed) vs limite do plano
 *   - usagePercent (highlight visual quando >50%, >80%, >100%)
 *   - preferências billing declaradas (autoOverage, teto, notify%)
 *   - estado da última reconciliação (lastRunAt, lastAction, notify_pct_*)
 *
 * Auto-refresh 30s. Restrito a SUPERADMIN.
 *
 * Use case operacional:
 *   - Antes de tomar café, abrir e ver o estado de todos os tenants
 *   - Detectar org se aproximando de 100% (visual amarelo/vermelho)
 *   - Confirmar que o cron 04:00 UTC rodou (lastRunAt < 24h)
 *   - Validar que clientes que ativaram autoOverage estão coerentes
 *
 * Sem botão "trigger reconcile per org" inicial — usar endpoint
 * /api/admin/cron/run que processa todas. PR futuro se demanda surgir.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { quotaWatchApi, QuotaWatchResponse, QuotaWatchRow } from '../../../../lib/adminApi';

const REFRESH_INTERVAL_MS = 30_000;

export default function QuotaWatchPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [data, setData] = useState<QuotaWatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Guard de role
  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Fetch + auto-refresh
  useEffect(() => {
    if (user?.role !== 'SUPERADMIN') return;

    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      try {
        const res = await quotaWatchApi.getWatch();
        if (!mounted) return;
        setData(res);
        setError(null);
        setLastRefresh(new Date());
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || 'Erro ao buscar quota-watch');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    timer = setInterval(fetchData, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [user]);

  const manualRefresh = async () => {
    setLoading(true);
    try {
      const res = await quotaWatchApi.getWatch();
      setData(res);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar quota-watch');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'SUPERADMIN') return null;

  // Ordena: maior usagePercent primeiro (mais críticos no topo).
  // Tie-breaker: createdAt desc (signups recentes ganham — útil pra
  // identificar leads parados sem ter mexido na conta).
  const sortedRows = data
    ? [...data.rows].sort((a, b) => {
        const pa = a.consumption.usagePercent ?? -1;
        const pb = b.consumption.usagePercent ?? -1;
        if (pa !== pb) return pb - pa;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="text-primary-500" size={26} />
            Quota Watch
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Painel operacional do audit-only (PR #149) — orgs reais, consumo do mês, estado de reconciliação
            {data?.excludeStaging && data?.stagingFilteredCount ? (
              <span className="ml-2 inline-flex items-center text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {data.stagingFilteredCount} orgs staging ocultas
              </span>
            ) : null}
          </p>
        </div>
        <button
          onClick={manualRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">Falha em /api/admin/quota-watch</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-6 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Período {data.period}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard icon={<Users size={16} />} label="Total Orgs" value={data.summary.totalOrgs} color="blue" />
              <SummaryCard icon={<Zap size={16} />} label="≥ 50%" value={data.summary.orgsAt50Percent} color="amber" />
              <SummaryCard icon={<AlertTriangle size={16} />} label="≥ 80%" value={data.summary.orgsAt80Percent} color="orange" />
              <SummaryCard icon={<AlertCircle size={16} />} label="≥ 100%" value={data.summary.orgsAt100Percent} color="red" />
              <SummaryCard icon={<CheckCircle2 size={16} />} label="Auto-overage ON" value={data.summary.orgsWithAutoOverage} color="green" />
              <SummaryCard icon={<TrendingUp size={16} />} label="Em Trial" value={data.summary.orgsTrialing} color="purple" />
            </div>
          </div>

          {/* Tabela de orgs */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {sortedRows.length} organizações (ordenado por % de uso decrescente)
              </h3>
              <span className="text-xs text-gray-400">Refresh auto a cada 30s</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Org / Owner</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Plano</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Consumo</th>
                    <th className="px-4 py-2.5 text-right font-semibold">% Uso</th>
                    <th className="px-4 py-2.5 text-center font-semibold">AutoOver</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Teto BRL</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Última ação</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Última run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedRows.map((row) => (
                    <OrgRow key={row.organizationId} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>
              Generated: <code className="bg-gray-50 px-1.5 py-0.5 rounded">{data.generatedAt}</code>
            </span>
            {lastRefresh && (
              <span>
                Local refresh:{' '}
                {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'amber' | 'orange' | 'red' | 'green' | 'purple';
}) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    red: 'bg-red-50 border-red-100 text-red-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${bgMap[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function OrgRow({ row }: { row: QuotaWatchRow }) {
  const pct = row.consumption.usagePercent;
  const isOverLimit = pct !== null && pct >= 100;
  const isAtRisk = pct !== null && pct >= 80;
  const isWarming = pct !== null && pct >= 50;

  const rowHighlight = isOverLimit
    ? 'bg-red-50'
    : isAtRisk
      ? 'bg-orange-50'
      : isWarming
        ? 'bg-amber-50'
        : '';

  const pctColor = isOverLimit
    ? 'text-red-700 font-bold'
    : isAtRisk
      ? 'text-orange-700 font-semibold'
      : isWarming
        ? 'text-amber-700'
        : 'text-gray-700';

  const actionBadge = renderActionBadge(row.reconciliation.lastAction);

  return (
    <tr className={rowHighlight}>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 text-[13px]">{row.organizationName}</span>
          {row.owner ? (
            <span className="text-[11px] text-gray-500">
              {row.owner.name} ·{' '}
              <a
                href={`mailto:${row.owner.email}`}
                className="text-primary-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.owner.email}
              </a>
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 font-mono">{row.organizationId.slice(0, 12)}…</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
          {row.plan}
        </span>
        {row.isTrialActive && (
          <span className="ml-1 inline-flex items-center text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
            TRIAL
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-gray-700">
        <div className="text-[13px] font-semibold">{row.consumption.aiMessagesProcessed.toLocaleString('pt-BR')}</div>
        <div className="text-[10px] text-gray-400">
          / {row.consumption.aiMessagesLimit === null ? '∞' : row.consumption.aiMessagesLimit.toLocaleString('pt-BR')}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`text-[14px] ${pctColor}`}>{pct === null ? '—' : `${pct.toFixed(1)}%`}</span>
      </td>
      <td className="px-4 py-3 text-center">
        {row.billing.autoOverage ? (
          <CheckCircle2 size={14} className="inline text-green-600" />
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-[12px] text-gray-700">
        {row.billing.hardCeilingBrl != null ? `R$ ${row.billing.hardCeilingBrl.toLocaleString('pt-BR')}` : '—'}
      </td>
      <td className="px-4 py-3">{actionBadge}</td>
      <td className="px-4 py-3 text-[10px] text-gray-500 font-mono">
        {row.reconciliation.lastRunAt
          ? new Date(row.reconciliation.lastRunAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
          : '—'}
      </td>
    </tr>
  );
}

function renderActionBadge(action: string | null) {
  if (!action || action === 'no_action') {
    return <span className="text-[10px] text-gray-400">no_action</span>;
  }
  const map: Record<string, { bg: string; text: string; label: string }> = {
    notify_only: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'notify_only' },
    would_pause: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'would_pause' },
    would_charge_overage: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'would_charge' },
    over_ceiling: { bg: 'bg-red-100', text: 'text-red-800', label: 'over_ceiling' },
  };
  const cfg = map[action] || { bg: 'bg-gray-100', text: 'text-gray-700', label: action };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold ${cfg.bg} ${cfg.text} px-2 py-0.5 rounded`}>
      {cfg.label}
    </span>
  );
}
