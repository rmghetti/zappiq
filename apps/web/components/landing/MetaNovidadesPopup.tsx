'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * MetaNovidadesPopup: popup automático leve na home (V2 · 20/08/2026)
 * --------------------------------------------------------------------------
 * Card discreto no canto inferior direito que promove /novidades-meta
 * (kit "Outubro sem susto": a mudança de preço da Meta em 01/10/2026 e a
 * calculadora da fatura Meta). V1 (10/06/2026) promovia os lançamentos do
 * Conversations Brasil. STORAGE_KEY bumped pra _v2 pra nova mensagem
 * aparecer a quem já tinha silenciado a anterior.
 *
 * Comportamento (deliberadamente não intrusivo):
 *   - aparece 5s após o load, não bloqueia a tela, não é modal
 *   - se recolhe sozinho após 25s se ignorado (sem marcar dismissed,
 *     volta na próxima visita)
 *   - fechar (X / "Agora não" / ESC) silencia por 7 dias
 *   - clicar no CTA silencia por 30 dias
 *   - mobile: card na base da tela, largura total menos margens
 *
 * Frequency cap via localStorage com timestamp de expiração.
 * Em SSR não renderiza nada (gate por useEffect).
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'zappiq_meta_novidades_popup_until_v2';
const SHOW_DELAY_MS = 5000;
const AUTO_HIDE_MS = 25000;
const DAYS_IF_CLOSED = 7;
const DAYS_IF_CLICKED = 30;

function silencedUntil(): number {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

function silence(days: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() + days * 86400000));
  } catch {
    // localStorage bloqueado: só some na sessão atual, ok
  }
}

export function MetaNovidadesPopup() {
  const [visible, setVisible] = useState(false);
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Date.now() < silencedUntil()) return;

    const showTimer = setTimeout(() => {
      setVisible(true);
      autoHideRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    }, SHOW_DELAY_MS);

    return () => {
      clearTimeout(showTimer);
      if (autoHideRef.current) clearTimeout(autoHideRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false);
        silence(DAYS_IF_CLOSED);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    silence(DAYS_IF_CLOSED);
  };

  const clickThrough = () => {
    setVisible(false);
    silence(DAYS_IF_CLICKED);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Novidades Meta na ZappIQ"
      className="fixed z-[70] bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 sm:w-[340px] bg-white border border-line rounded-[18px] overflow-hidden shadow-[0_20px_50px_-15px_rgba(17,17,17,0.35)] animate-fade-in"
    >
      <div className="relative bg-ink text-white px-5 pt-4 pb-3.5">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors"
        >
          <X size={13} className="text-white/80" />
        </button>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] bg-emerald-400/15 border border-emerald-400/50 text-emerald-300 px-2 py-0.5 rounded-full">
          <Sparkles size={10} /> Outubro sem susto
        </span>
        <h4 className="mt-2 text-[15px] font-bold leading-snug">
          Em outubro a Meta muda o preço dela.{' '}
          <span className="text-emerald-400">O seu não muda.</span>
        </h4>
      </div>
      <div className="px-5 py-4">
        <p className="text-[12.5px] text-muted leading-relaxed">
          A partir de 1º de outubro, a Meta passa a cobrar pelas respostas no WhatsApp. A tarifa vai
          a custo, na sua conta, com medidor e teto. Faça a conta da sua operação em 30 segundos.
        </p>
        <Link
          href="/novidades-meta"
          onClick={clickThrough}
          className="btn btn-accent w-full justify-center mt-3.5 !text-[13.5px]"
        >
          Entender o que muda para mim
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="w-full text-center mt-2 text-[11.5px] text-muted-2 hover:text-muted hover:underline"
        >
          Agora não, continuar navegando
        </button>
      </div>
    </div>
  );
}
