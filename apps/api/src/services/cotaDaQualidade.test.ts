/* ══════════════════════════════════════════════════════════════════════
 * Cota de execuções da Qualidade pela faixa do plano (C2, nota 1).
 * --------------------------------------------------------------------
 * Com o interruptor `evalNoTier` ligado, o cliente roda tantos testes
 * manuais por janela quanto a faixa do plano dele permite. Desligado, a
 * regra de hoje (1 por 24 h) continua na rota.
 *
 * A faixa segue a MESMA leitura da política de modelo: organização em trial
 * ou no estágio NOVO cai na faixa de entrada, qualquer que seja o plano.
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  cotaDeExecucoesDaFaixa,
  faixaDaCota,
  decidirCotaDeExecucoes,
  COTA_PADRAO_DA_QUALIDADE,
} from './cotaDaQualidade.js';

const AGORA = new Date('2026-09-14T12:00:00Z');
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3600_000);

describe('cotaDeExecucoesDaFaixa', () => {
  it('as faixas de hoje (Lite, Starter, Growth) ficam na regra de hoje: 1 por 24 h', () => {
    for (const p of ['IZA_LITE', 'STARTER', 'GROWTH']) {
      expect(cotaDeExecucoesDaFaixa(p)).toEqual({ execucoes: 1, janelaHoras: 24 });
    }
  });

  it('as faixas de cima rodam mais vezes por dia', () => {
    expect(cotaDeExecucoesDaFaixa('SCALE').execucoes).toBe(2);
    expect(cotaDeExecucoesDaFaixa('BUSINESS').execucoes).toBe(3);
    expect(cotaDeExecucoesDaFaixa('ENTERPRISE').execucoes).toBe(5);
  });

  it('plano desconhecido ou vazio fica na regra de hoje', () => {
    expect(cotaDeExecucoesDaFaixa('IZA_PRO')).toEqual(COTA_PADRAO_DA_QUALIDADE);
    expect(cotaDeExecucoesDaFaixa(null)).toEqual(COTA_PADRAO_DA_QUALIDADE);
  });
});

describe('faixaDaCota: a mesma leitura da política de modelo', () => {
  it('pagante: o plano dele', () => {
    expect(faixaDaCota({ plano: 'SCALE', estagioDoTrial: 'OTHER', ehZappIQ: false })).toBe('SCALE');
  });

  it('em trial ou no estágio NOVO: a faixa de entrada, qualquer que seja o plano', () => {
    expect(faixaDaCota({ plano: 'SCALE', estagioDoTrial: 'TRIAL', ehZappIQ: false })).toBe('STARTER');
    expect(faixaDaCota({ plano: 'BUSINESS', estagioDoTrial: 'NOVO', ehZappIQ: false })).toBe('STARTER');
  });

  it('a organização da ZappIQ nunca cai na faixa de entrada', () => {
    expect(faixaDaCota({ plano: 'SCALE', estagioDoTrial: 'TRIAL', ehZappIQ: true })).toBe('SCALE');
  });
});

describe('decidirCotaDeExecucoes', () => {
  it('abaixo da cota: liberado', () => {
    const d = decidirCotaDeExecucoes({
      cota: { execucoes: 2, janelaHoras: 24 },
      iniciosNaJanela: [horasAtras(3)],
      agora: AGORA,
    });
    expect(d.liberado).toBe(true);
  });

  it('na cota: barrado, e o próximo horário é quando a mais antiga sai da janela', () => {
    const d = decidirCotaDeExecucoes({
      cota: { execucoes: 2, janelaHoras: 24 },
      iniciosNaJanela: [horasAtras(3), horasAtras(20)],
      agora: AGORA,
    });
    expect(d.liberado).toBe(false);
    if (!d.liberado) {
      expect(d.usadas).toBe(2);
      expect(d.proximaEm.toISOString()).toBe(new Date(horasAtras(20).getTime() + 24 * 3600_000).toISOString());
    }
  });

  it('execução fora da janela não conta', () => {
    const d = decidirCotaDeExecucoes({
      cota: { execucoes: 1, janelaHoras: 24 },
      iniciosNaJanela: [horasAtras(30)],
      agora: AGORA,
    });
    expect(d.liberado).toBe(true);
  });
});
