/**
 * Motores: o consumo do gate de prontidão e a região do Perfil na query.
 *
 * Fecha os dois últimos gaps da auditoria adversarial:
 *  1. prontidao < 60 derruba o motor com 412 (o gate era código sem teste).
 *  2. o que a CAMPANHA pede chega de fato na textQuery do Places. A região
 *     deixou de ser um default escondido no motor: o wizard semeia do Perfil
 *     (ver alvosDaBusca.test.ts) e o motor usa o que a campanha mandou. Aqui
 *     é o caminho real do valor até a query.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUniquePerfil = vi.fn();
const findFirstAlvo = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    miraPerfil: { findUnique: (...a: any[]) => findUniquePerfil(...a) },
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a), create: vi.fn(), update: vi.fn() },
    miraEnriquecimentoLog: { create: vi.fn() },
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../config/env.js', () => ({ env: { GOOGLE_API_KEY: 'chave-de-teste' } }));
vi.mock('../../middleware/requireMira.js', () => ({
  getMiraEntitlement: vi.fn().mockResolvedValue({
    monthKey: '2026-07',
    quota: { used: 0, total: 10, remaining: 10, blocked: false },
  }),
  consumeMiraQuota: vi.fn().mockResolvedValue({ used: 1, total: 10, remaining: 9, blocked: false }),
  MiraQuotaExceededError: class MiraQuotaExceededError extends Error {},
}));
vi.mock('./cnpj.js', () => ({
  fetchCnpj: vi.fn(),
  normalizeCnpj: (s: string) => s.replace(/\D/g, ''),
  arquetipoFromQualificacao: () => null,
}));
vi.mock('./cagedMirror.js', () => ({ buscarSinalSetorial: vi.fn().mockResolvedValue(null) }));

const { runMotorA } = await import('./motorA.js');
const { runMotorB } = await import('./motorB.js');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });
});

describe('gate de prontidão (consumo do campo prontidao pelos motores)', () => {
  it('motor A devolve 412 quando a prontidão está abaixo de 60', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 50 });
    await expect(runMotorA('org-1', ['11222333000181'])).rejects.toMatchObject({ status: 412 });
  });

  it('motor B devolve 412 quando a prontidão está abaixo de 60', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 59, alvoB2C: { regiaoCidade: ['Moema'] } });
    await expect(runMotorB('org-1', { alvos: ['pizzaria'], regioes: [] })).rejects.toMatchObject({ status: 412 });
  });

  it('sem perfil salvo, os motores também não largam', async () => {
    findUniquePerfil.mockResolvedValue(null);
    await expect(runMotorB('org-1', { alvos: ['pizzaria'], regioes: [] })).rejects.toMatchObject({ status: 412 });
  });
});

describe('o que a campanha pede chega na query do motor B', () => {
  it('alvo e região da campanha viram a textQuery do Places', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 80, alvoB2C: { regiaoCidade: ['Moema'] } });

    const result = await runMotorB('org-1', { alvos: ['pizzaria'], regioes: ['Moema'] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.textQuery).toBe('pizzaria em Moema');
    expect(result.regiaoAplicada).toBe('Moema');
    expect(result.regiaoOrigem).toBe('campanha');
  });

  it('campanha sem região busca sem recorte, e diz isso no resultado', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 80, alvoB2C: { regiaoCidade: ['Moema'] } });

    const result = await runMotorB('org-1', { alvos: ['pizzaria'], regioes: [] });

    // O motor NÃO volta a ler o Perfil por baixo: quem semeia é o wizard.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.textQuery).toBe('pizzaria');
    expect(result.regiaoAplicada).toBeNull();
  });

  it('campanha sem alvo é recusada em vez de varrer o mundo', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 80, alvoB2C: { regiaoCidade: ['Moema'] } });
    await expect(runMotorB('org-1', { alvos: [], regioes: ['Moema'] })).rejects.toMatchObject({ status: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
