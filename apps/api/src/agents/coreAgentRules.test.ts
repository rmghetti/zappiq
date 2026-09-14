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
  // v2 foi a limpeza de marca (14/07/2026); v3 é a CR-10, rede de crise
  // (14/09/2026). A versão é gravada no audit de cada turno: subir junto com
  // a mudança é o que permite ler depois qual texto o agente recebeu.
  it('subiu pra v3 (rede de crise)', () => {
    expect(CORE_RULES_VERSION).toBe('v3');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * P62, A163, A155: a regra de crise no CORE, como SEGUNDA camada.
 *
 * A primeira camada é o pré-filtro determinístico (blockedVerticalFilter +
 * crisisSafetyNet), que não depende do modelo obedecer. Esta aqui existe
 * para o caso em que a pessoa escreve de um jeito que a regex não pega.
 *
 * Antes de 14/09/2026 a única regra de crise da plataforma vivia na seção
 * de psicologia do modelo de segmento, e o cadastro grava a chave com
 * acento: nenhum agente jamais recebeu essa regra.
 * ══════════════════════════════════════════════════════════════════════ */
describe('CORE_AGENT_RULES_V1: rede de crise (segunda camada)', () => {
  it('traz o CVV com telefone, horário e site', () => {
    expect(CORE_AGENT_RULES_V1).toContain('188');
    expect(CORE_AGENT_RULES_V1).toContain('cvv.org.br');
    expect(CORE_AGENT_RULES_V1).toMatch(/24\s*h(oras)?/i);
  });

  it('manda chamar uma pessoa', () => {
    expect(CORE_AGENT_RULES_V1).toMatch(/CR-10/);
    expect(CORE_AGENT_RULES_V1).toMatch(/handoff/i);
  });

  it('proíbe fazer terapia por mensagem e oferecer produto na hora', () => {
    expect(CORE_AGENT_RULES_V1).toMatch(/terapia/i);
  });

  it('continua sem marca nossa depois da regra nova', () => {
    expect(findForeignBrandLeaks(CORE_AGENT_RULES_V1, { strict: true })).toEqual([]);
  });

  it('a versão do CORE subiu junto com a regra nova', () => {
    expect(CORE_RULES_VERSION).not.toBe('v2');
  });
});
