/**
 * Maestro v3 (Spec 1A) — avaliação de horário comercial. PURO.
 * Recebe 'now' (Date) injetado; calcula dia/hora no timezone do config via Intl.
 * Fail-closed: config/now ausentes → fechado.
 */
import type { BusinessHoursConfig } from './flowEngine.js';

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isOpen(config: BusinessHoursConfig | null | undefined, now: Date | null | undefined): boolean {
  if (!config || !now || !config.days) return false;
  let parts: Record<string, string>;
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone || 'America/Sao_Paulo',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    parts = Object.fromEntries(dtf.formatToParts(now).map((p) => [p.type, p.value]));
  } catch {
    return false; // timezone inválido → fail-closed
  }
  const day = WD[parts.weekday];
  if (day === undefined) return false;
  const win = config.days[day];
  if (!win || !win.open || !win.close) return false;
  // '24:00' que alguns ambientes emitem à meia-noite → normaliza p/ '00:00'
  const hh = parts.hour === '24' ? '00' : parts.hour;
  const cur = `${hh}:${parts.minute}`; // 'HH:mm' zero-padded → comparável lexicograficamente
  const { open, close } = win;
  if (open === close) return false;
  if (open < close) return cur >= open && cur < close;
  // vira-noite: aberto se >= open (noite) OU < close (madrugada)
  return cur >= open || cur < close;
}
