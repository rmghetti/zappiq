import type { Metadata } from 'next';
import { ComparativoPage } from './ComparativoPage';

export const metadata: Metadata = {
  title: 'ZappIQ vs. Concorrentes — Comparativo Completo',
  description: 'Compare ZappIQ com outras plataformas de atendimento WhatsApp. IA nativa, setup em minutos, suporte em português e garantia de ROI.',
  openGraph: {
    title: 'ZappIQ vs. Concorrentes — Comparativo',
    description: 'Veja por que ZappIQ é a melhor escolha para automação WhatsApp. Comparativo detalhado.',
  },
};

export default function Page() {
  return <ComparativoPage />;
}
