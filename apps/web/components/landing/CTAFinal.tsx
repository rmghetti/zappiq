'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, X } from 'lucide-react';

/* Exit-intent popup — apenas desktop, 1x por sessão */
function ExitIntentPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Não ativar em mobile
    if ('ontouchstart' in window || window.innerWidth < 768) return;
    // Verificar se já foi exibido nesta sessão
    if (sessionStorage.getItem('zappiq_exit_popup_shown') === 'true') return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 0) {
        setShow(true);
        sessionStorage.setItem('zappiq_exit_popup_shown', 'true');
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    };

    // Delay para não disparar imediatamente
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShow(false)}>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={20} />
        </button>

        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Play size={28} className="text-primary-600 ml-1" />
        </div>

        <h3 className="font-display text-xl font-extrabold text-gray-900 mb-3">
          Espera! Antes de ir...
        </h3>
        <p className="text-gray-500 mb-6">
          Quer ver como a ZappIQ funciona em 2 minutos? Assista a demonstração e descubra como automatizar seu WhatsApp hoje.
        </p>

        <div className="flex flex-col gap-3">
          {/* PLACEHOLDER: substituir href por link real do vídeo */}
          <a href="#VIDEO_DEMO_URL" className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-primary-500/25">
            <Play size={16} /> Ver Demonstração
          </a>
          <button onClick={() => setShow(false)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2">
            Não, obrigado
          </button>
        </div>
      </div>
    </div>
  );
}

export function CTAFinal() {
  return (
    <>
      <section className="py-20 lg:py-28 bg-[#1A1A2E] relative overflow-hidden">
        <div className="absolute inset-0 -z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary-500/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-white mb-5 leading-tight">
            Seu concorrente já está automatizando<br className="hidden sm:block" /> o WhatsApp dele. E você?
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
            Comece agora e recupere em 7 dias o tempo que está perdendo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-secondary-500/30 text-base">
              Começar Grátis <ArrowRight size={18} />
            </Link>
            {/* PLACEHOLDER: substituir href por link real de contato */}
            <a href="#falar-especialista"
              className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base hover:bg-white/5">
              Falar com Especialista
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            {['14 dias grátis', 'Sem cartão', 'Cancele quando quiser'].map((t) => (
              <span key={t}>✓ {t}</span>
            ))}
          </div>
        </div>
      </section>

      <ExitIntentPopup />
    </>
  );
}
