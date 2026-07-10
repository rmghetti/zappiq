/**
 * impulsoIntegrations.test.ts — merge seguro das credenciais do Zap Impulso.
 * Parte pura: sem rede/DB. encrypt e genToken são injetados (determinísticos).
 */
import { describe, it, expect } from 'vitest';
import { applyImpulsoIntegration, readImpulsoIntegrationStatus } from './impulsoIntegrations.js';

const deps = {
  encrypt: (s: string) => `enc(${s})`,
  genToken: () => 'WHTOKEN_FIXED',
};

describe('applyImpulsoIntegration — merge das credenciais', () => {
  it('cifra o access token do CAPI e mantém o dataset id em claro', () => {
    const out = applyImpulsoIntegration(null, { capiDatasetId: '123456', capiAccessToken: 'EAAtoken' }, deps);
    expect(out.capiDatasetId).toBe('123456');
    expect(out.capiAccessTokenEnc).toBe('enc(EAAtoken)');
    expect(out.capiAccessToken).toBeUndefined(); // nunca em claro
  });

  it('cifra a API key do Asaas e gera token de webhook na 1ª vez', () => {
    const out = applyImpulsoIntegration({}, { asaasApiKey: '$aas_key' }, deps);
    expect(out.asaasApiKeyEnc).toBe('enc($aas_key)');
    expect(out.asaasWebhookToken).toBe('WHTOKEN_FIXED');
    expect(out.asaasApiKey).toBeUndefined();
  });

  it('não regenera o token de webhook se já existir', () => {
    const out = applyImpulsoIntegration({ asaasWebhookToken: 'JA_EXISTE' }, { asaasApiKey: 'nova' }, deps);
    expect(out.asaasWebhookToken).toBe('JA_EXISTE');
  });

  it('preserva credenciais não enviadas (undefined = não mexe)', () => {
    const prev = { capiDatasetId: 'D', capiAccessTokenEnc: 'enc(old)', outraCoisa: 42 };
    const out = applyImpulsoIntegration(prev, { asaasApiKey: 'k' }, deps);
    expect(out.capiDatasetId).toBe('D');
    expect(out.capiAccessTokenEnc).toBe('enc(old)');
    expect(out.outraCoisa).toBe(42); // não mexe em outras chaves do settings
  });

  it('limpa credencial com null ou string vazia', () => {
    const prev = { capiDatasetId: 'D', capiAccessTokenEnc: 'enc(x)', asaasApiKeyEnc: 'enc(y)' };
    const out = applyImpulsoIntegration(prev, { capiAccessToken: null, asaasApiKey: '  ' }, deps);
    expect(out.capiAccessTokenEnc).toBeUndefined();
    expect(out.asaasApiKeyEnc).toBeUndefined();
    expect(out.capiDatasetId).toBe('D'); // intacto
  });

  it('não muta o objeto original', () => {
    const prev = { capiDatasetId: 'D' };
    const out = applyImpulsoIntegration(prev, { capiDatasetId: 'NOVO' }, deps);
    expect(prev.capiDatasetId).toBe('D');
    expect(out.capiDatasetId).toBe('NOVO');
  });
});

describe('readImpulsoIntegrationStatus — status sem vazar segredo', () => {
  it('CAPI só é "configured" com dataset id E token', () => {
    expect(readImpulsoIntegrationStatus({ capiDatasetId: 'D' }).capi.configured).toBe(false);
    expect(readImpulsoIntegrationStatus({ capiAccessTokenEnc: 'enc' }).capi.configured).toBe(false);
    const full = readImpulsoIntegrationStatus({ capiDatasetId: 'D', capiAccessTokenEnc: 'enc' });
    expect(full.capi).toEqual({ datasetId: 'D', configured: true });
  });

  it('Asaas é "configured" com a API key; devolve o token de webhook para exibir', () => {
    const st = readImpulsoIntegrationStatus({ asaasApiKeyEnc: 'enc', asaasWebhookToken: 'WT' });
    expect(st.asaas).toEqual({ configured: true, webhookToken: 'WT' });
  });

  it('nunca devolve o valor cifrado dos segredos', () => {
    const st = readImpulsoIntegrationStatus({ capiAccessTokenEnc: 'enc(secreto)', asaasApiKeyEnc: 'enc(secreto)' });
    expect(JSON.stringify(st)).not.toContain('secreto');
  });

  it('settings vazio/ inválido não quebra', () => {
    expect(readImpulsoIntegrationStatus(null).capi.configured).toBe(false);
    expect(readImpulsoIntegrationStatus(undefined).asaas.configured).toBe(false);
    expect(readImpulsoIntegrationStatus('x' as unknown).asaas.webhookToken).toBeNull();
  });
});
