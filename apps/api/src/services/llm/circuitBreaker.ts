/* ══════════════════════════════════════════════════════════════════════
 * Resposta Meta out/2026 (PR-I): circuit breaker de custo LLM por org.
 * --------------------------------------------------------------------
 * Vale pra TODA org (não só trial). Duas pontas:
 *
 *   1. ACUMULADOR: logLLMCall soma o custo estimado de cada chamada em
 *      `zappiq:llmcost:{orgId}:{yyyy-mm}` (mês UTC, INCRBYFLOAT, TTL 40d).
 *      Como todas as chamadas pagas passam pelo logLLMCall (LLMRouter,
 *      TTS, transcrição, pulse), o acumulado cobre o gasto real do tenant.
 *
 *   2. BREAKER: no início do turno o orchestrator chama evaluateCostBreaker,
 *      que compara o acumulado do mês com a PREMISSA de custo do contrato.
 *      Estourou, seta `zappiq:ecomode:{orgId}` (TTL 6h) e o turno roda em
 *      Modo Econômico: tier STARTER, menos tokens, RAG menor, escalada pra
 *      Sonnet só no pedido de humano. A resposta SEMPRE sai: o breaker
 *      degrada custo, nunca silencia o cliente.
 *
 * PREMISSA (por mês):
 *   franquia de atendimentos x R$ 0,12 por atendimento, convertido a USD
 *   pela taxa fixa da premissa, x fator 2 de folga do contrato.
 *
 * Org da casa (ZappIQ / vitrine Iza) NUNCA entra em Modo Econômico.
 * Tudo aqui é fail-soft: erro de cache ou banco mantém o turno normal.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { PLAN_CONFIG, type PlanId } from '@zappiq/shared';
import { cache } from '../cloud/index.js';
import { logger } from '../../utils/logger.js';
import { isZappIQOrg } from '../../config/zappiqOrg.js';

/** Premissa comercial: custo-alvo de LLM por atendimento, em BRL. */
export const PREMISSA_BRL_POR_ATENDIMENTO = 0.12;

/**
 * Taxa fixa BRL->USD usada SÓ pra converter a premissa (o acumulador é em
 * USD porque a tabela de preços dos providers é em USD). Não é cotação viva:
 * é uma constante conservadora do contrato. Revisar junto com a premissa.
 */
export const USD_BRL_PREMISSA = 5.4;

/** Fator de folga do contrato: o breaker só arma acima de 2x a premissa. */
export const FATOR_CONTRATO = 2;

/**
 * Proxy da franquia de atendimentos ENQUANTO a grade nova (unidade
 * "atendimento de IA", metering em sombra no planLimits) não sobe pros
 * planos: franquia de atendimentos ~= aiMessagesPerMonth / 25. Quando a
 * grade nova entrar com aiAttendancesPerMonth de verdade, trocar aqui.
 */
export const MSGS_POR_ATENDIMENTO_PROXY = 25;

/** TTL do acumulador mensal: 40 dias (cobre o mês + virada com folga). */
export const LLMCOST_TTL_SECONDS = 40 * 24 * 3600;

/** TTL do Modo Econômico: 6 horas por disparo do breaker. */
export const ECOMODE_TTL_SECONDS = 6 * 3600;

/** Chave do acumulador mensal de custo LLM da org (mês UTC). */
export function llmCostMonthKey(orgId: string, now = new Date()): string {
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `zappiq:llmcost:${orgId}:${ym}`;
}

/** Chave-bandeira do Modo Econômico da org. Existir = modo ativo. */
export function ecoModeKey(orgId: string): string {
  return `zappiq:ecomode:${orgId}`;
}

/**
 * Soma o custo (USD) de uma chamada LLM no acumulador mensal da org.
 * Chamado pelo logLLMCall pra TODA org (a da casa inclusive: o acumulado
 * dela serve de telemetria; o breaker é que nunca arma pra ela).
 * Fail-soft: cache.incrbyfloat devolve null em erro e nada propaga.
 */
export async function recordMonthlyLlmCost(orgId: string, costUsd: number): Promise<void> {
  if (!orgId || !(costUsd > 0)) return;
  const key = llmCostMonthKey(orgId);
  const result = await cache.incrbyfloat(key, costUsd);
  if (result !== null) {
    // Renovar o TTL a cada soma é barato e mantém a chave viva por 40 dias
    // após o último gasto (mais que o suficiente pra fechar o mês).
    await cache.expire(key, LLMCOST_TTL_SECONDS);
  }
}

/**
 * PREMISSA mensal de custo LLM (USD) derivada da franquia do plano.
 * Pura e testável. Retorna null quando o plano não limita mensagens
 * (-1 ilimitado, ex.: ENTERPRISE) ou o valor é inválido: sem franquia
 * não há premissa e o breaker nunca arma.
 */
export function premissaMensalUsd(aiMessagesPerMonth: number | null | undefined): number | null {
  if (
    typeof aiMessagesPerMonth !== 'number' ||
    !Number.isFinite(aiMessagesPerMonth) ||
    aiMessagesPerMonth <= 0
  ) {
    return null;
  }
  const franquiaAtendimentos = aiMessagesPerMonth / MSGS_POR_ATENDIMENTO_PROXY;
  return (franquiaAtendimentos * PREMISSA_BRL_POR_ATENDIMENTO * FATOR_CONTRATO) / USD_BRL_PREMISSA;
}

/**
 * Avalia o breaker no início do turno. Retorna true quando o turno deve
 * rodar em Modo Econômico:
 *   - bandeira `zappiq:ecomode:{orgId}` já existe (breaker armado há <6h); ou
 *   - acumulado do mês > premissa do plano: arma a bandeira (TTL 6h) agora.
 *
 * Nunca pra org da casa. Fail-soft: qualquer erro retorna false (turno
 * normal; preferimos custo a degradar cliente por engano).
 */
export async function evaluateCostBreaker(orgId: string): Promise<boolean> {
  try {
    if (!orgId || isZappIQOrg(orgId)) return false;

    // 1) Bandeira já armada: 1 GET e pronto (caminho quente das 6h).
    const jaAtivo = await cache.get(ecoModeKey(orgId));
    if (jaAtivo !== null) return true;

    // 2) Sem gasto acumulado no mês, nada a comparar.
    const raw = await cache.get(llmCostMonthKey(orgId));
    const spentUsd = raw ? parseFloat(raw) : 0;
    if (!Number.isFinite(spentUsd) || spentUsd <= 0) return false;

    // 3) Premissa do plano da org (1 query só quando há gasto e sem bandeira).
    const org = (await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    })) as { plan?: string } | null;
    if (!org?.plan) return false;

    const config = PLAN_CONFIG[org.plan as PlanId];
    const limiteUsd = premissaMensalUsd(config?.limits?.aiMessagesPerMonth);
    if (limiteUsd === null) return false;

    if (spentUsd > limiteUsd) {
      await cache.set(ecoModeKey(orgId), '1', ECOMODE_TTL_SECONDS);
      logger.warn(
        `[circuitBreaker] Custo LLM do mês estourou a premissa: US$ ${spentUsd.toFixed(4)} > US$ ${limiteUsd.toFixed(4)} (plano ${org.plan}). Modo Econômico armado por 6h.`,
        { orgId },
      );
      return true;
    }
    return false;
  } catch (err: any) {
    logger.warn(`[circuitBreaker] evaluateCostBreaker falhou org=${orgId}: ${err?.message ?? err}`);
    return false;
  }
}
