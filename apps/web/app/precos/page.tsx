import type { Metadata } from 'next';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { Pricing } from '../../components/landing/Pricing';

export const metadata: Metadata = {
  title: 'Planos e preços ZappIQ: a partir de R$ 247/mês',
  description:
    'Lite R$ 247, Growth R$ 497 (mais popular), Scale R$ 1.497 e Enterprise sob consulta. IA que atende, vende e faz campanha no WhatsApp e Instagram, com CRM integrado. Zero setup fee, mensalidade fixa, 14 dias grátis sem cartão.',
  openGraph: {
    title: 'Planos e preços ZappIQ: a partir de R$ 247/mês',
    description:
      'Atendimento, vendas e campanhas com IA no WhatsApp e Instagram, a partir de R$ 247/mês. Zero setup fee, 14 dias grátis, sem cartão. Compare os planos.',
  },
  alternates: {
    canonical: 'https://zappiq.com.br/precos',
  },
};

export default function PrecosPage() {
  return (
    <PublicLayout>
      <Pricing />
    </PublicLayout>
  );
}
