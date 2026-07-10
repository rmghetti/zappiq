'use client';

/**
 * GuidedTour — tour pontual tipo spotlight para os fluxos sequenciais difíceis.
 *
 * Complemento do Saiba mais (não substitui): guia a ORDEM dos cliques em 3 a 5
 * passos, destacando o elemento alvo e mostrando a ação esperada. Cada passo pode
 * abrir o Saiba mais detalhado do recurso pela featureKey.
 *
 * Dirigido por um registro de tours (content/tours). Persiste "já visto" em
 * localStorage no mesmo padrão do resto do app (chave zappiq_tour_<tourKey>_done).
 */
import { useEffect, useState, useCallback } from 'react';
import { X, ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react';
import type { Tour } from '@/content/saiba-mais/types';
import { getSaibaMais } from '@/content/saiba-mais';
import { SaibaMaisModal } from '@/components/shared/SaibaMais/SaibaMaisModal';
import { track } from '@/lib/track';

type Rect = { top: number; left: number; width: number; height: number };

function rectOf(selector: string): Rect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function GuidedTour({ tour, onClose }: { tour: Tour; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const passo = tour.passos[step];
  const total = tour.passos.length;

  const recompute = useCallback(() => {
    setRect(passo ? rectOf(passo.alvo) : null);
  }, [passo]);

  useEffect(() => {
    // pequeno atraso para o scrollIntoView assentar antes de medir
    const t = setTimeout(recompute, 120);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [recompute]);

  useEffect(() => {
    void track('tour_step_viewed', { tourKey: tour.tourKey, step, alvo: passo?.alvo });
  }, [tour.tourKey, step, passo]);

  const finalizar = useCallback(() => {
    try {
      window.localStorage.setItem(`zappiq_tour_${tour.tourKey}_done`, new Date().toISOString());
    } catch {
      /* ignore */
    }
    onClose();
  }, [tour.tourKey, onClose]);

  const proximo = () => (step + 1 >= total ? finalizar() : setStep(step + 1));
  const anterior = () => setStep(Math.max(0, step - 1));

  if (!passo) return null;

  // Posição do balão: abaixo do alvo, ou centralizado se o alvo não foi encontrado.
  const PAD = 8;
  const found = !!rect;
  const tooltipTop = rect ? rect.top + rect.height + 12 : 0;
  const tooltipLeft = rect ? Math.max(12, rect.left) : 0;

  const detalheContent = detalhe ? getSaibaMais(detalhe) : undefined;

  return (
    <>
      {/* Overlay escuro com recorte no alvo */}
      <div className="fixed inset-0 z-[90] bg-black/50" onClick={finalizar} role="presentation">
        {found && (
          <div
            className="pointer-events-none absolute rounded-lg ring-4 ring-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all"
            style={{
              top: rect!.top - PAD,
              left: rect!.left - PAD,
              width: rect!.width + PAD * 2,
              height: rect!.height + PAD * 2,
            }}
          />
        )}
      </div>

      {/* Balão do passo */}
      <div
        className="fixed z-[91] w-[320px] max-w-[90vw] rounded-xl bg-white p-4 shadow-2xl"
        style={
          found
            ? { top: tooltipTop, left: tooltipLeft }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2F7FB5]">
            {tour.titulo} · {step + 1}/{total}
          </span>
          <button onClick={finalizar} aria-label="Pular tour" className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <p className="mb-3 text-[15px] leading-relaxed text-gray-800">{passo.acao}</p>

        {passo.featureKey && getSaibaMais(passo.featureKey) && (
          <button
            onClick={() => setDetalhe(passo.featureKey!)}
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-[#2F7FB5] hover:text-[#4A52D0]"
          >
            <HelpCircle size={13} /> Ver detalhes
          </button>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={finalizar}
            className="text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            Pular
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={anterior}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                <ArrowLeft size={14} /> Anterior
              </button>
            )}
            <button
              onClick={proximo}
              className="inline-flex items-center gap-1 rounded-lg bg-[#2F7FB5] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4A52D0]"
            >
              {step + 1 >= total ? 'Concluir' : 'Próximo'}
              {step + 1 < total && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>

      {detalheContent && <SaibaMaisModal content={detalheContent} onClose={() => setDetalhe(null)} />}
    </>
  );
}
