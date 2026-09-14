/**
 * O Direct do Instagram roda o agente com as configurações do cliente (A057).
 * --------------------------------------------------------------------------
 * O webhook do WhatsApp enfileirava `orgSettings: org.settings`; o do
 * Instagram enfileirava `{}`. O orquestrador lê dali a saudação, o nome do
 * negócio, os links oficiais, a mensagem de transbordo, a de opt-out e o
 * estado do agendamento. No Direct, nada disso existia: mensagem de
 * transbordo padrão da ZappIQ para o cliente final do CLIENTE, nenhum link
 * oficial e, sem Agent seedado, o fallback virava "Assistente" da "Empresa".
 *
 * Não havia conversa de Instagram em produção quando o defeito foi achado,
 * então a prova é por código: este teste confere o payload do job.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queueAdd = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { upsert: vi.fn().mockResolvedValue({ id: 'contato-1', name: 'Ana' }), update: vi.fn() },
    organization: { findFirst: vi.fn() },
    conversation: {
      findFirst: vi.fn().mockResolvedValue({ id: 'conversa-1' }),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../services/instagramService.js', () => ({ getUserProfile: vi.fn() }));
vi.mock('../services/queueService.js', () => ({
  aiProcessQueue: { add: (...args: any[]) => queueAdd(...args) },
}));
vi.mock('../utils/redis.js', () => ({
  redis: { lpush: vi.fn(), ltrim: vi.fn(), lrange: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { handleIncomingMessage } from './webhookInstagram.js';

const SETTINGS = {
  agentName: 'Vera',
  businessName: 'CMJ',
  greetingMessage: 'Olá, que bom te ver por aqui!',
  handoffMessage: 'Já chamo a Marcia para você.',
  scheduling: { enabled: true },
  surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
};

const ORG = {
  id: 'org-do-cmj',
  instagramAccessToken: 'token-fake-de-teste',
  settings: SETTINGS,
};

const EVENTO = {
  sender: { id: 'igsid-1' },
  recipient: { id: '178414' },
  timestamp: 1700000000,
  message: { mid: 'mid-1', text: 'oi, vocês atendem sábado?' },
};

beforeEach(() => {
  queueAdd.mockClear();
});

describe('webhook do Instagram: o job leva as configurações da organização', () => {
  it('orgSettings vai preenchido, igual ao do WhatsApp', async () => {
    await handleIncomingMessage(ORG as any, EVENTO);

    expect(queueAdd).toHaveBeenCalledTimes(1);
    const payload = queueAdd.mock.calls[0][1];
    expect(payload.orgSettings).toEqual(SETTINGS);
    // Os campos que o orquestrador realmente lê de lá.
    expect(payload.orgSettings.greetingMessage).toBe(SETTINGS.greetingMessage);
    expect(payload.orgSettings.handoffMessage).toBe(SETTINGS.handoffMessage);
    expect(payload.orgSettings.businessName).toBe('CMJ');
  });

  it('organização sem settings vira objeto vazio, nunca undefined', async () => {
    await handleIncomingMessage({ ...ORG, settings: null } as any, EVENTO);
    const payload = queueAdd.mock.calls[0][1];
    expect(payload.orgSettings).toEqual({});
  });

  it('o resto do payload segue igual (canal, ids e conversa)', async () => {
    await handleIncomingMessage(ORG as any, EVENTO);
    const payload = queueAdd.mock.calls[0][1];
    expect(payload.channel).toBe('instagram');
    expect(payload.organizationId).toBe('org-do-cmj');
    expect(payload.conversationId).toBe('conversa-1');
    expect(payload.instagramScopedId).toBe('igsid-1');
    expect(payload.externalMessageId).toBe('mid-1');
  });
});
