/**
 * AG3 · flowAiAgent — agentic tool loop (Pacote 2.6)
 *
 * runAgenticTurn: loop onde o LLM usa tools:
 *   LLM(system, messages, tools) → se tool_use → executa tools → append
 *   assistant tool_use + user tool_result → chama LLM de novo → repete
 *   até resposta final (text) ou max iterações.
 *
 * Deps injetados para testabilidade (sem IO real em testes):
 *   - callLLM: wrapper do LLMRouter (ou stub em testes)
 *   - runTool: executa a tool pelo nome (ou stub em testes)
 *   - maxIterations: cap de segurança contra loops infinitos
 *
 * Fail-soft: erro na execução de uma tool vira tool_result com mensagem de
 * erro — o LLM recebe o contexto e pode se recuperar sem exceção.
 */

import type { LLMMessage, ToolDefinition, ToolCall } from '../services/llm/LLMRouter.js';

export interface AgentDeps {
  callLLM: (messages: LLMMessage[], tools: ToolDefinition[], system: string) => Promise<{
    text: string;
    toolCalls?: ToolCall[];
    stopReason?: string;
  }>;
  runTool: (name: string, input: any) => Promise<string>;
  maxIterations?: number;
}

export interface AgenticResult {
  text: string;
  iterations: number;
  toolsUsed: string[];
}

export async function runAgenticTurn(input: {
  system: string;
  userMessage: string;
  history: LLMMessage[];
  tools: ToolDefinition[];
  deps: AgentDeps;
}): Promise<AgenticResult> {
  const { system, userMessage, history, tools, deps } = input;
  const max = deps.maxIterations ?? 3;
  const messages: LLMMessage[] = [...history, { role: 'user', content: userMessage }];
  const toolsUsed: string[] = [];
  let iterations = 0;

  for (let i = 0; i < max; i++) {
    iterations++;
    const resp = await deps.callLLM(messages, tools, system);
    const calls = resp.toolCalls ?? [];

    // Se não há tool_use, ou stopReason não é tool_use, retorna texto final
    if (resp.stopReason !== 'tool_use' || calls.length === 0) {
      return { text: resp.text || '', iterations, toolsUsed };
    }

    // 1) Registra a "fala" do assistente com os content blocks tool_use
    messages.push({
      role: 'assistant',
      content: calls.map((c) => ({
        type: 'tool_use' as const,
        id: c.id,
        name: c.name,
        input: c.input,
      })),
    });

    // 2) Executa cada tool (fail-soft: erro vira tool_result com mensagem de erro)
    const results: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];
    for (const c of calls) {
      toolsUsed.push(c.name);
      let out: string;
      try {
        out = await deps.runTool(c.name, c.input);
      } catch (e: any) {
        out = `ERRO ao executar a ferramenta: ${String(e?.message || e)}`;
      }
      results.push({
        type: 'tool_result',
        tool_use_id: c.id,
        content: String(out).slice(0, 8000),
      });
    }

    // 3) Appenda os tool_result como mensagem do "user"
    messages.push({ role: 'user', content: results });
  }

  // Cap atingido: solicita resposta final sem tools (best-effort)
  try {
    const finalResp = await deps.callLLM(messages, [], system);
    return { text: finalResp.text || 'Tudo certo!', iterations, toolsUsed };
  } catch {
    return { text: 'Tudo certo!', iterations, toolsUsed };
  }
}
