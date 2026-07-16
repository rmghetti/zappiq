/**
 * Sinais do Perfil nos releases: dores resolvidas e sinais de intenção
 * declarados no Perfil chegam ao prompt de relevância do analista de sinais.
 * Sem eles a relevância era absoluta ("é notícia?"), não relativa ao que o
 * cliente vende e ao timing que ele declarou.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@zappiq/database', () => ({ prisma: {} }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { complete: vi.fn() } }));
vi.mock('./buscaPublica.js', () => ({ webSearch: vi.fn(), buscaPublicaDisponivel: () => true }));

const { montarLinhasSinais } = await import('./releasesPublico.js');

describe('montarLinhasSinais', () => {
  it('dores e sinais declarados viram linhas do prompt', () => {
    const linhas = montarLinhasSinais({
      doresResolvidas: ['Downtime derruba a operação'],
      sinaisIntencao: ['contratando na área de TI', 'expandindo filiais'],
    });
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain('Downtime derruba a operação');
    expect(linhas[1]).toContain('contratando na área de TI');
    expect(linhas[1]).toContain('expandindo filiais');
  });

  it('sem sinais declarados, nenhuma linha entra (prompt fica como era)', () => {
    expect(montarLinhasSinais(undefined)).toEqual([]);
    expect(montarLinhasSinais({ doresResolvidas: [], sinaisIntencao: [] })).toEqual([]);
  });

  it('entradas vazias e não-string caem fora', () => {
    const linhas = montarLinhasSinais({ doresResolvidas: ['', '  ', 'Custo alto de infra'], sinaisIntencao: [] });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toContain('Custo alto de infra');
  });
});
