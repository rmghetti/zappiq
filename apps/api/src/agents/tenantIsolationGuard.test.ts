/**
 * tenantIsolationGuard.test.ts — a trava do "nunca mais"
 * ============================================================================
 * Regressão (14/07/2026, relato do CMJ): a Qualidade da IA testava a Vera
 * (agente do CMJ) contra o gabarito da Iza, e o suggestFix propunha patches
 * mandando a Vera se apresentar como "Iza da ZappIQ". O botão Aplicar gravaria
 * isso no systemPrompt do cliente.
 *
 * Este guard é a rede final: nenhum texto com marca da ZappIQ pode ser gravado
 * no prompt de um tenant, exibido como sugestão pra ele, nem usado como
 * gabarito de avaliação dele.
 *
 * Cobertura:
 *   ✓ pega Iza / ZappIQ / zappiq.com.br / cal.com/rodrigoghetti
 *   ✓ NÃO acusa falso positivo em português ("humanizar", "organiza", ...)
 *   ✓ deixa passar tudo quando a org É a ZappIQ (a Iza pode falar da Iza)
 *   ✓ termos comerciais (R$ 197, Voice 200) pegos no modo estrito do eval
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  findForeignBrandLeaks,
  assertNoForeignBrand,
  ForeignBrandLeakError,
} from './tenantIsolationGuard.js';

const CLIENTE = { isZappIQ: false, agentName: 'Vera', businessName: 'CMJ' };
const ZAPPIQ = { isZappIQ: true, agentName: 'Iza', businessName: 'ZappIQ' };

describe('findForeignBrandLeaks — detecta marca da ZappIQ', () => {
  it('pega o nome Iza como palavra', () => {
    const leaks = findForeignBrandLeaks('Identificar como "Iza da ZappIQ" ou similar.');
    expect(leaks.map((l) => l.term)).toContain('Iza');
  });

  it('pega a marca ZappIQ em qualquer caixa', () => {
    expect(findForeignBrandLeaks('a zappiq não atende apostas').length).toBeGreaterThan(0);
    expect(findForeignBrandLeaks('# CORE RULES ZAPPIQ').length).toBeGreaterThan(0);
  });

  it('pega a URL de cadastro da ZappIQ', () => {
    const leaks = findForeignBrandLeaks('Signup: https://zappiq.com.br/cadastro');
    expect(leaks.length).toBeGreaterThan(0);
  });

  it('pega o link do Cal do Rodrigo', () => {
    const leaks = findForeignBrandLeaks('Mandar https://cal.com/rodrigoghetti/zappiq-demo');
    expect(leaks.map((l) => l.term)).toContain('cal.com/rodrigoghetti');
  });

  it('reporta o trecho onde achou, pra facilitar o conserto', () => {
    const leaks = findForeignBrandLeaks('bla bla Iza bla');
    expect(leaks[0].excerpt).toContain('Iza');
  });
});

describe('findForeignBrandLeaks — NÃO pode dar falso positivo em português', () => {
  // Esta foi a armadilha real: `ilike '%iza%'` acusa "humanizar".
  it.each([
    'Use emojis com moderação para humanizar.',
    'A empresa organiza eventos e autoriza o acesso.',
    'Personalize e utilize o material; atualize quando necessário.',
    'Vamos priorizar, otimizar e sinalizar o problema.',
    'A IA analisa, localiza e finaliza o atendimento.',
    'Isso penaliza quem não realiza a revisão.',
  ])('não acusa nada em: %s', (texto) => {
    expect(findForeignBrandLeaks(texto)).toEqual([]);
  });

  it('não confunde o SKU IZA_LITE com o nome da agente', () => {
    expect(findForeignBrandLeaks('plan: IZA_LITE')).toEqual([]);
  });
});

describe('assertNoForeignBrand — o gate por org', () => {
  it('barra texto com marca da ZappIQ quando a org é de cliente', () => {
    expect(() =>
      assertNoForeignBrand('Você é a Iza da ZappIQ', CLIENTE, 'systemPrompt'),
    ).toThrow(ForeignBrandLeakError);
  });

  it('deixa passar quando a org É a ZappIQ (a Iza pode falar da Iza)', () => {
    expect(() =>
      assertNoForeignBrand('Você é a Iza da ZappIQ', ZAPPIQ, 'systemPrompt'),
    ).not.toThrow();
  });

  it('deixa passar texto legítimo do cliente', () => {
    expect(() =>
      assertNoForeignBrand('Você é Vera, atendente virtual da CMJ.', CLIENTE, 'systemPrompt'),
    ).not.toThrow();
  });

  it('a mensagem de erro diz onde vazou e qual termo', () => {
    try {
      assertNoForeignBrand('manda https://zappiq.com.br/cadastro', CLIENTE, 'sugestão de patch');
      expect.unreachable('deveria ter lançado');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForeignBrandLeakError);
      expect(err.message).toContain('sugestão de patch');
      expect(err.message).toContain('CMJ');
      expect(err.leaks.length).toBeGreaterThan(0);
    }
  });

  it('fail-closed: org sem id é tratada como cliente', () => {
    expect(() =>
      assertNoForeignBrand('Você é a Iza', { isZappIQ: false }, 'prompt'),
    ).toThrow(ForeignBrandLeakError);
  });
});

describe('modo estrito — usado no gabarito do eval', () => {
  it('pega preço e SKU da ZappIQ que o modo normal deixa passar', () => {
    // "R$ 197" sozinho não é marca, mas num cenário de eval de cliente é o
    // preço do Starter da ZappIQ sendo cobrado do agente do CMJ.
    expect(findForeignBrandLeaks('Mencionar R$ 197/mês explicitamente')).toEqual([]);
    expect(
      findForeignBrandLeaks('Mencionar R$ 197/mês explicitamente', { strict: true }).length,
    ).toBeGreaterThan(0);
  });

  it('pega o pacote Voice e o trial de 14 dias no estrito', () => {
    expect(findForeignBrandLeaks('Voice 200 a R$ 79,90/mês', { strict: true }).length).toBeGreaterThan(0);
    expect(findForeignBrandLeaks('trial de 14 dias grátis', { strict: true }).length).toBeGreaterThan(0);
  });

  it('estrito também não dá falso positivo em texto comum', () => {
    expect(findForeignBrandLeaks('Atendemos de segunda a sexta.', { strict: true })).toEqual([]);
  });
});
