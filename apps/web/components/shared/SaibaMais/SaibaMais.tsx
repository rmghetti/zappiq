'use client';

/**
 * <SaibaMais /> — gatilho padronizado do "Saiba mais" em todo o Dashboard.
 *
 * Uso:
 *   <SaibaMais featureKey="analytics.pulso" />              // ícone (i) ao lado de títulos/métricas
 *   <SaibaMais featureKey="analytics.pulso" variant="link" /> // texto "Saiba mais" em estados vazios/blocos
 *
 * Resolve o conteúdo pelo registro central (content/saiba-mais). Se a featureKey
 * não existir: em desenvolvimento avisa no console; em produção não renderiza nada
 * (falha silenciosa e segura). Registra telemetria de abertura via PostHog.
 */
import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { getSaibaMais } from '@/content/saiba-mais';
import { track } from '@/lib/track';
import { SaibaMaisModal } from './SaibaMaisModal';

type Variant = 'icon' | 'link';

export function SaibaMais({
  featureKey,
  variant = 'icon',
  className = '',
}: {
  featureKey: string;
  variant?: Variant;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const content = getSaibaMais(featureKey);

  if (!content) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[SaibaMais] featureKey sem conteúdo no registro: "${featureKey}"`);
    }
    return null;
  }

  const abrir = () => {
    setOpen(true);
    void track('saiba_mais_opened', {
      featureKey,
      rota: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={abrir}
          aria-label={`Saiba mais sobre ${content.titulo}`}
          title={`Saiba mais sobre ${content.titulo}`}
          className={`inline-flex items-center justify-center text-gray-400 transition hover:text-[#2F7FB5] ${className}`}
        >
          <HelpCircle size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={abrir}
          className={`inline-flex items-center gap-1 text-sm font-medium text-[#2F7FB5] transition hover:text-[#4A52D0] ${className}`}
        >
          <HelpCircle size={15} />
          Saiba mais
        </button>
      )}

      {open && <SaibaMaisModal content={content} onClose={() => setOpen(false)} />}
    </>
  );
}
