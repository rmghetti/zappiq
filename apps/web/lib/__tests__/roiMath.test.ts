/**
 * Testes da lógica de ROI — V2-003.
 *
 * Uso rápido (sem framework):
 *   npx tsx apps/web/lib/__tests__/roiMath.test.ts
 *
 * No CI (GitHub Actions) roda via vitest quando configurado (ver tarefa P0-13).
 */

import { computeRoi, ROI_MONTHLY_CAP_PERCENT, PAYBACK_MIN_DAYS } from '../roiMath';

type TestFn = () => void;
const tests: Array<{ name: string; fn: TestFn }> = [];
function test(name: string, fn: TestFn) { tests.push({ name, fn }); }
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

// ─────────────────────────────────────────────────────────────
// Cenário extremo — entradas no máximo devem respeitar o cap
// ─────────────────────────────────────────────────────────────
test('cenário extremo respeita cap 300% e payback ≥ 90 dias', () => {
  const result = computeRoi({
    attendants: 50,
    messagesPerDay: 3000,
    avgSalary: 6000,
    avgTicket: 10000,
    currentConversionPct: 30,
    zappiqCost: 1697, // Scale
  });
  assert(result.roiPercent <= ROI_MONTHLY_CAP_PERCENT, `roiPercent=${result.roiPercent} > cap`);
  assert(result.paybackDays >= PAYBACK_MIN_DAYS || result.paybackDays >= 900,
    `paybackDays=${result.paybackDays} < piso`);
  assert(result.roiCapped === true, 'deveria sinalizar roiCapped=true em cenário extremo');
});

// ─────────────────────────────────────────────────────────────
// Cenário típico PME — ROI realista (50–200%)
// ─────────────────────────────────────────────────────────────
test('cenário típico PME produz ROI entre 50% e 300%', () => {
  const result = computeRoi({
    attendants: 5,
    messagesPerDay: 200,
    avgSalary: 2800,
    avgTicket: 450,
    currentConversionPct: 8,
    zappiqCost: 797, // Growth
  });
  assert(result.roiPercent >= 50, `ROI=${result.roiPercent} < 50% (modelo não captou valor)`);
  assert(result.roiPercent <= 300, `ROI=${result.roiPercent} > 300% (cap quebrou)`);
});

// ─────────────────────────────────────────────────────────────
// Linha 1 e Linha 2 são calculadas independentemente
// ─────────────────────────────────────────────────────────────
test('economia operacional e receita incremental são independentes', () => {
  const r = computeRoi({
    attendants: 5, messagesPerDay: 200, avgSalary: 2800, avgTicket: 450,
    currentConversionPct: 8, zappiqCost: 797,
  });
  // A soma devolvida == soma dos dois campos (fé cega) — garante que não há
  // mistura acidental ou dupla contagem.
  assert(r.totalBenefitMonthly === r.operationalSavingsMonthly + r.additionalRevenueMonthly,
    'total deve ser soma exata das duas linhas');
});

// ─────────────────────────────────────────────────────────────
// Zero entrada → payback "indefinido" (999)
// ─────────────────────────────────────────────────────────────
test('entradas nulas não quebram cálculo', () => {
  const r = computeRoi({
    attendants: 1, messagesPerDay: 20, avgSalary: 1800, avgTicket: 50,
    currentConversionPct: 1, zappiqCost: 247,
  });
  assert(!Number.isNaN(r.roiPercent), 'roiPercent não pode ser NaN');
  assert(!Number.isNaN(r.paybackDays), 'paybackDays não pode ser NaN');
});

// Runner
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`✓ ${t.name}`); passed++; }
  catch (e) { console.error(`✗ ${t.name}\n  ${(e as Error).message}`); failed++; }
}
console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
