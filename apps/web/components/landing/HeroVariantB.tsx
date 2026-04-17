'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, CheckCircle2, X, Calendar } from 'lucide-react';

const SCENARIOS = [
  {
    business: 'Clínica Vida Plena',
    label: '📅 Agendamento',
    messages: [
      { type: 'in', text: 'Oi! Quero agendar uma consulta para quinta-feira, tem horário?', delay: 800 },
      { type: 'typing', delay: 1500 },
      { type: 'out', text: 'Olá! Claro! 😊 Temos horários disponíveis na quinta:\n\n🕐 9h\n🕐 14h\n🕐 16h\n\nQual você prefere?', ai: true, delay: 800 },
      { type: 'in', text: '14h perfeito!', delay: 1200 },
      { type: 'typing', delay: 1500 },
      { type: 'out', text: '✅ Agendado! Quinta, 14h — Dra. Camila\n\nVou enviar um lembrete amanhã! 📅', ai: true, delay: 800 },
    ],
  },
  {
    business: 'TrendMix Moda',
    label: '🛒 Venda',
    messages: [
      { type: 'in', text: 'Boa tarde! Vi o vestido floral no Instagram, ainda tem?', delay: 800 },
      { type: 'typing', delay: 1500 },
      { type: 'out', text: 'Oi! Sim, temos! 🌸\n\n👗 Vestido Floral Primavera\n💰 R$ 189,90 ou 3x de R$ 63,30\n📦 Frete grátis acima de R$ 150\n\nTemos P, M e G. Qual seu tamanho?', ai: true, delay: 800 },
      { type: 'in', text: 'M! Quero comprar', delay: 1200 },
      { type: 'typing', delay: 1500 },
      { type: 'out', text: '✅ Ótima escolha! Seu link de pagamento:\n\n🔗 pay.trendmix.com/abc123\n\nApós o pagamento, envio o rastreio em até 2h! 🚀', ai: true, delay: 800 },
    ],
  },
];

const HERO_METRICS = [
  { target: 500, suffix: '+', label: 'empresas atendidas' },
  { target: 2, suffix: 'M+', label: 'mensagens processadas/mês' },
  { target: 12, suffix: 'M+', prefix: 'R$', label: 'em vendas geradas para clientes' },
];

function AnimatedCounter({ target, suffix = '', prefix = '', triggered }: { target: number; suffix?: string; prefix?: string; triggered: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!triggered) return;
    setCount(0);
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [triggered, target]);

  return (
    <span className="text-3xl lg:text-4xl font-extrabold font-display bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
      {prefix}{count}{suffix}
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function VideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-3xl mx-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors">
          <X size={28} />
        </button>
        <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
          <div className="text-center text-white/60">
            <Play size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm">Vídeo de demonstração</p>
            <p className="text-xs text-white/40 mt-1">Substitua por embed real</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroVariantB() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState<any[]>([]);
  const [showTyping, setShowTyping] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [countersTriggered, setCountersTriggered] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const countersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = countersRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCountersTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleMessages([]);
    setShowTyping(false);

    const scenario = SCENARIOS[scenarioIdx];
    let totalDelay = 500;

    scenario.messages.forEach((msg) => {
      totalDelay += msg.delay;
      const t = setTimeout(() => {
        if (msg.type === 'typing') {
          setShowTyping(true);
        } else {
          setShowTyping(false);
          setVisibleMessages((prev) => [...prev, msg]);
        }
      }, totalDelay);
      timeoutsRef.current.push(t);
    });

    const nextT = setTimeout(() => {
      setScenarioIdx((prev) => (prev + 1) % SCENARIOS.length);
    }, totalDelay + 3000);
    timeoutsRef.current.push(nextT);

    return () => timeoutsRef.current.forEach(clearTimeout);
  }, [scenarioIdx]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [visibleMessages, showTyping]);

  const scenario = SCENARIOS[scenarioIdx];

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-green-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-200/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <svg width="16" height="16" viewBox="0 0 256 256" className="flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M128 20C68.4 20 20 68.4 20 128s48.4 108 108 108 108-48.4 108-108S187.6 20 128 20z" fill="#0081FB"/>
                <path d="M90.3 130.3c0-16.5 4.4-30 11.2-38.8 8.2-10.6 19.8-15.4 30.6-15.4 8.6 0 15.4 2.6 20.8 7.4 5.6 4.8 10 12.2 13 22.2 2.6 8.8 4 19.6 4 32.8 0 14.6-2.6 27-7.2 36.4-5.6 11.4-14 17.4-24.6 17.4-10.4 0-19.4-6.2-26-17.4-7.2-12.2-11.8-27.4-11.8-44.6zm-24.6-4.6c0 24.6 7 44.2 17.6 58 12.2 15.8 28.6 24.4 44.8 24.4 18.2 0 33.2-10.4 43-27.6 8.8-15.4 13.8-36 13.8-59.2 0-20.2-4.2-37.4-12.4-50.4-10-15.8-25-25-42.4-25-18.8 0-34 10.6-44 27.2-9 15-20.4 33.4-20.4 52.6z" fill="white"/>
              </svg>
              Zero setup fee · 14 dias grátis
            </div>

            <h1 className="font-display text-4xl lg:text-5xl xl:text-[3.5rem] font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
              Zero setup fee. <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">14 dias grátis</span>. Sua IA pronta para o WhatsApp.
            </h1>

            <p className="text-lg text-gray-600 leading-relaxed max-w-xl mb-6">
              Enquanto concorrentes cobram R$ 3.000 a R$ 15.000 para você ligar, aqui você não paga nada no começo. Testa, valida, aprova — tudo sem risco. Depois que você vê o ROI, paga apenas pelo que usa. Simples.
            </p>

            <div className="flex flex-wrap gap-4 mb-6">
              <Link href="/register" className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-all shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-0.5">
                Iniciar teste grátis <ArrowRight size={18} />
              </Link>
              <a href="#roi-calculator" className="inline-flex items-center gap-2 border border-green-300 hover:border-green-500 text-green-600 hover:text-green-700 font-semibold px-7 py-3.5 rounded-xl text-base transition-all bg-white hover:bg-green-50">
                <Calendar size={18} /> Ver economia
              </a>
            </div>

            <button onClick={() => setVideoOpen(true)} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 transition-colors mb-6 group">
              <span className="w-8 h-8 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors">
                <Play size={14} className="text-green-600 ml-0.5" />
              </span>
              Veja como funciona em 2 minutos
            </button>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {[
                'R$ 0 de setup fee',
                '14 dias grátis',
                'Cancele quando quiser',
                'Sem contrato mínimo',
              ].map((badge) => (
                <span key={badge} className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-green-500" /> {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="reveal lg:pl-8 flex justify-center">
            <div className="relative">
              <button
                onClick={() => setVideoOpen(true)}
                className="absolute inset-0 z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black/20 rounded-[40px]"
                aria-label="Ver Demonstração"
              >
                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                  <Play size={28} className="text-green-600 ml-1" />
                </div>
              </button>

              <div className="w-[300px] bg-black rounded-[40px] p-[10px] shadow-2xl shadow-gray-900/20">
                <div className="bg-white rounded-[32px] overflow-hidden relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-[16px] z-10" />

                  <div className="bg-[#075E54] pt-8 pb-1 px-4 flex justify-between text-white text-[10px]">
                    <span>9:41</span>
                    <span>●●● ⬤ 100%</span>
                  </div>

                  <div className="bg-[#075E54] px-3 pb-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center text-white text-[10px] font-bold">ZQ</div>
                    <div>
                      <p className="text-white text-xs font-semibold">{scenario.business}</p>
                      <p className="text-green-200 text-[9px]">● Agente IA ativo</p>
                    </div>
                  </div>

                  <div className="bg-[#ECE5DD] flex justify-center py-1.5">
                    <span className="bg-white/80 text-[10px] text-gray-600 px-3 py-0.5 rounded-full font-medium">Demonstração</span>
                  </div>

                  <div ref={chatRef} className="bg-[#ECE5DD] h-[380px] overflow-y-auto px-3 py-2 space-y-2 scroll-smooth"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' opacity='.03'%3E%3Crect fill='%23075E54' width='100%25' height='100%25'/%3E%3C/svg%3E\")" }}>
                    {visibleMessages.map((msg, i) => (
                      <div key={i} className={`max-w-[85%] px-3 py-2 rounded-lg text-[11px] leading-relaxed shadow-sm transition-all duration-300 ${
                        msg.type === 'in'
                          ? 'bg-white text-gray-700 rounded-tl-none self-start'
                          : 'bg-[#D9FDD3] text-gray-700 rounded-tr-none ml-auto'
                      }`} style={{ animation: 'fadeSlideIn 0.3s ease' }}>
                        {msg.ai && <div className="text-[8px] text-[#075E54] font-bold mb-0.5">⚡ Pulse IA</div>}
                        <span className="whitespace-pre-line">{msg.text}</span>
                      </div>
                    ))}
                    {showTyping && (
                      <div className="bg-white rounded-lg rounded-tl-none max-w-[60%] shadow-sm">
                        <TypingIndicator />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-6 bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold text-sm">0%</div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Custo inicial</p>
                  <p className="text-[10px] text-gray-400">Sem setup fee</p>
                </div>
              </div>

              <div className="absolute -top-2 -right-4 bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
                <p className="text-xs font-bold text-gray-900">14 dias</p>
                <p className="text-[10px] text-gray-400">100% grátis</p>
              </div>
            </div>
          </div>
        </div>

        <div ref={countersRef} className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {HERO_METRICS.map((m) => (
            <div key={m.label} className="text-center">
              <AnimatedCounter target={m.target} suffix={m.suffix} prefix={m.prefix || ''} triggered={countersTriggered} />
              <p className="text-sm text-gray-500 mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />

      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
