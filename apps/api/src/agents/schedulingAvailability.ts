/**
 * Cálculo puro de disponibilidade para agendamento (testável, sem I/O).
 *
 * Regra de ouro (anti-alucinação): a IA só oferece horários que ESTE módulo
 * devolve. Ele parte da grade semanal do tipo, aplica antecedência mínima e
 * horizonte, corta o que colide com agendamentos já existentes (+ busy externo)
 * e devolve slots concretos.
 *
 * Datas trafegam em epoch ms (UTC). O chamador converte de/para o fuso do tipo.
 */

export interface WeeklyAvailability {
  timezone?: string;
  weekly?: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string][]>>;
}

export interface BusyInterval {
  startMs: number;
  endMs: number;
}

export interface SlotRules {
  durationMin: number;
  minNoticeMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  futureHorizonDays: number;
  maxPerDay?: number | null;
}

export interface Slot {
  startMs: number;
  endMs: number;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Gera os slots livres. `nowMs` é injetado (nunca Date.now direto) para teste.
 * `dayStartMsUtc(dayOffset)` devolve o epoch ms da meia-noite local do dia
 * (offset a partir de hoje) já convertido para UTC — injetado para não depender
 * de tz do runtime. Assim o cálculo puro não conhece fuso.
 */
export function computeSlots(params: {
  nowMs: number;
  availability: WeeklyAvailability;
  rules: SlotRules;
  busy: BusyInterval[];
  /** meia-noite local do dia (offset dias a partir de hoje) em epoch ms UTC */
  dayStartMsUtc: (dayOffset: number) => number;
  /** dia da semana (0=dom..6=sáb) do dia local em offset */
  dayOfWeek: (dayOffset: number) => number;
  /** teto de slots devolvidos (evita payload gigante) */
  limit?: number;
}): Slot[] {
  const { nowMs, availability, rules, busy, dayStartMsUtc, dayOfWeek } = params;
  const limit = params.limit ?? 20;
  const weekly = availability.weekly || {};
  const durMs = rules.durationMin * 60_000;
  const stepMs = durMs; // slots encostados; buffer aplicado na colisão
  const bufBeforeMs = rules.bufferBeforeMin * 60_000;
  const bufAfterMs = rules.bufferAfterMin * 60_000;
  const earliestMs = nowMs + rules.minNoticeMin * 60_000;

  const slots: Slot[] = [];

  for (let dayOffset = 0; dayOffset <= rules.futureHorizonDays; dayOffset++) {
    if (slots.length >= limit) break;
    const dow = dayOfWeek(dayOffset);
    const windows = weekly[DAY_KEYS[dow]];
    if (!windows || windows.length === 0) continue;

    const midnight = dayStartMsUtc(dayOffset);
    let daySlotCount = 0;

    for (const [startStr, endStr] of windows) {
      const winStartMs = midnight + hhmmToMin(startStr) * 60_000;
      const winEndMs = midnight + hhmmToMin(endStr) * 60_000;

      for (let s = winStartMs; s + durMs <= winEndMs; s += stepMs) {
        if (slots.length >= limit) break;
        if (rules.maxPerDay && daySlotCount >= rules.maxPerDay) break;
        const e = s + durMs;
        if (s < earliestMs) continue; // respeita antecedência mínima

        // Colisão com busy (aplicando buffers): [s-bufBefore, e+bufAfter]
        const guardStart = s - bufBeforeMs;
        const guardEnd = e + bufAfterMs;
        const clash = busy.some((b) => b.startMs < guardEnd && b.endMs > guardStart);
        if (clash) continue;

        slots.push({ startMs: s, endMs: e });
        daySlotCount++;
      }
    }
  }
  return slots;
}

/** Confere se um horário específico pedido pelo cliente está entre os livres. */
export function isSlotFree(requestedStartMs: number, slots: Slot[]): boolean {
  return slots.some((sl) => sl.startMs === requestedStartMs);
}
