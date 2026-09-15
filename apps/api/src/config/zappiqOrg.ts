/* ══════════════════════════════════════════════════════════════════════
 * Org canônica da ZappIQ (dogfood da Iza) — fonte única.
 * --------------------------------------------------------------------
 * REGRA DE PRODUTO (fundador, 14/07/2026):
 *
 *   "A Iza deve ser enxergada como um agente apenas da ZappIQ, como se a
 *    ZappIQ fosse um cliente isolado da Plataforma. Todos agentes de
 *    clientes diferentes devem ser tratados de forma isolados."
 *
 * Leia com atenção: a ZappIQ NÃO é a plataforma. Ela é um tenant como
 * qualquer outro, que por acaso hospeda a Iza. O isolamento tem dois eixos:
 *   1. ZappIQ vs cliente  → é o que esta constante resolve.
 *   2. Cliente vs cliente → escopo por organizationId em toda query, RAG por
 *      namespace, e nada de cache em memória sem chave por org.
 *
 * A Iza é o agente conversacional da PRÓPRIA ZappIQ. Ela vende a ZappIQ,
 * conhece os preços da ZappIQ e manda o lead pro cadastro da ZappIQ.
 * Nada disso pode alcançar a org de um cliente: lá quem manda é o agente
 * que o cliente criou (a "Vera" do CMJ, a "Antonella" do restaurante).
 *
 * Antes deste módulo o ID vivia copiado em 4 arquivos (agentOrchestrator,
 * adminLeadsIza, agentEvalCronService, webChatService) e citado em mais 2
 * comentários. Cada cópia era uma chance de alguém esquecer o gate — foi
 * exatamente o que aconteceu com o eval set e com o promptEngine.
 *
 * Regra de uso:
 *   NUNCA compare `organizationId === 'cmo1...'` na mão. Use isZappIQOrg().
 *   Ver tenantIsolationGuard.ts para a trava que barra o vazamento.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Org da ZappIQ em produção (Supabase hwdeezdxyphvxikvgjyf, "ZappIQ-Superadmin").
 * Override por env pra staging/dev poderem apontar pra outra org sem patch.
 */
export const ZAPPIQ_ORG_ID = process.env.ZAPPIQ_ORG_ID || 'cmo1ywwfe00ko1jskexiexsm4';

/** Alias histórico — o código legado chama de IZA_ORG_ID. */
export const IZA_ORG_ID = ZAPPIQ_ORG_ID;

/**
 * true só para a org canônica da ZappIQ (onde a Iza roda).
 * Qualquer outra org é tenant de cliente e NÃO pode receber conteúdo da ZappIQ.
 *
 * Fail-closed: orgId nulo/vazio → false (trata como cliente, o lado seguro).
 */
export function isZappIQOrg(organizationId: string | null | undefined): boolean {
  return Boolean(organizationId) && organizationId === ZAPPIQ_ORG_ID;
}

/**
 * Org da MACHIA em produção: a empresa que FAZ a ZappIQ. Não é a org
 * canônica (a Iza não roda nela), mas a marca ZappIQ é dela por direito.
 */
export const MACHIA_ORG_ID = 'cmrktle9g002epphvb02qbe1r';

/**
 * Organizações com a marca ZappIQ LICENCIADA (rodada 1 do PR #379).
 *
 * Para elas, citar a ZappIQ na resposta ao cliente final NÃO é vazamento:
 * nem alerta, nem bloqueio, como já vale para a org canônica. Hoje só a
 * MACHIA: o perfil vivo dela leva ao prompt respostas do questionário que
 * citam a ZappIQ ("As frentes e ofertas da MACHIA (Radar, Build, ZappIQ,
 * Academy)"), e o agente dela precisa poder dizer "A MACHIA desenvolve a
 * ZappIQ" e mandar o link de preços.
 *
 * A licença é da organização (pelo id), nunca do nome: outra organização
 * que se chame MACHIA segue como cliente comum.
 */
export const ORGS_COM_MARCA_LICENCIADA: readonly string[] = [MACHIA_ORG_ID];

/**
 * true para as organizações da lista acima. A org canônica NÃO está nela:
 * isZappIQOrg já a cobre, e as duas funções são perguntas diferentes.
 *
 * Fail-closed: orgId nulo/vazio → false (cliente comum, o lado seguro).
 */
export function temMarcaLicenciada(organizationId: string | null | undefined): boolean {
  return Boolean(organizationId) && ORGS_COM_MARCA_LICENCIADA.includes(organizationId as string);
}
