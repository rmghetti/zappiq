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
import { postProcessReply, type PostProcessInput } from '../agents/postProcessReply.js';

/**
 * Sem a organização em mãos, o teste trata quem chamou como cliente sem
 * nome: a guarda de marca roda do mesmo jeito (a ZappIQ é a única exceção,
 * e ela sempre chega identificada pela rota).
 */
const ORGANIZACAO_SEM_NOME: PostProcessInput['organizacao'] = { id: '', ehZappIQ: false, nome: null };

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
  /**
   * C1b (A189): alertas do pós-processador de saída (a guarda de marca).
   * Vazio quando nada disparou. Quando a guarda segura a resposta, o texto
   * de `reply` explica ao dono o que aconteceu e o que o cliente leria.
   */
  alertas: string[];
  /** true quando a guarda trocou a resposta pela resposta segura. */
  bloqueada: boolean;
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
  // A088: uma definição só, em agents/replyText.ts, compartilhada com o
  // WhatsApp e com o avaliador da Qualidade. C1b: chamada pelo
  // pós-processador único, como todos os canais.
  return postProcessReply({ bruto: rawLlmText, canal: 'playground', organizacao: ORGANIZACAO_SEM_NOME })
    .texto;
}

/**
 * Monta o payload final do playground a partir da saída do LLM e das fontes do
 * RAG. `usedContext` é true quando o retrieval devolveu ao menos uma fonte —
 * sinal pro dono do negócio de que os documentos dele estão sendo usados.
 */
export function buildPlaygroundResult(input: {
  rawLlmText: string;
  sources: RagSource[];
  /**
   * C1b: quem é o cliente e quem é o agente, para a guarda de marca do
   * pós-processador único. Ausente, o teste trata a organização como
   * cliente sem nome (a guarda roda do mesmo jeito).
   */
  organizacao?: PostProcessInput['organizacao'];
  agente?: PostProcessInput['agente'];
}): PlaygroundReply {
  const sources = Array.isArray(input.sources) ? input.sources : [];
  // O MESMO pós-processador do WhatsApp, do site, da retomada e da
  // Qualidade (C1b, A189). O texto é o de cleanPlaygroundReply; o que muda
  // é a guarda de marca, que agora roda aqui também.
  const saida = postProcessReply({
    bruto: input.rawLlmText,
    canal: 'playground',
    organizacao: input.organizacao ?? ORGANIZACAO_SEM_NOME,
    agente: input.agente ?? null,
  });
  return {
    reply: saida.texto,
    alertas: saida.alertas,
    bloqueada: saida.bloqueada,
    usedContext: sources.length > 0,
    sources: sources.map((s) => ({
      source: s.source,
      similarity: s.similarity,
      snippet: s.snippet,
    })),
  };
}
