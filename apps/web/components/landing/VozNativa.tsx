'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * VozNativa — Design V4 (Chatbase-style · inbound/outbound TTS)
 * --------------------------------------------------------------------------
 * Inbound (transcrição) incluso em todos os planos via Whisper.
 * Outbound (TTS) em 2 tiers: R$ 197 padrão (OpenAI) / R$ 597 premium (ElevenLabs).
 * Visual novo: 2 cards (inbound esquerda + outbound split direita).
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { Mic, Headphones, Check, Star, ArrowRight } from 'lucide-react';

const INBOUND_ITEMS = [
  'Seu cliente manda áudio de 1 minuto perguntando sobre produto',
  'A Iza transcreve em segundos — entende o que ele quer',
  'Responde em texto na hora, sem pedir pra ele "digitar de novo"',
  'Zero custo adicional — já vem incluso em qualquer plano',
];

const OUTBOUND_PADRAO = [
  'Voz masculina ou feminina em PT-BR natural',
  'Até 30 minutos de áudio respondido/mês',
  'Perfeito pra saudações, confirmações e agendamentos',
  'Ativa num clique, sem configurar nada',
];

const OUTBOUND_PREMIUM = [
  'Voz com entonação natural, praticamente humana',
  'Até 120 minutos de áudio respondido/mês',
  'Pode clonar a voz do seu atendente humano',
  'Personalidade controlável por agente',
];

/* Mini-waveform estático (5 alturas que se repetem) */
const WAVE_PATTERN = [8, 16, 12, 20, 14, 10, 18, 8, 16, 12, 20, 14, 8, 16, 12, 20, 14, 10];

export function VozNativa() {
  return (
    <section id="voz-nativa" className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Voz no WhatsApp · texto e áudio</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            Voz direto no WhatsApp.{' '}
            <span className="text-grad">Do jeito que o brasileiro conversa.</span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-muted leading-relaxed">
            Cliente mandou áudio? A Iza entende. Quer que ela responda falando?
            Ela fala. Tudo na mesma conversa, com preço transparente.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 lg:gap-6 max-w-6xl mx-auto">
          {/* Inbound — INCLUSO */}
          <div className="card-soft p-8 relative flex flex-col">
            <div className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-[#2FB57A] text-white text-[11px] font-semibold tracking-wide">
              Incluso em todos os planos
            </div>
            <div className="flex items-center gap-3 mb-5 mt-2">
              <div className="w-11 h-11 rounded-[12px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                <Headphones size={20} className="text-ink" />
              </div>
              <div>
                <h3 className="text-[22px] font-medium text-ink leading-tight tracking-tight">Seu cliente manda áudio</h3>
                <p className="text-[12.5px] text-muted">A Iza entende e responde na hora</p>
              </div>
            </div>

            {/* mini waveform decorativo */}
            <div className="flex items-center gap-[3px] h-10 mb-5 px-1">
              {WAVE_PATTERN.map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-[#2FB57A] to-[#4A52D0]"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>

            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-[40px] font-semibold text-ink leading-none tracking-tight">R$ 0</span>
              <span className="text-[13px] text-muted">sem custo adicional</span>
            </div>
            <ul className="space-y-2.5 flex-1">
              {INBOUND_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-muted">
                  <Check size={14} className="text-[#2FB57A] flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Outbound — split 2 tiers */}
          <div className="card-soft overflow-hidden">
            <div
              className="px-8 py-5 text-white flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
              }}
            >
              <Mic size={22} />
              <div>
                <h3 className="text-[20px] font-medium leading-tight tracking-tight">Sua IA responde em áudio</h3>
                <p className="text-[12px] text-white/85">Ativa quando quiser · add-on opcional</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 divide-x divide-line">
              {/* Padrão */}
              <div className="p-6">
                <p className="text-[10.5px] text-muted font-semibold uppercase tracking-[0.12em] mb-2">Padrão</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-[26px] font-semibold text-ink leading-none tracking-tight">R$ 197</span>
                  <span className="text-[12.5px] text-muted">/mês</span>
                </div>
                <ul className="space-y-2">
                  {OUTBOUND_PADRAO.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12px] text-muted">
                      <Check size={11} className="text-accent flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Premium */}
              <div className="p-6 bg-bg-soft relative">
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-ink text-white text-[9.5px] font-semibold tracking-wide flex items-center gap-1">
                  <Star size={9} /> Premium
                </div>
                <p className="text-[10.5px] text-accent font-semibold uppercase tracking-[0.12em] mb-2">Premium</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-[26px] font-semibold text-ink leading-none tracking-tight">R$ 597</span>
                  <span className="text-[12.5px] text-muted">/mês</span>
                </div>
                <ul className="space-y-2">
                  {OUTBOUND_PREMIUM.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12px] text-muted">
                      <Check size={11} className="text-accent flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-bg-soft px-6 py-4 border-t border-line">
              <p className="text-[11.5px] text-muted">
                Você ativa e desativa quando quiser — sem ligar pra comercial.
                Acompanha o uso em tempo real no painel.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/voz"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:underline"
          >
            Ver demonstração e casos de uso de voz <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
