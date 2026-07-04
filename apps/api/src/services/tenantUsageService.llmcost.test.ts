import { describe, it, expect } from 'vitest';
import { llmCostSql } from './tenantUsageService.js';
it('soma cost_usd_estimate da llm_call_logs por org e janela', () => {
  const sql = llmCostSql();
  expect(sql).toMatch(/SUM\(cost_usd_estimate\)/);
  expect(sql).toMatch(/FROM llm_call_logs/);
  expect(sql).toMatch(/organization_id = \$1/);
  expect(sql).toMatch(/created_at >= \$2 AND created_at < \$3/);
});
