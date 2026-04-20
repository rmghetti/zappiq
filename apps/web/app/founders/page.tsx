import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Plano Founders ZappIQ — 30% de desconto vitalício',
  description:
    'Cohort de fundadores ZappIQ · 30% de desconto vitalício para os primeiros 50 clientes pagantes. Condições, elegibilidade e como aplicar.',
};

/* V2-007: restruturação do plano Founders com desconto 30% vitalício.
 * Base legal: condição promocional expressa em contrato, sem publicidade
 * enganosa, com teto explícito de 50 vagas. */

const PERKS = [
  'Desconto vitalício de 30% sobre qualquer plano contratado enquanto o contrato estiver ativo',
  'Prioridade em roadmap: até 2 features por ano votadas pelo cohort',
  'Canal Slack direto com o time fundador · resposta de até 1h em horário comercial',
  'Early access a novos módulos com 60 dias de antecedência',
  'Participação opcional em Programa ZappIQ Partners com comissão extra de 5%',
  'Case study co-autoral publicado (opcional, com aprovação do cliente)',
];

export default function FoundersPage() {
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Cohort Founders 2026</p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          50 vagas · 30% de desconto vitalício · para quem acredita na tese ZappIQ antes do resto.
        </h1>
        <p className="text-lg text-gray-500 mb-12 max-w-3xl">
          O plano Founders é a forma mais econômica de adotar ZappIQ. Em troca, pedimos feedback
          qualificado, abertura para case study (opcional) e disposição para testar features em beta
          antes do rollout geral.
        </p>

        <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-200 rounded-2xl p-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-primary-700 uppercase tracking-wider mb-1">Oferta Founders</p>
              <p className="font-display text-5xl font-extrabold text-gray-900">30%</p>
              <p className="text-gray-600 mt-2">desconto vitalício · aplicável a todos os planos pagos</p>
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Vagas:</strong> 50 · renovação automática enquanto o contrato seguir ativo</p>
              <p><strong>Elegíveis:</strong> PMEs brasileiras com faturamento até R$ 50M/ano</p>
              <p><strong>Encerramento:</strong> ao atingir 50 vagas ou em 30/06/2026, o que vier primeiro</p>
            </div>
          </div>
        </div>

        <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-6">O que entra no plano</h2>
        <ul className="space-y-3 mb-16">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-3 text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold mt-0.5">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-12">
          <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-4">O que esperamos de você</h2>
          <ul className="list-disc list-outside ml-6 text-gray-700 space-y-2">
            <li>Compromisso de 12 meses (mensal ou anual) com renovação automática</li>
            <li>Participação em pelo menos 1 sessão de feedback trimestral (45 min)</li>
            <li>Disponibilidade para testar features em beta, com opção de opt-out por feature</li>
            <li>Autorização LGPD para citação agregada em métricas de cohort (opt-out a qualquer momento)</li>
          </ul>
        </section>

        <section className="bg-[#1A1A2E] rounded-2xl p-10 text-white text-center">
          <h2 className="font-display text-3xl font-extrabold mb-3">Aplicar para Founders</h2>
          <p className="text-gray-400 mb-6">
            Envie um email com CNPJ, segmento, volume atual estimado de mensagens WhatsApp e o plano
            que te interessa. Respondemos em 1 dia útil.
          </p>
          <a
            href="mailto:founders@zappiq.com.br?subject=Aplica%C3%A7%C3%A3o%20Cohort%20Founders%20ZappIQ"
            className="inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors"
          >
            founders@zappiq.com.br
          </a>
          <p className="text-xs text-gray-500 mt-4">
            Prefere conversar?{' '}
            <Link href="/demo" className="text-gray-300 hover:text-white underline">Agende uma demo</Link>{' '}
            ou acesse a{' '}
            <Link href="/contato" className="text-gray-300 hover:text-white underline">página de contato</Link>.
          </p>
        </section>
      </div>
    </PublicLayout>
  );
}
