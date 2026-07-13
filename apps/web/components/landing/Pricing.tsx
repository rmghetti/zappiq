'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * Pricing: Design V4 (5 tiers + toggles · Chatbase-style)
 * --------------------------------------------------------------------------
 * LÓGICA PRESERVADA 100%:
 *   - 4 planos ativos via listActivePlans() de @zappiq/shared (Iza Lite/Growth/Scale/Enterprise)
 *   - toggle anual (-20%) + seletor de add-ons (soma valor ao plano na hora)
 *   - Enterprise: voz incluída, Radar incluso, sob consulta
 *   - Card "Com vs Sem ZappIQ" no fim
 *
 * Visual novo: tier cards card-soft, featured com shadow-tier-feat,
 * tipografia Geist semibold, tokens var(--bg-soft) pra fundo, gradient
 * só no card destacado (highlight).
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Link from 'next/link';
import { type LucideIcon, Check, Radar, Sparkles, Megaphone, CalendarCheck, Mic, Phone } from 'lucide-react';
import { listActivePlans, ADDONS, getAnnualPrice, type PlanConfig } from '@zappiq/shared';

const PLANS: PlanConfig[] = listActivePlans();

/* Formata BRL: sem casas quando inteiro (R$ 247), com 2 casas quando tem
   centavos (R$ 79,90), pra o preço não virar "R$ 326,9" ao somar add-ons. */
function fmtBRL(v: number): string {
  return v % 1 === 0
    ? v.toLocaleString('pt-BR')
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Seletor de add-ons do Pricing. Valores conforme planConfig (ADDONS /
   ADDONS_V4_LIST, 13/07/2026). includedFor = planos onde o add-on já vem
   incluso (não soma no preço, aparece como "incluído" no card). */
type PricingAddon = {
  key: string;
  name: string;
  price: number;
  fromLabel?: boolean; // "a partir de" (pacotes com faixa de preço)
  icon: LucideIcon;
  includedFor: (p: PlanConfig) => boolean;
};

const PRICING_ADDONS: PricingAddon[] = [
  { key: 'radar', name: 'Radar 360° Pro', price: ADDONS.RADAR_360.priceMonthly ?? 397, icon: Radar, includedFor: (p) => p.features.radar360 },
  { key: 'impulso', name: 'Zap Impulso', price: 197, fromLabel: true, icon: Megaphone, includedFor: () => false },
  { key: 'agenda', name: 'Agendamento pela IA', price: 49, icon: CalendarCheck, includedFor: (p) => p.id !== 'IZA_LITE' },
  { key: 'voz', name: 'Voz Nativa', price: 79.9, fromLabel: true, icon: Mic, includedFor: (p) => p.id === 'ENTERPRISE' },
  { key: 'numero', name: 'Número WhatsApp extra', price: 137, icon: Phone, includedFor: () => false },
];

// V2-020 (Sprint 0 Blocker 6): seletor de Voz removido até julho/2026.
// Backend (Whisper STT + TTS) está em roadmap. Ver /roadmap pra timeline.
// Quando voltar (Q3): re-introduzir VOICE_OUTBOUND e toggle abaixo.

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const toggleAddon = (key: string) =>
    setSelectedAddons((s) => ({ ...s, [key]: !s[key] }));

  const computePrice = (plan: PlanConfig): number | null => {
    if (plan.priceMonthly === null) return null;
    return annual ? getAnnualPrice(plan) : plan.priceMonthly;
  };

  /* Valor mensal de um add-on pra um plano (0 se já incluso). Aplica o mesmo
     desconto anual do plano quando o toggle Anual está ligado. */
  const addonPriceFor = (addon: PricingAddon, plan: PlanConfig): number => {
    if (addon.includedFor(plan)) return 0;
    return annual ? addon.price * (1 - plan.annualDiscountPercent / 100) : addon.price;
  };

  const computeAddonsExtra = (plan: PlanConfig): number => {
    if (plan.priceMonthly === null) return 0;
    return PRICING_ADDONS.reduce(
      (sum, a) => (selectedAddons[a.key] ? sum + addonPriceFor(a, plan) : sum),
      0,
    );
  };

  return (
    <section id="precos" className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <span className="eyebrow">Preços claros · sem letra miúda</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-3">
            Um plano pra cada tamanho.{' '}
            <span className="text-grad">Sem pegadinha.</span>
          </h2>
          <p className="text-[16px] text-muted">
            14 dias grátis · sem fidelidade · você escolhe a forma de pagamento depois
          </p>
        </div>

        {/* Toggles */}
        <div className="flex flex-col items-center justify-center gap-4 mb-12">
          {/* Mensal/Anual */}
          <div className="flex items-center gap-3">
            <span className={`text-[13.5px] font-medium ${!annual ? 'text-ink' : 'text-muted'}`}>Mensal</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                annual ? 'bg-ink' : 'bg-line'
              }`}
              aria-label="Alternar entre mensal e anual"
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                  annual ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className={`text-[13.5px] font-medium ${annual ? 'text-ink' : 'text-muted'}`}>
              Anual{' '}
              <span className="text-[11px] font-semibold text-[#2FB57A] bg-[#2FB57A]/10 px-2 py-0.5 rounded-full ml-1">
                até −20%
              </span>
            </span>
          </div>

          {/* Seletor de add-ons: clicando, o preço de cada plano se ajusta na hora */}
          <div className="w-full max-w-4xl">
            <p className="text-center text-[13px] text-muted mb-3">
              Monte seu plano: adicione módulos e veja o preço se ajustar na hora.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {PRICING_ADDONS.map((a) => {
                const on = !!selectedAddons[a.key];
                const Icon = a.icon;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => toggleAddon(a.key)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-[12.5px] font-medium transition-colors ${
                      on
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-line bg-white text-muted hover:border-accent/40'
                    }`}
                  >
                    <Icon size={14} className={on ? 'text-accent' : 'text-muted'} />
                    {a.name}
                    <span className={on ? 'text-accent' : 'text-muted-2'}>
                      {a.fromLabel ? 'a partir de ' : '+'}R$ {fmtBRL(a.price)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-center text-[11px] text-muted-2 mt-2">
              Add-ons já inclusos no plano aparecem como "incluído", sem custo extra.
            </p>
          </div>
        </div>

        {/* Grid de 5 tiers · md:2-col / lg:5-col */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-3 max-w-7xl mx-auto">
          {PLANS.map((plan) => {
            const basePrice = computePrice(plan);
            const addonsExtra = computeAddonsExtra(plan);
            const totalPrice = basePrice !== null ? basePrice + addonsExtra : null;
            const addedAddons = PRICING_ADDONS.filter((a) => selectedAddons[a.key] && !a.includedFor(plan));
            const includedAddons = PRICING_ADDONS.filter((a) => selectedAddons[a.key] && a.includedFor(plan));
            const isEnterprise = plan.id === 'ENTERPRISE';
            const isHighlight = plan.highlight && !isEnterprise;

            return (
              <div
                key={plan.id}
                className={`rounded-[20px] p-6 relative transition-all flex flex-col ${
                  isEnterprise
                    ? 'text-white'
                    : 'bg-white'
                } ${
                  isHighlight
                    ? 'border-2 border-accent shadow-[0_30px_50px_-20px_rgba(74,82,208,0.25)]'
                    : isEnterprise
                      ? 'border-2 border-white/10'
                      : 'border border-line hover:border-accent/25 hover:shadow-card'
                }`}
                style={
                  isEnterprise
                    ? {
                        background: '#0A0B12',
                      }
                    : undefined
                }
              >
                {/* Badges */}
                {isHighlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-grad text-white text-[10.5px] font-semibold px-3 py-1 rounded-full tracking-wide">
                    Mais Popular
                  </div>
                )}
                {isEnterprise && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-grad text-white text-[10.5px] font-semibold px-3 py-1 rounded-full flex items-center gap-1 tracking-wide">
                    <Sparkles size={10} /> Premium
                  </div>
                )}

                <h3 className={`text-[17px] font-medium tracking-tight ${isEnterprise ? 'text-white' : 'text-ink'}`}>
                  {plan.name}
                </h3>
                <p className={`text-[11.5px] mb-4 leading-snug ${isEnterprise ? 'text-white/60' : 'text-muted'}`}>
                  {plan.tagline}
                </p>

                <div className="mb-5">
                  {annual && basePrice !== null && plan.priceMonthly !== null && (
                    <span className={`text-[13px] mr-2 line-through ${isEnterprise ? 'text-white/30' : 'text-muted/60'}`}>
                      R${plan.priceMonthly.toLocaleString('pt-BR')}
                    </span>
                  )}
                  {totalPrice !== null ? (
                    <>
                      <span className={`text-[28px] lg:text-[32px] font-semibold tracking-tight ${isEnterprise ? 'text-white' : 'text-ink'}`}>
                        R${fmtBRL(totalPrice)}
                      </span>
                      <span className={`text-[12px] ml-1 ${isEnterprise ? 'text-white/60' : 'text-muted'}`}>
                        /mês
                      </span>
                      {addedAddons.map((a) => {
                        const Icon = a.icon;
                        return (
                          <div key={a.key} className="text-[11px] text-accent mt-1 flex items-center gap-1">
                            <Icon size={10} /> +R$ {fmtBRL(addonPriceFor(a, plan))} {a.name}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <span className={`text-[11px] block mb-1 ${isEnterprise ? 'text-white/60' : 'text-muted'}`}>
                        a partir de
                      </span>
                      <span className={`text-[22px] font-semibold tracking-tight ${isEnterprise ? 'text-white' : 'text-ink'}`}>
                        Sob consulta
                      </span>
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-grow">
                  {plan.bullets.slice(0, 9).map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2 text-[11.5px] leading-snug ${isEnterprise ? 'text-white/80' : 'text-muted'}`}
                    >
                      <Check
                        size={12}
                        className={`flex-shrink-0 mt-0.5 ${isEnterprise ? 'text-[#2FB57A]' : 'text-[#2FB57A]'}`}
                        strokeWidth={2.5}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.bullets.length > 9 && (
                    <li className={`text-[11px] italic pl-4 ${isEnterprise ? 'text-white/50' : 'text-muted'}`}>
                      +{plan.bullets.length - 9} recursos adicionais
                    </li>
                  )}
                  {includedAddons.map((a) => {
                    const Icon = a.icon;
                    return (
                      <li key={a.key} className="flex items-start gap-2 text-[11px] text-accent bg-accent/5 rounded-[8px] px-2 py-1.5 border border-accent/15">
                        <Icon size={12} className="flex-shrink-0 mt-0.5 text-accent" />
                        <span className="font-medium">{a.name} incluído</span>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href={plan.cta.href}
                  className={`block w-full text-center py-2.5 rounded-[12px] text-[13px] font-medium transition-colors ${
                    isEnterprise
                      ? 'bg-white text-ink hover:bg-white/90'
                      : isHighlight
                        ? 'bg-ink text-white hover:bg-black'
                        : 'border border-line text-ink hover:border-ink'
                  }`}
                >
                  {plan.cta.label}
                </Link>
              </div>
            );
          })}
        </div>

        {/* CTA Radar */}
        <div className="mt-10 max-w-4xl mx-auto card-soft bg-white p-6 flex flex-col sm:flex-row items-start gap-4">
          <div
            className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-shrink-0 shadow-[0_8px_16px_-8px_rgba(74,82,208,0.4)]"
            style={{
              background: 'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
            }}
          >
            <Radar size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-[16px] font-medium text-ink tracking-tight mb-1">
              Radar 360° Pro · dashboards que viram decisão
            </h4>
            <p className="text-[13.5px] text-muted mb-3 leading-relaxed">
              Dashboards executivos, alertas quando algo foge do normal, previsão de vendas por IA
              e comparativo anônimo com o seu setor. Exporta pro Power BI ou Looker.{' '}
              <strong className="text-ink">Já vem incluso no Scale e no Enterprise.</strong>
            </p>
            <Link
              href="/observabilidade"
              className="text-[13px] font-medium text-accent hover:underline inline-flex items-center gap-1"
            >
              Conhecer o Radar 360° Pro →
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
