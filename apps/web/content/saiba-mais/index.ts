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
import { dashboardContent } from './dashboard';
import { conversationsContent } from './conversations';
import { contactsContent } from './contacts';
import { crmContent } from './crm';
import { tasksContent } from './tasks';
import { campaignsContent } from './campaigns';
import { templatesContent } from './templates';
import { flowsContent } from './flows';
import { analyticsContent } from './analytics';
import { aiTrainingContent } from './ai-training';
import { qualidadeContent } from './qualidade';
import { settingsContent } from './settings';
import { billingContent } from './billing';
import { auditoriaContent } from './auditoria';

const ALL_AREAS: SaibaMaisContent[][] = [
  dashboardContent,
  conversationsContent,
  contactsContent,
  crmContent,
  tasksContent,
  campaignsContent,
  templatesContent,
  flowsContent,
  analyticsContent,
  aiTrainingContent,
  qualidadeContent,
  settingsContent,
  billingContent,
  auditoriaContent,
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
