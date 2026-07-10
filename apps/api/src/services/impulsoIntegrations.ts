/*
 * impulsoIntegrations — mescla segura das credenciais de integração do Zap
 * Impulso (Meta CAPI + Asaas Pix) dentro de org.settings.
 *
 * Regra de segurança: os segredos (access token do CAPI, API key do Asaas)
 * NUNCA são gravados em claro — entram cifrados via `encrypt` (AES-256-GCM,
 * injetado). O dataset id do CAPI é um identificador público, fica em claro.
 * O token do webhook do Asaas autentica o retorno Asaas→nós; é gerado por nós
 * (para o cliente colar no painel do Asaas) e devolvido no status para exibição.
 *
 * A parte pura (merge + leitura de status) vive aqui, testável sem rede/DB.
 * Só sobrescreve um campo quando o input traz aquele campo (undefined = não
 * mexe; null/"" = limpa), permitindo salvar uma credencial de cada vez.
 */

export interface ImpulsoIntegrationInput {
  capiDatasetId?: string | null;
  capiAccessToken?: string | null; // texto puro; será cifrado
  asaasApiKey?: string | null;      // texto puro; será cifrado
  asaasWebhookToken?: string | null; // override manual (raro); senão gerado
}

export interface ImpulsoIntegrationStatus {
  capi: { datasetId: string | null; configured: boolean };
  asaas: { configured: boolean; webhookToken: string | null };
}

export interface ImpulsoIntegrationDeps {
  encrypt: (plaintext: string) => string;
  genToken: () => string;
}

const trimOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

/**
 * Aplica o input de integração sobre o settings atual e devolve o NOVO objeto
 * settings (não muta o original). Cifra os segredos via deps.encrypt. Ao
 * configurar o Asaas pela primeira vez, gera um token de webhook se ainda não
 * houver.
 */
export function applyImpulsoIntegration(
  currentSettings: Record<string, any> | null | undefined,
  input: ImpulsoIntegrationInput,
  deps: ImpulsoIntegrationDeps,
): Record<string, any> {
  const next: Record<string, any> = { ...(currentSettings || {}) };

  // Meta CAPI — dataset id (público, em claro)
  if (input.capiDatasetId !== undefined) {
    const v = trimOrNull(input.capiDatasetId);
    if (v) next.capiDatasetId = v;
    else delete next.capiDatasetId;
  }

  // Meta CAPI — access token (segredo, cifrado)
  if (input.capiAccessToken !== undefined) {
    const v = trimOrNull(input.capiAccessToken);
    if (v) next.capiAccessTokenEnc = deps.encrypt(v);
    else delete next.capiAccessTokenEnc;
  }

  // Asaas — API key (segredo, cifrado)
  if (input.asaasApiKey !== undefined) {
    const v = trimOrNull(input.asaasApiKey);
    if (v) {
      next.asaasApiKeyEnc = deps.encrypt(v);
      // Gera token de webhook na 1ª configuração do Asaas (se ainda não houver).
      if (!trimOrNull(next.asaasWebhookToken)) next.asaasWebhookToken = deps.genToken();
    } else {
      delete next.asaasApiKeyEnc;
    }
  }

  // Asaas — token de webhook (override manual explícito)
  if (input.asaasWebhookToken !== undefined) {
    const v = trimOrNull(input.asaasWebhookToken);
    if (v) next.asaasWebhookToken = v;
    else delete next.asaasWebhookToken;
  }

  return next;
}

/**
 * Lê o status das integrações a partir do settings — SEM expor os segredos
 * cifrados. Devolve só booleanos + o dataset id (público) + o token de webhook
 * (que o cliente precisa copiar para o painel do Asaas).
 */
export function readImpulsoIntegrationStatus(settings: unknown): ImpulsoIntegrationStatus {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, any>;
  const datasetId = trimOrNull(s.capiDatasetId);
  const capiTokenSet = !!trimOrNull(s.capiAccessTokenEnc);
  const asaasKeySet = !!trimOrNull(s.asaasApiKeyEnc);
  return {
    capi: { datasetId, configured: !!datasetId && capiTokenSet },
    asaas: { configured: asaasKeySet, webhookToken: trimOrNull(s.asaasWebhookToken) },
  };
}
