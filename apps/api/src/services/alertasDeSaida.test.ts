/* ══════════════════════════════════════════════════════════════════════
 * alertasDeSaida: o alerta da guarda de marca vai para o log e para o
 * registro que o Raio-X lê (C1b, Passo 1, A189).
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logWarn = vi.fn();
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: (...a: any[]) => logWarn(...a), error: vi.fn(), debug: vi.fn() },
}));

const { registrarAlertasDeSaida, CATEGORIA_GUARDA_DE_MARCA } = await import('./alertasDeSaida.js');

const criar = vi.fn(async () => ({ id: 'ev-1' }));

beforeEach(() => {
  vi.clearAllMocks();
  criar.mockResolvedValue({ id: 'ev-1' });
});

describe('registrarAlertasDeSaida', () => {
  it('sem alerta, não faz nada (nem log, nem banco)', async () => {
    await registrarAlertasDeSaida(
      { organizationId: 'org-1', conversationId: 'c-1', canal: 'whatsapp', alertas: [], bloqueada: false },
      { criarEvento: criar },
    );
    expect(criar).not.toHaveBeenCalled();
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('um alerta de marca vira log e um evento com o termo, o canal e a ação tomada', async () => {
    await registrarAlertasDeSaida(
      {
        organizationId: 'org-1',
        conversationId: 'c-1',
        canal: 'site',
        alertas: ['guarda_de_marca:ZappIQ'],
        bloqueada: true,
      },
      { criarEvento: criar },
    );
    expect(logWarn).toHaveBeenCalledTimes(1);
    expect(criar).toHaveBeenCalledWith({
      organizationId: 'org-1',
      conversationId: 'c-1',
      canal: 'site',
      categoria: CATEGORIA_GUARDA_DE_MARCA,
      regra: 'ZappIQ',
      acao: 'resposta_segura',
    });
  });

  it('na Qualidade o texto não foi trocado: a ação registrada é só o alerta', async () => {
    await registrarAlertasDeSaida(
      {
        organizationId: 'org-1',
        conversationId: null,
        canal: 'qualidade',
        alertas: ['guarda_de_marca:Iza', 'guarda_de_marca:ZappIQ'],
        bloqueada: false,
      },
      { criarEvento: criar },
    );
    expect(criar).toHaveBeenCalledTimes(2);
    expect(criar.mock.calls.map((c: any[]) => c[0].acao)).toEqual(['alerta', 'alerta']);
    expect(criar.mock.calls.map((c: any[]) => c[0].regra)).toEqual(['Iza', 'ZappIQ']);
  });

  it('banco fora não lança: o turno do cliente nunca cai por causa do registro', async () => {
    criar.mockRejectedValue(new Error('db down'));
    await expect(
      registrarAlertasDeSaida(
        {
          organizationId: 'org-1',
          conversationId: 'c-1',
          canal: 'whatsapp',
          alertas: ['guarda_de_marca:ZappIQ'],
          bloqueada: true,
        },
        { criarEvento: criar },
      ),
    ).resolves.toBeUndefined();
  });

  it('o texto da conversa nunca vai para o evento (LGPD): só o termo', async () => {
    await registrarAlertasDeSaida(
      {
        organizationId: 'org-1',
        conversationId: 'c-1',
        canal: 'whatsapp',
        alertas: ['guarda_de_marca:ZappIQ'],
        bloqueada: true,
      },
      { criarEvento: criar },
    );
    const evento = (criar.mock.calls[0] as any[])[0];
    expect(Object.keys(evento).sort()).toEqual(
      ['acao', 'canal', 'categoria', 'conversationId', 'organizationId', 'regra'].sort(),
    );
  });
});
