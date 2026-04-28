/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · Vitest config (Sprint 0 Blocker 1)
 * --------------------------------------------------------------------
 * Primeiro setup de teste do apps/api. Configuração mínima:
 *   - ESM via tsx (nativo do projeto)
 *   - test files em src/**\/*.test.ts (colocados perto do código)
 *   - exclui dist/, node_modules/
 *   - timeout default 10s (suficiente pra integration tests com mocks)
 *
 * Como rodar:
 *   pnpm --filter @zappiq/api test
 *   pnpm --filter @zappiq/api test:watch
 *
 * NÃO mexa em:
 *   - test:e2e ou test:integration (separar quando entrar Postgres real)
 *   - coverage thresholds (sem cobertura mínima até infra de coverage)
 * ══════════════════════════════════════════════════════════════════════ */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**', '.turbo/**'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    // Cada teste roda em isolated context — evita state leak de breakers
    isolate: true,
  },
});
