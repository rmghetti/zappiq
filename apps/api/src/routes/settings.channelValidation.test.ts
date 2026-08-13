/**
 * settings.channelValidation.test.ts — validação de formato das credenciais
 * ============================================================================
 * Auditoria 13/08: o channelCredentialsSchema só checava tipo e tamanho
 * máximo. "abc" passava como Phone Number ID e o cliente lia "Credenciais
 * salvas!" com credencial impossível.
 *
 * Aperto: IDs da Meta são numéricos (5-32 dígitos); tokens têm tamanho mínimo.
 * ""/null continuam passando (limpar campo é legítimo) e campos omitidos
 * continuam opcionais (o save parcial da UI depende disso).
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { channelCredentialsSchema } from './settings.schema.js';

describe('channelCredentialsSchema — formato dos IDs', () => {
  it('Phone Number ID com letras é rejeitado', () => {
    const r = channelCredentialsSchema.safeParse({ whatsappPhoneNumberId: '123abc' });
    expect(r.success).toBe(false);
  });

  it('Phone Number ID com espaços é rejeitado', () => {
    const r = channelCredentialsSchema.safeParse({ whatsappPhoneNumberId: '123 456 789' });
    expect(r.success).toBe(false);
  });

  it('IDs numéricos válidos passam (WA + IG)', () => {
    const r = channelCredentialsSchema.safeParse({
      whatsappPhoneNumberId: '123456789012345',
      whatsappBusinessAccountId: '987654321098765',
      instagramAccountId: '17841400000000000',
      instagramPageId: '111222333444555',
    });
    expect(r.success).toBe(true);
  });

  it('Instagram Account ID com letras é rejeitado', () => {
    const r = channelCredentialsSchema.safeParse({ instagramAccountId: 'minha-conta' });
    expect(r.success).toBe(false);
  });

  it('"" e null continuam passando (limpar campo é legítimo)', () => {
    expect(channelCredentialsSchema.safeParse({ whatsappPhoneNumberId: '' }).success).toBe(true);
    expect(channelCredentialsSchema.safeParse({ whatsappPhoneNumberId: null }).success).toBe(true);
    expect(channelCredentialsSchema.safeParse({ instagramAccountId: null }).success).toBe(true);
  });

  it('campos omitidos seguem opcionais (save parcial da UI)', () => {
    expect(channelCredentialsSchema.safeParse({ channelActivation: 'whatsapp' }).success).toBe(true);
    expect(channelCredentialsSchema.safeParse({}).success).toBe(true);
  });
});

describe('channelCredentialsSchema — tokens', () => {
  it('token curto demais é rejeitado (colou pedaço do token)', () => {
    const r = channelCredentialsSchema.safeParse({ whatsappAccessToken: 'EAAB123' });
    expect(r.success).toBe(false);
  });

  it('token realista passa', () => {
    const r = channelCredentialsSchema.safeParse({
      whatsappAccessToken: 'EAAB'.padEnd(180, 'x'),
      instagramAccessToken: 'IGQV'.padEnd(120, 'y'),
    });
    expect(r.success).toBe(true);
  });

  it('App Secret curto demais é rejeitado', () => {
    expect(channelCredentialsSchema.safeParse({ metaAppSecret: 'abc' }).success).toBe(false);
  });

  it('App Secret de 32 hex passa', () => {
    expect(
      channelCredentialsSchema.safeParse({ metaAppSecret: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' }).success,
    ).toBe(true);
  });

  it('limpar token com "" / null continua permitido', () => {
    expect(channelCredentialsSchema.safeParse({ whatsappAccessToken: '' }).success).toBe(true);
    expect(channelCredentialsSchema.safeParse({ instagramAccessToken: null }).success).toBe(true);
    expect(channelCredentialsSchema.safeParse({ metaAppSecret: null }).success).toBe(true);
  });
});
