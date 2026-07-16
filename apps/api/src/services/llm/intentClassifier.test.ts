/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Tests do intent classifier
 *
 * Estratégia: mocka LLMRouter pra simular respostas controladas do Haiku.
 * Garantimos que:
 *   ✓ Resposta limpa retorna intent correta
 *   ✓ Resposta com prefixo/pontuação é parseada
 *   ✓ Resposta inesperada → fallback 'normal'
 *   ✓ Erro do LLM → fallback 'normal' (não bloqueia turn)
 *   ✓ shouldEscalateToSonnet retorna correto pra cada intent
 *   ✓ History é limitada a últimos 4 turns
 *   ✓ Force provider é Haiku
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LLMRouter antes de importar o módulo sob teste
const { mockComplete } = vi.hoisted(() => ({
  mockComplete: vi.fn(),
}));

vi.mock('./LLMRouter.js', () => ({
  llmRouter: { complete: mockComplete },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { classifyIntent, shouldEscalateToSonnet } from './intentClassifier.js';
// Guard real (módulo puro, sem I/O) rodando contra o prompt real.
import { findForeignBrandLeaks } from '../../agents/tenantIsolationGuard.js';

describe('classifyIntent — happy path', () => {
  beforeEach(() => {
    mockComplete.mockReset();
  });

  it('retorna handoff quando Haiku diz "handoff"', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'handoff',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('quero falar com gente', []);
    expect(intent).toBe('handoff');
  });

  it('retorna objection quando Haiku diz "objection"', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'objection',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('tá caro pra quem ta começando', []);
    expect(intent).toBe('objection');
  });

  it('retorna enterprise quando Haiku diz "enterprise"', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'enterprise',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('sou CEO de logística com 2000 atendimentos/dia', []);
    expect(intent).toBe('enterprise');
  });

  it('retorna normal quando Haiku diz "normal"', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'normal',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('oi', []);
    expect(intent).toBe('normal');
  });
});

describe('classifyIntent — parsing robusto', () => {
  beforeEach(() => mockComplete.mockReset());

  it('parseia resposta com prefixo "Intent: handoff"', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'Intent: handoff',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('quero humano', []);
    expect(intent).toBe('handoff');
  });

  it('parseia resposta com pontuação "objection."', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'objection.',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('comparado com Blip', []);
    expect(intent).toBe('objection');
  });

  it('parseia resposta com newline e whitespace "  handoff\\n"', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '  handoff\n',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('humano', []);
    expect(intent).toBe('handoff');
  });

  it('parseia resposta em maiúsculas "HANDOFF"', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'HANDOFF',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('humano', []);
    expect(intent).toBe('handoff');
  });
});

describe('classifyIntent — fallback safe', () => {
  beforeEach(() => mockComplete.mockReset());

  it('retorna normal quando Haiku devolve resposta inválida', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'desculpe não consegui classificar',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const intent = await classifyIntent('mensagem confusa', []);
    expect(intent).toBe('normal');
  });

  it('retorna normal quando LLMRouter lança erro', async () => {
    mockComplete.mockRejectedValueOnce(new Error('all providers exhausted'));
    const intent = await classifyIntent('qualquer coisa', []);
    expect(intent).toBe('normal');
  });

  it('retorna normal quando mensagem é vazia', async () => {
    const intent = await classifyIntent('', []);
    expect(intent).toBe('normal');
    // Não chamou LLM (otimização)
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('retorna normal quando mensagem é null', async () => {
    const intent = await classifyIntent(null as any, []);
    expect(intent).toBe('normal');
    expect(mockComplete).not.toHaveBeenCalled();
  });
});

describe('classifyIntent — força Haiku como provider', () => {
  beforeEach(() => mockComplete.mockReset());

  it('chama LLMRouter com forceProvider anthropic-haiku', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'normal',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    await classifyIntent('oi', [], { orgId: 'org-x', conversationId: 'conv-y' });
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        forceProvider: 'anthropic-haiku',
        operation: 'classify',
        maxTokens: 10,
        temperature: 0,
        orgId: 'org-x',
        conversationId: 'conv-y',
      }),
    );
  });

  it('inclui histórico curto (últimos 4 turns) no prompt', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'normal',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });
    const longHistory = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
    }));
    await classifyIntent('última', longHistory);
    const call = mockComplete.mock.calls[0][0];
    const userMsg = call.messages[0].content as string;
    // Deve conter as 4 últimas mensagens (índices 6-9), não as 10 totais
    expect(userMsg).toContain('msg 6');
    expect(userMsg).toContain('msg 9');
    expect(userMsg).not.toContain('msg 0');
    expect(userMsg).not.toContain('msg 1');
  });
});

/* ──────────────────────────────────────────────────────────────────────
 * Isolamento do tenant (14/07/2026)
 * O classifier roda em TODO turno de TODO tenant, sem gate por org. Então
 * nada aqui pode assumir a Iza: nem o rótulo do histórico, nem os exemplos
 * do prompt. Estes testes olham o que SAI pro LLM, não o código-fonte.
 * ────────────────────────────────────────────────────────────────────── */
describe('classifyIntent: isolamento do tenant', () => {
  beforeEach(() => mockComplete.mockReset());

  const respondeNormal = () =>
    mockComplete.mockResolvedValueOnce({
      text: 'normal',
      provider: 'anthropic-haiku',
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 400,
      attempt: 1,
    });

  const historico: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: 'quanto custa o implante?' },
    { role: 'assistant', content: 'Fica R$ 2.500 à vista. Quer agendar avaliação?' },
  ];

  const promptEnviado = () => mockComplete.mock.calls[0][0].messages[0].content as string;
  const systemEnviado = () => mockComplete.mock.calls[0][0].system as string;

  it('NÃO assina a fala do agente do cliente como "Iza"', async () => {
    respondeNormal();
    await classifyIntent('quero sim', historico, { orgId: 'org-cmj' });
    expect(promptEnviado()).not.toMatch(/\bIza\b/i);
  });

  it('usa o nome do agente do tenant quando o caller informa', async () => {
    respondeNormal();
    await classifyIntent('quero sim', historico, { orgId: 'org-cmj', agentName: 'Vera' });
    expect(promptEnviado()).toContain('Vera: Fica R$ 2.500');
  });

  it('cai no rótulo neutro "Agente" quando não informam o nome', async () => {
    respondeNormal();
    await classifyIntent('quero sim', historico);
    expect(promptEnviado()).toContain('Agente: Fica R$ 2.500');
  });

  it('agentName vazio/branco não vira rótulo vazio', async () => {
    respondeNormal();
    await classifyIntent('quero sim', historico, { agentName: '   ' });
    expect(promptEnviado()).toContain('Agente: Fica R$ 2.500');
  });

  it('continua rotulando a ponta do cliente como "Cliente"', async () => {
    respondeNormal();
    await classifyIntent('quero sim', historico, { agentName: 'Vera' });
    expect(promptEnviado()).toContain('Cliente: quanto custa o implante?');
  });

  it('o system prompt não leva marca nem comercial da ZappIQ pro tenant', async () => {
    respondeNormal();
    await classifyIntent('oi', historico, { orgId: 'org-cmj' });
    // strict: pega também SKU/preço/trial/concorrente citados no prompt da Iza.
    const leaks = findForeignBrandLeaks(systemEnviado(), { strict: true });
    expect(leaks).toEqual([]);
  });

  it('o prompt inteiro (system + user) sai limpo pro tenant', async () => {
    respondeNormal();
    await classifyIntent('qual o valor?', historico, { orgId: 'org-cmj', agentName: 'Vera' });
    const leaks = findForeignBrandLeaks(`${systemEnviado()}\n${promptEnviado()}`, { strict: true });
    expect(leaks).toEqual([]);
  });
});

describe('shouldEscalateToSonnet', () => {
  it('escala em handoff, objection, enterprise', () => {
    expect(shouldEscalateToSonnet('handoff')).toBe(true);
    expect(shouldEscalateToSonnet('objection')).toBe(true);
    expect(shouldEscalateToSonnet('enterprise')).toBe(true);
  });

  it('NÃO escala em normal', () => {
    expect(shouldEscalateToSonnet('normal')).toBe(false);
  });
});
