import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Carreiras na ZappIQ — Trabalhe com Inteligência Conversacional',
  description:
    'Vagas na ZappIQ: engenharia (backend/frontend), IA, pré-vendas, sucesso do cliente, marketing e compliance. Remote-first, base em São Paulo.',
};

/* V2-033: página /carreiras obrigatória no footer. Posições ativas são
 * mantidas em /apps/web/content/careers.ts (fonte única); quando vagas reais
 * forem abertas, adicionar items ao array e substituir o modo "pipeline". */

const AREAS = [
  {
    name: 'Engenharia',
    desc: 'Backend Node/TypeScript (Express, Prisma, Postgres, pgvector), frontend Next.js 14, infra Fly.io/Vercel, plataforma de observabilidade (OpenTelemetry + Grafana).',
  },
  {
    name: 'Inteligência Artificial',
    desc: 'Aplicações LLM em produção (Claude, GPT-4o), RAG (FastAPI), pipelines de eval e guardrails, modelagem de conversas utility vs marketing.',
  },
  {
    name: 'Pré-vendas técnica',
    desc: 'Arquitetura de soluções, POC, demos técnicas, apoio em RFPs Enterprise, benchmark contra incumbentes.',
  },
  {
    name: 'Sucesso do cliente',
    desc: 'Onboarding self-service + alto-toque Enterprise, CSM de expansão, playbooks anti-churn, CSAT ≥ 4.5.',
  },
  {
    name: 'Marketing & conteúdo',
    desc: 'Growth B2B PME, content ops, SEO técnico, social/ads, parcerias de conteúdo (Meta, Anthropic, Stripe).',
  },
  {
    name: 'Compliance & jurídico',
    desc: 'LGPD, DPA, privacy engineering, contratos SaaS, relacionamento com ANPD, gestão de DPO externo.',
  },
];

export default function CarreirasPage() {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Carreiras</p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Construa a plataforma de inteligência conversacional que PMEs brasileiras realmente merecem.
        </h1>
        <p className="text-lg text-gray-500 mb-10">
          Somos remote-first com sede operacional em São Paulo. Estamos em processo de pré-lançamento e
          montando o núcleo de ZappIQ — engenharia, IA, GTM e compliance.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-12">
          <h2 className="font-display text-lg font-bold text-gray-900 mb-2">Status: pipeline de talento aberto</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Ainda não estamos divulgando vagas nominais públicas — preferimos conversar antes para avaliar
            fit cultural e técnico. Se alguma das áreas abaixo conversa com sua experiência,{' '}
            <a href="mailto:carreiras@zappiq.com.br" className="text-primary-600 hover:underline">
              envie um email com CV/portfolio/LinkedIn
            </a>{' '}
            — respondemos toda triagem ativa, positivo ou negativo, em até 7 dias.
          </p>
        </div>

        <h2 className="font-display text-2xl font-bold text-gray-900 mb-6">Áreas de interesse</h2>
        <div className="grid md:grid-cols-2 gap-5 mb-16">
          {AREAS.map((a) => (
            <div key={a.name} className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="font-display text-base font-bold text-gray-900 mb-2">{a.name}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">Como trabalhamos</h2>
        <ul className="list-disc list-outside ml-6 text-gray-700 space-y-2 mb-12">
          <li><strong>Remote-first</strong> com encontros presenciais trimestrais em SP.</li>
          <li><strong>Compensação justa:</strong> salário CLT ou PJ + benefícios + stock options para os primeiros 10.</li>
          <li><strong>Decisão técnica descentralizada:</strong> squads donos de módulo, não feature factories.</li>
          <li><strong>Foco em produto real:</strong> zero vanity metrics internos; só NRR, CSAT, gross margin.</li>
          <li><strong>Rejeição explícita de anti-padrões do mercado:</strong> sem crunch, sem "vamos fazer um setup fee pra cobrir custo de implantação", sem API proprietária que impede portabilidade.</li>
        </ul>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
          <h3 className="font-display text-lg font-bold text-gray-900 mb-2">Candidate-se</h3>
          <p className="text-sm text-gray-600 mb-4">
            Envie CV ou LinkedIn + um parágrafo sobre qual área te interessa e por quê.
          </p>
          <a
            href="mailto:carreiras@zappiq.com.br?subject=Interesse%20em%20vaga%20ZappIQ"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            carreiras@zappiq.com.br
          </a>
          <p className="text-xs text-gray-500 mt-4">
            Dúvidas gerais sobre o processo? Use a{' '}
            <Link href="/contato" className="text-primary-600 hover:underline">página de contato</Link>.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
