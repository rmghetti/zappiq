'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * Agendar — Design V4 (Chatbase-style · Geist + gradient g→b→p)
 * --------------------------------------------------------------------------
 * CTA externo pra booking page Google Appointment Schedules.
 *
 * NOTA TÉCNICA: Google Appointment Schedules NÃO suporta embed iframe
 * (X-Frame-Options: SAMEORIGIN). Padrão Google. Solução: CTA grande +
 * preview visual dos próximos dias úteis + abre booking em nova aba.
 *
 * UX inferior a embed inline, mas funciona 100%. Mesma estratégia inicial
 * de Calendly e HubSpot Meetings.
 *
 * Onda 1 (D+30): refazer com Google Calendar API + form custom no nosso
 * site (slots via API, submit cria evento, branding 100% ZappIQ).
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import {
  ArrowRight, ExternalLink, CheckCircle2, Calendar,
  Building2, MessageCircle, Sparkles, ShieldCheck, Clock,
} from 'lucide-react';

const BOOKING_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ34YUuDtykuvlBt8DEZxD0sFZOctNdeyIcl4nn7EOfEBBDm2W5wpjecxxxQlmwu9PQ_7QGJc5Yd';

// ─── Próximos 5 dias úteis (gerado client-side) ────────────────────
function nextWeekdays(count = 5): Array<{ label: string; sub: string; full: string }> {
  const days: Array<{ label: string; sub: string; full: string }> = [];
  const date = new Date();
  date.setDate(date.getDate() + 1); // começa amanhã
  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  while (days.length < count) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push({
        label: weekdayNames[dow].toUpperCase(),
        sub: String(date.getDate()).padStart(2, '0') + ' ' + monthNames[date.getMonth()],
        full: `${weekdayNames[dow]}, ${date.getDate()} de ${monthNames[date.getMonth()]}`,
      });
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
}

// ─── O que esperar — 5 bullets ─────────────────────────────────────
const ESPERAR = [
  { icon: Building2, t: 'Entender seu negócio', d: 'Quem você atende, qual o canal hoje, o que está travando.' },
  { icon: ShieldCheck, t: 'Configurar Meta Business', d: 'Verificação de Negócio + WhatsApp Business Account.' },
  { icon: MessageCircle, t: 'Vincular seu número', d: 'Conexão oficial Cloud API com a Meta — sem atravessador.' },
  { icon: Sparkles, t: 'Criar o agente IA', d: 'Nome, persona, primeira base de conhecimento.' },
  { icon: CheckCircle2, t: 'Primeiro teste real', d: 'Você manda mensagem, IA responde. Tudo ao vivo.' },
];

// ═══════════════════════════════════════════════════════════════════
export function Agendar() {
  const days = nextWeekdays(5);

  return (
    <main>
      {/* ═══ HERO ═══════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-32 pb-12 lg:pt-40 lg:pb-16">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 0%, rgba(47,181,122,.08) 0%, rgba(74,82,208,.06) 45%, transparent 80%)',
          }}
        />
        <div className="zappiq-wrap max-w-5xl text-center">
          <span className="eyebrow">Onboarding Assistido · 30 min</span>
          <h1 className="text-[40px] lg:text-[60px] font-medium text-ink leading-[1.04] tracking-[-0.035em] mt-4 mb-5">
            Agende sua{' '}
            <span className="text-grad">onboarding ZappIQ.</span>
          </h1>
          <p className="text-[17px] lg:text-[19px] text-muted leading-relaxed max-w-2xl mx-auto">
            30 minutos com especialista. Você sai da call com bot configurado,
            número WhatsApp vinculado e primeira conversa real funcionando.
          </p>
          <div className="inline-flex items-center gap-2 text-[12.5px] text-muted-2 mt-5 bg-bg-soft border border-line rounded-full px-4 py-1.5">
            <Clock size={13} />
            Próximas vagas em 24-72h · Google Meet automático · Sem custo
          </div>
        </div>
      </section>

      {/* ═══ BIG CTA + SIDEBAR ═════════════════════════════════════ */}
      <section className="pb-20 lg:pb-28">
        <div className="zappiq-wrap max-w-7xl">
          <div className="grid lg:grid-cols-[1fr_320px] gap-8 lg:gap-12">
            {/* Coluna principal — preview dias + CTA */}
            <div
              className="relative bg-white border border-line rounded-[24px] p-8 lg:p-12 shadow-[var(--shadow-card)] overflow-hidden"
            >
              {/* Background gradient sutil */}
              <div
                className="absolute inset-0 opacity-50 pointer-events-none"
                style={{ background: 'var(--grad-soft)' }}
                aria-hidden
              />

              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={18} className="text-accent" />
                  <span className="eyebrow !mt-0">Selecione seu horário</span>
                </div>
                <h2 className="text-[28px] lg:text-[34px] font-medium text-ink leading-tight tracking-[-0.025em] mb-2">
                  Vagas abertas <span className="text-grad">esta semana.</span>
                </h2>
                <p className="text-[14.5px] text-muted mb-8">
                  Slots de 30 minutos, Seg-Sex 9h-17h. Confirme em segundos
                  pelo calendário oficial.
                </p>

                {/* Preview dos próximos 5 dias úteis */}
                <div className="grid grid-cols-5 gap-2 lg:gap-3 mb-8">
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className="bg-white/80 backdrop-blur border border-line rounded-[14px] p-3 lg:p-4 text-center hover:border-accent hover:bg-white transition-all"
                    >
                      <div className="text-[10.5px] font-semibold text-accent uppercase tracking-[0.1em] mb-1">
                        {d.label}
                      </div>
                      <div className="text-[15px] lg:text-[17px] font-semibold text-ink leading-tight tracking-tight">
                        {d.sub}
                      </div>
                      <div className="mt-2 inline-flex items-center justify-center w-2 h-2 rounded-full bg-[#2FB57A]">
                        <span className="sr-only">Disponível</span>
                      </div>
                      <div className="text-[10px] text-muted mt-1">disponível</div>
                    </div>
                  ))}
                </div>

                {/* BIG CTA */}
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block w-full text-center bg-ink text-white rounded-[16px] px-8 py-5 hover:opacity-95 transition-all"
                >
                  <span className="inline-flex items-center justify-center gap-3 text-[17px] font-semibold">
                    Abrir calendário e agendar
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                  <span className="block text-[12px] opacity-70 mt-1">
                    Abre em nova aba · Confirma por e-mail · Sem cartão
                  </span>
                </a>

                {/* Trust strip */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[#2FB57A]" />
                    Google Meet automático
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[#2FB57A]" />
                    Lembretes por e-mail
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[#2FB57A]" />
                    Reagende ou cancele com 1 clique
                  </span>
                </div>
              </div>
            </div>

            {/* Sidebar — O que esperar */}
            <aside className="space-y-6">
              <div className="bg-bg-soft border border-line rounded-[20px] p-6">
                <span className="eyebrow">Na call de 30 minutos</span>
                <h2 className="text-[20px] font-semibold text-ink mt-2 mb-5 tracking-tight">
                  O que vamos fazer juntos.
                </h2>
                <ul className="space-y-4">
                  {ESPERAR.map((e, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-[10px] bg-white border border-line flex items-center justify-center">
                        <e.icon size={16} className="text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium text-ink leading-snug">{e.t}</p>
                        <p className="text-[12.5px] text-muted leading-relaxed mt-0.5">{e.d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Trust signals */}
              <div className="bg-white border border-line rounded-[20px] p-6">
                <h3 className="text-[14px] font-semibold text-ink mb-4">Antes da call</h3>
                <ul className="space-y-2.5 text-[12.5px] text-muted">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#2FB57A] mt-0.5 flex-shrink-0" />
                    <span>Tenha em mãos: cartão CNPJ, comprovante de endereço da empresa, RG/CNH do sócio.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#2FB57A] mt-0.5 flex-shrink-0" />
                    <span>Defina qual número de telefone vai virar o bot (recomendamos chip novo dedicado).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#2FB57A] mt-0.5 flex-shrink-0" />
                    <span>Acesso ao Facebook (pessoal ou corporativo) pra autenticar Meta Business.</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ═══ NÃO ESTÁ PRONTO PRA AGENDAR? CTAs ALTERNATIVOS ═══════ */}
      <section className="py-16 lg:py-20 bg-bg-soft">
        <div className="zappiq-wrap max-w-4xl text-center">
          <span className="eyebrow">Ainda com dúvidas?</span>
          <h2 className="text-[28px] lg:text-[36px] font-medium text-ink leading-tight tracking-[-0.03em] mt-3 mb-6">
            Você prefere outro caminho?
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <Link
              href="/conectar-whatsapp"
              className="bg-white border border-line rounded-[16px] p-5 hover:border-accent transition-all flex flex-col items-start text-left"
            >
              <span className="text-[14px] font-semibold text-ink mb-1">Ler o guia completo primeiro</span>
              <span className="text-[12.5px] text-muted">Pré-requisitos, 3 caminhos de onboarding, FAQ.</span>
              <span className="inline-flex items-center gap-1 text-[12px] text-accent mt-3 font-medium">
                /conectar-whatsapp <ArrowRight size={11} />
              </span>
            </Link>
            <Link
              href="/cadastro"
              className="bg-ink text-white rounded-[16px] p-5 hover:opacity-90 transition-all flex flex-col items-start text-left"
            >
              <span className="text-[14px] font-semibold mb-1">Pular para o trial direto</span>
              <span className="text-[12.5px] opacity-75">14 dias grátis sem cartão. Setup self-service.</span>
              <span className="inline-flex items-center gap-1 text-[12px] mt-3 font-medium">
                /cadastro <ArrowRight size={11} />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
