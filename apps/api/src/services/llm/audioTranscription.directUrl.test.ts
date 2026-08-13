/**
 * audioTranscription.directUrl.test.ts — FASE 4 (#251) fecho
 * ============================================================================
 * O webhook do Instagram entrega a URL DIRETA do CDN no campo mediaId
 * (webhookInstagram.ts: `mediaId: mediaUrl // IG já entrega URL direta`).
 * O transcribeAudio tratava qualquer mediaId como media ID da Meta e chamava
 * waService.getMediaUrl(URL) — que quebra. Resultado: áudio de DM do Instagram
 * nunca transcrevia.
 *
 * O fix: mediaId que começa com http(s):// é baixado direto, SEM o Bearer do
 * WhatsApp (o CDN lookaside é público-assinado). Media ID numérico do WhatsApp
 * segue o caminho antigo intacto.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const axiosGetMock = vi.fn();
const axiosPostMock = vi.fn();
const getMediaUrlMock = vi.fn();
const downloadMediaMock = vi.fn();

vi.mock('axios', () => ({
  default: { get: axiosGetMock, post: axiosPostMock },
  AxiosError: class AxiosError extends Error {},
}));

vi.mock('../whatsappService.js', () => ({
  getMediaUrl: getMediaUrlMock,
  downloadMedia: downloadMediaMock,
}));

vi.mock('../../config/env.js', () => ({
  env: { OPENAI_API_KEY: 'sk-test', WHATSAPP_API_VERSION: 'v21.0' },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./llmCallAudit.js', () => ({ logLLMCall: vi.fn().mockResolvedValue(undefined) }));

const { transcribeAudio } = await import('./audioTranscription.js');

const IG_CDN_URL =
  'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=123&signature=abc';

beforeEach(() => {
  vi.clearAllMocks();
  axiosPostMock.mockResolvedValue({ data: { text: 'olá, quero saber o preço' } });
  axiosGetMock.mockResolvedValue({
    data: new ArrayBuffer(2048),
    headers: { 'content-type': 'audio/mp4' },
  });
  getMediaUrlMock.mockResolvedValue('https://cdn.meta.example/resolved');
  downloadMediaMock.mockResolvedValue(Buffer.alloc(2048));
});

describe('transcribeAudio — URL direta do Instagram', () => {
  it('URL http(s) baixa direto, sem passar pelo getMediaUrl do WhatsApp', async () => {
    const result = await transcribeAudio(IG_CDN_URL, { contactPhone: 'ig:123' });

    // Não pode tratar a URL como media ID da Meta.
    expect(getMediaUrlMock).not.toHaveBeenCalled();
    expect(downloadMediaMock).not.toHaveBeenCalled();

    // Baixou a própria URL...
    expect(axiosGetMock).toHaveBeenCalledTimes(1);
    expect(axiosGetMock.mock.calls[0][0]).toBe(IG_CDN_URL);
    // ...sem o Bearer do WhatsApp (o CDN do IG é assinado na própria URL).
    const cfg = axiosGetMock.mock.calls[0][1] ?? {};
    expect(cfg.headers?.Authorization).toBeUndefined();

    expect(result.text).toBe('olá, quero saber o preço');
  });

  it('media ID do WhatsApp segue o caminho antigo (getMediaUrl + downloadMedia)', async () => {
    const result = await transcribeAudio('880123456789', { contactPhone: '5511999999999' });

    expect(getMediaUrlMock).toHaveBeenCalledWith('880123456789');
    expect(downloadMediaMock).toHaveBeenCalledWith('https://cdn.meta.example/resolved');
    expect(axiosGetMock).not.toHaveBeenCalled();
    expect(result.text).toBe('olá, quero saber o preço');
  });

  it('falha no download direto degrada fail-soft (text null, sem throw)', async () => {
    axiosGetMock.mockRejectedValue(new Error('CDN 403'));
    const result = await transcribeAudio(IG_CDN_URL);
    expect(result.text).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
