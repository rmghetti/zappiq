/**
 * asaasPix.test.ts — Pix na conversa (Impulso) via PSP Asaas.
 * ============================================================================
 * Cobre as partes PURAS: gate por tier (Pro+), montagem do payload da cobrança,
 * parsing do QR dinâmico (copia-e-cola + imagem), reconciliação por
 * externalReference (para achar org/deal no webhook sem tabela nova) e o mapa
 * de eventos do Asaas -> pago/pendente. Nada aqui move dinheiro nem chama rede.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  pixAllowedForTier,
  buildPixReference,
  parsePixReference,
  buildAsaasPixPayload,
  parseAsaasQrResponse,
  asaasEventToOutcome,
  formatPixMessage,
} from './asaasPix.js';

describe('pixAllowedForTier — Pix é Pro+', () => {
  it('libera Pro e Scale', () => {
    expect(pixAllowedForTier('IMPULSO_PRO')).toBe(true);
    expect(pixAllowedForTier('IMPULSO_SCALE')).toBe(true);
  });
  it('bloqueia Start, alpha/trial (tier null) e desconhecido', () => {
    expect(pixAllowedForTier('IMPULSO_START')).toBe(false);
    expect(pixAllowedForTier(null)).toBe(false);
    expect(pixAllowedForTier('alpha')).toBe(false);
  });
});

describe('reference — reconciliação org/deal sem tabela nova', () => {
  it('constrói e parseia o externalReference', () => {
    const ref = buildPixReference('org1', 'deal1');
    expect(ref).toBe('impulso-pix:org1:deal1');
    expect(parsePixReference(ref)).toEqual({ orgId: 'org1', dealId: 'deal1' });
  });
  it('rejeita referências inválidas', () => {
    expect(parsePixReference('garbage')).toBeNull();
    expect(parsePixReference('impulso-pix:org1')).toBeNull();
    expect(parsePixReference('outro:org1:deal1')).toBeNull();
    expect(parsePixReference(123 as any)).toBeNull();
  });
});

describe('buildAsaasPixPayload — corpo da cobrança PIX', () => {
  it('monta o payload no formato do Asaas', () => {
    const body = buildAsaasPixPayload({
      customerId: 'cus_1', value: 150.5, description: 'Pedido #9', referenceId: 'impulso-pix:o:d', dueDate: '2026-07-10',
    });
    expect(body).toEqual({
      customer: 'cus_1', billingType: 'PIX', value: 150.5, dueDate: '2026-07-10',
      externalReference: 'impulso-pix:o:d', description: 'Pedido #9',
    });
  });
});

describe('parseAsaasQrResponse — QR dinâmico', () => {
  it('extrai copia-e-cola, imagem e expiração', () => {
    const r = parseAsaasQrResponse({ encodedImage: 'BASE64PNG', payload: '00020126...br.gov.bcb.pix', expirationDate: '2026-07-10 23:59:59' });
    expect(r).toEqual({ payload: '00020126...br.gov.bcb.pix', qrImageBase64: 'BASE64PNG', expiresAt: '2026-07-10 23:59:59' });
  });
  it('retorna null quando falta o copia-e-cola', () => {
    expect(parseAsaasQrResponse({ encodedImage: 'x' } as any)).toBeNull();
    expect(parseAsaasQrResponse(null)).toBeNull();
  });
});

describe('asaasEventToOutcome — mapa de eventos', () => {
  it('PAYMENT_RECEIVED e PAYMENT_CONFIRMED = pago', () => {
    expect(asaasEventToOutcome('PAYMENT_RECEIVED')).toBe('paid');
    expect(asaasEventToOutcome('PAYMENT_CONFIRMED')).toBe('paid');
  });
  it('criado/pendente = pending; resto = other', () => {
    expect(asaasEventToOutcome('PAYMENT_CREATED')).toBe('pending');
    expect(asaasEventToOutcome('PAYMENT_OVERDUE')).toBe('other');
    expect(asaasEventToOutcome('')).toBe('other');
  });
});

describe('formatPixMessage — mensagem na conversa', () => {
  it('inclui o copia-e-cola e o valor', () => {
    const msg = formatPixMessage({ payload: '00020126BR', value: 150.5, description: 'Pedido #9' });
    expect(msg).toContain('00020126BR');
    expect(msg).toContain('150,50');
    expect(msg).toContain('Pedido #9');
  });
});
