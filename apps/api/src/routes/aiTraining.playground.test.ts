/**
 * FEATURE 5a.2 — testes puros do shaping do playground "Testar minha IA".
 *
 * Mocamos as deps de limpeza (agentOrchestrator + vozHumanaFilter) pra isolar
 * a lógica DESTE módulo: (a) reuso da cadeia de limpeza, (b) usedContext
 * derivado das fontes, (c) validação do input. Isso evita puxar o mundo do
 * orchestrator (prisma/cache/whatsapp) só pra testar duas funções puras.
 */
import { describe, it, expect, vi } from 'vitest';

// Cadeia de limpeza mockada com sentinelas rastreáveis: garante que o módulo
// REUSA as mesmas funções do orchestrator, sem reimplementar.
vi.mock('../agents/agentOrchestrator.js', () => ({
  stripStructuredTags: (t: string) => t.replace('<TAG>', ''),
  stripLeakedPrefixes: (t: string) => t.replace('[pfx]', ''),
}));
vi.mock('../agents/vozHumanaFilter.js', () => ({
  applyVozHumanaFilter: (t: string) => t.replace(' — ', ', '),
}));

import {
  testMessageSchema,
  cleanPlaygroundReply,
  buildPlaygroundResult,
} from './aiTraining.playground.js';

describe('testMessageSchema', () => {
  it('aceita mensagem válida', () => {
    expect(testMessageSchema.safeParse({ message: 'oi' }).success).toBe(true);
  });
  it('rejeita mensagem vazia', () => {
    expect(testMessageSchema.safeParse({ message: '' }).success).toBe(false);
  });
  it('rejeita mensagem acima de 2000 chars', () => {
    expect(testMessageSchema.safeParse({ message: 'x'.repeat(2001) }).success).toBe(false);
  });
  it('rejeita quando message ausente', () => {
    expect(testMessageSchema.safeParse({}).success).toBe(false);
  });
});

describe('cleanPlaygroundReply', () => {
  it('aplica strip de tags, prefixos e filtro de voz humana', () => {
    expect(cleanPlaygroundReply('[pfx]<TAG>Oi — tudo bem')).toBe('Oi, tudo bem');
  });
  it('lida com entrada vazia/nula sem quebrar', () => {
    expect(cleanPlaygroundReply('')).toBe('');
    expect(cleanPlaygroundReply(undefined as any)).toBe('');
  });
});

describe('buildPlaygroundResult', () => {
  it('usedContext=true e mapeia fontes quando RAG retornou algo', () => {
    const out = buildPlaygroundResult({
      rawLlmText: 'resposta',
      sources: [{ source: 'faq.md', similarity: 0.9, snippet: 'trecho' }],
    });
    expect(out.usedContext).toBe(true);
    expect(out.reply).toBe('resposta');
    expect(out.sources).toEqual([{ source: 'faq.md', similarity: 0.9, snippet: 'trecho' }]);
  });

  it('usedContext=false quando não há fontes', () => {
    const out = buildPlaygroundResult({ rawLlmText: 'resposta', sources: [] });
    expect(out.usedContext).toBe(false);
    expect(out.sources).toEqual([]);
  });

  it('sources não-array é tratado como vazio (defensivo)', () => {
    const out = buildPlaygroundResult({ rawLlmText: 'x', sources: null as any });
    expect(out.usedContext).toBe(false);
    expect(out.sources).toEqual([]);
  });

  it('limpa o texto do LLM na resposta final', () => {
    const out = buildPlaygroundResult({ rawLlmText: '<TAG>limpo', sources: [] });
    expect(out.reply).toBe('limpo');
  });
});
