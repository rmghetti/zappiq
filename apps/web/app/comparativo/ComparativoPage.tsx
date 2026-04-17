'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, X, Minus, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { SavingsCalculator } from '../../components/shared/SavingsCalculator';
import { PLAN_CONFIG } from '@zappiq/shared';

/** Preços derivados de planConfig.ts (single source of truth) */
const STARTER_PRICE = PLAN_CONFIG.STARTER.priceMonthly!;
const BUSINESS_PRICE = PLAN_CONFIG.BUSINESS.priceMonthly!;
const ENTERPRISE_MIN = '9.9k'; // Enterprise é sob consulta — baseline do modelo comercial

/* ═════════════════════════════════════════════════════════════════════
 * Página /comparativo — versão 2026.04 (Launch)
 *
 * Objetivo: deixar explícito que competidores cobram setup fee e exigem
 * consultor para treinar a IA, enquanto ZappIQ é 100% self-service.
 * Replica a estrutura do battle card comercial (docs/gtm/BATTLE-CARD.md).
 * ═════════════════════════════════════════════════════════════════════ */

type CellValue = 'yes' | 'no' | 'partial' | string;

type Row = {
  feature: string;
  zappiq: CellValue;
  blip: CellValue;
  huggy: CellValue;
  zenvia: CellValue;
  poli: CellValue;
  emphasis?: boolean;
};

const COMPETITORS = [
  { key: 'zappiq' as const, label: 'ZappIQ', tag: 'self-service', highlight: true },
  { key: 'blip' as const, label: 'Blip', tag: 'enterprise' },
  { key: 'huggy' as const, label: 'Huggy', tag: 'mid-market' },
  { key: 'zenvia' as const, label: 'Zenvia', tag: 'enterprise' },
  { key: 'poli' as const, label: 'Poli', tag: 'SMB' },
];

const ROWS: Row[] = [
  // Preço e fricção financeira
  { feature: 'Setup fee / taxa de implantação', zappiq: 'R$ 0', blip: 'R$ 8k–15k', huggy: 'R$ 3k–8k', zenvia: 'R$ 10k+', poli: 'R$ 1,5k–5k', emphasis: true },
  { feature: 'Mensalidade de entrada', zappiq: `R$ ${STARTER_PRICE}`, blip: 'R$ 1.800+', huggy: 'R$ 489+', zenvia: 'R$ 2.500+', poli: 'R$ 249+' },
  { feature: 'Trial gratuito', zappiq: '21 dias', blip: 'Não', huggy: '7 dias', zenvia: 'Não', poli: '7 dias' },
  { feature: 'Exige cartão no trial', zappiq: 'no', blip: '—', huggy: 'yes', zenvia: '—', poli: 'yes' },

  // Treinamento da IA — pilar do storytelling
  { feature: 'Cliente treina a IA sozinho', zappiq: 'yes', blip: 'no', huggy: 'partial', zenvia: 'no', poli: 'partial', emphasis: true },
  { feature: 'Consultor/squad obrigatório', zappiq: 'no', blip: 'yes', huggy: 'partial', zenvia: 'yes', poli: 'partial', emphasis: true },
  { feature: 'Survey guiado por segmento', zappiq: 'yes', blip: 'no', huggy: 'no', zenvia: 'no', poli: 'no' },
  { feature: 'Upload de PDF / contratos / URL', zappiq: 'yes', blip: 'partial', huggy: 'partial', zenvia: 'partial', poli: 'no' },
  { feature: 'Editor de Q&A sem código', zappiq: 'yes', blip: 'partial', huggy: 'yes', zenvia: 'partial', poli: 'partial' },
  { feature: 'AI Readiness Score em tempo real', zappiq: 'yes', blip: 'no', huggy: 'no', zenvia: 'no', poli: 'no', emphasis: true },

  // Tempo até valor
  { feature: 'Time-to-first-message', zappiq: '< 30 min', blip: '30–60 dias', huggy: '7–15 dias', zenvia: '45–90 dias', poli: '5–10 dias' },
  { feature: 'Time-to-IA-pronta', zappiq: '< 24h', blip: '60–120 dias', huggy: '15–30 dias', zenvia: '90–180 dias', poli: '15–30 dias' },

  // Core técnico
  { feature: 'WhatsApp Business API oficial', zappiq: 'yes', blip: 'yes', huggy: 'yes', zenvia: 'yes', poli: 'yes' },
  { feature: 'Multicanal (WA + IG + FB)', zappiq: 'yes', blip: 'yes', huggy: 'yes', zenvia: 'yes', poli: 'partial' },
  { feature: 'RAG nativo (IA aprende docs)', zappiq: 'yes', blip: 'partial', huggy: 'no', zenvia: 'partial', poli: 'no' },
  { feature: 'CRM integrado', zappiq: 'yes', blip: 'partial', huggy: 'yes', zenvia: 'partial', poli: 'yes' },
  { feature: 'Campanhas broadcast', zappiq: 'yes', blip: 'yes', huggy: 'partial', zenvia: 'yes', poli: 'partial' },
  { feature: 'Flow builder visual', zappiq: 'yes', blip: 'yes', huggy: 'yes', zenvia: 'yes', poli: 'partial' },

  // Confiança e observabilidade
  { feature: 'LGPD com ROP assinado', zappiq: 'yes', blip: 'yes', huggy: 'partial', zenvia: 'yes', poli: 'partial' },
  { feature: 'SLA público contratual', zappiq: 'yes', blip: 'partial', huggy: 'no', zenvia: 'yes', poli: 'no' },
  { feature: 'Observabilidade p/ cliente final', zappiq: 'yes', blip: 'no', huggy: 'no', zenvia: 'partial', poli: 'no', emphasis: true },
  { feature: 'Página pública de status', zappiq: 'yes', blip: 'partial', huggy: 'no', zenvia: 'yes', poli: 'no' },

  // Cap trial (protege cliente)
  { feature: 'Cap de custo no trial', zappiq: 'US$ 15', blip: '—', huggy: '—', zenvia: '—', poli: '—' },
];

/* ------------------------------------------------------------------ */
function CellContent({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  if (value === 'yes') {
    return (
      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${highlight ? 'bg-primary-100 text-primary-600' : 'bg-green-100 text-green-600'}`}>
        <Check size={16} strokeWidth={3} />
      </span>
    );
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-500">
        <X size={16} strokeWidth={3} />
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
        <Minus size={14} /> Parcial
      </span>
    );
  }
  return <span className={`text-sm font-semibold ${highlight ? 'text-primary-700' : 'text-gray-700'}`}>{value}</span>;
}

/* ------------------------------------------------------------------ */
/* Objeções — FAQ estilo battle card                                  */
/* ------------------------------------------------------------------ */

const OBJECTIONS = [
  {
    q: 'Se não tem consultor, quem vai ajudar minha equipe?',
    a: 'A própria plataforma. Survey guiado por segmento, upload de documentos com drag-and-drop, editor de Q&A em linguagem natural e AI Readiness Score mostrando o que falta a cada passo. Em caso de dúvida específica, o time de suporte responde em menos de 2 horas úteis — sem cobrar consultoria.',
  },
  {
    q: 'Setup fee não garante qualidade da implantação?',
    a: 'Não. Setup fee nasceu quando integrar WhatsApp era um problema de TI. Hoje é um modelo de cobrança, não de valor. Quem cobra setup fee vende horas de consultoria terceirizada para transcrever o que você já sabe sobre o seu negócio. Com self-service, você transfere esse conhecimento direto — e mantém o controle.',
  },
  {
    q: 'Preciso de IA enterprise. ZappIQ atende?',
    a: `Sim. O tier Business (R$ ${BUSINESS_PRICE.toLocaleString('pt-BR')}) e Enterprise (a partir de R$ ${ENTERPRISE_MIN}) entregam multi-tenant, SLA contratual, observabilidade dedicada, RAG isolado, SSO e auditoria LGPD. A única diferença: o setup continua self-service. Se o cliente Enterprise quiser consultoria, ela é opcional e precificada à parte, sem amarrar o contrato principal.`,
  },
  {
    q: 'O trial de 21 dias é suficiente para avaliar?',
    a: 'Sim. Nossos dados mostram que quem configura a IA nos primeiros 3 dias chega a AI Readiness Score ≥ 60 em menos de 24 horas e mede resultados reais até o 7º dia. Os 21 dias existem para você validar volume real de atendimento, não para empurrar decisão. O cap de US$ 15 em LLM no trial protege você de surpresa na conversão.',
  },
  {
    q: 'E se minha equipe não for técnica?',
    a: 'Melhor ainda. A UX foi desenhada para gestor comercial, atendimento e CX — não para TI. Quem sobe documento é quem conhece o produto. Quem escreve Q&A é quem atende o cliente todo dia. TI só entra se você quiser integrar com um ERP legado — e nesse caso usamos API pública documentada.',
  },
  {
    q: 'Por que o competidor X cobra mais caro?',
    a: 'Três motivos: (1) estrutura de vendas com BDR, AE, SDR e consultoria — headcount caro; (2) modelo antigo de contrato anual com setup fee; (3) infra legada que precisa ser mantida. ZappIQ foi construída para escalar via produto, não via pessoas. A economia vai direto para o cliente.',
  },
  {
    q: 'Como comparo ROI real?',
    a: 'Use a calculadora acima com os números que você recebeu do competidor. No primeiro ano, a economia média nos cotações recebidas fica entre 60% e 85%. A partir do segundo ano, compare a mensalidade pura — o setup fee some da conta, mas não some o fato de que o consultor cobra reativo para qualquer mudança de IA. Na ZappIQ, você muda em tempo real.',
  },
];

function ObjectionItem({ q, a, i }: { q: string; a: string; i: number }) {
  const [open, setOpen] = useState(i === 0);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <span className="font-semibold text-gray-900">{q}</span>
        <span className={`text-primary-600 text-xl font-bold transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-gray-600 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export function ComparativoPage() {
  return (
    <PublicLayout>
      {/* ───────── Hero ───────── */}
      <div className="max-w-7xl mx-auto px-6 pt-10 mb-16">
        <div className="text-center max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold uppercase tracking-wider mb-5">
            <Sparkles size={14} /> Comparativo transparente
          </span>
          <h1 className="font-display text-4xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-5">
            Concorrentes cobram R$ 3k–15k só para treinar a IA.<br className="hidden md:block" />
            <span className="text-primary-600">Na ZappIQ, R$ 0.</span>
          </h1>
          <p className="text-lg text-gray-500 mb-8">
            Você treina sua IA de conversação sozinho — survey guiado, upload de documentos, editor de Q&A e Readiness Score em tempo real.
            Sem consultor. Sem setup fee. Sem espera.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-7 py-3.5 rounded-xl shadow-lg shadow-primary-500/30 transition-colors"
            >
              Testar 21 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="#calculadora"
              className="inline-flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-primary-300 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-colors"
            >
              Calcular minha economia
            </Link>
          </div>
        </div>
      </div>

      {/* ───────── Pilares ───────── */}
      <div className="max-w-6xl mx-auto px-6 mb-20 grid md:grid-cols-3 gap-4">
        {[
          { icon: Zap, title: 'Setup fee = R$ 0', desc: 'Mensalidade é tudo. Nada escondido. Nada cobrado a mais para ligar a IA.' },
          { icon: Sparkles, title: 'Você treina em minutos', desc: 'Survey, upload e Q&A. Sem consultor, sem prompt engineering, sem espera.' },
          { icon: ShieldCheck, title: 'LGPD + SLA + Observabilidade', desc: 'Transparência contratual e métricas abertas desde o dia 1. Nada vendido como add-on.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
              <Icon className="text-primary-600" size={22} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </div>

      {/* ───────── Tabela comparativa ───────── */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
            ZappIQ vs. Blip, Huggy, Zenvia, Poli
          </h2>
          <p className="text-gray-500">
            Baseado em tabelas públicas de preço e cotações recebidas de clientes em março/abril de 2026. Verificável e atualizável.
          </p>
        </div>

        {/* Desktop */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
            <div className="grid grid-cols-6 bg-[#F8FAF9]">
              <div className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Critério</div>
              {COMPETITORS.map((col) => (
                <div
                  key={col.key}
                  className={`px-5 py-4 text-center ${col.highlight ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white' : 'text-gray-700'}`}
                >
                  <div className="text-sm font-bold">{col.label}</div>
                  <div className={`text-[10px] mt-0.5 uppercase tracking-wider ${col.highlight ? 'text-primary-100' : 'text-gray-400'}`}>
                    {col.tag}
                  </div>
                </div>
              ))}
            </div>

            {ROWS.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-6 border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAF9]'} ${row.emphasis ? 'ring-1 ring-inset ring-primary-100' : ''}`}
              >
                <div className={`px-5 py-4 text-sm flex items-center ${row.emphasis ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {row.feature}
                </div>
                {COMPETITORS.map((col) => (
                  <div
                    key={col.key}
                    className={`px-5 py-4 flex items-center justify-center text-center ${col.highlight ? 'bg-primary-50/60' : ''}`}
                  >
                    <CellContent value={row[col.key]} highlight={col.highlight} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden space-y-4">
          {ROWS.map((row) => (
            <div key={row.feature} className={`bg-white rounded-xl border p-5 ${row.emphasis ? 'border-primary-300' : 'border-gray-200'}`}>
              <p className={`text-sm mb-3 ${row.emphasis ? 'font-bold text-primary-700' : 'font-bold text-gray-900'}`}>{row.feature}</p>
              <div className="grid grid-cols-2 gap-3">
                {COMPETITORS.map((col) => (
                  <div key={col.key} className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${col.highlight ? 'text-primary-600' : 'text-gray-500'}`}>{col.label}:</span>
                    <CellContent value={row[col.key]} highlight={col.highlight} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-8 flex flex-wrap items-center gap-6 justify-center text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600"><Check size={12} strokeWidth={3} /></span>
            Incluso de origem
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500"><X size={12} strokeWidth={3} /></span>
            Não incluso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-600"><Minus size={12} /></span>
            Parcial, add-on pago ou só Enterprise
          </span>
        </div>
      </div>

      {/* ───────── Calculadora ───────── */}
      <section id="calculadora" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
              Quanto você economiza no primeiro ano?
            </h2>
            <p className="text-gray-500">
              Cole o número da cotação que você recebeu. A ZappIQ Starter serve para tickets médios e volumes de PME.
            </p>
          </div>
          <SavingsCalculator />
        </div>
      </section>

      {/* ───────── Objeções ───────── */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-2">Objeções que surgem na cotação</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">
              Respostas diretas — sem floreio
            </h2>
          </div>
          <div className="space-y-3">
            {OBJECTIONS.map((o, i) => (
              <ObjectionItem key={o.q} q={o.q} a={o.a} i={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA final ───────── */}
      <section className="py-24 bg-[#1A1A2E]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-white mb-5">
            Pare de pagar pela <span className="text-primary-400">implantação</span>.
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Em menos de 30 minutos sua IA já está respondendo. Sem consultor. Sem setup fee. Sem amarração contratual.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-primary-500/30 text-base"
            >
              Treinar minha IA agora <ArrowRight size={18} />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-colors backdrop-blur text-base"
            >
              Ver demo em 3 min
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-6">
            21 dias grátis · sem cartão · cap de custo no trial · cancelamento em 1 clique
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
