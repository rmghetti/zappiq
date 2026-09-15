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

/* ══════════════════════════════════════════════════════════════════════
 * C1b (Passo 3, A158): o widget escuta a equipe.
 * ══════════════════════════════════════════════════════════════════════ */

/** Extrai uma função de topo do script servido (indentação de 2 espaços). */
function pegaFuncao<T>(nome: string, ...globais: string[]): (...valores: unknown[]) => T {
  const trecho = new RegExp(`function ${nome}\\([\\s\\S]*?\\n  \\}`).exec(scriptServido);
  if (!trecho) throw new Error(`função ${nome} não encontrada no script servido`);
  // eslint-disable-next-line no-new-func
  return new Function(...globais, `${trecho[0]}; return ${nome};`) as (...valores: unknown[]) => T;
}

describe('widget.js: canal de volta da equipe (C1b)', () => {
  it('o script servido é JavaScript válido', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(scriptServido)).not.toThrow();
  });

  it('escuta o namespace dos visitantes só por websocket, com a organização e a sessão', () => {
    expect(scriptServido).toContain("API_BASE + '/web-chat'");
    expect(scriptServido).toContain("transports: ['websocket']");
    expect(scriptServido).toContain('auth: { org: ORG_ID, sessionId: getSessionId() }');
    expect(scriptServido).toContain("sock.on('mensagem_da_equipe', receberDaEquipe)");
    // O cliente do socket.io vem da própria API.
    expect(scriptServido).toContain("API_BASE + '/socket.io/socket.io.min.js'");
  });

  it('busca o que a equipe respondeu enquanto o visitante estava fora', () => {
    expect(scriptServido).toContain('/mensagens-da-equipe');
    expect(scriptServido).toContain("sock.on('connect', sincronizarEquipe)");
  });

  it('cada mensagem da equipe entra uma vez só na conversa, como fala do atendimento', () => {
    const mesclar = pegaFuncao<boolean>('mesclarDaEquipe')();
    const lista: Array<{ role: string; text: string }> = [{ role: 'me', text: 'oi' }];
    const vistas: string[] = [];

    expect(mesclar(lista, vistas, { id: 'm1', content: 'Oi! Aqui é a Ana.' })).toBe(true);
    // A mesma mensagem chegando de novo (socket e sincronização): não duplica.
    expect(mesclar(lista, vistas, { id: 'm1', content: 'Oi! Aqui é a Ana.' })).toBe(false);
    expect(mesclar(lista, vistas, { id: 'm2', content: '   ' })).toBe(false);
    expect(mesclar(lista, vistas, null)).toBe(false);

    expect(lista).toEqual([
      { role: 'me', text: 'oi' },
      { role: 'bot', text: 'Oi! Aqui é a Ana.' },
    ]);
    expect(vistas).toEqual(['m1']);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * C1b (Passo 4, A247): nome e saudação do Treinar IA; a tag é reserva.
 * ══════════════════════════════════════════════════════════════════════ */

describe('widget.js: identidade do Treinar IA (C1b, A247)', () => {
  const identidade = () =>
    pegaFuncao<{ nome: string; saudacao: string }>('identidadeDoWidget')() as unknown as (
      servidor: unknown,
      attrNome: string | null,
      attrSaudacao: string | null,
    ) => { nome: string; saudacao: string };

  it('o que vem do servidor (Treinar IA) vence os atributos da tag', () => {
    expect(identidade()({ nome: 'Vera', saudacao: 'Olá! Aqui é a Vera, da CMJ.' }, 'Outra', 'Oi da tag')).toEqual({
      nome: 'Vera',
      saudacao: 'Olá! Aqui é a Vera, da CMJ.',
    });
  });

  it('servidor sem valor (interruptor desligado ou erro): a tag vale, como hoje', () => {
    expect(identidade()({ nome: null, saudacao: null }, 'Vera', 'Oi! Sou a Vera, do CMJ.')).toEqual({
      nome: 'Vera',
      saudacao: 'Oi! Sou a Vera, do CMJ.',
    });
    expect(identidade()(null, 'Vera', 'Oi da tag').saudacao).toBe('Oi da tag');
  });

  it('sem nada: saudação neutra curta, sem a fórmula que a Qualidade reprova e sem gênero fixo', () => {
    const comNome = identidade()(null, 'Vera', null).saudacao;
    const semNome = identidade()(null, null, null);
    for (const s of [comNome, semNome.saudacao]) {
      expect(s).not.toMatch(/como posso (te )?ajudar/i);
      expect(s).not.toMatch(/em que posso ser útil/i);
      expect(s).not.toMatch(/\bSou a\b/);
    }
    expect(comNome).toBe('Olá! Aqui é Vera. Me conta o que você precisa.');
    expect(semNome).toEqual({ nome: 'Atendimento', saudacao: 'Olá! Me conta o que você precisa.' });
  });

  it('o script lê a configuração da organização e não monta mais a fórmula antiga', () => {
    expect(scriptServido).toContain("'/api/web-chat/org/' + ORG_ID + '/config'");
    expect(scriptServido).not.toContain("'. Como posso ajudar?'");
    // O nome entra por textContent, nunca por innerHTML.
    expect(scriptServido).toContain("panel.querySelector('.zqwc-title').textContent = AGENT_NAME");
  });
});

describe('widget.js: sessão estável mesmo sem localStorage (C1b, auditoria do diff)', () => {
  it('com o localStorage recusado, a mesma sessão vale para o POST, o socket e a sincronização', () => {
    const trechoUid = /function uid\(\)\s*\{[\s\S]*?\n  \}/.exec(scriptServido)![0];
    const trechoSessao = /var SESSAO_EM_MEMORIA = null;[\s\S]*?function getSessionId\(\)\s*\{[\s\S]*?\n  \}/.exec(
      scriptServido,
    )![0];
    const armazenamentoRecusado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    // eslint-disable-next-line no-new-func
    const fabrica = new Function(
      'window',
      'crypto',
      'localStorage',
      'STORAGE_SESSION',
      `${trechoUid}; ${trechoSessao}; return getSessionId;`,
    ) as (...a: unknown[]) => () => string;
    const getSessionId = fabrica({ crypto: globalThis.crypto }, globalThis.crypto, armazenamentoRecusado, 'k');

    const primeira = getSessionId();
    expect(primeira.startsWith('anon-')).toBe(true);
    expect(getSessionId()).toBe(primeira);
    expect(getSessionId()).toBe(primeira);
  });
});

describe('widget.js: sites com RequireJS ou socket.io antigo (C1b, auditoria do diff)', () => {
  it('só usa o cliente de socket da página se for a v4', () => {
    const serve = pegaFuncao<boolean>('clienteDeSocketServe')() as unknown as (io: unknown) => boolean;
    const v4 = Object.assign(() => undefined, { Manager: class {} });
    const v2 = Object.assign(() => undefined, { Manager: class {}, protocol: 4 });
    expect(serve(v4)).toBe(true);
    expect(serve(v2)).toBe(false);
    expect(serve({})).toBe(false);
    expect(serve(undefined)).toBe(false);
  });

  it('com RequireJS na página, não carrega o pacote do socket: sincroniza de tempos em tempos', () => {
    expect(scriptServido).toContain("typeof window.define === 'function' && window.define.amd");
    expect(scriptServido).toContain('ligarSincronizacaoPeriodica()');
  });
});
