import type { Metadata } from 'next';
import { CasesPage } from './CasesPage';

export const metadata: Metadata = {
  title: 'Segmentos e Cases — ZappIQ | Automação WhatsApp para Seu Negócio',
  description: 'Veja como a ZappIQ resolve o gargalo do WhatsApp manual em clínicas, e-commerce, escolas, serviços e consultoria B2B. Comece grátis por 14 dias.',
  openGraph: {
    title: 'Segmentos e Cases — ZappIQ',
    description: 'A dor do WhatsApp manual é universal. Veja como a ZappIQ resolve para o seu segmento.',
  },
};

export default function Page() {
  return <CasesPage />;
}
