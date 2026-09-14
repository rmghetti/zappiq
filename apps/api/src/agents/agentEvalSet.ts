/* ══════════════════════════════════════════════════════════════════════
 * Agent Eval Set V2 (14/07/2026) — gabarito resolvido por tenant.
 * --------------------------------------------------------------------
 * O QUE MUDOU E POR QUÊ
 *
 * V1 (#235) era uma CONSTANTE: `AGENT_EVAL_SET`, 25 cenários com o comercial
 * da ZappIQ hardcoded (R$ 197 do Starter, zappiq.com.br/agendar, trial de 14
 * dias, "Iza da ZappIQ", verticais bloqueadas). Essa constante era aplicada ao
 * agente de QUALQUER org: rota do cliente, admin e cron semanal.
 *
 * Resultado medido em produção (13/07): a Iza tirava 92-100% e todo cliente
 * tirava 36-60%. A Vera (CMJ) foi reprovada porque "não saúda especificamente
 * a ZappIQ (saudou apenas 'Rod' e mencionou CMJ)", e o suggestFix propôs uma
 * REGRA INVIOLÁVEL mandando ela se apresentar em nome da ZappIQ. Dos 25
 * cenários, 18 não se aplicavam ao CMJ. Nos 7 que aplicavam, ela acertou 6.
 *
 * V2: o gabarito é uma FUNÇÃO do tenant.
 *   - evalSetUniversal.ts → vale pra todos, parametrizado pelo perfil
 *   - evalSetZappIQ.ts    → só pra org canônica da ZappIQ (a Iza)
 *   - cenário que depende de dado não treinado retorna null e não roda
 *
 * O padrão é o mesmo que já protegia os iza_facts em agentOrchestrator.ts:1127.
 *
 * Versionamento: EVAL_SET_VERSION vira 'v2' — as runs antigas ficam
 * identificáveis como feitas sob o gabarito contaminado.
 * ══════════════════════════════════════════════════════════════════════ */

import type { TenantAgentProfile } from './tenantAgentProfile.js';
import type { EvalScenario, EvalCategory } from './evalScenarioTypes.js';
import { UNIVERSAL_EVAL_SET } from './evalSetUniversal.js';
import { ZAPPIQ_EVAL_SET } from './evalSetZappIQ.js';

export const EVAL_SET_VERSION = 'v2';

/**
 * Versão do ARNÊS (gabarito + regras determinísticas + leitura do juiz).
 *
 * EVAL_SET_VERSION diz de quem é o gabarito (v1 era o da ZappIQ aplicado a
 * todo mundo; v2 é por tenant). HARNESS_VERSION diz como se MEDE, e é o que
 * permite comparar nota antiga com nota regravada sem misturar as duas coisas.
 *
 *   1  arnês original (#235).
 *   2  isolamento de tenant (14/07/2026).
 *   3  14/09/2026, num salto só: falha técnica fora da nota (A171); juiz com
 *      leitura tolerante e maxTokens 500 (A050); cr5 alinhado ao CR-6 e sem a
 *      fórmula proibida no histórico (A038, A052); desconto e voz sem
 *      expectativa dupla nem regex que pune a recusa (A040, A041); fronteira
 *      Unicode no nome acentuado (A173); prazo inventado reprovado (A216);
 *      resposta extraída de <reply> como em produção (A088); todo crítico que
 *      não passou contado como crítico (A245).
 *
 * Toda execução nova grava este número em agent_eval_runs.harness_version, e
 * a regravação (eval_regrades) grava o número com que releu o resultado.
 */
export const HARNESS_VERSION = 3;

/** Versões geradas sob o gabarito contaminado (pré-isolamento de tenant). */
export const LEGACY_EVAL_SET_VERSIONS = ['v1', 'v1.1'];

export type { EvalScenario, EvalCategory } from './evalScenarioTypes.js';

/**
 * Monta o gabarito para um tenant.
 *
 * A org da ZappIQ recebe universal + ZappIQ. Qualquer outra recebe SÓ o
 * universal, parametrizado com o nome do agente e da empresa dela.
 *
 * Cenários que retornam null (dado não treinado pelo cliente) são descartados:
 * não entram na conta do score. É por isso que o score do cliente é sempre
 * sobre o que se aplica a ele, e não sobre o que a ZappIQ vende.
 */
export function resolveEvalSet(profile: TenantAgentProfile): EvalScenario[] {
  const factories = profile.isZappIQ
    ? [...UNIVERSAL_EVAL_SET, ...ZAPPIQ_EVAL_SET]
    : UNIVERSAL_EVAL_SET;

  return factories
    .map((factory) => factory(profile))
    .filter((s): s is EvalScenario => s !== null);
}

/**
 * Cenários que NÃO rodaram por falta de dado do cliente, com o motivo.
 * A UI usa isso pra dizer "complete o Treinar IA" em vez de mostrar reprovação.
 */
export function getSkippedScenarios(profile: TenantAgentProfile): Array<{ reason: string }> {
  const skipped: Array<{ reason: string }> = [];
  // A org da ZappIQ tem o próprio cenário de preço (zappiq_preco_starter_correto),
  // alimentado pelo prompt da Iza e pelos iza_facts, então não faz sentido pedir
  // que ela preencha a tabela de preços do survey.
  if (!profile.temPrecos && !profile.isZappIQ) {
    skipped.push({
      reason:
        'Teste de preço não rodou: cadastre a tabela de preços em Treinar IA > Questionário para o agente ser avaliado nisso.',
    });
  }
  return skipped;
}

export function getScenariosByCategory(
  profile: TenantAgentProfile,
  category: EvalCategory,
): EvalScenario[] {
  return resolveEvalSet(profile).filter((s) => s.category === category);
}

export function getCriticalScenarios(profile: TenantAgentProfile): EvalScenario[] {
  return resolveEvalSet(profile).filter((s) => s.severity === 'critical');
}
