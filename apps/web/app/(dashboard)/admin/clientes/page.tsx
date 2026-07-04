'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/clientes — Visão Geral (Área Clientes / Fase 2, §2/§3).
 * --------------------------------------------------------------------
 * KPI-bar (6 cards, reusa MetricCard) + abas por lifecycleStage + tabela
 * clicável (abre o 360 no AccountDrawer) + busca/filtro/ordenação/toggle
 * staging/export CSV. MRR real honesto (nunca fantasma).
 *
 * Guard de role repetido (o AuthGuard do layout só valida autenticação).
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, UserCheck, DollarSign, AlertTriangle, Activity,
  Download, RefreshCw, AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { MetricCard } from '../unit-economics/MetricCard';
import { AccountDrawer } from './AccountDrawer';
import {
  clientesApi,
  ClientesListResponse,
  ClienteAccountRow,
  ClienteDetailResponse,
  UiLifecycleStage,
} from '../../../../lib/adminApi';

const REFRESH_MS = 60_000;

type Tab = 'TODOS' | UiLifecycleStage;

const TABS: { key: Tab; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PAGO', label: 'Ativos' },
  { key: 'EM_TRIAL', label: 'Em trial' },
  { key: 'TRIAL_EXPIRADO', label: 'Trial expirado' },
  { key: 'PAST_DUE', label: 'Inadimplentes' },
  { key: 'CHURNED', label: 'Churn' },
  { key: 'NOVO', label: 'Leads' },
];

const stageBadge: Record<string, { label: string; cls: string }> = {
  NOVO: { label: 'Novo', cls: 'bg-blue-100 text-blue-800' },
  EM_TRIAL: { label: 'Em trial', cls: 'bg-purple-100 text-purple-800' },
  PAGO: { label: 'Pago', cls: 'bg-green-100 text-green-800' },
  ATIVO: { label: 'Pago', cls: 'bg-green-100 text-green-800' },
  TRIAL_EXPIRADO: { label: 'Trial expirado', cls: 'bg-orange-100 text-orange-800' },
  PAST_DUE: { label: 'Inadimplente', cls: 'bg-red-100 text-red-800' },
  CHURNED: { label: 'Churn', cls: 'bg-gray-200 text-gray-700' },
};

const healthDot: Record<string, string> = {
  green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500',
};

type SortBy = 'health' | 'mrr' | 'lastUse' | 'trial';

export default function ClientesVisaoGeralPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [data, setData] = useState<ClientesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('TODOS');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('health');
  const [includeStaging, setIncludeStaging] = useState(false);

  // Drawer 360
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClienteDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  const fetchData = useMemo(
    () => async () => {
      try {
        const res = await clientesApi.getList({ includeStaging });
        setData(res);
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Erro ao buscar clientes');
      } finally {
        setLoading(false);
      }
    },
    [includeStaging],
  );

  useEffect(() => {
    if (user?.role !== 'SUPERADMIN') return;
    let mounted = true;
    setLoading(true);
    fetchData();
    const t = setInterval(() => mounted && fetchData(), REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [user, fetchData]);

  const openDrawer = async (row: ClienteAccountRow) => {
    const id = row.organizationId || row.crmAccountId;
    if (!id) return;
    setSelectedId(id);
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await clientesApi.getDetail(id);
      setDetail(d);
    } catch (err) {
      console.error('Erro 360:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const plans = useMemo(() => {
    const s = new Set<string>();
    data?.rows.forEach((r) => r.plan && s.add(r.plan));
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data?.rows) return [];
    let rows = data.rows;
    if (tab !== 'TODOS') {
      rows = rows.filter((r) => (tab === 'PAGO' ? r.stage === 'PAGO' || r.stage === 'ATIVO' : r.stage === tab));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.name ?? '').toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.company ?? '').toLowerCase().includes(q) ||
          (r.cnpj ?? '').toLowerCase().includes(q),
      );
    }
    if (planFilter) rows = rows.filter((r) => r.plan === planFilter);

    const sorted = [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'mrr':
          return b.mrrCents - a.mrrCents;
        case 'lastUse':
          return (
            new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime()
          );
        case 'trial': {
          const av = a.trialDaysLeft ?? Infinity;
          const bv = b.trialDaysLeft ?? Infinity;
          return av - bv;
        }
        case 'health':
        default:
          return a.healthScore - b.healthScore; // piores primeiro (sinal de ação)
      }
    });
    return sorted;
  }, [data, tab, search, planFilter, sortBy]);

  const tabCount = (t: Tab): number => {
    if (!data) return 0;
    if (t === 'TODOS') return data.rows.length;
    if (t === 'PAGO') return (data.kpis.byStage.PAGO ?? 0) + (data.kpis.byStage.ATIVO ?? 0);
    return data.kpis.byStage[t as UiLifecycleStage] ?? 0;
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ['Cliente', 'Email', 'Empresa', 'CNPJ', 'Estágio', 'Plano', 'MRR (R$)', 'Health', 'Trial expira (d)', 'Último uso', 'Engajou', 'Owner'];
    const lines = filtered.map((r) => [
      r.name ?? '', r.email, r.company ?? '', r.cnpj ?? '',
      r.stage, r.plan ?? '', (r.mrrCents / 100).toFixed(2),
      r.healthScore, r.trialDaysLeft ?? '', r.lastActivityAt ?? '',
      r.engaged ? 'sim' : 'não', r.ownerUserId ?? '',
    ]);
    const csv = [headers, ...lines].map((l) => l.map((v) => `"${v}"`).join(',')).join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  if (user?.role !== 'SUPERADMIN') return null;

  const k = data?.kpis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-primary-500" size={26} />
            Clientes — Visão Geral
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Base instalada · ciclo de vida derivado · MRR real (honesto)
            {data?.stagingFilteredCount ? (
              <span className="ml-2 inline-flex items-center text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {data.stagingFilteredCount} staging ocultas
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-900">{error}</p>
        </div>
      )}

      {/* KPI-bar (6 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Contas ativas" value={k?.contasAtivas ?? '—'} icon={UserCheck} loading={loading} />
        <MetricCard
          label="Em trial"
          value={
            loading || !k ? '—' : `${k.emTrial}${k.trialVencendo ? ` · ${k.trialVencendo}≤3d` : ''}`
          }
          icon={Activity}
          loading={loading}
        />
        <MetricCard label="Novos leads 7d" value={k?.novosLeads7d ?? '—'} icon={Users} loading={loading} />
        <MetricCard
          label="MRR real"
          value={loading || !k ? '—' : `R$ ${(k.mrrRealCents / 100).toFixed(2)}`}
          icon={DollarSign}
          loading={loading}
        />
        <MetricCard label="Contas em risco" value={k?.contasEmRisco ?? '—'} icon={AlertTriangle} loading={loading} />
        <MetricCard label="Health médio" value={k?.healthMedio ?? '—'} loading={loading} />
      </div>

      {/* Abas por estágio */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label} <span className="text-xs text-gray-400">({tabCount(t.key)})</span>
          </button>
        ))}
      </div>

      {/* Controles */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
          <input
            type="text"
            placeholder="Nome, email, empresa, CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Plano</label>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Todos</option>
            {plans.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ordenar</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="health">Health (piores primeiro)</option>
            <option value="mrr">MRR (maior primeiro)</option>
            <option value="lastUse">Último uso</option>
            <option value="trial">Trial expira</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-2 cursor-pointer">
          <input type="checkbox" checked={includeStaging} onChange={(e) => setIncludeStaging(e.target.checked)} />
          Incluir staging
        </label>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nenhuma conta neste filtro</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Health</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Estágio</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Plano</th>
                  <th className="px-4 py-2.5 text-right font-semibold">MRR</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Trial</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Último uso</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Engajou?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => {
                  const badge = stageBadge[r.stage] ?? stageBadge.NOVO;
                  const trialAlert = r.trialDaysLeft != null && r.trialDaysLeft >= 0 && r.trialDaysLeft <= 3;
                  return (
                    <tr
                      key={r.crmAccountId ?? r.organizationId ?? r.email}
                      onClick={() => openDrawer(r)}
                      className="hover:bg-primary-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 text-[13px]">{r.name || r.email}</span>
                          <span className="text-[11px] text-gray-500">{r.email}</span>
                          {r.company && <span className="text-[10px] text-gray-400">{r.company}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                          <span className={`w-2.5 h-2.5 rounded-full ${healthDot[r.healthColor]}`} />
                          {r.healthScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{r.plan ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium">
                        {r.mrrCents > 0 ? `R$ ${(r.mrrCents / 100).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.trialDaysLeft == null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={`text-xs font-semibold ${trialAlert ? 'text-red-600' : 'text-gray-600'}`}>
                            {r.trialDaysLeft < 0 ? 'expirou' : `${r.trialDaysLeft}d`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-500">
                        {r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.engaged ? (
                          <span className="text-green-600 text-xs font-semibold">sim</span>
                        ) : (
                          <span className="text-gray-400 text-xs">não</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer 360 */}
      {selectedId && (
        <AccountDrawer
          isOpen={drawerOpen}
          accountId={selectedId}
          onClose={() => setDrawerOpen(false)}
          data={detail}
          loading={detailLoading}
          onOwnerChanged={() => { fetchData(); }}
        />
      )}
    </div>
  );
}
