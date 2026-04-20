'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, CheckCircle2, X, Calendar, Zap } from 'lucide-react';

const SCENARIOS = [
  {
    business: 'Sua Clínica',
    label: '📅 Agendamento',
    messages: [
      { type: 'in', text: 'Oi! Quero agendar uma consulta para quinta-feira, tem horário?', delay: 800 },
      { type: 'typing', delay: 1500 },
      { type: 'out', text: 'Olá! Claro! 😊 Temos horários disponíveis na quinta:\n\n🕐 9h\n🕐 14h\n🕐 16h\n\nQual você prefere?', ai: true, delay: 800 },
      { type: 'in', text: '14h perfeito!', delay: 1200 },
      { type: 'typing', delay: 1500 },
      { type: 'out', text: '✅ Agendado! Quinta, 14h com a Dra. responsável.\n\nVou enviar um lembrete amanhã! 📅', ai: true, delay: 800 },
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
    <span className="text-3xl lg:text-4xl font-extrabold font-display bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
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

export function HeroVariantC() {
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

    const scenario = SCENARIOS[0];
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

    return () => timeoutsRef.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [visibleMessages, showTyping]);

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-200/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Zap size={14} className="flex-shrink-0" />
              Deploy em 30 minutos, zero fricção
            </div>

            <h1 className="font-display text-4xl lg:text-5xl xl:text-[3.5rem] font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
              Sua IA do WhatsApp pronta <span className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">em 30 minutos</span>, sem consultor.
            </h1>

            <p className="text-lg text-gray-600 leading-relaxed max-w-xl mb-6">
              Survey inteligente + upload de docs = IA treinada. Não precisa de reuniões, consultoria ou setup complexo. Você mesmo faz tudo em 30 minutos e já tá resolvendo suporte, agenda e vendas no WhatsApp. Time inteiro economizado.
            </p>

            <div className="flex flex-wrap gap-4 mb-6">
              <Link href="/register" className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5">
                Começar em 30 minutos <ArrowRight size={18} />
              </Link>
              <a href="#roi-calculator" className="inline-flex items-center gap-2 border border-blue-300 hover:border-blue-500 text-blue-600 hover:text-blue-700 font-semibold px-7 py-3.5 rounded-xl text-base transition-all bg-white hover:bg-blue-50">
                <Calendar size={18} /> Ver timeline
              </a>
            </div>

            <button onClick={() => setVideoOpen(true)} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-6 group">
              <span className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                <Play size={14} className="text-blue-600 ml-0.5" />
              </span>
              Assista ao processo de setup passo a passo
            </button>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {[
                'Setup em 30 minutos',
                'Zero treinamento',
                'Deploy imediato',
                'Self-service 100%',
              ].map((badge) => (
                <span key={badge} className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-500" /> {badge}
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
                  <Play size={28} className="text-blue-600 ml-1" />
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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold">ZQ</div>
                    <div>
                      <p className="text-white text-xs font-semibold">{SCENARIOS[0].business}</p>
                      <p className="text-green-200 text-[9px]">● Agente IA ativo</p>
                    </div>
                  </div>

                  <div className="bg-[#ECE5DD] flex justify-center py-1.5">
                    <span className="bg-white/80 text-[10px] text-gray-600 px-3 py-0.5 rounded-full font-medium">Pronto em 30min</span>
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
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm">30m</div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Setup completo</p>
                  <p className="text-[10px] text-gray-400">Sem treinamento</p>
                </div>
              </div>

              <div className="absolute -top-2 -right-4 bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
                <p className="text-xs font-bold text-gray-900">1 pessoa</p>
                <p className="text-[10px] text-gray-400">Faz tudo sozinha</p>
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
