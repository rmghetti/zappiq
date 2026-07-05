/**
 * FEATURE 5a.1 — testes puros da lógica de handoff humano ↔ IA.
 */
import { describe, it, expect } from 'vitest';
import {
  aiPauseCacheKey,
  AI_PAUSE_HUMAN_VALUE,
  AI_PAUSE_TTL_SECONDS,
  planAssign,
  planReopen,
  planResumeAi,
  isHumanHandoffActive,
} from './conversations.handoff.js';

describe('aiPauseCacheKey', () => {
  it('monta a chave ai_paused:<org>:<phone>', () => {
    expect(aiPauseCacheKey('org1', '5511999')).toBe('ai_paused:org1:5511999');
  });
});

describe('constantes de cache', () => {
  it('valor humano e TTL de 7 dias', () => {
    expect(AI_PAUSE_HUMAN_VALUE).toBe('human');
    expect(AI_PAUSE_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });
});

describe('planAssign', () => {
  it('ASSUMIR (agentId presente) → ASSIGNED, aiPaused=true, pausa cache', () => {
    const t = planAssign('user_42');
    expect(t.data.assignedToId).toBe('user_42');
    expect(t.data.status).toBe('ASSIGNED');
    expect(t.data.aiPaused).toBe(true);
    expect(t.cacheEffect).toBe('pause');
  });

  it('desatribuir (agentId vazio) → OPEN, aiPaused=false, resume cache', () => {
    const t = planAssign('');
    expect(t.data.assignedToId).toBeNull();
    expect(t.data.status).toBe('OPEN');
    expect(t.data.aiPaused).toBe(false);
    expect(t.cacheEffect).toBe('resume');
  });

  it('agentId null é tratado como desatribuição', () => {
    const t = planAssign(null);
    expect(t.data.assignedToId).toBeNull();
    expect(t.data.aiPaused).toBe(false);
    expect(t.cacheEffect).toBe('resume');
  });
});

describe('planReopen', () => {
  it('sem humano atribuído → OPEN, closedAt=null, IA segue (cache none)', () => {
    const t = planReopen(null);
    expect(t.data.status).toBe('OPEN');
    expect(t.data.closedAt).toBeNull();
    expect(t.data.aiPaused).toBeUndefined(); // não mexe na pausa
    expect(t.cacheEffect).toBe('none');
  });

  it('com humano atribuído → ASSIGNED, closedAt=null', () => {
    const t = planReopen('user_7');
    expect(t.data.status).toBe('ASSIGNED');
    expect(t.data.closedAt).toBeNull();
    expect(t.cacheEffect).toBe('none');
  });
});

describe('planResumeAi', () => {
  it('conversa ASSIGNED → despausa e reabre para OPEN, resume cache', () => {
    const t = planResumeAi('ASSIGNED');
    expect(t.data.aiPaused).toBe(false);
    expect(t.data.status).toBe('OPEN');
    expect(t.cacheEffect).toBe('resume');
  });

  it('conversa OPEN (só pausada) → despausa sem mexer no status', () => {
    const t = planResumeAi('OPEN');
    expect(t.data.aiPaused).toBe(false);
    expect(t.data.status).toBeUndefined();
    expect(t.cacheEffect).toBe('resume');
  });

  it('nunca "desfecha" uma CLOSED — status permanece intocado', () => {
    const t = planResumeAi('CLOSED');
    expect(t.data.aiPaused).toBe(false);
    expect(t.data.status).toBeUndefined();
    expect(t.cacheEffect).toBe('resume');
  });
});

describe('isHumanHandoffActive', () => {
  it('true quando aiPaused', () => {
    expect(isHumanHandoffActive({ aiPaused: true, status: 'OPEN' })).toBe(true);
  });
  it('true quando ASSIGNED', () => {
    expect(isHumanHandoffActive({ aiPaused: false, status: 'ASSIGNED' })).toBe(true);
  });
  it('false quando IA ativa e não atribuída', () => {
    expect(isHumanHandoffActive({ aiPaused: false, status: 'OPEN' })).toBe(false);
  });
});
