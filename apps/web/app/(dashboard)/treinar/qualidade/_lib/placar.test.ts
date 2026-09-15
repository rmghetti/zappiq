/**
 * C2 (Passo 3 e 5): os dois termômetros da Qualidade, no texto que o dono lê.
 */
import { describe, it, expect } from 'vitest';
import { termometro, termometrosDaExecucao, TEXTO_SEM_BASE } from './placar';

const parte = (over: Record<string, unknown> = {}) => ({
  estado: 'avaliado' as const,
  total: 4,
  avaliados: 4,
  aprovados: 3,
  percent: 75,
  ...over,
});

describe('termometro', () => {
  it('conhecimento avaliado mostra a porcentagem e quantas perguntas acertou', () => {
    const t = termometro('conhecimento', parte());
    expect(t.titulo).toBe('Conhecimento do negócio');
    expect(t.valor).toBe('75%');
    expect(t.detalhe).toContain('3 de 4 perguntas do seu negócio');
    expect(t.nivel).toBe('attention');
  });

  it('agente sem nada cadastrado: "Sem base cadastrada", e não uma porcentagem', () => {
    const t = termometro('conhecimento', parte({ estado: 'sem_base', total: 0, avaliados: 0, aprovados: 0, percent: null }));
    expect(t.valor).toBe('Sem base cadastrada');
    expect(t.valor).not.toMatch(/%/);
    expect(t.detalhe).toBe(TEXTO_SEM_BASE);
    expect(t.percent).toBeNull();
  });

  it('teste sem a base: "Não testado ainda", explicando por quê', () => {
    const t = termometro('conhecimento', parte({ estado: 'nao_testado', motivo: 'base_nao_consultada', avaliados: 0, percent: null }));
    expect(t.valor).toBe('Não testado ainda');
    expect(t.detalhe).toMatch(/ainda não consulta a base/);
  });

  it('comportamento avaliado fala de situações de atendimento', () => {
    const t = termometro('comportamento', parte({ aprovados: 4, percent: 100 }));
    expect(t.titulo).toBe('Comportamento');
    expect(t.detalhe).toContain('situações de atendimento');
    expect(t.nivel).toBe('good');
  });

  it('nenhum texto tem travessão', () => {
    for (const t of [
      termometro('conhecimento', parte()),
      termometro('conhecimento', null),
      termometro('conhecimento', parte({ estado: 'nao_testado', motivo: 'falha_tecnica' })),
      termometro('comportamento', parte({ estado: 'sem_cenarios' })),
    ]) {
      expect(`${t.titulo} ${t.valor} ${t.detalhe}`).not.toContain('—');
    }
  });
});

describe('termometrosDaExecucao', () => {
  it('execução antiga (sem placar) não mostra termômetro: fica a nota única', () => {
    expect(termometrosDaExecucao(null)).toBeNull();
    expect(termometrosDaExecucao(undefined)).toBeNull();
  });

  it('execução nova mostra os dois', () => {
    const t = termometrosDaExecucao({
      versao: 1,
      conhecimento: parte(),
      comportamento: parte({ percent: 90, aprovados: 9, avaliados: 10 }),
      inconclusivos: 0,
    });
    expect(t?.conhecimento.valor).toBe('75%');
    expect(t?.comportamento.valor).toBe('90%');
  });
});
