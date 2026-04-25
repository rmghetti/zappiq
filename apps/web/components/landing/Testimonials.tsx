/* ══════════════════════════════════════════════════════════════════════════
 * Testimonials (Programa Fundadores) — Design V4 (Chatbase-style)
 * --------------------------------------------------------------------------
 * Seção de early adopters. 3 perks (50% off 12m, canal direto founders,
 * badge permanente). Removi "30 dias grátis" — agora 14 dias grátis.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { ArrowRight, Sparkles, Users, Percent } from 'lucide-react';

const PERKS = [
  {
    icon: Percent,
    title: '50% off por 12 meses',
    description:
      'Metade do preço no primeiro ano. Cupom exclusivo para fundadores. Depois de 12 meses, tabela normal.',
  },
  {
    icon: Users,
    title: 'Acesso direto ao time',
    description:
      'Canal privado com os founders. Influencie o roadmap e priorize features que importam pro seu negócio.',
  },
  {
    icon: Sparkles,
    title: 'Badge de Fundador',
    description:
      'Reconhecimento permanente na plataforma. Quem entra antes, constrói junto e fica no time fundador pra sempre.',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-bg-soft">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="eyebrow">Programa Fundadores · vagas limitadas</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            Seja um dos primeiros.{' '}
            <span className="text-grad">Saia na frente do seu concorrente.</span>
          </h2>
          <p className="text-[16px] text-muted leading-relaxed">
            Estamos selecionando empresas pra co-criar a ZappIQ. Em troca do seu feedback real, a gente
            te dá condições que não vão existir depois que o mercado acordar.
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
          <Link href="/register?utm_source=fundadores" className="btn btn-accent btn-lg">
            Quero ser Fundador <ArrowRight size={16} />
          </Link>
          <p className="text-[11.5px] text-muted mt-4">
            Vagas limitadas · 14 dias grátis · sem cartão de crédito no trial
          </p>
        </div>
      </div>
    </section>
  );
}
