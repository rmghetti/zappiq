'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/llm-health · Dashboard executivo de saúde dos LLMs
 * --------------------------------------------------------------------
 * Versão 2 (FASE 4 follow-up):
 *   - Seleção de período (24h, 7d, 30d, 90d)
 *   - Banner overall health (verde/amarelo/vermelho com ação recomendada)
 *   - Priority Chain visual (cascade ordenada por tier de cliente)
 *   - KPIs com tooltip educativo (o que mede, qual o threshold)
 *   - Tabela detalhada por provider (latência, custo, tokens, erros)
 *   - Gráfico de série temporal (Chart.js via CDN — sem dependência nova)
 *   - Botões "Exportar CSV" e "Exportar JSON" pra integrar com BI/observabilidade
 *   - Auto-refresh 30s
 *
 * SUPERADMIN-only.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, AlertCircle, CheckCircle2, DollarSign, RefreshCw, Zap,
  TrendingUp, AlertTriangle, ArrowRight, ChevronDown, Download, Info,
  ShieldCheck, Cpu,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { llmHealthApi, LLMHealthResponse, LLMHealthPeriod } from '../../../../lib/adminApi';

const REFRESH_INTERVAL_MS = 30_000;

// ── Tradução centralizada (uso em tooltips + tabela) ───────────────────
const PROVIDER_FRIENDLY: Record<string, { name: string; vendor: string; tier: string }> = {
  'anthropic-sonnet': { name: 'Claude Sonnet 4.6', vendor: 'Anthropic', tier: 'Premium' },
  'anthropic-haiku': { name: 'Claude Haiku 4.5', vendor: 'Anthropic', tier: 'Rápido/Barato' },
  'google-gemini-flash': { name: 'Gemini 2.5 Flash', vendor: 'Google', tier: 'Econômico' },
  'openai-mini': { name: 'GPT-4o mini', vendor: 'OpenAI', tier: 'Backup independente' },
};

const METRIC_GLOSSARY: Record<string, { what: string; goodWhen: string; badWhen: string }> = {
  totalCalls: {
    what: 'Quantas vezes algum agente IA foi acionado no período',
    goodWhen: 'Crescimento orgânico — mais conversas',
    badWhen: 'Queda abrupta = possível indisponibilidade do canal de entrada (WhatsApp/IG)',
  },
  totalCostUsd: {
    what: 'Custo estimado de LLM no período (input + output tokens × preço por modelo)',
    goodWhen: 'Proporcional ao volume de calls e à mistura de modelos esperada',
    badWhen: 'Pico súbito sem aumento de calls = uso desproporcional do modelo caro (Sonnet)',
  },
  avgLatencyMs: {
    what: 'Tempo médio entre LLMRouter receber a chamada e devolver resposta',
    goodWhen: '< 3.000ms (Gemini/Haiku) ou < 6.000ms (Sonnet)',
    badWhen: '> 8.000ms = experiência ruim no WhatsApp; investigar fila ou rate limit',
  },
  fallbackRate: {
    what: 'Percentual de chamadas em que o provider primário falhou e a cascade caiu pro fallback',
    goodWhen: '< 1% — cascade saudável',
    badWhen: '> 5% — provider primário em degradação; verificar status do vendor',
  },
  errorRate: {
    what: 'Percentual de chamadas com erro permanente (após retries e cascade exausta)',
    goodWhen: '< 0.5% — usuário recebe resposta de qualidade quase sempre',
    badWhen: '> 2% — usuário começa a perceber quebra; checar quotas/billing',
  },
};

// ── Cores semânticas centralizadas ─────────────────────────────────────
function getHealthColor(value: number, thresholds: { good: number; warn: number }) {
  if (value <= thresholds.good) return 'green';
  if (value <= thresholds.warn) return 'amber';
  return 'red';
}

const COLOR_CLASS: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', ring: 'ring-green-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', ring: 'ring-amber-500' },
  red: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300', ring: 'ring-red-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300', ring: 'ring-blue-500' },
  neutral: { bg: 'bg-neutral-50', text: 'text-neutral-700', border: 'border-neutral-300', ring: 'ring-neutral-400' },
};

export default function LLMHealthPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<LLMHealthPeriod>('24h');
  const [data, setData] = useState<LLMHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  // Guard role
  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  // Fetch + auto-refresh
  useEffect(() => {
    if (user?.role !== 'SUPERADMIN') return;
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const fetchHealth = async () => {
      try {
        const res = await llmHealthApi.getHealth(period);
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
    setLoading(true);
    fetchHealth();
    timer = setInterval(fetchHealth, REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [user, period]);

  // ── Chart.js via CDN (lazy load, sem nova dep no package.json) ──
  useEffect(() => {
    if (!data || !chartRef.current) return;
    const ensureChartJs = async () => {
      if (typeof (window as any).Chart === 'undefined') {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Falha ao carregar Chart.js'));
          document.head.appendChild(s);
        });
      }
      renderChart();
    };
    const renderChart = () => {
      const Chart = (window as any).Chart;
      if (!Chart || !chartRef.current) return;
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      const buckets = data.last24h.hourlyTimeseries;
      const labels = buckets.map((b) =>
        new Date(b.hour).toLocaleString('pt-BR', {
          month: '2-digit', day: '2-digit',
          hour: data.period.bucket === 'hour' ? '2-digit' : undefined,
          minute: data.period.bucket === 'hour' ? '2-digit' : undefined,
        }),
      );
      chartInstance.current = new Chart(chartRef.current.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Chamadas LLM',
              data: buckets.map((b) => b.calls),
              borderColor: 'rgb(37, 99, 235)',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              yAxisID: 'y',
              tension: 0.3,
              fill: true,
            },
            {
              label: 'Latência média (ms)',
              data: buckets.map((b) => b.avgLatencyMs),
              borderColor: 'rgb(168, 85, 247)',
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              yAxisID: 'y1',
              tension: 0.3,
              borderDash: [5, 5],
            },
            {
              label: 'Erros',
              data: buckets.map((b) => b.errors),
              borderColor: 'rgb(220, 38, 38)',
              backgroundColor: 'rgba(220, 38, 38, 0.2)',
              yAxisID: 'y',
              type: 'bar',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'top' } },
          scales: {
            y: { type: 'linear', position: 'left', title: { display: true, text: 'Calls / Erros' } },
            y1: {
              type: 'linear', position: 'right',
              title: { display: true, text: 'Latência (ms)' },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    };
    ensureChartJs().catch((e) => console.error(e));
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data]);

  const manualRefresh = async () => {
    setLoading(true);
    try {
      const res = await llmHealthApi.getHealth(period);
      setData(res);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar status');
    } finally {
      setLoading(false);
    }
  };

  // ── Export helpers ─────────────────────────────────────────────────
  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm-health-${data.period.key}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!data) return;
    // CSV: tabela de providers (calls, latência, custo, erros, error rate)
    const rows = [
      ['Provider', 'Modelo', 'Vendor', 'Calls', 'Latência média (ms)', 'Custo (USD)', 'Tokens entrada', 'Tokens saída', 'Erros', 'Error rate (%)', 'Breaker aberto'],
    ];
    for (const p of data.providers) {
      const enr = data.last24h.byProviderEnriched[p.id];
      const errs = data.last24h.errorsByProvider[p.id] || 0;
      const rate = enr && enr.calls > 0 ? ((errs / enr.calls) * 100).toFixed(2) : '0.00';
      rows.push([
        p.id,
        p.model,
        PROVIDER_FRIENDLY[p.id]?.vendor || '—',
        String(enr?.calls || 0),
        String(enr?.avgLatencyMs || 0),
        enr?.costUsd || '0',
        String(enr?.inputTokens || 0),
        String(enr?.outputTokens || 0),
        String(errs),
        rate,
        p.breakerOpen ? 'SIM' : 'não',
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm-health-providers-${data.period.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (user?.role !== 'SUPERADMIN') return null;

  // ── Overall health computation ──
  const overallHealth = computeOverallHealth(data);

  return (
    <div className="space-y-6 pb-12">
      {/* ─ Header ─ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="text-primary-500" size={26} />
            LLM Health · Dashboard executivo
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado em tempo real dos modelos LLM, cascade de fallback, custos e latências. Atualiza automaticamente a cada 30s.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={manualRefresh} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={exportCSV} disabled={!data}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            title="Baixa CSV com a tabela de providers"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={exportJSON} disabled={!data}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            title="Baixa JSON completo do payload (BI / observabilidade)"
          >
            <Download size={14} /> JSON
          </button>
        </div>
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

      {data && (
        <>
          {/* ─ Overall health banner ─ */}
          <OverallHealthBanner health={overallHealth} period={data.period.label} />

          {/* ─ KPIs principais com tooltip ─ */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Métricas — {data.period.label}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Chamadas totais"
                value={data.last24h.totalCalls.toLocaleString('pt-BR')}
                tooltip={METRIC_GLOSSARY.totalCalls}
                icon={<Zap size={18} />}
                color="blue"
              />
              <KpiCard
                label="Custo estimado"
                value={`US$ ${Number(data.last24h.totalCostUsd).toFixed(2)}`}
                tooltip={METRIC_GLOSSARY.totalCostUsd}
                icon={<DollarSign size={18} />}
                color="blue"
              />
              <KpiCard
                label="Latência média"
                value={`${data.last24h.avgLatencyMs.toLocaleString('pt-BR')} ms`}
                tooltip={METRIC_GLOSSARY.avgLatencyMs}
                icon={<TrendingUp size={18} />}
                color={getHealthColor(data.last24h.avgLatencyMs, { good: 4000, warn: 7000 })}
              />
              <KpiCard
                label="Fallback rate"
                value={`${(data.last24h.fallbackRate * 100).toFixed(2)}%`}
                tooltip={METRIC_GLOSSARY.fallbackRate}
                icon={<AlertTriangle size={18} />}
                color={getHealthColor(data.last24h.fallbackRate * 100, { good: 1, warn: 5 })}
              />
              <KpiCard
                label="Error rate"
                value={`${(data.last24h.errorRate * 100).toFixed(2)}%`}
                tooltip={METRIC_GLOSSARY.errorRate}
                icon={<AlertCircle size={18} />}
                color={getHealthColor(data.last24h.errorRate * 100, { good: 0.5, warn: 2 })}
              />
              <KpiCard
                label="Tokens (entrada+saída)"
                value={`${(data.last24h.totalInputTokens + data.last24h.totalOutputTokens).toLocaleString('pt-BR')}`}
                tooltip={{
                  what: 'Soma de tokens processados pelos LLMs',
                  goodWhen: 'Cresce com volume de conversas',
                  badWhen: 'Pico sem novos clientes = prompt verbose ou loop',
                }}
                icon={<Cpu size={18} />}
                color="blue"
              />
            </div>
          </div>

          {/* ─ Cascade Priority Chain por tier ─ */}
          <CascadePanel cascadeByTier={data.cascadeByTier} providers={data.providers} />

          {/* ─ Tabela detalhada por provider ─ */}
          <ProvidersTable data={data} />

          {/* ─ Gráfico série temporal ─ */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Série temporal — chamadas, latência, erros</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Bucket: {data.period.bucket === 'hour' ? '1 hora' : '1 dia'} · Total {data.last24h.hourlyTimeseries.length} pontos
                </p>
              </div>
            </div>
            <div className="h-72">
              {data.last24h.hourlyTimeseries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  Sem dados no período selecionado
                </div>
              ) : (
                <canvas ref={chartRef} />
              )}
            </div>
          </div>

          {/* ─ Footer ─ */}
          <div className="text-xs text-gray-400 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <span>Generated at: <code className="bg-gray-50 px-1.5 py-0.5 rounded">{data.generatedAt}</code></span>
            {lastRefresh && (
              <span>
                Refresh local: {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ════════════════════════════════════════════════════════════════════

function PeriodSelector({ value, onChange }: { value: LLMHealthPeriod; onChange: (v: LLMHealthPeriod) => void }) {
  const options: Array<{ key: LLMHealthPeriod; label: string }> = [
    { key: '24h', label: 'Últimas 24h' },
    { key: '7d', label: 'Últimos 7 dias' },
    { key: '30d', label: 'Últimos 30 dias' },
    { key: '90d', label: 'Últimos 90 dias' },
  ];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LLMHealthPeriod)}
        className="appearance-none px-3 py-2 pr-8 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
    </div>
  );
}

function computeOverallHealth(data: LLMHealthResponse | null): {
  level: 'good' | 'warn' | 'critical';
  title: string;
  message: string;
  reasons: string[];
} {
  if (!data) {
    return { level: 'good', title: 'Carregando…', message: '', reasons: [] };
  }
  const reasons: string[] = [];
  let level: 'good' | 'warn' | 'critical' = 'good';
  // Sinais críticos
  const breakerOpen = data.providers.filter((p) => p.breakerOpen);
  if (breakerOpen.length > 0) {
    level = 'critical';
    reasons.push(`${breakerOpen.length} provider(s) com circuit breaker ABERTO: ${breakerOpen.map((p) => p.label).join(', ')}`);
  }
  if (data.last24h.errorRate > 0.05) {
    level = 'critical';
    reasons.push(`Error rate em ${(data.last24h.errorRate * 100).toFixed(1)}% (esperado < 0,5%)`);
  }
  if (data.last24h.fallbackRate > 0.1) {
    if (level !== 'critical') level = 'warn';
    reasons.push(`Fallback rate em ${(data.last24h.fallbackRate * 100).toFixed(1)}% — provider primário em degradação`);
  }
  if (data.last24h.avgLatencyMs > 8000) {
    if (level !== 'critical') level = 'warn';
    reasons.push(`Latência média de ${data.last24h.avgLatencyMs}ms — UX comprometida`);
  }
  if (level === 'good') {
    return {
      level,
      title: 'Saudável',
      message: 'Todos os modelos LLM estão operando dentro dos thresholds esperados. Não há ação necessária.',
      reasons: [],
    };
  }
  if (level === 'warn') {
    return {
      level,
      title: 'Atenção',
      message: 'Sinais de degradação detectados. Investigar antes de virar incidente.',
      reasons,
    };
  }
  return {
    level,
    title: 'Crítico',
    message: 'Indicadores fora do limite aceitável. Ação imediata recomendada.',
    reasons,
  };
}

function OverallHealthBanner({ health, period }: { health: ReturnType<typeof computeOverallHealth>; period: string }) {
  const palette = {
    good: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900', icon: <CheckCircle2 className="text-green-600" size={28} /> },
    warn: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-900', icon: <AlertTriangle className="text-amber-600" size={28} /> },
    critical: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-900', icon: <AlertCircle className="text-red-600" size={28} /> },
  }[health.level];
  return (
    <div className={`rounded-xl border-2 p-5 ${palette.bg} ${palette.border}`}>
      <div className="flex items-start gap-4">
        {palette.icon}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={`text-lg font-bold ${palette.text}`}>Status geral: {health.title}</h2>
            <span className={`text-xs ${palette.text} opacity-70`}>· {period}</span>
          </div>
          <p className={`text-sm ${palette.text} mt-1`}>{health.message}</p>
          {health.reasons.length > 0 && (
            <ul className={`mt-3 space-y-1 text-sm ${palette.text}`}>
              {health.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span>•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, tooltip, icon, color,
}: {
  label: string;
  value: string;
  tooltip: { what: string; goodWhen: string; badWhen: string };
  icon: React.ReactNode;
  color: string;
}) {
  const [showTip, setShowTip] = useState(false);
  const c = COLOR_CLASS[color] || COLOR_CLASS.neutral;
  return (
    <div
      className={`relative rounded-xl border ${c.border} ${c.bg} p-3.5 transition-shadow hover:shadow-md`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div className="flex items-start justify-between mb-2">
        <span className={c.text}>{icon}</span>
        <Info size={12} className="text-gray-400" />
      </div>
      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide leading-tight">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${c.text}`}>{value}</div>
      {showTip && (
        <div className="absolute z-10 top-full mt-2 left-0 right-0 min-w-[260px] bg-neutral-900 text-white text-[11px] rounded-lg p-3 shadow-xl">
          <div className="font-semibold mb-1.5 text-white">{label}</div>
          <div className="space-y-1.5">
            <div><span className="text-neutral-400">O que mede:</span> {tooltip.what}</div>
            <div><span className="text-green-400">✓ Saudável:</span> {tooltip.goodWhen}</div>
            <div><span className="text-red-400">⚠ Problema:</span> {tooltip.badWhen}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function CascadePanel({
  cascadeByTier, providers,
}: {
  cascadeByTier: Record<string, string[]>;
  providers: Array<{ id: string; label: string; breakerOpen: boolean; failures: number }>;
}) {
  const providerById = new Map(providers.map((p) => [p.id, p]));
  const tierOrder = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE', 'DEFAULT'];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-600" />
            Cascade de prioridade — quem é acionado primeiro
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Ordem por tier de cliente. Se o primário falhar, o LLMRouter desce automaticamente pra próxima opção.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {tierOrder.filter((t) => cascadeByTier[t]).map((tier) => (
          <div key={tier} className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center justify-center w-24 px-2 py-1 bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-bold uppercase tracking-wider rounded">
              {tier}
            </span>
            {cascadeByTier[tier].map((providerId, idx) => {
              const p = providerById.get(providerId);
              const isPrimary = idx === 0;
              const isOpen = p?.breakerOpen;
              return (
                <div key={providerId} className="flex items-center gap-2">
                  {idx > 0 && <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />}
                  <div
                    className={`flex flex-col px-3 py-2 rounded-lg border-2 ${
                      isOpen
                        ? 'border-red-300 bg-red-50'
                        : isPrimary
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        {isPrimary ? '1º · primário' : `${idx + 1}º fallback`}
                      </span>
                      {isOpen && <AlertCircle size={12} className="text-red-600" />}
                    </div>
                    <span className={`text-xs font-bold ${isOpen ? 'text-red-700' : isPrimary ? 'text-blue-800' : 'text-neutral-700'}`}>
                      {PROVIDER_FRIENDLY[providerId]?.name || providerId}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {PROVIDER_FRIENDLY[providerId]?.vendor || '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvidersTable({ data }: { data: LLMHealthResponse }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-base font-bold text-gray-900">Detalhamento por provider</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Métricas agregadas no período. Linhas em vermelho = breaker aberto. Em amarelo = degradação ativa.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-gray-200">
            <tr className="text-left text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
              <th className="px-4 py-2.5">Provider</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Calls</th>
              <th className="px-4 py-2.5 text-right">Latência</th>
              <th className="px-4 py-2.5 text-right">SLA P95</th>
              <th className="px-4 py-2.5 text-right">Custo</th>
              <th className="px-4 py-2.5 text-right">Tokens</th>
              <th className="px-4 py-2.5 text-right">Erros</th>
              <th className="px-4 py-2.5 text-right">Error rate</th>
              <th className="px-4 py-2.5 text-right">Falhas / Breaker</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((p) => {
              const enr = data.last24h.byProviderEnriched[p.id] || { calls: 0, avgLatencyMs: 0, costUsd: '0', inputTokens: 0, outputTokens: 0 };
              const errs = data.last24h.errorsByProvider[p.id] || 0;
              const errRate = enr.calls > 0 ? (errs / enr.calls) * 100 : 0;
              const sla = data.slaThresholds[p.id];
              const friendly = PROVIDER_FRIENDLY[p.id] || { name: p.label, vendor: '—', tier: '' };
              const latencyOk = sla ? enr.avgLatencyMs <= sla.latencyP95Ms : true;
              const errOk = sla ? errRate / 100 <= sla.maxErrorRate : true;
              const rowClass = p.breakerOpen
                ? 'bg-red-50/40 hover:bg-red-50'
                : !latencyOk || !errOk
                  ? 'bg-amber-50/40 hover:bg-amber-50'
                  : 'hover:bg-neutral-50';
              return (
                <tr key={p.id} className={`border-b border-gray-100 transition-colors ${rowClass}`}>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{friendly.name}</div>
                    <div className="text-[11px] text-gray-500 font-mono">{p.id}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{friendly.vendor} · {friendly.tier}</div>
                  </td>
                  <td className="px-4 py-3">
                    {p.breakerOpen ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                        <AlertCircle size={11} /> BREAKER
                      </span>
                    ) : p.failures > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                        <AlertTriangle size={11} /> Degradado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
                        <CheckCircle2 size={11} /> OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{enr.calls.toLocaleString('pt-BR')}</td>
                  <td className={`px-4 py-3 text-right font-mono ${!latencyOk ? 'text-red-700 font-bold' : 'text-gray-700'}`}>
                    {enr.avgLatencyMs.toLocaleString('pt-BR')} ms
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">
                    {sla ? `≤ ${sla.latencyP95Ms.toLocaleString('pt-BR')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">US$ {Number(enr.costUsd).toFixed(4)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {(enr.inputTokens + enr.outputTokens).toLocaleString('pt-BR')}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${errs > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                    {errs}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${!errOk ? 'text-red-700 font-bold' : 'text-gray-700'}`}>
                    {errRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {p.failures}/3
                    {p.breakerOpen && p.openUntil && (
                      <div className="text-[10px] text-red-700">
                        até {new Date(p.openUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
