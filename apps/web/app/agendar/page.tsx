import type { Metadata } from 'next';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { Agendar } from '../../components/landing/Agendar';

export const metadata: Metadata = {
  title: 'Agendar Onboarding ZappIQ: 30 minutos com especialista',
  description:
    'Agende sua call de onboarding ZappIQ. 30 minutos com especialista, configuração WhatsApp Cloud API ao vivo, primeiro teste real do bot. Google Meet automático. Sem custo.',
  keywords: [
    'agendar ZappIQ',
    'onboarding WhatsApp',
    'demo ZappIQ',
    'agendar call ZappIQ',
    'consultoria WhatsApp Cloud API',
  ],
  openGraph: {
    title: 'Agendar Onboarding ZappIQ: 30 minutos',
    description:
      'Especialista configura WhatsApp Cloud API com você ao vivo. Bot funcionando ao final da call.',
    type: 'website',
    url: 'https://zappiq.com.br/agendar',
  },
  alternates: {
    canonical: 'https://zappiq.com.br/agendar',
  },
};

export default function AgendarPage() {
  return (
    <PublicLayout>
      <Agendar />
    </PublicLayout>
  );
}
