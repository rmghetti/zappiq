import { api } from './api';

/**
 * Tipos alinhados ao shape real dos endpoints da API.
 * Fonte: apps/api/src/routes/adminTenantUsage.ts
 */

export interface TenantSummaryRow {
  organizationId: string;
  organizationName: string;
  plan: string;
  subscriptionStatus: string;
  isTrialActive: boolean;
  revenueBrl: number;
  llmCostUsd: number;
  infraCostUsd: number;
  grossMarginPercent: number | null;
  aiMessagesProcessed: number;
  conversationsOpened: number;
  conversationsAiResolved: number;
  conversationsHumanResolved: number;
  handoffsCount: number;
}

export interface TenantUsageSummaryResponse {
  period: string;
  totals: {
    tenants: number;
    revenueBrl: number;
    costUsd: number;
    llmCostUsd: number;
    infraCostUsd: number;
    aiMessagesProcessed: number;
  };
  rows: TenantSummaryRow[];
}

export interface TenantHistoryRow {
  period: string;
  revenueBrl: number;
  llmCostUsd: number;
  infraCostUsd: number;
  grossMarginPercent: number | null;
  aiMessagesProcessed: number;
  broadcastsSent: number;
  conversationsOpened: number;
  conversationsClosed: number;
  conversationsAiResolved: number;
  conversationsHumanResolved: number;
  handoffsCount: number;
  computedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  trialCostCapUsd: number | null;
  createdAt: string;
}

export interface TenantUsageDetailResponse {
  organization: Organization;
  history: TenantHistoryRow[];
}

/**
 * API client com wrappers tipados para endpoints de unit economics.
 * Requer role SUPERADMIN (verificado no middleware da API).
 */
class AdminApi {
  /**
   * GET /api/admin/tenant-usage/summary?period=YYYY-MM
   * Retorna agregado de todos os tenants + lista de detalhes por tenant.
   */
  async getTenantUsageSummary(period: string): Promise<TenantUsageSummaryResponse> {
    try {
      const response = await api.get<TenantUsageSummaryResponse>(
        `/api/admin/tenant-usage/summary?period=${encodeURIComponent(period)}`
      );
      return response;
    } catch (error) {
      throw new Error(`Falha ao buscar resumo de uso de tenants: ${error}`);
    }
  }

  /**
   * GET /api/admin/tenant-usage/:orgId?period=YYYY-MM
   * Retorna série histórica dos últimos 6 meses de um tenant específico.
   *
   * Nota: o período é ignorado no servidor — retorna sempre os últimos 6 meses.
   * O parâmetro é aceito mas não filtrado (comportamento verificado em adminTenantUsage.ts L90-92).
   */
  async getTenantUsageDetail(
    orgId: string,
    period?: string
  ): Promise<TenantUsageDetailResponse> {
    try {
      let endpoint = `/api/admin/tenant-usage/${encodeURIComponent(orgId)}`;
      if (period) {
        endpoint += `?period=${encodeURIComponent(period)}`;
      }
      const response = await api.get<TenantUsageDetailResponse>(endpoint);
      return response;
    } catch (error) {
      throw new Error(`Falha ao buscar detalhe do tenant ${orgId}: ${error}`);
    }
  }
}

// ─── PR #135-alt — LLM Health (V4-003 dashboard) ──────────────────────

export interface LLMProviderStatus {
  id: string;
  label: string;
  model: string;
  breakerOpen: boolean;
  failures: number;
  openUntil: number | null;
}

export interface LLMHealthResponse {
  providers: LLMProviderStatus[];
  last24h: {
    totalCalls: number;
    totalCostUsd: string;
    avgLatencyMs: number;
    fallbackRate: number;
    byProvider: Record<string, number>;
  };
  generatedAt: string;
}

class LLMHealthApi {
  /**
   * GET /api/admin/llm-health
   * Estado em tempo real dos circuit breakers (Redis-backed) + métricas 24h.
   * Requer role SUPERADMIN.
   */
  async getHealth(): Promise<LLMHealthResponse> {
    return api.get<LLMHealthResponse>('/api/admin/llm-health');
  }
}

export const llmHealthApi = new LLMHealthApi();

// ─── Quota Watch (Onda 6 — audit-only operational view) ───────────────

export interface QuotaWatchRow {
  organizationId: string;
  organizationName: string;
  plan: string;
  isTrialActive: boolean;
  subscriptionStatus: string;
  createdAt: string;
  owner: { name: string; email: string } | null;
  consumption: {
    aiMessagesProcessed: number;
    aiMessagesLimit: number | null; // null = ilimitado
    usagePercent: number | null;
    llmCostUsd: number;
    lastComputedAt: string | null;
  };
  billing: {
    autoOverage: boolean;
    hardCeilingBrl: number | null;
    notifyAtPercent: number;
  };
  reconciliation: {
    lastRunAt: string | null;
    lastAction: string | null;
    usagePercentAtLastRun: number | null;
    notifiedAt50: string | null;
    notifiedAt80: string | null;
    notifiedAt100: string | null;
  };
}

export interface QuotaWatchResponse {
  period: string;
  summary: {
    totalOrgs: number;
    orgsAt50Percent: number;
    orgsAt80Percent: number;
    orgsAt100Percent: number;
    orgsWithAutoOverage: number;
    orgsTrialing: number;
  };
  rows: QuotaWatchRow[];
  excludeStaging?: boolean;
  stagingFilteredCount?: number;
  generatedAt: string;
}

class QuotaWatchApi {
  /**
   * GET /api/admin/quota-watch
   * Painel humano do audit-only do PR #149: lista todas as orgs com plano,
   * consumo do mês, %limite, settings.billing e estado de reconciliação.
   * Requer role SUPERADMIN.
   */
  async getWatch(): Promise<QuotaWatchResponse> {
    return api.get<QuotaWatchResponse>('/api/admin/quota-watch');
  }
}

export const quotaWatchApi = new QuotaWatchApi();

// ─── Leads (signups + orgs unificados) ────────────────────────────────

export type LeadStatus = 'signup_only' | 'cadastrado' | 'ativo';
export type LeadKind = 'organization' | 'signup';

export interface LeadRow {
  kind: LeadKind;
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  plan: string;
  isTrialActive: boolean;
  subscriptionStatus: string;
  company: string | null;
  cnpj: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  conversationsCount: number;
  messagesCount: number;
  status: LeadStatus;
  createdAt: string;
  confirmedAt: string | null;
}

export interface LeadsResponse {
  summary: {
    totalLeads: number;
    signupOnly: number;
    cadastrado: number;
    ativo: number;
    stagingFilteredCount: number;
    periodDays: number;
  };
  rows: LeadRow[];
  includeStaging: boolean;
  generatedAt: string;
}

class LeadsApi {
  async getLeads(opts: { days?: number; includeStaging?: boolean } = {}): Promise<LeadsResponse> {
    const params = new URLSearchParams();
    if (opts.days) params.set('days', String(opts.days));
    if (opts.includeStaging) params.set('includeStaging', 'true');
    const qs = params.toString();
    return api.get<LeadsResponse>(`/api/admin/leads${qs ? '?' + qs : ''}`);
  }
}

export const leadsApi = new LeadsApi();

// ─── Iza Conversations (espião SUPERADMIN) ────────────────────────────

export interface IzaConversationRow {
  id: string;
  status: string;
  channel: string;
  summary: string | null;
  csatScore: number | null;
  contactName: string | null;
  contactPhone: string | null;
  msgCount: number;
  lastMsg: string | null;
  lastMsgAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface IzaConversationsResponse {
  izaOrgId: string;
  total: number;
  rows: IzaConversationRow[];
  generatedAt: string;
}

export interface IzaConversationMessage {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  isFromBot: boolean;
  status: string | null;
  messageType: string | null;
  createdAt: string;
}

export interface IzaConversationDetailResponse {
  conversation: {
    id: string;
    status: string;
    channel: string;
    summary: string | null;
    csatScore: number | null;
    contactName: string | null;
    contactPhone: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
  };
  messages: IzaConversationMessage[];
  generatedAt: string;
}

class IzaApi {
  async getConversations(): Promise<IzaConversationsResponse> {
    return api.get<IzaConversationsResponse>('/api/admin/iza-conversations');
  }
  async getConversationDetail(id: string): Promise<IzaConversationDetailResponse> {
    return api.get<IzaConversationDetailResponse>(`/api/admin/iza-conversations/${encodeURIComponent(id)}`);
  }
}

export const izaApi = new IzaApi();

// ─── FASE 2 / V4 — Agent Quality (eval runs dashboard) ─────────────────

export interface AgentEvalRunRow {
  id: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  evalSetVersion: string;
  coreRulesVersion: string;
  triggeredBy: string;
  totalScenarios: number;
  passed: number | null;
  partial: number | null;
  failed: number | null;
  criticalFailed: number | null;
  scorePercent: number | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  agent?: { name: string };
}

export interface AgentEvalRunsResponse {
  total: number;
  runs: AgentEvalRunRow[];
}

export interface AgentEvalRunDetailScenario {
  scenarioId: string;
  category: string;
  severity: string;
  description: string;
  /** FASE 2.2c (#246): mensagem enviada ao agente — contexto completo na UI. Opcional pra runs antigas. */
  userMessage?: string;
  response: string;
  combined: 'pass' | 'partial' | 'fail';
  deterministic: { passed: boolean; failedPatterns: string[]; missingPatterns: string[] };
  judge: { passed: boolean; confidence: number; reason: string };
  /** Nível 1 auto-suggest — gerado quando combined='fail'. */
  suggestedFix?: {
    summary: string;
    patches: Array<{ where: string; diff: string }>;
    confidence: number;
  };
}

export interface AgentEvalFixDecision {
  id: string;
  runId: string;
  scenarioId: string;
  agentId: string;
  decision: 'applied' | 'rejected' | 'reverted';
  decidedByEmail: string;
  decidedByName: string | null;
  decidedByRole: string | null;
  decidedAt: string;
  notes: string | null;
  revertedFromId: string | null;
}

export interface AgentEvalRunDetail extends AgentEvalRunRow {
  hasResults: boolean;
  results?: AgentEvalRunDetailScenario[];
  agent?: { id: string; name: string; organizationId: string };
  fixDecisions?: AgentEvalFixDecision[];
  // FASE 2.2a — instrumentação Slack
  slackAlertStatus?: 'skipped' | 'sent' | 'failed' | null;
  slackAlertError?: string | null;
  slackAlertSentAt?: string | null;
}

export interface AgentLite {
  id: string;
  name: string;
  organizationName: string;
}

class AgentQualityApi {
  /**
   * GET /api/admin/agent-eval/runs?agentId=&limit=&status=
   * Lista histórico de runs (paginado, sem `results` jsonb).
   */
  async getRuns(opts: {
    agentId?: string;
    limit?: number;
    status?: 'completed' | 'failed' | 'running' | 'pending';
  } = {}): Promise<AgentEvalRunsResponse> {
    const qs = new URLSearchParams();
    if (opts.agentId) qs.set('agentId', opts.agentId);
    if (opts.limit) qs.set('limit', String(opts.limit));
    if (opts.status) qs.set('status', opts.status);
    const q = qs.toString();
    return api.get<AgentEvalRunsResponse>(`/api/admin/agent-eval/runs${q ? '?' + q : ''}`);
  }

  /**
   * GET /api/admin/agent-eval/runs/:id?includeResults=true
   * Detalhe de uma run específica. `includeResults=true` traz o jsonb completo
   * com todas as respostas e diagnóstico por cenário.
   */
  async getRunDetail(runId: string, includeResults: boolean = true): Promise<AgentEvalRunDetail> {
    return api.get<AgentEvalRunDetail>(
      `/api/admin/agent-eval/runs/${encodeURIComponent(runId)}${includeResults ? '?includeResults=true' : ''}`,
    );
  }

  /**
   * POST /api/admin/agent-eval/run-async
   * Dispara um run novo. Retorna runId pra polling.
   */
  async triggerRun(agentId: string, opts: {
    criticalOnly?: boolean;
    category?: string;
    triggeredBy?: 'manual' | 'pre_release';
  } = {}): Promise<{ runId: string; status: string; pollUrl: string }> {
    return api.post<{ runId: string; status: string; pollUrl: string }>(
      '/api/admin/agent-eval/run-async',
      { agentId, ...opts },
    );
  }

  /**
   * POST /api/admin/agent-eval/test-slack
   * Diagnóstico: dispara mensagem fake pra validar webhook configurado.
   */
  async testSlack(): Promise<{
    ok: boolean;
    configured: boolean;
    webhookUsed?: string | null;
    message: string;
  }> {
    return api.post<{
      ok: boolean;
      configured: boolean;
      webhookUsed?: string | null;
      message: string;
    }>('/api/admin/agent-eval/test-slack', {});
  }

  /**
   * POST /api/admin/agent-eval/test-real-alert
   * FASE 2.2c (#246): dispara `notifyQualityIssue` REAL com dados fake.
   * Se /test-slack chega mas esse não, problema é payload (não webhook).
   */
  async testRealAlert(): Promise<{ ok: boolean; message: string }> {
    return api.post<{ ok: boolean; message: string }>(
      '/api/admin/agent-eval/test-real-alert',
      {},
    );
  }

  /**
   * POST /runs/:runId/scenarios/:scenarioId/apply-fix
   * Aplica sugestão IA no system_prompt do agent. Cria audit row.
   */
  async applyFix(
    runId: string,
    scenarioId: string,
    opts: { finalDiff?: string; notes?: string } = {},
  ): Promise<{ ok: boolean; decision: AgentEvalFixDecision; strategy: string; insertedAtLine: number }> {
    return api.post(
      `/api/admin/agent-eval/runs/${encodeURIComponent(runId)}/scenarios/${encodeURIComponent(scenarioId)}/apply-fix`,
      opts,
    );
  }

  /**
   * POST /runs/:runId/scenarios/:scenarioId/reject-fix
   * Marca sugestão como recusada. Não modifica prompt.
   */
  async rejectFix(
    runId: string,
    scenarioId: string,
    opts: { reason?: string } = {},
  ): Promise<{ ok: boolean; decision: AgentEvalFixDecision }> {
    return api.post(
      `/api/admin/agent-eval/runs/${encodeURIComponent(runId)}/scenarios/${encodeURIComponent(scenarioId)}/reject-fix`,
      opts,
    );
  }

  /**
   * POST /fix-decisions/:id/revert
   * Reverte uma aplicação anterior. Restaura promptBefore no agent.
   */
  async revertFix(
    decisionId: string,
    opts: { reason?: string } = {},
  ): Promise<{ ok: boolean; decision: AgentEvalFixDecision }> {
    return api.post(
      `/api/admin/agent-eval/fix-decisions/${encodeURIComponent(decisionId)}/revert`,
      opts,
    );
  }
}

export const agentQualityApi = new AgentQualityApi();

export const adminApi = new AdminApi();
