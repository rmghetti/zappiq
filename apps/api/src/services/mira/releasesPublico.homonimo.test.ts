/**
 * A matéria é DESTA empresa, ou de uma homônima?
 *
 * Achado na prova de produção (15/07/2026), e nenhum dos 20 testes unitários
 * que eu já tinha escrito pegaria: eles provam que o código faz o que mandei,
 * não que a busca traz a empresa certa.
 *
 * Buscar o Alvo "COFEL COMERCIAL E INDUSTRIAL DE FERRO LIGAS LTDA" devolvia:
 *   - instagram.com/cofelsaj        → "COFEL Loja de Departamentos"
 *   - instagram.com/cofellaminados  → "Cofel Laminados"
 *   - instagram.com/cofelma         → "Metalúrgica Cofelma"
 * e com o nome curto vinha Copel, Cofen, Passos Coelho e até Ronaldinho (a
 * Brave não honra aspas como frase exata).
 *
 * Sem filtro, o analista recebe uma dúzia de resultados de empresas homônimas
 * e pode atribuir "a Cofel Laminados anunciou X" ao Alvo de ferro ligas. O
 * vendedor cita o fato numa reunião e queima a conta. Fato de outra empresa no
 * dossiê é PIOR que dossiê vazio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  miraRelease: { findFirst: vi.fn(), create: vi.fn() },
  miraDemanda: { upsert: vi.fn() },
  miraOportunidade: { upsert: vi.fn() },
  miraIncumbente: { deleteMany: vi.fn(), create: vi.fn() },
};
vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { complete: vi.fn() } }));
vi.mock('./buscaPublica.js', () => ({ webSearch: vi.fn(), buscaPublicaDisponivel: vi.fn(() => true) }));

const { nucleoDoNome, confirmaAConta, pesquisarPegadaPublica } = await import('./releasesPublico.js');
const { webSearch } = await import('./buscaPublica.js');
const { llmRouter } = await import('../llm/LLMRouter.js');

/** O Alvo real de produção, com os sinais que ele de fato tem. */
const COFEL = {
  id: 'alvo1',
  nome: 'COFEL COMERCIAL E INDUSTRIAL DE FERRO LIGAS LTDA',
  nomeFantasia: null,
  cnpj: '01382565000143',
  municipio: 'Atibaia',
  uf: 'SP',
  telefone: '1144117333',
  decisores: [{ nome: 'LUIZ ROBERTO PINNISI' }, { nome: 'OKRA HOLDINGS LTDA.' }, { nome: 'Claudio Nunes' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  (llmRouter.complete as any).mockResolvedValue({
    text: JSON.stringify({ releases: [], incumbentes: [], demandas: [], janela: null }),
  });
});

describe('nucleoDoNome: razão social inteira não é frase de busca', () => {
  it('tira o ruído societário e guarda o que identifica', () => {
    expect(nucleoDoNome('COFEL COMERCIAL E INDUSTRIAL DE FERRO LIGAS LTDA')).toEqual(['cofel', 'ferro', 'ligas']);
  });

  it('o primeiro token é o mais distintivo', () => {
    expect(nucleoDoNome('ALUMIGON BRASILEIRA - INDUSTRIA E COMERCIO LTDA')[0]).toBe('alumigon');
    expect(nucleoDoNome('SERVEMAC COMERCIO E MANUTENCAO DE MAQUINAS AGRICOLAS LTDA')[0]).toBe('servemac');
  });

  it('nome só de ruído não vira busca (evita varrer o Brasil inteiro)', () => {
    expect(nucleoDoNome('COMERCIO E INDUSTRIA LTDA')).toEqual([]);
  });
});

describe('confirmaAConta: exige um sinal que ligue o resultado a ESTE CNPJ', () => {
  const hit = (title: string, snippet: string, url: string) => ({ title, snippet, url });

  it('CNPJ na fonte confirma (irrefutável)', () => {
    const r = confirmaAConta(hit('Cofel', 'CNPJ: 01.382.565/0001-43', 'https://x.com'), { cnpj: '01382565000143' });
    expect(r.confirma).toBe(true);
    expect(r.por).toContain('CNPJ');
  });

  it('decisor do QSA citado confirma', () => {
    const r = confirmaAConta(hit('Entrevista', 'Segundo Claudio Nunes, gerente industrial...', 'https://x.com'), {
      decisores: ['Claudio Nunes'],
    });
    expect(r.confirma).toBe(true);
    expect(r.por).toContain('Claudio Nunes');
  });

  it('sócio PJ não confirma (OKRA HOLDINGS não é pessoa que dá entrevista)', () => {
    const r = confirmaAConta(hit('Holdings', 'texto sobre okra holdings ltda.', 'https://x.com'), {
      decisores: ['OKRA HOLDINGS LTDA.'],
    });
    expect(r.confirma).toBe(false);
  });

  it('município confirma (a Cofel de Atibaia não é a Cofel Laminados)', () => {
    const r = confirmaAConta(hit('Cofel amplia', 'A empresa de Atibaia investiu...', 'https://x.com'), {
      municipio: 'Atibaia',
      uf: 'SP',
    });
    expect(r.confirma).toBe(true);
    expect(r.por).toContain('Atibaia');
  });

  it('telefone da conta confirma', () => {
    const r = confirmaAConta(hit('Contato', 'Fone (11) 4411-7333', 'https://x.com'), { telefone: '1144117333' });
    expect(r.confirma).toBe(true);
  });

  it('SEM nenhum sinal, NÃO confirma (é o caso da homônima)', () => {
    const r = confirmaAConta(hit('Cofel Laminados', 'A Cofel Laminados produz chapas.', 'https://cofellaminados.com.br'), {
      cnpj: '01382565000143',
      municipio: 'Atibaia',
      decisores: ['Claudio Nunes'],
    });
    expect(r.confirma).toBe(false);
    expect(r.por).toBeNull();
  });
});

describe('o fluxo real: o lixo da Brave não chega ao analista', () => {
  it('descarta os homônimos que a busca de produção realmente devolveu', async () => {
    // Exatamente o que a Brave devolveu em 15/07/2026 para o COFEL
    (webSearch as any).mockResolvedValue([
      { title: 'COFEL - Loja de Departamentos (@cofelsaj)', snippet: 'Fotos e videos', url: 'https://www.instagram.com/cofelsaj/' },
      { title: 'Cofel Laminados (@cofellaminados)', snippet: 'Instagram photos', url: 'https://www.instagram.com/cofellaminados/' },
      { title: 'Metalúrgica Cofelma (@cofelma)', snippet: 'Instagram photos', url: 'https://www.instagram.com/cofelma/' },
      { title: 'Copel avança em migração para Novo Mercado', snippet: 'Café com ESG', url: 'https://xpi.com.br/copel' },
      { title: 'O que explica a volta de Ronaldinho', snippet: 'anunciou a camisa', url: 'https://oglobo.com/ronaldinho' },
    ]);

    const r = await pesquisarPegadaPublica('org1', COFEL, [{ nome: 'Esteira' }]);

    // Nenhum sobreviveu: nenhum tem CNPJ, decisor, município ou telefone
    expect(r.releases).toHaveLength(0);
    // E o analista nunca foi chamado com lixo
    expect(llmRouter.complete).not.toHaveBeenCalled();
    // Honestidade: reporta que achou coisas e as recusou
    expect(r.descartadosPorHomonimo).toBeGreaterThan(0);
  });

  it('Copel e Ronaldinho nem contam como homônimo (não citam o núcleo)', async () => {
    (webSearch as any).mockResolvedValue([
      { title: 'Copel avança', snippet: 'energia', url: 'https://xpi.com.br/copel' },
      { title: 'Ronaldinho volta', snippet: 'futebol', url: 'https://oglobo.com/r' },
    ]);

    const r = await pesquisarPegadaPublica('org1', COFEL, [{ nome: 'Esteira' }]);
    expect(r.releases).toHaveLength(0);
    // Descartados na camada 1 (nem mencionam "cofel"), não na de homônimo
    expect(r.descartadosPorHomonimo ?? 0).toBe(0);
  });

  it('a matéria CONFIRMADA passa e vira release', async () => {
    (webSearch as any).mockResolvedValue([
      {
        title: 'Cofel investe em nova linha de ferroligas',
        snippet: 'A Cofel, de Atibaia, anunciou investimento na expansão da capacidade.',
        url: 'https://exame.com/cofel-expansao',
      },
    ]);
    (llmRouter.complete as any).mockResolvedValue({
      text: JSON.stringify({
        releases: [
          {
            fonteIndice: 1,
            titulo: 'Investimento em nova linha',
            resumo: 'A empresa anunciou expansão da capacidade produtiva.',
            dataPublicacao: null,
            relevancia: 'Expansão puxa demanda de equipamento.',
            angulo: 'Fale antes da especificação.',
            produtoRelacionado: 'Esteira',
            demandaGerada: 'Equipar a linha nova.',
            oportunidade: { produto: 'Esteira', racional: 'Linha nova precisa de transporte.' },
          },
        ],
        incumbentes: [],
        demandas: [],
        janela: null,
      }),
    });

    const r = await pesquisarPegadaPublica('org1', COFEL, [{ nome: 'Esteira' }]);

    expect(r.releases).toHaveLength(1); // confirmado por "Atibaia"
    expect(r.releases[0].url).toBe('https://exame.com/cofel-expansao');
    expect(r.releases[0].demandaGerada).toContain('Equipar');
  });

  it('a query usa o NÚCLEO e o município, não a razão social inteira', async () => {
    (webSearch as any).mockResolvedValue([]);
    await pesquisarPegadaPublica('org1', COFEL, [{ nome: 'Esteira' }]);

    const queries = (webSearch as any).mock.calls.map((c: any[]) => c[1]);
    for (const q of queries) {
      expect(q).not.toContain('COMERCIAL E INDUSTRIAL'); // ninguém escreve isso numa matéria
      expect(q.toLowerCase()).toContain('cofel');
    }
    // O município NÃO entra na query (a prova em produção mostrou que zera os
    // hits: a Brave faz AND). Ele vale como confirmação no texto do resultado.
    expect(queries.every((q: string) => !q.includes('Atibaia'))).toBe(true); // município na query zerou os hits em produção
  });

  it('Alvo sem município (dado antigo) ainda busca, só sem o desempate', async () => {
    (webSearch as any).mockResolvedValue([]);
    await pesquisarPegadaPublica('org1', { ...COFEL, municipio: null, uf: null }, [{ nome: 'Esteira' }]);

    const queries = (webSearch as any).mock.calls.map((c: any[]) => c[1]);
    expect(queries.length).toBe(4);
    expect(queries.every((q: string) => !q.includes('Atibaia'))).toBe(true);
  });
});
