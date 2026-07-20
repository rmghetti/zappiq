/**
 * FEATURE 5a.2 — Playground "Testar minha IA" (lógica pura).
 *
 * O dono do negócio precisa testar o treino ANTES de conectar o WhatsApp:
 * digita uma mensagem, ela roda pela MESMA IA da org (prompt do Agent live +
 * retrieval RAG real) e volta a resposta, SEM passar pelo WhatsApp e SEM criar
 * Conversation/Contact reais.
 *
 * Este módulo isola a lógica PURA (validação de input + shaping da resposta)
 * do handler HTTP em aiTraining.ts, pra ser testável sem tocar Express/LLM/DB.
 */
import { z } from 'zod';
import type { RagSource } from '../services/ragService.js';
import { stripStructuredTags, stripLeakedPrefixes } from '../agents/agentOrchestrator.js';
import { applyVozHumanaFilter } from '../agents/vozHumanaFilter.js';

/**
 * Contrato de entrada: a mensagem do dono do negócio + o histórico da conversa
 * de teste até aqui, pra IA ter memória entre turnos (mesma sessão do playground).
 *
 * `history` é opcional (turno inicial não tem) e propositalmente restrito:
 *   - só roles `user`/`assistant` (nada de `system` vindo do cliente);
 *   - conteúdo string, cada mensagem capada em 2000 chars (igual a `message`);
 *   - no máximo 20 turnos — os mais antigos são cortados no frontend; o cap aqui
 *     é o teto de segurança contra payload inflado (a rota é stateless e o
 *     histórico vem do cliente, então precisa de limite duro).
 */
export const playgroundHistoryTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
});

export const testMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(playgroundHistoryTurnSchema).max(20).optional(),
});

export interface PlaygroundReply {
  reply: string;
  usedContext: boolean;
  sources: Array<{ source: string; similarity: number; snippet: string }>;
}

/**
 * Limpa a saída bruta do LLM do MESMO jeito que o orchestrator faz antes de
 * mandar pro WhatsApp: extrai o conteúdo de <reply>…</reply>, remove tags
 * estruturadas (<action>, <buttons>, ...), prefixos vazados ([áudio] etc.) e
 * aplica o filtro de voz humana (sem travessão, tom natural). Assim o teste
 * reflete o que o cliente final veria.
 *
 * O passo de <reply> é o que faltava e causava a resposta DUPLICADA no
 * "Testar minha IA": o promptEngine manda o modelo pôr <reply>…</reply> "no
 * final da resposta", então o LLM escreve a resposta em prosa e DEPOIS repete
 * dentro de <reply> — o texto vem 2x no raw. parseAgentResponse (produção,
 * WhatsApp) e webChatService já priorizam o conteúdo de <reply>; o playground
 * só fazia stripStructuredTags (que remove as TAGS, não a cópia em prosa) e
 * devolvia as duas cópias. Agora usa a mesma lógica dos dois caminhos vivos.
 */
export function cleanPlaygroundReply(rawLlmText: string): string {
  const raw = rawLlmText ?? '';
  // Se houver <reply>…</reply>, prioriza esse conteúdo (mesma lógica de
  // parseAgentResponse/webChatService) — colapsa a duplicação prosa+tag.
  const replyMatch = raw.match(/<reply>([\s\S]*?)<\/reply>/i);
  let candidate = replyMatch ? replyMatch[1] : raw;
  candidate = stripStructuredTags(candidate);
  candidate = stripLeakedPrefixes(candidate);
  candidate = applyVozHumanaFilter(candidate);
  return candidate.trim();
}

/**
 * Monta o payload final do playground a partir da saída do LLM e das fontes do
 * RAG. `usedContext` é true quando o retrieval devolveu ao menos uma fonte —
 * sinal pro dono do negócio de que os documentos dele estão sendo usados.
 */
export function buildPlaygroundResult(input: {
  rawLlmText: string;
  sources: RagSource[];
}): PlaygroundReply {
  const sources = Array.isArray(input.sources) ? input.sources : [];
  return {
    reply: cleanPlaygroundReply(input.rawLlmText),
    usedContext: sources.length > 0,
    sources: sources.map((s) => ({
      source: s.source,
      similarity: s.similarity,
      snippet: s.snippet,
    })),
  };
}
