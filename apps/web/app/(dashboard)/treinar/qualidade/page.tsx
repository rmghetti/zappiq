'use client';

/**
 * /treinar/qualidade — Qualidade da IA (versão CLIENTE) · FASE 2.2b #244
 *
 * Replica funcionalidade do /admin/agent-quality mas em linguagem
 * executiva e com RLS forçada por org no backend.
 *
 * Diferenças do admin:
 *   • Cliente só vê o(s) agente(s) da própria org.
 *   • Score percent traduzido pra "Bom / Atenção / Crítico" (mostra
 *     o número só como detalhe terciário).
 *   • IDs técnicos de cenário (cr3_anti_pattern) viram rótulos
 *     legíveis (friendlyScenarioLabel).
 *   • Sem botão "Testar Slack" (admin-only).
 *   • Cooldown 1×/24h por agente: backend retorna 429 com
 *     `nextAvailableAt`, UI mostra próximo horário disponível.
 *   • Mesmo Apply/Reject/Edit/Revert da FASE 2.2a — audit completo.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  clientAgentQualityApi,
  classifyQuality,
  QUALITY_LABELS,
  friendlyScenarioLabel,
  type ClientAgentLite,
  type TestScope,
} from '@/lib/clientAgentQualityApi';
import type {
  AgentEvalRunRow,
  AgentEvalRunDetail,
  AgentEvalRunDetailScenario,
  AgentEvalFixDecision,
} from '@/lib/adminApi';
import { SaibaMais } from '@/components/shared/SaibaMais';

const TRIGGER_LABELS: Record<string, string> = {
  cron: 'Semanal automático',
  manual: 'Manual (admin)',
  client_manual: 'Manual (você)',
  pre_release: 'Pré-deploy',
};

export default function QualidadeIAClientePage() {
  const [agents, setAgents] = useState<ClientAgentLite[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [runs, setRuns] = useState<AgentEvalRunRow[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgentEvalRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<{ message: string; nextAvailableAt: string } | null>(null);
  const [testScope, setTestScope] = useState<TestScope | null>(null);

  // ── Carrega agents da org ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const resp = await clientAgentQualityApi.getAgents();
        setAgents(resp.agents);
        setTestScope(resp.testScope);
        if (resp.agents.length === 1) setSelectedAgent(resp.agents[0].id);
        else if (resp.agents.length > 0) setSelectedAgent(resp.agents[0].id);
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar agentes');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Carrega histórico de runs quando agent muda ──────────────────
  const refreshRuns = useCallback(async () => {
    if (!selectedAgent) return;
    try {
      const resp = await clientAgentQualityApi.getRuns({ agentId: selectedAgent, limit: 20 });
      setRuns(resp.runs);
      // Auto-seleciona a run mais recente completa
      const latestCompleted = resp.runs.find((r) => r.status === 'completed');
      if (latestCompleted && (!selectedRun || selectedRun.id !== latestCompleted.id)) {
        const detail = await clientAgentQualityApi.getRunDetail(latestCompleted.id, true);
        setSelectedRun(detail);
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar histórico');
    }
  }, [selectedAgent, selectedRun]);

  useEffect(() => {
    if (selectedAgent) refreshRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent]);

  // ── Dispara nova run ─────────────────────────────────────────────
  async function handleTrigger() {
    if (!selectedAgent) return;
    setTriggering(true);
    setError(null);
    setCooldown(null);
    try {
      await clientAgentQualityApi.triggerRun(selectedAgent);
      // Polling simples: 5s × até 60 tentativas (5min)
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        await refreshRuns();
        const fresh = await clientAgentQualityApi.getRuns({ agentId: selectedAgent, limit: 1 });
        if (fresh.runs[0]?.status === 'completed' || fresh.runs[0]?.status === 'failed' || tries >= 60) {
          clearInterval(poll);
          setTriggering(false);
          refreshRuns();
        }
      }, 5000);
    } catch (e: any) {
      // 429 cooldown vem como ApiError com `details` (api.ts joga o body completo lá)
      const payload = e?.details;
      if (payload?.error === 'cooldown') {
        setCooldown({ message: payload.message, nextAvailableAt: payload.nextAvailableAt });
      } else {
        setError(e?.message || 'Erro ao iniciar teste');
      }
      setTriggering(false);
    }
  }

  // ── Seleciona run do histórico ───────────────────────────────────
  async function handleSelectRun(runId: string) {
    try {
      const detail = await clientAgentQualityApi.getRunDetail(runId, true);
      setSelectedRun(detail);
    } catch (e: any) {
      setError(e?.message || 'Erro ao abrir execução');
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-white min-h-screen">
        <div className="text-neutral-500">Carregando…</div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="p-8 bg-white min-h-screen">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Qualidade da IA</h1>
        <div className="mt-6 p-6 bg-amber-50 border border-amber-200 rounded">
          <p className="text-amber-900">
            Você ainda não tem um agente <strong>publicado</strong>. Publique seu agente no
            <a href="/flows" className="underline mx-1">Maestro</a>
            pra ativar a auditoria de qualidade.
          </p>
          <p className="text-amber-800 text-sm mt-2">
            Não precisa estar com o treinamento 100% — a auditoria avalia o agente como ele
            está hoje. Quanto mais completo o treino, melhor tende a ser a nota.
          </p>
        </div>
      </div>
    );
  }

  const currentAgent = agents.find((a) => a.id === selectedAgent);
  const failedScenarios =
    selectedRun?.results?.filter((r) => r.combined === 'fail' || r.combined === 'partial') || [];

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900">Qualidade da IA</h1>
          <SaibaMais featureKey="qualidade.overview" />
        </div>
        <p className="text-sm text-neutral-600 mt-1">
          Diagnóstico contínuo de como o seu agente está respondendo. Rodamos cenários reais
          (descontentamento, intenção de compra, encaminhamento) e a IA propõe correções que
          você decide aplicar ou recusar.
        </p>
      </div>

      {/* Seleção de agente + botão de teste */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-neutral-50 border border-neutral-200 rounded">
        <label className="text-sm text-neutral-700 font-medium">Agente:</label>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="px-3 py-1.5 text-sm border border-neutral-300 rounded bg-white"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.role})
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleTrigger}
            disabled={triggering || !selectedAgent}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {triggering ? 'Executando teste (3–5 min)…' : 'Executar teste agora'}
          </button>
          <SaibaMais featureKey="qualidade.executar-teste" />
        </div>
      </div>

      {/* Cooldown banner */}
      {cooldown && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
          ⏱ {cooldown.message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
          ❌ {error}
        </div>
      )}

      {/* Cenários que não rodam por falta de treino — troca "você tirou X%" por
          "complete isto pra ser avaliado nisso também" (Onda 2 item 10, isolamento de tenant). */}
      {testScope && testScope.skipped.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
          <div className="font-medium mb-1">
            {testScope.skipped.length === 1
              ? '1 parte da auditoria não rodou ainda'
              : `${testScope.skipped.length} partes da auditoria não rodaram ainda`}
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
            {testScope.skipped.map((s, i) => (
              <li key={i}>{s.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ─ Coluna esquerda: histórico ─ */}
        <aside className="bg-white border border-neutral-200 rounded">
          <div className="p-3 border-b border-neutral-200 flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-neutral-900">Últimas execuções</h2>
            <SaibaMais featureKey="qualidade.historico-execucoes" />
          </div>
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            {runs.length === 0 ? (
              <div className="p-4 text-xs text-neutral-500 italic">
                Nenhuma execução ainda. Clique em "Executar teste agora" pra começar.
              </div>
            ) : (
              runs.map((run) => {
                const health = classifyQuality(run.scorePercent);
                const labels = QUALITY_LABELS[health];
                const isSelected = selectedRun?.id === run.id;
                return (
                  <button
                    key={run.id}
                    onClick={() => handleSelectRun(run.id)}
                    className={`w-full text-left p-3 border-b border-neutral-100 hover:bg-neutral-50 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${labels.bg} ${labels.color}`}
                      >
                        {run.status === 'running' || run.status === 'pending'
                          ? '⟳ Em execução'
                          : run.status === 'failed'
                            ? 'Falhou'
                            : labels.label}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {TRIGGER_LABELS[run.triggeredBy] || run.triggeredBy}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-700">
                      {new Date(run.startedAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {run.status === 'completed' && (
                      <div className="text-[10px] text-neutral-500 mt-1">
                        {run.passed}/{run.totalScenarios} aprovados
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ─ Coluna direita: detalhe da run ─ */}
        <section>
          {!selectedRun ? (
            <div className="p-8 text-center text-neutral-500 bg-neutral-50 rounded">
              Selecione uma execução à esquerda pra ver os resultados.
            </div>
          ) : (
            <RunDetailPanel
              run={selectedRun}
              failedScenarios={failedScenarios}
              onAfterAction={() => {
                refreshRuns();
                if (selectedRun) handleSelectRun(selectedRun.id);
              }}
              currentAgentName={currentAgent?.name || 'Agente'}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// RunDetailPanel — saúde + cenários reprovados/parciais
// ════════════════════════════════════════════════════════════════════
function RunDetailPanel({
  run,
  failedScenarios,
  onAfterAction,
  currentAgentName,
}: {
  run: AgentEvalRunDetail;
  failedScenarios: AgentEvalRunDetailScenario[];
  onAfterAction: () => void;
  currentAgentName: string;
}) {
  const health = classifyQuality(run.scorePercent);
  const labels = QUALITY_LABELS[health];
  const isRunning = run.status === 'pending' || run.status === 'running';

  // Mapa rápido scenarioId → última decisão
  const decisionsByScenario = new Map<string, AgentEvalFixDecision>();
  (run.fixDecisions || []).forEach((d) => {
    if (!decisionsByScenario.has(d.scenarioId)) {
      decisionsByScenario.set(d.scenarioId, d);
    }
  });

  // ─ Backfill silencioso de sugestões (Fix B — runs antigas) ─────────
  // Runs criadas antes do gate de auto-geração pra parciais (PR #211)
  // não têm suggestedFix pré-gerado. Disparamos serialmente o
  // /generate-suggestion em background pra não exigir clique manual em
  // cada cenário. Roda 1× por run (ref guard) e refresca ao terminar.
  const [backfillStatus, setBackfillStatus] = useState<{ total: number; done: number } | null>(null);
  const backfillStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!run.id || isRunning) return;
    if (backfillStartedRef.current === run.id) return;

    const pending = failedScenarios.filter((s) => !s.suggestedFix);
    if (pending.length === 0) return;

    backfillStartedRef.current = run.id;
    setBackfillStatus({ total: pending.length, done: 0 });

    (async () => {
      for (let i = 0; i < pending.length; i++) {
        const sc = pending[i];
        try {
          await clientAgentQualityApi.generateSuggestion(run.id, sc.scenarioId);
        } catch {
          // Silencia falha individual — segue pro próximo.
        }
        setBackfillStatus({ total: pending.length, done: i + 1 });
      }
      setBackfillStatus(null);
      onAfterAction();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, isRunning, failedScenarios.length]);

  return (
    <div className="bg-white border border-neutral-200 rounded">
      {/* Card de saúde */}
      <div className="p-5 border-b border-neutral-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1.5">
              Saúde do {currentAgentName}
              <SaibaMais featureKey="qualidade.saude-score" />
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${labels.color}`}>{labels.label}</span>
              {run.scorePercent != null && (
                <span className="text-xs text-neutral-500">
                  ({run.scorePercent.toFixed(0)}% dos cenários aprovados)
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Execução de {new Date(run.startedAt).toLocaleString('pt-BR')} ·{' '}
              {TRIGGER_LABELS[run.triggeredBy] || run.triggeredBy}
              {run.durationMs ? ` · ${Math.round(run.durationMs / 1000)}s` : ''}
            </div>
          </div>
          {isRunning && (
            <div className="text-xs text-blue-600 italic">⟳ Aguarde, finalizando análise…</div>
          )}
        </div>
        {/* KPIs simplificados */}
        {!isRunning && run.totalScenarios > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <SaibaMais featureKey="qualidade.kpis-cenarios" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <KPISmall label="Aprovados" value={String(run.passed ?? 0)} tint="green" />
              <KPISmall label="Parciais" value={String(run.partial ?? 0)} tint="amber" />
              <KPISmall label="Reprovados" value={String(run.failed ?? 0)} tint="red" />
              <KPISmall label="Críticos" value={String(run.criticalFailed ?? 0)} tint="red-strong" />
            </div>
          </div>
        )}
      </div>

      {/* Nudge proativo: nota baixa → completar treinamento eleva o resultado */}
      {!isRunning && run.scorePercent != null && run.scorePercent < 90 && (
        <div className="px-5 pt-4">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded flex items-start gap-2.5">
            <span className="text-base leading-none mt-0.5">💡</span>
            <div className="text-sm text-indigo-900">
              Boa parte da nota vem de quanto seu agente sabe do seu negócio. Completar o
              treinamento da IA costuma <strong>elevar este resultado</strong>.
              <a href="/ai-training" className="underline font-medium ml-1">Completar treinamento →</a>
            </div>
          </div>
        </div>
      )}

      {/* Banner de backfill silencioso (runs antigas — Fix B). */}
      {backfillStatus && (
        <div className="px-5 pt-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded flex items-center gap-3">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <div className="text-sm text-blue-900 flex-1">
              Gerando correções automáticas em segundo plano…{' '}
              <strong>
                {backfillStatus.done}/{backfillStatus.total}
              </strong>{' '}
              prontas. A página atualiza sozinha ao terminar.
            </div>
          </div>
        </div>
      )}

      {/* Lista de cenários com problema + sugestão IA */}
      <div className="p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-1.5">
          {failedScenarios.length === 0 && !isRunning
            ? '✅ Nenhum desvio identificado nessa execução.'
            : `Comportamentos para revisar (${failedScenarios.length})`}
          <SaibaMais featureKey="qualidade.cenarios-revisar" />
        </h3>
        {failedScenarios.length === 0 && !isRunning && (
          <p className="text-sm text-neutral-600">
            Seu agente passou em todos os cenários testados. Continue acompanhando — rodamos
            uma execução automática por semana.
          </p>
        )}
        <div className="space-y-3">
          {failedScenarios.map((scenario) => (
            <ClientFixCard
              key={scenario.scenarioId}
              runId={run.id}
              scenario={scenario}
              existingDecision={decisionsByScenario.get(scenario.scenarioId) || null}
              onAfterAction={onAfterAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// KPISmall — cartão executivo
// ════════════════════════════════════════════════════════════════════
function KPISmall({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: 'green' | 'amber' | 'red' | 'red-strong';
}) {
  const colors = {
    green: 'text-green-800 bg-green-50 border-green-200',
    amber: 'text-amber-900 bg-amber-50 border-amber-200',
    red: 'text-red-900 bg-red-50 border-red-200',
    'red-strong': 'text-red-900 bg-red-100 border-red-300 font-bold',
  }[tint];
  return (
    <div className={`p-3 border rounded ${colors}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ClientFixCard — Apply/Reject/Edit cliente-friendly
// ════════════════════════════════════════════════════════════════════
function ClientFixCard({
  runId,
  scenario,
  existingDecision,
  onAfterAction,
}: {
  runId: string;
  scenario: AgentEvalRunDetailScenario;
  existingDecision: AgentEvalFixDecision | null;
  onAfterAction: () => void;
}) {
  const initialDiff = scenario.suggestedFix?.patches[0]?.diff || '';
  const [editedDiff, setEditedDiff] = useState(initialDiff);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [loadingAction, setLoadingAction] = useState<'apply' | 'reject' | 'revert' | 're-test' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  // Re-teste pós-Apply (loop curto rumo a 90%+): o usuário clica e a gente roda
  // SÓ esse cenário contra o systemPrompt atual pra ver se a correção pegou.
  const [retestResult, setRetestResult] = useState<{
    combined: 'pass' | 'partial' | 'fail';
    judge: { passed: boolean; reason: string };
  } | null>(null);

  useEffect(() => {
    setEditedDiff(initialDiff);
    setEditing(false);
    setActionError(null);
    setActionSuccess(null);
  }, [initialDiff, scenario.scenarioId]);

  const hasSuggestion = !!scenario.suggestedFix && scenario.suggestedFix.patches.length > 0;
  const decisionMade = existingDecision !== null;
  const isPartial = scenario.combined === 'partial';
  const friendlyTitle = friendlyScenarioLabel(scenario.scenarioId, scenario.description);

  async function handleApply() {
    if (
      !confirm(
        'Aplicar essa correção no comportamento do seu agente? Ela passa a valer imediatamente nas próximas conversas.',
      )
    )
      return;
    setLoadingAction('apply');
    setActionError(null);
    setActionSuccess(null);
    try {
      await clientAgentQualityApi.applyFix(runId, scenario.scenarioId, {
        finalDiff: editing ? editedDiff : undefined,
        notes: notes.trim() || undefined,
      });
      setActionSuccess('✓ Correção aplicada com sucesso');
      setTimeout(onAfterAction, 1200);
    } catch (err: any) {
      // FASE 2.2c (#246): trata DUPLICATE_PATCH com mensagem orientativa.
      if (err?.details?.error === 'DUPLICATE_PATCH' || err?.status === 409) {
        setActionError(
          err?.details?.message ||
            'Esta correção já existe no agente. Edite antes de aplicar (use CAPS, "REGRA INVIOLÁVEL", PROIBIDO) pra fortalecer a regra.',
        );
        setEditing(true);
      } else {
        setActionError(err?.message || 'Erro ao aplicar');
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReject() {
    if (!confirm('Recusar essa sugestão? Você pode voltar a vê-la na próxima execução.')) return;
    setLoadingAction('reject');
    setActionError(null);
    setActionSuccess(null);
    try {
      await clientAgentQualityApi.rejectFix(runId, scenario.scenarioId, {
        reason: reason.trim() || undefined,
      });
      setActionSuccess('✓ Sugestão recusada');
      setTimeout(onAfterAction, 1200);
    } catch (err: any) {
      setActionError(err?.message || 'Erro ao recusar');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRetest() {
    setLoadingAction('re-test');
    setActionError(null);
    setRetestResult(null);
    try {
      const r = await clientAgentQualityApi.reTestScenario(runId, scenario.scenarioId);
      setRetestResult({ combined: r.combined, judge: r.judge });
    } catch (err: any) {
      setActionError(err?.message || 'Erro ao re-testar cenário');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRevert() {
    if (!existingDecision) return;
    if (!confirm('Reverter a aplicação anterior? O agente volta ao comportamento de antes.')) return;
    setLoadingAction('revert');
    setActionError(null);
    setActionSuccess(null);
    try {
      await clientAgentQualityApi.revertFix(existingDecision.id, {});
      setActionSuccess('✓ Aplicação revertida');
      setTimeout(onAfterAction, 1200);
    } catch (err: any) {
      setActionError(err?.message || 'Erro ao reverter');
    } finally {
      setLoadingAction(null);
    }
  }

  const severityChip =
    scenario.severity === 'critical'
      ? 'bg-red-100 text-red-900 border-red-300'
      : scenario.severity === 'high'
        ? 'bg-orange-100 text-orange-900 border-orange-300'
        : 'bg-amber-50 text-amber-900 border-amber-200';

  return (
    <details
      className="group border border-neutral-200 rounded"
      open={scenario.combined === 'fail' && scenario.severity === 'critical' && !decisionMade}
    >
      <summary className="cursor-pointer p-3 hover:bg-neutral-50 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${severityChip}`}>
              {isPartial ? 'Parcial' : 'Reprovado'} ·{' '}
              {scenario.severity === 'critical' ? 'Crítico' : scenario.severity === 'high' ? 'Alto' : 'Médio'}
            </span>
            {existingDecision && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                  existingDecision.decision === 'applied'
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : existingDecision.decision === 'rejected'
                      ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
                      : 'bg-orange-50 text-orange-800 border-orange-200'
                }`}
              >
                {existingDecision.decision === 'applied'
                  ? '✓ Aplicada'
                  : existingDecision.decision === 'rejected'
                    ? '✕ Recusada'
                    : '↺ Revertida'}{' '}
                por {existingDecision.decidedByName || existingDecision.decidedByEmail} ·{' '}
                {new Date(existingDecision.decidedAt).toLocaleString('pt-BR')}
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-neutral-900">{friendlyTitle}</div>
          <div className="text-xs text-neutral-600 mt-1">
            <strong>Diagnóstico:</strong> {scenario.judge.reason}
          </div>
        </div>
        <span className="text-xs text-blue-600 hover:underline self-center flex-shrink-0">ver ▾</span>
      </summary>

      <div className="px-3 pb-3 pt-1 bg-neutral-50">
        {/* FASE 2.2c (#246): contexto completo da interação testada — pergunta enviada + resposta do agente. */}
        {(scenario.userMessage || scenario.response) && (
          <div className="mb-3 p-3 bg-white border border-neutral-200 rounded">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-2 flex items-center gap-1.5">
              Interação testada
              <SaibaMais featureKey="qualidade.interacao-testada" />
            </div>
            {scenario.userMessage && (
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-neutral-600 mb-0.5">📨 Mensagem enviada</div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] text-neutral-800 bg-neutral-50 p-2 rounded border border-neutral-200">
                  {scenario.userMessage}
                </pre>
              </div>
            )}
            {scenario.response && (
              <div>
                <div className="text-[10px] font-semibold text-neutral-600 mb-0.5">🤖 Resposta do agente</div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] text-neutral-800 bg-neutral-50 p-2 rounded border border-neutral-200 max-h-64 overflow-y-auto">
                  {scenario.response}
                </pre>
              </div>
            )}
          </div>
        )}
        {!hasSuggestion ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-xs text-blue-900 mb-2">
              {isPartial ? (
                <>
                  <strong>Desvio menor detectado.</strong> Em execuções a partir
                  de agora a correção automática já vem pronta. Pra esta execução
                  antiga, clique abaixo — a sugestão aparece em segundos.
                </>
              ) : (
                <>
                  <strong>Correção não pôde ser gerada.</strong> Tente novamente — pode ter
                  sido falha transitória da IA.
                </>
              )}
            </div>
            <ClientGenerateSuggestionButton
              runId={runId}
              scenarioId={scenario.scenarioId}
              onGenerated={onAfterAction}
            />
          </div>
        ) : (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="flex items-center gap-1.5">
                <strong className="text-xs text-blue-900">💡 Correção sugerida</strong>
                <SaibaMais featureKey="qualidade.correcao-sugerida" />
              </span>
              <span className="text-[10px] text-blue-700">
                confiança {(scenario.suggestedFix!.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-sm text-blue-900 mb-2">{scenario.suggestedFix!.summary}</div>

            <div className="text-xs bg-white border border-blue-200 rounded p-2 mb-2">
              {editing ? (
                <textarea
                  className="w-full font-mono text-[11px] text-neutral-900 leading-relaxed p-2 border border-blue-300 rounded resize-y min-h-[120px] bg-blue-50/30"
                  value={editedDiff}
                  onChange={(e) => setEditedDiff(e.target.value)}
                  disabled={decisionMade || loadingAction !== null}
                />
              ) : (
                <>
                  {/* FASE 2.2c follow-up: depois de aplicada, mostrar o texto
                      REAL que foi gravado (existingDecision.finalDiff), não o
                      state local editedDiff que é resetado pra sugestão IA original. */}
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-neutral-800 leading-relaxed">
                    {decisionMade && existingDecision?.finalDiff
                      ? existingDecision.finalDiff
                      : editedDiff}
                  </pre>
                  {decisionMade &&
                    existingDecision?.finalDiff &&
                    existingDecision.finalDiff !==
                      (scenario.suggestedFix?.patches[0]?.diff || '') && (
                      <div className="mt-1.5 text-[10px] text-amber-700 italic">
                        ⚠ Texto editado por{' '}
                        {existingDecision.decidedByName || existingDecision.decidedByEmail}
                        {' '}antes de aplicar — diferente da sugestão original.
                      </div>
                    )}
                </>
              )}
              {!decisionMade && (
                <span className="mt-2 inline-flex items-center gap-1">
                  <button
                    onClick={() => setEditing(!editing)}
                    className="text-[10px] text-blue-700 hover:text-blue-900 hover:underline"
                    disabled={loadingAction !== null}
                  >
                    {editing ? '↺ Voltar à sugestão original' : '✎ Editar antes de aplicar'}
                  </button>
                  <SaibaMais featureKey="qualidade.editar-correcao" />
                </span>
              )}
            </div>

            {!decisionMade && (
              <div className="mt-2 space-y-1.5">
                <input
                  type="text"
                  placeholder="Observação (opcional)"
                  className="w-full text-xs px-2 py-1.5 border border-blue-200 rounded bg-white focus:outline-none focus:border-blue-500"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loadingAction !== null}
                  maxLength={500}
                />
              </div>
            )}

            {actionError && (
              <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                ❌ {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                {actionSuccess}
              </div>
            )}

            {/* Resultado do Re-teste pós-Apply (loop curto rumo a 90%+). */}
            {retestResult && (
              <div
                className={`mt-2 text-xs rounded p-2 border ${
                  retestResult.combined === 'pass'
                    ? 'text-green-800 bg-green-50 border-green-200'
                    : retestResult.combined === 'partial'
                      ? 'text-amber-900 bg-amber-50 border-amber-200'
                      : 'text-red-800 bg-red-50 border-red-200'
                }`}
              >
                <div className="font-semibold mb-0.5">
                  {retestResult.combined === 'pass'
                    ? '✓ Re-teste passou — a correção pegou. O score sobe na próxima execução completa.'
                    : retestResult.combined === 'partial'
                      ? '⚠ Ainda parcial — melhorou, mas não 100%. Edite a sugestão (fortaleça a regra: CAPS, "REGRA INVIOLÁVEL") e re-aplique.'
                      : '✗ Ainda reprovou — a correção não pegou. Edite a sugestão pra ser mais explícita e re-aplique.'}
                </div>
                <div className="text-[11px] opacity-80">{retestResult.judge.reason}</div>
              </div>
            )}

            <div className="flex gap-2 mt-3 items-center">
              {!decisionMade ? (
                <>
                  <button
                    onClick={handleApply}
                    disabled={loadingAction !== null}
                    className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAction === 'apply' ? 'Aplicando…' : '✓ Aplicar correção'}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={loadingAction !== null}
                    className="flex-1 px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-medium rounded border border-neutral-300 disabled:opacity-50"
                  >
                    {loadingAction === 'reject' ? 'Recusando…' : '✕ Recusar'}
                  </button>
                  <SaibaMais featureKey="qualidade.aplicar-correcao" />
                </>
              ) : existingDecision.decision === 'applied' ? (
                <>
                  <button
                    onClick={handleRetest}
                    disabled={loadingAction !== null}
                    className="flex-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-medium rounded border border-blue-300 disabled:opacity-50"
                    title="Roda só esse cenário contra o prompt atual pra confirmar que a correção empurrou o score"
                  >
                    {loadingAction === 're-test' ? 'Re-testando…' : '🔄 Re-testar agora'}
                  </button>
                  <button
                    onClick={handleRevert}
                    disabled={loadingAction !== null}
                    className="flex-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-medium rounded border border-orange-300 disabled:opacity-50"
                  >
                    {loadingAction === 'revert' ? 'Revertendo…' : '↺ Reverter aplicação'}
                  </button>
                </>
              ) : (
                <div className="text-[10px] text-neutral-500 italic flex-1">
                  Decisão registrada · {existingDecision.notes || '(sem observação)'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

// ════════════════════════════════════════════════════════════════════
// ClientGenerateSuggestionButton — FASE 2.2d (#252) versão cliente
// ════════════════════════════════════════════════════════════════════
function ClientGenerateSuggestionButton({
  runId, scenarioId, onGenerated,
}: { runId: string; scenarioId: string; onGenerated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      await clientAgentQualityApi.generateSuggestion(runId, scenarioId);
      setTimeout(onGenerated, 600);
    } catch (err: any) {
      setError(err?.message || 'Erro ao gerar correção');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded disabled:opacity-50"
      >
        {loading ? 'Gerando…' : '💡 Pedir correção da IA'}
      </button>
      {error && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          ❌ {error}
        </div>
      )}
    </>
  );
}
