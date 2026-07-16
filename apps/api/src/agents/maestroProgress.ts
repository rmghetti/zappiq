/**
 * ZappIQ Maestro — progresso da geração em tempo real
 * ============================================================================
 * PROBLEMA: gerar fluxo leva de ~20s (1 objetivo) a mais de um minuto (multi-
 * agente com 6 objetivos, ou o Arquiteto de Jornada, que ainda soma a malha de
 * handoffs por cima dos drafts). Até aqui a UI tinha só um spinner mudo com
 * "Pensando no seu negócio…", e o cliente não conseguia distinguir "travou" de
 * "está demorando mesmo".
 *
 * COMO FUNCIONA: a geração é um pipeline com fronteiras REAIS — carrega o
 * contexto do ai-training, chama o LLM uma vez por objetivo EM SÉRIE, e (na
 * jornada) desenha a malha de handoffs. Cada fronteira emite um marco verdadeiro
 * na sala `org:<id>` do Socket.io, infra que já existia e que a /flows já
 * conecta pelo layout do dashboard. Sem fila, sem tabela, sem SSE novo.
 *
 * POR QUE O EVENTO CARREGA `nextPercent` + `etaMs`: no caminho padrão (1
 * objetivo) existe UMA chamada de LLM que consome quase todo o wall clock. Só
 * com marcos reais, a barra ficaria imóvel uns 20s no meio — o mesmo problema do
 * spinner, agora com números. Em vez de inventar progresso aqui no servidor, o
 * marco diz ao cliente até onde ele pode andar sozinho (`nextPercent`) e quanto
 * essa etapa costuma levar (`etaMs`). O cliente interpola numa curva assintótica
 * que NUNCA alcança nextPercent antes de o próximo marco real chegar: a barra
 * sempre se mexe, cada número fica ancorado em algo verdadeiro, e 100% só existe
 * quando o fluxo existe de fato.
 *
 * MULTI-TENANT: o emit vai pra sala da organização (que é o escopo do Socket.io
 * aqui, e alcança todos os dispositivos do cliente), mas cada geração carrega um
 * `runId` opaco. O cliente descarta o que não for do run dele, então duas pessoas
 * da mesma org gerando ao mesmo tempo não embaralham a barra uma da outra.
 * ============================================================================
 */
import { getIo } from '../utils/socketRegistry.js';

/** Nome do evento no Socket.io. O cliente escuta exatamente isto. */
export const MAESTRO_PROGRESS_EVENT = 'maestro_progress';

export type MaestroPhase = 'context' | 'draft' | 'handoffs' | 'wiring' | 'done';

export interface MaestroProgressEvent {
  /** Correlaciona o evento com a geração que ESTE cliente disparou. */
  runId: string;
  phase: MaestroPhase;
  /** Marco REAL recém-atingido (0..100). */
  percent: number;
  /** Teto até onde o cliente pode interpolar sozinho enquanto espera o próximo marco. */
  nextPercent: number;
  /** Duração típica desta etapa, só pra calibrar a velocidade da curva do cliente. */
  etaMs: number;
  /** Texto exibido ao usuário. */
  label: string;
  /** Draft atual (1-based) e total — preenchidos quando a fase é 'draft'. */
  step?: number;
  totalSteps?: number;
}

export type MaestroReporter = (ev: Omit<MaestroProgressEvent, 'runId'>) => void;

// Durações estimadas, usadas SÓ pra calibrar a velocidade da barra entre dois
// marcos reais — nunca pra decidir que algo terminou. Superestimar é mais seguro
// que subestimar: como a curva do cliente é assintótica, chutar alto só deixa a
// barra mais lenta, enquanto chutar baixo faz ela colar no teto e parecer travada.
// Âncora: Sonnet devolvendo JSON estruturado com os maxTokens de cada chamada.
export const EST_CONTEXT_MS = 700; // 3 queries no Postgres (org + docs + Q&A)
export const EST_DRAFT_MS = 22_000; // generateRichDraft, maxTokens 1500
export const EST_HANDOFFS_MS = 15_000; // designHandoffs, maxTokens 1100
export const EST_WIRING_MS = 300; // injeção dos handoffs nos nós-IA (síncrono)

// A régua não vai até 100 durante o pipeline: os últimos pontos são do retorno
// do HTTP e, na jornada, dos POSTs que o cliente ainda faz pra salvar os fluxos.
// Quem fecha em 100 é o cliente, quando tem o resultado na mão.
export const RULER_END = 97;

/**
 * Cria o emissor de progresso de UMA geração.
 *
 * Sem runId (cliente antigo, que não manda o campo) ou sem Socket.io no ar
 * (testes, boot, worker fora do processo), devolve um no-op: a geração roda
 * exatamente igual, só sem barra. Progresso é cosmético e jamais pode ser o
 * motivo de uma geração falhar.
 */
export function createMaestroReporter(organizationId: string, runId?: string): MaestroReporter {
  if (!runId) return () => { /* cliente não pediu progresso */ };
  return (ev) => {
    const io = getIo();
    if (!io) return;
    try {
      io.to(`org:${organizationId}`).emit(MAESTRO_PROGRESS_EVENT, { runId, ...ev } satisfies MaestroProgressEvent);
    } catch {
      /* fail-soft: socket com problema não derruba a geração */
    }
  };
}

/**
 * Reparte a faixa [from, to] da régua proporcionalmente ao PESO de cada etapa
 * (o tempo estimado dela), e não em partes iguais.
 *
 * Por quê: numa jornada de 6 drafts + handoffs, fatias iguais dariam ao handoff
 * (~15s) o mesmo espaço que a um draft (~22s), então a barra empacaria nos drafts
 * e dispararia no fim. Proporcional ao tempo, ela anda num ritmo parecido do
 * início ao fim, que é o que faz o número parecer confiável.
 */
export function weightedSlices(
  weights: number[],
  range: { from: number; to: number },
): Array<{ from: number; to: number }> {
  const total = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || total <= 0) return [];
  const span = range.to - range.from;
  const out: Array<{ from: number; to: number }> = [];
  let acc = range.from;
  for (const w of weights) {
    const next = acc + (w / total) * span;
    out.push({ from: acc, to: next });
    acc = next;
  }
  // Fecha a última fatia exatamente em range.to (mata o drift de float).
  out[out.length - 1].to = range.to;
  return out;
}
