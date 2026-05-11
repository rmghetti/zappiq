/**
 * Tools registry pro LLMRouter (PR #V4-006).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O que isto faz
 * ════════════════════════════════════════════════════════════════════════════
 * Cataloga tools (funções) que o modelo pode chamar via function calling.
 * Padrão Anthropic + OpenAI compatível — cada tool tem:
 *   - schema (name, description, inputSchema JSON Schema)
 *   - handler (função async que executa, recebe input parseado + contexto)
 *
 * Caller (ex: agentOrchestrator no futuro) faz:
 *   1. Constrói lista de tools com `getToolsForContext(...)` filtrando por
 *      permissão/tier/feature flag.
 *   2. Chama `llmRouter.complete({ ..., tools: defs })`.
 *   3. Se resposta tem `toolCalls`, executa cada um via `executeToolCall()`
 *      e envia resultado de volta numa próxima iteração.
 *
 * Por que registry e não call-direct: separar "schema apresentado ao modelo"
 * de "lógica de execução" + permitir auditoria centralizada de quem chamou
 * que tool com que payload (futura tabela tool_call_logs).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * Escopo PoC desta entrega
 * ════════════════════════════════════════════════════════════════════════════
 * 1 tool concreta — `get_org_billing_summary` — pra Iza (ou qualquer agente)
 * conseguir consultar consumo atual do tenant quando perguntada "qual meu
 * plano?" / "quanto sobrou esse mês?". Valida o pipeline end-to-end.
 *
 * **NÃO está ativado em prod ainda.** agentOrchestrator NÃO passa tools no
 * `complete()`. Próximo PR ativa via flag (`req.tools = getToolsForContext()`
 * com check de feature flag por org).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * Como adicionar uma tool nova
 * ════════════════════════════════════════════════════════════════════════════
 *   1. Defina o schema (name, description, inputSchema)
 *   2. Implemente o handler async que recebe { input, context }
 *   3. Adicione em TOOL_REGISTRY
 *   4. (opcional) Filtro de permissão em getToolsForContext()
 *
 * Tools devem ser idempotentes/safe — modelos podem chamar 2x por engano.
 * Side effects (criar deal, mandar email) devem confirmar com usuário antes
 * via outra tool (ex: `propose_deal_creation` retorna preview, depois
 * `confirm_deal_creation` cria de fato).
 */

import { prisma } from '@zappiq/database';
import { PLAN_CONFIG, type PlanConfig, type PlanId } from '@zappiq/shared';
import { logger } from '../../utils/logger.js';
import type { ToolDefinition } from './LLMRouter.js';

// ─── Contexto disponível pra handlers ────────────────────────────────────

export interface ToolContext {
  /** Org do tenant que está conversando (obrigatório pra tools que tocam dados). */
  organizationId: string;
  /** ID da conversa (opcional, audit + rastreabilidade). */
  conversationId?: string | null;
  /** ID do contato/usuário final (opcional). */
  contactId?: string | null;
}

// ─── Tipo do handler ─────────────────────────────────────────────────────

export type ToolHandler = (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
  /**
   * Se true, tool só fica disponível pra agente da Iza (dogfood ZappIQ).
   * Útil pra rollout cauteloso de tools experimentais.
   */
  internalOnly?: boolean;
}

// ─── Tool: get_org_billing_summary ───────────────────────────────────────

const getOrgBillingSummary: RegisteredTool = {
  definition: {
    name: 'get_org_billing_summary',
    description:
      'Consulta o resumo de consumo e plano da organização atual. ' +
      'Use quando o usuário perguntar sobre plano contratado, mensagens consumidas no mês, ' +
      'limite do plano, ou saúde de uso. Retorna plano, mensagens IA usadas no mês corrente, ' +
      'limite do plano, percentual de uso, e configurações de auto-overage.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  handler: async (_input, ctx) => {
    const org = (await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { plan: true, name: true, settings: true },
    })) as { plan: string; name: string; settings: any } | null;

    if (!org) {
      return { error: 'organization_not_found' };
    }

    const planConfig = (PLAN_CONFIG as Record<string, PlanConfig>)[org.plan];
    const limit = planConfig?.limits?.aiMessagesPerMonth ?? 0;
    const now = new Date();
    const periodYearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const usage = (await (prisma as any).TenantUsageMonthly.findUnique({
      where: { organizationId_periodYearMonth: { organizationId: ctx.organizationId, periodYearMonth } },
      select: { aiMessagesProcessed: true },
    })) as { aiMessagesProcessed: number } | null;

    const used = usage?.aiMessagesProcessed ?? 0;
    const usagePercent = limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0;
    const billing = org.settings?.billing || {};

    return {
      organizationName: org.name,
      plan: org.plan,
      periodYearMonth,
      aiMessagesUsed: used,
      aiMessagesLimit: limit === -1 ? 'unlimited' : limit,
      usagePercent: limit === -1 ? null : usagePercent,
      autoOverage: Boolean(billing.autoOverage),
      hardCeilingBrl: billing.hardCeilingBrl ?? null,
      notifyAtPercent: typeof billing.notifyAtPercent === 'number' ? billing.notifyAtPercent : 80,
    };
  },
};

// ─── Registry ────────────────────────────────────────────────────────────

const TOOL_REGISTRY: Record<string, RegisteredTool> = {
  [getOrgBillingSummary.definition.name]: getOrgBillingSummary,
};

// ─── API pública ─────────────────────────────────────────────────────────

/**
 * Retorna definitions das tools disponíveis pra um contexto. Filtra por
 * permissão (internalOnly só pra Iza).
 *
 * Use no caller:
 *   const tools = getToolsForContext({ isIzaOrg: org.id === IZA_ORG_ID });
 *   const resp = await llmRouter.complete({ ..., tools });
 */
export function getToolsForContext(opts: { isIzaOrg?: boolean } = {}): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY)
    .filter((t) => !t.internalOnly || opts.isIzaOrg)
    .map((t) => t.definition);
}

/**
 * Lista nomes de todas as tools registradas — útil pra debug + healthcheck.
 */
export function listToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

/**
 * Executa um tool call com base no name. Caller deve passar contexto válido
 * (organizationId obrigatório pra tools que tocam dados).
 *
 * Retorna o resultado bruto (qualquer JSON-serializable) ou { error: ... }
 * em caso de tool desconhecida.
 *
 * Logs estruturados pra audit (futura tool_call_logs table).
 */
export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) {
    logger.warn(`[tools] tool desconhecida invocada: ${toolName}`);
    return { error: 'unknown_tool', toolName };
  }

  const t0 = Date.now();
  try {
    const result = await tool.handler(input, ctx);
    const latencyMs = Date.now() - t0;
    logger.info('[tools] tool executada', {
      toolName,
      orgId: ctx.organizationId,
      conversationId: ctx.conversationId,
      latencyMs,
      success: true,
    });
    return result;
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    logger.error('[tools] tool falhou', {
      toolName,
      orgId: ctx.organizationId,
      latencyMs,
      error: err?.message,
    });
    return { error: 'tool_execution_failed', message: err?.message };
  }
}
