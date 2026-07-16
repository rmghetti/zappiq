'use client';

/**
 * Barra de progresso da geração do Maestro.
 * ============================================================================
 * O servidor (apps/api/src/agents/maestroProgress.ts) emite marcos REAIS do
 * pipeline via Socket.io: contexto lido, fluxo 3 de 6 começando, handoffs sendo
 * desenhados. Cada marco vem com `percent` (onde estamos de verdade),
 * `nextPercent` (até onde dá pra andar sozinho) e `etaMs` (quanto essa etapa
 * costuma levar).
 *
 * Entre dois marcos a barra anda sozinha numa curva assintótica: cobre ~95% do
 * trecho em etaMs e nunca encosta em nextPercent. Isso resolve o caso que motivou
 * a feature — 1 objetivo tem UMA chamada de LLM que come ~22s, e sem a curva a
 * barra ficaria imóvel esse tempo todo, ou seja, o spinner mudo de novo. E como
 * a curva nunca alcança o teto, a barra jamais anuncia um marco que o servidor
 * não confirmou: se o LLM demorar o dobro, ela desacelera e espera, em vez de
 * bater 100% e mentir.
 *
 * Quem fecha em 100% é `finish()`, chamado só quando a resposta HTTP chegou e o
 * fluxo existe de fato.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getSocket } from '../../../../lib/socket';
import { easeTowards, type MaestroAnchor } from '../_lib/maestroCurve';

/** Espelha o evento do backend (apps/api/src/agents/maestroProgress.ts). */
const MAESTRO_PROGRESS_EVENT = 'maestro_progress';

interface MaestroProgressEvent {
  runId: string;
  phase: 'context' | 'draft' | 'handoffs' | 'wiring' | 'done';
  percent: number;
  nextPercent: number;
  etaMs: number;
  label: string;
  step?: number;
  totalSteps?: number;
}

export interface MaestroProgressState {
  percent: number;
  label: string;
  step?: number;
  totalSteps?: number;
}

/** Duração típica de um draft. Cópia do EST_DRAFT_MS do backend, usada só pra
 *  estimar o fallback quando o socket está mudo. Se divergir um pouco do servidor
 *  não quebra nada: o primeiro marco real reancorora a barra. */
const EST_DRAFT_MS = 22_000;

/** Onde a barra para se o socket nunca falar. Nunca 100: sem marco do servidor,
 *  a única prova de que terminou é a resposta HTTP. */
const OFFLINE_CEILING = 90;

/** Amostragem da curva. 8fps basta porque a largura tem transição em CSS —
 *  animar isso a 60fps só gastaria render sem ninguém enxergar diferença. */
const TICK_MS = 120;

export function newRunId(): string {
  // randomUUID exige contexto seguro (https/localhost); o fallback cobre o resto.
  // O id é só correlação de UI, não é segredo — não precisa ser imprevisível.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Progresso de UMA geração do Maestro.
 *
 * Uso:
 *   const { progress, start, finish, reset } = useMaestroProgress();
 *   const runId = start({ estimatedMs, label });   // manda o runId no POST
 *   ...                                            // await do POST
 *   await finish();                                // fecha em 100 e deixa ver
 */
export function useMaestroProgress() {
  const [progress, setProgress] = useState<MaestroProgressState | null>(null);
  const runIdRef = useRef<string | null>(null);
  const anchorRef = useRef<MaestroAnchor | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Último valor exibido. A barra é monotônica: nunca anda pra trás, mesmo que
   *  um marco chegue "atrasado" com um percent menor do que a curva já mostrou. */
  const shownRef = useRef(0);
  const labelRef = useRef('Começando');
  const stepRef = useRef<{ step?: number; totalSteps?: number }>({});

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const tick = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    shownRef.current = Math.max(shownRef.current, easeTowards(a, Date.now()));
    setProgress({ percent: shownRef.current, label: labelRef.current, ...stepRef.current });
  }, []);

  const anchorTo = useCallback((from: number, to: number, eta: number) => {
    // Ancorar no que já está na tela (e não no percent cru do evento) é o que
    // impede a barra de voltar quando a curva passou o marco recém-chegado.
    const base = Math.max(shownRef.current, from);
    anchorRef.current = { at: Date.now(), from: base, to: Math.max(to, base), eta: Math.max(eta, 1) };
  }, []);

  /** Ancora um marco. Serve tanto pros eventos do servidor quanto pras etapas que
   *  só o cliente conhece (o Arquiteto de Jornada ainda salva N fluxos por conta
   *  própria depois que a geração no servidor acabou). */
  const mark = useCallback((ev: Omit<MaestroProgressEvent, 'runId' | 'phase'>) => {
    labelRef.current = ev.label;
    stepRef.current = { step: ev.step, totalSteps: ev.totalSteps };
    anchorTo(ev.percent, ev.nextPercent, ev.etaMs);
    tick();
  }, [anchorTo, tick]);

  // Um listener pra todo o ciclo de vida do componente; o filtro por runId é que
  // separa as gerações. Sem ele, duas abas (ou dois usuários da mesma org, já que
  // o Socket.io aqui tem escopo de organização) embaralhariam a barra um do outro.
  useEffect(() => {
    const socket = getSocket();
    function onProgress(ev: MaestroProgressEvent) {
      if (!ev || ev.runId !== runIdRef.current) return;
      mark(ev);
    }
    socket.on(MAESTRO_PROGRESS_EVENT, onProgress);
    return () => { socket.off(MAESTRO_PROGRESS_EVENT, onProgress); };
  }, [mark]);

  useEffect(() => clearTimer, [clearTimer]);

  /** Começa uma geração. Devolve o runId que deve ir no corpo do POST. */
  const start = useCallback((opts: { estimatedMs: number; label: string }) => {
    const runId = newRunId();
    runIdRef.current = runId;
    shownRef.current = 0;
    labelRef.current = opts.label;
    stepRef.current = {};
    // Âncora otimista até o primeiro marco: se o Socket.io estiver fora do ar ou
    // bloqueado, a barra ainda anda e o cliente vê que a coisa está viva. O teto
    // de 90 + a curva assintótica garantem que ela não finge ter terminado.
    anchorTo(0, OFFLINE_CEILING, opts.estimatedMs);
    setProgress({ percent: 0, label: opts.label });
    clearTimer();
    timerRef.current = setInterval(tick, TICK_MS);
    return runId;
  }, [anchorTo, clearTimer, tick]);

  /** Fecha em 100% e segura um instante pro cliente ver o ciclo terminar.
   *  Só chame quando o resultado estiver na mão de verdade. */
  const finish = useCallback(async () => {
    runIdRef.current = null;
    anchorRef.current = null;
    clearTimer();
    shownRef.current = 100;
    setProgress({ percent: 100, label: 'Fluxo pronto' });
    await new Promise((r) => setTimeout(r, 450));
  }, [clearTimer]);

  /** Encerra sem chegar em 100 (erro/cancelamento). */
  const reset = useCallback(() => {
    runIdRef.current = null;
    anchorRef.current = null;
    clearTimer();
    shownRef.current = 0;
    setProgress(null);
  }, [clearTimer]);

  return { progress, start, mark, finish, reset, estDraftMs: EST_DRAFT_MS };
}

export function MaestroProgressBar({ progress }: { progress: MaestroProgressState }) {
  const pct = Math.round(progress.percent);
  const done = pct >= 100;
  const multi = (progress.totalSteps ?? 0) > 1;
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5 min-w-0">
          {!done && <Loader2 size={13} className="animate-spin text-indigo-600 shrink-0" />}
          <span className="truncate">{progress.label}</span>
          {multi && (
            <span className="text-gray-400 shrink-0">({progress.step} de {progress.totalSteps})</span>
          )}
        </p>
        {/* tabular-nums: sem isso o número dança de largura a cada tick. */}
        <span className="text-xs font-semibold text-indigo-600 tabular-nums shrink-0">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-indigo-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-600 transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
