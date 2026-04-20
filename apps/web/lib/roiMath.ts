/**
 * ============================================================================
 * ROI Math — lógica pura extraída do ROICalculator (V2-003)
 * ============================================================================
 * Extrair deste arquivo a matemática do cálculo foi requisito V2-003: a
 * função precisa ser testável isoladamente (sem DOM, sem React).
 *
 * Cap institucional:
 *   - ROI mensal exibido ≤ 300%
 *   - Payback mínimo: 90 dias
 *   - Economia operacional e uplift de receita são linhas independentes
 *     (nunca somadas em "ROI único" inflado).
 * ============================================================================
 */

export const ROI_MONTHLY_CAP_PERCENT = 300;
export const PAYBACK_MIN_DAYS = 90;
export const COMPETITOR_SETUP_FEE_BRL = 8000;
export const AI_AUTOMATION_RATE = 0.65;
export const CONVERSION_UPLIFT_MULTIPLIER = 1.3;

export interface RoiInput {
  attendants: number;
  messagesPerDay: number;
  avgSalary: number;
  avgTicket: number;
  currentConversionPct: number;
  zappiqCost: number;          // mensalidade do tier recomendado
}

export interface RoiResult {
  aiMessagesPerMonth: number;
  attendantsSaved: number;
  /** Linha 1: economia de folha. Independente. */
  operationalSavingsMonthly: number;
  /** Linha 2: uplift de conversão. Independente. */
  additionalRevenueMonthly: number;
  totalBenefitMonthly: number;
  netGainMonthly: number;
  /** 0..300. Cap institucional. */
  roiPercent: number;
  roiCapped: boolean;
  paybackDays: number;
  paybackFloored: boolean;
  firstYearSavings: number;
}

export function computeRoi(input: RoiInput): RoiResult {
  const { attendants, messagesPerDay, avgSalary, avgTicket, currentConversionPct, zappiqCost } = input;

  // Volume
  const messagesPerMonth = messagesPerDay * 30;
  const aiMessagesPerMonth = Math.round(messagesPerMonth * AI_AUTOMATION_RATE);

  // Linha 1 — economia operacional (atendentes que IA substitui)
  const attendantsNeededAfterAI = Math.max(1, Math.ceil(attendants * (1 - AI_AUTOMATION_RATE)));
  const attendantsSaved = Math.max(0, attendants - attendantsNeededAfterAI);
  const operationalSavingsMonthly = attendantsSaved * avgSalary;

  // Linha 2 — receita adicional (uplift de conversão)
  const currentConversionRate = currentConversionPct / 100;
  const newConversionRate = Math.min(currentConversionRate * CONVERSION_UPLIFT_MULTIPLIER, 1);
  const deltaConversionRate = newConversionRate - currentConversionRate;
  const additionalRevenueMonthly = Math.round(messagesPerMonth * deltaConversionRate * avgTicket);

  // Totais
  const totalBenefitMonthly = operationalSavingsMonthly + additionalRevenueMonthly;
  const netGainMonthly = totalBenefitMonthly - zappiqCost;
  const rawRoiPercent = zappiqCost > 0 ? Math.round((totalBenefitMonthly / zappiqCost) * 100) : 0;
  const roiPercent = Math.min(rawRoiPercent, ROI_MONTHLY_CAP_PERCENT);
  const roiCapped = rawRoiPercent > ROI_MONTHLY_CAP_PERCENT;

  // Payback
  const dailyNetGain = totalBenefitMonthly / 30;
  const rawPaybackDays = dailyNetGain > 0 ? Math.max(1, Math.ceil(zappiqCost / dailyNetGain)) : 999;
  const paybackDays = rawPaybackDays < 900
    ? Math.max(PAYBACK_MIN_DAYS, rawPaybackDays)
    : rawPaybackDays;
  const paybackFloored = rawPaybackDays > 0 && rawPaybackDays < PAYBACK_MIN_DAYS;

  // Comparativo 1º ano
  const firstYearZappiq = zappiqCost * 12;
  const firstYearCompetitor = COMPETITOR_SETUP_FEE_BRL + zappiqCost * 12 * 1.8;
  const firstYearSavings = firstYearCompetitor - firstYearZappiq;

  return {
    aiMessagesPerMonth,
    attendantsSaved,
    operationalSavingsMonthly,
    additionalRevenueMonthly,
    totalBenefitMonthly,
    netGainMonthly,
    roiPercent,
    roiCapped,
    paybackDays,
    paybackFloored,
    firstYearSavings,
  };
}
