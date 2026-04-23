import Link from 'next/link';
import { PublicLayout } from '@/components/landing/PublicLayout';
import {
  Mic,
  Headphones,
  Volume2,
  ArrowRight,
  Star,
  Sparkles,
  MessageSquare,
  Waves,
  Check,
  AlertCircle,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════════
 * /voz — Voz Nativa ZappIQ V3.2
 * --------------------------------------------------------------------------
 * Inbound (recebimento de áudio do cliente): Whisper OpenAI, transcrição
 * automática, incluído em TODOS os planos, inclusive Starter. R$ 0 adicional.
 *
 * Outbound (IA responder por áudio): add-on opcional com 2 tiers:
 *   • Padrão  R$ 197/mês · OpenAI TTS     · 30 minutos/mês  · voz padrão
 *   • Premium R$ 597/mês · ElevenLabs     · 120 minutos/mês · voz clonada opcional
 *
 * Excedente de minutos: cobrança por minuto adicional na mesma engine,
 * debitada no ciclo seguinte. Cliente é notificado ao atingir 80% e 100%.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Voz Nativa — IA que fala no WhatsApp | ZappIQ V3.2',
  description:
    'Inbound (áudio do cliente transcrito por Whisper) incluído em todos os planos. Outbound (IA responde por áudio) a partir de R$ 197/mês com OpenAI TTS ou R$ 597/mês com ElevenLabs e voz clonada.',
};

const INBOUND_FEATURES = [
  'Recebimento de áudios do cliente no WhatsApp',
  'Transcrição automática via Whisper (OpenAI) em português-BR',
  'IA entende contexto e responde igual a texto',
  'Suporte a sotaques regionais brasileiros',
  'Funciona em todos os planos — inclusive Starter R$ 197',
  'Zero cobrança adicional, zero configuração',
];

const OUTBOUND_PADRAO = [
  '30 minutos de voz sintetizada por mês',
  'Engine OpenAI TTS (voz pt-BR neutra)',
  '3 vozes pré-configuradas (feminina, masculina, executiva)',
  'Ideal para: atendimento 24/7, confirmação de agendamento, lembretes',
  'Excedente: R$ 0,30/min na mesma engine',
];

const OUTBOUND_PREMIUM = [
  '120 minutos de voz sintetizada por mês',
  'Engine ElevenLabs (qualidade broadcast)',
  'Voz clonada da sua marca (opcional, +R$ 500 setup único)',
  'Ideal para: experiência premium, influencers, franquia com voz única',
  'Excedente: R$ 1,20/min na mesma engine',
];

const USE_CASES = [
  {
    icon: MessageSquare,
    title: 'Cliente manda áudio reclamando',
    body:
      'Whisper transcreve, Claude entende a reclamação, IA responde em texto ou áudio (se outbound ativo). Sem atendente ficar ouvindo áudio de 3 minutos.',
    tier: 'Inbound · R$ 0',
  },
  {
    icon: Volume2,
    title: 'Cliente prefere ouvir, não ler',
    body:
      'Cliente pede confirmação de agendamento por áudio. IA responde em áudio com a voz padrão (Padrão) ou voz clonada da sua marca (Premium).',
    tier: 'Outbound · R$ 197 ou R$ 597',
  },
  {
    icon: Headphones,
    title: 'Atendimento noturno / fora de horário',
    body:
      'Cliente pede orçamento às 23h. IA responde em áudio com acolhimento natural — experiência premium sem precisar de atendente 24h.',
    tier: 'Outbound · recomendado Premium',
  },
  {
    icon: Waves,
    title: 'Lembrete de consulta / aula / evento',
    body:
      'IA manda áudio 24h antes do evento com voz da recepcionista digital da clínica. Cliente ouve, reconhece, responde. Presença aumenta.',
    tier: 'Outbound · voz clonada Premium',
  },
];

export default function VozPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-secondary-700 via-secondary-900 to-gray-900 pt-20 pb-24 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(var(--color-secondary-500-rgb,168_85_247),0.18),_transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="inline-flex items-center gap-2 bg-secondary-400/10 border border-secondary-400/30 rounded-full px-4 py-1.5 mb-6">
            <Mic size={14} className="text-secondary-300" />
            <span className="text-xs font-semibold text-secondary-200 uppercase tracking-wider">
              Voz Nativa · diferencial V3.2
            </span>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl font-extrabold mb-6 max-w-4xl leading-tight">
            IA no WhatsApp que <span className="text-secondary-400">ouve, entende e responde</span> —
            em texto ou áudio.
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mb-8 leading-relaxed">
            Inbound (cliente mandando áudio) já é padrão em todos os planos. Outbound (IA respondendo em
            áudio) é add-on a partir de R$ 197/mês. Com opção de voz clonada da sua marca.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="bg-secondary-400 text-gray-900 font-semibold px-7 py-4 rounded-xl hover:bg-secondary-300 transition-colors inline-flex items-center justify-center gap-2"
            >
              Começar 14 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="#planos"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2"
            >
              Comparar Padrão vs Premium
            </Link>
          </div>
        </div>
      </section>

      {/* Inbound — incluído */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-6">
                <Check size={14} className="text-primary-600" />
                <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">
                  Incluso em todos os planos
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
                Inbound — cliente manda áudio, IA entende.
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                70% dos seus clientes preferem mandar áudio no WhatsApp. Antes, um atendente precisava parar,
                ouvir o áudio inteiro, responder. Agora, o Whisper transcreve em segundos e a IA responde
                com contexto — igual a uma mensagem de texto.
              </p>
              <ul className="space-y-3">
                {INBOUND_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl p-8 border border-primary-100">
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 shadow-sm max-w-[80%]">
                  <p className="text-xs text-gray-400 mb-1">Cliente · áudio 47s</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 size={14} className="text-gray-400" />
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full w-3/4 bg-primary-500 rounded-full" />
                    </div>
                    <span className="text-[11px] text-gray-400">47s</span>
                  </div>
                  <p className="text-[11px] italic text-gray-500">
                    "Oi, queria saber se vocês fazem exame de sangue em jejum e se tem horário pra amanhã
                    cedo, porque meu médico pediu urgente..."
                  </p>
                  <p className="text-[10px] text-primary-600 mt-2 font-semibold">
                    ← transcrito por Whisper
                  </p>
                </div>
                <div className="bg-primary-500 text-white rounded-xl p-4 shadow-sm ml-auto max-w-[80%]">
                  <p className="text-xs text-primary-100 mb-1">ZappIQ IA · 2s depois</p>
                  <p className="text-sm">
                    Oi! Sim, fazemos exame de sangue em jejum. Tenho vaga amanhã 7h30 e 8h15. Qual prefere? 🩺
                  </p>
                </div>
                <p className="text-[11px] text-gray-500 text-center mt-4">
                  47s de áudio → transcrição + resposta em ~2 segundos. Zero handoff humano.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Outbound — add-on */}
      <section id="planos" className="py-20 bg-[#F8FAF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4">
              <Sparkles size={14} className="text-amber-700" />
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                Add-on opcional
              </span>
            </div>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
              Outbound — IA responde em áudio. Dois tiers.
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Duas engines, duas faixas de preço, mesmo padrão de qualidade ZappIQ. Escolha por uso
              esperado e orçamento — pode trocar a qualquer momento.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Padrão */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 flex flex-col">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 size={20} className="text-secondary-500" />
                  <span className="text-xs font-bold text-secondary-700 uppercase tracking-wider">
                    Padrão
                  </span>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-gray-900 mb-1">OpenAI TTS</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-gray-900">R$ 197</span>
                  <span className="text-sm text-gray-500">/mês</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Adicionado a qualquer plano</p>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {OUTBOUND_PADRAO.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check size={16} className="text-secondary-500 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register?voice=padrao"
                className="block text-center bg-gray-900 hover:bg-gray-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Começar com Padrão
              </Link>
            </div>

            {/* Premium */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-300 p-8 flex flex-col relative">
              <span className="absolute -top-3 right-6 inline-flex items-center gap-1 bg-amber-400 text-amber-900 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                <Star size={10} fill="currentColor" /> Voz clonada disponível
              </span>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Mic size={20} className="text-amber-700" />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    Premium
                  </span>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-gray-900 mb-1">ElevenLabs</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-gray-900">R$ 597</span>
                  <span className="text-sm text-gray-500">/mês</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Adicionado a qualquer plano</p>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {OUTBOUND_PREMIUM.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register?voice=premium"
                className="block text-center bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Começar com Premium
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-8">
            Enterprise: voz outbound (Padrão ou Premium) incluída na negociação, sem cobrança adicional.
          </p>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-secondary-600 uppercase tracking-wider mb-3">
              Onde voz faz diferença de verdade
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">
              4 cenários reais
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {USE_CASES.map((u) => (
              <div
                key={u.title}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-7 hover:border-secondary-200 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-600 flex items-center justify-center flex-shrink-0">
                    <u.icon size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-gray-900 mb-1">{u.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-2">{u.body}</p>
                    <span className="inline-block text-[11px] font-semibold text-secondary-700 bg-secondary-50 border border-secondary-200 rounded-full px-3 py-1">
                      {u.tier}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fair use voz */}
      <section className="py-16 bg-amber-50/50 border-y border-amber-200/60">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="text-amber-700 mt-1 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                Fair-use · transparência técnica
              </p>
              <h3 className="font-display text-xl font-extrabold text-gray-900 mb-4">
                Limites técnicos e regras de uso
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
                <li>
                  <strong className="text-gray-900">Minutos não acumulam:</strong> minutos não usados no mês
                  não rolam para o mês seguinte. Isso é padrão em TTS — o custo do provedor é fixo por mês.
                </li>
                <li>
                  <strong className="text-gray-900">Excedente é cobrado:</strong> quem ultrapassa os minutos
                  incluídos paga R$ 0,30/min (Padrão) ou R$ 1,20/min (Premium), debitados no ciclo seguinte.
                  Notificamos em 80% e 100% do pacote.
                </li>
                <li>
                  <strong className="text-gray-900">Voz clonada (Premium):</strong> setup único de R$ 500,
                  requer 10 minutos de áudio limpo da pessoa e autorização por escrito (LGPD Art. 7º).
                </li>
                <li>
                  <strong className="text-gray-900">Conteúdo sensível:</strong> voz não é usada para cobrança
                  imitando terceiros, golpes, deepfake político. Violação → suspensão imediata + 1 aviso.
                </li>
                <li>
                  <strong className="text-gray-900">Broadcast em massa por voz:</strong> requer aprovação
                  prévia do ZappIQ para evitar violação de política Meta. Consulte CSM.
                </li>
              </ul>
              <Link
                href="/legal/fair-use"
                className="text-sm font-semibold text-amber-900 hover:text-amber-700 inline-flex items-center gap-1 mt-6"
              >
                Ler fair-use completo <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-gray-900 mb-4">
            Voz em produção em menos de 24h.
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Ative o add-on de voz no checkout ou depois, no painel. Premium com voz clonada leva até 48h
            para calibrar. Zero setup fee, 14 dias grátis, sem fidelidade — ao fim do trial, você escolhe
            a forma de pagamento.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2 shadow-lg shadow-secondary-500/25"
            >
              Começar 14 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="/demo"
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              Ouvir demo das vozes
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
