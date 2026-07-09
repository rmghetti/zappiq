import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);
});

describe('crypto (AES-256-GCM)', () => {
  it('encrypt→decrypt roundtrip devolve o original', async () => {
    const { encryptSecret, decryptSecret } = await import('./crypto.js');
    const secret = 'refresh-token-abc.123_XYZ';
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret); // não vaza em claro
    expect(decryptSecret(enc)).toBe(secret);
  });

  it('cada cifragem usa salt/iv novos (payloads diferentes p/ mesmo texto)', async () => {
    const { encryptSecret, decryptSecret } = await import('./crypto.js');
    const a = encryptSecret('mesmo');
    const b = encryptSecret('mesmo');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('mesmo');
    expect(decryptSecret(b)).toBe('mesmo');
  });

  it('payload adulterado falha (autenticação GCM)', async () => {
    const { encryptSecret, decryptSecret } = await import('./crypto.js');
    const enc = encryptSecret('sensível');
    const tampered = Buffer.from(enc, 'base64');
    tampered[tampered.length - 1] ^= 0xff; // corrompe o ciphertext
    expect(() => decryptSecret(tampered.toString('base64'))).toThrow();
  });
});
