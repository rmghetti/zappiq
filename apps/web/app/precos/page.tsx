import type { Metadata } from 'next';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { Pricing } from '../../components/landing/Pricing';

export const metadata: Metadata = {
  title: 'Planos e Preços — ZappIQ',
  description:
    'Conheça os planos ZappIQ: Starter, Growth, Scale e Enterprise. IA nativa, WhatsApp oficial, CRM integrado. Comece grátis por 14 dias, sem setup fee.',
  openGraph: {
    title: 'Planos e Preços — ZappIQ',
    description:
      'Automação WhatsApp com IA a partir de R$ 197/mês. Zero setup fee, 14 dias grátis. Compare planos e escolha o ideal para seu negócio.',
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
