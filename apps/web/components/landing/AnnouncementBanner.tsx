'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * AnnouncementBanner — Top-of-page ribbon proclamando ZappIQ pioneira LATAM
 * em integração ponta-a-ponta com Meta Ads AI Connectors (PR #96).
 *
 * Aparece logo após Navbar, acima do Hero. Dismissível via localStorage.
 * Lançamento Meta Ads AI Connectors: 29/04/2026.
 * ZappIQ first-mover na LATAM (afirmação aprovada por Rodrigo Ghetti).
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'zappiq_meta_ai_banner_dismissed_v1';

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage bloqueado — só some na sessão atual, ok
    }
  };

  if (!visible) return null;

  return (
    <div
      className="relative w-full text-white"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 35%, #4C1D95 70%, #2FB57A 110%)',
      }}
    >
      <div className="zappiq-wrap py-3 lg:py-3.5">
        <div className="flex items-center justify-center gap-3 lg:gap-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] bg-white/15 backdrop-blur px-2.5 py-1 rounded-full whitespace-nowrap">
            <Sparkles size={11} className="text-emerald-300" /> 1ª LATAM
          </span>

          <p className="text-[12.5px] lg:text-[14px] font-medium leading-snug">
            <span className="hidden sm:inline">ZappIQ </span>
            <strong className="text-white">já é a primeira plataforma da América Latina</strong>
            <span className="hidden md:inline"> com integração ponta-a-ponta</span>
            {' '}<span className="text-emerald-300">Meta Ads AI Connectors</span>
            <span className="hidden lg:inline"> — Meta gera, Iza qualifica, você fecha</span>
            <span className="text-white/60">.</span>
          </p>

          <Link
            href="/blog/meta-ads-ai-connectors-zappiq"
            className="inline-flex items-center gap-1 text-[12px] lg:text-[13px] font-semibold text-emerald-300 hover:text-emerald-200 transition-colors whitespace-nowrap underline-offset-4 hover:underline"
          >
            Ler análise completa <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fechar anúncio"
        className="absolute top-1/2 -translate-y-1/2 right-3 lg:right-5 p-1.5 rounded-md hover:bg-white/10 transition-colors"
      >
        <X size={14} className="text-white/70" />
      </button>
    </div>
  );
}
