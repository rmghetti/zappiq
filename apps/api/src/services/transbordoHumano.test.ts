/* ══════════════════════════════════════════════════════════════════════
 * transbordoHumano: a pausa vai para a conversa do turno, em qualquer
 * estado aberto (C1b, achado 1 da auditoria do diff).
 * --------------------------------------------------------------------
 * O recorte antigo (conversas do contato em OPEN ou ASSIGNED) deixava de
 * fora a conversa em WAITING: depois de um transbordo e de um "Retomar"
 * (que devolve aiPaused=false e deixa WAITING), o segundo pedido de
 * pessoa não gravava nada no banco. No WhatsApp a IA ficava calada só
 * pelo cache, sem o Inbox mostrar o botão de devolver; no site a IA seguia
 * respondendo depois de prometer um atendente.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMany = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: { conversation: { updateMany: (...a: any[]) => updateMany(...a) } },
}));
const cacheSet = vi.fn(async () => true);
vi.mock('./cloud/index.js', () => ({ cache: { set: (...a: any[]) => (cacheSet as any)(...a) } }));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: () => undefined }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { marcarTransbordo, mensagemDeEspera, TEXTO_DE_ESPERA_PADRAO, PRAZO_DA_PAUSA_TEMPORARIA_SEGUNDOS } =
  await import('./transbordoHumano.js');

const ENTRADA = {
  organizationId: 'org-1',
  conversationId: 'conv-1',
  contactId: 'contato-1',
  contactPhone: '5511999999999',
};

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});

describe('marcarTransbordo', () => {
  it('pausa a conversa DO TURNO, pelo id e pela organização, em qualquer estado que não seja fechada', async () => {
    const r = await marcarTransbordo(ENTRADA);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'conv-1', organizationId: 'org-1', status: { not: 'CLOSED' } },
      data: { status: 'WAITING', aiPaused: true },
    });
    expect(r.pausou).toBe(true);
  });

  it('conversa já em WAITING (depois de um Retomar) volta a ficar pausada no banco', async () => {
    // O filtro não depende do estado atual: WAITING também é atualizado.
    await marcarTransbordo(ENTRADA);
    const where = updateMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ not: 'CLOSED' });
  });

  it('nenhuma linha atualizada (conversa fechada ou de outra organização): não diz que pausou', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const r = await marcarTransbordo(ENTRADA);
    expect(r.pausou).toBe(false);
  });

  it('o espelho no cache usa a chave que o Inbox limpa ao devolver, com prazo de 7 dias', async () => {
    await marcarTransbordo(ENTRADA);
    expect(cacheSet).toHaveBeenCalledWith('ai_paused:org-1:5511999999999', 'handoff', 60 * 60 * 24 * 7);
  });

  it('banco fora: não lança', async () => {
    updateMany.mockRejectedValue(new Error('db down'));
    await expect(marcarTransbordo(ENTRADA)).resolves.toEqual({ pausou: false, avisou: false });
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * Rodada 1 do PR #379, item 2: o erro técnico (catch geral do orquestrador)
 * é transitório (modelo 5xx, tempo do banco). Pausar de forma durável
 * deixaria o cliente sem resposta até alguém clicar "Retomar", e a equipe
 * só é avisada por socket. A pausa do erro é TEMPORÁRIA: espelho no cache
 * por 1 hora, sem aiPaused no banco. O transbordo intencional (pedido de
 * humano, tag handoff, rede de crise) segue durável.
 * ══════════════════════════════════════════════════════════════════════ */

describe('marcarTransbordo com pausa temporária (erro técnico)', () => {
  it('o espelho no cache dura 1 hora (3600 s)', async () => {
    await marcarTransbordo({ ...ENTRADA, pausa: 'temporaria' });
    expect(PRAZO_DA_PAUSA_TEMPORARIA_SEGUNDOS).toBe(3600);
    expect(cacheSet).toHaveBeenCalledWith('ai_paused:org-1:5511999999999', expect.any(String), 3600);
  });

  it('o banco recebe WAITING e NÃO recebe aiPaused: passada a hora, a IA volta sozinha', async () => {
    await marcarTransbordo({ ...ENTRADA, pausa: 'temporaria' });
    expect(updateMany).toHaveBeenCalledTimes(1);
    const chamada = updateMany.mock.calls[0][0];
    expect(chamada.where).toEqual({ id: 'conv-1', organizationId: 'org-1', status: { not: 'CLOSED' } });
    expect(chamada.data).toEqual({ status: 'WAITING' });
    expect(chamada.data).not.toHaveProperty('aiPaused');
  });

  it('sem o modo (padrão) e com "duravel": aiPaused no banco e 7 dias no espelho, como antes', async () => {
    await marcarTransbordo(ENTRADA);
    await marcarTransbordo({ ...ENTRADA, pausa: 'duravel' });
    for (const chamada of updateMany.mock.calls) {
      expect(chamada[0].data).toEqual({ status: 'WAITING', aiPaused: true });
    }
    for (const chamada of cacheSet.mock.calls) {
      expect((chamada as any[])[2]).toBe(60 * 60 * 24 * 7);
    }
  });
});

describe('mensagemDeEspera', () => {
  it('a do dono quando existe; a padrão quando não', () => {
    expect(mensagemDeEspera({ handoffMessage: '  Já chamei a equipe.  ' })).toBe('Já chamei a equipe.');
    expect(mensagemDeEspera({})).toBe(TEXTO_DE_ESPERA_PADRAO);
    expect(mensagemDeEspera(null)).toBe(TEXTO_DE_ESPERA_PADRAO);
  });
});
