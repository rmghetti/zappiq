/**
 * W1.3 (segurança) — mass assignment + vazamento de segredo em /api/settings.
 *
 * Abordagem: teste puro (vitest, zero I/O) sobre os helpers extraídos do route
 * handler (o repo não tem harness supertest; server.ts puxa Redis/OTel/BullMQ).
 * O handler PUT é um wrapper fino em cima de `updateSettingsSchema.safeParse`;
 * o GET é um wrapper em cima de `redactOrgSecrets`. Testamos exatamente esses
 * dois contratos de segurança.
 */
import { describe, it, expect } from 'vitest';
import {
  updateSettingsSchema,
  redactOrgSecrets,
  SETTINGS_REDACTED_FIELDS,
  channelCredentialsSchema,
} from './settings.schema.js';

// ── PUT: whitelist bloqueia mass assignment ─────────────────────────────────
describe('updateSettingsSchema — anti mass assignment', () => {
  it('aceita campos legítimos do cliente', () => {
    const r = updateSettingsSchema.safeParse({
      name: 'Nova Org',
      settings: { tone: 'formal' },
      dpoEmail: 'dpo@example.com',
      auditRetentionDays: 365,
      softDeleteRetentionDays: 90,
    });
    expect(r.success).toBe(true);
  });

  it('REJEITA plan no body (auto-promoção a ENTERPRISE)', () => {
    const r = updateSettingsSchema.safeParse({ name: 'X', plan: 'ENTERPRISE' });
    expect(r.success).toBe(false);
  });

  it('REJEITA campos de trial (extensão grátis)', () => {
    for (const field of ['trialEndsAt', 'trialConverted', 'isTrialActive', 'trialCostCapUsd']) {
      const r = updateSettingsSchema.safeParse({ [field]: field === 'trialEndsAt' ? new Date().toISOString() : true });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA subscription/billing forjado', () => {
    for (const field of ['subscriptionStatus', 'billingCycle']) {
      const r = updateSettingsSchema.safeParse({ [field]: 'active' });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA stripe* (fonte de verdade de conta pagante)', () => {
    for (const field of ['stripeCustomerId', 'stripeSubscriptionId', 'paidAt', 'churnedAt']) {
      const r = updateSettingsSchema.safeParse({ [field]: 'cus_hack' });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA escrita direta em segredos de canal', () => {
    for (const field of SETTINGS_REDACTED_FIELDS) {
      const r = updateSettingsSchema.safeParse({ [field]: 'roubado' });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA payload misto (campo válido + plan) por causa do .strict()', () => {
    const r = updateSettingsSchema.safeParse({ name: 'OK', plan: 'ENTERPRISE' });
    expect(r.success).toBe(false);
  });

  it('não deixa passar plan pelo output mesmo quando presente', () => {
    const r = updateSettingsSchema.safeParse({ name: 'OK', plan: 'ENTERPRISE' });
    if (r.success) {
      // guard defensivo: se algum dia virar não-strict, o output não pode conter plan
      expect((r.data as any).plan).toBeUndefined();
    } else {
      expect(r.success).toBe(false);
    }
  });
});

// ── GET: redação de segredos ────────────────────────────────────────────────
describe('redactOrgSecrets — não vazar segredos de canal', () => {
  const orgLike = {
    id: 'org_1',
    name: 'Acme',
    plan: 'STARTER',
    settings: {},
    whatsappAccessToken: 'wa-secret',
    instagramAccessToken: 'ig-secret',
    metaAppSecret: 'meta-secret',
    dpoEmail: 'dpo@acme.com',
  };

  it('remove whatsappAccessToken / instagramAccessToken / metaAppSecret', () => {
    const out = redactOrgSecrets(orgLike);
    expect(out).not.toHaveProperty('whatsappAccessToken');
    expect(out).not.toHaveProperty('instagramAccessToken');
    expect(out).not.toHaveProperty('metaAppSecret');
  });

  it('preserva campos não sensíveis', () => {
    const out = redactOrgSecrets(orgLike);
    expect(out.id).toBe('org_1');
    expect(out.name).toBe('Acme');
    expect(out.dpoEmail).toBe('dpo@acme.com');
  });

  it('não muta o objeto original', () => {
    redactOrgSecrets(orgLike);
    expect(orgLike.whatsappAccessToken).toBe('wa-secret');
  });

  it('é seguro quando os segredos já estão ausentes', () => {
    const out = redactOrgSecrets({ id: 'x', name: 'y' });
    expect(out).toEqual({ id: 'x', name: 'y' });
  });
});

// ── PUT /channels: rota DEDICADA de credenciais de canal ────────────────────
// O "traga seu token" precisa gravar whatsapp*/instagram*/metaAppSecret, que o
// updateSettingsSchema (.strict) barra de propósito. Aqui a whitelist própria:
// aceita SÓ os campos de canal + a intenção; plan/trial/stripe seguem impossíveis.
describe('channelCredentialsSchema — save de canal (traga seu token)', () => {
  it('aceita credenciais de WhatsApp + Instagram + intenção', () => {
    const r = channelCredentialsSchema.safeParse({
      channelActivation: 'both',
      whatsappPhoneNumberId: '123456789012345',
      whatsappBusinessAccountId: '987654321',
      whatsappAccessToken: 'EAAG-token',
      instagramAccountId: '17841400000000000',
      instagramPageId: '555',
      instagramAccessToken: 'EAAG-igtoken',
      metaAppSecret: 'a'.repeat(32),
    });
    expect(r.success).toBe(true);
  });

  it('aceita salvar só um canal (campos opcionais)', () => {
    const r = channelCredentialsSchema.safeParse({
      channelActivation: 'whatsapp',
      whatsappPhoneNumberId: '123',
      whatsappAccessToken: 'tok',
    });
    expect(r.success).toBe(true);
  });

  it('aceita null para limpar um campo', () => {
    const r = channelCredentialsSchema.safeParse({ whatsappAccessToken: null });
    expect(r.success).toBe(true);
  });

  it('REJEITA mass assignment (mesma tabela organizations: plan/trial/stripe/quota)', () => {
    for (const field of ['plan', 'trialEndsAt', 'subscriptionStatus', 'stripeCustomerId', 'aiReadinessScore']) {
      const r = channelCredentialsSchema.safeParse({ whatsappPhoneNumberId: '123', [field]: 'x' });
      expect(r.success, `${field} deveria ser rejeitado`).toBe(false);
    }
  });

  it('REJEITA channelActivation inválido', () => {
    const r = channelCredentialsSchema.safeParse({ channelActivation: 'telegram' });
    expect(r.success).toBe(false);
  });

  it('REJEITA campo desconhecido (.strict())', () => {
    const r = channelCredentialsSchema.safeParse({ foo: 'bar' });
    expect(r.success).toBe(false);
  });
});
