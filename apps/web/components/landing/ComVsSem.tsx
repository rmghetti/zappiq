'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * ComVsSem — Seção standalone V5 (promovida de dentro do Pricing)
 * --------------------------------------------------------------------------
 * Comparativo lado-a-lado: "Como é hoje" vs "Como fica com ZappIQ".
 * Posição: entre PorQueZappIQ e OnboardingZero. Tom "diga na lata",
 * números humanos, card-soft Chatbase-style. Gradient g→b→p no card ZappIQ.
 * ══════════════════════════════════════════════════════════════════════════ */

import { X as XIcon, Check } from 'lucide-react';
import { listPlans } from '@zappiq/shared';

const STARTER_PRICE = listPlans()[0]?.priceMonthly ?? 197;

const COMPARISON = [
  {
    without: '5 atendentes pra dar conta do volume',
    with: 'A Iza atende 24/7 + 1 atendente pro que importa',
  },
  {
    without: `R$ 15.000 por mês só de folha`,
    with: `A partir de R$ ${STARTER_PRICE} por mês`,
  },
  {
    without: 'Cliente espera 2 horas pra ter resposta',
    with: 'Cliente tem resposta em 30 segundos',
  },
  {
    without: '40% dos leads somem antes da 1ª resposta',
    with: '60% a mais de conversão no mesmo volume',
  },
];

export function ComVsSem() {
  return (
    <section id="com-vs-sem" className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Antes e depois</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            Como é hoje.{' '}
            <span className="text-grad">Como fica com ZappIQ.</span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-muted leading-relaxed">
            A conta é simples. Menos folha, menos espera, mais venda. A gente não
            inventou mágica — só tirou o atrito do caminho.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 lg:gap-6 max-w-5xl mx-auto">
          {/* Sem ZappIQ */}
          <div className="card-soft p-8 lg:p-9 relative bg-[#FEF3F2]/30 border-[#FECDD3]/60">
            <div className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-[#FEF3F2] border border-[#FECDD3] text-[11px] font-semibold text-[#B42318] tracking-wide">
              Como é hoje
            </div>
            <h3 className="text-[18px] font-medium text-[#B42318] mb-6 flex items-center gap-2 tracking-tight mt-2">
              <XIcon size={18} strokeWidth={2.5} /> Sem ZappIQ
            </h3>
            <ul className="space-y-4">
              {COMPARISON.map((c) => (
                <li key={c.without} className="flex items-start gap-3 text-[14px] text-muted leading-snug">
                  <div className="w-6 h-6 bg-[#FEF3F2] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <XIcon size={11} className="text-[#B42318]" strokeWidth={3} />
                  </div>
                  <span>{c.without}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Com ZappIQ */}
          <div
            className="rounded-[20px] p-8 lg:p-9 text-white relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
              boxShadow:
                '0 30px 60px -20px rgba(74,82,208,.35), 0 0 0 1px rgba(255,255,255,.08) inset',
            }}
          >
            <div className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-white text-[11px] font-semibold text-accent tracking-wide shadow-sm">
              Como fica com ZappIQ
            </div>
            <h3 className="text-[18px] font-medium text-white mb-6 flex items-center gap-2 tracking-tight mt-2">
              <Check size={18} strokeWidth={2.5} /> Com ZappIQ
            </h3>
            <ul className="space-y-4">
              {COMPARISON.map((c) => (
                <li key={c.with} className="flex items-start gap-3 text-[14px] text-white/95 leading-snug">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
                    <Check size={11} className="text-white" strokeWidth={3} />
                  </span>
                  <span>{c.with}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
