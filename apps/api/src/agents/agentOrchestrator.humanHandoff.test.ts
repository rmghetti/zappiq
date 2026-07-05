/**
 * agentOrchestrator.humanHandoff.test.ts — W3.4
 * ============================================================================
 * Regressão: responder como humano (POST manual em messages.ts) NÃO pausava a
 * Iza nem atribuía a conversa. Resultado: IA e humano falavam com o cliente ao
 * mesmo tempo.
 *
 * Fix: o POST manual (e o PUT /assign) marcam a conversa como ASSIGNED +
 * aiPaused=true. O orchestrator, ANTES de responder, consulta esse estado e
 * pula a resposta enquanto houver atendimento humano.
 *
 * Aqui testamos a DECISÃO pura (shouldSkipForHumanHandoff), que é o guard
 * durável (fonte de verdade no banco), independente do cache fast-path.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { shouldSkipForHumanHandoff } from './agentOrchestrator.js';

describe('shouldSkipForHumanHandoff (W3.4)', () => {
  it('pausa quando aiPaused === true (humano respondeu)', () => {
    expect(
      shouldSkipForHumanHandoff({ aiPaused: true, status: 'OPEN', assignedToId: null }),
    ).toBe(true);
  });

  it('pausa quando ASSIGNED a um humano (assignedToId preenchido)', () => {
    expect(
      shouldSkipForHumanHandoff({ aiPaused: false, status: 'ASSIGNED', assignedToId: 'user_1' }),
    ).toBe(true);
  });

  it('NÃO pausa conversa OPEN sem atribuição (IA responde normalmente)', () => {
    expect(
      shouldSkipForHumanHandoff({ aiPaused: false, status: 'OPEN', assignedToId: null }),
    ).toBe(false);
  });

  it('NÃO pausa quando status é ASSIGNED mas sem assignee (defensivo)', () => {
    expect(
      shouldSkipForHumanHandoff({ aiPaused: false, status: 'ASSIGNED', assignedToId: null }),
    ).toBe(false);
  });

  it('NÃO pausa após reabrir para a IA (unassign: aiPaused=false, OPEN)', () => {
    expect(
      shouldSkipForHumanHandoff({ aiPaused: false, status: 'OPEN', assignedToId: null }),
    ).toBe(false);
  });

  it('trata conversa inexistente/undefined como não-pausada (fail-open)', () => {
    expect(shouldSkipForHumanHandoff(null)).toBe(false);
    expect(shouldSkipForHumanHandoff(undefined)).toBe(false);
  });

  it('aiPaused=true tem prioridade mesmo em conversa OPEN sem assignee', () => {
    expect(
      shouldSkipForHumanHandoff({ aiPaused: true, status: 'OPEN', assignedToId: null }),
    ).toBe(true);
  });
});
