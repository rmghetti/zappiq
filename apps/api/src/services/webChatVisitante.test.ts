/* ══════════════════════════════════════════════════════════════════════
 * webChatVisitante: leituras públicas do widget (C1b, Passos 3 e 4).
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { mensagensDaEquipe, MAX_MENSAGENS_DA_EQUIPE } = await import('./webChatVisitante.js');

const contactFindUnique = vi.fn();
const messageFindMany = vi.fn();
const db = {
  contact: { findUnique: (...a: any[]) => contactFindUnique(...a) },
  message: { findMany: (...a: any[]) => messageFindMany(...a) },
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mensagensDaEquipe (Passo 3: o visitante que voltou vê a resposta humana)', () => {
  it('procura o contato da sessão NA organização e lê só a resposta humana do canal web', async () => {
    contactFindUnique.mockResolvedValue({ id: 'contato-1' });
    messageFindMany.mockResolvedValue([
      { id: 'm2', content: 'Pode me mandar seu e-mail?', createdAt: new Date('2026-09-14T15:02:00Z') },
      { id: 'm1', content: 'Oi! Aqui é a Ana.', createdAt: new Date('2026-09-14T15:01:00Z') },
    ]);

    const lista = await mensagensDaEquipe('org-1', 'sessao-1', db);

    expect(contactFindUnique.mock.calls[0][0].where).toEqual({
      whatsappId_organizationId: { whatsappId: 'web:sessao-1', organizationId: 'org-1' },
    });
    expect(messageFindMany.mock.calls[0][0]).toMatchObject({
      where: {
        direction: 'OUTBOUND',
        isFromBot: false,
        conversation: { contactId: 'contato-1', organizationId: 'org-1', channel: 'web' },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_MENSAGENS_DA_EQUIPE,
    });
    // Da mais antiga para a mais recente, como o widget mostra.
    expect(lista).toEqual([
      { id: 'm1', content: 'Oi! Aqui é a Ana.', createdAt: '2026-09-14T15:01:00.000Z' },
      { id: 'm2', content: 'Pode me mandar seu e-mail?', createdAt: '2026-09-14T15:02:00.000Z' },
    ]);
  });

  it('sessão sem contato: lista vazia, sem consultar mensagens', async () => {
    contactFindUnique.mockResolvedValue(null);
    await expect(mensagensDaEquipe('org-1', 'sessao-x', db)).resolves.toEqual([]);
    expect(messageFindMany).not.toHaveBeenCalled();
  });

  it('banco fora: lista vazia, nunca lança', async () => {
    contactFindUnique.mockRejectedValue(new Error('db down'));
    await expect(mensagensDaEquipe('org-1', 'sessao-1', db)).resolves.toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Passo 4 (A247): nome e saudação do widget vêm do Treinar IA.
 * ══════════════════════════════════════════════════════════════════════ */

const { configDoWidget, limparCacheDoWidget, CONFIG_DO_WIDGET_TTL_MS, origensDoWidget, origensDeTodosOsWidgets } =
  await import('./webChatVisitante.js');

describe('configDoWidget (Passo 4, A247)', () => {
  const perfilVivoLigado = vi.fn();
  const carregarAgente = vi.fn();
  const carregarSettings = vi.fn();
  const deps = {
    perfilVivoLigado: (...a: any[]) => perfilVivoLigado(...a),
    carregarAgente: (...a: any[]) => carregarAgente(...a),
    carregarSettings: (...a: any[]) => carregarSettings(...a),
  };

  beforeEach(() => {
    limparCacheDoWidget();
    perfilVivoLigado.mockResolvedValue(true);
    carregarAgente.mockResolvedValue({ name: 'Vera' });
    carregarSettings.mockResolvedValue({ agentName: 'Vera', greetingMessage: '  Olá! Aqui é a Vera, da CMJ.  ' });
  });

  it('com o perfil vivo ligado, nome do agente e saudação do Treinar IA', async () => {
    await expect(configDoWidget('org-1', deps)).resolves.toEqual({
      nome: 'Vera',
      saudacao: 'Olá! Aqui é a Vera, da CMJ.',
    });
  });

  it('sem agente vivo, o nome vem do que o dono gravou nas settings', async () => {
    carregarAgente.mockResolvedValue(null);
    carregarSettings.mockResolvedValue({ agentName: 'Tauã' });
    await expect(configDoWidget('org-1', deps)).resolves.toEqual({ nome: 'Tauã', saudacao: null });
  });

  it('com o perfil vivo DESLIGADO, nada vem do servidor: o widget segue com os atributos da tag (como hoje)', async () => {
    perfilVivoLigado.mockResolvedValue(false);
    await expect(configDoWidget('org-1', deps)).resolves.toEqual({ nome: null, saudacao: null });
    expect(carregarAgente).not.toHaveBeenCalled();
  });

  it('cache curto por organização: a segunda leitura não vai ao banco', async () => {
    await configDoWidget('org-1', deps);
    await configDoWidget('org-1', deps);
    expect(carregarSettings).toHaveBeenCalledTimes(1);
    expect(CONFIG_DO_WIDGET_TTL_MS).toBeLessThanOrEqual(60_000);
  });

  it('saudação longa é cortada; banco fora devolve nulos (o widget usa a reserva)', async () => {
    carregarSettings.mockResolvedValue({ greetingMessage: 'a'.repeat(900) });
    const r = await configDoWidget('org-2', deps);
    expect(r.saudacao!.length).toBeLessThanOrEqual(500);

    carregarSettings.mockRejectedValue(new Error('db down'));
    await expect(configDoWidget('org-3', deps)).resolves.toEqual({ nome: null, saudacao: null });
  });
});

describe('origensDoWidget (Passo 4, A241)', () => {
  beforeEach(() => limparCacheDoWidget());

  it('lê settings.webChatAllowedOrigins da organização, limpo, com cache curto', async () => {
    const carregarSettings = vi.fn(async () => ({
      webChatAllowedOrigins: ['https://Clinica.com.br/', 'lixo', 'https://www.clinica.com.br'],
    }));
    const lista = await origensDoWidget('org-1', { carregarSettings });
    expect(lista).toEqual(['https://clinica.com.br', 'https://www.clinica.com.br']);
    await origensDoWidget('org-1', { carregarSettings });
    expect(carregarSettings).toHaveBeenCalledTimes(1);
  });

  it('sem a chave ou com banco fora: lista vazia (vale só a lista fixa, como hoje)', async () => {
    await expect(origensDoWidget('org-2', { carregarSettings: async () => ({}) })).resolves.toEqual([]);
    await expect(
      origensDoWidget('org-3', {
        carregarSettings: async () => {
          throw new Error('db down');
        },
      }),
    ).resolves.toEqual([]);
  });
});

describe('origensDeTodosOsWidgets (upgrade do socket, A241)', () => {
  beforeEach(() => limparCacheDoWidget());

  it('junta as origens das organizações com o chat ligado, sem repetir, com cache curto', async () => {
    const listarSettings = vi.fn(async () => [
      { webChatAllowedOrigins: ['https://clinica.com.br', 'https://www.clinica.com.br'] },
      { webChatAllowedOrigins: ['https://CLINICA.com.br/'] },
      {},
    ]);
    const lista = await origensDeTodosOsWidgets({ listarSettings });
    expect(lista.sort()).toEqual(['https://clinica.com.br', 'https://www.clinica.com.br']);
    await origensDeTodosOsWidgets({ listarSettings });
    expect(listarSettings).toHaveBeenCalledTimes(1);
  });

  it('banco fora: lista vazia (vale a lista fixa)', async () => {
    await expect(
      origensDeTodosOsWidgets({
        listarSettings: async () => {
          throw new Error('db down');
        },
      }),
    ).resolves.toEqual([]);
  });
});

describe('teto dos caches do widget (auditoria do diff)', () => {
  it('ids inventados na URL não fazem o cache crescer sem fim: sai a entrada mais antiga', async () => {
    const { guardarComTeto } = await import('./webChatVisitante.js');
    const mapa = new Map<string, number>();
    for (let i = 0; i < 10; i++) guardarComTeto(mapa, `org-${i}`, i, 3);
    expect(mapa.size).toBe(3);
    expect([...mapa.keys()]).toEqual(['org-7', 'org-8', 'org-9']);
    // Regravar a mesma chave a leva para o fim da fila.
    guardarComTeto(mapa, 'org-7', 70, 3);
    guardarComTeto(mapa, 'org-10', 10, 3);
    expect([...mapa.keys()]).toEqual(['org-9', 'org-7', 'org-10']);
  });
});
