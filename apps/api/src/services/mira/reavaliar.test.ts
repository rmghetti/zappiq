/**
 * Reavaliação do Alvo: score, confiança e status automáticos.
 *
 * Pedido do Rodrigo (15/07/2026): Alvo que recebe dado novo pelo "Aprofundar
 * com IA" ou "Mapear decisores" tem que ser reanalisado na hora, atualizando
 * nota, confiança E status.
 *
 * O caso que motivou tudo: um Alvo entra "Em qualificação" justamente por não
 * ter decisor (firma individual, sem quadro societário). Se o mapeamento acha
 * alguém no LinkedIn, o motivo do "em qualificação" deixou de existir — mas
 * antes disto ele ficava lá para sempre, porque o score era calculado UMA vez,
 * no nascimento do Alvo, e o status nunca era reavaliado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstAlvo = vi.fn();
const findUniquePerfil = vi.fn();
const updateAlvo = vi.fn();
vi.mock('@zappiq/database', () => ({
  Prisma: {},
  prisma: {
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a), update: (...a: any[]) => updateAlvo(...a) },
    miraPerfil: { findUnique: (...a: any[]) => findUniquePerfil(...a) },
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const consumeMiraQuota = vi.fn();
class MiraQuotaExceededError extends Error {}
vi.mock('../../middleware/requireMira.js', () => ({
  consumeMiraQuota: (...a: any[]) => consumeMiraQuota(...a),
  MiraQuotaExceededError,
}));
vi.mock('./cagedMirror.js', () => ({ buscarSinalSetorial: vi.fn().mockResolvedValue(null) }));

const { reavaliarAlvo, alvoPassaGate } = await import('./reavaliar.js');

/** Alvo B2B em qualificação: ATIVA, com razão social, SEM decisor. */
const ALVO_SEM_DECISOR = {
  id: 'alvo-1',
  kind: 'B2B',
  status: 'QUALIFYING',
  nome: 'ACME METALURGICA LTDA',
  nomeFantasia: null,
  cnpj: '11222333000181',
  cnae: '2451-2',
  porte: '3',
  capitalSocial: 500_000,
  situacaoCadastral: 'ATIVA',
  municipio: 'São Paulo',
  uf: 'SP',
  telefone: null,
  site: null,
  miraScore: 13,
  confianca: 55,
  decisores: [],
  demandas: [],
  incumbentes: [],
  releases: [],
};

const PERFIL = { catalogo: [{ nome: 'Consultoria' }], alvoB2B: { cnaesAlvo: ['2451'] } };

beforeEach(() => {
  vi.clearAllMocks();
  findUniquePerfil.mockResolvedValue(PERFIL);
  updateAlvo.mockResolvedValue({});
  consumeMiraQuota.mockResolvedValue({ used: 1, total: 10, remaining: 9, blocked: false });
});

describe('alvoPassaGate', () => {
  it('B2B sem decisor não passa, e diz por quê', () => {
    const r = alvoPassaGate({ ...ALVO_SEM_DECISOR, decisores: [] });
    expect(r.passa).toBe(false);
    expect(r.motivo).toContain('decisor');
  });

  it('B2B com decisor e ATIVA passa', () => {
    const r = alvoPassaGate({ ...ALVO_SEM_DECISOR, decisores: [{}] });
    expect(r.passa).toBe(true);
  });

  it('B2B inativa não passa mesmo com decisor', () => {
    const r = alvoPassaGate({ ...ALVO_SEM_DECISOR, situacaoCadastral: 'BAIXADA', decisores: [{}] });
    expect(r.passa).toBe(false);
    expect(r.motivo).toContain('ATIVA');
  });

  it('B2C passa com telefone OU site (o decisor é o dono no balcão)', () => {
    const base = { ...ALVO_SEM_DECISOR, kind: 'B2C', decisores: [] };
    expect(alvoPassaGate({ ...base, telefone: '11999999999' }).passa).toBe(true);
    expect(alvoPassaGate({ ...base, site: 'https://x.com' }).passa).toBe(true);
    expect(alvoPassaGate(base).passa).toBe(false);
  });
});

describe('promoção automática: Em qualificação → Pronto', () => {
  it('decisor achado promove o Alvo e desconta cota', async () => {
    // O cenário real: Mapear decisores achou alguém no LinkedIn.
    findFirstAlvo.mockResolvedValue({ ...ALVO_SEM_DECISOR, decisores: [{ id: 'd1', nome: 'Fulano' }] });

    const r = await reavaliarAlvo('org-1', 'alvo-1');

    expect(r?.statusAntes).toBe('QUALIFYING');
    expect(r?.statusDepois).toBe('READY');
    expect(r?.promovido).toBe(true);
    expect(consumeMiraQuota).toHaveBeenCalledWith('org-1');
    const data = updateAlvo.mock.calls[0][0].data;
    expect(data.status).toBe('READY');
    expect(data.countedInQuota).toBe(true);
    expect(data.quotaMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('sem decisor, segue em qualificação e NÃO desconta cota', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_SEM_DECISOR);

    const r = await reavaliarAlvo('org-1', 'alvo-1');

    expect(r?.statusDepois).toBe('QUALIFYING');
    expect(r?.promovido).toBe(false);
    expect(consumeMiraQuota).not.toHaveBeenCalled();
    expect(r?.motivoStatus).toContain('decisor');
  });

  it('cota esgotada: passa no gate mas NÃO promove (nem entrega de graça, nem cobra escondido)', async () => {
    findFirstAlvo.mockResolvedValue({ ...ALVO_SEM_DECISOR, decisores: [{ id: 'd1', nome: 'Fulano' }] });
    consumeMiraQuota.mockRejectedValue(new MiraQuotaExceededError('cota'));

    const r = await reavaliarAlvo('org-1', 'alvo-1');

    expect(r?.statusDepois).toBe('QUALIFYING');
    expect(r?.promovido).toBe(false);
    expect(r?.bloqueadoPorCota).toBe(true);
    expect(r?.motivoStatus).toContain('cota');
    // A nota ainda assim atualiza: o dossiê melhorou, a fila tem que refletir.
    expect(updateAlvo.mock.calls[0][0].data.miraScore).toBeGreaterThan(0);
    expect(updateAlvo.mock.calls[0][0].data.status).toBeUndefined();
  });
});

describe('o que a máquina NÃO desfaz', () => {
  it('DELIVERED não volta: o cliente já pousou no CRM', async () => {
    findFirstAlvo.mockResolvedValue({ ...ALVO_SEM_DECISOR, status: 'DELIVERED', decisores: [] });

    const r = await reavaliarAlvo('org-1', 'alvo-1');

    expect(r?.statusDepois).toBe('DELIVERED');
    expect(updateAlvo.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('READY não é rebaixado: já descontou cota', async () => {
    // Alvo READY que perdeu o decisor (ex.: correção manual) não volta para
    // qualificação: seria cobrar por algo que sumiu da fila.
    findFirstAlvo.mockResolvedValue({ ...ALVO_SEM_DECISOR, status: 'READY', decisores: [] });

    const r = await reavaliarAlvo('org-1', 'alvo-1');

    expect(r?.statusDepois).toBe('READY');
    expect(updateAlvo.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('ARCHIVED não volta: foi decisão do cliente', async () => {
    findFirstAlvo.mockResolvedValue({ ...ALVO_SEM_DECISOR, status: 'ARCHIVED', decisores: [{ id: 'd1' }] });

    const r = await reavaliarAlvo('org-1', 'alvo-1');

    expect(r?.statusDepois).toBe('ARCHIVED');
    expect(consumeMiraQuota).not.toHaveBeenCalled();
  });
});

describe('score e confiança sobem com o dado novo', () => {
  it('decisor mapeado sobe nota E confiança', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_SEM_DECISOR);
    await reavaliarAlvo('org-1', 'alvo-1');
    const semDecisor = updateAlvo.mock.calls[0][0].data;

    vi.clearAllMocks();
    updateAlvo.mockResolvedValue({});
    consumeMiraQuota.mockResolvedValue({ used: 1, total: 10, remaining: 9, blocked: false });
    findUniquePerfil.mockResolvedValue(PERFIL);
    findFirstAlvo.mockResolvedValue({ ...ALVO_SEM_DECISOR, decisores: [{ id: 'd1' }, { id: 'd2' }] });
    await reavaliarAlvo('org-1', 'alvo-1');
    const comDecisor = updateAlvo.mock.calls[0][0].data;

    expect(comDecisor.miraScore).toBeGreaterThan(semDecisor.miraScore);
    expect(comDecisor.confianca).toBeGreaterThan(semDecisor.confianca);
  });

  it('a evidência vem do BANCO: demanda COM fonte conta, presunção não', async () => {
    // Presunção da Fase 1 (sem fonte) não é evidência e não pontua como tal.
    findFirstAlvo.mockResolvedValue({
      ...ALVO_SEM_DECISOR,
      demandas: [{ fonte: null, descricao: 'presumida' }],
    });
    await reavaliarAlvo('org-1', 'alvo-1');
    const soPresuncao = updateAlvo.mock.calls[0][0].data;

    vi.clearAllMocks();
    updateAlvo.mockResolvedValue({});
    findUniquePerfil.mockResolvedValue(PERFIL);
    findFirstAlvo.mockResolvedValue({
      ...ALVO_SEM_DECISOR,
      demandas: [{ fonte: 'https://e.com/1', descricao: 'evidenciada' }],
      releases: [{ anguloAbordagem: 'anunciou expansão' }],
    });
    await reavaliarAlvo('org-1', 'alvo-1');
    const comEvidencia = updateAlvo.mock.calls[0][0].data;

    expect(comEvidencia.miraScore).toBeGreaterThan(soPresuncao.miraScore);
  });

  it('Alvo inexistente devolve null, sem quebrar quem chamou', async () => {
    findFirstAlvo.mockResolvedValue(null);
    expect(await reavaliarAlvo('org-1', 'nao-existe')).toBeNull();
  });

  it('falha interna não derruba o enriquecimento que já deu certo', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_SEM_DECISOR);
    updateAlvo.mockRejectedValue(new Error('banco caiu'));
    expect(await reavaliarAlvo('org-1', 'alvo-1')).toBeNull();
  });
});
