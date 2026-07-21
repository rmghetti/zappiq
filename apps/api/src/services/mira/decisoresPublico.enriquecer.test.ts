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

  it('REJEITA contato de empresa homônima: LinkedIn/e-mail/telefone de "Metalúrgica Rondello" NÃO entram no decisor da ACME', async () => {
    // Cenário exato da reclamação do cliente: a Brave não honra aspas, então a
    // busca por '"Carlos Roberto Rondello" "ACME METALURGICA LTDA"' devolve o
    // perfil de um xará que trabalha em OUTRA empresa. O contato dele NUNCA
    // pode ser gravado no decisor da ACME.
    findFirstAlvo.mockResolvedValue(ALVO_BASE); // nome: 'ACME METALURGICA LTDA'
    findManyDecisor.mockResolvedValue([
      { id: 'dec-1', nome: 'Carlos Roberto Rondello', vinculoQsa: true, perfilPublico: null, contato: null, lineage: [] },
    ]);
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
      return [];
    });

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.contatosEnriquecidos).toBe(0); // fonte de outra empresa é pior que fonte nenhuma
    const chamada = updateDecisor.mock.calls.find((c: any[]) => c[0].where.id === 'dec-1');
    if (chamada) {
      // Pode marcar contatoBuscadoEm (para não re-buscar), mas jamais gravar
      // LinkedIn/e-mail/telefone de outra empresa.
      const data = chamada[0].data;
      expect(data.perfilPublico?.linkedinUrl ?? null).toBeNull();
      expect(data.contato ?? null).toBeNull();
    }
  });

  it('QSA pai/filho homônimos: hit do FILHO em outra empresa não vira contato do PAI, e a tentativa não é queimada', async () => {
    // Achado da revisão adversarial: a exclusão por nome EXATO deixava o
    // "JOAO SILVA FILHO" (outro sócio do QSA) confirmar a empresa num hit que
    // na verdade é do filho em OUTRA firma — o check de nome usa includes e
    // "joao silva" é substring de "joao silva filho". Nos dois sentidos.
    findFirstAlvo.mockResolvedValue({
      ...ALVO_BASE,
      decisores: [
        { id: 'd-pai', nome: 'JOAO SILVA', vinculoQsa: true },
        { id: 'd-filho', nome: 'JOAO SILVA FILHO', vinculoQsa: true },
      ],
    });
    findManyDecisor.mockResolvedValue([
      { id: 'd-pai', nome: 'JOAO SILVA', vinculoQsa: true, perfilPublico: null, contato: null, lineage: [] },
    ]);
    webSearch.mockImplementation(async (_org: string, query: string) => {
      if (query.includes('JOAO SILVA')) {
        return [
          {
            title: 'Joao Silva Filho - Diretor - Metalurgica Rondello | LinkedIn',
            url: 'https://linkedin.com/in/joao-silva-filho',
            snippet: 'Diretor na Metalurgica Rondello. Joao Silva Filho.',
          },
        ];
      }
      return [];
    });

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.contatosEnriquecidos).toBe(0);
    const chamada = updateDecisor.mock.calls.find((c: any[]) => c[0].where.id === 'd-pai');
    if (chamada) {
      expect(chamada[0].data.perfilPublico?.linkedinUrl ?? null).toBeNull();
      // Tentativa NÃO queimada: todos os hits do nome foram recusados pelo
      // anti-homônimo, então o próximo clique pode tentar de novo (ex.: depois
      // de o Alvo ganhar site oficial, que confirma o que hoje não dá).
      expect(chamada[0].data.perfilPublico?.contatoBuscadoEm ?? null).toBeNull();
    }
  });

  it('decisor mapeado na WEB (vinculoQsa false) não serve de âncora para confirmar a empresa', async () => {
    // Dado poluído (decisor errado criado antes do fix) não pode confirmar
    // novos resultados da empresa errada: só sócio do QSA (registro oficial)
    // entra nos sinais da conta.
    findFirstAlvo.mockResolvedValue({
      ...ALVO_BASE,
      decisores: [{ id: 'd-web', nome: 'Fulano Poluido', vinculoQsa: false }],
    });
    findManyDecisor.mockResolvedValue([
      { id: 'd-web', nome: 'Fulano Poluido', vinculoQsa: false, perfilPublico: null, contato: null, lineage: [] },
    ]);
    webSearch.mockImplementation(async (_org: string, query: string) => {
      if (query.includes('Fulano Poluido')) {
        return [
          {
            // Cita o próprio Fulano (nome bate), NÃO cita a ACME nem sinal
            // nenhum da conta. Antes, "Fulano Poluido" nos sinais confirmaria.
            title: 'Fulano Poluido - Gerente - Empresa Errada | LinkedIn',
            url: 'https://linkedin.com/in/fulano-poluido',
            snippet: 'Gerente na Empresa Errada. Fulano Poluido.',
          },
        ];
      }
      return [];
    });

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.contatosEnriquecidos).toBe(0);
  });

  it('ACEITA contato quando a MESMA fonte cita a empresa-alvo (ACME)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findManyDecisor.mockResolvedValue([
      { id: 'dec-1', nome: 'Carlos Roberto Rondello', vinculoQsa: true, perfilPublico: null, contato: null, lineage: [] },
    ]);
    webSearch.mockImplementation(async (_org: string, query: string) => {
      if (query.includes('site:linkedin.com/in') && query.includes('Carlos Roberto Rondello')) {
        return [
          {
            title: 'Carlos Roberto Rondello - Diretor - ACME Metalúrgica | LinkedIn',
            url: 'https://linkedin.com/in/carlos-acme',
            snippet: 'Diretor na ACME Metalúrgica Ltda.',
          },
        ];
      }
      return [];
    });

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.contatosEnriquecidos).toBe(1);
    const chamada = updateDecisor.mock.calls.find((c: any[]) => c[0].where.id === 'dec-1');
    expect(chamada![0].data.perfilPublico.linkedinUrl).toBe('https://linkedin.com/in/carlos-acme');
    expect(chamada![0].data.perfilPublico.contatoBuscadoEm).toBeTruthy();
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

describe('vínculo com a empresa-alvo: não mapeia homônimo de outra empresa', () => {
  it('Camada 1: descarta candidato cujo resultado NÃO cita a empresa-alvo (xará em outra empresa)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE); // 'ACME METALURGICA LTDA'
    findUniquePerfil.mockResolvedValue({ alvoB2B: { decisor: ['Diretor'], influenciadores: [], usuarioFinal: [] } });
    // Resultado de LinkedIn de um homônimo em OUTRA empresa: não menciona a ACME.
    webSearch.mockResolvedValue([
      { title: 'João da Silva - Diretor - Metalúrgica Rondello | LinkedIn', url: 'https://linkedin.com/in/joao-silva-rondello', snippet: 'Diretor na Metalúrgica Rondello.' },
    ]);
    const { llmRouter } = await import('../llm/LLMRouter.js');
    (llmRouter.complete as any).mockResolvedValue({
      text: JSON.stringify({ decisores: [{ nome: 'João da Silva', cargo: 'Diretor', fonteIndice: 1 }] }),
    });

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.criados).toBe(0);
    expect(createDecisor).not.toHaveBeenCalled();
    // Honestidade na resposta (não só no log): a busca ACHOU e nós recusamos.
    expect(r.homonimosFiltrados).toBe(1);
  });

  it('Camada 1: aceita candidato cujo resultado cita a empresa-alvo (ACME)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findUniquePerfil.mockResolvedValue({ alvoB2B: { decisor: ['Diretor'], influenciadores: [], usuarioFinal: [] } });
    webSearch.mockResolvedValue([
      { title: 'João da Silva - Diretor - ACME Metalúrgica | LinkedIn', url: 'https://linkedin.com/in/joao-silva-acme', snippet: 'Diretor na ACME Metalúrgica.' },
    ]);
    const { llmRouter } = await import('../llm/LLMRouter.js');
    (llmRouter.complete as any).mockResolvedValue({
      text: JSON.stringify({ decisores: [{ nome: 'João da Silva', cargo: 'Diretor', fonteIndice: 1 }] }),
    });

    const r = await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(r.criados).toBe(1);
    expect(createDecisor).toHaveBeenCalled();
  });
});

describe('Fontes verificadas: o que cada camada achou (não só o link)', () => {
  // O Rodrigo testou "Mapear decisores" e viu "1 enriquecido a partir de
  // pegada pública" sem nenhum jeito de saber O QUÊ. A Camada 4 atualizava o
  // decisor mas nunca escrevia em alvo.fontes: o rodapé do dossiê ficava
  // mudo justo na única fonte de detalhe que a tela tem.
  it('contato enriquecido (Camada 4) grava uma entrada DESCRITIVA em fontes, com a fonte real', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findManyDecisor.mockResolvedValue([
      { id: 'dec-1', nome: 'Carlos Roberto Rondello', vinculoQsa: true, perfilPublico: null, contato: null, lineage: [] },
    ]);
    webSearch.mockImplementation(async (_org: string, query: string) => {
      if (query.includes('site:linkedin.com/in') && query.includes('Carlos Roberto Rondello')) {
        return [{ title: 'Carlos Roberto Rondello - Sócio na ACME Metalúrgica | LinkedIn', url: 'https://linkedin.com/in/carlos-rondello', snippet: 'Sócio na ACME Metalúrgica' }];
      }
      return [];
    });

    await enriquecerDecisoresPublico('org-1', 'alvo-1');

    // A ÚNICA escrita em fontes é a consolidada, no fim; lê o valor ATUAL do
    // banco (não a cópia de alvo carregada no início) antes de acrescentar.
    const escritaFontes = updateAlvo.mock.calls.find((c: any[]) => c[0].data?.fontes !== undefined);
    expect(escritaFontes, 'nenhuma escrita em alvo.fontes').toBeTruthy();
    const entrada = escritaFontes![0].data.fontes[0];
    expect(entrada.campo).toContain('Carlos Roberto Rondello');
    expect(entrada.campo).toContain('LinkedIn');
    expect(entrada.campo).not.toBe('decisores_pegada_publica'); // o rótulo genérico antigo
    expect(entrada.url).toBe('https://linkedin.com/in/carlos-rondello');
  });

  it('telefone/e-mail achados SEM LinkedIn/Instagram ainda ganham uma fonte real (nunca ficam sem lastro)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findManyDecisor.mockResolvedValue([
      { id: 'dec-1', nome: 'Maria Teste', vinculoQsa: true, perfilPublico: null, contato: null, lineage: [] },
    ]);
    webSearch.mockImplementation(async (_org: string, query: string) => {
      if (query.includes('Maria Teste') && !query.includes('linkedin')) {
        return [{ title: 'Maria Teste - ACME Metalúrgica', url: 'https://diretorio.com.br/maria', snippet: 'ACME Metalúrgica - contato: maria@x.com.br' }];
      }
      return [];
    });

    await enriquecerDecisoresPublico('org-1', 'alvo-1');

    const escritaFontes = updateAlvo.mock.calls.find((c: any[]) => c[0].data?.fontes !== undefined);
    expect(escritaFontes).toBeTruthy();
    const entrada = escritaFontes![0].data.fontes[0];
    expect(entrada.campo).toContain('e-mail');
    expect(entrada.url).toBe('https://diretorio.com.br/maria');
  });

  it('decisor NOVO grava a URL da PRÓPRIA pessoa, não a do primeiro resultado da lista', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findUniquePerfil.mockResolvedValue({ alvoB2B: { decisor: [], influenciadores: [], usuarioFinal: [] } });
    webSearch.mockResolvedValue([
      { title: 'Resultado genérico da empresa', url: 'https://empresa.com/sobre', snippet: 'ACME METALURGICA LTDA' },
      { title: 'Joana Pereira - Diretora Financeira - ACME | LinkedIn', url: 'https://linkedin.com/in/joana-pereira', snippet: 'Diretora Financeira na ACME' },
    ]);
    const { llmRouter } = await import('../llm/LLMRouter.js');
    (llmRouter.complete as any).mockResolvedValue({
      text: JSON.stringify({ decisores: [{ nome: 'Joana Pereira', cargo: 'Diretora Financeira', fonteIndice: 2 }] }),
    });

    await enriquecerDecisoresPublico('org-1', 'alvo-1');

    const escritaFontes = updateAlvo.mock.calls.find((c: any[]) => c[0].data?.fontes !== undefined);
    const entrada = escritaFontes![0].data.fontes.find((f: any) => f.campo.includes('Joana Pereira'));
    expect(entrada, 'entrada de Joana Pereira não encontrada').toBeTruthy();
    expect(entrada.campo).toContain('novo decisor');
    // A URL tem que ser a DELA (o resultado onde o nome dela aparece), não o
    // primeiro resultado da lista (que fala da empresa, não de ninguém).
    expect(entrada.url).toBe('https://linkedin.com/in/joana-pereira');
  });

  it('sem nenhum enriquecimento, não escreve em fontes à toa', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    webSearch.mockResolvedValue([]);
    findManyDecisor.mockResolvedValue([]);

    await enriquecerDecisoresPublico('org-1', 'alvo-1');

    const escritaFontes = updateAlvo.mock.calls.find((c: any[]) => c[0].data?.fontes !== undefined);
    expect(escritaFontes).toBeUndefined();
  });
});

describe('isChampion no decisor mapeado por pegada pública', () => {
  it('decisor NOVO com cargo de poder de compra nasce com a coroa (3º site de criação, achado da revisão)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_BASE);
    findUniquePerfil.mockResolvedValue({ alvoB2B: { decisor: [], influenciadores: [], usuarioFinal: [] } });
    webSearch.mockResolvedValue([
      { title: 'Joana Pereira - Diretora Financeira - ACME | LinkedIn', url: 'https://linkedin.com/in/joana-pereira', snippet: 'Diretora Financeira na ACME' },
    ]);
    const { llmRouter } = await import('../llm/LLMRouter.js');
    (llmRouter.complete as any).mockResolvedValue({
      text: JSON.stringify({ decisores: [{ nome: 'Joana Pereira', cargo: 'Diretora Financeira', fonteIndice: 1 }] }),
    });

    await enriquecerDecisoresPublico('org-1', 'alvo-1');

    expect(createDecisor).toHaveBeenCalled();
    const data = createDecisor.mock.calls[0][0].data;
    expect(data.arquetipo).toBe('ECONOMIC_BUYER'); // 'financ' no cargo
    expect(data.isChampion).toBe(true);
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
