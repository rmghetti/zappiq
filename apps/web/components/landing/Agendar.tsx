'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * Agendar — Design V4 (Chatbase-style · Geist + gradient g→b→p)
 * --------------------------------------------------------------------------
 * Embed da booking page Google Appointment Schedules da ZappIQ dentro da
 * landing. Lead agenda sem sair do domínio zappiq.com.br.
 *
 * URL fonte (Google Workspace rodrigo.ghetti@zappiq.com.br /u/1/):
 *   https://calendar.google.com/calendar/u/0/appointments/schedules/AcZss...
 *
 * Fallback "Abrir em nova aba" pra browsers com restrição cookie 3rd-party.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ExternalLink, CheckCircle2, Calendar,
  Building2, MessageCircle, Sparkles, ShieldCheck, Clock,
} from 'lucide-react';

const BOOKING_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ34YUuDtykuvlBt8DEZxD0sFZOctNdeyIcl4nn7EOfEBBDm2W5wpjecxxxQlmwu9PQ_7QGJc5Yd';

// Embed URL (Google força ?gv=true pro iframe)
const EMBED_URL = `${BOOKING_URL}?gv=true`;

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
  const [iframeLoaded, setIframeLoaded] = useState(false);

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

      {/* ═══ EMBED + SIDEBAR ═══════════════════════════════════════ */}
      <section className="pb-20 lg:pb-28">
        <div className="zappiq-wrap max-w-7xl">
          <div className="grid lg:grid-cols-[1fr_320px] gap-8 lg:gap-12">
            {/* Coluna principal — iframe embed */}
            <div className="bg-white border border-line rounded-[24px] overflow-hidden shadow-[var(--shadow-card)]">
              {!iframeLoaded && (
                <div className="aspect-[4/5] lg:aspect-[16/13] flex items-center justify-center bg-bg-soft animate-pulse">
                  <div className="text-center px-8">
                    <Calendar size={32} className="text-accent mx-auto mb-3 animate-pulse" />
                    <p className="text-[14px] text-muted">Carregando calendário...</p>
                  </div>
                </div>
              )}
              <iframe
                src={EMBED_URL}
                title="Agendamento Onboarding ZappIQ"
                width="100%"
                height="800"
                style={{
                  border: 0,
                  display: iframeLoaded ? 'block' : 'none',
                  minHeight: '700px',
                }}
                onLoad={() => setIframeLoaded(true)}
                allow="camera; microphone; fullscreen"
                loading="lazy"
              />
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

              {/* Fallback */}
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full text-[12.5px] text-muted hover:text-accent transition-colors py-2"
              >
                <ExternalLink size={13} />
                Abrir calendário em nova aba
              </a>
            </aside>
          </div>

          {/* Helper text mobile */}
          <p className="text-center text-[12.5px] text-muted-2 mt-8 lg:hidden">
            Toque em um horário disponível acima para agendar.
          </p>
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
