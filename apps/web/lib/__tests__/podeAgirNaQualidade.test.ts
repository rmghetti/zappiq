/**
 * podeAgirNaQualidade.test.ts (A115, revisão do PR #369)
 * ============================================================================
 * O backend passou a exigir ADMIN ou SUPERADMIN nas rotas da Qualidade que
 * escrevem no prompt ou gastam modelo. A tela continuava mostrando os botões
 * para todo mundo: o SUPERVISOR clicava em "Aplicar correção" e levava 403 sem
 * entender o motivo.
 *
 * Esta é a mesma função que a tela usa para decidir se mostra o botão. Ela não
 * substitui o portão do backend, que é o que de fato barra.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { podeAgirNaQualidade } from '../clientAgentQualityApi';

describe('podeAgirNaQualidade', () => {
  it('ADMIN e SUPERADMIN agem', () => {
    expect(podeAgirNaQualidade('ADMIN')).toBe(true);
    expect(podeAgirNaQualidade('SUPERADMIN')).toBe(true);
  });

  it('SUPERVISOR, AGENT e AUDITOR não agem', () => {
    expect(podeAgirNaQualidade('SUPERVISOR')).toBe(false);
    expect(podeAgirNaQualidade('AGENT')).toBe(false);
    expect(podeAgirNaQualidade('AUDITOR')).toBe(false);
  });

  it('sem papel não age', () => {
    expect(podeAgirNaQualidade(null)).toBe(false);
    expect(podeAgirNaQualidade(undefined)).toBe(false);
    expect(podeAgirNaQualidade('')).toBe(false);
  });

  it('não cai em variação de caixa', () => {
    expect(podeAgirNaQualidade('admin')).toBe(false);
  });
});
