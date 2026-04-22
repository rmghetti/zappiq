'use client';

/**
 * Bloco V3.2 — Voz Nativa
 * -----------------------
 * Inbound (transcrição de áudios WhatsApp): INCLUSA em todos os planos.
 * Outbound (respostas em áudio via TTS): add-on com 2 tiers.
 *   — R$ 197/mês: voz padrão (OpenAI TTS), até 30 minutos/mês
 *   — R$ 597/mês: voz premium (ElevenLabs), até 120 minutos/mês, voz clonada opcional
 */
import Link from 'next/link';
import { Mic, MessageSquare, Headphones, CheckCircle2, Star, ArrowRight } from 'lucide-react';

const INBOUND_ITEMS = [
  'Cliente manda áudio de 1 min perguntando sobre produto',
  'ZappIQ transcreve em segundos (Whisper OpenAI)',
  'IA responde em texto, sem fricção',
  'Nenhum custo extra — já vem com qualquer plano',
];

const OUTBOUND_PADRAO = [
  'Voz masculina ou feminina (PT-BR neutro)',
  'Até 30 minutos de áudio sintetizado por mês',
  'Ideal pra saudações, confirmações, agendamentos',
  'Sem configuração adicional',
];

const OUTBOUND_PREMIUM = [
  'Voz premium com entonação natural (ElevenLabs)',
  'Até 120 minutos de áudio sintetizado por mês',
  'Opção de clonar a voz do atendente humano da sua marca',
  'Controle de personalidade por agente',
];

export function VozNativa() {
  return (
    <section id="voz-nativa" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Mic size={14} /> Novidade V3.2
          </div>
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Voz nativa, no WhatsApp,<br />
            <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">sem integrações esquisitas.</span>
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            Seu cliente manda áudio? Sua IA entende. Quer responder por áudio? Sua IA fala.
            Tudo dentro da mesma conversa, com custo transparente.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {/* Inbound — INCLUSO */}
          <div className="bg-gradient-to-br from-secondary-50 to-white rounded-2xl p-8 border-2 border-secondary-200 relative">
            <div className="absolute -top-4 left-6 bg-secondary-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
              Incluso em todos os planos
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center">
                <Headphones size={24} className="text-secondary-600" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-extrabold text-gray-900">Voz Inbound</h3>
                <p className="text-sm text-gray-500">Cliente → ZappIQ (transcrição)</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-4xl font-extrabold text-secondary-600 font-display">R$ 0</span>
              <span className="text-gray-500 text-sm">sem custo adicional</span>
            </div>
            <ul className="space-y-3">
              {INBOUND_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircle2 size={16} className="text-secondary-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Outbound — split R$197 / R$597 */}
          <div className="bg-white rounded-2xl border-2 border-primary-200 overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-8 py-4 text-white flex items-center gap-3">
              <MessageSquare size={22} />
              <div>
                <h3 className="font-display text-xl font-extrabold">Voz Outbound</h3>
                <p className="text-xs text-white/90">ZappIQ → Cliente (TTS) — add-on opcional</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 divide-x divide-gray-100">
              <div className="p-6">
                <div className="mb-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Padrão</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-gray-900 font-display">R$ 197</span>
                    <span className="text-gray-400 text-sm">/mês</span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {OUTBOUND_PADRAO.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle2 size={12} className="text-primary-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-gradient-to-b from-amber-50 to-white relative">
                <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star size={10} /> Premium
                </div>
                <div className="mb-3">
                  <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">Premium</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-gray-900 font-display">R$ 597</span>
                    <span className="text-gray-400 text-sm">/mês</span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {OUTBOUND_PREMIUM.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle2 size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Ativação e desativação self-service direto no dashboard.
                Consumo medido em segundos e exibido em tempo real.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/voz"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold transition-colors"
          >
            Ver demonstração e casos de uso de voz <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
