/**
 * O ciclo semanal de Releases fecha de verdade.
 *
 * Até 15/07/2026 o cron gravava a linha do release e ia embora: não persistia
 * a demanda que o MESMO LLM já tinha produzido na MESMA chamada, não reavaliava
 * o Alvo (o score só se movia se alguém clicasse em "Aprofundar com IA" à mão)
 * e não avisava ninguém. O monitoramento automático achava a novidade e nada
 * acontecia.
 *
 * Este arquivo não existia — o cron nunca teve teste. Era a área de chão mais
 * fino do módulo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  organization: { findMany: vi.fn() },
  miraPerfil: { findUnique: vi.fn() },
  miraAlvo: { findMany: vi.fn(), update: vi.fn() },
  miraRelease: { findFirst: vi.fn(), create: vi.fn() },
};

const reavaliarAlvoMock = vi.fn();
const alertarMock = vi.fn();
const persistirMock = vi.fn();
const buscarMock = vi.fn();
const fetchCnpjMock = vi.fn();

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../config/env.js', () => ({ env: { REDIS_URL: 'redis://localhost:6379' } }));
vi.mock('bullmq', () => ({ Queue: class { add = vi.fn(); }, Worker: class { on = vi.fn(); } }));
vi.mock('./cnpj.js', () => ({ fetchCnpj: fetchCnpjMock }));
vi.mock('./buscaPublica.js', () => ({ buscaPublicaDisponivel: () => true }));
vi.mock('./releasesPublico.js', () => ({ buscarReleasesPublicos: buscarMock, persistirPegadaPublica: persistirMock }));
vi.mock('./reavaliar.js', () => ({ reavaliarAlvo: reavaliarAlvoMock }));
vi.mock('./releasesAlerta.js', () => ({ alertarReleasesDoAlvo: alertarMock }));
vi.mock('../../middleware/requireMira.js', () => ({
  getMiraEntitlement: vi.fn(async () => ({ access: { entitled: true } })),
}));

const { runMiraReleasesCycle } = await import('./releasesCron.js');

const ALVO = {
  id: 'alvo1',
  nome: 'Metalex',
  cnpj: '12345678000199',
  situacaoCadastral: 'ATIVA',
  porte: 'ME',
  decisores: [{ nome: 'ANA COSTA' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers(); // o cron dorme 1200ms entre lookups
  prismaMock.organization.findMany.mockResolvedValue([{ id: 'org1' }]);
  prismaMock.miraPerfil.findUnique.mockResolvedValue({ catalogo: [{ nome: 'Esteira' }], doresResolvidas: [], alvoB2B: {} });
  prismaMock.miraAlvo.findMany.mockResolvedValue([ALVO]);
  prismaMock.miraAlvo.update.mockResolvedValue({});
  // Sem mudança no registro oficial: isola a trilha da pegada pública
  fetchCnpjMock.mockResolvedValue({ situacaoCadastral: 'ATIVA', porte: 'ME', qsa: [{ nome: 'ANA COSTA' }] });
  buscarMock.mockResolvedValue({ releases: [], incumbentes: [], demandas: [], janela: null, buscas: 4, drafts: [] });
  persistirMock.mockResolvedValue({
    releases: 1,
    demandasDeRelease: 1,
    oportunidades: 1,
    incumbentes: 0,
    demandasEvidenciadas: 0,
  });
  reavaliarAlvoMock.mockResolvedValue({ scoreAntes: 45, scoreDepois: 60 });
  alertarMock.mockResolvedValue({ taskId: 'task1', releasesAlertados: 1 });
});

async function rodar() {
  const p = runMiraReleasesCycle();
  await vi.runAllTimersAsync();
  return p;
}

describe('o ciclo semanal fecha: grava, reavalia e avisa', () => {
  it('persiste o dossiê INTEIRO, não só os releases', async () => {
    const r = await rodar();

    expect(persistirMock).toHaveBeenCalledTimes(1);
    expect(r.releasesCreated).toBe(1);
    expect(r.demandasCreated).toBe(1); // a demanda não é mais jogada fora
    expect(r.oportunidadesCreated).toBe(1);
  });

  it('reavalia o Alvo depois de gravar (o score se move sozinho)', async () => {
    const r = await rodar();

    expect(reavaliarAlvoMock).toHaveBeenCalledWith('org1', 'alvo1');
    expect(r.scoresMovidos).toBe(1); // 45 → 60
  });

  it('score que não mudou não conta como movido (o número não mente)', async () => {
    reavaliarAlvoMock.mockResolvedValue({ scoreAntes: 45, scoreDepois: 45 });

    const r = await rodar();
    expect(r.scoresMovidos).toBe(0);
  });

  it('alerta o cliente e conta a tarefa criada', async () => {
    const r = await rodar();

    expect(alertarMock).toHaveBeenCalledWith('org1', ALVO);
    expect(r.alertasCriados).toBe(1);
  });

  it('release informativo não gera tarefa e o contador não infla', async () => {
    alertarMock.mockResolvedValue({ taskId: null, releasesAlertados: 0, motivo: 'nada_acionavel' });

    const r = await rodar();
    expect(r.alertasCriados).toBe(0);
  });
});

describe('fail-soft: o ciclo não morre por causa de um Alvo', () => {
  it('reavaliação que falha não derruba o ciclo', async () => {
    reavaliarAlvoMock.mockResolvedValue(null); // reavaliarAlvo nunca lança, devolve null

    const r = await rodar();
    expect(r.alvosChecked).toBe(1);
    expect(r.scoresMovidos).toBe(0);
    expect(r.failed).toBe(0);
  });

  it('busca quebrada não impede o resto do ciclo (fonte fora do ar ≠ conta quieta)', async () => {
    buscarMock.mockResolvedValue({
      releases: [],
      incumbentes: [],
      demandas: [],
      janela: null,
      buscas: 0,
      drafts: [],
      erro: 'fonte_falhou',
    });

    const r = await rodar();
    expect(r.alvosChecked).toBe(1);
    expect(reavaliarAlvoMock).toHaveBeenCalled(); // reavalia mesmo assim
    expect(r.failed).toBe(0);
  });

  it('org sem o add-on Mira é pulada inteira', async () => {
    const { getMiraEntitlement } = await import('../../middleware/requireMira.js');
    (getMiraEntitlement as any).mockResolvedValue({ access: { entitled: false } });

    const r = await rodar();
    expect(r.organizationsProcessed).toBe(0);
    expect(prismaMock.miraAlvo.findMany).not.toHaveBeenCalled();
    expect(persistirMock).not.toHaveBeenCalled();
  });
});
