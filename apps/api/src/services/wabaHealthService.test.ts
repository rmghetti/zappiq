/**
 * wabaHealthService.test.ts — varredura de saúde do WABA (PR-D)
 * ============================================================================
 * Resposta Meta out/2026: o caso CMJ (WABA morta por semanas sem ninguém
 * saber) vira monitor. A cada 6h a varredura roda o check read-only do
 * "Testar conexão" em cada org com canal próprio, grava ChannelHealthCheck
 * e alerta o admin APENAS na transição saudável -> degradado.
 *
 * Cobertura:
 *   ✓ grava uma linha de histórico por org com credencial própria
 *   ✓ transição ok -> falha dispara alerta com a dica do check
 *   ✓ falha -> falha não realerta (sem spam a cada 6h)
 *   ✓ qualidade caindo pra RED com check ok também é transição
 *   ✓ RED -> RED não realerta
 *   ✓ primeiro check já reprovado alerta uma vez (baseline saudável)
 *   ✓ org sem credencial própria é pulada (where + guard defensivo)
 *   ✓ falha de banco numa org não derruba a varredura
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const orgFindManyMock = vi.fn();
const healthFindFirstMock = vi.fn();
const healthCreateMock = vi.fn();
const userFindFirstMock = vi.fn();
const checkWhatsappMock = vi.fn();
const sendEmailMock = vi.fn();
const sendTextMock = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findMany: (...a: any[]) => orgFindManyMock(...a) },
    channelHealthCheck: {
      findFirst: (...a: any[]) => healthFindFirstMock(...a),
      create: (...a: any[]) => healthCreateMock(...a),
    },
    user: { findFirst: (...a: any[]) => userFindFirstMock(...a) },
  },
}));

vi.mock('./channelCredentialCheck.js', () => ({
  checkWhatsappCredentials: (...a: any[]) => checkWhatsappMock(...a),
}));

vi.mock('./email/emailProvider.js', () => ({
  sendEmail: (...a: any[]) => sendEmailMock(...a),
}));

vi.mock('./whatsappService.js', () => ({
  sendText: (...a: any[]) => sendTextMock(...a),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { runWabaHealthSweep } = await import('./wabaHealthService.js');

const ORG1 = { id: 'org1', name: 'Loja da Maria', whatsappPhoneNumberId: '111', whatsappAccessToken: 'tok1' };
const ORG2 = { id: 'org2', name: 'Clínica do João', whatsappPhoneNumberId: '222', whatsappAccessToken: 'tok2' };

const CHECK_OK = {
  ok: true,
  displayPhoneNumber: '+55 11 99999-9999',
  verifiedName: 'Loja da Maria',
  qualityRating: 'GREEN',
  messagingTier: 'TIER_1K',
};

const CHECK_FAIL = {
  ok: false,
  error: 'Error validating access token: Session has expired',
  hint: 'Token inválido ou expirado. Gere um novo token na Meta e cole aqui de novo.',
  errorCode: 190,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: admin com e-mail existe, envio de e-mail funciona, sem histórico.
  userFindFirstMock.mockResolvedValue({ email: 'admin@loja.com' });
  sendEmailMock.mockResolvedValue({ success: true });
  healthFindFirstMock.mockResolvedValue(null);
  healthCreateMock.mockResolvedValue({ id: 'chk1' });
});

describe('runWabaHealthSweep', () => {
  it('grava uma linha de ChannelHealthCheck por org com credencial própria', async () => {
    orgFindManyMock.mockResolvedValue([ORG1, ORG2]);
    checkWhatsappMock.mockResolvedValue(CHECK_OK);

    const r = await runWabaHealthSweep({ delayMs: 0 });

    // Só orgs com canal PRÓPRIO entram na varredura (filtro no where).
    const where = orgFindManyMock.mock.calls[0][0].where;
    expect(where.whatsappPhoneNumberId).toEqual({ not: null });
    expect(where.whatsappAccessToken).toEqual({ not: null });

    // Check rodou com as credenciais de cada org, pedindo o tier.
    expect(checkWhatsappMock).toHaveBeenCalledTimes(2);
    expect(checkWhatsappMock).toHaveBeenNthCalledWith(1, '111', 'tok1', { includeMessagingTier: true });
    expect(checkWhatsappMock).toHaveBeenNthCalledWith(2, '222', 'tok2', { includeMessagingTier: true });

    // Uma linha de histórico por org, com o payload resumido (sem token).
    expect(healthCreateMock).toHaveBeenCalledTimes(2);
    const data1 = healthCreateMock.mock.calls[0][0].data;
    expect(data1.organizationId).toBe('org1');
    expect(data1.channel).toBe('whatsapp');
    expect(data1.ok).toBe(true);
    expect(data1.qualityRating).toBe('GREEN');
    expect(data1.messagingTier).toBe('TIER_1K');
    expect(data1.errorCode).toBeNull();
    expect(data1.detail.displayPhoneNumber).toBe('+55 11 99999-9999');
    expect(JSON.stringify(data1.detail)).not.toContain('tok1');

    // Saudável seguindo saudável: nenhum alerta.
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(r.orgsChecked).toBe(2);
    expect(r.alertsSent).toBe(0);
  });

  it('transição ok -> falha dispara alerta com a dica acionável do check', async () => {
    orgFindManyMock.mockResolvedValue([ORG1]);
    healthFindFirstMock.mockResolvedValue({ ok: true, qualityRating: 'GREEN' });
    checkWhatsappMock.mockResolvedValue(CHECK_FAIL);

    const r = await runWabaHealthSweep({ delayMs: 0 });

    // Linha de histórico com o erro resumido e o código da Graph.
    const data = healthCreateMock.mock.calls[0][0].data;
    expect(data.ok).toBe(false);
    expect(data.errorCode).toBe('190');
    expect(data.detail.error).toContain('Session has expired');
    expect(data.detail.hint).toContain('Token inválido');

    // Alerta multi-canal pro admin da org (padrão quotaAlertsService).
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const email = sendEmailMock.mock.calls[0][0];
    expect(email.to).toBe('admin@loja.com');
    expect(email.subject).toContain('não está no ar');
    expect(email.subject).toContain('Loja da Maria');
    expect(email.html).toContain('Token inválido ou expirado');
    expect(email.text).toContain('Token inválido ou expirado');
    // User ainda não tem phone no schema: canal WA fica de fora (fail-soft).
    expect(sendTextMock).not.toHaveBeenCalled();

    expect(r.alertsSent).toBe(1);
  });

  it('falha -> falha não realerta, mas o histórico continua sendo gravado', async () => {
    orgFindManyMock.mockResolvedValue([ORG1]);
    healthFindFirstMock.mockResolvedValue({ ok: false, qualityRating: null });
    checkWhatsappMock.mockResolvedValue(CHECK_FAIL);

    const r = await runWabaHealthSweep({ delayMs: 0 });

    expect(healthCreateMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(r.alertsSent).toBe(0);
  });

  it('qualidade caindo pra RED com check ok também é transição e alerta', async () => {
    orgFindManyMock.mockResolvedValue([ORG1]);
    healthFindFirstMock.mockResolvedValue({ ok: true, qualityRating: 'GREEN' });
    checkWhatsappMock.mockResolvedValue({ ...CHECK_OK, qualityRating: 'RED' });

    const r = await runWabaHealthSweep({ delayMs: 0 });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const email = sendEmailMock.mock.calls[0][0];
    expect(email.subject).toContain('qualidade');
    expect(email.subject).toContain('RED');
    expect(r.alertsSent).toBe(1);
  });

  it('RED -> RED não realerta (canal já estava degradado)', async () => {
    orgFindManyMock.mockResolvedValue([ORG1]);
    healthFindFirstMock.mockResolvedValue({ ok: true, qualityRating: 'RED' });
    checkWhatsappMock.mockResolvedValue({ ...CHECK_OK, qualityRating: 'RED' });

    const r = await runWabaHealthSweep({ delayMs: 0 });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(r.alertsSent).toBe(0);
  });

  it('primeiro check já reprovado alerta uma vez (sem histórico = baseline saudável)', async () => {
    // Decisão PR-D: canal que já chega quebrado na primeira varredura (caso
    // CMJ) alerta na hora; a partir daí falha -> falha silencia.
    orgFindManyMock.mockResolvedValue([ORG1]);
    healthFindFirstMock.mockResolvedValue(null);
    checkWhatsappMock.mockResolvedValue(CHECK_FAIL);

    const r = await runWabaHealthSweep({ delayMs: 0 });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(r.alertsSent).toBe(1);
  });

  it('org sem credencial própria é pulada sem check nem gravação', async () => {
    // Drift de dado: o where exige credencial, mas se uma org escapar com
    // token nulo o guard defensivo pula sem derrubar a varredura.
    orgFindManyMock.mockResolvedValue([
      { id: 'org3', name: 'Sem Canal', whatsappPhoneNumberId: '333', whatsappAccessToken: null },
      ORG1,
    ]);
    checkWhatsappMock.mockResolvedValue(CHECK_OK);

    const r = await runWabaHealthSweep({ delayMs: 0 });

    expect(checkWhatsappMock).toHaveBeenCalledTimes(1);
    expect(checkWhatsappMock).toHaveBeenCalledWith('111', 'tok1', { includeMessagingTier: true });
    expect(healthCreateMock).toHaveBeenCalledTimes(1);
    expect(healthCreateMock.mock.calls[0][0].data.organizationId).toBe('org1');
    expect(r.orgsChecked).toBe(1);
  });

  it('falha de banco numa org não derruba a varredura das demais', async () => {
    orgFindManyMock.mockResolvedValue([ORG1, ORG2]);
    checkWhatsappMock.mockResolvedValue(CHECK_OK);
    healthCreateMock
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ id: 'chk2' });

    const r = await runWabaHealthSweep({ delayMs: 0 });

    expect(checkWhatsappMock).toHaveBeenCalledTimes(2);
    expect(r.orgsFailed).toBe(1);
    expect(r.orgsChecked).toBe(1);
  });
});
