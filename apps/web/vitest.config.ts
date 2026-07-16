/* ══════════════════════════════════════════════════════════════════════
 * Vitest config do apps/web — primeiro setup de teste desta app.
 * --------------------------------------------------------------------
 * Escopo deliberadamente estreito: só lógica PURA (mapeamento de dados,
 * validação), em ambiente node. Sem jsdom, sem testing-library, sem
 * renderizar componente — nada disso é necessário para o que cobrimos hoje,
 * e adicionar essa infra sem uso real só criaria peso morto.
 *
 * O primeiro caso de uso é o round-trip do Maestro
 * (app/(dashboard)/flows/_lib/graphMapping.ts): o mapeamento API ⇄ canvas é
 * capaz de destruir dado do cliente no save, então é lógica que precisa de
 * teste, não de screenshot.
 *
 * Se um dia precisar testar componente, aí sim entra jsdom +
 * @testing-library/react. Até lá, mantenha puro: é o que faz este setup
 * custar um arquivo.
 *
 * Como rodar:
 *   pnpm --filter @zappiq/web test
 *   pnpm --filter @zappiq/web test:watch
 * ══════════════════════════════════════════════════════════════════════ */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // content/** cobre os registros de Saiba mais e de "O que preencher aqui".
    // Ficaram de fora até 15/07/2026: o registro do Saiba mais tinha teste de
    // integridade desde sempre, mas como o include parava em stores/**, o CI
    // nunca o chamou. Teste que não roda não protege nada.
    include: ['app/**/*.test.ts', 'lib/**/*.test.ts', 'stores/**/*.test.ts', 'content/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.turbo/**'],
    testTimeout: 10_000,
    isolate: true,
  },
});
