/**
 * Integridade do registro do "O que preencher aqui".
 *
 * Roda no CI junto com o resto do web (`pnpm --filter @zappiq/web test`).
 *
 * Verifica:
 *  1. Sem campoKey duplicada; todos os blocos preenchidos.
 *  2. O "não preencha" sempre diz PARA ONDE vai (ou assume que não há lugar).
 *  3. Voz: sem travessão longo em texto de usuário.
 *  4. Sem link morto: toda campoKey usada no JSX existe no registro.
 *  5. Sem campo órfão: todo campo digitável da Nova campanha tem orientação.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREENCHER, allCampoKeys } from '../index';
import { getSaibaMais } from '../../saiba-mais';

const MODAL = join(__dirname, '..', '..', '..', 'components', 'mira', 'NovaCampanhaModal.tsx');
const src = readFileSync(MODAL, 'utf8');

/**
 * Pega a chave também dentro de ternário (`campoKey={kind === 'B2B' ? 'a' : 'b'}`),
 * que é como o campo de alvo escolhe entre a trilha B2B e a B2C. Só chave do
 * registro tem este formato no arquivo, então varrer o literal é seguro.
 */
function campoKeysNoJsx(): string[] {
  return Array.from(src.matchAll(/['"](mira\.campanha\.[a-z0-9.\-]+)['"]/g)).map((m) => m[1]);
}

describe('registro do "O que preencher aqui"', () => {
  const keys = allCampoKeys();

  it('não tem campoKey duplicada', () => {
    expect(keys.length).toBe(new Set(keys).size);
  });

  it.each(keys)('%s: tem todos os blocos preenchidos', (k) => {
    const c = PREENCHER[k];
    expect(c.titulo?.trim()).toBeTruthy();
    expect(c.resumo?.trim()).toBeTruthy();
    expect(c.deve.length).toBeGreaterThan(0);
    expect(c.comoVira?.trim()).toBeTruthy();
    // O "não preencha" é o coração do popup: sem ele, isto vira só mais um placeholder.
    expect(c.naoDeve.length, 'naoDeve vazio').toBeGreaterThan(0);
    // O contraste é o que ensina: precisa de exemplo bom E de exemplo a evitar.
    expect(c.exemplos.some((e) => e.bom), 'nenhum exemplo bom').toBe(true);
    expect(c.exemplos.some((e) => !e.bom), 'nenhum exemplo a evitar').toBe(true);
  });

  it.each(keys)('%s: todo "não preencha" aponta o destino', (k) => {
    for (const n of PREENCHER[k].naoDeve) {
      expect(n.item?.trim(), 'item vazio').toBeTruthy();
      expect(n.porque?.trim(), `"${n.item}" sem porque`).toBeTruthy();
      // null é resposta válida (não há lugar), string vazia não: é esquecimento.
      expect(n.ondeVai === null || !!n.ondeVai?.trim(), `"${n.item}" com ondeVai vazio`).toBe(true);
    }
  });

  it.each(keys)('%s: voz sem travessão longo', (k) => {
    const c = PREENCHER[k];
    const textos = [
      c.titulo,
      c.resumo,
      ...c.deve,
      ...c.naoDeve.flatMap((n) => [n.item, n.porque, n.ondeVai ?? '']),
      ...c.exemplos.map((e) => e.nota),
      c.comoVira,
    ].join(' ');
    expect(textos).not.toContain('—');
  });

  it.each(keys)('%s: o Saiba mais referenciado existe', (k) => {
    const sm = PREENCHER[k].saibaMais;
    if (sm) expect(getSaibaMais(sm), `Saiba mais inexistente: "${sm}"`).toBeTruthy();
  });

  it('não tem link morto: toda campoKey do JSX existe no registro', () => {
    const usados = new Set(campoKeysNoJsx());
    expect(usados.size).toBeGreaterThan(0);
    for (const k of usados) expect(PREENCHER[k], `link morto: "${k}"`).toBeTruthy();
  });

  it('não tem campo órfão: todo campo digitável tem "O que preencher aqui"', () => {
    // Conta na FONTE, não na tela renderizada: <ListaDeAlvos> é um componente
    // reusado (aparece 1x no código e renderiza 2x), então contar por render
    // daria número errado. Na fonte, cada campo tem o seu gatilho ao lado.
    const digitaveis = (src.match(/<(input|textarea)\b/g) ?? []).length;
    const gatilhos = (src.match(/<OQuePreencher\b/g) ?? []).length;
    expect(gatilhos, `${digitaveis} campos digitáveis, ${gatilhos} gatilhos`).toBeGreaterThanOrEqual(digitaveis);
  });
});
