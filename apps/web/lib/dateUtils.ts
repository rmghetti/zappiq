/**
 * Utilitários de data para a aplicação.
 */

/**
 * Retorna o período atual em formato YYYY-MM (UTC).
 */
export function currentYearMonth(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Converte uma string YYYY-MM em um Date correspondente ao primeiro dia do mês.
 */
export function monthToDate(yearMonth: string): Date {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
}

/**
 * Formata uma data para pt-BR (DD/MM/YYYY).
 */
export function formatDateBr(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
