/**
 * enriquecerDecisoresPublico — honestidade da Camada 1 + Camada 4 (contato).
 *
 * O Rodrigo testou "Mapear decisores" e achou o resultado rápido e vazio
 * demais para acreditar que a busca tinha rodado de verdade. Tinha razão:
 * webSearch tomava 403 do Google CSE, o catch só conferia `status === 501`
 * (nenhum provedor configurado) e engolia qualquer outro erro — a tela dizia
 * "0 decisores" sem nunca ter buscado nada. Este arquivo prova os dois lados:
 * a falha agora propaga, e a Camada 4 (contato de quem já foi mapeado, ex.:
 * sócios do QSA) roda de verdade, com fonte real por trás de cada campo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstAlvo = vi.fn();
const findUniquePerfil = vi.fn();
const findManyDecisor = vi.fn();
const createDecisor = vi.fn();
const updateDecisor = vi.fn();
const updateAlvo = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a), update: (...a: any[]) => updateAlvo(...a) },
    miraPerfil: { findUnique: (...a: any[]) => findUniquePerfil(...a) },
    miraDecisor: {
      findMany: (...a: any[]) => findManyDecisor(...a),
      create: (...a: any[]) => createDecisor(...a),
      update: (...a: any[]) => updateDecisor(...a),
    },
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { complete: vi.fn() } }));

const webSearch = vi.fn();
const buscaPublicaDisponivel = vi.fn();
vi.mock('./buscaPublica.js', () => ({
  webSearch: (...a: any[]) => webSearch(...a),
  buscaPublicaDisponivel: () => buscaPublicaDisponivel(),
}));

const { enriquecerDecisoresPublico, extrairContatoPublico } = await import('./decisoresPublico.js');

const ALVO_BASE = {
  id: 'alvo-1',
  nome: 'ACME METALURGICA LTDA',
  nomeFantasia: null,
  municipio: 'São Paulo',
  uf: 'SP',
  fontes: [],
  decisores: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  buscaPublicaDisponivel.mockReturnValue(true);
  findUniquePerfil.mockResolvedValue({ alvoB2B: { decisor: [], influenciadores: [], usuarioFinal: [] } });
  findManyDecisor.mockResolvedValue([]);
  updateDecisor.mockResolvedValue({});
  updateAlvo.mockResolvedValue({});
  createDecisor.mockResolvedValue({ id: 'novo-1' });
});

describe('honestidade: fonte quebrada propaga, não vira "0 decisores"', () => {
  it('Camada 1: webSearch 502 (fonte_falhou) propaga em vez de virar candidatos=0 calado', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    const err: any = new Error('fonte_falhou');
    err.status = 502;
    err.detail = 'brave: brave_401 | google_cse: google_cse_403';
    webSearch.mockRejectedValue(err);

    await expect(enriquecerDecisoresPublico('org-1', 'alvo-1')).rejects.toMatchObject({
      status: 502,
      message: 'fonte_falhou',
    });
  });

  it('Camada 1: mercado genuinamente vazio (webSearch respondeu, 0 hits) NÃO propaga', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    webSearch.mockResolvedValue([]); // provedor respondeu, achou nada — legítimo
    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');
    expect(r.ok).toBe(true);
    expect(r.candidatos).toBe(0);
  });
});

describe('Camada 4: contato de decisores já mapeados (ex.: sócios do QSA)', () => {
  it('roda mesmo quando a Camada 1 não encontrou ninguém novo', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    webSearch.mockResolvedValue([]); // Camada 1: nada novo
    findManyDecisor.mockResolvedValue([
      { id: 'dec-1', nome: 'Carlos Roberto Rondello', vinculoQsa: true, perfilPublico: null, contato: null, lineage: [] },
    ]);

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.ok).toBe(true);
    expect(r.buscasContato).toBeGreaterThan(0); // a busca por nome DE FATO rodou
  });

  it('extrai LinkedIn, Instagram, e-mail e telefone SÓ de resultado que cita o nome', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findManyDecisor.mockResolvedValue([
      { id: 'dec-1', nome: 'Carlos Roberto Rondello', vinculoQsa: true, perfilPublico: null, contato: null, lineage: [] },
    ]);
    // Camada 1 (query genérica da empresa): nada.
    webSearch.mockImplementation(async (_org: string, query: string) => {
      if (query.includes('site:linkedin.com/in') && query.includes('Carlos Roberto Rondello')) {
        return [
          {
            title: 'Carlos Roberto Rondello - Sócio-diretor - Metalúrgica Rondello | LinkedIn',
            url: 'https://linkedin.com/in/carlos-rondello',
            snippet: 'Sócio-diretor na Metalúrgica Rondello.',
          },
        ];
      }
      if (query.includes('Carlos Roberto Rondello')) {
        return [
          {
            title: 'Fale com Carlos Roberto Rondello',
            url: 'https://diretorioempresas.com.br/metalurgica-rondello',
            snippet: 'Contato: carlos.rondello@metalurgicarondello.com.br ou (11) 98888-7777.',
          },
        ];
      }
      return []; // Camada 1, genérica: nada
    });

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.contatosEnriquecidos).toBe(1);
    const chamada = updateDecisor.mock.calls.find((c: any[]) => c[0].where.id === 'dec-1');
    expect(chamada).toBeTruthy();
    const data = chamada![0].data;
    expect(data.perfilPublico.linkedinUrl).toBe('https://linkedin.com/in/carlos-rondello');
    expect(data.contato.email).toBe('carlos.rondello@metalurgicarondello.com.br');
    expect(data.contato.phone).toBe('11988887777');
    expect(data.perfilPublico.contatoBuscadoEm).toBeTruthy();
  });

  it('não repete a busca de contato para quem já foi checado (contatoBuscadoEm presente)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findManyDecisor.mockResolvedValue([
      {
        id: 'dec-1',
        nome: 'Já Checado',
        vinculoQsa: true,
        perfilPublico: { contatoBuscadoEm: '2026-07-01T00:00:00.000Z' },
        contato: null,
        lineage: [],
      },
    ]);
    webSearch.mockResolvedValue([]);

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.buscasContato).toBe(0); // nenhuma query de contato disparada
    expect(updateDecisor).not.toHaveBeenCalled();
  });

  it('falha pontual na busca de contato vira aviso, não derruba o resultado principal', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findManyDecisor.mockResolvedValue([
      { id: 'dec-1', nome: 'Maria Teste', vinculoQsa: true, perfilPublico: null, contato: null, lineage: [] },
    ]);
    const err: any = new Error('fonte_falhou');
    err.status = 502;
    webSearch.mockImplementation(async (_org: string, query: string) => {
      if (query.includes('Maria Teste')) throw err;
      return [];
    });

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.ok).toBe(true); // Camada 1 (genérica) não quebrou, resultado principal sobrevive
    expect(r.avisos?.length).toBeGreaterThan(0);
  });
});

describe('extrairContatoPublico — determinístico, nunca inventa', () => {
  it('não extrai nada de uma lista vazia', () => {
    expect(extrairContatoPublico([])).toEqual({ linkedinUrl: null, instagramUrl: null, email: null, telefone: null });
  });

  it('pega o primeiro linkedin.com/in/ e o primeiro instagram.com/', () => {
    const r = extrairContatoPublico([
      { title: 'a', url: 'https://linkedin.com/in/fulano', snippet: '' },
      { title: 'b', url: 'https://instagram.com/fulano', snippet: '' },
    ]);
    expect(r.linkedinUrl).toBe('https://linkedin.com/in/fulano');
    expect(r.instagramUrl).toBe('https://instagram.com/fulano');
  });
});
