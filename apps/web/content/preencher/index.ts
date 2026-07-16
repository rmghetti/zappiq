/**
 * Registro central do "O que preencher aqui" (fonte única da verdade).
 *
 * Mesma ideia do registro de Saiba mais: nada de copy espalhada no JSX. O
 * componente <OQuePreencher /> resolve o conteúdo por aqui.
 *
 * Para adicionar: crie/edite o arquivo da tela (ex.: mira-campanha.ts),
 * exporte o array e inclua em TODAS_AS_TELAS.
 */
import type { PreencherCampoContent } from './types';
import { miraCampanhaPreencher } from './mira-campanha';

const TODAS_AS_TELAS: PreencherCampoContent[][] = [miraCampanhaPreencher];

const TODOS: PreencherCampoContent[] = TODAS_AS_TELAS.flat();

// Guarda contra campoKey duplicada (falha cedo em desenvolvimento).
if (process.env.NODE_ENV !== 'production') {
  const vistos = new Set<string>();
  for (const c of TODOS) {
    if (vistos.has(c.campoKey)) {
      // eslint-disable-next-line no-console
      console.error(`[OQuePreencher] campoKey duplicada no registro: "${c.campoKey}"`);
    }
    vistos.add(c.campoKey);
  }
}

export const PREENCHER: Record<string, PreencherCampoContent> = Object.fromEntries(
  TODOS.map((c) => [c.campoKey, c]),
);

export function getPreencher(campoKey: string): PreencherCampoContent | undefined {
  return PREENCHER[campoKey];
}

/** Todas as campoKeys registradas (usado pelo teste de link morto). */
export function allCampoKeys(): string[] {
  return Object.keys(PREENCHER);
}

export type { PreencherCampoContent, NaoDeveItem } from './types';
