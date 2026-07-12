'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * VozNativa: Design V4 (PR #73 · pricing real v4 LIVE no Stripe)
 * --------------------------------------------------------------------------
 * Inbound (Whisper STT) incluso em todos os planos. R$ 0.
 * Outbound (TTS Neural2-C pt-BR) em 6 pacotes. Aqui a home mostra 3 destaque
 *   (Voice 200, 400 highlight, 1500). CTA pra /voz pra ver os 6.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { Mic, Headphones, Check, Star, ArrowRight } from 'lucide-react';

const INBOUND_ITEMS = [
  'Seu cliente manda áudio de 1 minuto perguntando sobre produto',
  'A Iza transcreve em segundos, entende o que ele quer',
  'Responde em texto na hora, sem pedir pra ele "digitar de novo"',
  'Zero custo adicional, já vem incluso em qualquer plano',
];

interface VoiceTeaserCard {
  id: string;
  label: string;
  minutes: string;
  priceBrl: number;
  highlight?: boolean;
  pitch: string;
}

const VOICE_TEASERS: VoiceTeaserCard[] = [
  {
    id: 'VOICE_200',
    label: 'Voice 200',
    minutes: '200 min/mês',
    priceBrl: 79.9,
    pitch: 'Trial 14 dias com 30 min grátis · pra começar',
  },
  {
    id: 'VOICE_400',
    label: 'Voice 400',
    minutes: '400 min/mês',
    priceBrl: 137.9,
    highlight: true,
    pitch: 'Sweet-spot da operação ativa · mais escolhido',
  },
  {
    id: 'VOICE_1500',
    label: 'Voice 1.500',
    minutes: '1.500 min/mês',
    priceBrl: 379.9,
    pitch: 'Multi-canais ou multi-unidades · R$/min menor',
  },
];

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
          {/* Inbound: INCLUSO */}
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

          {/* Outbound: 6 pacotes (3 destaque na home, ver todos em /voz) */}
          <div className="card-soft overflow-hidden">
            <div
              className="px-8 py-5 text-white flex items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
              }}
            >
              <div className="flex items-center gap-3">
                <Mic size={22} />
                <div>
                  <h3 className="text-[20px] font-medium leading-tight tracking-tight">Sua IA responde em áudio</h3>
                  <p className="text-[12px] text-white/85">6 pacotes · pt-BR Neural2-C</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold bg-white/15 backdrop-blur px-2.5 py-1 rounded-full">
                a partir de R$ 79,90
              </span>
            </div>

            <div className="p-5 space-y-3">
              {VOICE_TEASERS.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`flex items-center justify-between gap-3 p-3.5 rounded-[12px] border transition-colors ${
                    pkg.highlight
                      ? 'bg-violet-50 border-violet-300'
                      : 'bg-bg-soft border-line hover:border-accent/40'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-semibold text-ink">{pkg.label}</span>
                      {pkg.highlight && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-violet-700 bg-violet-200 px-1.5 py-0.5 rounded-full">
                          <Star size={8} fill="currentColor" /> Mais escolhido
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-muted">{pkg.pitch}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="text-[10px] text-muted">R$</span>
                      <span className="text-[20px] font-semibold text-ink leading-none tracking-tight">
                        {fmtBrl(pkg.priceBrl)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted">{pkg.minutes}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-bg-soft px-6 py-3 border-t border-line flex items-center justify-between gap-3">
              <p className="text-[11.5px] text-muted">
                + 3 pacotes (Voice 600, 800 e 4.000) pra volumes maiores.
              </p>
              <Link
                href="/voz#pacotes"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline whitespace-nowrap"
              >
                Ver os 6 <ArrowRight size={11} />
              </Link>
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
