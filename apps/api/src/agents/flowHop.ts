import type { FlowStepResult } from './flowEngine.js';
export type HopIntent = 'call' | 'switch' | 'return' | 'stop';
/** Decide o próximo passo do hop loop do runtime (puro). */
export function nextHopIntent(
  gotoEff: { targetFlowId: string; mode?: 'goto' | 'call'; returnNodeId?: string | null } | undefined,
  next: FlowStepResult['next'],
  hasFrames: boolean,
): HopIntent {
  if (gotoEff) return gotoEff.mode === 'call' ? 'call' : 'switch';
  if (next === 'end' && hasFrames) return 'return';
  return 'stop';
}
