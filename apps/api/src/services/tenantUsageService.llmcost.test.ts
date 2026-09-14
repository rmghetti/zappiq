import { describe, it, expect } from 'vitest';
import { llmCostSql } from './tenantUsageService.js';
it('soma cost_usd_estimate da llm_call_logs por org e janela', () => {
  const sql = llmCostSql();
  expect(sql).toMatch(/SUM\(cost_usd_estimate\)/);
  expect(sql).toMatch(/FROM llm_call_logs/);
  expect(sql).toMatch(/organization_id = \$1/);
  expect(sql).toMatch(/created_at >= \$2 AND created_at < \$3/);
});

it("não cobra do cliente o teste da Qualidade (operation 'eval')", () => {
  // O eval é gasto de bastidor da casa: cerca de USD 60 em 90 dias, contra
  // cerca de USD 10 de TODO o atendimento real. Somá-lo ao custo do tenant
  // multiplicaria o custo aparente dele e envenenaria a margem do painel.
  expect(llmCostSql()).toMatch(/operation <> 'eval'/);
});
