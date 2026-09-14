/**
 * idAnonimo.test.ts (P7 da revisão do PR #369)
 * ============================================================================
 * O identificador de visitante do chat caía em `'anon-' + Date.now()` quando o
 * navegador recusava o localStorage (janela anônima, cookies de terceiro
 * bloqueados, site data desligado). Dois visitantes no mesmo milissegundo
 * recebiam o mesmo identificador, e o histórico de conversa de um aparecia para
 * o outro. Pior: como o valor é o relógio, dá para adivinhar o identificador de
 * quem entrou num horário conhecido.
 *
 * Aqui provamos que o valor é aleatório nas duas situações: com
 * `crypto.randomUUID` e sem ele.
 * ============================================================================
 */
import { describe, it, expect, afterEach } from 'vitest';
import { idAleatorio } from './idAnonimo';

const cryptoOriginal = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: cryptoOriginal,
    configurable: true,
    writable: true,
  });
});

function trocaCrypto(valor: unknown) {
  Object.defineProperty(globalThis, 'crypto', {
    value: valor,
    configurable: true,
    writable: true,
  });
}

describe('idAleatorio', () => {
  it('usa crypto.randomUUID quando existe', () => {
    const id = idAleatorio();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('sem crypto.randomUUID ainda devolve valor aleatório e longo', () => {
    trocaCrypto(undefined);
    const ids = new Set(Array.from({ length: 200 }, () => idAleatorio()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id.length).toBeGreaterThanOrEqual(16);
  });

  it('não repete em chamadas seguidas dentro do mesmo milissegundo', () => {
    // O defeito antigo era exatamente este: `Date.now()` devolve o mesmo número
    // para chamadas no mesmo milissegundo.
    const ids = new Set(Array.from({ length: 500 }, () => idAleatorio()));
    expect(ids.size).toBe(500);
  });
});
