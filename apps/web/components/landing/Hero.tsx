'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * Hero — Design V4 (Chatbase-style · WhatsApp phone demo + 5 cenários)
 * --------------------------------------------------------------------------
 * Layout: grid 1.05fr/.95fr · copy à esquerda + iPhone à direita.
 * Phone: 340x680 frame com WhatsApp screen #F5F3EE + bolhas verdes/brancas,
 * typing indicator, 5 cenários rotativos automáticos (Sorriso&Cia, Horizonte,
 * Torque, Allure, Moda Viva). 3 badges flutuantes + geo shapes decorativos.
 * Promessa V4: Onboarding Zero · Voz Nativa · 14 dias grátis · LGPD-first.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* ── Tipos do scenario ── */
type ChatMsg =
  | { role: 'me'; text: string; dur: number; audio?: undefined }
  | { role: 'me'; text: 'audio'; audio: string; dur: number }
  | { role: 'ia'; text: string; dur: number; audio?: undefined };

type Scenario = {
  seg: string;
  name: string;
  initials: string;
  grad: string;
  sub: string;
  script: ChatMsg[];
};

const SCENARIOS: Scenario[] = [
  {
    seg: 'Clínica odontológica',
    name: 'Sorriso & Cia',
    initials: 'SC',
    grad: 'linear-gradient(135deg,#2FB57A,#2F7FB5)',
    sub: 'responde em segundos · IA',
    script: [
      { role: 'me', text: 'Oi, tô com dor no dente e preciso marcar emergência hoje', dur: 2200 },
      { role: 'ia', text: 'Oi! Sinto muito 🦷 Temos encaixe <b>hoje 14h30</b> com o Dr. Rafael ou <b>16h</b> com a Dra. Letícia. Qual prefere?', dur: 2600 },
      { role: 'me', text: '14h30 por favor', dur: 1400 },
      { role: 'ia', text: 'Perfeito ✓ <b>Agendado</b>. Seu convênio <b>Unimed</b> cobre avaliação de urgência. Posso enviar o endereço e instruções?', dur: 2800 },
    ],
  },
  {
    seg: 'Imobiliária',
    name: 'Horizonte Imóveis',
    initials: 'HI',
    grad: 'linear-gradient(135deg,#4A52D0,#6B74E8)',
    sub: 'resposta em 1s · IA Iza',
    script: [
      { role: 'me', text: 'Busco apartamento 2 quartos Moema até 850k', dur: 2200 },
      { role: 'ia', text: 'Ótimo! Separei <b>4 imóveis</b> com seu perfil. O mais bem avaliado: <b>R$ 795.000</b> · 68m² · reformado · 1 vaga. Quer ver fotos?', dur: 2900 },
      { role: 'me', text: 'Quero sim, e dá pra visitar sábado?', dur: 1800 },
      { role: 'ia', text: 'Claro ✓ Tenho <b>sáb 10h</b> e <b>sáb 14h</b> com o corretor Marcos. Qual horário fecha melhor pra você?', dur: 2600 },
    ],
  },
  {
    seg: 'Mecânica automotiva',
    name: 'Torque Auto Center',
    initials: 'TA',
    grad: 'linear-gradient(135deg,#F59E0B,#EF4444)',
    sub: 'online · IA + técnico humano',
    script: [
      { role: 'me', text: 'audio', audio: '00:14', dur: 1800 },
      { role: 'ia', text: 'Entendi — barulho no freio do <b>Civic 2019</b>. Soa como pastilha gasta. Revisão custa <b>R$ 320</b> e dura 2h.', dur: 2900 },
      { role: 'me', text: 'Fecha pra amanhã?', dur: 1200 },
      { role: 'ia', text: '✓ Agendado <b>quarta 09h</b>. Enviei endereço e PIX pro sinal. Seu carro volta no mesmo dia.', dur: 2600 },
    ],
  },
  {
    seg: 'Clínica estética',
    name: 'Clínica Allure',
    initials: 'AL',
    grad: 'linear-gradient(135deg,#EC4899,#8B5CF6)',
    sub: 'atendimento 24/7 · IA',
    script: [
      { role: 'me', text: 'Quero saber valores de botox região da testa', dur: 1800 },
      { role: 'ia', text: 'Claro! <b>Aplicação Allergan</b> na testa: <b>R$ 890</b> (3 pontos) ou <b>R$ 1.290</b> (5 pontos). Primeira consulta é <b>gratuita</b>.', dur: 3000 },
      { role: 'me', text: 'Tem horário amanhã à tarde?', dur: 1600 },
      { role: 'ia', text: 'Sim ✓ <b>Amanhã 15h</b> ou <b>17h30</b> com a Dra. Júlia. Qual prefere?', dur: 2200 },
    ],
  },
  {
    seg: 'E-commerce',
    name: 'Moda Viva',
    initials: 'MV',
    grad: 'linear-gradient(135deg,#10B981,#3B82F6)',
    sub: 'online · IA Iza',
    script: [
      { role: 'me', text: 'Meu pedido #48812 já saiu?', dur: 1800 },
      { role: 'ia', text: 'Saiu sim ✓ Saiu do CD às <b>08:14</b>, está em <b>Osasco · SP</b>. Previsão de entrega: <b>hoje até 18h</b>.', dur: 2800 },
      { role: 'me', text: 'Show! E se não entregarem hoje?', dur: 1700 },
      { role: 'ia', text: 'Aviso automático te chega aqui. Se passar do prazo, a <b>devolução fica 100% por minha conta</b> 😊', dur: 2800 },
    ],
  },
];

/* ── Helpers ── */
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const padN = (n: number) => String(n).padStart(2, '0');
const clockNow = () => {
  const d = new Date();
  return `${padN(d.getHours())}:${padN(d.getMinutes())}`;
};
const waveBars = (n: number) =>
  Array.from({ length: n }, (_, i) => 8 + Math.round(Math.sin(i / 2) * 6 + Math.random() * 5));

/* ── Componente Hero ── */
export function Hero() {
  const chatRef = useRef<HTMLDivElement>(null);
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [bubbles, setBubbles] = useState<JSX.Element[]>([]);
  const [typing, setTyping] = useState(false);
  const [respTime, setRespTime] = useState('1.2s');
  const [clock, setClock] = useState('');

  /* relógio (só client) */
  useEffect(() => {
    setClock(clockNow());
    const id = setInterval(() => setClock(clockNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  /* loop de cenários */
  useEffect(() => {
    let alive = true;
    let scIndex = 0;

    const renderBubble = (msg: ChatMsg, key: number): JSX.Element => {
      const isMe = msg.role === 'me';
      if (isMe && msg.audio) {
        return (
          <div
            key={key}
            className="ml-auto bg-[#DCF8C6] rounded-[14px] px-3 py-2 max-w-[80%] text-[13.5px] text-[#111] flex items-center gap-2"
            style={{ opacity: 0, transform: 'translateY(8px)', animation: 'bubIn .4s ease-out forwards' }}
          >
            <span className="w-6 h-6 rounded-full bg-[#075E54] text-white flex items-center justify-center text-[10px]">▶</span>
            <span className="flex items-end gap-[2px] flex-1 h-[20px]">
              {waveBars(20).map((h, i) => (
                <span
                  key={i}
                  className="w-[2px] bg-[#075E54]/60 rounded-full"
                  style={{ height: `${h}px` }}
                />
              ))}
            </span>
            <span className="text-[11px] text-[#666]">{msg.audio}</span>
          </div>
        );
      }
      return (
        <div
          key={key}
          className={`${isMe ? 'ml-auto bg-[#DCF8C6]' : 'mr-auto bg-white'} rounded-[14px] px-3 py-2 max-w-[80%] text-[13.5px] text-[#111] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]`}
          style={{ opacity: 0, transform: 'translateY(8px)', animation: 'bubIn .4s ease-out forwards' }}
          dangerouslySetInnerHTML={{
            __html: `${msg.text}<div class="flex items-center justify-end gap-1 mt-0.5 text-[10.5px] text-[#666]"><span>${clockNow()}</span>${
              isMe ? '<span class="text-[#34B7F1]">✓✓</span>' : ''
            }</div>`,
          }}
        />
      );
    };

    async function playScenario(sc: Scenario) {
      if (!alive) return;
      setScenario(sc);
      setBubbles([]);
      await wait(180);
      let key = 0;
      for (const msg of sc.script) {
        if (!alive) return;
        if (msg.role === 'ia') {
          setTyping(true);
          setRespTime(`${(0.7 + Math.random() * 0.7).toFixed(1)}s`);
          await wait(900);
          if (!alive) return;
          setTyping(false);
        }
        const k = key++;
        setBubbles((prev) => [...prev, renderBubble(msg, k)]);
        requestAnimationFrame(() => {
          if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
        });
        await wait(msg.dur);
      }
      await wait(1800);
    }

    (async () => {
      while (alive) {
        await playScenario(SCENARIOS[scIndex % SCENARIOS.length]);
        scIndex++;
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="relative pt-[140px] pb-[100px] lg:pt-[160px] lg:pb-[120px] overflow-hidden">
      {/* Aurora Background (V4 canon · g→b→p · padrão Aceternity em light mode)
       * Intensidade média, velocidade harmônica · sem layer pulsante legado.
       */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -inset-[10px] will-change-[background-position]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(100deg, #fff 0%, #fff 7%, transparent 10%, transparent 12%, #fff 16%), repeating-linear-gradient(100deg, rgba(47,181,122,0.95) 10%, rgba(47,127,181,0.82) 25%, rgba(74,82,208,0.95) 40%, rgba(47,181,122,0.82) 55%, rgba(74,82,208,0.95) 70%)',
            backgroundSize: '300%, 200%',
            backgroundPosition: '50% 50%, 50% 50%',
            filter: 'blur(12px)',
            mixBlendMode: 'multiply',
            opacity: 0.55,
            maskImage:
              'radial-gradient(ellipse at 50% 8%, black 12%, transparent 72%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at 50% 8%, black 12%, transparent 72%)',
            animation: 'aurora 60s linear infinite',
          }}
        />
      </div>

      {/* Geo shapes decorativos (entry geoIn + loop geoFloat) */}
      <span
        className="geo-pill hidden lg:block"
        style={{
          top: '20%', left: '6%', width: 140, height: 64,
          animation: 'geoIn 1.1s cubic-bezier(.2,.8,.2,1) forwards, geoFloat 12s ease-in-out infinite 1.1s',
        }}
        aria-hidden
      />
      <span
        className="geo-pill hidden lg:block"
        style={{
          top: '60%', left: '4%', width: 100, height: 48,
          animation: 'geoIn 1.1s cubic-bezier(.2,.8,.2,1) .15s forwards, geoFloat 18s ease-in-out infinite 1.25s',
          opacity: 0,
        }}
        aria-hidden
      />
      <span
        className="geo-pill hidden lg:block"
        style={{
          top: '15%', right: '8%', width: 80, height: 80,
          animation: 'geoIn 1.1s cubic-bezier(.2,.8,.2,1) .3s forwards, geoFloat 12s ease-in-out infinite 1.4s',
          opacity: 0,
        }}
        aria-hidden
      />
      <span
        className="geo-pill hidden lg:block"
        style={{
          bottom: '15%', right: '6%', width: 160, height: 60,
          animation: 'geoIn 1.1s cubic-bezier(.2,.8,.2,1) .45s forwards, geoFloat 18s ease-in-out infinite 1.55s',
          opacity: 0,
        }}
        aria-hidden
      />

      <div className="zappiq-wrap relative">
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-12 lg:gap-20 items-center">
          {/* Coluna esquerda: copy */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-soft border border-line text-[12px] text-muted mb-6">
              <span className="w-2 h-2 rounded-full bg-grad" />
              Integração oficial WhatsApp · dados no Brasil · sem fidelidade
            </div>

            <h1 className="text-[44px] sm:text-[56px] lg:text-[72px] leading-[1.0] tracking-[-0.045em] font-semibold text-ink mb-6">
              Atenda no WhatsApp 24 horas por dia. <span className="text-grad">Sem contratar mais ninguém.</span>
            </h1>

            <p className="text-[17px] lg:text-[18.5px] text-muted leading-[1.55] max-w-[560px] mb-8">
              A <b className="text-ink">Iza</b> — sua IA treinada com o próprio negócio — atende, tira dúvidas,
              agenda e qualifica lead no WhatsApp, 24/7, em texto e em áudio.
              Ative em minutos, teste <b className="text-ink">14 dias grátis</b> e decide depois.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <Link href="/register" className="btn btn-accent btn-lg">
                Começar grátis <span aria-hidden>→</span>
              </Link>
              <a href="#demo" className="btn btn-line btn-lg">
                Agendar demo
              </a>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-g1 font-semibold">✓</span> Sem cartão no trial
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-g1 font-semibold">✓</span> Cancela quando quiser
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-g1 font-semibold">✓</span> Dados no Brasil
              </span>
            </div>
          </div>

          {/* Coluna direita: iPhone WhatsApp demo */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Badges flutuantes (escondidos no mobile) — 1 esq/1 dir para equilíbrio visual */}
            <div
              className="hidden md:flex absolute z-20 top-10 -left-4 items-center gap-2 px-3 py-2 rounded-full bg-white border border-line shadow-[var(--shadow-card)] text-[12px] font-medium"
              style={{ animation: 'badgeFloat 5s ease-in-out infinite' }}
            >
              <span className="w-2 h-2 rounded-full bg-g1 animate-pulse" />
              Consulta agendada em 12 segundos
            </div>
            <div
              className="hidden md:flex absolute z-20 bottom-16 -right-4 items-center gap-2 px-3 py-2 rounded-full bg-white border border-line shadow-[var(--shadow-card)] text-[12px] font-medium"
              style={{ animation: 'badgeFloat 4.5s ease-in-out infinite', animationDelay: '0.8s' }}
            >
              Lead qualificado <b className="text-accent ml-0.5">automaticamente</b>
            </div>

            {/* iPhone frame */}
            <div className="relative w-[340px] h-[680px] bg-[#1a1a1a] rounded-[44px] p-[10px] shadow-[0_50px_100px_-30px_rgba(17,17,17,0.4)]">
              {/* Notch */}
              <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[110px] h-[26px] bg-black rounded-full z-10" />

              {/* Screen */}
              <div className="relative w-full h-full bg-[#F5F3EE] rounded-[36px] overflow-hidden flex flex-col">
                {/* Status bar fake */}
                <div className="absolute top-0 left-0 right-0 h-[42px] flex items-center justify-between px-5 text-[11px] font-medium text-white z-[5] pointer-events-none">
                  <span>{clock || '—'}</span>
                  <span className="flex items-center gap-1.5 text-[10px]">
                    <span>•••</span>
                    <span>📡</span>
                    <span>🔋</span>
                  </span>
                </div>

                {/* WhatsApp top bar */}
                <div className="bg-[#075E54] text-white pt-[42px] px-3 pb-3 flex items-center gap-3">
                  <span className="text-[14px]">←</span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                    style={{ background: scenario.grad }}
                  >
                    {scenario.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate">
                      {scenario.name} <span className="text-white/70 text-[10px]">✓</span>
                    </div>
                    <div className="text-[11px] text-white/80 truncate">{scenario.sub}</div>
                  </div>
                  <span className="text-[14px]">📞</span>
                  <span className="text-[14px]">⋮</span>
                </div>

                {/* Segment label */}
                <div
                  key={scenario.seg}
                  className="text-[10.5px] text-center py-1.5 bg-[#FFF3CD] text-[#856404] border-b border-[#FFE69C] animate-fade-in"
                >
                  {scenario.seg}
                </div>

                {/* Chat area */}
                <div
                  ref={chatRef}
                  className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                >
                  <div className="text-center text-[10.5px] text-[#666] bg-white/70 self-center px-2 py-0.5 rounded-md mb-1">
                    Hoje
                  </div>
                  {bubbles}
                  {typing && (
                    <div className="typing-dots mr-auto">
                      <span /> <span /> <span />
                    </div>
                  )}
                </div>

                {/* Input bar */}
                <div className="bg-[#F0EFEA] px-2 py-2 flex items-center gap-1.5 border-t border-black/5">
                  <span className="text-[15px] text-[#888]">😊</span>
                  <div className="flex-1 bg-white rounded-full px-3 py-2 text-[12px] text-[#888]">
                    Mensagem
                  </div>
                  <span className="text-[15px] text-[#888]">📎</span>
                  <div className="w-9 h-9 rounded-full bg-[#075E54] flex items-center justify-center text-white text-[14px]">
                    🎤
                  </div>
                </div>

                {/* Resp time chip */}
                <div className="absolute bottom-[68px] right-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm font-mono">
                  resp · <b>{respTime}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
