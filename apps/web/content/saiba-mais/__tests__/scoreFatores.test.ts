/**
 * Contrato: os 5 fatores do Mira Score × os Saiba mais da tela.
 *
 * O dossiê mapeia o NOME do fator (string vinda do score.ts, gravada no
 * scoreBreakdown do Alvo) para a featureKey do help. Se alguém renomear um
 * fator no motor, o <SaibaMais /> simplesmente não renderiza (falha silenciosa
 * e segura por design) e o cliente perde a explicação sem ninguém notar.
 *
 * Este teste é o alarme: os nomes ficam registrados aqui, e a lista tem que
 * bater com a do JSX dos dois lados.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSaibaMais } from '../index';

/** Os 5 fatores, exatamente como o apps/api/src/services/mira/score.ts os escreve. */
const FATORES_DO_MOTOR = [
  'Fit de ICP',
  'Demanda e sinais',
  'Cobertura de decisores',
  'Encaixe de portfólio',
  'Janela e incumbente',
] as const;

const DOSSIE = join(__dirname, '..', '..', '..', 'app', '(dashboard)', 'mira', 'alvos', '[id]', 'page.tsx');
const src = readFileSync(DOSSIE, 'utf8');

describe('Saiba mais dos fatores do Mira Score', () => {
  it.each(FATORES_DO_MOTOR)('"%s" tem help mapeado no dossiê', (fator) => {
    // O mapa do JSX é `'Fit de ICP': 'mira.score.fit',`
    const re = new RegExp(`'${fator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'([a-z0-9.]+)'`);
    const m = src.match(re);
    expect(m, `o dossiê não mapeia o fator "${fator}" para nenhuma featureKey`).toBeTruthy();
    expect(getSaibaMais(m![1]), `featureKey "${m![1]}" não existe no registro`).toBeTruthy();
  });

  it('o Saiba mais do score aponta para os 5 fatores como relacionados', () => {
    const score = getSaibaMais('mira.score');
    expect(score).toBeTruthy();
    expect(score!.relacionados).toHaveLength(FATORES_DO_MOTOR.length);
    for (const k of score!.relacionados ?? []) {
      expect(getSaibaMais(k), `relacionado morto: "${k}"`).toBeTruthy();
    }
  });

  it('todo relacionado citado por qualquer conteúdo do Mira existe de verdade', () => {
    for (const key of ['mira.score.fit', 'mira.score.demanda', 'mira.score.decisores', 'mira.score.portfolio', 'mira.score.janela', 'mira.alvos.classificacoes']) {
      const c = getSaibaMais(key);
      expect(c, `conteúdo ausente: ${key}`).toBeTruthy();
      for (const rel of c!.relacionados ?? []) {
        expect(getSaibaMais(rel), `${key} aponta para relacionado morto: "${rel}"`).toBeTruthy();
      }
    }
  });
});
