'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * IzaChatStream: V5.3 pré-lançamento
 * --------------------------------------------------------------------------
 * Conversa animada da Iza atendendo a clínica "Sorriso & Cia" no WhatsApp.
 * Cenário consistente com a home V5 (mesma persona/contexto).
 * Auto-cycle: completa o roteiro e reinicia depois de 4s.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import s from './prelaunch.module.css';

type Step =
  | { side: 'in' | 'out'; text: string; time: string; delay: number; kind?: undefined }
  | { side: 'in'; kind: 'audio'; dur: string; time: string; delay: number; text?: undefined }
  | { side: 'typing'; delay: number; text?: undefined; time?: undefined };

const SCRIPT: Step[] = [
  { side: 'in', text: 'Oi, tô com dor no dente e preciso marcar emergência hoje', time: '14:02', delay: 600 },
  { side: 'typing', delay: 1200 },
  { side: 'out', text: 'Oi! Sinto muito 🫶\nTemos encaixe hoje 14h30 com o Dr. Rafael ou 16h com a Dra. Letícia. Qual prefere?', time: '14:02', delay: 1500 },
  { side: 'in', kind: 'audio', dur: '0:09', time: '14:03', delay: 1800 },
  { side: 'typing', delay: 1100 },
  { side: 'out', text: 'Confirmado às 14h30 com o Dr. Rafael ✅\nVou te enviar a localização e o protocolo de chegada.', time: '14:03', delay: 1500 },
  { side: 'in', text: 'Perfeito, obrigada! 🙏', time: '14:04', delay: 1100 },
  { side: 'out', text: 'Te espero! Lead score 89/100 · qualificação automática.', time: '14:04', delay: 1400 },
];

interface Item {
  id: number;
  side: 'in' | 'out' | 'typing';
  kind?: 'audio';
  text?: string;
  time?: string;
  dur?: string;
}

export function IzaChatStream() {
  const [items, setItems] = useState<Item[]>([]);
  const idxRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const i = idxRef.current;
      if (i >= SCRIPT.length) {
        timer = setTimeout(() => {
          idxRef.current = 0;
          setItems([]);
          tick();
        }, 4000);
        return;
      }
      const step = SCRIPT[i];
      idxRef.current = i + 1;
      timer = setTimeout(() => {
        setItems((prev) => {
          const filtered =
            step.side === 'typing'
              ? [...prev, { ...step, id: i }]
              : prev.filter((p) => p.side !== 'typing').concat({ ...step, id: i });
          return filtered.slice(-6);
        });
        tick();
      }, step.delay);
    };

    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={s.chatBody}>
      {items.map((m) => {
        if (m.side === 'typing') {
          return (
            <div key={m.id} className={s.typing}>
              <span /><span /><span />
            </div>
          );
        }
        if (m.kind === 'audio') {
          return (
            <div key={m.id} className={`${s.bubble} ${s.bubbleIn} ${s.bubbleAudio}`}>
              <div className={s.audioPlay}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M2 1l7 4-7 4z" />
                </svg>
              </div>
              <div className={s.audioWav}>
                {Array.from({ length: 22 }).map((_, k) => (
                  <span
                    key={k}
                    style={{ height: `${4 + Math.abs(Math.sin(k * 0.7)) * 14}px` }}
                  />
                ))}
              </div>
              <div className={s.audioDur}>{m.dur}</div>
            </div>
          );
        }
        return (
          <div
            key={m.id}
            className={`${s.bubble} ${m.side === 'out' ? s.bubbleOut : s.bubbleIn}`}
          >
            {m.text?.split('\n').map((line, k) => (
              <div key={k}>{line}</div>
            ))}
            <span className={s.bubbleTime}>{m.time}</span>
          </div>
        );
      })}
    </div>
  );
}
