'use client';

/* ═══════════════════════════════════════════════════════════════════════
 * ReadinessMilestoneNudge
 * ---------------------------------------------------------------------
 * Modal de "momento da verdade": dispara UMA VEZ, quando o AI Readiness
 * Score do tenant cruza o threshold de 60 (nível "ready") pela primeira
 * vez. A lógica de negócio é:
 *
 *   Score < 60  → cliente ainda está configurando. Mexer aqui atrapalha.
 *   Score ≥ 60  → cliente acaba de ver a IA dele funcionar. É o
 *                 instante de maior propensão a converter.
 *
 * Nesse exato momento, mostramos:
 *   • Celebração do marco (visual limpo, sem confete exagerado)
 *   • SavingsCalculator embutido (dashboard variant) — com o número da
 *     economia calculado contra a baseline do concorrente
 *   • CTA "Antecipar conversão com 21% off" → /billing?coupon=EARLY21
 *
 * Por que funciona:
 *   - O cliente vê a IA funcionando ("ready") e o número da economia no
 *     mesmo frame visual. A decisão de converter fica muito mais fácil.
 *   - O cupom EARLY21 dá 21% off no primeiro ano = "21 dias grátis
 *     viram 21% off", narrativa coerente com o posicionamento de launch.
 *   - Dispara em qualquer página do dashboard (hook globalmente via
 *     `useReadinessMilestone`), então não exige que o cliente volte a
 *     /ai-training para ver o nudge.
 *
 * Flag de persistência:
 *   localStorage key `zappiq_readiness_milestone_60_fired_at` com valor
 *   ISO date. TTL infinito — o nudge só pode disparar UMA vez por tenant
 *   na vida. Se quiser re-disparar (teste), limpar manualmente ou passar
 *   ?resetReadinessNudge=1 na URL (handleado abaixo).
 * ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { SavingsCalculator } from './SavingsCalculator';

const STORAGE_KEY = 'zappiq_readiness_milestone_60_fired_at';
const THRESHOLD = 60;

/* ------------------------------------------------------------------ */
/* Hook público — permite que qualquer página que já tenha o readiness */
/* dispare o nudge sem duplicar lógica.                                */
/* ------------------------------------------------------------------ */
export function useReadinessMilestone(score: number | null | undefined): {
  open: boolean;
  close: () => void;
} {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (score == null) return;

    // Query-string override para QA / demo
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('resetReadinessNudge') === '1') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }

    const alreadyFired = window.localStorage.getItem(STORAGE_KEY);
    if (alreadyFired) return;
    if (score < THRESHOLD) return;

    // Marcar ANTES de abrir, para o modal não reabrir se o usuário
    // navegar e o hook remontar com o readiness já acima de 60.
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(true);
  }, [score]);

  const close = useCallback(() => setOpen(false), []);
  return { open, close };
}

/* ------------------------------------------------------------------ */
/* Componente de apresentação                                          */
/* ------------------------------------------------------------------ */

export interface ReadinessMilestoneNudgeProps {
  /** Score atual (0-100). O hook só dispara em ≥ 60. */
  score: number | null | undefined;
  /** Cupom a acoplar no CTA. Default "EARLY21". */
  coupon?: string;
  /** Override do ctaHref se for necessário (multi-tenant host). */
  billingBaseHref?: string;
}

export default function ReadinessMilestoneNudge({
  score,
  coupon = 'EARLY21',
  billingBaseHref = '/billing',
}: ReadinessMilestoneNudgeProps) {
  const { open, close } = useReadinessMilestone(score);

  if (!open) return null;

  const ctaHref = `${billingBaseHref}?coupon=${encodeURIComponent(coupon)}&utm_source=readiness_nudge&utm_campaign=early_convert`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="readiness-nudge-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Close */}
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors z-10"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Hero de celebração */}
        <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-purple-600 p-8 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wide mb-4">
            <Sparkles size={14} /> Marco · AI Readiness 60+
          </div>
          <h2
            id="readiness-nudge-title"
            className="text-2xl md:text-3xl font-extrabold font-display leading-tight"
          >
            Sua IA acaba de ficar pronta para atender de verdade.
          </h2>
          <p className="text-white/90 mt-2 text-sm md:text-base leading-relaxed">
            Você treinou sozinho, sem consultor, sem setup pago. E já está
            acima do threshold de "Pronta" — a partir daqui todo conversation
            vira pipeline.
          </p>

          <div className="flex items-center gap-2 mt-4 text-sm">
            <CheckCircle2 size={16} />
            <span className="text-white/95">
              Antecipe a conversão agora e trave{' '}
              <strong>21% off no 1º ano</strong> com o cupom{' '}
              <code className="px-2 py-0.5 rounded bg-white/20 font-mono text-xs">
                {coupon}
              </code>
              .
            </span>
          </div>
        </div>

        {/* Calculator embutido */}
        <div className="p-6 md:p-8 bg-gray-50/60">
          <SavingsCalculator
            variant="dashboard"
            title="Sua economia vs. concorrente no 1º ano"
            subtitle="Sliders já preenchidos com a baseline mediana de Blip/Huggy. Ajuste com sua cotação real para ver o número exato."
            showCta
            ctaHref={ctaHref}
            ctaLabel={`Antecipar conversão com ${coupon} →`}
            onCtaClick={() => {
              // Mantém o modal fechado após o click — o next/link navega.
              close();
            }}
          />

          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            Cupom válido por 72h a partir deste marco. Sem permanência, sem
            setup fee, cancelamento em 1 clique. Se preferir continuar no
            trial até o dia 21, sem problema — o botão acima vai continuar
            válido até o vencimento do cupom.
          </p>
        </div>
      </div>
    </div>
  );
}
