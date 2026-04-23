'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * CTAFinal — Design V4 (Chatbase-style · seção dark #0A0B12 + gradient glows)
 * --------------------------------------------------------------------------
 * Fecho da landing. Dark bg + 3 glows radiais (g1/g2/g3). CTA duplo (primário
 * Começar grátis / secundário Falar com especialista). Trust row inferior com
 * 3 garantias operacionais (14 dias · sem cartão · cancele quando quiser).
 * ExitIntentPopup preservado (apenas desktop, 1x por sessão).
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, X } from 'lucide-react';

/* ─────────────── Exit-intent popup ─────────────── */
function ExitIntentPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('ontouchstart' in window || window.innerWidth < 768) return;
    if (sessionStorage.getItem('zappiq_exit_popup_shown') === 'true') return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 0) {
        setShow(true);
        sessionStorage.setItem('zappiq_exit_popup_shown', 'true');
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 5000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setShow(false)}
    >
      <div
        className="relative bg-white rounded-[20px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] max-w-md w-full mx-4 p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 text-muted hover:text-ink transition-colors"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_12px_24px_-12px_rgba(74,82,208,0.5)]"
          style={{
            background:
              'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
          }}
        >
          <Play size={28} className="text-white ml-1" />
        </div>

        <h3 className="text-[22px] font-medium text-ink mb-3 tracking-tight">
          Antes de ir{' '}
          <span className="text-grad">veja em 2 minutos</span>
        </h3>
        <p className="text-[14px] text-muted mb-6 leading-relaxed">
          A ZappIQ atendendo em produção. IA, voz, dashboards — tudo rodando.
          Sem compromisso, sem cadastro.
        </p>

        <div className="flex flex-col gap-3">
          {/* PLACEHOLDER: substituir href por link real do vídeo */}
          <a
            href="#VIDEO_DEMO_URL"
            className="btn btn-accent justify-center"
          >
            <Play size={14} /> Ver demonstração
          </a>
          <button
            onClick={() => setShow(false)}
            className="text-[13px] text-muted hover:text-ink transition-colors py-2"
          >
            Não, obrigado
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── CTA Final ─────────────── */
export function CTAFinal() {
  return (
    <>
      <section
        className="py-20 lg:py-32 relative overflow-hidden text-white"
        style={{
          background:
            'linear-gradient(135deg, #0A0B12 0%, #14182B 50%, #1A1F45 100%)',
        }}
      >
        {/* glows decorativos */}
        <div className="absolute inset-0 pointer-events-none opacity-55">
          <div
            className="absolute top-0 left-1/4 w-[520px] h-[520px] rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(47,181,122,0.35) 0%, transparent 65%)',
            }}
          />
          <div
            className="absolute bottom-0 right-1/4 w-[480px] h-[480px] rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(74,82,208,0.45) 0%, transparent 65%)',
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(47,127,181,0.3) 0%, transparent 70%)',
            }}
          />
        </div>

        <div className="relative zappiq-wrap max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6 backdrop-blur-sm uppercase tracking-[0.12em]">
            Sua última chance de começar hoje
          </div>

          <h2 className="text-[44px] lg:text-[60px] font-medium leading-[1.02] tracking-[-0.03em] mb-5">
            Seu concorrente já automatiza.
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #8AB7E9 100%)',
              }}
            >
              E você, até quando espera?
            </span>
          </h2>

          <p className="text-[17px] text-white/75 mb-10 max-w-xl mx-auto leading-relaxed">
            Ative a plataforma em 14 dias grátis. Se funcionar — e vai funcionar —
            você escolhe a forma de pagamento. Se não, basta deixar expirar.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link
              href="/register?utm_source=cta_final"
              className="inline-flex items-center justify-center gap-2 bg-white text-ink hover:bg-white/90 font-medium px-7 py-3.5 rounded-[14px] transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.15)] text-[14.5px]"
            >
              Começar 14 dias grátis <ArrowRight size={16} />
            </Link>
            <Link
              href="/contato?utm_source=cta_final"
              className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 hover:bg-white/5 text-white font-medium px-7 py-3.5 rounded-[14px] transition-colors text-[14.5px]"
            >
              Falar com especialista
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12.5px] text-white/70">
            {[
              '14 dias grátis',
              'Sem cartão no trial',
              'Cancele quando quiser',
              'Zero setup fee',
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="text-[#2FB57A]">✓</span> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <ExitIntentPopup />
    </>
  );
}
