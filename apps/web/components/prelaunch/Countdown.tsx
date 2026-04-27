'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * Countdown — V5.3 pré-lançamento
 * --------------------------------------------------------------------------
 * Contagem regressiva pro lançamento oficial: 04 May 2026, 09:00 BRT (UTC-3)
 * Atualiza a cada segundo. Para de atualizar quando chega a zero.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
import s from './prelaunch.module.css';

const TARGET = new Date('2026-05-04T12:00:00Z').getTime();

export function Countdown() {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cells = useMemo(() => {
    const diff = Math.max(0, TARGET - now);
    return [
      { v: Math.floor(diff / 86400000), l: 'Dias' },
      { v: Math.floor((diff % 86400000) / 3600000), l: 'Horas' },
      { v: Math.floor((diff % 3600000) / 60000), l: 'Minutos' },
      { v: Math.floor((diff % 60000) / 1000), l: 'Segundos' },
    ];
  }, [now]);

  return (
    <div
      className={s.countdown}
      role="timer"
      aria-label="Contagem regressiva para o lançamento da ZappIQ"
    >
      {cells.map((c, i) => (
        <div key={i} className={s.cdCell}>
          <div className={s.cdNum}>{String(c.v).padStart(2, '0')}</div>
          <div className={s.cdLbl}>{c.l}</div>
        </div>
      ))}
    </div>
  );
}
