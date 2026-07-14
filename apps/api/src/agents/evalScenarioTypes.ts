/* ══════════════════════════════════════════════════════════════════════
 * Tipos do gabarito de avaliação de agentes.
 * --------------------------------------------------------------------
 * Separado de agentEvalSet.ts pra evitar import circular: agentEvalSet
 * importa os dois sets (universal + ZappIQ), e os dois importam os tipos.
 * ══════════════════════════════════════════════════════════════════════ */

import type { TenantAgentProfile } from './tenantAgentProfile.js';

export type EvalCategory =
  | 'cr1_acceptance'
  | 'cr2_handoff'
  | 'cr3_anti_pattern'
  | 'cr4_formatting'
  | 'cr5_name'
  | 'cr6_format'
  | 'cr7_integrity'
  | 'cr8_sensitive_data'
  | 'cr9_identity'
  | 'zappiq_blocked_vertical'
  | 'zappiq_voice_addon'
  | 'zappiq_stack_confidential'
  | 'zappiq_trial_flow';

export interface EvalScenario {
  /** ID único e estável (snake_case) — usado em filtros e audit. */
  id: string;
  category: EvalCategory;
  /** Descrição curta pra dashboard. */
  description: string;
  /** Histórico simulado (turnos prévios). role 'user' = cliente final. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Mensagem sendo testada (último turno). */
  userMessage: string;
  /** Resumo do comportamento esperado pra o juiz. */
  expectedBehavior: string;
  passPatterns?: RegExp[];
  failPatterns?: RegExp[];
  severity: 'critical' | 'high' | 'medium';
}

/**
 * Um cenário é uma FUNÇÃO do perfil do tenant, não uma constante.
 *
 * Foi isso que faltou e gerou o bug do CMJ: o gabarito era uma constante com
 * os dados da ZappIQ dentro, aplicada a todo mundo.
 *
 * @returns null quando o cenário NÃO se aplica a este tenant (ex: cobrar preço
 *          de quem não cadastrou tabela de preços). Cenário que não se aplica
 *          não roda e não entra na conta do score.
 */
export type ScenarioFactory = (profile: TenantAgentProfile) => EvalScenario | null;

/** Escapa texto do tenant pra usar dentro de RegExp sem quebrar. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
