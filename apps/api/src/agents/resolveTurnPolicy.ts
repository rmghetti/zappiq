/* ══════════════════════════════════════════════════════════════════════
 * resolveTurnPolicy: modelo e ferramentas do turno, numa decisão só.
 * --------------------------------------------------------------------
 * Tarefa C1a (Passo 12). Hoje a escolha de tier, de override de provedor e
 * de ferramentas está espalhada entre pickTierAndOverride (orquestrador),
 * getToolsForContext (registro de tools) e ifs por canal (WhatsApp,
 * playground, retomada do Maestro, Qualidade). Cada canal chegava a uma
 * resposta diferente para a mesma organização.
 *
 * Este arquivo junta tudo numa função PURA: recebe o plano, o estado do
 * trial, o Modo Econômico, o override de settings.llm_routing, se o
 * agendamento está de pé e o canal, e devolve o que o turno vai usar, com o
 * motivo escrito. Sem banco, sem rede. Quem lê o banco é o carregador.
 *
 * Regra da tarefa: "junte sem mudar o resultado". O teste
 * (resolveTurnPolicy.test.ts) prova, caso a caso, que a decisão é a mesma
 * que pickTierAndOverride e os ifs de hoje tomam. O que muda para melhor
 * fica registrado no teste com o achado correspondente.
 * ══════════════════════════════════════════════════════════════════════ */

import type { LLMTier, LLMProviderId } from '../services/llm/LLMRouter.js';
import { TIER_PRIMARY_PROVIDER } from '../services/llm/LLMRouter.js';
import type { OrigemDoTurno } from './composeAgentContext.js';

/** Os tiers que o roteador conhece. Espelha VALID_TIERS do orquestrador. */
export const TIERS_VALIDOS: LLMTier[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];

/** Nomes das ferramentas de agendamento (schedulingTools.ts). */
export const TOOL_CONSULTAR_HORARIOS = 'check_availability';
export const TOOL_MARCAR = 'create_appointment';

/** Provedor primário da cascata padrão (sem tier, sem override): Sonnet. */
export const PROVEDOR_DA_CASCATA_PADRAO: LLMProviderId = 'anthropic-sonnet';

/** Estágio de custo da organização (middleware/planLimits.decideLlmCostStage). */
export type EstagioDoTrial = 'TRIAL' | 'NOVO' | 'OTHER';

export interface LlmRoutingLido {
  forceProvider?: unknown;
  tierOverride?: unknown;
  useDefaultCascade?: unknown;
}

export interface TurnPolicyInput {
  canal: OrigemDoTurno;
  /** organizations.plan, como está no banco. */
  plano: string | null | undefined;
  /** true SÓ para a org canônica da ZappIQ. Ela nunca cai no regime de trial nem no Modo Econômico. */
  ehZappIQ: boolean;
  /** Já decidido por decideLlmCostStage. 'OTHER' = pagante ou fora do regime. */
  estagioDoTrial: EstagioDoTrial;
  /** Breaker de custo armado neste turno (PR-I). */
  ecoMode: boolean;
  /** settings.llm_routing da organização, se houver. */
  llmRouting: LlmRoutingLido | null | undefined;
  /** Agendamento REALMENTE de pé (resolveSchedulingRuntime().ativo). */
  agendamentoAtivo: boolean;
}

export interface TurnPolicy {
  tier?: LLMTier;
  /** forceProvider: Enterprise customizado, sem cascata. */
  override?: LLMProviderId;
  /** Nomes das ferramentas que entram neste turno. Vazio = turno sem tools. */
  tools: string[];
  /** Provedor primário que o turno vai usar, antes de escalada por intenção. */
  modelo: LLMProviderId;
  /** Por que, em português. Vai para o log e para o Raio-X. */
  motivo: string;
}

/**
 * Tier e override, na MESMA ordem de precedência de pickTierAndOverride:
 *   1. trial ou estágio NOVO (org que não é a ZappIQ) força STARTER;
 *   2. Modo Econômico (org que não é a ZappIQ) força STARTER;
 *   3. settings.llm_routing.forceProvider;
 *   4. settings.llm_routing.tierOverride válido;
 *   5. settings.llm_routing.useDefaultCascade;
 *   6. o plano da organização, quando é um tier conhecido;
 *   7. cascata padrão.
 */
function tierEOverride(input: TurnPolicyInput): Pick<TurnPolicy, 'tier' | 'override'> & { motivo: string } {
  if (!input.ehZappIQ && input.estagioDoTrial !== 'OTHER') {
    return { tier: 'STARTER', motivo: `organização em regime ${input.estagioDoTrial}: tier STARTER` };
  }
  if (input.ecoMode && !input.ehZappIQ) {
    return { tier: 'STARTER', motivo: 'Modo Econômico armado: tier STARTER' };
  }

  const routing = input.llmRouting;
  if (routing && typeof routing === 'object') {
    if (typeof routing.forceProvider === 'string') {
      return {
        override: routing.forceProvider as LLMProviderId,
        motivo: `settings.llm_routing.forceProvider = ${routing.forceProvider}`,
      };
    }
    if (
      typeof routing.tierOverride === 'string' &&
      TIERS_VALIDOS.includes(routing.tierOverride as LLMTier)
    ) {
      return {
        tier: routing.tierOverride as LLMTier,
        motivo: `settings.llm_routing.tierOverride = ${routing.tierOverride}`,
      };
    }
    if (routing.useDefaultCascade === true) {
      return { motivo: 'settings.llm_routing.useDefaultCascade: cascata padrão' };
    }
  }

  if (input.plano && TIERS_VALIDOS.includes(input.plano as LLMTier)) {
    return { tier: input.plano as LLMTier, motivo: `tier do plano ${input.plano}` };
  }
  return { motivo: 'plano sem tier conhecido: cascata padrão' };
}

/**
 * Ferramentas por canal, como hoje:
 *   - WhatsApp e Instagram: as duas de agendamento, só com o agendamento de pé;
 *   - Testar minha IA: só a consulta de horários (nunca marca de verdade);
 *   - chat do site, retomada do Maestro e Qualidade: nenhuma.
 */
function ferramentas(input: TurnPolicyInput): string[] {
  if (!input.agendamentoAtivo) return [];
  switch (input.canal) {
    case 'whatsapp':
    case 'instagram':
      return [TOOL_CONSULTAR_HORARIOS, TOOL_MARCAR];
    case 'playground':
      return [TOOL_CONSULTAR_HORARIOS];
    default:
      return [];
  }
}

/**
 * Decide modelo e ferramentas do turno. Pura.
 *
 * Canais com regra própria HOJE, preservadas de propósito:
 *   - 'maestro_retomada': só o tier do plano (flowAiResume não olha trial,
 *     Modo Econômico nem llm_routing);
 *   - 'qualidade': cascata padrão, sem tier (o avaliador chama o roteador
 *     sem tier; mudar isso é da tarefa C2, interruptor `evalNoTier`).
 *
 * C1b (nota 5 da revisão de 14/09, A068): o chat do site deixou a cascata
 * padrão e segue o plano da organização, com a MESMA precedência do
 * WhatsApp (trial e estágio NOVO, llm_routing, tier do plano). O Modo
 * Econômico é do breaker do WhatsApp e não chega aqui (o site não o mede).
 */
export function resolveTurnPolicy(input: TurnPolicyInput): TurnPolicy {
  let tier: LLMTier | undefined;
  let override: LLMProviderId | undefined;
  let motivo: string;

  if (input.canal === 'maestro_retomada') {
    tier = input.plano && TIERS_VALIDOS.includes(input.plano as LLMTier) ? (input.plano as LLMTier) : undefined;
    motivo = tier ? `retomada do Maestro: tier do plano ${tier}` : 'retomada do Maestro: plano sem tier, cascata padrão';
  } else if (input.canal === 'qualidade') {
    motivo = 'Qualidade: cascata padrão, sem tier (como hoje)';
  } else if (input.canal === 'site') {
    const decisao = tierEOverride({ ...input, ecoMode: false });
    tier = decisao.tier;
    override = decisao.override;
    motivo = `chat do site: ${decisao.motivo}`;
  } else {
    const decisao = tierEOverride(input);
    tier = decisao.tier;
    override = decisao.override;
    motivo = decisao.motivo;
  }

  const tools = ferramentas(input);

  // Com ferramentas, o roteador prefere um provedor que suporte function
  // calling (Sonnet), a não ser que haja forceProvider. Sem ferramentas, o
  // primário é o do tier; sem tier, a cascata padrão começa em Sonnet.
  let modelo: LLMProviderId;
  if (override) {
    modelo = override;
  } else if (tools.length > 0) {
    modelo = 'anthropic-sonnet';
    motivo = `${motivo}; com ferramentas de agendamento, provedor com function calling (Sonnet)`;
  } else if (tier) {
    modelo = TIER_PRIMARY_PROVIDER[tier];
  } else {
    modelo = PROVEDOR_DA_CASCATA_PADRAO;
  }

  return { tier, override, tools, modelo, motivo };
}
