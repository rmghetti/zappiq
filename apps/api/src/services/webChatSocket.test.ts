/* ══════════════════════════════════════════════════════════════════════
 * webChatSocket: o visitante entra só na sala da própria sessão
 * (C1b, Passo 3, A158).
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { criarPortaoDoVisitante, registrarCanalDoVisitante } = await import('./webChatSocket.js');
const { NAMESPACE_DO_CHAT_DO_SITE, salaDoVisitante } = await import('./webChatSala.js');

const configDaOrg = vi.fn();
const origemPermitida = vi.fn();
const deps = { configDaOrg: (...a: any[]) => configDaOrg(...a), origemPermitida: (...a: any[]) => origemPermitida(...a) };

function socketFalso(auth: Record<string, unknown>, origin = 'https://cmj.com.br') {
  return { handshake: { auth, headers: { origin } }, data: {} as Record<string, unknown> } as any;
}

async function passar(socket: any): Promise<Error | undefined> {
  let erro: Error | undefined;
  await criarPortaoDoVisitante(deps)(socket, (e?: Error) => {
    erro = e;
  });
  return erro;
}

beforeEach(() => {
  vi.clearAllMocks();
  configDaOrg.mockResolvedValue({ exists: true, enabled: true });
  origemPermitida.mockResolvedValue(true);
});

describe('portão do namespace dos visitantes', () => {
  it('sessão e organização válidas, chat ligado, origem permitida: a sala é a da sessão', async () => {
    const socket = socketFalso({ org: 'org-1', sessionId: 'sessao-1' });
    expect(await passar(socket)).toBeUndefined();
    expect(socket.data.sala).toBe(salaDoVisitante('org-1', 'sessao-1'));
    expect(origemPermitida).toHaveBeenCalledWith('https://cmj.com.br', 'org-1');
  });

  it('a sessão é cortada em 64, igual ao contato web:<sessão> do CRM', async () => {
    const longa = 's'.repeat(80);
    const socket = socketFalso({ org: 'org-1', sessionId: longa });
    await passar(socket);
    expect(socket.data.sala).toBe(salaDoVisitante('org-1', 's'.repeat(64)));
  });

  it('sem sessão ou sem organização: recusa, sem consultar o banco', async () => {
    for (const auth of [{ org: 'org-1' }, { sessionId: 's' }, { org: 'x'.repeat(41), sessionId: 's' }, {}]) {
      const socket = socketFalso(auth);
      expect(await passar(socket)).toBeInstanceOf(Error);
      expect(socket.data.sala).toBeUndefined();
    }
    expect(configDaOrg).not.toHaveBeenCalled();
  });

  it('organização com o chat do site desligado: recusa', async () => {
    configDaOrg.mockResolvedValue({ exists: true, enabled: false });
    const socket = socketFalso({ org: 'org-1', sessionId: 's' });
    expect((await passar(socket))?.message).toBe('not_found');
    expect(socket.data.sala).toBeUndefined();
  });

  it('origem que não pode rodar o widget: recusa', async () => {
    origemPermitida.mockResolvedValue(false);
    const socket = socketFalso({ org: 'org-1', sessionId: 's' }, 'https://site-estranho.com');
    expect((await passar(socket))?.message).toBe('origem_nao_permitida');
  });

  it('banco fora no portão: recusa sem lançar', async () => {
    configDaOrg.mockRejectedValue(new Error('db down'));
    const socket = socketFalso({ org: 'org-1', sessionId: 's' });
    expect((await passar(socket))?.message).toBe('indisponivel');
  });
});

describe('registro no servidor', () => {
  it('usa o namespace dos visitantes e põe cada socket só na sala dele', () => {
    let portao: any;
    let aoConectar: any;
    const nsp = { use: vi.fn((fn: any) => (portao = fn)), on: vi.fn((_e: string, fn: any) => (aoConectar = fn)) };
    const io = { of: vi.fn(() => nsp) } as any;

    registrarCanalDoVisitante(io, deps);

    expect(io.of).toHaveBeenCalledWith(NAMESPACE_DO_CHAT_DO_SITE);
    expect(typeof portao).toBe('function');
    const join = vi.fn();
    aoConectar({ data: { sala: salaDoVisitante('org-1', 's') }, join });
    expect(join).toHaveBeenCalledWith(salaDoVisitante('org-1', 's'));
    expect(join).toHaveBeenCalledTimes(1);
  });
});

describe('cache curto do portão (cada visitante conecta a cada página vista)', () => {
  it('a mesma organização não vai ao banco de novo dentro do prazo; erro não fica em cache', async () => {
    const { configComCacheCurto } = await import('./webChatSocket.js');
    const ler = vi.fn(async (org: string) => ({ exists: true, enabled: org === 'org-1' }));
    const agora = { t: 1_000 };
    const cacheada = configComCacheCurto(ler, 30_000, () => agora.t);

    await expect(cacheada('org-1')).resolves.toEqual({ exists: true, enabled: true });
    await cacheada('org-1');
    expect(ler).toHaveBeenCalledTimes(1);

    agora.t += 30_001;
    await cacheada('org-1');
    expect(ler).toHaveBeenCalledTimes(2);

    ler.mockRejectedValueOnce(new Error('db down'));
    await expect(cacheada('org-2')).rejects.toThrow('db down');
    await expect(cacheada('org-2')).resolves.toEqual({ exists: true, enabled: false });
  });
});
