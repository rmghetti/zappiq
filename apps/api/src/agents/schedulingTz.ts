/**
 * Helpers de fuso horário para agendamento. Usam a Intl API (sem libs) para
 * mapear "meia-noite local do dia X no fuso Z" -> epoch ms UTC, e o dia da
 * semana local. Isolado + testável.
 */

/** Offset (ms) do fuso `tz` em relação a UTC no instante `atMs`. */
export function tzOffsetMs(tz: string, atMs: number): number {
  // Formata o instante no fuso alvo e reconstrói como se fosse UTC; a diferença
  // é o offset. Técnica padrão sem dependências.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = dtf.formatToParts(new Date(atMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asUtc - atMs;
}

/**
 * Epoch ms UTC da meia-noite local (00:00) do dia que está `dayOffset` dias à
 * frente de `nowMs`, no fuso `tz`.
 */
export function localMidnightUtcMs(tz: string, nowMs: number, dayOffset: number): number {
  // Data local de hoje no fuso
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = dtf.format(new Date(nowMs)).split('-').map(Number);
  // Meia-noite local do dia+offset, tratada primeiro como se fosse UTC…
  const naiveUtc = Date.UTC(y, m - 1, d + dayOffset, 0, 0, 0);
  // …e corrigida pelo offset do fuso naquele instante (aprox. estável salvo DST no minuto exato).
  return naiveUtc - tzOffsetMs(tz, naiveUtc);
}

/** Dia da semana (0=dom..6=sáb) do dia local com `dayOffset` no fuso `tz`. */
export function localDayOfWeek(tz: string, nowMs: number, dayOffset: number): number {
  const midnight = localMidnightUtcMs(tz, nowMs, dayOffset);
  // getUTCDay do meio-dia local evita virada por segundos de offset
  return new Date(midnight + 12 * 3_600_000).getUTCDay();
}

/** Formata um epoch ms no fuso, pt-BR, para apresentar ao cliente. */
export function fmtLocal(tz: string, ms: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ms));
}
