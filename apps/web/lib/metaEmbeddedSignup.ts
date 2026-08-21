/**
 * metaEmbeddedSignup: decisão PURA do Embedded Signup do WhatsApp (v2 x v4).
 *
 * Contexto (Resposta Meta 2026 / PR-G): a Meta depreciou a v2 do Embedded
 * Signup com corte em 15/10/2026. Na v4, a configuração nasce no painel como
 * Facebook Login for Business (variante WhatsApp Embedded Signup, selecionando
 * os produtos) e o FB.login passa a mandar extras apenas { setup: {} }, sem
 * featureType nem sessionInfoVersion. O rollout é flag-gated pela env
 * NEXT_PUBLIC_META_CONFIG_ID_V4: com ela setada usamos a v4; sem ela, o fluxo
 * v2 atual segue byte a byte igual.
 *
 * Lógica pura no padrão de lib/postOAuthDecision.ts: testável sem DOM.
 * Rodar: pnpm --filter @zappiq/web test
 */

export interface WhatsAppSignupLoginConfig {
  /** Versão efetiva do fluxo, útil para log e teste. */
  version: 'v2' | 'v4';
  /** config_id passado ao FB.login. */
  configId: string;
  /** Objeto `extras` passado ao FB.login, exatamente como a versão exige. */
  extras: Record<string, unknown>;
}

/**
 * Decide config_id + extras do FB.login do WhatsApp.
 *
 * @param v2ConfigId  config_id atual (NEXT_PUBLIC_META_CONFIG_ID ou fallback).
 * @param rawV4ConfigId  valor cru de NEXT_PUBLIC_META_CONFIG_ID_V4 (pode vir
 *                       undefined ou com espaços; vazio significa "sem v4").
 */
export function resolveWhatsAppSignupConfig(
  v2ConfigId: string,
  rawV4ConfigId: string | undefined | null,
): WhatsAppSignupLoginConfig {
  const v4ConfigId = (rawV4ConfigId || '').trim();
  if (v4ConfigId) {
    // v4: só { setup: {} }. featureType/sessionInfoVersion eram da v2 e a Meta
    // os aposentou na configuração nova de Facebook Login for Business.
    return { version: 'v4', configId: v4ConfigId, extras: { setup: {} } };
  }
  // v2 (depreciada em 15/10/2026): preserva os extras atuais sem mudar nada.
  return {
    version: 'v2',
    configId: v2ConfigId,
    extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
  };
}
