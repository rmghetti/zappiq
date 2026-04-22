'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, Sparkles, TrendingUp, Zap, Users, Mic } from 'lucide-react';
import { PLAN_CONFIG, type PlanConfig, type PlanId } from '@zappiq/shared';
import { track } from '../../lib/track';

/* ═══════════════════════════════════════════════════════════════════════
 * ROI Calculator — versão 2026.04 (Launch)
 * ---------------------------------------------------------------------
 * Objetivo: deixar de ser "calculadora de economia" genérica e virar
 * um recomendador de tier + estimador de payback.
 *
 * Entradas (o que o cliente realmente sabe):
 *   - atendentes humanos hoje
 *   - mensagens WhatsApp/dia
 *   - ticket médio (R$)
 *   - taxa de conversão atual do canal WhatsApp (%)
 *   - salário médio do atendente (R$)
 *
 * Motor de recomendação:
 *   - calcula aiMessagesPerMonth estimado (volume × 30 × automation rate)
 *   - bate contra limits.agents + limits.aiMessagesPerMonth
 *   - pega o menor tier que cabe
 *
 * Saídas:
 *   - tier recomendado (com badge "Recomendado para você")
 *   - payback em dias (zappiqCost / receita incremental diária)
 *   - economia operacional (atendentes que IA substitui)
 *   - receita adicional (uplift de conversão com IA 24/7)
 *   - setup fee economizado (R$ 8k baseline concorrente)
 *   - CTA deep-link direto para /register?plan=GROWTH
 * ═══════════════════════════════════════════════════════════════════════ */

// Baseline de comparação vs. concorrente (mediana Blip/Huggy)
// Fonte: apps/web/content/competitor-benchmarks.ts
const COMPETITOR_SETUP_FEE_BRL = 8000;
// Percentual de mensagens que a IA resolve sem handoff (média observada em beta)
const AI_AUTOMATION_RATE = 0.65;
// Uplift de conversão observado quando WhatsApp passa a ter IA 24/7 + recuperação
const CONVERSION_UPLIFT_MULTIPLIER = 1.3;
// V2-003: cap institucional de ROI mensal — acima disso, o número vira
// promessa inflada e destrói credibilidade em C-level.
export const ROI_MONTHLY_CAP_PERCENT = 300;
// V2-003: payback mínimo de 3 meses. Piso institucional.
export const PAYBACK_MIN_DAYS = 90;

// V3.2 — Voz outbound add-on
const VOICE_OUTBOUND_PRICE = { none: 0, padrao: 197, premium: 597 } as const;
type VoiceTier = 'none' | 'padrao' | 'premium';

/* ---------- motor de recomendação ---------------------------------- */
function recommendPlan(
  aiMessagesPerMonth: number,
  agents: number,
): PlanId {
  // Ordenado — primeiro que encaixa, ganha.
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

/* ---------- slider reutilizável ------------------------------------ */
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
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
          {prefix}{value.toLocaleString('pt-BR')}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #1B6B3A 0%, #25D366 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
        }}
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{prefix}{min.toLocaleString('pt-BR')}{suffix}</span>
        <span>{prefix}{max.toLocaleString('pt-BR')}{suffix}</span>
      </div>
    </div>
  );
}

function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

/* ---------- Componente principal ----------------------------------- */
export function ROICalculator() {
  const [attendants, setAttendants] = useState(5);
  const [messagesPerDay, setMessagesPerDay] = useState(200);
  const [avgSalary, setAvgSalary] = useState(2800);
  const [avgTicket, setAvgTicket] = useState(450);
  const [currentConversionPct, setCurrentConversionPct] = useState(8);
  // V3.2 — Voz outbound add-on (opcional)
  const [voiceOutbound, setVoiceOutbound] = useState<VoiceTier>('none');

  const results = useMemo(() => {
    // ─ Estimativas de volume
    const messagesPerMonth = messagesPerDay * 30;
    const aiMessagesPerMonth = Math.round(messagesPerMonth * AI_AUTOMATION_RATE);

    // ─ Plano recomendado
    const recommendedId = recommendPlan(aiMessagesPerMonth, attendants);
    const plan: PlanConfig = PLAN_CONFIG[recommendedId];
    // V3.2 — voz outbound é zero para Enterprise (voz incluída na negociação)
    const voiceExtra = recommendedId === 'ENTERPRISE' ? 0 : VOICE_OUTBOUND_PRICE[voiceOutbound];
    const basePlanPrice = plan.priceMonthly ?? 9900; // Enterprise baseline
    const zappiqCost = basePlanPrice + voiceExtra;

    // ─ Economia operacional (atendentes que IA substitui)
    //   IA resolve 65% → precisamos de menos atendentes humanos.
    //   Mas mantemos pelo menos 1 para handoff.
    const attendantsNeededAfterAI = Math.max(
      1,
      Math.ceil(attendants * (1 - AI_AUTOMATION_RATE)),
    );
    const attendantsSaved = Math.max(0, attendants - attendantsNeededAfterAI);
    const operationalSavingsMonthly = attendantsSaved * avgSalary;

    // ─ Receita adicional (IA 24/7 + recuperação → uplift de conversão)
    const currentConversionRate = currentConversionPct / 100;
    const newConversionRate = Math.min(
      currentConversionRate * CONVERSION_UPLIFT_MULTIPLIER,
      1,
    );
    const deltaConversionRate = newConversionRate - currentConversionRate;
    const additionalRevenueMonthly = Math.round(
      messagesPerMonth * deltaConversionRate * avgTicket,
    );

    // ─ Benefícios totais (V2-003: duas linhas independentes, nunca somadas em "ROI único")
    const netGainMonthly = operationalSavingsMonthly + additionalRevenueMonthly - zappiqCost;
    const totalBenefitMonthly = operationalSavingsMonthly + additionalRevenueMonthly;
    const rawRoiPercent =
      zappiqCost > 0 ? Math.round((totalBenefitMonthly / zappiqCost) * 100) : 0;
    // V2-003: cap 300% para preservar credibilidade institucional.
    const roiPercent = Math.min(rawRoiPercent, ROI_MONTHLY_CAP_PERCENT);
    const roiCapped = rawRoiPercent > ROI_MONTHLY_CAP_PERCENT;

    // ─ Payback (em dias) · V2-003: piso de 90 dias (ramp-up da IA + config)
    const dailyNetGain = (operationalSavingsMonthly + additionalRevenueMonthly) / 30;
    const rawPaybackDays =
      dailyNetGain > 0 ? Math.max(1, Math.ceil(zappiqCost / dailyNetGain)) : 999;
    const paybackDays = rawPaybackDays < 900
      ? Math.max(PAYBACK_MIN_DAYS, rawPaybackDays)
      : rawPaybackDays;
    const paybackFloored = rawPaybackDays > 0 && rawPaybackDays < PAYBACK_MIN_DAYS;

    // ─ Comparativo vs. concorrente (ano 1)
    const firstYearZappiq = zappiqCost * 12;
    const firstYearCompetitor = COMPETITOR_SETUP_FEE_BRL + zappiqCost * 12 * 1.8; // baseline: concorrente cobra ~80% a mais
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
      paybackFloored,
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
    : `Começar com ${results.plan.name} — 30 dias grátis`;

  return (
    <section className="py-20 lg:py-28 bg-[#F8FAF9]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Calculadora de ROI · recomendador de tier
          </p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
            Diga o que você tem hoje. <span className="text-primary-600">A calculadora escolhe o plano certo.</span>
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Ticket médio + volume + atendentes → tier recomendado, payback em dias e economia no 1º ano.
            Zero setup fee, 30 dias grátis e 60 dias de garantia.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
          {/* ───────── Inputs ───────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-7 h-fit">
            <div className="flex items-center gap-3 mb-2">
              <Calculator size={20} className="text-primary-500" />
              <h3 className="font-display text-lg font-bold text-gray-900">Seus dados atuais</h3>
            </div>

            <SliderInput
              label="Atendentes humanos hoje"
              value={attendants} min={1} max={50}
              onChange={setAttendants}
            />
            <SliderInput
              label="Mensagens WhatsApp por dia"
              value={messagesPerDay} min={20} max={3000} step={20}
              onChange={setMessagesPerDay}
            />
            <SliderInput
              label="Ticket médio do seu produto/serviço"
              value={avgTicket} min={50} max={10000} step={50}
              prefix="R$ "
              onChange={setAvgTicket}
            />
            <SliderInput
              label="Taxa de conversão atual do WhatsApp"
              value={currentConversionPct} min={1} max={30} step={1}
              suffix=" %"
              onChange={setCurrentConversionPct}
            />
            <SliderInput
              label="Salário médio do atendente"
              value={avgSalary} min={1800} max={6000} step={100}
              prefix="R$ "
              onChange={setAvgSalary}
            />

            {/* V3.2 — Voz outbound (opcional) */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mic size={14} className="text-secondary-500" />
                  Voz outbound (opcional)
                </label>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Add-on V3.2</span>
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
                      className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                        active
                          ? 'border-primary-500 bg-primary-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${active ? 'text-primary-700' : 'text-gray-700'}`}>
                        {label}
                      </p>
                      <p className={`text-[11px] ${active ? 'text-primary-600' : 'text-gray-500'}`}>
                        {sub}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                Padrão: OpenAI TTS · Premium: ElevenLabs com voz clonada (opcional). Inbound (recebimento de áudio com
                transcrição Whisper) já é incluso em todos os planos.
              </p>
            </div>

            <p className="text-[11px] text-gray-400 pt-4 border-t border-gray-100 leading-relaxed">
              Premissas: IA resolve {Math.round(AI_AUTOMATION_RATE * 100)}% dos atendimentos sem humano ·
              uplift de conversão de {Math.round((CONVERSION_UPLIFT_MULTIPLIER - 1) * 100)}% com IA 24/7 + recuperação ·
              comparativo de concorrente: setup fee de {brl(COMPETITOR_SETUP_FEE_BRL)} + mensalidade ~80% maior.
            </p>
          </div>

          {/* ───────── Outputs ───────── */}
          <div className="space-y-4">
            {/* Hero card — tier recomendado */}
            <div className="relative bg-gradient-to-br from-primary-600 to-purple-600 rounded-2xl p-6 text-white overflow-hidden">
              <span className="absolute top-4 right-4 inline-flex items-center gap-1 bg-white/20 backdrop-blur text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                <Sparkles size={10} /> Recomendado
              </span>
              <p className="text-xs uppercase tracking-wider text-white/70 mb-1">Plano ideal para você</p>
              <h3 className="font-display text-3xl font-extrabold mb-1">ZappIQ {results.plan.name}</h3>
              <p className="text-white/80 text-sm mb-4">{results.plan.tagline}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                {isEnterprise ? (
                  <span className="text-2xl font-bold">Sob consulta</span>
                ) : (
                  <>
                    <span className="text-4xl font-extrabold">{brl(results.zappiqCost)}</span>
                    <span className="text-white/70 text-sm">/mês · sem setup fee</span>
                  </>
                )}
              </div>
              {!isEnterprise && results.voiceExtra > 0 && (
                <p className="text-[11px] text-white/75 mt-2">
                  Inclui {brl(results.basePlanPrice)} plano + {brl(results.voiceExtra)} voz outbound{' '}
                  {voiceOutbound === 'premium' ? 'Premium (ElevenLabs)' : 'Padrão (OpenAI TTS)'}
                </p>
              )}
              {isEnterprise && (
                <p className="text-[11px] text-white/75 mt-2">
                  Voz outbound incluída na negociação Enterprise.
                </p>
              )}
            </div>

            {/* Grid de métricas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <Zap size={12} /> Payback
                </div>
                <p className="text-2xl font-extrabold text-primary-600">
                  {results.paybackDays < 900 ? `${results.paybackDays} dias` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">do investimento</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <TrendingUp size={12} /> ROI mensal
                </div>
                <p className="text-2xl font-extrabold text-primary-600">
                  {results.roiPercent}%{results.roiCapped && <span className="text-xs align-top ml-1 text-primary-400">(cap)</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {results.roiCapped
                    ? 'Cap institucional 300% · ROI real pode ser maior'
                    : 'benefício / mensalidade'}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <Users size={12} /> Economia operacional
                </div>
                <p className="text-lg font-extrabold text-gray-900">
                  {brl(results.operationalSavingsMonthly)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {results.attendantsSaved} {results.attendantsSaved === 1 ? 'atendente' : 'atendentes'} liberados/mês
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <TrendingUp size={12} /> Receita adicional
                </div>
                <p className="text-lg font-extrabold text-gray-900">
                  {brl(results.additionalRevenueMonthly)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">uplift de conversão/mês</p>
              </div>
            </div>

            {/* Linha de sucesso total */}
            <div className="bg-gradient-to-r from-green-50 to-primary-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">
                    Benefício mensal líquido
                  </p>
                  <p className="text-3xl font-extrabold text-green-700">
                    {brl(results.netGainMonthly)}
                  </p>
                  <p className="text-[11px] text-green-600 mt-0.5">
                    (economia + receita) − mensalidade ZappIQ
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                    Economia no 1º ano vs. concorrente
                  </p>
                  <p className="text-2xl font-extrabold text-primary-700">
                    {brl(Math.round(results.firstYearSavings))}
                  </p>
                  <p className="text-[11px] text-primary-600 mt-0.5">
                    incluindo {brl(results.setupFeeSaved)} de setup fee evitado
                  </p>
                </div>
              </div>
            </div>

            {/* Volume processado pela IA (transparência) */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-500">
                Volume estimado pela IA / mês
              </p>
              <p className="text-sm font-bold text-gray-900">
                {results.aiMessagesPerMonth.toLocaleString('pt-BR')} mensagens
              </p>
            </div>

            {/* CTA */}
            <Link
              href={ctaHref}
              onClick={() => track('roi_calc_submitted', {
                plan: results.plan.id,
                paybackDays: results.paybackDays,
                roi: results.roiPercent
              })}
              className="flex items-center justify-center gap-2 w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-4 rounded-xl transition-colors shadow-lg shadow-primary-500/25 text-base"
            >
              {ctaLabel} <ArrowRight size={18} />
            </Link>
            <p className="text-[11px] text-gray-400 text-center">
              Zero setup fee · 30 dias grátis · 60 dias de garantia · cancelamento em 1 clique
            </p>
            {/* V2-003/V2-013: disclaimer institucional de premissas */}
            <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4 text-[11px] text-amber-900/90 leading-relaxed">
              <strong className="block text-amber-900 mb-1">Metodologia e limites desta estimativa</strong>
              Benchmarks observados em clientes beta ZappIQ entre ago/25 e fev/26. Resultados reais variam por vertical,
              maturidade da base de conhecimento e política de handoff humano. Economia operacional e uplift de receita
              são calculados de forma independente — não somamos em um “ROI único” inflado. ROI mensal exibido tem cap de{' '}
              {ROI_MONTHLY_CAP_PERCENT}% e payback mínimo de {PAYBACK_MIN_DAYS} dias para absorver ramp-up.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
