/**
 * Cifra simétrica para segredos em repouso (ex.: refresh token do Google
 * Calendar de cada cliente). AES-256-GCM com chave derivada do JWT_SECRET
 * (scrypt), sem dependência externa. Formato: base64(salt|iv|tag|ciphertext).
 */
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(salt: Buffer): Buffer {
  // JWT_SECRET (>=32 chars, garantido pelo schema) como material da chave.
  return scryptSync(env.JWT_SECRET, salt, 32);
}

export function encryptSecret(plaintext: string): string {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(salt);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, ct]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const salt = buf.subarray(0, SALT_LEN);
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ct = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = deriveKey(salt);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
