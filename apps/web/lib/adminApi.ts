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

export const adminApi = new AdminApi();
