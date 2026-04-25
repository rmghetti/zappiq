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
            Oito motivos pra escolher ZappIQ.{' '}
            <span className="text-grad">Todos viram dinheiro no seu caixa.</span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-muted leading-relaxed">
            A gente não vende promessa bonita. A gente vende escolha técnica séria,
            contrato direto com o WhatsApp e preço que não te pega de surpresa no final do mês.
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
              Integração oficial com o WhatsApp. Seu número é seu.
            </h3>
            <p className="text-[14.5px] text-muted leading-relaxed mb-6">
              Seu WhatsApp, sua conta, seu nome. A gente liga direto na infraestrutura oficial —
              sem atravessador, sem taxa de intermediário, sem risco de perder seu número se
              mudarmos de fornecedor. E quando precisar de suporte, é direto.
            </p>
            {/* mini-visual: fluxo arquitetural */}
            <div className="flex items-center gap-3 text-[11.5px] font-mono text-muted">
              <div className="px-3 py-2 rounded-[10px] border border-line bg-white">Seu cliente</div>
              <div className="flex-1 h-px bg-gradient-to-r from-line via-accent/40 to-line" />
              <div className="px-3 py-2 rounded-[10px] bg-grad text-white font-medium">WhatsApp oficial</div>
              <div className="flex-1 h-px bg-gradient-to-r from-line via-accent/40 to-line" />
              <div className="px-3 py-2 rounded-[10px] border border-line bg-white">ZappIQ</div>
            </div>
            <div className="mt-3 text-[11px] text-muted">
              <span className="text-[#2FB57A]">✓</span> Integração oficial direta — sem camada no meio
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
              A mesma IA que Fortune 500 usa. Pro seu negócio.
            </h3>
            <p className="text-[13.5px] text-muted leading-relaxed mb-5">
              A Iza roda sobre a IA mais avançada do planeta — a mesma que grandes empresas
              globais usam. Seus dados não viram treino. E se um provedor cair, o outro assume.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full border border-line text-[11px] text-ink font-medium">IA de classe mundial</span>
              <span className="px-2.5 py-1 rounded-full bg-bg-soft text-[11px] text-muted">Nunca cai</span>
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
              LGPD resolvida. Seu jurídico agradece.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed mb-4">
              A gente nasceu LGPD-first. Contrato de privacidade (DPA) pronto em 2 cliques,
              encarregado de dados acessível, e seu cliente pode pedir pra apagar os dados dele
              em 48 horas — tudo pela plataforma.
            </p>
            <ul className="space-y-1.5 text-[12px] text-muted">
              <li className="flex items-center gap-2"><Check size={12} className="text-[#2FB57A]" /> Direitos do titular resolvidos</li>
              <li className="flex items-center gap-2"><Check size={12} className="text-[#2FB57A]" /> Registro auditável de operações</li>
              <li className="flex items-center gap-2"><Check size={12} className="text-[#2FB57A]" /> Resposta a incidentes em até 72h</li>
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
              Você enxerga tudo. Em tempo real.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed mb-4">
              Quantos atendimentos a Iza fechou hoje, quanto converteu, quanto você gastou,
              qual fila está travada. Tudo num dashboard executivo — sem precisar de analista.
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
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-[10px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                <Zap size={16} className="text-ink" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">05 · Setup</span>
            </div>
            <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
              Sem consultor. Sem mês de implantação.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed mb-4">
              Um formulário guiado de 30 a 90 minutos e você ativa sozinho. O mercado cobra
              de R$ 3 a 8 mil só pra começar. A gente cobra zero.
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
              Seus dados, no Brasil. Ponto.
            </h3>
            <p className="text-[13px] text-muted leading-relaxed">
              Tudo processado e armazenado em servidor brasileiro. Rápido pro seu cliente
              e dentro da LGPD por padrão. Se algum dado precisar sair do país, só com sua
              autorização expressa.
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
                Zero surpresa no boleto.
              </h3>
              <p className="text-[13px] text-muted leading-relaxed">
                Mensalidade fixa. A gente não cobra por conversa, não tem taxa escondida,
                não inventa "janela de 24h" pra pesar no final do mês. O que você vê é o que paga.
              </p>
            </div>
            <div className="card-soft p-7 relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-[10px] bg-[#F2F0EA] border border-line flex items-center justify-center">
                  <Mic size={16} className="text-ink" />
                </div>
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">08 · Voz</span>
              </div>
              <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
                Cliente mandou áudio? A IA entende e responde.
              </h3>
              <p className="text-[13px] text-muted leading-relaxed">
                Seu cliente é brasileiro, manda áudio. A Iza entende tudo
                <span className="font-semibold text-ink"> sem custo extra</span>. Quer que ela
                responda falando? Ativa voz por <span className="font-semibold text-ink">R$ 197</span>
                ou <span className="font-semibold text-ink">R$ 597</span>/mês.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
