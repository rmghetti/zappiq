import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Contato — ZappIQ',
  description:
    'Fale com o time de ZappIQ. Canais oficiais para vendas, suporte, imprensa, compliance (LGPD) e parcerias.',
};

/* V2-033 · V2-028: página de contato obrigatória.
 * Canais oficiais separados por tipo de solicitação para rastreabilidade SLA. */

const CHANNELS = [
  {
    title: 'Vendas & Novos clientes',
    email: 'vendas@zappiq.com.br',
    desc: 'Demonstração, orçamento Enterprise, migração de outra plataforma. SLA resposta: 1 dia útil.',
  },
  {
    title: 'Suporte técnico',
    email: 'suporte@zappiq.com.br',
    desc: 'Clientes ativos · incidentes, dúvidas de produto, configuração. SLA conforme plano contratado.',
  },
  {
    title: 'Compliance & LGPD',
    email: 'dpo@zappiq.com.br',
    desc: 'Direitos do titular, DPA, solicitações ANPD, incidentes de segurança. SLA resposta: 15 dias corridos (LGPD).',
  },
  {
    title: 'Imprensa & marketing',
    email: 'marketing@zappiq.com.br',
    desc: 'Entrevistas, pautas, parcerias de conteúdo, logos e press kit.',
  },
  {
    title: 'Parcerias técnicas',
    email: 'partners@zappiq.com.br',
    desc: 'Integradores, agências, revenda white-label, Programa ZappIQ Partners.',
  },
  {
    title: 'Jurídico',
    email: 'juridico@zappiq.com.br',
    desc: 'Contratos, notificações extrajudiciais, propriedade intelectual.',
  },
];

export default function ContatoPage() {
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Contato</p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Fale com o time de ZappIQ
        </h1>
        <p className="text-lg text-gray-500 mb-12 max-w-3xl">
          Escolha o canal certo para sua solicitação — respondemos mais rápido assim. Para demos ao vivo,
          prefira a página <Link href="/demo" className="text-primary-600 hover:underline">/demo</Link> ou
          o WhatsApp oficial.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {CHANNELS.map((c) => (
            <div key={c.email} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <h2 className="font-display text-lg font-bold text-gray-900 mb-1">{c.title}</h2>
              <a href={`mailto:${c.email}`} className="text-primary-600 hover:underline font-mono text-sm">{c.email}</a>
              <p className="text-sm text-gray-500 mt-3 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 space-y-3 text-sm text-gray-600">
          <h2 className="font-display text-lg font-bold text-gray-900">Endereço comercial</h2>
          <p>
            <strong>Onze e Onze Consultoria Empresarial Ltda</strong> (d.b.a. ZappIQ)<br />
            CNPJ 46.788.145/0001-08<br />
            Av. das Nações Unidas, 12901 — CENU Torre Norte, 25° andar<br />
            Brooklin · São Paulo / SP · CEP 04578-910
          </p>
          <p className="text-xs text-gray-500 pt-3 border-t border-gray-200">
            Visita presencial somente com agendamento prévio via{' '}
            <a href="mailto:vendas@zappiq.com.br" className="text-primary-600 hover:underline">vendas@zappiq.com.br</a>.
            Nossa operação é primariamente remota; o endereço físico é usado para correspondência fiscal e contratual.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
