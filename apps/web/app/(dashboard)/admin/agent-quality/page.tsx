'use client';

/* ══════════════════════════════════════════════════════════════════════
 * FASE 2 / V4 (task #241) · /admin/agent-quality
 * --------------------------------------------------------------------
 * Painel admin pra observar saúde de agents ao longo do tempo via
 * AgentEvalRun history (tabela seedada pelo V3.2 + V5 cron diário).
 *
 * V2 (2026-05-13 ajuste UX):
 *   - Fundo claro forçado (consistência com tema executivo)
 *   - Strings 100% em pt-BR
 *   - Polish tipográfico + espaçamento
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

// Traduções de tags técnicas pra display amigável
const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  cron: 'Automático (cron)',
  pre_release: 'Pré-release',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluído',
  running: 'Executando',
  pending: 'Aguardando',
  failed: 'Falhou',
};

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
      setError(err?.message || 'Erro ao buscar histórico de execuções');
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
      setError(err?.message || 'Erro ao buscar detalhes');
    } finally {
      setLoadingDetail(false);
    }
  };

  const triggerRun = async () => {
    if (runs.length === 0) {
      setError('Nenhum agente disponível para testar (espere a primeira execução aparecer)');
      return;
    }
    const agentId = runs[0].agentId;
    setTriggering(true);
    try {
      await agentQualityApi.triggerRun(agentId, { triggeredBy: 'manual' });
      await fetchRuns();
    } catch (err: any) {
      setError(err?.message || 'Erro ao disparar execução');
    } finally {
      setTriggering(false);
    }
  };

  // ─── Computado ──────────────────────────────────────────────
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
        .reverse() // ordem cronológica
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
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Qualidade do Agente</h1>
            <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
              Auditoria contínua de comportamento dos agentes de IA. Avaliação automática diária
              às 04:30 UTC sobre 25 cenários críticos. Alerta no Slack se a pontuação cair abaixo
              de {SCORE_THRESHOLD}% ou houver falha crítica.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={triggerRun}
              disabled={triggering || runs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Play className="w-4 h-4" />
              {triggering ? 'Disparando…' : 'Executar agora'}
            </button>
            <button
              onClick={() => fetchRuns()}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium transition-colors border border-neutral-200 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Última execução"
            value={latestRun ? `${latestRun.scorePercent}%` : '—'}
            sub={
              latestRun
                ? new Date(latestRun.startedAt).toLocaleString('pt-BR')
                : 'sem execuções'
            }
            icon={<Activity className="w-5 h-5" />}
            tone={
              latestRun && (latestRun.scorePercent ?? 0) >= SCORE_THRESHOLD ? 'green' : 'orange'
            }
          />
          <KPICard
            label="Tendência"
            value={trend === 0 ? '—' : `${trend > 0 ? '+' : ''}${trend} pp`}
            sub="vs. execução anterior"
            icon={
              trend >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />
            }
            tone={trend > 0 ? 'green' : trend < 0 ? 'red' : 'neutral'}
          />
          <KPICard
            label="Falhas críticas (última)"
            value={String(latestRun?.criticalFailed ?? '—')}
            sub={
              latestRun?.criticalFailed === 0
                ? 'Cenários P0 protegidos'
                : 'Atenção necessária'
            }
            icon={<AlertTriangle className="w-5 h-5" />}
            tone={(latestRun?.criticalFailed ?? 0) === 0 ? 'green' : 'red'}
          />
          <KPICard
            label="Execuções (30 dias)"
            value={String(runs.length)}
            sub={`${completedRuns.length} concluída${completedRuns.length === 1 ? '' : 's'}`}
            icon={<Clock className="w-5 h-5" />}
            tone="neutral"
          />
        </div>

        {/* Gráfico de pontuação */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Pontuação ao longo do tempo
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Linha vermelha tracejada = limite de alerta ({SCORE_THRESHOLD}%)
              </p>
            </div>
            {lastRefresh && (
              <span className="text-xs text-neutral-500">
                Atualizado às {lastRefresh.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </div>
          {scoreSeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-neutral-500 text-sm">
              {loading
                ? 'Carregando…'
                : 'Nenhuma execução ainda. Clique em "Executar agora" para a primeira.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={scoreSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" fontSize={12} stroke="#6b7280" />
                <YAxis domain={[0, 100]} fontSize={12} stroke="#6b7280" tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === 'score') return [`${value}%`, 'Pontuação'];
                    return [value, name];
                  }}
                />
                <ReferenceLine
                  y={SCORE_THRESHOLD}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `${SCORE_THRESHOLD}% (limite de alerta)`,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: '#ef4444',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ fill: '#2563eb', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela de execuções */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Execuções recentes</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Clique em "ver detalhes" para abrir o relatório completo da execução
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Quando</th>
                  <th className="text-left px-4 py-3 font-medium">Agente</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Origem</th>
                  <th className="text-right px-4 py-3 font-medium">Pontuação</th>
                  <th className="text-right px-4 py-3 font-medium">Falhas críticas</th>
                  <th className="text-right px-4 py-3 font-medium">Duração</th>
                  <th className="text-right px-4 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                      {loading ? 'Carregando…' : 'Nenhuma execução encontrada.'}
                    </td>
                  </tr>
                )}
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-700">
                      {new Date(run.startedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 font-medium">
                      {run.agent?.name || run.agentId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {TRIGGER_LABELS[run.triggeredBy] || run.triggeredBy}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {run.scorePercent != null ? (
                        <span
                          className={
                            run.scorePercent >= SCORE_THRESHOLD
                              ? 'text-green-700'
                              : 'text-orange-600'
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
                            run.criticalFailed === 0 ? 'text-green-700' : 'text-red-700'
                          }
                        >
                          {run.criticalFailed}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-600">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openRunDetail(run.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
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

        {/* Modal de detalhe */}
        {(selectedRun || loadingDetail) && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-end p-4"
            onClick={() => {
              setSelectedRun(null);
              setLoadingDetail(false);
            }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white p-4 border-b border-neutral-200 flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900">
                  Detalhes da execução
                  {selectedRun ? ` · ${selectedRun.scorePercent ?? '—'}%` : ''}
                </h3>
                <button
                  onClick={() => {
                    setSelectedRun(null);
                    setLoadingDetail(false);
                  }}
                  className="text-neutral-500 hover:text-neutral-800 text-xl leading-none"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              <div className="p-4">
                {loadingDetail && <div className="text-sm text-neutral-500">Carregando…</div>}
                {selectedRun && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <KPISmall label="Pontuação" value={`${selectedRun.scorePercent ?? '—'}%`} />
                      <KPISmall
                        label="Falhas críticas"
                        value={String(selectedRun.criticalFailed ?? '—')}
                      />
                      <KPISmall
                        label="Aprovados"
                        value={`${selectedRun.passed ?? 0}/${selectedRun.totalScenarios}`}
                      />
                      <KPISmall
                        label="Duração"
                        value={
                          selectedRun.durationMs
                            ? `${(selectedRun.durationMs / 1000).toFixed(1)}s`
                            : '—'
                        }
                      />
                    </div>
                    <div className="text-xs text-neutral-500">
                      conjunto de testes <code className="font-mono">{selectedRun.evalSetVersion}</code> ·
                      regras universais <code className="font-mono">{selectedRun.coreRulesVersion}</code> ·
                      origem <code className="font-mono">{TRIGGER_LABELS[selectedRun.triggeredBy] || selectedRun.triggeredBy}</code>
                    </div>
                    {selectedRun.results && selectedRun.results.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-neutral-700 mt-2">
                          Cenários com problema
                        </h4>
                        {selectedRun.results
                          .filter((r) => r.combined !== 'pass')
                          .map((r) => (
                            <div
                              key={r.scenarioId}
                              className={`border rounded-lg p-3 text-sm ${
                                r.combined === 'fail'
                                  ? 'border-red-300 bg-red-50'
                                  : 'border-orange-300 bg-orange-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <code className="text-xs text-neutral-700">{r.scenarioId}</code>
                                <ResultBadge combined={r.combined} severity={r.severity} />
                              </div>
                              <div className="text-xs text-neutral-700 mt-1">{r.description}</div>
                              <div className="mt-2 text-xs">
                                <strong>Avaliação:</strong> {r.judge.reason}
                              </div>
                              {r.deterministic.failedPatterns.length > 0 && (
                                <div className="mt-1 text-xs">
                                  <strong>Termos proibidos detectados:</strong>{' '}
                                  <code className="text-xs">
                                    {r.deterministic.failedPatterns.join(', ')}
                                  </code>
                                </div>
                              )}
                              {r.deterministic.missingPatterns.length > 0 && (
                                <div className="mt-1 text-xs">
                                  <strong>Termos esperados ausentes:</strong>{' '}
                                  <code className="text-xs">
                                    {r.deterministic.missingPatterns.join(', ')}
                                  </code>
                                </div>
                              )}
                            </div>
                          ))}
                        {selectedRun.results.every((r) => r.combined === 'pass') && (
                          <div className="text-sm text-green-700 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                            <CheckCircle2 className="w-4 h-4" /> Todos os {selectedRun.totalScenarios}{' '}
                            cenários passaram. Sem regressões.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-500">Sem detalhes disponíveis.</div>
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
      ? 'text-green-700'
      : tone === 'red'
        ? 'text-red-700'
        : tone === 'orange'
          ? 'text-orange-600'
          : 'text-neutral-800';
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-600 font-medium">{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold font-mono ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function KPISmall({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-100 rounded-lg p-3">
      <div className="text-xs text-neutral-600 font-medium">{label}</div>
      <div className="text-lg font-mono font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentEvalRunRow['status'] }) {
  const map: Record<
    typeof status,
    { className: string; label: string; icon: React.ReactNode }
  > = {
    completed: {
      className: 'bg-green-100 text-green-800 border-green-200',
      label: STATUS_LABELS.completed,
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    running: {
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      label: STATUS_LABELS.running,
      icon: <Activity className="w-3 h-3" />,
    },
    pending: {
      className: 'bg-neutral-100 text-neutral-800 border-neutral-200',
      label: STATUS_LABELS.pending,
      icon: <Clock className="w-3 h-3" />,
    },
    failed: {
      className: 'bg-red-100 text-red-800 border-red-200',
      label: STATUS_LABELS.failed,
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  const cfg = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`}
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
  const combinedLabel =
    combined === 'pass' ? 'Aprovado' : combined === 'partial' ? 'Parcial' : 'Reprovado';
  const severityLabel =
    severity === 'critical' ? 'crítica' : severity === 'high' ? 'alta' : 'média';
  const color =
    combined === 'pass'
      ? 'bg-green-100 text-green-800 border-green-200'
      : combined === 'partial'
        ? 'bg-orange-100 text-orange-800 border-orange-200'
        : 'bg-red-100 text-red-800 border-red-200';
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium border ${color}`}>
      {combinedLabel} · {severityLabel}
    </span>
  );
}
