'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * PorQueZappIQ — Design V4 (bento asymmetric · Chatbase-style)
 * --------------------------------------------------------------------------
 * Substitui a grade chata 4×2 por bento assimétrico com mini-visuais
 * dentro de cada card. Mantém as 8 razões V3.2 (Cloud API Meta, IA Claude,
 * LGPD, Observabilidade, Onboarding zero, Infra BR, Preço previsível,
 * Voz nativa) mas reordenadas por peso visual.
 *
 * Layout:
 *   row 1 (lg:grid-cols-5) → col-span-3 (big) + col-span-2 (médio)
 *   row 2 (lg:grid-cols-3) → 3 cards iguais
 *   row 3 (lg:grid-cols-5) → col-span-2 + col-span-3
 * ══════════════════════════════════════════════════════════════════════════ */

import {
  ShieldCheck,
  Sparkles,
  Lock,
  Activity,
  Zap,
  Server,
  Wallet,
  Mic,
  Check,
} from 'lucide-react';

export function PorQueZappIQ() {
  return (
    <section id="por-que-zappiq" className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Por que ZappIQ</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            Oito decisões de arquitetura.{' '}
            <span className="text-grad">Zero feature cosmética.</span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-muted leading-relaxed">
            Não vendemos promessa. Vendemos escolhas de engenharia, contrato com a Meta
            e modelo de preço que não te surpreende no boleto do mês que vem.
          </p>
        </div>

        {/* Row 1: Cloud API Meta (big) + IA Claude/OpenAI */}
        <div className="grid lg:grid-cols-5 gap-5 mb-5">
          {/* Cloud API direto Meta — hero card */}
          <div className="lg:col-span-3 card-soft p-8 lg:p-10 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-[10px] bg-grad flex items-center justify-center shadow-[0_8px_16px_-8px_rgba(74,82,208,0.4)]">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">01 · Infra</span>
            </div>
            <h3 className="text-[24px] lg:text-[28px] font-medium text-ink leading-tight tracking-tight mb-3">
              Cloud API direto da Meta. Sem BSP no meio.
            </h3>
            <p className="text-[14.5px] text-muted leading-relaxed mb-6">
              Você é titular do seu WABA. Zero markup de intermediário. Zero risco de perder
              a conta se trocarmos de provedor. Suporte vem direto da Meta quando precisa.
            </p>
            {/* mini-visual: fluxo arquitetural */}
            <div className="flex items-center gap-3 text-[11.5px] font-mono text-muted">
              <div className="px-3 py-2 rounded-[10px] border border-line bg-white">Seu cliente</div>
              <div className="flex-1 h-px bg-gradient-to-r from-line via-accent/40 to-line" />
              <div className="px-3 py-2 rounded-[10px] bg-grad text-white font-medium">Meta Cloud API</div>
              <div className="flex-1 h-px bg-gradient-to-r from-line via-accent/40 to-line" />
              <div className="px-3 py-2 rounded-[10px] border border-line bg-white">ZappIQ</div>
            </div>
            <div className="mt-3 text-[11px] text-muted">
              <span className="text-[#2FB57A]">✓</span> Parceiro oficial Meta · sem camada adicional
            </div>
          </div>

          {/* IA Anthropic + OpenAI */}
          <div className="lg:col-span-2 card-soft p-8 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-[10px] bg-ink flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">02 · Modelos</span>
            </div>
            <h3 className="text-[20px] lg:text-[22px] font-medium text-ink leading-tight tracking-tight mb-3">
              Claude Sonnet & GPT-4. Em produção.
            </h3>
            <p className="text-[13.5px] text-muted leading-relaxed mb-5">
              Mesmos modelos que Fortune 500 roda. Zero treinamento nos seus dados.
              Fallback automático entre provedores.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full border border-line text-[11px] text-ink font-medium">Anthropic Claude</span>
              <span className="px-2.5 py-1 rounded-full border border-line text-[11px] text-ink font-medium">OpenAI GPT-4</span>
              <span className="px-2.5 py-1 rounded-full bg-bg-soft text-[11px] text-muted">+ fallback auto</span>
            </div>
          </div>
        </div>

        {/* Row 2: 3 cards iguais — LGPD, Observabilidade, Onboarding zero */}
        <div className="grid lg:grid-cols-3 gap-5 mb-5">
          {/* LGPD */}
          <div className="card-soft p-7">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-[10px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                <Lock size={16} className="text-ink" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">03 · Compliance</span>
            </div>
            <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
              LGPD desde o onboarding.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed mb-4">
              DPO acessível, sub-processadores listados, DSR self-service em até 48h úteis.
              DPA assinável em 2 cliques.
            </p>
            <ul className="space-y-1.5 text-[12px] text-muted">
              <li className="flex items-center gap-2"><Check size={12} className="text-[#2FB57A]" /> Art. 18 · direitos do titular</li>
              <li className="flex items-center gap-2"><Check size={12} className="text-[#2FB57A]" /> Art. 37 · registro de operações</li>
              <li className="flex items-center gap-2"><Check size={12} className="text-[#2FB57A]" /> Art. 48 · incidentes &lt; 48h</li>
            </ul>
          </div>

          {/* Observabilidade */}
          <div className="card-soft p-7">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-[10px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                <Activity size={16} className="text-ink" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">04 · Radar 360°</span>
            </div>
            <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
              Observabilidade completa.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed mb-4">
              Métricas em tempo real, PostHog integrado, Sentry para falhas, forecast ML
              de churn/receita.
            </p>
            {/* mini sparkline */}
            <svg viewBox="0 0 200 40" className="w-full h-10" aria-hidden>
              <defs>
                <linearGradient id="sparkGrad" x1="0" x2="1">
                  <stop offset="0" stopColor="#2FB57A" />
                  <stop offset="0.5" stopColor="#2F7FB5" />
                  <stop offset="1" stopColor="#4A52D0" />
                </linearGradient>
              </defs>
              <polyline
                points="0,30 20,25 40,28 60,18 80,20 100,12 120,15 140,8 160,10 180,5 200,7"
                fill="none"
                stroke="url(#sparkGrad)"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* Onboarding zero */}
          <div className="card-soft p-7 relative">
            <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-grad text-white text-[10px] font-semibold tracking-wide">
              NOVO V3.2
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-[10px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                <Zap size={16} className="text-ink" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">05 · Setup</span>
            </div>
            <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
              Onboarding zero. 30–90 min.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed mb-4">
              Survey self-service. Sem consultor. Sem setup fee de R$ 3–8k que outros cobram
              só pra fingir que implantam.
            </p>
            <div className="flex items-center gap-2 text-[12px] font-mono">
              <span className="text-muted line-through">R$ 3.000–8.000</span>
              <span className="text-[#2FB57A] font-semibold">R$ 0</span>
            </div>
          </div>
        </div>

        {/* Row 3: Infra BR (médio) + Preço + Voz (duas colunas) */}
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Infra Brasil */}
          <div className="lg:col-span-2 card-soft p-7">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-[10px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                <Server size={16} className="text-ink" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">06 · Dados BR</span>
            </div>
            <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
              Dados processados em São Paulo.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed">
              AWS sa-east-1. Latência baixa, compliance LGPD por default.
              Transferência internacional? Só com seu opt-in explícito.
            </p>
          </div>

          {/* Preço previsível + Voz nativa empilhados */}
          <div className="lg:col-span-3 grid sm:grid-cols-2 gap-5">
            <div className="card-soft p-7">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-[10px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                  <Wallet size={16} className="text-ink" />
                </div>
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">07 · Pricing</span>
              </div>
              <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
                Preço previsível.
              </h3>
              <p className="text-[13px] text-muted leading-relaxed">
                Mensalidade fixa. Sem cobrança por conversa surpresa, sem overage
                escondido, sem janela de 24h inventada.
              </p>
            </div>
            <div className="card-soft p-7 relative">
              <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-grad text-white text-[10px] font-semibold tracking-wide">
                NOVO V3.2
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-[10px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                  <Mic size={16} className="text-ink" />
                </div>
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">08 · Voz</span>
              </div>
              <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
                Voz nativa. Inbound incluso.
              </h3>
              <p className="text-[13px] text-muted leading-relaxed">
                Transcrição de áudio: grátis. TTS outbound opcional:
                <span className="font-semibold text-ink"> R$ 197</span> ou
                <span className="font-semibold text-ink"> R$ 597</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
