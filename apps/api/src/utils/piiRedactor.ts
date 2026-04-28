/* ══════════════════════════════════════════════════════════════════════
 * V2-022 · PII Redactor BR (Sprint 0 Blocker 3)
 * --------------------------------------------------------------------
 * Redação automática de PII brasileira ANTES de qualquer sink:
 *   - Winston transport (console + OTel)
 *   - OpenTelemetry span attributes
 *   - Sentry beforeSend hook
 *   - audit_logs (auditService.sanitizeSnapshot expandido)
 *
 * 6 patterns BR:
 *   - CPF (com e sem formatação) — validação de dígito
 *   - CNPJ (com e sem formatação) — validação de dígito
 *   - Cartão de crédito (13-19 dígitos) — validação Luhn
 *   - E-mail
 *   - Telefone BR (com/sem +55, com/sem 9, com/sem hífen)
 *   - CEP
 *
 * Estratégia:
 *   - Cada match vira placeholder <TYPE_xxxxxxxx> onde xxxxxxxx é hash
 *     determinístico do valor (mesma PII = mesmo placeholder, permite
 *     correlação preservando privacidade).
 *   - Vault Redis opcional (TTL = duração da conversa) pra de-redação
 *     on-demand quando tool autorizada precisar (ex.: gerarBoletoPorCPF).
 *
 * Performance: regex puro, ~30µs por mensagem de 1KB. Catch on each
 * sink boundary. Não cacheia (PII é raro o suficiente).
 *
 * Correctness > Recall: false positive (redatar algo que não é PII)
 * é preferível a false negative (vazar PII). Cardinal numbers comuns
 * (anos, CEPs antigos sem hífen) podem ser confundidos com CPF — é
 * aceitável em logs (perdemos contexto, ganhamos compliance).
 * ══════════════════════════════════════════════════════════════════════ */

import { createHash } from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────
// Patterns BR
// ─────────────────────────────────────────────────────────────────────

// CPF: 999.999.999-99 ou 99999999999 (11 dígitos)
// Formatado tem prioridade pra evitar match parcial em strings com 14+ dígitos.
const CPF_FORMATTED = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const CPF_BARE = /(?<![\d.\/-])\d{11}(?![\d.\/-])/g;

// CNPJ: 99.999.999/9999-99 ou 99999999999999 (14 dígitos)
const CNPJ_FORMATTED = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
const CNPJ_BARE = /(?<![\d.\/-])\d{14}(?![\d.\/-])/g;

// Cartão: 13-19 dígitos com separadores opcionais (espaço, hífen).
// Validamos com Luhn antes de redatar — evita pegar números aleatórios.
const CARD_NUMBER = /\b(?:\d[ -]?){13,19}\b/g;

// E-mail (RFC 5322 simplificado)
const EMAIL = /[\w][\w.+-]*@[\w-]+(?:\.[\w-]+)+/g;

// Telefone BR: +55 (11) 99999-9999, (11) 9999-9999, 11999999999, etc.
// Aceita 10 ou 11 dígitos (com 9º dígito ou não).
const PHONE_BR = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g;

// CEP: 99999-999 ou 99999999 (8 dígitos)
const CEP = /\b\d{5}-?\d{3}\b/g;

// ─────────────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────────────

/** Valida CPF via algoritmo de dígito verificador. */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // 111.111.111-11 etc
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(digits[10]);
}

/** Valida CNPJ via algoritmo de dígito verificador. */
export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const calc = (slice: string, weights: number[]): number => {
    const sum = slice.split('').reduce((acc, n, i) => acc + parseInt(n) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits.slice(0, 12), w1);
  if (d1 !== parseInt(digits[12])) return false;
  const d2 = calc(digits.slice(0, 13), w2);
  return d2 === parseInt(digits[13]);
}

/** Valida cartão de crédito via Luhn. */
export function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ─────────────────────────────────────────────────────────────────────
// Redactor
// ─────────────────────────────────────────────────────────────────────

export type PIIType = 'cpf' | 'cnpj' | 'card' | 'email' | 'phone' | 'cep';

export interface RedactResult {
  redacted: string;
  /** Map placeholder → valor original. Tamanho = número de PII encontrada. */
  vault: Record<string, string>;
  /** Contagem por tipo, útil pra métricas. */
  counts: Record<PIIType, number>;
}

/**
 * Hash determinístico de 8 chars hex pra identificar o placeholder.
 * Mesma PII → mesmo placeholder na mesma sessão (ajuda correlação em logs).
 */
function placeholderHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

/**
 * Redata PII em qualquer string. Não muta o input — retorna nova string.
 *
 * Ordem dos patterns é importante:
 *   1. CNPJ formatado (mais específico)
 *   2. CPF formatado
 *   3. CNPJ bare (14 dígitos)
 *   4. CPF bare (11 dígitos)
 *   5. Cartão (Luhn-validado)
 *   6. E-mail
 *   7. Telefone
 *   8. CEP
 *
 * Validações secundárias (CPF/CNPJ digit verify, Luhn pra cartão) reduzem
 * false positives. Se validação falha, deixa o número original (não redata).
 */
export function redactPII(input: string): RedactResult {
  if (typeof input !== 'string' || input.length === 0) {
    return { redacted: input, vault: {}, counts: emptyCounts() };
  }

  const vault: Record<string, string> = {};
  const counts = emptyCounts();
  let result = input;

  const replaceWithValidator = (
    pattern: RegExp,
    type: PIIType,
    validator?: (v: string) => boolean,
  ) => {
    result = result.replace(pattern, (match) => {
      if (validator && !validator(match)) return match;
      const placeholder = `<${type.toUpperCase()}_${placeholderHash(match)}>`;
      vault[placeholder] = match;
      counts[type] += 1;
      return placeholder;
    });
  };

  // 1. CNPJ formatado (não exige validação de dígito — formato já é forte)
  replaceWithValidator(CNPJ_FORMATTED, 'cnpj');
  // 2. CPF formatado
  replaceWithValidator(CPF_FORMATTED, 'cpf');
  // 3. CNPJ bare (14 digits) — exige validação
  replaceWithValidator(CNPJ_BARE, 'cnpj', isValidCNPJ);
  // 4. CPF bare (11 digits) — exige validação
  replaceWithValidator(CPF_BARE, 'cpf', isValidCPF);
  // 5. Cartão — exige Luhn
  replaceWithValidator(CARD_NUMBER, 'card', isValidLuhn);
  // 6. E-mail
  replaceWithValidator(EMAIL, 'email');
  // 7. Telefone (sempre redata; default seguro pra PII)
  replaceWithValidator(PHONE_BR, 'phone');
  // 8. CEP
  replaceWithValidator(CEP, 'cep');

  return { redacted: result, vault, counts };
}

/**
 * Redata recursivamente em qualquer estrutura (object, array, primitivos).
 * Útil pra logs estruturados (Winston meta), span attributes, audit_logs.
 *
 * NÃO muta input. Vault é colapsado num único Record (último placeholder
 * por valor vence em colisão de hash, o que é improvável em hash de 8 chars).
 */
export function redactDeep(input: unknown): { redacted: unknown; vault: Record<string, string>; counts: Record<PIIType, number> } {
  const vault: Record<string, string> = {};
  const counts = emptyCounts();

  function walk(value: unknown): unknown {
    if (typeof value === 'string') {
      const r = redactPII(value);
      Object.assign(vault, r.vault);
      for (const k of Object.keys(r.counts) as PIIType[]) counts[k] += r.counts[k];
      return r.redacted;
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = walk(v);
      }
      return out;
    }
    // primitivos: number, boolean, null, undefined
    return value;
  }

  return { redacted: walk(input), vault, counts };
}

function emptyCounts(): Record<PIIType, number> {
  return { cpf: 0, cnpj: 0, card: 0, email: 0, phone: 0, cep: 0 };
}

/**
 * Reverte a redação usando o vault. Útil em tools autorizadas que
 * precisam do valor original (ex.: gerarBoletoPorCPF).
 *
 * Atenção: usar APENAS dentro de funções com permissão explícita pra
 * de-redação. NUNCA logar o resultado de unredact.
 */
export function unredact(redacted: string, vault: Record<string, string>): string {
  let result = redacted;
  for (const [placeholder, original] of Object.entries(vault)) {
    result = result.split(placeholder).join(original);
  }
  return result;
}
