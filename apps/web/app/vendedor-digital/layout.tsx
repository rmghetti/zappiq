import type { Metadata } from 'next';
import { PublicLayout } from '@/components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Vendedor Digital · ZappIQ',
  description: 'O fim do chatbot. O começo do vendedor digital. Iza vende, qualifica leads e fecha agendamentos no WhatsApp 24/7, com KPI auditável e pricing por resultado.',
  openGraph: {
    title: 'Vendedor Digital · ZappIQ',
    description: 'O fim do chatbot. O começo do vendedor digital com KPI auditável.',
    images: ['/og-default.png'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}
