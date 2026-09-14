/**
 * agentOrchestrator.ragStatus.test.ts (B4, A028)
 * ============================================================================
 * search() engolia qualquer erro (serviço Python fora, timeout de 30 s, Redis)
 * e devolvia string vazia. O orquestrador trocava o vazio pela frase
 * "(sem contexto relevante encontrado para esta query)". O modelo recebia
 * EXATAMENTE a mesma informação em queda e em busca sem resultado, e respondia
 * "não tenho essa informação" quando na verdade a base não tinha sido
 * consultada.
 *
 * Agora o prompt distingue os dois: sem resultado deixa o bloco do RAG vazio;
 * serviço fora escreve uma linha dizendo que a base não respondeu.
 * ============================================================================
 */
import { describe, it, expect, vi } from 'vitest';

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
    agent: {
      findFirst: vi.fn().mockResolvedValue({
        systemPrompt: 'PROMPT-DO-AGENTE-DA-ORG',
        name: 'Agente',
      }),
    },
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

const baseInput = {
  organizationId: 'org-de-cliente-qualquer',
  contactId: 'contact-1',
  contactPhone: '5511999999999',
  orgSettings: { niche: 'generic', agentName: 'Bot', businessName: 'Cliente XPTO' },
};

const AVISO = 'base de conhecimento indisponível neste momento';

describe('buildSystemPromptForContact: status do RAG no prompt (A028)', () => {
  it('sem resultado: o bloco do RAG fica VAZIO, sem afirmar que não existe informação', async () => {
    const prompt = await buildSystemPromptForContact({
      ...baseInput,
      ragContext: '',
      ragStatus: 'sem_resultado',
    });

    expect(prompt).toContain('# Contexto recuperado (RAG)');
    expect(prompt).not.toContain(AVISO);
    expect(prompt).not.toContain('sem contexto relevante encontrado');
  });

  it('serviço fora: o agente é avisado de que a base não respondeu', async () => {
    const prompt = await buildSystemPromptForContact({
      ...baseInput,
      ragContext: '',
      ragStatus: 'servico_fora',
    });

    expect(prompt).toContain('# Contexto recuperado (RAG)');
    expect(prompt).toContain(AVISO);
  });

  it('com resultado: o contexto entra inteiro e sem aviso de indisponibilidade', async () => {
    const prompt = await buildSystemPromptForContact({
      ...baseInput,
      ragContext: 'O plano Growth custa 497 reais por mês.',
      ragStatus: 'ok',
    });

    expect(prompt).toContain('O plano Growth custa 497 reais por mês.');
    expect(prompt).not.toContain(AVISO);
  });

  it('quem não passa o status (playground, eval, Maestro) segue como antes', async () => {
    const prompt = await buildSystemPromptForContact({
      ...baseInput,
      ragContext: 'trecho recuperado',
    });

    expect(prompt).toContain('trecho recuperado');
    expect(prompt).not.toContain(AVISO);
  });
});
