'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * Hero: Design V4 multichannel (WhatsApp ↔ Instagram Direct)
 * --------------------------------------------------------------------------
 * V5 (17/05/2026): iPhone alterna entre 2 frames de canal:
 *   - WhatsApp screen (verde #075E54, bg #F5F3EE, bolhas DCF8C6 + brancas)
 *   - Instagram Direct (preto, header dark, bolhas gradient azul + cinza)
 *
 * 8 cenários intercalados (sempre WA → IG → WA → IG):
 *   1. WA · Sorriso & Cia          (clínica odonto)
 *   2. IG · @horizonte.imóveis     (imobiliária, DM após story)
 *   3. WA · Torque Auto Center     (mecânica, áudio)
 *   4. IG · @clínica.allure        (estética, DM lead)
 *   5. WA · Moda Viva              (e-commerce, status pedido)
 *   6. IG · @fitcorp.br            (academia, DM matrícula)
 *   7. WA · Vila Madá              (delivery)
 *   8. IG · @safira.joias          (varejo luxo, DM purchase intent)
 *
 * Pacing: cada msg respeita seu dur + 1.8s entre cenários. Loop infinito.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* ── Tipos do scenario ── */
type ChatMsg =
  | { role: 'me'; text: string; dur: number; audio?: undefined }
  | { role: 'me'; text: 'audio'; audio: string; dur: number }
  | { role: 'ia'; text: string; dur: number; audio?: undefined };

type Channel = 'whatsapp' | 'instagram';

type Scenario = {
  channel: Channel;
  seg: string;
  name: string;       // nome empresa OU username completo
  handle?: string;    // só pra IG (@perfil)
  initials: string;
  grad: string;
  sub: string;
  preface?: string;   // ex: "@user respondeu seu story"
  script: ChatMsg[];
};

const SCENARIOS: Scenario[] = [
  /* 1 · WhatsApp · clínica odonto */
  {
    channel: 'whatsapp',
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

  /* 2 · Instagram · imobiliária (DM após story) */
  {
    channel: 'instagram',
    seg: 'Imobiliária · veio do anúncio',
    name: 'horizonte.imóveis',
    handle: '@horizonte.imóveis',
    initials: 'HI',
    grad: 'linear-gradient(135deg,#4A52D0,#6B74E8)',
    sub: 'Ativo agora · responde com IA',
    preface: 'Respondeu seu story · Apto Moema 2 dorm',
    script: [
      { role: 'me', text: 'Vi seu story do apto Moema, ainda tá disponível?', dur: 2200 },
      { role: 'ia', text: 'Oi! 🏠 Sim, esse e mais <b>3 com perfil parecido</b> em Moema. O top: <b>R$ 795.000</b>, 68m², reformado, 1 vaga. Quer ver fotos?', dur: 2900 },
      { role: 'me', text: 'Manda! E dá pra visitar sábado?', dur: 1800 },
      { role: 'ia', text: 'Claro ✓ Tenho <b>sáb 10h</b> ou <b>sáb 14h</b> com o corretor Marcos. Qual horário fecha melhor?', dur: 2600 },
    ],
  },

  /* 3 · WhatsApp · mecânica (áudio) */
  {
    channel: 'whatsapp',
    seg: 'Mecânica automotiva',
    name: 'Torque Auto Center',
    initials: 'TA',
    grad: 'linear-gradient(135deg,#F59E0B,#EF4444)',
    sub: 'online · IA + técnico humano',
    script: [
      { role: 'me', text: 'audio', audio: '00:14', dur: 1800 },
      { role: 'ia', text: 'Entendi, barulho no freio do <b>Civic 2019</b>. Soa como pastilha gasta. Revisão custa <b>R$ 320</b> e dura 2h.', dur: 2900 },
      { role: 'me', text: 'Fecha pra amanhã?', dur: 1200 },
      { role: 'ia', text: '✓ Agendado <b>quarta 09h</b>. Enviei endereço e PIX pro sinal. Seu carro volta no mesmo dia.', dur: 2600 },
    ],
  },

  /* 4 · Instagram · clínica estética (DM lead frio) */
  {
    channel: 'instagram',
    seg: 'Estética · lead novo da bio',
    name: 'clínica.allure',
    handle: '@clínica.allure',
    initials: 'AL',
    grad: 'linear-gradient(135deg,#EC4899,#8B5CF6)',
    sub: 'Resposta em 1s · IA Iza',
    preface: 'Primeira mensagem desta conta',
    script: [
      { role: 'me', text: 'Oi, valores de botox região da testa?', dur: 1800 },
      { role: 'ia', text: '<b>Aplicação Allergan</b> testa: <b>R$ 890</b> (3 pontos) ou <b>R$ 1.290</b> (5 pontos). Primeira consulta é <b>gratuita</b> ✨', dur: 3000 },
      { role: 'me', text: 'Tem horário amanhã à tarde?', dur: 1600 },
      { role: 'ia', text: 'Sim ✓ <b>Amanhã 15h</b> ou <b>17h30</b> com a Dra. Júlia. Qual prefere?', dur: 2200 },
    ],
  },

  /* 5 · WhatsApp · e-commerce (status pedido) */
  {
    channel: 'whatsapp',
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

  /* 6 · Instagram · academia (DM matrícula via promoção) */
  {
    channel: 'instagram',
    seg: 'Academia · veio de promoção',
    name: 'fitcorp.br',
    handle: '@fitcorp.br',
    initials: 'FC',
    grad: 'linear-gradient(135deg,#F97316,#EF4444)',
    sub: 'Online · IA Iza',
    preface: 'Curtiu post · promoção matrícula',
    script: [
      { role: 'me', text: 'Vi a promo de matrícula. Tem academia perto da Vila Olímpia?', dur: 2100 },
      { role: 'ia', text: 'Tem sim 💪 <b>FitCorp Vila Olímpia</b> a 400m do metrô. Promo de hoje: <b>matrícula R$ 0</b> + 1º mês <b>R$ 89</b>.', dur: 2900 },
      { role: 'me', text: 'Posso ir fazer avaliação amanhã 19h?', dur: 1700 },
      { role: 'ia', text: 'Posso encaixar ✓ <b>Amanhã 19h</b> com a Renata (educadora física). Sem compromisso de fechar.', dur: 2600 },
    ],
  },

  /* 7 · WhatsApp · delivery */
  {
    channel: 'whatsapp',
    seg: 'Restaurante · delivery',
    name: 'Vila Madá Cozinha',
    initials: 'VM',
    grad: 'linear-gradient(135deg,#DC2626,#EA580C)',
    sub: 'aceita pedidos 24/7 · IA',
    script: [
      { role: 'me', text: 'Boa noite! Vocês tão entregando ainda?', dur: 1800 },
      { role: 'ia', text: 'Boa noite! 🍝 Sim, até <b>23h</b>. Hoje o destaque é <b>nhoque ao molho funghi</b> (R$ 58) e <b>tiramisu da casa</b> de sobremesa.', dur: 2800 },
      { role: 'me', text: 'Manda 1 nhoque e 1 tiramisu pra Vila Mariana', dur: 1900 },
      { role: 'ia', text: '✓ Pedido confirmado · <b>R$ 76</b> · entrega ~35min. PIX ou cartão na entrega?', dur: 2400 },
    ],
  },

  /* 8 · Instagram · joalheria (DM purchase intent alto) */
  {
    channel: 'instagram',
    seg: 'Joalheria · intenção alta',
    name: 'safira.joias',
    handle: '@safira.joias',
    initials: 'SJ',
    grad: 'linear-gradient(135deg,#0EA5E9,#6366F1)',
    sub: 'Ativo agora · IA Iza',
    preface: 'Respondeu story · aliança ouro 18k',
    script: [
      { role: 'me', text: 'Aquela aliança ouro 18k do story ainda tem 16?', dur: 2000 },
      { role: 'ia', text: 'Tem sim ✨ Aliança <b>Clássica 4mm</b> ouro 18k tam <b>16</b>: <b>R$ 2.890</b> · em até 6x sem juros. Enviamos pelo Brasil em 2 dias.', dur: 3000 },
      { role: 'me', text: 'Tem certificado de autenticidade?', dur: 1700 },
      { role: 'ia', text: 'Sim ✓ <b>Certificado IBGM</b> incluso + nota fiscal. Quer reservar enquanto fecha o pagamento?', dur: 2700 },
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

    const renderBubble = (msg: ChatMsg, key: number, ch: Channel): JSX.Element => {
      const isMe = msg.role === 'me';

      /* ── Estilos por canal ── */
      const meBg =
        ch === 'whatsapp'
          ? 'bg-[#DCF8C6] text-[#111]'
          : 'text-white';
      const meStyle: React.CSSProperties =
        ch === 'whatsapp'
          ? { opacity: 0, transform: 'translateY(8px)', animation: 'bubIn .4s ease-out forwards' }
          : {
              opacity: 0,
              transform: 'translateY(8px)',
              animation: 'bubIn .4s ease-out forwards',
              background: 'linear-gradient(135deg,#3897F0,#4F46E5)',
            };
      const iaBg =
        ch === 'whatsapp'
          ? 'bg-white text-[#111] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]'
          : 'bg-[#262626] text-white';
      const radius = ch === 'whatsapp' ? 'rounded-[14px]' : 'rounded-[16px]';
      const metaColor = ch === 'whatsapp' ? 'text-[#666]' : 'text-white/60';
      const checkColor = ch === 'whatsapp' ? 'text-[#34B7F1]' : 'text-white/85';
      const checkLabel = ch === 'whatsapp' ? '✓✓' : 'visto';

      if (isMe && msg.audio) {
        return (
          <div
            key={key}
            className={`ml-auto ${meBg} ${radius} px-3 py-2 max-w-[80%] text-[13.5px] flex items-center gap-2`}
            style={meStyle}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                ch === 'whatsapp' ? 'bg-[#075E54] text-white' : 'bg-white/20 text-white'
              }`}
            >
              ▶
            </span>
            <span className="flex items-end gap-[2px] flex-1 h-[20px]">
              {waveBars(20).map((h, i) => (
                <span
                  key={i}
                  className={`w-[2px] rounded-full ${
                    ch === 'whatsapp' ? 'bg-[#075E54]/60' : 'bg-white/60'
                  }`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </span>
            <span className={`text-[11px] ${ch === 'whatsapp' ? 'text-[#666]' : 'text-white/70'}`}>
              {msg.audio}
            </span>
          </div>
        );
      }

      const baseStyle: React.CSSProperties = isMe
        ? meStyle
        : { opacity: 0, transform: 'translateY(8px)', animation: 'bubIn .4s ease-out forwards' };

      return (
        <div
          key={key}
          className={`${isMe ? `ml-auto ${meBg}` : `mr-auto ${iaBg}`} ${radius} px-3 py-2 max-w-[80%] text-[13.5px]`}
          style={baseStyle}
          dangerouslySetInnerHTML={{
            __html: `${msg.text}<div class="flex items-center justify-end gap-1 mt-0.5 text-[10.5px] ${metaColor}"><span>${clockNow()}</span>${
              isMe ? `<span class="${checkColor}">${checkLabel}</span>` : ''
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
        setBubbles((prev) => [...prev, renderBubble(msg, k, sc.channel)]);
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

  /* ── Tema do iPhone por canal ── */
  const isIG = scenario.channel === 'instagram';

  return (
    <section className="relative pt-[140px] pb-[100px] lg:pt-[160px] lg:pb-[120px] overflow-hidden">
      {/* Aurora Background (V4 canon · g→b→p · padrão Aceternity em light mode) */}
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

      {/* Geo shapes decorativos */}
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
              Meta Business Partner · WhatsApp + Instagram
            </div>

            <h1 className="text-[44px] sm:text-[56px] lg:text-[72px] leading-[1.0] tracking-[-0.045em] font-semibold text-ink mb-6">
              A Iza atende, vende e faz campanha pela sua operação. <span className="text-grad">Você aprova, ela executa.</span>
            </h1>

            <p className="text-[17px] lg:text-[18.5px] text-muted leading-[1.55] max-w-[560px] mb-8">
              Não é um chatbot. É a sua <b className="text-ink">operação de atendimento e vendas</b> rodando sozinha no
              <b className="text-ink"> WhatsApp e Instagram</b>, 24/7, em texto e áudio. A IA monta o fluxo, cria a campanha,
              atualiza o CRM na origem e se corrige sozinha. Ative em minutos e teste <b className="text-ink">14 dias grátis</b>.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <Link href="/cadastro" className="btn btn-accent btn-lg">
                Começar 14 dias grátis <span aria-hidden>→</span>
              </Link>
              <a href="#plataforma-autonoma" className="btn btn-line btn-lg">
                Ver a Iza trabalhando
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

          {/* Coluna direita: iPhone alternando WA/IG */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Badges flutuantes (escondidos no mobile) */}
            <div
              className="hidden md:flex absolute z-20 top-10 -left-4 items-center gap-2 px-3 py-2 rounded-full bg-white border border-line shadow-[var(--shadow-card)] text-[12px] font-medium"
              style={{ animation: 'badgeFloat 5s ease-in-out infinite' }}
            >
              <span className="w-2 h-2 rounded-full bg-g1 animate-pulse" />
              {isIG ? 'DM respondida em 1.2s' : 'Consulta agendada em 12 segundos'}
            </div>
            <div
              className="hidden md:flex absolute z-20 bottom-16 -right-4 items-center gap-2 px-3 py-2 rounded-full bg-white border border-line shadow-[var(--shadow-card)] text-[12px] font-medium"
              style={{ animation: 'badgeFloat 4.5s ease-in-out infinite', animationDelay: '0.8s' }}
            >
              {isIG ? (
                <>Lead qualificado <b className="text-accent ml-0.5">do anúncio</b></>
              ) : (
                <>Lead qualificado <b className="text-accent ml-0.5">automaticamente</b></>
              )}
            </div>

            {/* Channel pill flutuante topo-direito */}
            <div
              key={scenario.channel}
              className="hidden md:flex absolute z-20 -top-2 right-2 items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11px] font-semibold uppercase tracking-wider"
              style={{
                background: isIG
                  ? 'linear-gradient(135deg,#FCAF45,#E1306C,#833AB4)'
                  : '#075E54',
                animation: 'badgeFloat 6s ease-in-out infinite',
              }}
            >
              {isIG ? 'Instagram' : 'WhatsApp'}
            </div>

            {/* iPhone frame */}
            <div className="relative w-[340px] h-[680px] bg-[#1a1a1a] rounded-[44px] p-[10px] shadow-[0_50px_100px_-30px_rgba(17,17,17,0.4)]">
              {/* Notch */}
              <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[110px] h-[26px] bg-black rounded-full z-10" />

              {/* Screen */}
              <div
                className={`relative w-full h-full rounded-[36px] overflow-hidden flex flex-col ${
                  isIG ? 'bg-black' : 'bg-[#F5F3EE]'
                }`}
              >
                {/* Status bar fake */}
                <div className="absolute top-0 left-0 right-0 h-[42px] flex items-center justify-between px-5 text-[11px] font-medium text-white z-[5] pointer-events-none">
                  <span>{clock || '--:--'}</span>
                  <span className="flex items-center gap-1.5 text-[10px]">
                    <span>•••</span>
                    <span>📡</span>
                    <span>🔋</span>
                  </span>
                </div>

                {/* ═══════ Header por canal ═══════ */}
                {isIG ? (
                  /* Instagram Direct header (preto + border bottom #262626) */
                  <div className="bg-black text-white pt-[42px] px-3 pb-3 flex items-center gap-3 border-b border-[#262626]">
                    <span className="text-[14px]">←</span>
                    {/* Avatar com ring gradient Instagram (story-style) */}
                    <div
                      className="w-9 h-9 rounded-full p-[2px] flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#FCAF45,#E1306C,#833AB4)' }}
                    >
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
                        style={{ background: scenario.grad }}
                      >
                        {scenario.initials}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium truncate flex items-center gap-1">
                        {scenario.name}
                        <span className="inline-flex items-center justify-center w-[12px] h-[12px] rounded-full bg-[#3897F0] text-white text-[8px]">✓</span>
                      </div>
                      <div className="text-[11px] text-[#a8a8a8] truncate">{scenario.sub}</div>
                    </div>
                    <span className="text-[14px] text-white">📞</span>
                    <span className="text-[14px] text-white">📹</span>
                  </div>
                ) : (
                  /* WhatsApp header (verde #075E54) */
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
                )}

                {/* Segment label */}
                <div
                  key={scenario.seg}
                  className={`text-[10.5px] text-center py-1.5 animate-fade-in border-b ${
                    isIG
                      ? 'bg-[#1a0c1f] text-[#f0c4d5] border-[#2a1530]'
                      : 'bg-[#FFF3CD] text-[#856404] border-[#FFE69C]'
                  }`}
                >
                  {scenario.seg}
                </div>

                {/* Chat area */}
                <div
                  ref={chatRef}
                  className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                >
                  {/* Preface (só IG) */}
                  {isIG && scenario.preface && (
                    <div className="text-center text-[10px] text-[#888] py-1">
                      ↩ {scenario.preface}
                    </div>
                  )}
                  {/* Divider data (só WA) */}
                  {!isIG && (
                    <div className="text-center text-[10.5px] text-[#666] bg-white/70 self-center px-2 py-0.5 rounded-md mb-1">
                      Hoje
                    </div>
                  )}
                  {bubbles}
                  {typing && (
                    <div
                      className={`typing-dots mr-auto ${
                        isIG ? 'bg-[#262626] border-0' : ''
                      }`}
                      style={
                        isIG
                          ? ({
                              background: '#262626',
                              borderRadius: '14px',
                              padding: '8px 12px',
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      <span /> <span /> <span />
                    </div>
                  )}
                </div>

                {/* Input bar por canal */}
                {isIG ? (
                  <div className="bg-black px-2 py-2 flex items-center gap-1.5 border-t border-[#262626]">
                    <span className="text-[15px] text-white">📷</span>
                    <div className="flex-1 bg-[#1a1a1a] border border-[#262626] rounded-full px-3 py-2 text-[12px] text-[#888]">
                      Mensagem...
                    </div>
                    <span className="text-[15px] text-white">🎤</span>
                    <span className="text-[15px] text-white">🖼</span>
                  </div>
                ) : (
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
                )}

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
