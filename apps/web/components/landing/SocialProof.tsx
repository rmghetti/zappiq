'use client';

import { Shield, Zap, BarChart3, Lock, Cpu, Globe } from 'lucide-react';

/* ═════════════════════════════════════════════════════════════════════════
 * SocialProof — pré-lançamento 2026.04 (V2)
 *
 * Mudanças V2:
 *   - V2-011: trust bar com parceiros tecnológicos REAIS (Meta, Anthropic,
 *     Stripe, Cloudflare, Supabase, Vercel) enquanto BLOCKER B-02 (logos de
 *     clientes reais) não é desbloqueado.
 *   - V2-017: qualificação Meta corrigida para "via BSP homologado Meta".
 *     Texto completo em /legal/parceria-meta.
 *   - V2-018: "Claude embarcado" substituído por "LLMs de classe mundial".
 * ═════════════════════════════════════════════════════════════════════════ */

const TRUST_SIGNALS = [
  {
    icon: Globe,
    title: 'Parceiro via BSP homologado Meta',
    description: 'API WhatsApp Business entregue por BSP homologado (360Dialog). Sem risco de bloqueio. Detalhes em /legal/parceria-meta.',
    color: 'text-blue-600 bg-blue-100',
  },
  {
    icon: Cpu,
    title: 'IA conversacional de classe mundial',
    description: 'Pulse AI com LLMs de última geração e fallback automático. Respostas inteligentes, não roteiros fixos.',
    color: 'text-purple-600 bg-purple-100',
  },
  {
    icon: Lock,
    title: 'LGPD desde o design',
    description: 'Consentimento granular auditável, criptografia em repouso, DPO externo e RLS multi-tenant.',
    color: 'text-green-600 bg-green-100',
  },
  {
    icon: BarChart3,
    title: 'Observabilidade total',
    description: 'OpenTelemetry nativo: traces, métricas e logs em tempo real. Status page público em status.zappiq.com.br.',
    color: 'text-orange-600 bg-orange-100',
  },
  {
    icon: Zap,
    title: 'Setup em 5 minutos',
    description: 'Conecte seu WhatsApp, configure o agente IA e comece a atender — sem dependência de TI.',
    color: 'text-yellow-600 bg-yellow-100',
  },
  {
    icon: Shield,
    title: 'Infraestrutura brasileira',
    description: 'Borda Cloudflare global, API em GRU e dados no Supabase (São Paulo). Latência mínima, dados em território nacional.',
    color: 'text-teal-600 bg-teal-100',
  },
];

/* ──────────────────────────────────────────────────────────────────────
 * Parceiros tecnológicos — logos SVG otimizados <10KB
 * Cada logo tem aria-label específico (a11y) e tooltip "Integração nativa".
 * V2-011: preenche trust bar enquanto logos reais de clientes não liberam.
 * ────────────────────────────────────────────────────────────────────── */

interface PartnerLogo {
  id: string;
  name: string;
  ariaLabel: string;
  svg: React.ReactNode;
}

const PARTNER_LOGOS: PartnerLogo[] = [
  {
    id: 'meta',
    name: 'Meta',
    ariaLabel: 'Parceiro tecnológico: Meta (WhatsApp Business API via BSP)',
    svg: (
      <svg viewBox="0 0 256 120" className="h-8 w-auto text-gray-400 hover:text-[#0081FB] transition-colors" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M27 93V34h17l22 34 22-34h17v59H88V61L68 92h-3L45 61v32H27zm101-3c-11 0-18-7-18-18V47h16v25c0 4 1 6 5 6s6-2 6-6V47h16v25c0 11-7 18-18 18h-7zm39-20c0-11 7-23 19-23 7 0 11 3 13 7v-6h15v43h-15v-6c-2 4-6 8-13 8-12 0-19-12-19-23zm33 0c0-5-3-10-9-10s-9 5-9 10 3 10 9 10 9-5 9-10z"/>
      </svg>
    ),
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    ariaLabel: 'Parceiro tecnológico: Anthropic (Claude LLM)',
    svg: (
      <svg viewBox="0 0 200 40" className="h-6 w-auto text-gray-400 hover:text-gray-800 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M12 6h5l11 28h-5l-3-8H14l-3 8H6L17 6zm3 16l-3-8-3 8h6zM35 34V6h5v11l10-11h6l-9 10 10 18h-6l-8-14-3 3v11h-5zm34 0V6h20v5H74v6h12v5H74v7h15v5H69zm25 0V6h5l13 19V6h5v28h-5l-13-19v19h-5zm35 0l-11-28h6l7 20 7-20h5l-11 28h-3zm21 0V6h5v28h-5zm9 0V6h5l13 19V6h5v28h-5l-13-19v19h-5z"/>
      </svg>
    ),
  },
  {
    id: 'stripe',
    name: 'Stripe',
    ariaLabel: 'Parceiro tecnológico: Stripe (billing e pagamentos)',
    svg: (
      <svg viewBox="0 0 60 25" className="h-6 w-auto text-gray-400 hover:text-[#635BFF] transition-colors" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 01-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.91-1.04l-.02 4.63-4.12.87V5.56h3.63l.21 1.04c.56-.52 1.6-1.28 3.19-1.28 2.86 0 5.55 2.58 5.55 7.34 0 5.2-2.66 7.64-5.53 7.64zm-.96-11.28c-.94 0-1.53.34-1.95.8l.02 6.1c.39.44.96.78 1.93.78 1.52 0 2.54-1.66 2.54-3.87 0-2.15-1.04-3.81-2.54-3.81zM32.84 5.56h4.15v14.75h-4.15V5.56zm0-4.62L36.99 0v3.38l-4.15.87V.94zm-4.75 8.27v7.15c0 1.12.94 1.48 1.8 1.48.31 0 .63-.04.89-.11v3.61c-.25.06-1.06.15-1.7.15-2.54 0-5.14-1.07-5.14-4.53V9.22h-1.85V5.56h1.85V1.88l4.1-.87v4.55h2.69v3.67h-2.64zm-6.84 4.8v7.12c-.59 1.19-1.95 1.87-3.47 1.87-3.43 0-6.18-2.72-6.18-7.03 0-4.51 2.69-7.42 5.74-7.42 1.58 0 2.82.7 3.46 1.76V5.56h4.15v14.75h-4.15l-.21-1.04c-.59 1.04-1.72 1.28-2.95 1.28l-.39-2.82c.95-.04 2.47-.8 3-3.72zM14.27 5.56v14.75h-4.15v-11c.32-.12.83-.18 1.5-.18 1.48 0 2.65 1.14 2.65 2.65zM0 5.56h4.15v14.75H0V5.56zm0-4.62L4.15 0v3.38L0 4.25V.94z"/>
      </svg>
    ),
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    ariaLabel: 'Parceiro tecnológico: Cloudflare (CDN, WAF e DNS)',
    svg: (
      <svg viewBox="0 0 60 25" className="h-6 w-auto text-gray-400 hover:text-[#F48120] transition-colors" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M15.47 18.65l.42-1.46c.5-1.74.32-3.34-.52-4.53-.77-1.09-2.06-1.73-3.62-1.8L4 10.75a.14.14 0 01-.12-.08.2.2 0 01-.02-.17c.04-.1.15-.19.26-.2l7.82-.1c2.5-.12 5.2-2.15 6.15-4.63l.97-2.53c.04-.1.05-.21.02-.32C18.03 1.17 14.6.17 12.05.17 5.65.17.4 5.23.4 11.64a13.8 13.8 0 00.12 1.82 11.6 11.6 0 0010.3 9.5l4.56-4.2z" fill="currentColor"/>
        <text x="24" y="16" fontFamily="sans-serif" fontWeight="700" fontSize="10">Cloudflare</text>
      </svg>
    ),
  },
  {
    id: 'supabase',
    name: 'Supabase',
    ariaLabel: 'Parceiro tecnológico: Supabase (banco Postgres e auth)',
    svg: (
      <svg viewBox="0 0 140 32" className="h-6 w-auto text-gray-400 hover:text-[#3ECF8E] transition-colors" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M18 30l14-16-8-1V2L10 18l8 1v11z"/>
        <text x="40" y="21" fontFamily="sans-serif" fontWeight="700" fontSize="13">Supabase</text>
      </svg>
    ),
  },
  {
    id: 'vercel',
    name: 'Vercel',
    ariaLabel: 'Parceiro tecnológico: Vercel (hosting do frontend)',
    svg: (
      <svg viewBox="0 0 100 22" className="h-5 w-auto text-gray-400 hover:text-black transition-colors" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M11 0l11 19H0L11 0zm21 4h4v3h.1C36.9 5.5 38.5 4 41 4c3.9 0 5.8 2.6 5.8 6.5V20h-4v-8.5c0-2.5-.7-4-2.9-4-2.1 0-3.5 1.7-3.5 4V20h-4V4zm19.3 0h4L58 14.3 62.7 4h4l-7 16h-4.5l-7-16zM75 4v16h-4V4h4zm-2-3a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM85 4h4v2.7c.9-2 2.8-3 4.8-3v3.8c-3.1 0-4.8 1.7-4.8 4.8V20h-4V4zm14 0v16h-4V4h4zm-2-3a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"/>
      </svg>
    ),
  },
];

export function SocialProof() {
  return (
    <section className="py-16 lg:py-20 border-y border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* ─── Parceiros tecnológicos (enquanto BLOCKER B-02 não libera logos de cliente) ─── */}
        <div className="mb-12">
          <p className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-[0.18em] mb-5">
            Parceiros tecnológicos e integrações nativas
          </p>
          <div
            role="list"
            aria-label="Lista de parceiros tecnológicos ZappIQ"
            className="flex flex-wrap justify-center items-center gap-x-10 gap-y-6 opacity-90"
          >
            {PARTNER_LOGOS.map((p) => (
              <div
                key={p.id}
                role="listitem"
                aria-label={p.ariaLabel}
                title={`${p.name} · Integração nativa`}
                className="grayscale hover:grayscale-0 transition-all"
              >
                {p.svg}
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-5 max-w-2xl mx-auto">
            Logos de parceiros tecnológicos com integração nativa. Logos de clientes reais estarão
            disponíveis após autorização formal LGPD (Art. 7, item IX).
          </p>
        </div>

        {/* ─── Badge Meta (via BSP, qualificação V2-017) ─── */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-200 px-6 py-3 rounded-full">
            <svg width="24" height="24" viewBox="0 0 256 256" className="flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M128 20C68.4 20 20 68.4 20 128s48.4 108 108 108 108-48.4 108-108S187.6 20 128 20z" fill="#0081FB"/>
              <path d="M90.3 130.3c0-16.5 4.4-30 11.2-38.8 8.2-10.6 19.8-15.4 30.6-15.4 8.6 0 15.4 2.6 20.8 7.4 5.6 4.8 10 12.2 13 22.2 2.6 8.8 4 19.6 4 32.8 0 14.6-2.6 27-7.2 36.4-5.6 11.4-14 17.4-24.6 17.4-10.4 0-19.4-6.2-26-17.4-7.2-12.2-11.8-27.4-11.8-44.6zm-24.6-4.6c0 24.6 7 44.2 17.6 58 12.2 15.8 28.6 24.4 44.8 24.4 18.2 0 33.2-10.4 43-27.6 8.8-15.4 13.8-36 13.8-59.2 0-20.2-4.2-37.4-12.4-50.4-10-15.8-25-25-42.4-25-18.8 0-34 10.6-44 27.2-9 15-20.4 33.4-20.4 52.6z" fill="white"/>
            </svg>
            <div>
              <p className="text-sm font-bold text-gray-900">Parceria WhatsApp Business via BSP homologado Meta</p>
              <p className="text-xs text-gray-500">
                <a href="/legal/parceria-meta" className="underline hover:text-primary-600">
                  Como funciona a parceria
                </a>
              </p>
            </div>
            <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        {/* ─── Trust Signals ─── */}
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Por que ZappIQ</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">Construído para empresas que levam WhatsApp a sério</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TRUST_SIGNALS.map((s) => (
            <div key={s.title} className="bg-white rounded-2xl border border-gray-200 p-7 hover:shadow-lg transition-shadow flex flex-col">
              <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center mb-4`}>
                <s.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm flex-1">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
