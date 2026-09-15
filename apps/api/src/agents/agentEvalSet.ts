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
// C2 (P13): casos de conhecimento gerados do que o cliente cadastrou.
import { cenariosDeConhecimento, avisoDePrecoEmDoisLugares } from './evalSetConhecimento.js';

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
 *   4  14/09/2026, tarefa C2 (Passo 13): juiz de outra família de modelo,
 *      que vê pergunta, histórico e os trechos da base e escreve a evidência
 *      antes do veredito (A039, A208); resposta de modelo diferente do pedido
 *      vira 'inconclusivo', fora da nota (A226); natureza fixa por cenário e
 *      placar em duas partes (P21); casos de conhecimento gerados do conteúdo
 *      do cliente no lugar do cr7_preco_da_base_correto, com 2 repetições
 *      (P13); cenário de cliente insatisfeito (A244); contato fictício sem
 *      nome de gente (A172).
 *
 * Toda execução nova grava este número em agent_eval_runs.harness_version. A
 * regravação (eval_regrades) tem régua PRÓPRIA (REGUA_DA_REGRAVACAO, em
 * services/evalRegradeService.ts): ela relê respostas gravadas com as regras
 * determinísticas da régua 3, e as linhas já regravadas seguem visíveis.
 */
export const HARNESS_VERSION = 4;

/** Versões geradas sob o gabarito contaminado (pré-isolamento de tenant). */
export const LEGACY_EVAL_SET_VERSIONS = ['v1', 'v1.1'];

export type {
  EvalScenario,
  EvalCategory,
  NaturezaDoCenario,
  AcaoDeTreino,
} from './evalScenarioTypes.js';

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

  const fixos = factories
    .map((factory) => factory(profile))
    .filter((s): s is EvalScenario => s !== null);

  // C2 (P13): TODOS os casos de conhecimento do tenant. O rodízio de até 8
  // por execução é aplicado na hora de montar a execução
  // (resolveScenariosForRun), e não aqui: quem procura um cenário pelo id
  // (re-teste, sugestão, aplicar) precisa achar qualquer um deles.
  return [...fixos, ...cenariosDeConhecimento(profile)];
}

/**
 * Cenários que NÃO rodaram por falta de dado do cliente, com o motivo.
 * A UI usa isso pra dizer "complete o Treinar IA" em vez de mostrar reprovação.
 */
export function getSkippedScenarios(profile: TenantAgentProfile): Array<{ reason: string }> {
  const skipped: Array<{ reason: string }> = [];
  // C2 (P13): a parte de CONHECIMENTO nasce do que o dono cadastrou. Sem
  // pergunta e resposta e sem preço, horário, pagamento e endereço no
  // questionário, não há o que testar, e a tela mostra "sem base cadastrada"
  // em vez de uma nota que não mede nada (o agente sem conteúdo tirava 77%).
  //
  // A org da ZappIQ tem os próprios casos de conhecimento (preço dos planos,
  // voz e trial, do catálogo): não faz sentido pedir que ela preencha o
  // questionário para ser testada.
  if (!profile.isZappIQ && cenariosDeConhecimento(profile).length === 0) {
    skipped.push({
      reason:
        'A parte de conhecimento do negócio não rodou: cadastre perguntas e respostas ou preencha ' +
        'preço, horário, formas de pagamento e endereço em Treinar IA para o agente ser testado no ' +
        'que sabe do seu negócio.',
    });
  }
  return skipped;
}

/**
 * Avisos sobre o que foi cadastrado, para a tela da Qualidade (C2).
 *
 * Hoje um só: o preço em dois lugares com valores diferentes (A086). O
 * prompt da Vera, editado à mão em 09/09, diz R$ 6.300 e o questionário diz
 * R$ 35.000: o agente responde qualquer um dos dois e o juiz chamava de
 * inventado o que estava no prompt.
 */
export function avisosDoTeste(profile: TenantAgentProfile): string[] {
  if (profile.isZappIQ) return [];
  const aviso = avisoDePrecoEmDoisLugares(
    profile.systemPrompt,
    profile.fatos?.precos ?? profile.precos,
  );
  return aviso ? [aviso] : [];
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
