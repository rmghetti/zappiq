/**
 * Registro dos tours pontuais (Fase 1, secção 5.5 do design).
 *
 * Apenas 3 fluxos sequenciais difíceis têm tour: conectar WhatsApp, primeiro
 * fluxo no Maestro e configurar o Treinar IA. Os passos são preenchidos com os
 * seletores reais das telas depois do wiring do Saiba mais.
 *
 * Cada passo aponta um alvo (seletor CSS, de preferência um data-tour) e a ação
 * esperada, e pode referenciar a featureKey do Saiba mais para o detalhe.
 */
import type { Tour } from '@/content/saiba-mais/types';

export const TOURS: Record<string, Tour> = {
  // Preenchido na etapa de tour (após o wiring). Ex.:
  // 'conectar-whatsapp': { tourKey: 'conectar-whatsapp', titulo: 'Conectar o WhatsApp', passos: [...] },
};

export function getTour(tourKey: string): Tour | undefined {
  return TOURS[tourKey];
}

export function allTourKeys(): string[] {
  return Object.keys(TOURS);
}
