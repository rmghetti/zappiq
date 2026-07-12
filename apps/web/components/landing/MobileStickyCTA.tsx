'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * MobileStickyCTA: barra fixa de trial no mobile (auditoria V6, rank 7)
 * --------------------------------------------------------------------------
 * No mobile o unico "Comecar 14 dias gratis" ficava dentro do hamburguer e
 * sumia no scroll: o caminho pro trial exigia 2 toques. Esta barra aparece
 * apos a primeira dobra e mantem o CTA sempre a um toque. So aparece < lg
 * (no desktop o CTA ja e persistente na navbar). z-30 pra ficar abaixo do
 * FAB do WhatsApp (z-40), com folga a direita pra nao sobrepor.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function MobileStickyCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[rgba(255,255,255,0.96)] backdrop-blur-xl transition-transform duration-300 ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden={!show}
    >
      {/* pr-[84px] deixa livre o canto do FAB do WhatsApp (right-6 + 56px) */}
      <div className="flex items-center gap-3 px-4 py-2.5 pr-[84px]">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-ink leading-tight">
            14 dias grátis, sem cartão
          </div>
          <div className="text-[11px] text-muted leading-tight truncate">
            Ative a Iza na sua operação em minutos
          </div>
        </div>
        <Link href="/cadastro" className="btn btn-accent shrink-0 whitespace-nowrap">
          Começar <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
