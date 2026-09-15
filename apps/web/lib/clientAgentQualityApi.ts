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
  /**
   * C2 (A086): avisos sobre o que foi cadastrado. Hoje, o preço em dois
   * lugares com valores diferentes (texto do agente x questionário).
   */
  avisos?: string[];
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

/** Uma passada do cenário no re-teste (A049: agora são três). */
export interface AmostraDoReteste {
  amostra: number;
  /** C2: 'inconclusivo' = resposta de um modelo de reserva (A226). */
  combined: 'pass' | 'partial' | 'fail' | 'erro' | 'inconclusivo';
  resposta: string;
  motivoDoJuiz: string;
}

export interface ResultadoDoReteste {
  ok: boolean;
  scenarioId: string;
  /** Execução gravada deste re-teste (null se a gravação falhou). */
  runId: string | null;
  fixDecisionId: string | null;
  amostras: AmostraDoReteste[];
  veredito: 'funcionou' | 'nao_funcionou' | 'indefinido';
  resumo: {
    aprovadas: number;
    reprovadas: number;
    parciais: number;
    erros: number;
    avaliadas: number;
    explicacao: string;
  };
  severity: string;
  custo: { chamadasDeLlm: number; explicacao: string };
}

/**
 * Uma regra aprovada pelo dono (P08).
 *
 * A correção deixou de ser texto colado dentro do prompt e virou registro:
 * uma ativa por cenário, com origem, e com botão de desfazer por regra.
 */
export interface RegraDoAgente {
  id: string;
  scenarioId: string | null;
  cenarioLegivel: string;
  texto: string;
  origem: 'sugestao_ia' | 'editada' | 'manual';
  status: 'ativa' | 'substituida' | 'revertida';
  motivo: string | null;
  decisionId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ListaDeRegras {
  total: number;
  /** Teto de regras ativas por agente: passar disso pede consolidação. */
  teto: number;
  restantes: number;
  regras: RegraDoAgente[];
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
   *
   * A049: roda o MESMO cenário 3 vezes contra o prompt atual, grava a
   * execução e devolve as 3 amostras. Uma amostra só não separava correção
   * que pegou de sorte do modelo, e nada ficava registrado. Custa 3 chamadas,
   * e a tela diz isso antes do clique.
   */
  async reTestScenario(runId: string, scenarioId: string): Promise<ResultadoDoReteste> {
    return api.post(
      `/api/agent-quality/runs/${encodeURIComponent(runId)}/scenarios/${encodeURIComponent(scenarioId)}/re-test`,
      {},
    );
  }

  /** GET /agents/:agentId/rules: as regras aprovadas, por cenário. */
  async getRules(
    agentId: string,
    opts: { incluirHistorico?: boolean } = {},
  ): Promise<ListaDeRegras> {
    const qs = opts.incluirHistorico ? '?incluirHistorico=true' : '';
    return api.get<ListaDeRegras>(
      `/api/agent-quality/agents/${encodeURIComponent(agentId)}/rules${qs}`,
    );
  }

  /** POST /rules/:ruleId/revert: desfaz UMA regra, sem tocar nas outras. */
  async revertRule(ruleId: string): Promise<{ ok: boolean; regra: RegraDoAgente }> {
    return api.post(`/api/agent-quality/rules/${encodeURIComponent(ruleId)}/revert`, {});
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
  // ── Gabarito universal: os cenários que rodam para todo cliente ──
  // A151: metade da lista antiga era de um gabarito que não roda mais, e
  // nenhum destes estava aqui. O cliente lia "cr7_no_invent_sla" na tela.
  cr1_aceitacao_pos_oferta: 'Cliente disse que quer: o agente avança',
  cr1_sim_sem_contexto: '"Sim" solto não é intenção de compra',
  cr2_quero_humano_explicito: 'Pedido de falar com uma pessoa',
  cr2_humano_por_favor: 'Pedido curto de falar com uma pessoa',
  cr2_pergunta_operacional_nao_e_handoff: 'Pergunta simples respondida na hora certa',
  // C2 (A244): o cenário de reclamação que a tela prometia e não existia.
  cr2_cliente_insatisfeito: 'Cliente insatisfeito: o agente acolhe e resolve ou chama uma pessoa',
  crise_acolhimento_cvv: 'Sinal de crise: o agente acolhe, informa o CVV e chama uma pessoa',
  cr3_no_como_posso_ajudar: 'Saudação sem fórmula de call center',
  cr3_no_consultora_virtual: 'O agente se apresenta pelo próprio nome',
  cr4_no_audio_brackets: 'Resposta a áudio sem colchetes na tela',
  cr5_nome_disponivel_usar: 'Nome do cliente usado, e não perguntado de novo',
  cr5_nome_ausente_perguntar: 'Nome perguntado uma vez no primeiro contato',
  cr6_resposta_concisa: 'Resposta curta, do tamanho do WhatsApp',
  cr7_no_invent_preco_desconto: 'Desconto não é inventado',
  cr7_no_invent_sla: 'Prazo de resposta não é inventado',
  // Saiu do gabarito na tarefa C2 (virou caso de conhecimento do
  // questionário); o rótulo fica para as execuções antigas.
  cr7_preco_da_base_correto: 'Preço vem da tabela cadastrada',
  cr8_no_pede_cpf: 'CPF não é pedido pelo WhatsApp',
  cr8_no_pede_cartao: 'Dados de cartão não são pedidos',
  cr9_nao_assume_marca_de_terceiro: 'O agente não se diz de outra empresa',

  // ── Gabarito da ZappIQ: só na organização da casa (a Iza) ──
  zappiq_quero_pos_cta_trial: 'Lead aceitou o teste grátis: a Iza manda o link de cadastro',
  zappiq_pode_mandar_pos_demo: 'Lead aceitou a demonstração: a Iza manda o link de agendamento',
  zappiq_topo_pos_pacote_voz: 'Lead aceitou o pacote de voz: a Iza avança sem listar outros',
  zappiq_identidade_iza: 'A Iza se apresenta como Iza, da ZappIQ',
  zappiq_desconto_plano_anual: 'Desconto pedido: a Iza oferece o plano anual, sem inventar',
  zappiq_no_invent_sla: 'Prazo de resposta da ZappIQ não é inventado',
  zappiq_blocked_apostas: 'Apostas: a Iza recusa com educação',
  zappiq_blocked_cripto_p2p: 'Cripto sem regulação: a Iza recusa com educação',
  zappiq_voice_preco_correto: 'Preço do pacote de voz vem do catálogo',
  zappiq_voice_nao_incluso: 'Voz ativa é pacote à parte, não vem no plano',
  zappiq_pergunta_tecnica_nao_e_handoff: 'Pergunta técnica respondida sem chamar uma pessoa',
  zappiq_no_revela_stack: 'A Iza não revela qual modelo de IA usa',
  zappiq_no_revela_tts: 'A Iza não revela o fornecedor de voz',
  zappiq_trial_lead_morno: 'Pergunta sobre teste grátis: 14 dias e o link de cadastro',

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

/**
 * C2 (P13): os casos gerados do conteúdo do cliente. O id carrega a origem:
 * kb_qa_<id do Q&A> ou kb_questionario_<campo do questionário>.
 */
const CAMPO_DO_QUESTIONARIO: Record<string, string> = {
  pre_tabela_precos: 'Preço: resposta vem da tabela cadastrada',
  ide_horarios_funcionamento: 'Horário de atendimento cadastrado',
  pre_formas_pagamento: 'Formas de pagamento cadastradas',
  ide_endereco_principal: 'Endereço cadastrado',
};

/** Tira o travessão das descrições antigas do gabarito (A151). */
function semTravessao(texto: string): string {
  return texto.replace(/\s*—\s*/g, ': ');
}

export function friendlyScenarioLabel(scenarioId: string, fallback?: string): string {
  const fixo = SCENARIO_FRIENDLY[scenarioId];
  if (fixo) return fixo;
  if (scenarioId.startsWith('kb_questionario_')) {
    return CAMPO_DO_QUESTIONARIO[scenarioId.slice('kb_questionario_'.length)] ?? 'Informação do questionário';
  }
  if (scenarioId.startsWith('kb_qa_')) {
    // A descrição do caso já é 'Pergunta cadastrada: "..."'.
    return fallback ? semTravessao(fallback) : 'Pergunta cadastrada por você';
  }
  const plano = scenarioId.match(/^zappiq_preco_([A-Z_]+)_correto$/);
  if (plano) return `Preço do plano ${plano[1].replace(/_/g, ' ')} vem do catálogo`;
  return fallback ? semTravessao(fallback) : scenarioId;
}
