'use client';

/**
 * TourLauncher — dispara um tour pontual na primeira visita e oferece um botão
 * "Ver tour" sempre disponível para repetir.
 *
 * Uso na tela do fluxo:
 *   <TourLauncher tourKey="conectar-whatsapp" autoStart />
 *
 * "Já visto" persiste em localStorage (zappiq_tour_<tourKey>_done), no mesmo
 * padrão do onboarding e dos nudges do app. Se o tour não existir no registro,
 * não renderiza nada (falha segura).
 */
import { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { getTour } from '@/content/tours';
import { GuidedTour } from './GuidedTour';

export function TourLauncher({
  tourKey,
  autoStart = false,
  className = '',
}: {
  tourKey: string;
  autoStart?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const tour = getTour(tourKey);

  useEffect(() => {
    if (!autoStart || !tour) return;
    try {
      const done = window.localStorage.getItem(`zappiq_tour_${tourKey}_done`);
      if (!done) setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoStart, tour, tourKey]);

  if (!tour) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#2F7FB5] transition hover:text-[#4A52D0] ${className}`}
      >
        <PlayCircle size={16} />
        Ver tour
      </button>
      {open && <GuidedTour tour={tour} onClose={() => setOpen(false)} />}
    </>
  );
}
