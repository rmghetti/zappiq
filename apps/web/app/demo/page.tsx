import type { Metadata } from 'next';
import { DemoPage } from './DemoPage';

export const metadata: Metadata = {
  title: 'Demo Interativa da ZappIQ | Teste o Pulse AI ao Vivo',
  description: 'Experimente como o Pulse AI atende seus clientes pelo WhatsApp. Simule conversas reais para Clínica, E-commerce e Empresa B2B.',
  openGraph: {
    title: 'Demo Interativa da ZappIQ',
    description: 'Teste agora como a IA responde seus clientes no WhatsApp. Simulação gratuita.',
  },
};

export default function Page() {
  return <DemoPage />;
}
