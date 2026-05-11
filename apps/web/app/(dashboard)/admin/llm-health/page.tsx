'use client';

/* ══════════════════════════════════════════════════════════════════════
 * PR #135-alt · /admin/llm-health
 * --------------------------------------------------------------------
 * Painel admin pra observar saúde dos providers LLM em tempo real:
 *   - Estado dos circuit breakers (Redis-backed, PR #134 / V4-003)
 *   - Métricas 24h: total calls, custo, latência, taxa de fallback
 *   - Distribuição de chamadas por provider
 *
 * Auto-refresh a cada 30s. Acesso restrito a SUPERADMIN — mesmo padrão
 * de /admin/unit-economics.
 *
 * Use case operacional:
 *   - Confirmar que circuit breaker está saudável após deploy
 *   - Detectar visualmente provider quebrado (breakerOpen=true)
 *   - Monitorar fallback rate (alto = problema com primário)
 *   - Independente de Grafana — fonte direta da API.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  Zap,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { llmHealthApi, LLMHealthResponse } from '../../../../lib/adminApi';

const REFRESH_INTERVAL_MS = 30_000;

export default function LLMHealthPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [data, setData] = useState<LLMHealthResponse | null>(null);
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

    const fetchHealth = async () => {
      try {
        const res = await llmHealthApi.getHealth();
        if (!mounted) return;
        setData(res);
        setError(null);
        setLastRefresh(new Date());
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || 'Erro ao buscar status');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchHealth();
    timer = setInterval(fetchHealth, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [user]);

  const manualRefresh = async () => {
    setLoading(true);
    try {
      const res = await llmHealthApi.getHealth();
      setData(res);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar status');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'SUPERADMIN') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="text-primary-500" size={26} />
            LLM Health
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado em tempo real dos providers + circuit breakers (Redis-backed) — atualiza a cada 30s
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
            <p className="text-sm font-semibold text-red-900">Falha ao consultar /api/admin/llm-health</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Métricas agregadas 24h */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Últimas 24h
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<Zap size={18} className="text-blue-600" />}
                label="Chamadas totais"
                value={data.last24h.totalCalls.toLocaleString('pt-BR')}
                color="blue"
              />
              <MetricCard
                icon={<DollarSign size={18} className="text-green-600" />}
                label="Custo estimado"
                value={`US$ ${Number(data.last24h.totalCostUsd).toFixed(2)}`}
                color="green"
              />
              <MetricCard
                icon={<TrendingUp size={18} className="text-purple-600" />}
                label="Latência média"
                value={`${data.last24h.avgLatencyMs.toLocaleString('pt-BR')} ms`}
                color="purple"
              />
              <MetricCard
                icon={
                  data.last24h.fallbackRate > 0.05 ? (
                    <AlertTriangle size={18} className="text-orange-600" />
                  ) : (
                    <CheckCircle2 size={18} className="text-green-600" />
                  )
                }
                label="Fallback rate"
                value={`${(data.last24h.fallbackRate * 100).toFixed(2)}%`}
                hint={data.last24h.fallbackRate > 0.05 ? 'Acima do esperado' : 'Saudável'}
                color={data.last24h.fallbackRate > 0.05 ? 'orange' : 'green'}
              />
            </div>
          </div>

          {/* Providers (circuit breakers) */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Providers — Circuit Breakers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  callsLast24h={data.last24h.byProvider[p.id] ?? 0}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-400 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span>
              Generated at: <code className="bg-gray-50 px-1.5 py-0.5 rounded">{data.generatedAt}</code>
            </span>
            {lastRefresh && (
              <span>
                Refresh local:{' '}
                {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-componentes (inline pra simplicidade) ────────────────────────

function MetricCard({
  icon,
  label,
  value,
  hint,
  color = 'blue',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    purple: 'bg-purple-50 border-purple-100',
    orange: 'bg-orange-50 border-orange-100',
  };
  return (
    <div className={`rounded-xl border p-5 ${bgMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

function ProviderCard({
  provider,
  callsLast24h,
}: {
  provider: { id: string; label: string; model: string; breakerOpen: boolean; failures: number; openUntil: number | null };
  callsLast24h: number;
}) {
  const isOpen = provider.breakerOpen;
  const hasFailures = provider.failures > 0;

  const statusBadge = isOpen
    ? { label: 'BREAKER ABERTO', bg: 'bg-red-100 text-red-700 border-red-200', icon: <AlertCircle size={14} /> }
    : hasFailures
      ? { label: 'DEGRADADO', bg: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertTriangle size={14} /> }
      : { label: 'SAUDÁVEL', bg: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 size={14} /> };

  return (
    <div className={`bg-white rounded-xl border p-5 ${isOpen ? 'border-red-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">{provider.label}</h3>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{provider.model}</p>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${statusBadge.bg}`}>
          {statusBadge.icon}
          {statusBadge.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
        <div>
          <p className="text-[10px] text-gray-400 uppercase">Falhas atuais</p>
          <p className={`text-lg font-bold ${hasFailures ? 'text-orange-600' : 'text-gray-700'}`}>
            {provider.failures}/3
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase">Calls 24h</p>
          <p className="text-lg font-bold text-gray-700">{callsLast24h.toLocaleString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase">Aberto até</p>
          <p className="text-xs font-mono text-gray-700">
            {provider.openUntil
              ? new Date(provider.openUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : '—'}
          </p>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 -mx-5 -mb-5 px-5 py-3 rounded-b-xl">
          <p className="text-xs text-red-700">
            <strong>Circuit aberto:</strong> LLMRouter está pulando este provider e usando o próximo da cascade. Auto-recupera quando o openUntil expirar.
          </p>
        </div>
      )}
    </div>
  );
}
