'use client';

import { useEffect, useRef, useState } from 'react';
import { Smartphone, Brain, Rocket } from 'lucide-react';

const STEPS = [
  {
    num: '01', icon: Smartphone, title: 'Conecte seu WhatsApp',
    desc: 'Em 5 minutos, vincule seu número comercial à ZappIQ via API oficial da Meta.',
    animation: 'qr', // tipo de micro-animação
  },
  {
    num: '02', icon: Brain, title: 'Configure sua IA',
    desc: 'Faça upload de FAQs, catálogos e políticas. O Pulse AI aprende tudo sobre seu negócio.',
    animation: 'faq',
  },
  {
    num: '03', icon: Rocket, title: 'Escale seu atendimento',
    desc: 'Sua equipe atende pelo painel profissional enquanto a IA cuida do resto.',
    animation: 'scale',
  },
];

function StepAnimation({ type, visible }: { type: string; visible: boolean }) {
  const baseClass = `transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;

  if (type === 'qr') {
    return (
      <div className={baseClass}>
        <div className="w-20 h-20 mx-auto bg-white rounded-xl shadow-inner border border-gray-200 p-2 relative overflow-hidden">
          {/* Mini QR code animado */}
          <div className="grid grid-cols-5 gap-0.5">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className={`w-full aspect-square rounded-[2px] ${
                  [0,1,2,4,5,6,10,12,14,18,19,20,22,23,24].includes(i) ? 'bg-gray-800' : 'bg-gray-100'
                }`}
                style={{
                  animation: visible ? `fadeIn 0.3s ease ${i * 0.02}s both` : 'none',
                }}
              />
            ))}
          </div>
          {/* Scan line */}
          {visible && (
            <div className="absolute inset-x-0 h-0.5 bg-primary-500/60" style={{ animation: 'scanLine 2s ease-in-out infinite' }} />
          )}
        </div>
      </div>
    );
  }

  if (type === 'faq') {
    return (
      <div className={baseClass}>
        <div className="w-24 h-20 mx-auto space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-sm border border-gray-200 px-2.5 py-1.5 flex items-center gap-2"
              style={{
                animation: visible ? `slideInRight 0.5s ease ${i * 0.2}s both` : 'none',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
              <div className={`h-1.5 rounded-full bg-gray-200 ${i === 0 ? 'w-14' : i === 1 ? 'w-10' : 'w-12'}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // scale — conversas automáticas
  return (
    <div className={baseClass}>
      <div className="w-24 h-20 mx-auto relative">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute bg-white rounded-lg shadow-sm border border-gray-200 px-2 py-1.5 flex items-center gap-1.5"
            style={{
              top: `${i * 22}px`,
              left: `${i * 8}px`,
              animation: visible ? `popIn 0.4s ease ${i * 0.15}s both` : 'none',
            }}
          >
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center">
              <span className="text-[6px] text-white font-bold">✓</span>
            </div>
            <div className="space-y-0.5">
              <div className={`h-1 rounded-full bg-gray-200 ${i === 0 ? 'w-8' : 'w-6'}`} />
              <div className="h-1 rounded-full bg-gray-100 w-5" />
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
    <section ref={sectionRef} className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Como funciona</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">3 passos para transformar seu atendimento</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className="relative text-center"
              style={{
                animation: visible ? `fadeSlideUp 0.6s ease ${i * 0.2}s both` : 'none',
              }}
            >
              {i < 2 && <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-primary-300 to-transparent" />}
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                <step.icon size={36} className="text-white" />
              </div>

              {/* Micro-animação do step */}
              <div className="mb-4">
                <StepAnimation type={step.animation} visible={visible} />
              </div>

              <span className="text-5xl font-extrabold font-display text-gray-100">{step.num}</span>
              <h3 className="font-display text-lg font-bold text-gray-900 mt-2 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scanLine {
          0%, 100% { top: 10%; }
          50% { top: 80%; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
