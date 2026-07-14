/**
 * agentOrchestrator.tenantLinks.test.ts — o link do cliente chega ao agente?
 * ============================================================================
 * Contexto (14/07/2026). Depois de tirar as URLs da ZappIQ do promptEngine, o
 * conversionUrls foi ligado em dois pontos: buildSeedSystemPrompt e o fallback
 * do getSystemPrompt. Só que nenhum dos dois entrega o link em produção:
 *
 *   1. O seed roda no signup (onboarding.ts:188), quando surveyAnswers está
 *      vazio — o cliente ainda nem viu o /treinar. Prompt seedado nasce sem link.
 *   2. PUT /ai-training/survey grava o site em settings mas NÃO re-seeda o
 *      Agent.systemPrompt (só re-ingere o RAG).
 *   3. Em runtime, buildSystemPromptForContact prefere Agent.systemPrompt e só
 *      cai no fallback quando a org não tem Agent. Como toda org tem Agent
 *      (ver agentIdentitySync.ts), o fallback é caminho morto.
 *
 * Resultado: o lead aceita a oferta e a IA responde "vou verificar" — sem link.
 *
 * Fix: o bloco de links é montado em RUNTIME a partir das settings, igual o
 * factsBlock já faz. Link é dado vivo: o cliente edita no /treinar e vale na
 * mensagem seguinte, sem re-seedar prompt (o que apagaria customização).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findForeignBrandLeaks } from './tenantIsolationGuard.js';

const agentFindFirst = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: {
      findUnique: vi.fn().mockResolvedValue({
        leadStatus: 'NEW',
        name: 'Cliente Teste',
        _count: { conversations: 0 },
      }),
    },
    message: { count: vi.fn().mockResolvedValue(1) },
    agent: { findFirst: (...args: any[]) => agentFindFirst(...args) },
  },
}));

vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn().mockResolvedValue(''),
  invalidateIzaFactsCache: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { buildSystemPromptForContact } from './agentOrchestrator.js';

// CMJ: o tenant que sofreu o bug. Site cadastrado no /treinar, sem protocolo,
// que é como o cliente digita de fato.
const settingsCMJ = {
  niche: 'servicos_b2b',
  agentName: 'Vera',
  businessName: 'CMJ',
  tone: 'friendly',
  surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
};

const baseInput = {
  organizationId: 'org-do-cmj',
  contactId: 'contact-1',
  contactPhone: '5511999999999',
  ragContext: '',
};

describe('buildSystemPromptForContact — links do tenant chegam ao agente', () => {
  beforeEach(() => {
    agentFindFirst.mockReset();
  });

  describe('org COM Agent seedado (o caso de 100% das orgs hoje)', () => {
    beforeEach(() => {
      // Prompt seedado no signup: nasceu sem bloco de link, e nunca é re-seedado.
      agentFindFirst.mockResolvedValue({
        systemPrompt: 'PROMPT-SEEDADO-NO-SIGNUP-SEM-LINK',
        name: 'Vera',
      });
    });

    it('injeta o site que o cliente cadastrou no /treinar', async () => {
      const prompt = await buildSystemPromptForContact({ ...baseInput, orgSettings: settingsCMJ });

      expect(prompt).toContain('### Links oficiais de CMJ');
      expect(prompt).toContain('https://cmj.com.br');
    });

    it('preserva o prompt customizado do cliente (não re-gera)', async () => {
      const prompt = await buildSystemPromptForContact({ ...baseInput, orgSettings: settingsCMJ });
      expect(prompt).toContain('PROMPT-SEEDADO-NO-SIGNUP-SEM-LINK');
    });

    it('o link do cliente entra e nenhuma marca da ZappIQ volta', async () => {
      const prompt = await buildSystemPromptForContact({ ...baseInput, orgSettings: settingsCMJ });
      expect(findForeignBrandLeaks(prompt, { strict: true })).toEqual([]);
    });

    it('cliente sem site cadastrado não ganha bloco de link (e não herda o nosso)', async () => {
      // Felix móveis: 0 respostas de survey.
      const prompt = await buildSystemPromptForContact({
        ...baseInput,
        orgSettings: { niche: 'generic', agentName: 'Bot', businessName: 'Felix moveis' },
      });

      expect(prompt).not.toContain('Links oficiais');
      expect(findForeignBrandLeaks(prompt, { strict: true })).toEqual([]);
    });

    it('texto livre no campo de site não vira link', async () => {
      const prompt = await buildSystemPromptForContact({
        ...baseInput,
        orgSettings: {
          ...settingsCMJ,
          surveyAnswers: { identidade_empresa: { ide_site_url: 'ainda não temos site' } },
        },
      });

      expect(prompt).not.toContain('Links oficiais');
    });
  });

  describe('org SEM Agent seedado (fallback do promptEngine)', () => {
    beforeEach(() => {
      agentFindFirst.mockResolvedValue(null);
    });

    it('também recebe o link do cliente', async () => {
      const prompt = await buildSystemPromptForContact({ ...baseInput, orgSettings: settingsCMJ });

      expect(prompt).toContain('### Links oficiais de CMJ');
      expect(prompt).toContain('https://cmj.com.br');
      expect(findForeignBrandLeaks(prompt, { strict: true })).toEqual([]);
    });

    it('o bloco aparece UMA vez só (fallback não soma com o de runtime)', async () => {
      const prompt = await buildSystemPromptForContact({ ...baseInput, orgSettings: settingsCMJ });

      const ocorrencias = prompt.split('### Links oficiais de CMJ').length - 1;
      expect(ocorrencias).toBe(1);
    });
  });
});
