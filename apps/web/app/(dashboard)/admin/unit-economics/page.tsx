'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { adminApi, TenantUsageSummaryResponse, TenantSummaryRow } from '../../../../lib/adminApi';
import { MetricCard } from './MetricCard';
import { TenantDrawer } from './TenantDrawer';
import { currentYearMonth } from '../../../../lib/dateUtils';

export default function UnitEconomicsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Segurança: redirecionamento se não for SUPERADMIN
  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Estado geral
  const [data, setData] = useState<TenantUsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(currentYearMonth());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'margin' | 'revenue'>('margin');

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<{
    id: string;
    name: string;
    plan: string;
  } | null>(null);
  const [drawerData, setDrawerData] = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Últimos 6 meses para select de período
  const monthOptions = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      months.push(`${y}-${m}`);
    }
    return months;
  }, []);

  // Fetch dados de resumo
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await adminApi.getTenantUsageSummary(period);
        setData(response);
      } catch (err: any) {
        setError(err.message || 'Erro ao buscar dados');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'SUPERADMIN') {
      fetchData();
    }
  }, [period, user]);

  // Abrir drawer
  const handleOpenTenant = async (tenant: TenantSummaryRow) => {
    setSelectedTenant({
      id: tenant.organizationId,
      name: tenant.organizationName,
      plan: tenant.plan,
    });
    setDrawerOpen(true);
    setDrawerLoading(true);

    try {
      const detail = await adminApi.getTenantUsageDetail(tenant.organizationId, period);
      setDrawerData(detail);
    } catch (err: any) {
      console.error('Erro ao buscar detalhe do tenant:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Filtrar e ordenar
  const filteredAndSorted = useMemo(() => {
    if (!data?.rows) return [];

    let filtered = data.rows.filter((row) =>
      row.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      if (sortBy === 'margin') {
        const aMargin = a.grossMarginPercent ?? -Infinity;
        const bMargin = b.grossMarginPercent ?? -Infinity;
        return aMargin - bMargin; // piores primeiro
      } else {
        return b.revenueBrl - a.revenueBrl; // maior receita primeiro
      }
    });

    return filtered;
  }, [data?.rows, searchTerm, sortBy]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredAndSorted.length) return;

    const headers = [
      'Organização',
      'Plano',
      'Mensagens IA',
      'Custo LLM (USD)',
      'Receita (BRL)',
      'Margem (%)',
      'Status',
    ];

    const rows = filteredAndSorted.map((row) => {
      const margin = row.grossMarginPercent ?? -1;
      const status =
        margin < 0 ? 'danger' : margin < 50 ? 'alert' : 'ok';

      return [
        row.organizationName,
        row.plan,
        row.aiMessagesProcessed,
        row.llmCostUsd.toFixed(2),
        row.revenueBrl.toFixed(2),
        margin >= 0 ? margin.toFixed(2) : 'N/A',
        status,
      ];
    });

    const csv =
      [headers, ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join(
        '\n'
      ) + '\n';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `unit-economics-${period}.csv`
    );
    link.click();
  };

  // Render
  if (user?.role !== 'SUPERADMIN') {
    return null; // AuthGuard vai redirecionar, mas por segurança não renderizamos nada
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Unit Economics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Métricas agregadas de receita, custo e margem por tenant
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!filteredAndSorted.length}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
        >
          <Download size={18} />
          Exportar CSV
        </button>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Período
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar organização
          </label>
          <input
            type="text"
            placeholder="Nome da org..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ordenar por
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="margin">Margem (piores primeiro)</option>
            <option value="revenue">Receita (maior primeiro)</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-red-900">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-red-700 hover:text-red-900 underline mt-1"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      {!error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="MRR Estimado (BRL)"
            value={`R$ ${data?.totals.revenueBrl?.toFixed(2) ?? '—'}`}
            icon={DollarSign}
            loading={loading}
          />
          <MetricCard
            label="Margem Bruta Média (%)"
            value={
              !loading && data?.rows
                ? `${(
                    data.rows.reduce(
                      (sum, r) => sum + (r.grossMarginPercent ?? 0),
                      0
                    ) / Math.max(data.rows.length, 1)
                  ).toFixed(1)}%`
                : '—'
            }
            loading={loading}
          />
          <MetricCard
            label="Tenants Ativos"
            value={data?.totals.tenants ?? '—'}
            icon={Users}
            loading={loading}
          />
          <MetricCard
            label="Tenants em Trial"
            value={
              !loading && data?.rows
                ? data.rows.filter((r) => r.isTrialActive).length
                : '—'
            }
            loading={loading}
          />
          <MetricCard
            label="Custo LLM (USD)"
            value={`$${data?.totals.llmCostUsd?.toFixed(2) ?? '—'}`}
            icon={Zap}
            loading={loading}
          />
          <MetricCard
            label="Custo Infra (USD)"
            value={`$${data?.totals.infraCostUsd?.toFixed(2) ?? '—'}`}
            loading={loading}
          />
        </div>
      )}

      {/* Tabela */}
      {!error && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm font-medium">
                {data?.rows?.length === 0
                  ? 'Nenhum tenant ativo neste período'
                  : 'Nenhum resultado encontrado'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                      Organização
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                      Plano
                    </th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">
                      Mensagens IA
                    </th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">
                      Custo LLM (USD)
                    </th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">
                      Receita (BRL)
                    </th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">
                      Margem (%)
                    </th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-900">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSorted.map((row) => {
                    const margin = row.grossMarginPercent ?? -1;
                    let statusColor = 'bg-green-100 text-green-800';
                    let statusLabel = 'OK';

                    if (margin < 0) {
                      statusColor = 'bg-red-100 text-red-800';
                      statusLabel = 'Negativa';
                    } else if (margin < 50) {
                      statusColor = 'bg-orange-100 text-orange-800';
                      statusLabel = 'Alerta';
                    }

                    return (
                      <tr
                        key={row.organizationId}
                        onClick={() => handleOpenTenant(row)}
                        className="hover:bg-primary-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 text-gray-900 font-medium">
                          {row.organizationName}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded">
                            {row.plan}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {row.aiMessagesProcessed.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          ${row.llmCostUsd.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600 font-medium">
                          R$ {row.revenueBrl.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          {margin >= 0 ? `${margin.toFixed(1)}%` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      {selectedTenant && (
        <TenantDrawer
          isOpen={drawerOpen}
          tenantId={selectedTenant.id}
          tenantName={selectedTenant.name}
          tenantPlan={selectedTenant.plan}
          onClose={() => setDrawerOpen(false)}
          data={drawerData}
          loading={drawerLoading}
        />
      )}
    </div>
  );
}
