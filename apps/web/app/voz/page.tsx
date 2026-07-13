import Link from 'next/link';
import { PublicLayout } from '@/components/landing/PublicLayout';
import {
  Mic, Headphones, Volume2, ArrowRight, Star, Sparkles,
  MessageSquare, Waves, Check, AlertCircle, Zap, Crown,
} from 'lucide-react';
/* Voice add-on data inlinado aqui pra não depender do rebuild do pacote
 * @zappiq/shared. Source-of-truth canônico permanece em
 * packages/shared/src/planConfig.ts: ADDONS.VOICE_* + VOICE_ADDON_META.
 * Se mudar pricing aqui, ATUALIZE planConfig.ts também.
 */
const VOICE_ADDON_DATA = {
  VOICE_200:  { minutesIncluded: 200,  overagePerMinBrl: 0.35, trialMinutes: 30, priceBrl: 79.90 },
  VOICE_400:  { minutesIncluded: 400,  overagePerMinBrl: 0.30, trialMinutes: 30, priceBrl: 137.90 },
  VOICE_600:  { minutesIncluded: 600,  overagePerMinBrl: 0.28, trialMinutes: 0,  priceBrl: 184.90 },
  VOICE_800:  { minutesIncluded: 800,  overagePerMinBrl: 0.25, trialMinutes: 0,  priceBrl: 224.90 },
  VOICE_1500: { minutesIncluded: 1500, overagePerMinBrl: 0.22, trialMinutes: 0,  priceBrl: 379.90 },
  VOICE_4000: { minutesIncluded: 4000, overagePerMinBrl: 0.20, trialMinutes: 0,  priceBrl: 929.90 },
} as const;

/* ══════════════════════════════════════════════════════════════════════════
 * /voz: Voz Nativa ZappIQ V4 (PR #73 · pricing real v4 LIVE no Stripe)
 * --------------------------------------------------------------------------
 * Inbound (Whisper STT): incluído em TODOS os planos. R$ 0 adicional.
 *
 * Outbound (TTS Neural2-C pt-BR): 6 add-ons mensais.
 *   200 min / R$ 79,90  · overage 0,35/min · trial 14d com 30 min
 *   400 min / R$ 137,90 · overage 0,30/min · trial 14d com 30 min
 *   600 min / R$ 184,90 · overage 0,28/min
 *   800 min / R$ 224,90 · overage 0,25/min
 * 1.500 min / R$ 379,90 · overage 0,22/min
 * 4.000 min / R$ 929,90 · overage 0,20/min
 *
 * Source of truth: VOICE_ADDON_META + ADDONS de @zappiq/shared
 * Stripe Prices LIVE desde 2026-05-04 (PR #72 v4 FINAL).
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Voz Nativa: IA que fala no WhatsApp | ZappIQ',
  description:
    'Inbound (cliente manda áudio, Whisper transcreve) incluído em todos os planos. Outbound (IA responde em voz pt-BR Neural2) a partir de R$ 79,90/mês com 200 minutos. 6 pacotes até 4.000 min.',
};

interface VoicePackage {
  id: 'VOICE_200' | 'VOICE_400' | 'VOICE_600' | 'VOICE_800' | 'VOICE_1500' | 'VOICE_4000';
  label: string;
  minutes: number;
  priceBrl: number;
  overagePerMin: number;
  ideal: string;
  highlight?: boolean;
  trialMinutes: number;
}

const PACKAGES: VoicePackage[] = (
  ['VOICE_200', 'VOICE_400', 'VOICE_600', 'VOICE_800', 'VOICE_1500', 'VOICE_4000'] as const
).map((id) => {
  const data = VOICE_ADDON_DATA[id];
  const minutesLabel = id === 'VOICE_1500' ? '1.500 min' : id === 'VOICE_4000' ? '4.000 min' : `${data.minutesIncluded} min`;
  return {
    id,
    label: minutesLabel,
    minutes: data.minutesIncluded,
    priceBrl: data.priceBrl,
    overagePerMin: data.overagePerMinBrl,
    trialMinutes: data.trialMinutes,
    ideal:
      id === 'VOICE_200' ? 'Pequenas operações testando voz' :
      id === 'VOICE_400' ? 'Atendimento ativo + lembretes' :
      id === 'VOICE_600' ? 'Operações com escala média' :
      id === 'VOICE_800' ? 'Volume alto recorrente' :
      id === 'VOICE_1500' ? 'Multi-canais ou multi-unidades' :
      'Operação enterprise / franquias',
    highlight: id === 'VOICE_400',
  };
});

const INBOUND_FEATURES = [
  'Recebimento de áudios do cliente no WhatsApp',
  'Transcrição automática via Whisper (OpenAI) em pt-BR',
  'IA entende contexto e responde igual a texto',
  'Suporte a sotaques regionais brasileiros',
  'Funciona em todos os planos, inclusive Starter R$ 197',
  'Zero cobrança adicional, zero configuração',
];

const USE_CASES = [
  {
    icon: MessageSquare,
    title: 'Cliente manda áudio reclamando',
    body:
      'Whisper transcreve, IA entende a reclamação, responde em texto ou áudio (se outbound ativo). Atendente não para 3 min ouvindo áudio.',
    tier: 'Inbound · R$ 0',
  },
  {
    icon: Volume2,
    title: 'Cliente prefere ouvir, não ler',
    body:
      'Cliente pede confirmação por áudio. IA responde em áudio com voz natural pt-BR Neural2-C. Experiência humanizada, escala automática.',
    tier: 'Outbound · a partir de R$ 79,90',
  },
  {
    icon: Headphones,
    title: 'Atendimento noturno / fora de horário',
    body:
      'Cliente pede orçamento às 23h. IA responde em áudio com acolhimento natural, 24/7 sem precisar atendente humano de plantão.',
    tier: 'Outbound · qualquer pacote',
  },
  {
    icon: Waves,
    title: 'Lembrete de consulta / aula / evento',
    body:
      'IA manda áudio 24h antes do evento. Cliente ouve, reconhece, responde. Taxa de comparecimento sobe vs lembrete em texto.',
    tier: 'Outbound · 400+ recomendado',
  },
];

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function VozPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-24 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A] text-white">
        <div
          className="absolute inset-0 -z-0 opacity-50"
          style={{
            background:
              'radial-gradient(80% 60% at 30% 20%, rgba(124,58,237,0.25) 0%, rgba(37,211,102,0.12) 40%, transparent 75%)',
          }}
        />
        <div className="zappiq-wrap relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
            <Mic size={14} className="text-emerald-300" />
            <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
              Voz Nativa · Google Neural2-C pt-BR
            </span>
          </div>
          <h1 className="text-[44px] lg:text-[64px] font-medium leading-[1.05] tracking-[-0.03em] mb-6 max-w-4xl">
            IA no WhatsApp que <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-violet-300">ouve, entende e responde</span>, em texto ou áudio.
          </h1>
          <p className="text-[17px] lg:text-[19px] text-white/70 max-w-3xl mb-10 leading-relaxed">
            Cliente mandando áudio (inbound) já é padrão em todos os planos, sem custo extra. IA respondendo em áudio (outbound) é add-on com 6 pacotes a partir de <strong className="text-white">R$ 79,90/mês</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/cadastro"
              className="bg-emerald-400 text-slate-900 font-semibold px-7 py-4 rounded-xl hover:bg-emerald-300 transition-colors inline-flex items-center justify-center gap-2"
            >
              Começar 14 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="#pacotes"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2"
            >
              Ver os 6 pacotes
            </Link>
          </div>
        </div>
      </section>

      {/* Inbound: incluído */}
      <section className="py-20 lg:py-24 bg-white">
        <div className="zappiq-wrap">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 mb-6">
                <Check size={14} className="text-emerald-700" />
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Incluso em todos os planos
                </span>
              </div>
              <h2 className="text-[36px] lg:text-[44px] font-medium leading-[1.05] tracking-[-0.02em] text-ink mb-4">
                Inbound: cliente manda áudio, IA entende.
              </h2>
              <p className="text-muted text-[15.5px] leading-relaxed mb-6">
                70% dos clientes preferem mandar áudio no WhatsApp. Antes, atendente parava 3 min ouvindo. Agora Whisper transcreve em segundos e IA responde com contexto, igual a texto.
              </p>
              <ul className="space-y-3">
                {INBOUND_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[14px] text-ink-2">
                    <Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-violet-50 rounded-2xl p-8 border border-emerald-100">
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 shadow-sm max-w-[80%]">
                  <p className="text-[10px] text-gray-400 mb-1">Cliente · áudio 47s</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 size={14} className="text-gray-400" />
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full w-3/4 bg-emerald-500 rounded-full" />
                    </div>
                    <span className="text-[11px] text-gray-400">47s</span>
                  </div>
                  <p className="text-[11px] italic text-gray-500">
                    "Oi, queria saber se vocês fazem exame de sangue em jejum e se tem horário pra amanhã cedo, porque meu médico pediu urgente..."
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-2 font-semibold">← transcrito por Whisper em 1.6s</p>
                </div>
                <div className="bg-emerald-500 text-white rounded-xl p-4 shadow-sm ml-auto max-w-[80%]">
                  <p className="text-[10px] text-emerald-100 mb-1">ZappIQ IA · 2s depois</p>
                  <p className="text-[14px]">
                    Oi! Sim, fazemos exame de sangue em jejum. Tenho 7h30 e 8h15 amanhã. Qual prefere? 🩺
                  </p>
                </div>
                <p className="text-[11px] text-gray-500 text-center mt-4">
                  47s de áudio → transcrição + resposta em ~2s. Zero handoff humano.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Outbound: 6 pacotes v4 */}
      <section id="pacotes" className="py-20 lg:py-28 bg-bg-soft">
        <div className="zappiq-wrap">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-1.5 mb-4">
              <Sparkles size={14} className="text-violet-700" />
              <span className="text-xs font-semibold text-violet-800 uppercase tracking-wider">
                Add-on opcional · Google Neural2-C
              </span>
            </div>
            <h2 className="text-[36px] lg:text-[48px] font-medium leading-[1.05] tracking-[-0.02em] text-ink mb-3">
              Outbound: IA responde em áudio. <span className="text-grad">6 pacotes.</span>
            </h2>
            <p className="text-[15.5px] text-muted">
              Voz natural pt-BR (Google Neural2-C). Trocar de pacote a qualquer momento. Excedente cobrado por minuto.
            </p>
          </div>

          {/* Cards 6 pacotes */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col ${
                  pkg.highlight ? 'border-violet-400 shadow-[var(--shadow-card)]' : 'border-line'
                }`}
              >
                {pkg.highlight && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 bg-violet-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                    <Star size={10} fill="currentColor" /> Mais escolhido
                  </span>
                )}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Volume2 size={18} className={pkg.highlight ? 'text-violet-600' : 'text-emerald-600'} />
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${pkg.highlight ? 'text-violet-700' : 'text-emerald-700'}`}>
                      Voice {pkg.minutes >= 1000 ? (pkg.minutes / 1000).toLocaleString('pt-BR') + 'k' : pkg.minutes}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-[14px] text-muted">R$</span>
                    <span className="text-[36px] font-semibold text-ink leading-none tracking-[-0.02em]">{fmtBrl(pkg.priceBrl)}</span>
                    <span className="text-[14px] text-muted">/mês</span>
                  </div>
                  <p className="text-[12px] text-muted">{pkg.label} inclusos</p>
                </div>
                <ul className="space-y-2.5 mb-5 flex-1">
                  <li className="flex items-start gap-2.5 text-[13px] text-ink-2">
                    <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-ink">{pkg.label}</strong> de TTS pt-BR Neural2-C</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-[13px] text-ink-2">
                    <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>Excedente: <strong className="text-ink">R$ {fmtBrl(pkg.overagePerMin)}/min</strong></span>
                  </li>
                  {pkg.trialMinutes > 0 && (
                    <li className="flex items-start gap-2.5 text-[13px] text-ink-2">
                      <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>Trial 14 dias com <strong className="text-ink">{pkg.trialMinutes} min grátis</strong></span>
                    </li>
                  )}
                  <li className="flex items-start gap-2.5 text-[13px] text-ink-2">
                    <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted italic">{pkg.ideal}</span>
                  </li>
                </ul>
                <Link
                  href={`/cadastro?addon=${pkg.id.toLowerCase()}`}
                  className={`block text-center font-semibold px-5 py-3 rounded-xl transition-colors ${
                    pkg.highlight
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-ink text-white hover:bg-ink/90'
                  }`}
                >
                  Ativar {pkg.label}
                </Link>
              </div>
            ))}
          </div>

          {/* Helper escolha */}
          <div className="bg-white rounded-2xl border border-line p-6 lg:p-8">
            <h3 className="text-[18px] font-semibold text-ink mb-4 flex items-center gap-2">
              <Zap size={18} className="text-violet-600" />
              Não sabe qual pacote escolher?
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-[13.5px]">
              <div className="p-4 bg-bg-soft rounded-xl">
                <p className="font-semibold text-ink mb-1">Começando? <span className="text-violet-600">Voice 200</span></p>
                <p className="text-muted leading-relaxed">14 dias com 30 min grátis pra testar antes de pagar. Ideal para validar uso de voz com seus clientes.</p>
              </div>
              <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl">
                <p className="font-semibold text-ink mb-1">Operação ativa? <span className="text-violet-600">Voice 400</span></p>
                <p className="text-muted leading-relaxed">Sweet-spot. Atende lembretes, confirmações e respostas a áudios sem ficar contando minuto. Margem confortável.</p>
              </div>
              <div className="p-4 bg-bg-soft rounded-xl">
                <p className="font-semibold text-ink mb-1">Volume alto? <span className="text-violet-600">Voice 1.500+</span></p>
                <p className="text-muted leading-relaxed">Multi-unidade, franquia ou alto volume diário. R$/min cai pra R$ 0,25, preço por minuto melhor.</p>
              </div>
            </div>
            <p className="text-[12px] text-muted mt-5 italic">
              Plano Enterprise: voz outbound entra na negociação sob consulta. <Link href="/enterprise" className="underline hover:text-ink">Falar com Enterprise</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 bg-white">
        <div className="zappiq-wrap">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <span className="eyebrow">Onde voz faz diferença</span>
            <h2 className="text-[36px] lg:text-[44px] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
              4 cenários reais
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {USE_CASES.map((u) => (
              <div key={u.title} className="bg-bg-soft border border-line rounded-2xl p-7 hover:border-violet-300 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                    <u.icon size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink mb-1">{u.title}</h3>
                    <p className="text-[13.5px] text-muted leading-relaxed mb-2">{u.body}</p>
                    <span className="inline-block text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1 uppercase tracking-wider">
                      {u.tier}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fair use */}
      <section className="py-16 bg-amber-50/50 border-y border-amber-200/60">
        <div className="zappiq-wrap max-w-4xl mx-auto">
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="text-amber-700 mt-1 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">
                Fair-use · transparência técnica
              </p>
              <h3 className="text-[20px] font-semibold text-ink mb-4">
                Limites e regras de uso da voz
              </h3>
              <ul className="space-y-2.5 text-[14px] text-ink-2 leading-relaxed">
                <li>
                  <strong className="text-ink">Minutos não acumulam:</strong> minutos não usados não rolam pro mês seguinte. Padrão TTS, custo do provedor é fixo por mês.
                </li>
                <li>
                  <strong className="text-ink">Excedente cobrado:</strong> ultrapassou os minutos inclusos? Paga R$ 0,20 a R$ 0,35/min (depende do pacote: quanto maior, menor o R$/min). Notificamos em 80% e 100%.
                </li>
                <li>
                  <strong className="text-ink">Hard ceiling:</strong> 2× minutos inclusos. Acima disso, conversa Enterprise (não há cobrança automática infinita, você nunca leva susto na fatura).
                </li>
                <li>
                  <strong className="text-ink">Conteúdo sensível:</strong> voz NÃO é usada pra cobrança imitando terceiros, golpes, deepfake. Violação → suspensão imediata + 1 aviso.
                </li>
                <li>
                  <strong className="text-ink">Broadcast em massa por voz:</strong> requer aprovação prévia ZappIQ pra evitar violação de política Meta. Consulte CSM.
                </li>
                <li>
                  <strong className="text-ink">Trial 14 dias:</strong> pacotes Voice 200 e Voice 400 incluem 30 min grátis pra testar antes de pagar. Pacotes maiores são pra clientes com volume conhecido.
                </li>
              </ul>
              <Link
                href="/legal/fair-use"
                className="text-[13.5px] font-semibold text-amber-900 hover:text-amber-700 inline-flex items-center gap-1 mt-6"
              >
                Ler fair-use completo <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-white">
        <div className="zappiq-wrap max-w-4xl mx-auto text-center">
          <h2 className="text-[36px] lg:text-[52px] font-medium leading-[1.05] tracking-[-0.02em] text-ink mb-4">
            Voz em produção em <span className="text-grad">menos de 24h</span>.
          </h2>
          <p className="text-[16px] text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
            Ative no checkout ou depois no painel. Trial 14 dias com 30 min grátis (pacotes Voice 200 e 400). Sem fidelidade.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cadastro"
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
            >
              Começar 14 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="/demo"
              className="border border-line text-ink hover:bg-bg-soft font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              Ouvir demo das vozes
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
