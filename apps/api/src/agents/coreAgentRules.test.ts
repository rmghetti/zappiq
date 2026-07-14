/* ══════════════════════════════════════════════════════════════════════
 * Tests das Core Rules: regras universais, marca nenhuma.
 * --------------------------------------------------------------------
 * Este bloco é prependado ao systemPrompt de TODO agente de cliente
 * (agentOrchestrator.buildSystemPromptForContact). Tudo que está aqui a Vera
 * (CMJ) lê e obedece. Até a v1 levava título "CORE RULES ZAPPIQ", o trial de
 * 14 dias como exemplo de friction-reducer, os NOSSOS planos como exemplo de
 * catálogo e a Iza citada na regra de TTS.
 *
 * O teste trava as duas pontas: sem marca nossa, mas com as regras de pé.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { CORE_AGENT_RULES_V1, CORE_RULES_VERSION } from './coreAgentRules.js';
import { findForeignBrandLeaks } from './tenantIsolationGuard.js';

describe('CORE_AGENT_RULES_V1: isolamento de marca', () => {
  it('não leva marca da ZappIQ pro prompt do cliente', () => {
    expect(findForeignBrandLeaks(CORE_AGENT_RULES_V1)).toEqual([]);
  });

  it('modo estrito: nem preço, nem trial, nem SKU nosso', () => {
    expect(findForeignBrandLeaks(CORE_AGENT_RULES_V1, { strict: true })).toEqual([]);
  });

  it('não cita nossos planos como exemplo de catálogo', () => {
    expect(CORE_AGENT_RULES_V1).not.toContain('Starter');
    expect(CORE_AGENT_RULES_V1).not.toContain('Growth');
    expect(CORE_AGENT_RULES_V1).not.toContain('Scale');
  });

  it('não aponta pra "URLs canônicas" que não existem mais', () => {
    expect(CORE_AGENT_RULES_V1).not.toContain('URLs canônicas');
  });
});

describe('CORE_AGENT_RULES_V1: as regras continuam de pé', () => {
  it('mantém as 9 regras (CR-1 a CR-9)', () => {
    for (let i = 1; i <= 9; i++) {
      expect(CORE_AGENT_RULES_V1).toContain(`## CR-${i}`);
    }
  });

  it('mantém a semântica crítica de cada regra', () => {
    // CR-1 aceitação → avançar, não info-dump
    expect(CORE_AGENT_RULES_V1).toContain('ACEITAÇÃO DE OFERTA');
    expect(CORE_AGENT_RULES_V1).toContain('AVANCE IMEDIATAMENTE');
    // CR-2 handoff
    expect(CORE_AGENT_RULES_V1).toContain('HANDOFF HUMANO');
    // CR-7 não inventar
    expect(CORE_AGENT_RULES_V1).toContain('NUNCA invente preço');
    // CR-8 dados sensíveis
    expect(CORE_AGENT_RULES_V1).toContain('NUNCA peça CPF');
    // CR-9 voz humana
    expect(CORE_AGENT_RULES_V1).toContain('VOZ HUMANA');
    // Regra de link continua exigindo https:// completo
    expect(CORE_AGENT_RULES_V1).toContain('https://');
  });

  it('segue anunciando que é imutável e universal', () => {
    expect(CORE_AGENT_RULES_V1).toContain('REGRAS BASE DO AGENTE');
    expect(CORE_AGENT_RULES_V1).toContain('IMUTÁVEIS');
  });
});

describe('CORE_RULES_VERSION', () => {
  it('subiu pra v2 (limpeza de marca)', () => {
    expect(CORE_RULES_VERSION).toBe('v2');
  });
});
