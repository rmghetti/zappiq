/**
 * agentOrchestrator.greeting.test.ts — a "Mensagem de saudação" chega ao agente?
 * ============================================================================
 * Bug reportado pelo cliente (CMJ/Vera, 20/07/2026): no "Testar minha IA", ao
 * abrir um novo chat, a IA NÃO usava a saudação configurada ("olá bom dia, que
 * bom te ver por aqui...") — abria com o default genérico "Como posso te
 * chamar?" (CR-5 do coreAgentRules).
 *
 * Causa: settings.greetingMessage era um campo WRITE-ONLY. Salvo no signup
 * (onboarding.ts) e no PUT /ai-training/identity, contado no aiReadinessService,
 * mas NUNCA lido por buildSystemPromptForContact / promptEngine / seeder. A IA
 * nunca via a saudação, então caía no default do CR-5.
 *
 * Fix: no PRIMEIRO contato, injeta settings.greetingMessage no system prompt
 * (mesma ideia do handoffMessage, que já é lido). Vale nos dois caminhos (Agent
 * seedado e fallback). Não re-saúda em contato já estabelecido.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const agentFindFirst = vi.fn();
const messageCount = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: {
      findUnique: vi.fn().mockResolvedValue({
        leadStatus: 'NEW',
        name: null, // sem nome capturado — cenário de primeiro contato
        _count: { conversations: 0 },
      }),
    },
    message: { count: (...args: any[]) => messageCount(...args) },
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

import { buildSystemPromptForContact, buildGreetingBlock } from './agentOrchestrator.js';

const GREETING = 'Olá, bom dia! Que bom te ver por aqui 😊 Sou a Vera do CMJ.';

const settingsComSaudacao = {
  niche: 'servicos_b2b',
  agentName: 'Vera',
  businessName: 'CMJ',
  tone: 'friendly',
  greetingMessage: GREETING,
};

const baseInput = {
  organizationId: 'org-do-cmj',
  contactId: 'contact-1',
  contactPhone: '5511999999999',
  ragContext: '',
};

describe('buildGreetingBlock (lógica pura)', () => {
  it('injeta a saudação no primeiro contato', () => {
    const block = buildGreetingBlock(true, GREETING);
    expect(block).toContain(GREETING);
    expect(block).toContain('Saudação configurada');
  });
  it('não injeta fora do primeiro contato', () => {
    expect(buildGreetingBlock(false, GREETING)).toBe('');
  });
  it('sem saudação configurada, não injeta nada', () => {
    expect(buildGreetingBlock(true, '')).toBe('');
    expect(buildGreetingBlock(true, null)).toBe('');
    expect(buildGreetingBlock(true, '   ')).toBe('');
  });
});

describe('buildSystemPromptForContact — a saudação configurada chega ao agente', () => {
  beforeEach(() => {
    agentFindFirst.mockReset();
    messageCount.mockReset();
  });

  describe('org COM Agent seedado (100% das orgs hoje)', () => {
    beforeEach(() => {
      agentFindFirst.mockResolvedValue({ systemPrompt: 'PROMPT-SEEDADO', name: 'Vera' });
    });

    it('primeiro contato: injeta a saudação do dono do negócio', async () => {
      messageCount.mockResolvedValue(1); // 1 = a mensagem inbound atual → primeiro contato
      const prompt = await buildSystemPromptForContact({ ...baseInput, orgSettings: settingsComSaudacao });
      expect(prompt).toContain(GREETING);
    });

    it('contato já estabelecido: NÃO re-injeta a saudação', async () => {
      messageCount.mockResolvedValue(8); // já trocou várias mensagens
      const prompt = await buildSystemPromptForContact({ ...baseInput, orgSettings: settingsComSaudacao });
      expect(prompt).not.toContain(GREETING);
    });

    it('org sem saudação configurada não ganha bloco de saudação', async () => {
      messageCount.mockResolvedValue(1);
      const prompt = await buildSystemPromptForContact({
        ...baseInput,
        orgSettings: { niche: 'generic', agentName: 'Bot', businessName: 'Felix moveis' },
      });
      expect(prompt).not.toContain('Saudação configurada');
    });
  });

  describe('org SEM Agent seedado (fallback do promptEngine)', () => {
    beforeEach(() => {
      agentFindFirst.mockResolvedValue(null);
    });

    it('também injeta a saudação no primeiro contato', async () => {
      messageCount.mockResolvedValue(1);
      const prompt = await buildSystemPromptForContact({ ...baseInput, orgSettings: settingsComSaudacao });
      expect(prompt).toContain(GREETING);
    });
  });
});
