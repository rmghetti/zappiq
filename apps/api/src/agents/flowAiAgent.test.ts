import { describe, it, expect, vi } from 'vitest';
import { runAgenticTurn, type AgentDeps } from './flowAiAgent.js';

const baseTools = [{ name: 'consultar', description: 'consulta', inputSchema: { type: 'object' } }];

describe('runAgenticTurn', () => {
  it('sem tool_use → retorna o texto direto', async () => {
    const deps: AgentDeps = {
      callLLM: vi.fn().mockResolvedValue({ text: 'Olá, posso ajudar', toolCalls: undefined, stopReason: 'end_turn' }),
      runTool: vi.fn(),
      maxIterations: 3,
    };
    const r = await runAgenticTurn({ system: 's', userMessage: 'oi', history: [], tools: baseTools, deps });
    expect(r.text).toBe('Olá, posso ajudar');
    expect(deps.runTool).not.toHaveBeenCalled();
  });

  it('1 tool_use → executa a tool, devolve tool_result, responde', async () => {
    const callLLM = vi.fn()
      .mockResolvedValueOnce({ text: '', toolCalls: [{ id: 't1', name: 'consultar', input: { n: 1 } }], stopReason: 'tool_use' })
      .mockResolvedValueOnce({ text: 'Seu pedido está a caminho', toolCalls: undefined, stopReason: 'end_turn' });
    const runTool = vi.fn().mockResolvedValue('{"status":"a caminho"}');
    const r = await runAgenticTurn({ system: 's', userMessage: 'cadê meu pedido?', history: [], tools: baseTools, deps: { callLLM, runTool, maxIterations: 3 } });
    expect(runTool).toHaveBeenCalledWith('consultar', { n: 1 });
    expect(r.text).toBe('Seu pedido está a caminho');
    // a 2ª chamada ao LLM deve incluir uma mensagem com tool_result
    const secondCallMessages = callLLM.mock.calls[1][0];
    const hasToolResult = JSON.stringify(secondCallMessages).includes('tool_result') && JSON.stringify(secondCallMessages).includes('a caminho');
    expect(hasToolResult).toBe(true);
  });

  it('tool lança/erro → tool_result com erro, o loop continua (fail-soft)', async () => {
    const callLLM = vi.fn()
      .mockResolvedValueOnce({ text: '', toolCalls: [{ id: 't1', name: 'consultar', input: {} }], stopReason: 'tool_use' })
      .mockResolvedValueOnce({ text: 'Não consegui consultar agora, mas posso ajudar de outro jeito', stopReason: 'end_turn' });
    const runTool = vi.fn().mockRejectedValue(new Error('webhook down'));
    const r = await runAgenticTurn({ system: 's', userMessage: 'x', history: [], tools: baseTools, deps: { callLLM, runTool, maxIterations: 3 } });
    expect(r.text).toContain('Não consegui');
    // tool_result com a mensagem de erro foi enviado
    expect(JSON.stringify(callLLM.mock.calls[1][0])).toMatch(/erro|down|falh/i);
  });

  it('cap de iterações: se o LLM só pede tool, para no máx e devolve um texto', async () => {
    const callLLM = vi.fn().mockResolvedValue({ text: '', toolCalls: [{ id: 't', name: 'consultar', input: {} }], stopReason: 'tool_use' });
    const runTool = vi.fn().mockResolvedValue('ok');
    const r = await runAgenticTurn({ system: 's', userMessage: 'x', history: [], tools: baseTools, deps: { callLLM, runTool, maxIterations: 2 } });
    // chamou no máximo maxIterations+? — não deve rodar infinito; runTool chamado <= 2
    expect(runTool.mock.calls.length).toBeLessThanOrEqual(2);
    expect(typeof r.text).toBe('string');
  });
});
