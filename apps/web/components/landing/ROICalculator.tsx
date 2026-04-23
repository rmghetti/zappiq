'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * ROICalculator — Design V4 (Chatbase-style)
 * --------------------------------------------------------------------------
 * LÓGICA PRESERVADA 100% · apenas restyle:
 *   - recommendPlan() + caps V2-003 (ROI ≤300%, payback ≥90d)
 *   - 5 sliders + voice outbound tier
 *   - hero tier recomendado + 4 métricas + net gain + 1º ano + volume IA
 *   - disclaimer metodológico
 *
 * Tipografia Geist, cards card-soft, gradient g→b→p no hero de tier,
 * slider com fill gradient custom.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, Sparkles, TrendingUp, Zap, Users, Mic } from 'lucide-react';
import { PLAN_CONFIG, type PlanConfig, type PlanId } from '@zappiq/shared';
import { track } from '../../lib/track';

/* ───────── constantes institucionais (preservadas V3.2) ───────── */
const COMPETITOR_SETUP_FEE_BRL = 8000;
const AI_AUTOMATION_RATE = 0.65;
const CONVERSION_UPLIFT_MULTIPLIER = 1.3;
export const ROI_MONTHLY_CAP_PERCENT = 300;
export const PAYBACK_MIN_DAYS = 90;

const VOICE_OUTBOUND_PRICE = { none: 0, padrao: 197, premium: 597 } as const;
type VoiceTier = 'none' | 'padrao' | 'premium';

function recommendPlan(aiMessagesPerMonth: number, agents: number): PlanId {
  const tryOrder: PlanId[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];
  for (const id of tryOrder) {
    const limits = PLAN_CONFIG[id].limits;
    const fitsAi =
      limits.aiMessagesPerMonth === -1 || aiMessagesPerMonth <= limits.aiMessagesPerMonth;
    const fitsAgents = limits.agents === -1 || agents <= limits.agents;
    if (fitsAi && fitsAgents) return id;
  }
  return 'ENTERPRISE';
}

function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

/* ───────── Slider com fill gradient V4 ───────── */
interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}

function SliderInput({ label, value, min, max, step = 1, prefix = '', suffix = '', onChange }: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[13px] font-medium text-ink">{label}</label>
        <span className="text-[12.5px] font-mono font-semibold text-ink bg-bg-soft border border-line px-2.5 py-1 rounded-[8px]">
          {prefix}
          {value.toLocaleString('pt-BR')}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #2FB57A 0%, #4A52D0 ${percentage}%, #E5E4DE ${percentage}%, #E5E4DE 100%)`,
        }}
      />
      <div className="flex justify-between text-[10px] text-muted mt-1">
        <span>
          {prefix}
          {min.toLocaleString('pt-BR')}
          {suffix}
        </span>
        <span>
          {prefix}
          {max.toLocaleString('pt-BR')}
          {suffix}
        </span>
      </div>
    </div>
  );
}

/* ───────── Componente principal ───────── */
export function ROICalculator() {
  const [attendants, setAttendants] = useState(5);
  const [messagesPerDay, setMessagesPerDay] = useState(200);
  const [avgSalary, setAvgSalary] = useState(2800);
  const [avgTicket, setAvgTicket] = useState(450);
  const [currentConversionPct, setCurrentConversionPct] = useState(8);
  const [voiceOutbound, setVoiceOutbound] = useState<VoiceTier>('none');

  const results = useMemo(() => {
    const messagesPerMonth = messagesPerDay * 30;
    const aiMessagesPerMonth = Math.round(messagesPerMonth * AI_AUTOMATION_RATE);

    const recommendedId = recommendPlan(aiMessagesPerMonth, attendants);
    const plan: PlanConfig = PLAN_CONFIG[recommendedId];
    const voiceExtra = recommendedId === 'ENTERPRISE' ? 0 : VOICE_OUTBOUND_PRICE[voiceOutbound];
    const basePlanPrice = plan.priceMonthly ?? 9900;
    const zappiqCost = basePlanPrice + voiceExtra;

    const attendantsNeededAfterAI = Math.max(
      1,
      Math.ceil(attendants * (1 - AI_AUTOMATION_RATE)),
    );
    const attendantsSaved = Math.max(0, attendants - attendantsNeededAfterAI);
    const operationalSavingsMonthly = attendantsSaved * avgSalary;

    const currentConversionRate = currentConversionPct / 100;
    const newConversionRate = Math.min(currentConversionRate * CONVERSION_UPLIFT_MULTIPLIER, 1);
    const deltaConversionRate = newConversionRate - currentConversionRate;
    const additionalRevenueMonthly = Math.round(
      messagesPerMonth * deltaConversionRate * avgTicket,
    );

    const netGainMonthly = operationalSavingsMonthly + additionalRevenueMonthly - zappiqCost;
    const totalBenefitMonthly = operationalSavingsMonthly + additionalRevenueMonthly;
    const rawRoiPercent =
      zappiqCost > 0 ? Math.round((totalBenefitMonthly / zappiqCost) * 100) : 0;
    const roiPercent = Math.min(rawRoiPercent, ROI_MONTHLY_CAP_PERCENT);
    const roiCapped = rawRoiPercent > ROI_MONTHLY_CAP_PERCENT;

    const dailyNetGain = totalBenefitMonthly / 30;
    const rawPaybackDays =
      dailyNetGain > 0 ? Math.max(1, Math.ceil(zappiqCost / dailyNetGain)) : 999;
    const paybackDays = rawPaybackDays < 900
      ? Math.max(PAYBACK_MIN_DAYS, rawPaybackDays)
      : rawPaybackDays;

    const firstYearZappiq = zappiqCost * 12;
    const firstYearCompetitor = COMPETITOR_SETUP_FEE_BRL + zappiqCost * 12 * 1.8;
    const setupFeeSaved = COMPETITOR_SETUP_FEE_BRL;
    const firstYearSavings = firstYearCompetitor - firstYearZappiq;

    return {
      plan,
      zappiqCost,
      basePlanPrice,
      voiceExtra,
      aiMessagesPerMonth,
      attendantsSaved,
      operationalSavingsMonthly,
      additionalRevenueMonthly,
      totalBenefitMonthly,
      netGainMonthly,
      roiPercent,
      roiCapped,
      paybackDays,
      setupFeeSaved,
      firstYearSavings,
    };
  }, [attendants, messagesPerDay, avgSalary, avgTicket, currentConversionPct, voiceOutbound]);

  const isEnterprise = results.plan.id === 'ENTERPRISE';
  const ctaHref = isEnterprise
    ? '/enterprise'
    : `/register?plan=${results.plan.id}&utm_source=roi_calc`;
  const ctaLabel = isEnterprise
    ? 'Falar com especialista'
    : `Começar com ${results.plan.name} — 14 dias grátis`;

  return (
    <section className="py-20 lg:py-28 bg-bg-soft">
      <div className="zappiq-wrap">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <span className="eyebrow">Calculadora de ROI · recomendador de tier</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-3">
            Diga o que você tem hoje.{' '}
            <span className="text-grad">A calculadora escolhe o plano certo.</span>
          </h2>
          <p className="text-[16px] text-muted leading-relaxed">
            Ticket médio + volume + atendentes → tier recomendado, payback em dias
            e economia no 1º ano. Zero setup fee, 14 dias grátis, sem fidelidade.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* ────── Inputs ────── */}
          <div className="card-soft bg-white p-7 lg:p-8 space-y-6 h-fit">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-[10px] bg-bg-soft border border-line flex items-center justify-center">
                <Calculator size={16} className="text-ink" />
              </div>
              <h3 className="text-[17px] font-medium text-ink tracking-tight">Seus dados atuais</h3>
            </div>

            <SliderInput
              label="Atendentes humanos hoje"
              value={attendants}
              min={1}
              max={50}
              onChange={setAttendants}
            />
            <SliderInput
              label="Mensagens WhatsApp por dia"
              value={messagesPerDay}
              min={20}
              max={3000}
              step={20}
              onChange={setMessagesPerDay}
            />
            <SliderInput
              label="Ticket médio do produto/serviço"
              value={avgTicket}
              min={50}
              max={10000}
              step={50}
              prefix="R$ "
              onChange={setAvgTicket}
            />
            <SliderInput
              label="Taxa de conversão atual WhatsApp"
              value={currentConversionPct}
              min={1}
              max={30}
              step={1}
              suffix=" %"
              onChange={setCurrentConversionPct}
            />
            <SliderInput
              label="Salário médio do atendente"
              value={avgSalary}
              min={1800}
              max={6000}
              step={100}
              prefix="R$ "
              onChange={setAvgSalary}
            />

            {/* Voz outbound */}
            <div className="pt-4 border-t border-line">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[13px] font-medium text-ink flex items-center gap-1.5">
                  <Mic size={13} className="text-accent" />
                  Voz outbound (opcional)
                </label>
                <span className="text-[10px] text-muted uppercase tracking-[0.12em] font-semibold">
                  Add-on V3.2
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['none', 'padrao', 'premium'] as const).map((tier) => {
                  const active = voiceOutbound === tier;
                  const label = tier === 'none' ? 'Sem voz' : tier === 'padrao' ? 'Padrão' : 'Premium';
                  const sub = tier === 'none'
                    ? 'R$ 0'
                    : tier === 'padrao'
                      ? 'R$ 197 · 30min'
                      : 'R$ 597 · 120min';
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setVoiceOutbound(tier)}
                      className={`rounded-[10px] border px-3 py-2.5 text-left transition-all ${
                        active
                          ? 'border-accent bg-accent/5 shadow-soft'
                          : 'border-line bg-white hover:border-ink/30'
                      }`}
                    >
                      <p className={`text-[12.5px] font-semibold ${active ? 'text-accent' : 'text-ink'}`}>
                        {label}
                      </p>
                      <p className={`text-[10.5px] ${active ? 'text-accent/80' : 'text-muted'}`}>
                        {sub}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-muted mt-2 leading-relaxed">
                Padrão: OpenAI TTS · Premium: ElevenLabs (voz clonada opcional).
                Inbound (Whisper) incluso em todos os planos.
              </p>
            </div>

            <p className="text-[10.5px] text-muted pt-4 border-t border-line leading-relaxed">
              <strong className="text-ink">Premissas:</strong> IA resolve {Math.round(AI_AUTOMATION_RATE * 100)}% dos atendimentos sem humano ·
              uplift de {Math.round((CONVERSION_UPLIFT_MULTIPLIER - 1) * 100)}% com IA 24/7 ·
              concorrente: setup de {brl(COMPETITOR_SETUP_FEE_BRL)} + mensalidade ~80% maior.
            </p>
          </div>

          {/* ────── Outputs ────── */}
          <div className="space-y-4">
            {/* Hero tier recomendado */}
            <div
              className="relative rounded-[20px] p-7 text-white overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
                boxShadow: '0 30px 60px -20px rgba(74,82,208,.35)',
              }}
            >
              <span className="absolute top-4 right-4 inline-flex items-center gap-1 bg-white/20 backdrop-blur text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full">
                <Sparkles size={10} /> Recomendado
              </span>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/75 mb-1.5 font-semibold">
                Plano ideal para você
              </p>
              <h3 className="text-[32px] lg:text-[36px] font-semibold tracking-tight mb-1 leading-none">
                ZappIQ {results.plan.name}
              </h3>
              <p className="text-white/85 text-[13px] mb-5">{results.plan.tagline}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                {isEnterprise ? (
                  <span className="text-[24px] font-semibold">Sob consulta</span>
                ) : (
                  <>
                    <span className="text-[40px] font-semibold tracking-tight leading-none">
                      {brl(results.zappiqCost)}
                    </span>
                    <span className="text-white/80 text-[13px]">/mês · sem setup fee</span>
                  </>
                )}
              </div>
              {!isEnterprise && results.voiceExtra > 0 && (
                <p className="text-[11px] text-white/80 mt-2">
                  Inclui {brl(results.basePlanPrice)} plano + {brl(results.voiceExtra)} voz{' '}
                  {voiceOutbound === 'premium' ? 'Premium (ElevenLabs)' : 'Padrão (OpenAI TTS)'}
                </p>
              )}
              {isEnterprise && (
                <p className="text-[11px] text-white/80 mt-2">
                  Voz outbound incluída na negociação Enterprise.
                </p>
              )}
            </div>

            {/* Grid de 4 métricas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card-soft bg-white p-5">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold text-muted uppercase tracking-[0.12em]">
                  <Zap size={11} className="text-accent" /> Payback
                </div>
                <p className="text-[26px] font-semibold text-ink tracking-tight leading-none">
                  {results.paybackDays < 900 ? `${results.paybackDays} dias` : '—'}
                </p>
                <p className="text-[11px] text-muted mt-1">do investimento</p>
              </div>

              <div className="card-soft bg-white p-5">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold text-muted uppercase tracking-[0.12em]">
                  <TrendingUp size={11} className="text-accent" /> ROI mensal
                </div>
                <p className="text-[26px] font-semibold text-ink tracking-tight leading-none">
                  {results.roiPercent}%
                  {results.roiCapped && <span className="text-[11px] align-top ml-1 text-muted font-normal">(cap)</span>}
                </p>
                <p className="text-[11px] text-muted mt-1">
                  {results.roiCapped ? 'Cap institucional 300%' : 'benefício / mensalidade'}
                </p>
              </div>

              <div className="card-soft bg-white p-5">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold text-muted uppercase tracking-[0.12em]">
                  <Users size={11} className="text-accent" /> Economia op.
                </div>
                <p className="text-[20px] font-semibold text-ink tracking-tight leading-none">
                  {brl(results.operationalSavingsMonthly)}
                </p>
                <p className="text-[11px] text-muted mt-1">
                  {results.attendantsSaved} {results.attendantsSaved === 1 ? 'atendente liberado' : 'atendentes liberados'}/mês
                </p>
              </div>

              <div className="card-soft bg-white p-5">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold text-muted uppercase tracking-[0.12em]">
                  <TrendingUp size={11} className="text-accent" /> Receita adicional
                </div>
                <p className="text-[20px] font-semibold text-ink tracking-tight leading-none">
                  {brl(results.additionalRevenueMonthly)}
                </p>
                <p className="text-[11px] text-muted mt-1">uplift de conversão/mês</p>
              </div>
            </div>

            {/* Net gain + 1º ano */}
            <div
              className="rounded-[16px] border border-line p-5 bg-white"
              style={{
                background:
                  'linear-gradient(135deg, rgba(47,181,122,.06) 0%, rgba(74,82,208,.06) 100%)',
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-[#2FB57A] uppercase tracking-[0.12em] mb-1">
                    Benefício mensal líquido
                  </p>
                  <p className="text-[30px] font-semibold text-ink tracking-tight leading-none">
                    {brl(results.netGainMonthly)}
                  </p>
                  <p className="text-[11px] text-muted mt-1">(economia + receita) − mensalidade</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-accent uppercase tracking-[0.12em] mb-1">
                    Economia no 1º ano vs. concorrente
                  </p>
                  <p className="text-[22px] font-semibold text-ink tracking-tight leading-none">
                    {brl(Math.round(results.firstYearSavings))}
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    incluindo {brl(results.setupFeeSaved)} de setup fee evitado
                  </p>
                </div>
              </div>
            </div>

            {/* Volume IA */}
            <div className="flex items-center justify-between card-soft bg-white px-5 py-3">
              <p className="text-[12px] text-muted">Volume estimado pela IA/mês</p>
              <p className="text-[13.5px] font-mono font-semibold text-ink">
                {results.aiMessagesPerMonth.toLocaleString('pt-BR')} mensagens
              </p>
            </div>

            {/* CTA */}
            <Link
              href={ctaHref}
              onClick={() =>
                track('roi_calc_submitted', {
                  plan: results.plan.id,
                  paybackDays: results.paybackDays,
                  roi: results.roiPercent,
                })
              }
              className="btn btn-accent btn-lg w-full justify-center"
            >
              {ctaLabel} <ArrowRight size={16} />
            </Link>
            <p className="text-[11px] text-muted text-center">
              Zero setup fee · 14 dias grátis · sem fidelidade · cancelamento em 1 clique
            </p>

            {/* Disclaimer metodológico */}
            <div className="rounded-[12px] bg-[#FEF9C3]/40 border border-[#FDE68A]/70 p-4 text-[11px] text-[#78350F] leading-relaxed">
              <strong className="block text-[#78350F] mb-1">Metodologia e limites desta estimativa</strong>
              Benchmarks observados em clientes beta ZappIQ entre ago/25 e fev/26. Resultados reais variam por vertical,
              maturidade da base de conhecimento e política de handoff. Economia operacional e uplift de receita são
              calculados independentes — não somamos em "ROI único" inflado. ROI mensal tem cap de {ROI_MONTHLY_CAP_PERCENT}%,
              payback mínimo de {PAYBACK_MIN_DAYS} dias para absorver ramp-up.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
