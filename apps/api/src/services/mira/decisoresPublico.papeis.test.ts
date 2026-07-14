/**
 * Papéis-alvo dos decisores por pegada pública: o comitê declarado no Perfil
 * (decisor + influenciadores + usuário final) é o que dirige as buscas, na
 * ordem certa de prioridade. Fallback genérico só quando nada foi declarado.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@zappiq/database', () => ({ prisma: {} }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { complete: vi.fn() } }));
vi.mock('./buscaPublica.js', () => ({ webSearch: vi.fn(), buscaPublicaDisponivel: () => true }));

const { montarPapeisAlvo } = await import('./decisoresPublico.js');

describe('montarPapeisAlvo', () => {
  it('compõe decisor > influenciador > usuário final, nessa ordem', () => {
    const p = montarPapeisAlvo({
      alvoB2B: {
        decisor: ['CEO', 'Diretor de TI'],
        influenciadores: ['Gerente de TI'],
        usuarioFinal: ['Analistas'],
      },
    });
    expect(p.buscaveis).toEqual(['CEO', 'Diretor de TI', 'Gerente de TI', 'Analistas']);
    expect(p.decisores).toEqual(['CEO', 'Diretor de TI']);
    expect(p.influenciadores).toEqual(['Gerente de TI']);
    expect(p.usuariosFinais).toEqual(['Analistas']);
  });

  it('deduplica ignorando caixa e acento', () => {
    const p = montarPapeisAlvo({
      alvoB2B: { decisor: ['Sócio'], influenciadores: ['socio', 'Compras'], usuarioFinal: [] },
    });
    expect(p.buscaveis).toEqual(['Sócio', 'Compras']);
  });

  it('sem nada declarado, cai no fallback genérico', () => {
    const p = montarPapeisAlvo({ alvoB2B: { decisor: [], influenciadores: [], usuarioFinal: [] } });
    expect(p.buscaveis).toEqual(['Diretor', 'Head de TI', 'Gerente']);
  });

  it('influenciador declarado entra nas buscas mesmo sem decisor', () => {
    const p = montarPapeisAlvo({ alvoB2B: { decisor: [], influenciadores: ['Compras'], usuarioFinal: [] } });
    expect(p.buscaveis).toEqual(['Compras']);
  });

  it('respeita o teto de 3 por grupo', () => {
    const p = montarPapeisAlvo({
      alvoB2B: { decisor: ['A', 'B', 'C', 'D'], influenciadores: [], usuarioFinal: [] },
    });
    expect(p.decisores).toEqual(['A', 'B', 'C']);
  });
});
