/**
 * agentOrchestrator.izaFacts.test.ts — W1.4 (vazamento de marca)
 * ============================================================================
 * Regressão: buildSystemPromptForContact injetava o bloco getIzaFactsBlock
 * (fatos da ZappIQ: preço, trial, links) no prompt de TODAS as orgs. Isso
 * fazia o bot de um CLIENTE falar da ZappIQ pro cliente final dele.
 *
 * Fix: o bloco só entra quando organizationId === IZA_ORG_ID (org canônica da
 * Iza). Demais orgs recebem string vazia — o bloco não aparece no prompt.
 *
 * Cobertura:
 *   ✓ org != IZA → prompt NÃO contém o bloco de facts
 *   ✓ org != IZA → getIzaFactsBlock nem chega a ser chamado (não vaza DB)
 *   ✓ org == IZA → prompt CONTÉM o bloco de facts
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const IZA_ORG_ID = 'cmo1ywwfe00ko1jskexiexsm4';
const FACTS_SENTINEL = '# FATOS ATUAIS DA PLATAFORMA (sentinel-de-teste)';

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: {
      findUnique: vi.fn().mockResolvedValue({
        leadStatus: 'NEW',
        name: 'Cliente Teste',
        _count: { conversations: 0 },
      }),
    },
    message: {
      count: vi.fn().mockResolvedValue(1),
    },
    agent: {
      findFirst: vi.fn().mockResolvedValue({
        systemPrompt: 'PROMPT-DO-AGENTE-DA-ORG',
        name: 'Agente',
      }),
    },
  },
}));

const getIzaFactsBlock = vi.fn().mockResolvedValue(FACTS_SENTINEL);
vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: () => getIzaFactsBlock(),
  invalidateIzaFactsCache: vi.fn(),
}));

// logger silencioso pra não poluir output
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { buildSystemPromptForContact } from './agentOrchestrator.js';

const baseInput = {
  contactId: 'contact-1',
  contactPhone: '5511999999999',
  orgSettings: { niche: 'generic', agentName: 'Bot', businessName: 'Cliente XPTO' },
  ragContext: '',
};

describe('buildSystemPromptForContact — W1.4 vazamento de marca', () => {
  beforeEach(() => {
    getIzaFactsBlock.mockClear();
  });

  it('org != IZA: NÃO injeta o bloco de fatos da ZappIQ e nem chama getIzaFactsBlock', async () => {
    const prompt = await buildSystemPromptForContact({
      ...baseInput,
      organizationId: 'org-de-cliente-qualquer',
    });

    expect(prompt).not.toContain(FACTS_SENTINEL);
    expect(getIzaFactsBlock).not.toHaveBeenCalled();
    // sanity: o prompt do agente da org continua presente
    expect(prompt).toContain('PROMPT-DO-AGENTE-DA-ORG');
  });

  it('org == IZA: injeta o bloco de fatos da ZappIQ', async () => {
    const prompt = await buildSystemPromptForContact({
      ...baseInput,
      organizationId: IZA_ORG_ID,
    });

    expect(prompt).toContain(FACTS_SENTINEL);
    expect(getIzaFactsBlock).toHaveBeenCalledTimes(1);
  });
});
