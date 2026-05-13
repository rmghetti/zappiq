'use client';

/* ══════════════════════════════════════════════════════════════════════
 * FASE 2 / V4 (task #241) · /admin/agent-quality
 * --------------------------------------------------------------------
 * Painel admin pra observar saúde de agents ao longo do tempo via
 * AgentEvalRun history (tabela seedada pelo V3.2 + V5 cron diário).
 *
 * Visualiza:
 *   - Score over time (line chart das últimas 30 runs)
 *   - KPI cards: última run (score, criticalFailed, duração)
 *   - Tabela de runs recentes (status + trigger + score + duração)
 *   - Drill-down: clica numa run pra ver breakdown por cenário
 *   - Botão "Rodar Agora" → dispara run-async
 *
 * Acesso restrito SUPERADMIN (mesmo guard de /admin/llm-health).
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import {
  agentQualityApi,
  type AgentEvalRunRow,
  type AgentEvalRunDetail,
} from '../../../../lib/adminApi';

const REFRESH_INTERVAL_MS = 60_000;
const SCORE_THRESHOLD = 90;

export default function AgentQualityPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [runs, setRuns] = useState<AgentEvalRunRow[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgentEvalRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [triggering, setTriggering] = useState(false);

  // Guard de role
  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchRuns = async () => {
    try {
      const res = await agentQualityApi.getRuns({ limit: 30 });
      setRuns(res.runs);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'SUPERADMIN') return;
    fetchRuns();
    const timer = setInterval(fetchRuns, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openRunDetail = async (runId: string) => {
    setLoadingDetail(true);
    setSelectedRun(null);
    try {
      const detail = await agentQualityApi.getRunDetail(runId, true);
      setSelectedRun(detail);
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar detalhe');
    } finally {
      setLoadingDetail(false);
    }
  };

  const triggerRun = async () => {
    if (runs.length === 0) {
      setError('Sem agent disponível para disparar (espere a primeira run aparecer)');
      return;
    }
    const agentId = runs[0].agentId;
    setTriggering(true);
    try {
      await agentQualityApi.triggerRun(agentId, { triggeredBy: 'manual' });
      await fetchRuns();
    } catch (err: any) {
      setError(err?.message || 'Erro ao disparar run');
    } finally {
      setTriggering(false);
    }
  };

  // ─── Computed ───────────────────────────────────────────────
  const completedRuns = useMemo(
    () => runs.filter((r) => r.status === 'completed' && r.scorePercent != null),
    [runs],
  );

  const latestRun = completedRuns[0];
  const previousRun = completedRuns[1];

  const scoreSeries = useMemo(
    () =>
      completedRuns
        .slice()
        .reverse() // chronological order
        .map((r) => ({
          label: new Date(r.startedAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          }),
          score: r.scorePercent ?? 0,
          critical: r.criticalFailed ?? 0,
          runId: r.id,
        })),
    [completedRuns],
  );

  const trend =
    latestRun && previousRun && latestRun.scorePercent != null && previousRun.scorePercent != null
      ? latestRun.scorePercent - previousRun.scorePercent
      : 0;

  if (user?.role !== 'SUPERADMIN') return null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Agent Quality
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Histórico de eval contínuo dos agents. Cron diário 04:30 UTC + on-demand.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={triggerRun}
              disabled={triggering || runs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              {triggering ? 'Disparando…' : 'Rodar Agora'}
            </button>
            <button
              onClick={() => fetchRuns()}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 dark:text-red-300">{error}</div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            label="Última run"
            value={latestRun ? `${latestRun.scorePercent}%` : '—'}
            sub={latestRun ? new Date(latestRun.startedAt).toLocaleString('pt-BR') : 'sem runs'}
            icon={<Activity className="w-5 h-5" />}
            tone={
              latestRun && (latestRun.scorePercent ?? 0) >= SCORE_THRESHOLD ? 'green' : 'orange'
            }
          />
          <KPICard
            label="Tendência"
            value={trend === 0 ? '—' : `${trend > 0 ? '+' : ''}${trend} pp`}
            sub="vs run anterior"
            icon={trend >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            tone={trend > 0 ? 'green' : trend < 0 ? 'red' : 'neutral'}
          />
          <KPICard
            label="Critical Failed (última)"
            value={String(latestRun?.criticalFailed ?? '—')}
            sub={latestRun?.criticalFailed === 0 ? 'P0 protegido' : 'alerta ativo'}
            icon={<AlertTriangle className="w-5 h-5" />}
            tone={(latestRun?.criticalFailed ?? 0) === 0 ? 'green' : 'red'}
          />
          <KPICard
            label="Total Runs (30d)"
            value={String(runs.length)}
            sub={completedRuns.length + ' completas'}
            icon={<Clock className="w-5 h-5" />}
            tone="neutral"
          />
        </div>

        {/* Score over time chart */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Score over time
            </h2>
            {lastRefresh && (
              <span className="text-xs text-neutral-500">
                último refresh: {lastRefresh.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </div>
          {scoreSeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-neutral-500 text-sm">
              {loading ? 'Carregando…' : 'Sem runs ainda. Dispare a primeira via "Rodar Agora".'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={scoreSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" />
                <XAxis dataKey="label" fontSize={12} stroke="#9ca3af" />
                <YAxis domain={[0, 100]} fontSize={12} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine
                  y={SCORE_THRESHOLD}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `${SCORE_THRESHOLD}% (alerta)`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Runs table */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Runs recentes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Quando</th>
                  <th className="text-left px-4 py-3 font-medium">Agent</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Trigger</th>
                  <th className="text-right px-4 py-3 font-medium">Score</th>
                  <th className="text-right px-4 py-3 font-medium">Critical</th>
                  <th className="text-right px-4 py-3 font-medium">Duração</th>
                  <th className="text-right px-4 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                      {loading ? 'Carregando…' : 'Nenhuma run encontrada.'}
                    </td>
                  </tr>
                )}
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  >
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {new Date(run.startedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {run.agent?.name || run.agentId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      <code className="text-xs">{run.triggeredBy}</code>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {run.scorePercent != null ? (
                        <span
                          className={
                            run.scorePercent >= SCORE_THRESHOLD
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }
                        >
                          {run.scorePercent}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {run.criticalFailed != null ? (
                        <span
                          className={
                            run.criticalFailed === 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {run.criticalFailed}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openRunDetail(run.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drawer/Modal detalhe */}
        {(selectedRun || loadingDetail) && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-end p-4"
            onClick={() => {
              setSelectedRun(null);
              setLoadingDetail(false);
            }}
          >
            <div
              className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-neutral-900 p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Run detail {selectedRun ? `· ${selectedRun.scorePercent ?? '—'}%` : ''}
                </h3>
                <button
                  onClick={() => {
                    setSelectedRun(null);
                    setLoadingDetail(false);
                  }}
                  className="text-neutral-500 hover:text-neutral-700"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                {loadingDetail && <div className="text-sm text-neutral-500">Carregando…</div>}
                {selectedRun && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <KPISmall label="Score" value={`${selectedRun.scorePercent ?? '—'}%`} />
                      <KPISmall label="Critical" value={String(selectedRun.criticalFailed ?? '—')} />
                      <KPISmall label="Passed" value={`${selectedRun.passed ?? 0}/${selectedRun.totalScenarios}`} />
                      <KPISmall label="Duração" value={selectedRun.durationMs ? `${(selectedRun.durationMs / 1000).toFixed(1)}s` : '—'} />
                    </div>
                    <div className="text-xs text-neutral-500">
                      eval set <code>{selectedRun.evalSetVersion}</code> · core rules{' '}
                      <code>{selectedRun.coreRulesVersion}</code> · trigger{' '}
                      <code>{selectedRun.triggeredBy}</code>
                    </div>
                    {selectedRun.results && selectedRun.results.length > 0 ? (
                      <div className="space-y-2">
                        {selectedRun.results
                          .filter((r) => r.combined !== 'pass')
                          .map((r) => (
                            <div
                              key={r.scenarioId}
                              className={`border rounded-lg p-3 text-sm ${
                                r.combined === 'fail'
                                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40'
                                  : 'border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <code className="text-xs">{r.scenarioId}</code>
                                <ResultBadge combined={r.combined} severity={r.severity} />
                              </div>
                              <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                                {r.description}
                              </div>
                              <div className="mt-2 text-xs">
                                <strong>Judge:</strong> {r.judge.reason}
                              </div>
                              {r.deterministic.failedPatterns.length > 0 && (
                                <div className="mt-1 text-xs">
                                  <strong>Failed patterns:</strong>{' '}
                                  <code className="text-xs">
                                    {r.deterministic.failedPatterns.join(', ')}
                                  </code>
                                </div>
                              )}
                              {r.deterministic.missingPatterns.length > 0 && (
                                <div className="mt-1 text-xs">
                                  <strong>Missing patterns:</strong>{' '}
                                  <code className="text-xs">
                                    {r.deterministic.missingPatterns.join(', ')}
                                  </code>
                                </div>
                              )}
                            </div>
                          ))}
                        {selectedRun.results.every((r) => r.combined === 'pass') && (
                          <div className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Todos os cenários passaram. Nada
                            pra investigar.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-500">Sem results detalhados.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: 'green' | 'red' | 'orange' | 'neutral';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : tone === 'orange'
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-neutral-700 dark:text-neutral-300';
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold font-mono ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function KPISmall({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-mono font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentEvalRunRow['status'] }) {
  const map: Record<typeof status, { className: string; label: string; icon: React.ReactNode }> = {
    completed: {
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      label: 'completed',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    running: {
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      label: 'running',
      icon: <Activity className="w-3 h-3" />,
    },
    pending: {
      className: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200',
      label: 'pending',
      icon: <Clock className="w-3 h-3" />,
    },
    failed: {
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      label: 'failed',
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  const cfg = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function ResultBadge({
  combined,
  severity,
}: {
  combined: 'pass' | 'partial' | 'fail';
  severity: string;
}) {
  const color =
    combined === 'pass'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : combined === 'partial'
        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${color}`}>
      {combined} · {severity}
    </span>
  );
}
