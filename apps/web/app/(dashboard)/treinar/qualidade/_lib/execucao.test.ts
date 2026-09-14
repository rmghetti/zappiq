/**
 * A171 na tela: a execução que quebrou não pode parecer nota baixa.
 * ============================================================================
 * Em 15/06 uma execução com 25 de 25 respostas vazias virou nota zero. Do
 * lado do cliente, nota zero e "o provedor caiu" são a mesma tela se ninguém
 * separar as duas coisas.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  naoFoiAvaliadaPorFalhaTecnica,
  MOTIVO_FALHA_TECNICA,
  ROTULO_NAO_AVALIADA,
  TEXTO_FALHA_TECNICA,
} from './execucao';

describe('naoFoiAvaliadaPorFalhaTecnica', () => {
  it('reconhece o motivo que a API grava', () => {
    expect(naoFoiAvaliadaPorFalhaTecnica({ status: 'failed', error: MOTIVO_FALHA_TECNICA })).toBe(
      true,
    );
  });

  it('execução concluída com nota baixa NÃO é falha técnica', () => {
    expect(naoFoiAvaliadaPorFalhaTecnica({ status: 'completed', error: null })).toBe(false);
  });

  it('outra falha (tempo limite, fila fora do ar) não usa esta frase', () => {
    expect(
      naoFoiAvaliadaPorFalhaTecnica({ status: 'failed', error: 'tempo limite da execução (25 min)' }),
    ).toBe(false);
    expect(
      naoFoiAvaliadaPorFalhaTecnica({ status: 'failed', error: 'não foi possível enfileirar a execução' }),
    ).toBe(false);
  });

  it('sem execução e sem motivo, não inventa nada', () => {
    expect(naoFoiAvaliadaPorFalhaTecnica(null)).toBe(false);
    expect(naoFoiAvaliadaPorFalhaTecnica({ status: 'failed' })).toBe(false);
    expect(naoFoiAvaliadaPorFalhaTecnica({ status: 'running', error: MOTIVO_FALHA_TECNICA })).toBe(
      false,
    );
  });
});

describe('os textos que o dono do negócio lê', () => {
  it('dizem que não é nota do agente e o que fazer', () => {
    expect(TEXTO_FALHA_TECNICA).toMatch(/não foi avaliada/i);
    expect(TEXTO_FALHA_TECNICA).toMatch(/não é uma nota/i);
    expect(TEXTO_FALHA_TECNICA).toMatch(/de novo/i);
  });

  it('não usam travessão nem jargão técnico', () => {
    for (const t of [ROTULO_NAO_AVALIADA, TEXTO_FALHA_TECNICA]) {
      expect(t).not.toContain('—');
      expect(t).not.toMatch(/timeout|stack|HTTP|null/i);
    }
  });
});
