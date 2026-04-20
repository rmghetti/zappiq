import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'ZappIQ Partners — Programa de Parceiros (Integradores & Agências)',
  description:
    'Programa ZappIQ Partners: comissão recorrente até 30%, co-marketing, stack técnico e sandbox. Vagas limitadas no cohort de pré-lançamento.',
};

/* V2-052 · V2-043: página /parceiros com Programa ZappIQ Partners.
 * Fonte canônica: /gtm/partners_program_v1.md. Quando o programa for
 * oficializado, renderizar termos completos + aplicativo online. */

const TIERS = [
  {
    tier: 'Authorized',
    commission: '10%',
    desc: 'Integrador ou agência que fecha até R$ 5k MRR/mês em contas ZappIQ. Recebe materiais de marketing, acesso sandbox e suporte via email.',
  },
  {
    tier: 'Preferred',
    commission: '20%',
    desc: 'Parceiros com R$ 5–25k MRR/mês ou expertise vertical comprovada (saúde, varejo, SaaS, educação). Ganha co-marketing, ajuda em deals Enterprise e NPS joint ownership.',
  },
  {
    tier: 'Elite',
    commission: '30%',
    desc: 'Parceiros estratégicos (R$ 25k+ MRR/mês) com track record de implantação. Tem Account Manager dedicado, roadmap compartilhado e direito a revenda white-label seletiva.',
  },
];

const BENEFITS = [
  'Comissão recorrente mensal (não one-time) pelo tempo que o cliente permanecer ativo',
  'Sandbox técnico com dados anonimizados para treinamento e POC',
  'Materiais de co-marketing em pt-BR (case studies, one-pagers, pitch decks)',
  'Suporte de pré-vendas técnica em deals acima de R$ 10k MRR',
  'Programa de certificação técnica ZappIQ (4 módulos, 16h total)',
  'Acesso antecipado a novos módulos e features em beta',
];

export default function ParceirosPage() {
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Programa de Parceiros</p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          ZappIQ Partners — construa receita recorrente vendendo a plataforma brasileira de inteligência conversacional.
        </h1>
        <p className="text-lg text-gray-500 mb-12 max-w-3xl">
          Programa estruturado em 3 tiers com comissão recorrente, co-marketing, stack técnico e sandbox.
          Cohort de pré-lançamento aberto até 30/04/2026 com condições especiais de onboarding.
        </p>

        <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-6">Tiers e comissões</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {TIERS.map((t) => (
            <div key={t.tier} className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t.tier}</p>
              <p className="font-display text-4xl font-extrabold text-primary-600 mb-3">{t.commission}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-6">Benefícios</h2>
        <ul className="space-y-3 mb-16">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-3 text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold mt-0.5">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <section className="bg-gradient-to-br from-[#F8FAF9] to-white rounded-2xl border border-gray-200 p-10 mb-12">
          <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-4">ICP ideal para parceiros</h2>
          <p className="text-gray-600 mb-4">
            Procuramos integradores e agências com (a) ≥ 10 clientes PME ativos, (b) expertise comprovada
            em ao menos um vertical (saúde, varejo, SaaS, educação, automotivo), (c) capacidade de entregar
            onboarding técnico de WhatsApp Business em 5 dias úteis, e (d) fit cultural com nossa rejeição
            a setup fees abusivos e lock-in proprietário.
          </p>
          <p className="text-sm text-gray-500">
            <strong>Anti-ICP:</strong> agências puras de performance sem expertise conversacional, revendas
            de múltiplas plataformas concorrentes no mesmo pipeline, ou parceiros que cobram setup fee
            acima de R$ 5k sem entrega técnica correspondente.
          </p>
        </section>

        <div className="bg-[#1A1A2E] rounded-2xl p-10 text-white text-center">
          <h2 className="font-display text-2xl font-bold mb-3">Aplicar para o cohort pré-lançamento</h2>
          <p className="text-gray-400 mb-6">
            Enviamos onboarding técnico + certificação gratuita para os primeiros 20 parceiros homologados.
          </p>
          <a
            href="mailto:partners@zappiq.com.br?subject=Aplica%C3%A7%C3%A3o%20ZappIQ%20Partners%202026"
            className="inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors"
          >
            partners@zappiq.com.br
          </a>
          <p className="text-xs text-gray-500 mt-4">
            Ou fale com{' '}
            <Link href="/contato" className="text-gray-300 hover:text-white underline">nosso time comercial</Link>.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
