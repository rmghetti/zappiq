/* ══════════════════════════════════════════════════════════════════════
 * Contrato do cadastro (A242, 14/09/2026)
 * --------------------------------------------------------------------
 * A tela pré-seleciona o Lite, a rota aceita o Lite, o enum PlanType do
 * Postgres tem o Lite, mas a CHECK da tabela `signups` só aceitava
 * STARTER, GROWTH, SCALE, BUSINESS e ENTERPRISE. Resultado medido em 60
 * dias: todo cadastro por e-mail no plano padrão morria em "Erro ao
 * registrar cadastro", e nenhum lead novo chegou ao Treinar IA.
 *
 * O mesmo vale para `onboarding_path`: o produto grava 'wizard' e a CHECK
 * do banco só aceitava 'assisted' e 'self_service'.
 *
 * Este arquivo é a fonte única desses dois catálogos. A migração
 * 20260914000060 deriva as duas CHECK daqui e um teste de catálogo no CI
 * falha se as listas divergirem. Ninguém mais escreve a lista à mão.
 * ══════════════════════════════════════════════════════════════════════ */

import { PLAN_IDS, type PlanId } from './planConfig.js';

/**
 * Valores aceitos em `signups.plan_chosen`.
 *
 * É o catálogo INTEIRO de planos, não só os de self-signup: o comercial
 * registra lead de ENTERPRISE na mesma tabela, e planos descontinuados
 * (STARTER, BUSINESS) continuam existindo em linhas antigas. Quem decide o
 * que a tela oferece é SELF_SIGNUP_PLAN_IDS; a CHECK do banco só garante
 * que ninguém grave texto que o produto não saiba ler.
 */
export const SIGNUP_PLAN_CHOSEN_VALUES: readonly PlanId[] = PLAN_IDS;

/**
 * Valores aceitos em `signups.onboarding_path`.
 *
 * 'wizard' é o caminho REAL: é o que routes/onboarding.ts grava quando o
 * cliente termina o questionário. Ele faltava na CHECK, então o UPDATE que
 * liga o signup à organização falhava em silêncio (o chamador engole o
 * erro) e o lead ficava órfão para sempre.
 */
export const ONBOARDING_PATHS = ['assisted', 'self_service', 'wizard'] as const;

export type OnboardingPath = (typeof ONBOARDING_PATHS)[number];

/** O texto é um caminho de onboarding conhecido? Aceita null com segurança. */
export function isOnboardingPath(value: string | null | undefined): value is OnboardingPath {
  return value != null && (ONBOARDING_PATHS as readonly string[]).includes(value);
}

/**
 * Normaliza `signups.plan_chosen` (texto livre, vindo de fora do Prisma)
 * para um PlanId do catálogo. Devolve null quando não reconhece.
 *
 * Tolerante com caixa e espaço porque a coluna é texto e já recebeu valor
 * de quatro origens diferentes (tela, OAuth, importação, SQL manual).
 */
export function normalizarPlanoDoSignup(raw: string | null | undefined): PlanId | null {
  if (raw == null) return null;
  const v = String(raw).trim().toUpperCase();
  return (SIGNUP_PLAN_CHOSEN_VALUES as readonly string[]).includes(v) ? (v as PlanId) : null;
}
