/**
 * Cliente-facing API para Qualidade do Agente (FASE 2.2b #244).
 *
 * Mesma superfície do `agentQualityApi` (adminApi.ts) mas batendo em
 * `/api/agent-quality/*` em vez de `/api/admin/agent-eval/*`. Backend
 * força RLS por organizationId; cooldown de 24h por agent no /run-async.
 *
 * Reutiliza os tipos exportados pelo adminApi.ts pra evitar drift de
 * schema entre as duas UIs (admin vs cliente).
 */
import { api } from './api';
import type {
  AgentEvalRunRow,
  AgentEvalRunsResponse,
  AgentEvalRunDetail,
  AgentEvalFixDecision,
} from './adminApi';

export interface ClientAgentLite {
  id: string;
  name: string;
  role: string;
}

export interface ClientAgentListResponse {
  total: number;
  agents: ClientAgentLite[];
}

export interface ClientTriggerRunResponse {
  runId: string;
  status: string;
  agentId: string;
  agentName: string;
  totalScenarios: number;
  startedAt: string;
  pollUrl: string;
}

export interface ClientCooldownError {
  error: 'cooldown';
  message: string;
  nextAvailableAt: string;
  lastRunId: string;
}

class ClientAgentQualityApi {
  /** GET /api/agent-quality/agents — agentes da org do usuário logado. */
  async getAgents(): Promise<ClientAgentListResponse> {
    return api.get<ClientAgentListResponse>('/api/agent-quality/agents');
  }

  /** GET /api/agent-quality/runs?agentId=&limit= — histórico (RLS por org). */
  async getRuns(opts: { agentId?: string; limit?: number } = {}): Promise<AgentEvalRunsResponse> {
    const qs = new URLSearchParams();
    if (opts.agentId) qs.set('agentId', opts.agentId);
    if (opts.limit) qs.set('limit', String(opts.limit));
    const q = qs.toString();
    return api.get<AgentEvalRunsResponse>(`/api/agent-quality/runs${q ? '?' + q : ''}`);
  }

  /** GET /api/agent-quality/runs/:id?includeResults=true */
  async getRunDetail(runId: string, includeResults: boolean = true): Promise<AgentEvalRunDetail> {
    return api.get<AgentEvalRunDetail>(
      `/api/agent-quality/runs/${encodeURIComponent(runId)}${includeResults ? '?includeResults=true' : ''}`,
    );
  }

  /**
   * POST /api/agent-quality/run-async — dispara eval no agente do cliente.
   * Cooldown 24h: pode retornar 429 com payload `ClientCooldownError`.
   * Caller deve tratar como UX-friendly (mostrar mensagem + horário próximo).
   */
  async triggerRun(
    agentId: string,
    opts: { criticalOnly?: boolean; category?: string } = {},
  ): Promise<ClientTriggerRunResponse> {
    return api.post<ClientTriggerRunResponse>('/api/agent-quality/run-async', { agentId, ...opts });
  }

  /** POST /runs/:runId/scenarios/:scenarioId/apply-fix */
  async applyFix(
    runId: string,
    scenarioId: string,
    opts: { finalDiff?: string; notes?: string } = {},
  ): Promise<{ ok: boolean; decision: AgentEvalFixDecision; strategy: string; insertedAtLine: number }> {
    return api.post(
      `/api/agent-quality/runs/${encodeURIComponent(runId)}/scenarios/${encodeURIComponent(scenarioId)}/apply-fix`,
      opts,
    );
  }

  /** POST /runs/:runId/scenarios/:scenarioId/reject-fix */
  async rejectFix(
    runId: string,
    scenarioId: string,
    opts: { reason?: string } = {},
  ): Promise<{ ok: boolean; decision: AgentEvalFixDecision }> {
    return api.post(
      `/api/agent-quality/runs/${encodeURIComponent(runId)}/scenarios/${encodeURIComponent(scenarioId)}/reject-fix`,
      opts,
    );
  }

  /** POST /fix-decisions/:id/revert */
  async revertFix(
    decisionId: string,
    opts: { notes?: string } = {},
  ): Promise<{ ok: boolean; decision: AgentEvalFixDecision }> {
    return api.post(
      `/api/agent-quality/fix-decisions/${encodeURIComponent(decisionId)}/revert`,
      opts,
    );
  }
}

export const clientAgentQualityApi = new ClientAgentQualityApi();

/**
 * Helper executivo: traduz `scorePercent` em label de saúde pro cliente.
 * Cliente não vê o número cru — vê "Bom / Atenção / Crítico" + barra.
 */
export type QualityHealth = 'good' | 'attention' | 'critical' | 'unknown';

export function classifyQuality(scorePercent: number | null): QualityHealth {
  if (scorePercent == null) return 'unknown';
  if (scorePercent >= 90) return 'good';
  if (scorePercent >= 70) return 'attention';
  return 'critical';
}

export const QUALITY_LABELS: Record<QualityHealth, { label: string; color: string; bg: string }> = {
  good: { label: 'Bom', color: 'text-green-800', bg: 'bg-green-100 border-green-300' },
  attention: { label: 'Atenção', color: 'text-amber-900', bg: 'bg-amber-100 border-amber-300' },
  critical: { label: 'Crítico', color: 'text-red-900', bg: 'bg-red-100 border-red-300' },
  unknown: { label: '—', color: 'text-neutral-600', bg: 'bg-neutral-100 border-neutral-300' },
};

/**
 * Traduz IDs técnicos de cenário (`cr3_anti_pattern`) pra rótulos legíveis
 * pro cliente. Mantém ID original como fallback quando não há mapeamento.
 */
const SCENARIO_FRIENDLY: Record<string, string> = {
  cr3_anti_pattern: 'Uso de jargão proibido',
  cr5_nome_disponivel_usar: 'Personalização com o nome do cliente',
  cr6_assinatura_proibida: 'Assinatura indevida ao final',
  handoff_objection: 'Encaminhamento em objeção comercial',
  handoff_complaint: 'Encaminhamento em reclamação grave',
  enterprise_qualification: 'Qualificação de oportunidade enterprise',
  purchase_intent_high: 'Identificação de intenção de compra alta',
  vertical_blocked_finance: 'Bloqueio de vertical não atendida (financeira)',
  vertical_blocked_health: 'Bloqueio de vertical não atendida (saúde)',
  small_talk_redirect: 'Redirecionamento de conversa informal',
};

export function friendlyScenarioLabel(scenarioId: string, fallback?: string): string {
  return SCENARIO_FRIENDLY[scenarioId] || fallback || scenarioId;
}
