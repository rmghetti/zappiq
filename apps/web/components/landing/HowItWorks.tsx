'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * HowItWorks — Design V4 (3 passos horizontal · Chatbase-style)
 * --------------------------------------------------------------------------
 * Substitui a grade V3.2 (ícones chapados + números grandes) por uma timeline
 * horizontal com mini-visuais Geist-friendly. IntersectionObserver preservado.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import { Smartphone, Brain, Rocket } from 'lucide-react';

const STEPS = [
  {
    num: '01',
    icon: Smartphone,
    title: 'Conecte seu WhatsApp',
    desc: 'Em 5 minutos, você vincula seu número de WhatsApp comercial à ZappIQ. Oficial, seguro, sem mudar nada pro seu cliente.',
    animation: 'qr',
  },
  {
    num: '02',
    icon: Brain,
    title: 'Calibre sua IA',
    desc: 'Você sobe FAQs, catálogo, políticas — e a Iza aprende seu negócio sozinha. Sem consultor, sem reunião.',
    animation: 'faq',
  },
  {
    num: '03',
    icon: Rocket,
    title: 'Escale o atendimento',
    desc: 'Sua equipe só mexe no que importa. A Iza cuida de 65% dos atendimentos sozinha, 24 horas por dia.',
    animation: 'scale',
  },
];

function StepAnimation({ type, visible }: { type: string; visible: boolean }) {
  const baseClass = `transition-all duration-700 ${
    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
  }`;

  if (type === 'qr') {
    return (
      <div className={baseClass}>
        <div className="w-20 h-20 mx-auto bg-white rounded-[12px] border border-line p-2 relative overflow-hidden shadow-soft">
          <div className="grid grid-cols-5 gap-0.5">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className={`w-full aspect-square rounded-[2px] ${
                  [0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 19, 20, 22, 23, 24].includes(i)
                    ? 'bg-ink'
                    : 'bg-bg-soft'
                }`}
              />
            ))}
          </div>
          {visible && (
            <div
              className="absolute inset-x-0 h-0.5 bg-accent/70"
              style={{ animation: 'scanLine 2s ease-in-out infinite' }}
            />
          )}
        </div>
      </div>
    );
  }

  if (type === 'faq') {
    return (
      <div className={baseClass}>
        <div className="w-28 h-20 mx-auto space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-[8px] border border-line px-2.5 py-1.5 flex items-center gap-2 shadow-soft"
              style={{
                animation: visible ? `slideInRight 0.5s ease ${i * 0.2}s both` : 'none',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              <div
                className={`h-1.5 rounded-full bg-bg-soft ${
                  i === 0 ? 'w-14' : i === 1 ? 'w-10' : 'w-12'
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* scale — conversas sobrepostas */
  return (
    <div className={baseClass}>
      <div className="w-28 h-20 mx-auto relative">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute bg-white rounded-[8px] border border-line px-2 py-1.5 flex items-center gap-1.5 shadow-soft"
            style={{
              top: `${i * 22}px`,
              left: `${i * 8}px`,
              animation: visible ? `popIn 0.4s ease ${i * 0.15}s both` : 'none',
            }}
          >
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
              }}
            >
              <span className="text-[6px] text-white font-bold">✓</span>
            </div>
            <div className="space-y-0.5">
              <div className={`h-1 rounded-full bg-bg-soft ${i === 0 ? 'w-8' : 'w-6'}`} />
              <div className="h-1 rounded-full bg-bg-soft/60 w-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorks() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Como funciona</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em]">
            Três passos.{' '}
            <span className="text-grad">Uma tarde.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* linha conectora desktop */}
          <div className="hidden md:block absolute top-[60px] left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-line to-transparent pointer-events-none" />

          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className="relative card-soft p-7 lg:p-8 text-center"
              style={{
                animation: visible ? `fadeSlideUp 0.6s ease ${i * 0.15}s both` : 'none',
              }}
            >
              <div className="relative inline-flex mx-auto mb-5">
                <div
                  className="w-16 h-16 rounded-[14px] flex items-center justify-center shadow-[0_8px_16px_-8px_rgba(74,82,208,0.4)]"
                  style={{
                    background:
                      'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
                  }}
                >
                  <step.icon size={26} className="text-white" />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-line text-[11px] font-mono font-semibold text-ink flex items-center justify-center shadow-soft">
                  {step.num}
                </span>
              </div>

              <div className="mb-5">
                <StepAnimation type={step.animation} visible={visible} />
              </div>

              <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
                {step.title}
              </h3>
              <p className="text-[13.5px] text-muted leading-relaxed max-w-xs mx-auto">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scanLine {
          0%, 100% { top: 10%; }
          50%      { top: 80%; }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
