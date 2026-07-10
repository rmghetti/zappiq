/**
 * Registro central do "Saiba mais" (fonte única da verdade).
 *
 * Agrega o conteúdo de cada área numa lookup por featureKey. O componente
 * <SaibaMais /> resolve o conteúdo por aqui; nada de copy espalhada no JSX.
 *
 * Para adicionar conteúdo: crie/edite o arquivo da área (ex: analytics.ts),
 * exporte o array e inclua abaixo em ALL_AREAS.
 */
import type { SaibaMaisContent } from './types';
import { analyticsContent } from './analytics';

const ALL_AREAS: SaibaMaisContent[][] = [
  analyticsContent,
  // demais áreas entram aqui após a varredura (ai-training, billing, campaigns, crm, ...)
];

const ALL: SaibaMaisContent[] = ALL_AREAS.flat();

// Guarda contra featureKey duplicada (falha cedo em desenvolvimento).
if (process.env.NODE_ENV !== 'production') {
  const seen = new Set<string>();
  for (const c of ALL) {
    if (seen.has(c.featureKey)) {
      // eslint-disable-next-line no-console
      console.error(`[SaibaMais] featureKey duplicada no registro: "${c.featureKey}"`);
    }
    seen.add(c.featureKey);
  }
}

export const SAIBA_MAIS: Record<string, SaibaMaisContent> = Object.fromEntries(
  ALL.map((c) => [c.featureKey, c]),
);

export function getSaibaMais(featureKey: string): SaibaMaisContent | undefined {
  return SAIBA_MAIS[featureKey];
}

/** Todas as featureKeys registradas (útil para testes de link morto e export de corpus). */
export function allFeatureKeys(): string[] {
  return Object.keys(SAIBA_MAIS);
}

export type { SaibaMaisContent, Tour, TourStep } from './types';
