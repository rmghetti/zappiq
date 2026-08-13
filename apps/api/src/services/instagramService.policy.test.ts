/**
 * instagramService.policy.test.ts — trava de política da Meta
 * ============================================================================
 * A tag HUMAN_AGENT estende a janela do Instagram de 24h para 7 dias, mas a
 * política da Meta é explícita: é para resposta HUMANA. Bot respondendo com
 * essa tag = motivo de banimento da conta do cliente.
 *
 * Estes testes travam que o caminho do agente envia sempre
 * messaging_type RESPONSE e nunca anexa tag alguma ao payload. Se alguém
 * adicionar suporte a HUMAN_AGENT no futuro, tem que ser num caminho separado,
 * gated por ação humana — e este teste vai lembrar disso.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const postMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      post: postMock,
      get: vi.fn(),
      interceptors: { response: { use: vi.fn() } },
    }),
  },
}));

vi.mock('../config/env.js', () => ({
  env: { WHATSAPP_API_VERSION: 'v21.0' },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const igService = await import('./instagramService.js');

beforeEach(() => {
  vi.clearAllMocks();
  postMock.mockResolvedValue({ data: { recipient_id: 'r', message_id: 'm' } });
});

describe('política Meta — agente nunca usa tag de mensagem', () => {
  it('sendText envia messaging_type RESPONSE e nenhuma tag', async () => {
    await igService.sendText('igacc', 'tok', 'igsid', 'oi');

    const payload = postMock.mock.calls[0][1];
    expect(payload.messaging_type).toBe('RESPONSE');
    expect(payload).not.toHaveProperty('tag');
    expect(JSON.stringify(payload)).not.toContain('HUMAN_AGENT');
  });

  it('sendMedia envia messaging_type RESPONSE e nenhuma tag', async () => {
    await igService.sendMedia('igacc', 'tok', 'igsid', 'audio', 'https://x/y.mp3');

    const payload = postMock.mock.calls[0][1];
    expect(payload.messaging_type).toBe('RESPONSE');
    expect(payload).not.toHaveProperty('tag');
  });
});
