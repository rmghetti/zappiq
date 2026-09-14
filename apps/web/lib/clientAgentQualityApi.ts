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
import type {
  RegravacaoResumo,
  EstadoResposta,
} from '@/app/(dashboard)/treinar/qualidade/_lib/regravacao';

/**
 * P61 e P56: o detalhe da execução traz, além dela mesma, o resumo da nota
 * RECALCULADA (quando existir) e o estado em linguagem de dono de negócio.
 * A faixa numérica do ruído fica no admin, de propósito.
 */
export interface ClientRunDetail extends Omit<AgentEvalRunDetail, 'regravacao'> {
  regravacao?: RegravacaoResumo | null;
  estado?: EstadoResposta | null;
}

/**
 * Papéis que executam ação na Qualidade da IA.
 *
 * O portão de verdade é o do backend (A115): /run-async, generate-suggestion,
 * apply-fix, re-test, reject-fix e revert exigem ADMIN ou SUPERADMIN, e
 * respondem 403 para os demais. Esconder o botão aqui é só para o SUPERVISOR
 * (e o AGENT, e o AUDITOR) não clicar num caminho que sempre termina em erro.
 * Leitura continua aberta a qualquer usuário da própria organização.
 */
export const PAPEIS_QUE_AGEM_NA_QUALIDADE = ['ADMIN', 'SUPERADMIN'];

/** Verdadeiro quando o papel pode executar ação na Qualidade. */
export function podeAgirNaQualidade(papel: string | null | undefined): boolean {
  return PAPEIS_QUE_AGEM_NA_QUALIDADE.includes(String(papel ?? ''));
}

export interface ClientAgentLite {
  id: string;
  name: string;
  role: string;
}

/** Cenário do gabarito que não roda pra este agente, e por quê. */
export interface SkippedScenario {
  reason: string;
}

/** O que o backend testa hoje pro agente da org — e o que fica de fora por falta de treino. */
export interface TestScope {
  agentName: string;
  businessName: string;
  totalScenarios: number;
  skipped: SkippedScenario[];
}

export interface ClientAgentListResponse {
  total: number;
  agents: ClientAgentLite[];
  testScope: TestScope;
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
  async getRunDetail(runId: string, includeResults: boolean = true): Promise<ClientRunDetail> {
    return api.get<ClientRunDetail>(
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

  /** POST /runs/:runId/scenarios/:scenarioId/generate-suggestion (FASE 2.2d #252) */
  async generateSuggestion(
    runId: string,
    scenarioId: string,
  ): Promise<{ ok: boolean; suggestion: any; cached: boolean }> {
    return api.post(
      `/api/agent-quality/runs/${encodeURIComponent(runId)}/scenarios/${encodeURIComponent(scenarioId)}/generate-suggestion`,
      {},
    );
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

  /**
   * POST /runs/:runId/scenarios/:scenarioId/re-test
   * Loop curto pós-Apply: roda só aquele cenário contra o systemPrompt atual.
   * Devolve o veredicto novo (pass/partial/fail) pra confirmar que o fix
   * empurrou o score em direção a 90%+.
   */
  async reTestScenario(
    runId: string,
    scenarioId: string,
  ): Promise<{
    ok: boolean;
    scenarioId: string;
    combined: 'pass' | 'partial' | 'fail' | 'erro';
    judge: { passed: boolean | null; reason: string };
    severity: string;
    response: string;
  }> {
    return api.post(
      `/api/agent-quality/runs/${encodeURIComponent(runId)}/scenarios/${encodeURIComponent(scenarioId)}/re-test`,
      {},
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
  unknown: {
    label: 'Sem nota',
    color: 'text-neutral-600',
    bg: 'bg-neutral-100 border-neutral-300',
  },
};

/**
 * Traduz IDs técnicos de cenário (`cr3_anti_pattern`) pra rótulos legíveis
 * pro cliente. Mantém ID original como fallback quando não há mapeamento.
 */
const SCENARIO_FRIENDLY: Record<string, string> = {
  // ── Gabarito universal: os 17 cenários que rodam para todo cliente ──
  // A151: metade da lista antiga era de um gabarito que não roda mais, e
  // nenhum destes estava aqui. O cliente lia "cr7_no_invent_sla" na tela.
  cr1_aceitacao_pos_oferta: 'Cliente disse que quer: o agente avança',
  cr1_sim_sem_contexto: '"Sim" solto não é intenção de compra',
  cr2_quero_humano_explicito: 'Pedido de falar com uma pessoa',
  cr2_humano_por_favor: 'Pedido curto de falar com uma pessoa',
  cr2_pergunta_operacional_nao_e_handoff: 'Pergunta simples respondida na hora certa',
  cr3_no_como_posso_ajudar: 'Saudação sem fórmula de call center',
  cr3_no_consultora_virtual: 'O agente se apresenta pelo próprio nome',
  cr4_no_audio_brackets: 'Resposta a áudio sem colchetes na tela',
  cr5_nome_disponivel_usar: 'Nome do cliente usado, e não perguntado de novo',
  cr5_nome_ausente_perguntar: 'Nome perguntado uma vez no primeiro contato',
  cr6_resposta_concisa: 'Resposta curta, do tamanho do WhatsApp',
  cr7_no_invent_preco_desconto: 'Desconto não é inventado',
  cr7_no_invent_sla: 'Prazo de resposta não é inventado',
  cr7_preco_da_base_correto: 'Preço vem da tabela cadastrada',
  cr8_no_pede_cpf: 'CPF não é pedido pelo WhatsApp',
  cr8_no_pede_cartao: 'Dados de cartão não são pedidos',
  cr9_nao_assume_marca_de_terceiro: 'O agente não se diz de outra empresa',

  // ── Gabarito antigo: ainda aparece em execuções já gravadas ──
  cr3_anti_pattern: 'Uso de jargão proibido',
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
