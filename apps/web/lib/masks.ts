// ═══════════════════════════════════════════════════════════════════
// ZappIQ — Máscaras e validações de documentos brasileiros
// Telefone: +55 11 99999-9999
// CPF: 999.999.999-99
// CNPJ: 99.999.999/9999-99
// ═══════════════════════════════════════════════════════════════════

// ── TELEFONE ──────────────────────────────────────────────────────

/**
 * Formata dígitos como telefone brasileiro: +55 11 99999-9999
 * Auto-preenche "+55" quando o usuário digita apenas DDD + número.
 * Máximo: 13 dígitos (55 + 2 DDD + 9 número)
 */
export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length === 0) return '';
  // Auto-prepend +55 se o usuário não digitou o código do país
  if (!digits.startsWith('55')) {
    digits = ('55' + digits).slice(0, 13);
  }
  if (digits.length <= 2) return `+${digits}`;
  if (digits.length <= 4) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
}

/**
 * Remove formatação e retorna apenas dígitos do telefone
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Valida se telefone tem formato válido (11-13 dígitos com DDD)
 */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 12 && digits.length <= 13;
}

// ── CPF ───────────────────────────────────────────────────────────

/**
 * Formata dígitos como CPF: 999.999.999-99
 * Máximo: 11 dígitos
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Valida CPF com algoritmo oficial (dígitos verificadores)
 * Rejeita CPFs com todos os dígitos iguais (111.111.111-11, etc.)
 */
export function isValidCPF(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Rejeitar CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Validar primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits.charAt(9))) return false;

  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits.charAt(10))) return false;

  return true;
}

// ── CNPJ ──────────────────────────────────────────────────────────

/**
 * Formata dígitos como CNPJ: 99.999.999/9999-99
 * Máximo: 14 dígitos
 */
export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Valida CNPJ com algoritmo oficial (dígitos verificadores)
 * Rejeita CNPJs com todos os dígitos iguais
 */
export function isValidCNPJ(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Rejeitar CNPJs com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Pesos para primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits.charAt(i)) * weights1[i];
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits.charAt(12)) !== firstDigit) return false;

  // Pesos para segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits.charAt(i)) * weights2[i];
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits.charAt(13)) !== secondDigit) return false;

  return true;
}

// ── DOCUMENTO (CPF ou CNPJ) ───────────────────────────────────────

export type PersonType = 'PF' | 'PJ';

/**
 * Formata documento baseado no tipo (PF = CPF, PJ = CNPJ)
 */
export function formatDocument(value: string, type: PersonType): string {
  return type === 'PF' ? formatCPF(value) : formatCNPJ(value);
}

/**
 * Valida documento baseado no tipo
 */
export function isValidDocument(value: string, type: PersonType): boolean {
  return type === 'PF' ? isValidCPF(value) : isValidCNPJ(value);
}

/**
 * Retorna apenas dígitos do documento
 */
export function unformatDocument(value: string): string {
  return value.replace(/\D/g, '');
}
