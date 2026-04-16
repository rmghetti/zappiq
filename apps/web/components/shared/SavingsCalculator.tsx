'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calculator, ArrowRight, Sparkles } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
 * Shared · SavingsCalculator
 *
 * Componente único de cálculo de economia vs. concorrentes. Reutilizado em:
 *   • /comparativo (variant="full")
 *   • Dashboard durante trial (variant="dashboard")
 *   • Onboarding step opcional (variant="compact")
 *
 * Filosofia: um único lugar de verdade para o pitch de economia. Alterar
 * pricing do Starter ou a baseline de comparação aqui propaga para todos
 * os pontos de contato automaticamente.
 * ═══════════════════════════════════════════════════════════════════════ */

export type SavingsCalculatorVariant = 'full' | 'dashboard' | 'compact';

export interface SavingsCalculatorProps {
  variant?: SavingsCalculatorVariant;
  /** Setup fee inicial do campo (R$). Default = 8000 (mediana das cotações Blip). */
  initialSetup?: number;
  /** Mensalidade inicial do campo (R$). Default = 1500. */
  initialMonthly?: number;
  /** Preço do tier de referência (R$/mês). Default = 247 (Starter). */
  zappiqMonthly?: number;
  /** Label customizado para o tier da ZappIQ. Default = "ZappIQ Starter". */
  zappiqTierLabel?: string;
  /** Mostrar CTA no final. Default depende da variant. */
  showCta?: boolean;
  /** Destino do CTA. Default = "/register". */
  ctaHref?: string;
  /** Texto do CTA. Default = "Começar 21 dias grátis". */
  ctaLabel?: string;
  /** Callback opcional — útil no dashboard para instrumentar clicks. */
  onCtaClick?: () => void;
  /** Título customizado. */
  title?: string;
  /** Subtítulo customizado. */
  subtitle?: string;
}

/* ------------------------------------------------------------------ */
/* Lógica pura — reutilizável em tests e no backend (email renderer)  */
/* ------------------------------------------------------------------ */

export function computeSavings(
  competitorSetup: number,
  competitorMonthly: number,
  zappiqMonthly: number = 247,
) {
  const firstYearCompetitor = Math.max(0, competitorSetup) + Math.max(0, competitorMonthly) * 12;
  const firstYearZappiq = Math.max(0, zappiqMonthly) * 12;
  const savings = Math.max(0, firstYearCompetitor - firstYearZappiq);
  const pctSavings = firstYearCompetitor > 0
    ? Math.round((savings / firstYearCompetitor) * 100)
    : 0;
  const monthlySavings = Math.round(savings / 12);
  return { firstYearCompetitor, firstYearZappiq, savings, pctSavings, monthlySavings };
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export function SavingsCalculator({
  variant = 'full',
  initialSetup = 8000,
  initialMonthly = 1500,
  zappiqMonthly = 247,
  zappiqTierLabel = 'ZappIQ Starter',
  showCta,
  ctaHref = '/register',
  ctaLabel = 'Começar 21 dias grátis',
  onCtaClick,
  title,
  subtitle,
}: SavingsCalculatorProps) {
  const [setup, setSetup] = useState(initialSetup);
  const [monthly, setMonthly] = useState(initialMonthly);

  const { firstYearCompetitor, firstYearZappiq, savings, pctSavings, monthlySavings } =
    computeSavings(setup, monthly, zappiqMonthly);

  const ctaVisible = showCta ?? (variant !== 'full'); // em /comparativo já existe CTA externo
  const compact = variant === 'compact';
  const dashboard = variant === 'dashboard';

  const effectiveTitle =
    title ??
    (dashboard
      ? 'Quanto você já está economizando'
      : compact
      ? 'Economize agora'
      : 'Calculadora de economia no 1º ano');

  const effectiveSubtitle =
    subtitle ??
    (dashboard
      ? 'Baseado na cotação que você recebeu dos concorrentes. Ajuste os valores.'
      : compact
      ? 'Sliders abaixo. Número real em segundos.'
      : 'Ajuste os números do concorrente que você cotou.');

  return (
    <div
      className={
        dashboard
          ? 'bg-gradient-to-br from-primary-50 via-white to-purple-50 rounded-2xl border border-primary-200 shadow-sm p-6'
          : 'bg-white rounded-2xl border border-gray-200 shadow-xl p-8'
      }
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            dashboard ? 'bg-white' : 'bg-primary-50'
          }`}
        >
          <Calculator className="text-primary-600" size={22} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{effectiveTitle}</h3>
          <p className="text-xs text-gray-500">{effectiveSubtitle}</p>
        </div>
        {dashboard && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary-600 text-white px-2 py-1 rounded">
            <Sparkles size={10} /> Sem setup fee
          </span>
        )}
      </div>

      {/* Inputs */}
      <div className={`grid ${compact ? 'grid-cols-1' : 'md:grid-cols-2'} gap-6 mb-6`}>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Setup fee do concorrente
          </span>
          <div className="mt-2 flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-gray-500 text-sm">R$</span>
            <input
              type="number"
              value={setup}
              onChange={(e) => setSetup(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 bg-transparent outline-none text-gray-900 font-semibold"
              min={0}
              step={500}
            />
          </div>
          <input
            type="range"
            min={0}
            max={30000}
            step={500}
            value={setup}
            onChange={(e) => setSetup(Number(e.target.value))}
            className="w-full mt-2 accent-primary-500"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Mensalidade do concorrente
          </span>
          <div className="mt-2 flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-gray-500 text-sm">R$</span>
            <input
              type="number"
              value={monthly}
              onChange={(e) => setMonthly(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 bg-transparent outline-none text-gray-900 font-semibold"
              min={0}
              step={50}
            />
          </div>
          <input
            type="range"
            min={199}
            max={5000}
            step={50}
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
            className="w-full mt-2 accent-primary-500"
          />
        </label>
      </div>

      {/* Resultado */}
      <div
        className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-4 p-5 rounded-xl ${
          dashboard
            ? 'bg-white border border-primary-100'
            : 'bg-gradient-to-r from-primary-50 to-purple-50'
        }`}
      >
        {!compact && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
              Concorrente (ano 1)
            </p>
            <p className="text-lg font-bold text-gray-900">
              R$ {firstYearCompetitor.toLocaleString('pt-BR')}
            </p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
            {zappiqTierLabel} (ano 1)
          </p>
          <p className="text-lg font-bold text-gray-900">
            R$ {firstYearZappiq.toLocaleString('pt-BR')}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-primary-600 uppercase mb-1">
            Sua economia
          </p>
          <p className="text-lg font-extrabold text-primary-700">
            R$ {savings.toLocaleString('pt-BR')}
          </p>
          <p className="text-[11px] font-semibold text-primary-600">
            {pctSavings}% menor
            {dashboard && monthlySavings > 0 && (
              <> · R$ {monthlySavings.toLocaleString('pt-BR')}/mês</>
            )}
          </p>
        </div>
      </div>

      {ctaVisible && (
        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-gray-400">
            * Baseline: {zappiqTierLabel} · R$ {zappiqMonthly.toLocaleString('pt-BR')}/mês · R$ 0 de setup.
          </p>
          <Link
            href={ctaHref}
            onClick={onCtaClick}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
          >
            {ctaLabel} <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {!ctaVisible && !compact && (
        <p className="text-xs text-gray-400 mt-4">
          * Baseline conservador: {zappiqTierLabel} R$ {zappiqMonthly.toLocaleString('pt-BR')}/mês × 12 + R$ 0 de setup. Para volumes maiores, considere Growth (R$ 797) ou Scale (R$ 1.697).
        </p>
      )}
    </div>
  );
}
