/* ══════════════════════════════════════════════════════════════════════════
 * Testimonials (Programa Fundadores): Design V4 (Chatbase-style)
 * --------------------------------------------------------------------------
 * FASE 4 P7+ (2026-05-18): alinhamento de oferta com /founders.
 * Antes: "50% off por 12 meses", divergia de /founders que dizia 30% vitalício.
 * Agora: 30% off vitalício (oferta única). CTA aponta pra /founders pra critérios
 * e aplicação formal (não mais pra /cadastro direto).
 * Fonte de verdade: apps/web/app/founders/page.tsx
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { ArrowRight, Sparkles, Users, Percent } from 'lucide-react';

const PERKS = [
  {
    icon: Percent,
    title: '30% off vitalício',
    description:
      'Desconto permanente em qualquer plano, enquanto seu contrato seguir ativo. Sem cliff no mês 13, sem reajuste promocional, preço congelado pra sempre.',
  },
  {
    icon: Users,
    title: 'Canal direto com os founders',
    description:
      'Slack privado com o time fundador. Resposta em até 1h em horário comercial. Vote em features de roadmap a cada trimestre.',
  },
  {
    icon: Sparkles,
    title: 'Badge permanente de Fundador',
    description:
      'Reconhecimento dentro da plataforma + early access a novos módulos com 60 dias de antecedência. Quem chega cedo, constrói junto.',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-bg-soft">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="eyebrow">Cohort Founders 2026 · 50 vagas</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            Entra no time fundador.{' '}
            <span className="text-grad">Preço congelado pra sempre.</span>
          </h2>
          <p className="text-[16px] text-muted leading-relaxed">
            50 vagas para empresas que adotam ZappIQ antes do resto do mercado acordar.
            Em troca do seu feedback qualificado, garantimos 30% de desconto vitalício, sem
            cliff, sem reajuste promocional, sem letra miúda.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 mb-10">
          {PERKS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="card-soft bg-white p-7 lg:p-8 hover:border-accent/30 transition-colors text-center"
              >
                <div
                  className="w-12 h-12 mx-auto rounded-[14px] flex items-center justify-center mb-5 shadow-[0_8px_16px_-8px_rgba(74,82,208,0.4)]"
                  style={{
                    background:
                      'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
                  }}
                >
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="text-[17px] font-medium text-ink mb-2 tracking-tight">
                  {p.title}
                </h3>
                <p className="text-[13.5px] text-muted leading-relaxed">{p.description}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Link href="/founders?utm_source=home_testimonials" className="btn btn-accent btn-lg">
            Ver critérios e aplicar <ArrowRight size={16} />
          </Link>
          <p className="text-[11.5px] text-muted mt-4">
            50 vagas · encerramos assim que a cohort fecha · 14 dias grátis no trial, sem cartão
          </p>
        </div>
      </div>
    </section>
  );
}
