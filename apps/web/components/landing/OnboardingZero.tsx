'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * OnboardingZero — Design V4 (Chatbase-style · mercado vs ZappIQ)
 * --------------------------------------------------------------------------
 * Tese V3.2 preservada: setup fee é fraude intelectual (R$ 3–8k virou R$ 0).
 * Visual novo: comparativo 2-col em card-soft, tipografia Geist, gradient
 * g→b→p no card ZappIQ, bloco âncora humana preservado.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { X, Check, ArrowRight, Sparkles } from 'lucide-react';

const MERCADO = [
  'Reunião de kickoff com consultor (R$ 1.500)',
  'Tem que mapear FAQ, catálogo e políticas manualmente (R$ 2.000)',
  'Configuração e integração inicial (R$ 2.500)',
  'Treinamento da equipe (R$ 1.000)',
  '4 a 8 semanas até entrar em produção',
];

const ZAPPIQ = [
  'Formulário guiado de 30 a 90 minutos — você mesmo faz',
  'Você mesmo sobe seus documentos (PDF, planilha, site)',
  'A Iza é calibrada automaticamente no painel',
  'Score de prontidão de 0 a 100, você vê em tempo real',
  'Em minutos você está atendendo cliente no WhatsApp',
];

export function OnboardingZero() {
  return (
    <section id="onboarding-zero" className="py-20 lg:py-28 bg-bg-soft">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Setup grátis · sem consultor</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            Setup fee é coisa do passado.{' '}
            <span className="text-grad">Aqui você paga R$ 0 pra começar.</span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-muted leading-relaxed">
            O mercado cobra de R$ 3 a 8 mil só pra "treinar a IA com seus dados". Em 2026 isso é
            atrito desnecessário. Você mesmo sobe seus documentos em minutos, e a Iza aprende
            seu negócio sozinha. Setup fee: zero.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 lg:gap-6 max-w-5xl mx-auto">
          {/* Mercado — card neutro */}
          <div className="card-soft p-8 lg:p-9 relative">
            <div className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-[#FEF3F2] border border-[#FECDD3] text-[11px] font-semibold text-[#B42318] tracking-wide">
              Padrão do mercado
            </div>
            <div className="flex items-baseline gap-2 mb-2 mt-2">
              <span className="text-[44px] lg:text-[52px] font-semibold text-ink leading-none tracking-tight">R$ 3–8k</span>
            </div>
            <p className="text-[13px] text-muted mb-6">setup fee só pra começar</p>
            <ul className="space-y-3">
              {MERCADO.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px] text-muted">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#FEF3F2] flex items-center justify-center mt-0.5">
                    <X size={10} className="text-[#B42318]" strokeWidth={3} />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ZappIQ — card gradient */}
          <div
            className="rounded-[20px] p-8 lg:p-9 text-white relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
              boxShadow:
                '0 30px 60px -20px rgba(74,82,208,.35), 0 0 0 1px rgba(255,255,255,.08) inset',
            }}
          >
            <div className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-white text-[11px] font-semibold text-accent tracking-wide shadow-sm flex items-center gap-1">
              <Sparkles size={11} /> Jeito ZappIQ
            </div>
            <div className="flex items-baseline gap-2 mb-2 mt-2">
              <span className="text-[52px] lg:text-[64px] font-semibold leading-none tracking-tight">R$ 0</span>
            </div>
            <p className="text-[13px] text-white/80 mb-6">você só paga a assinatura mensal</p>
            <ul className="space-y-3">
              {ZAPPIQ.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px] text-white/95">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/como-funciona-survey"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:underline"
          >
            Ver como o survey funciona em detalhes <ArrowRight size={14} />
          </Link>
        </div>

        {/* Âncora humana — card claro */}
        <div className="mt-14 card-soft p-6 lg:p-8 max-w-4xl mx-auto bg-white">
          <p className="text-[13.5px] text-ink leading-relaxed">
            <strong className="font-semibold">E se eu preferir ajuda humana?</strong>{' '}
            <span className="text-muted">
              Se você não finalizar o survey em 7 dias, um consultor ZappIQ entra em contato
              por WhatsApp pra destravar o que estiver pendente — sem custo adicional.
              Self-service é o padrão, mas nunca deixamos você empacar.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
