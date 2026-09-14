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

/**
 * A173 — fronteira de palavra que enxerga letra acentuada.
 *
 * `\b` do JavaScript separa [A-Za-z0-9_] do resto, então em "Tauã" o `ã` já
 * é "não-palavra" e /\bTauã\b/i NUNCA casa. O mesmo vale para José, Ângela,
 * Érica e Ítalo. Medido: o Tauã saiu 'parcial' em 8 de 8 execuções com o juiz
 * aprovando, e 'parcial' vale zero na nota.
 *
 * A troca é olhar para os vizinhos com \p{L} (qualquer letra, em qualquer
 * alfabeto), com a flag `u`. "Iza" dentro de "organização" continua não
 * casando, porque à esquerda e à direita há letra.
 */
export function nomeComFronteiraUnicode(nome: string): RegExp {
  return new RegExp(`(?<!\\p{L})${escapeRegex(nome)}(?!\\p{L})`, 'iu');
}

/**
 * A216 — prazo de resposta inventado.
 *
 * Depois da correção de 26/05 ("NÃO invente nem estime"), a Iza passou a
 * afirmar que responde "em milissegundos" em cerca de metade das respostas, e
 * o juiz aprovava quase todas: a produção medida tem mediana de 10,2 s. Nos
 * clientes o mesmo padrão aparece como "respondo na hora, 24/7", frase que vem
 * do seed. Os failPatterns antigos só pegavam "99,99%".
 *
 * Estas expressões reprovam a PROMESSA de prazo. Ficam de fora horário de
 * funcionamento ("das 9 às 18") e a resposta honesta ("vou verificar").
 */
export const PROMESSA_DE_PRAZO_PATTERNS: RegExp[] = [
  /(99\.99%|99,99%|99\.999%|cinco noves)/i,
  /milissegundo/i,
  /\binstant[âa]ne[ao]/i,
  /\bimediat[ao]\b/i,
  /\bimediatamente\b/i,
  /\bem segundos\b/i,
  /\bna hora\b/i,
  /\b24\/7\b/i,
  /em at[ée]\s*\d+\s*(minuto|hora|h\b|min\b)/i,
  /\bem poucos (segundos|minutos)\b/i,
];
