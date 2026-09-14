/**
 * O texto que o dono do negócio lê quando a régua de avaliação muda.
 * ============================================================================
 * Regra do produto: a nota recalculada é "recalculada". Ela NUNCA pode ser
 * confundida com uma execução nova, senão o cliente acha que a IA melhorou
 * sozinha durante a noite.
 *
 * E, para quem não é técnico, a comparação entre duas execuções vira um
 * ESTADO, nunca uma faixa numérica: com o prompt parado, o Tauã varia 10,4
 * pontos entre execuções consecutivas.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  textoDoAvisoDeRegravacao,
  ROTULOS_DE_ESTADO,
  precisaMostrarAviso,
} from './regravacao';

const REGRAVACAO = {
  notaAntiga: 74,
  notaRegravada: 86,
  reprovacoesDoGabarito: 4,
  continuamReprovados: ['cr8_no_pede_cpf', 'cr7_no_invent_sla'],
  porCenario: [],
};

describe('textoDoAvisoDeRegravacao', () => {
  it('diz a nota de antes e a de depois, na frase acordada', () => {
    expect(textoDoAvisoDeRegravacao(REGRAVACAO)).toBe(
      'Corrigimos o método de avaliação. Recalculando sua última execução, a nota passaria de 74 para 86; ' +
        'os cenários que continuam reprovados são os que precisam de você.',
    );
  });

  it('não promete execução nova em lugar nenhum', () => {
    const t = textoDoAvisoDeRegravacao(REGRAVACAO);
    expect(t).not.toMatch(/nov[ao] (execução|teste)/i);
    expect(t).toMatch(/recalculando/i);
  });

  it('não usa travessão', () => {
    expect(textoDoAvisoDeRegravacao(REGRAVACAO)).not.toContain('—');
  });

  it('nota antiga ausente não vira zero', () => {
    const t = textoDoAvisoDeRegravacao({ ...REGRAVACAO, notaAntiga: null });
    expect(t).toMatch(/passaria para 86/);
    expect(t).not.toMatch(/de 0 para/);
  });
});

describe('precisaMostrarAviso', () => {
  it('sem regravação, não mostra nada', () => {
    expect(precisaMostrarAviso(null)).toBe(false);
  });

  it('com a nota igual, ainda mostra: o que mudou foi o método', () => {
    expect(precisaMostrarAviso({ ...REGRAVACAO, notaRegravada: 74 })).toBe(true);
  });

  it('com nota diferente, mostra', () => {
    expect(precisaMostrarAviso(REGRAVACAO)).toBe(true);
  });
});

describe('ROTULOS_DE_ESTADO — o que o leigo lê no lugar da faixa', () => {
  it('cobre os quatro estados', () => {
    for (const estado of ['estavel', 'melhorou', 'piorou', 'sem_base'] as const) {
      expect(ROTULOS_DE_ESTADO[estado].label).toBeTruthy();
    }
  });

  it('nenhum rótulo mostra número', () => {
    for (const r of Object.values(ROTULOS_DE_ESTADO)) {
      expect(r.label).not.toMatch(/\d/);
    }
  });

  it('as palavras são as combinadas com o fundador', () => {
    expect(ROTULOS_DE_ESTADO.estavel.label).toBe('Estável');
    expect(ROTULOS_DE_ESTADO.melhorou.label).toBe('Melhorou de verdade');
    expect(ROTULOS_DE_ESTADO.piorou.label).toBe('Piorou de verdade');
  });
});
