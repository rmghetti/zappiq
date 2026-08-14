/**
 * webhookInstagram.enrich.test.ts — FASE 4 (#251) fecho
 * ============================================================================
 * Contato de Instagram nascia com name null pra sempre: o comentário no upsert
 * dizia "pode buscar async depois" e ninguém buscava. getUserProfile existia
 * no instagramService e nunca era chamada.
 *
 * enrichContactNameFromIg é best-effort: busca name/username via Graph API e
 * grava no Contact. Falha NUNCA propaga (o turno da IA não pode travar por
 * causa de nome).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const contactUpdateMock = vi.fn();
const getUserProfileMock = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { update: contactUpdateMock },
    organization: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    message: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock('../services/instagramService.js', () => ({
  getUserProfile: getUserProfileMock,
}));

// 14/08 — marcador de entregas: Redis mockado pro import da rota não abrir
// conexão real (o util lê env.REDIS_URL no load do módulo).
vi.mock('../utils/redis.js', () => ({
  redis: { lpush: vi.fn(), ltrim: vi.fn(), lrange: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../services/queueService.js', () => ({
  aiProcessQueue: { add: vi.fn() },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config/env.js', () => ({
  env: { NODE_ENV: 'test', META_APP_SECRET: 's', WHATSAPP_ACCESS_TOKEN: 't' },
}));

const { enrichContactNameFromIg } = await import('./webhookInstagram.js');

beforeEach(() => {
  vi.clearAllMocks();
  contactUpdateMock.mockResolvedValue({});
});

describe('enrichContactNameFromIg — nome do contato via Graph API', () => {
  it('perfil com name grava no Contact', async () => {
    getUserProfileMock.mockResolvedValue({ name: 'Maria Souza', username: 'maria.souza' });

    await enrichContactNameFromIg({ instagramAccessToken: 'tok_org' }, 'igsid_1', 'contact_1');

    expect(getUserProfileMock).toHaveBeenCalledWith('tok_org', 'igsid_1');
    expect(contactUpdateMock).toHaveBeenCalledWith({
      where: { id: 'contact_1' },
      data: { name: 'Maria Souza' },
    });
  });

  it('sem name cai pro username', async () => {
    getUserProfileMock.mockResolvedValue({ username: 'joao_loja' });

    await enrichContactNameFromIg({ instagramAccessToken: 'tok' }, 'igsid_2', 'contact_2');

    expect(contactUpdateMock).toHaveBeenCalledWith({
      where: { id: 'contact_2' },
      data: { name: 'joao_loja' },
    });
  });

  it('perfil null (permissão negada / 4xx) não grava nada e não lança', async () => {
    getUserProfileMock.mockResolvedValue(null);

    await expect(
      enrichContactNameFromIg({ instagramAccessToken: 'tok' }, 'igsid_3', 'contact_3'),
    ).resolves.toBeNull();

    expect(contactUpdateMock).not.toHaveBeenCalled();
  });

  it('org sem token nem chama a Graph API', async () => {
    await enrichContactNameFromIg({ instagramAccessToken: null }, 'igsid_4', 'contact_4');
    expect(getUserProfileMock).not.toHaveBeenCalled();
    expect(contactUpdateMock).not.toHaveBeenCalled();
  });

  it('erro do banco não propaga (best-effort de verdade)', async () => {
    getUserProfileMock.mockResolvedValue({ name: 'X' });
    contactUpdateMock.mockRejectedValue(new Error('db down'));

    await expect(
      enrichContactNameFromIg({ instagramAccessToken: 'tok' }, 'igsid_5', 'contact_5'),
    ).resolves.not.toThrow;
  });
});
