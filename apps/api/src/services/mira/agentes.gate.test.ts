/**
 * Dossiê raso não vira trabalho.
 *
 * Pedido do Rodrigo (15/07/2026), depois de testar o Alvo GISLAINE em produção:
 * "o plano de ação só deve ser feito e gerar uma tarefa se temos informações
 * suficientes para ter um Alvo qualificado e pronto para gerar um lead".
 *
 * O motivo é mais forte que "o Alvo é fraco": quando o dado é raso, a IA
 * preenche o vazio com invenção e o texto sai com cara de certeza. A GISLAINE
 * (score 13, zero decisor) gerou um plano mandando abordar por WhatsApp "como
 * é comum em negócios de joalheria" — é uma FUNDIÇÃO DE FERRO (CNAE 2451200,
 * conferido no diretório oficial). Tarefa errada é pior que tarefa nenhuma,
 * porque o vendedor age nela.
 */
import { describe, it, expect } from 'vitest';

const { planoBloqueadoPor, SCORE_MINIMO_PLANO } = await import('./agentes.js');

/** Os Alvos REAIS da base da MACHIA em 15/07/2026. */
const REAIS = [
  { nome: 'COFEL', miraScore: 45, decisores: 4, sobe: true },
  { nome: 'SERVEMAC', miraScore: 33, decisores: 3, sobe: true },
  { nome: 'PERFILADOS ATIBAIA', miraScore: 27, decisores: 2, sobe: true },
  { nome: 'YADOYA', miraScore: 20, decisores: 1, sobe: false }, // tem decisor, score baixo
  { nome: 'EDUARDO RONDINA', miraScore: 20, decisores: 1, sobe: false },
  { nome: 'GISLAINE', miraScore: 13, decisores: 0, sobe: false }, // o caso do Rodrigo
  { nome: 'KRAMEPY', miraScore: 9, decisores: 0, sobe: false },
];

describe('o corte de 25 na base real', () => {
  it.each(REAIS)('$nome (score $miraScore, $decisores decisor(es)) → plano: $sobe', ({ miraScore, decisores, sobe }) => {
    const bloqueio = planoBloqueadoPor({
      miraScore,
      decisores: Array.from({ length: decisores }, (_, i) => ({ nome: `d${i}` })),
    });
    expect(bloqueio === null).toBe(sobe);
  });

  it('o corte é 25 (aprovado pelo Rodrigo)', () => {
    expect(SCORE_MINIMO_PLANO).toBe(25);
  });
});

describe('sem decisor barra SEMPRE, independente do score', () => {
  it('score alto e zero decisor não vira plano: sem nome não há quem abordar', () => {
    const b = planoBloqueadoPor({ miraScore: 99, decisores: [] });
    expect(b).toBe('nenhum decisor mapeado');
  });

  it('o motivo do decisor vem ANTES do motivo do score (é o acionável)', () => {
    // Com os dois problemas, a tela deve dizer "mapeie o decisor", que o
    // cliente resolve com um clique, e não "score baixo", que não dá o que fazer.
    const b = planoBloqueadoPor({ miraScore: 5, decisores: [] });
    expect(b).toBe('nenhum decisor mapeado');
  });

  it('decisores ausente/undefined conta como zero (não explode)', () => {
    expect(planoBloqueadoPor({ miraScore: 90 })).toBe('nenhum decisor mapeado');
  });
});

describe('o motivo é escrito para o cliente ler, não para o log', () => {
  it('diz o score e o mínimo, para o cliente entender o quanto falta', () => {
    const b = planoBloqueadoPor({ miraScore: 20, decisores: [{ nome: 'x' }] });
    expect(b).toContain('20');
    expect(b).toContain('25');
  });

  it('score exatamente no corte PASSA (25 é o mínimo, não o exclusivo)', () => {
    expect(planoBloqueadoPor({ miraScore: 25, decisores: [{ nome: 'x' }] })).toBeNull();
    expect(planoBloqueadoPor({ miraScore: 24, decisores: [{ nome: 'x' }] })).not.toBeNull();
  });

  it('score null conta como zero, não como "sem opinião"', () => {
    expect(planoBloqueadoPor({ miraScore: null, decisores: [{ nome: 'x' }] })).toContain('0');
  });
});
