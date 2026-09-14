/**
 * webChatWidget.test.ts (P7 da revisão do PR #369)
 * ============================================================================
 * O script embedável do chat de site guarda o identificador da conversa no
 * localStorage. Quando o navegador recusa o armazenamento (janela anônima,
 * cookies de terceiro bloqueados), ele caía em `'anon-' + Date.now()`: dois
 * visitantes no mesmo milissegundo ficavam com o mesmo identificador, e o valor
 * era adivinhável por quem soubesse o horário aproximado.
 *
 * Aqui o script servido é lido de verdade pela rota, e a função de identificador
 * é extraída e EXECUTADA, com e sem `crypto.randomUUID`.
 * ============================================================================
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

let server: Server;
let base: string;
let scriptServido: string;

beforeAll(async () => {
  const { default: router } = await import('./webChatWidget.js');
  const app = express();
  app.use('/', router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`;
      resolve();
    });
  });
  scriptServido = await (await fetch(`${base}/widget.js`)).text();
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

/** Extrai a função `uid` do script servido e devolve ela executável. */
function pegaUid(comCrypto: boolean): () => string {
  const trecho = /function uid\(\)\s*\{[\s\S]*?\n  \}/.exec(scriptServido);
  if (!trecho) throw new Error('função uid não encontrada no script servido');
  const janelaFalsa = comCrypto ? { crypto: globalThis.crypto } : {};
  // eslint-disable-next-line no-new-func
  const fabrica = new Function(
    'window',
    'crypto',
    `${trecho[0]}; return uid;`,
  ) as (janela: unknown, cripto: unknown) => () => string;
  return fabrica(janelaFalsa, comCrypto ? globalThis.crypto : undefined);
}

describe('widget.js: identificador de visitante (P7)', () => {
  it('o relógio saiu do caminho de reserva', () => {
    expect(scriptServido).not.toContain("'anon-' + Date.now()");
    expect(scriptServido).toContain("'anon-' + uid()");
  });

  it('com crypto.randomUUID o identificador é um UUID', () => {
    const uid = pegaUid(true);
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('sem crypto.randomUUID o identificador continua sem repetir', () => {
    const uid = pegaUid(false);
    const ids = new Set(Array.from({ length: 200 }, () => uid()));
    expect(ids.size).toBe(200);
  });
});
