import type { Metadata } from 'next';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { ConectarWhatsApp } from '../../components/landing/ConectarWhatsApp';

export const metadata: Metadata = {
  title: 'Como conectar WhatsApp à ZappIQ — Guia completo Cloud API',
  description:
    'Tutorial completo de conexão WhatsApp Cloud API à plataforma ZappIQ. Pré-requisitos, 3 caminhos de onboarding, FAQ, vídeo. Conexão oficial Meta — sem atravessador.',
  keywords: [
    'WhatsApp Cloud API',
    'conectar WhatsApp na ZappIQ',
    'WhatsApp Business API',
    'integração WhatsApp Meta',
    'onboarding WhatsApp empresa',
    'verificação Meta Business',
    'tutorial WhatsApp Cloud API',
  ],
  openGraph: {
    title: 'Como conectar WhatsApp à ZappIQ — Guia completo',
    description:
      'Pré-requisitos, 3 caminhos de onboarding e FAQ. Conexão oficial WhatsApp Cloud API com a Meta. Trial 14 dias sem cartão.',
    type: 'website',
    url: 'https://zappiq.com.br/conectar-whatsapp',
  },
  alternates: {
    canonical: 'https://zappiq.com.br/conectar-whatsapp',
  },
};

export default function ConectarWhatsAppPage() {
  return (
    <PublicLayout>
      <ConectarWhatsApp />
    </PublicLayout>
  );
}
