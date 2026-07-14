/**
 * Motores: o consumo do gate de prontidão e a região do Perfil na query.
 *
 * Fecha os dois últimos gaps da auditoria adversarial:
 *  1. prontidao < 60 derruba o motor com 412 (o gate era código sem teste).
 *  2. regiaoCidade do Perfil entra DE FATO na textQuery do Places quando o
 *     usuário não digita região, e o usuário vence quando digita (o helper
 *     era testado isolado; aqui é o caminho real do campo pelo motor).
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
    await expect(runMotorB('org-1', 'pizzaria', null)).rejects.toMatchObject({ status: 412 });
  });

  it('sem perfil salvo, os motores também não largam', async () => {
    findUniquePerfil.mockResolvedValue(null);
    await expect(runMotorB('org-1', 'pizzaria', null)).rejects.toMatchObject({ status: 412 });
  });
});

describe('região do Perfil na query do motor B (campo regiaoCidade)', () => {
  it('sem região digitada, a textQuery do Places usa a regiaoCidade do Perfil', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 80, alvoB2C: { regiaoCidade: ['Moema', 'Vila Mariana'] } });

    const result = await runMotorB('org-1', 'pizzaria', null);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.textQuery).toBe('pizzaria em Moema');
    expect(result.regiaoAplicada).toBe('Moema');
    expect(result.regiaoOrigem).toBe('perfil');
  });

  it('região digitada pelo usuário vence a do Perfil', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 80, alvoB2C: { regiaoCidade: ['Moema'] } });

    const result = await runMotorB('org-1', 'pizzaria', 'Campinas');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.textQuery).toBe('pizzaria em Campinas');
    expect(result.regiaoOrigem).toBe('usuario');
  });

  it('sem região em lugar nenhum, busca sem região (comportamento antigo)', async () => {
    findUniquePerfil.mockResolvedValue({ prontidao: 80, alvoB2C: { regiaoCidade: [] } });

    const result = await runMotorB('org-1', 'pizzaria', null);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.textQuery).toBe('pizzaria');
    expect(result.regiaoAplicada).toBeNull();
  });
});
