import type { Metadata } from 'next';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { Cadastro } from '../../components/landing/Cadastro';

// Force dynamic rendering — Cadastro usa useSearchParams() que requer
// Suspense boundary em prerender. Mesma estratégia do PR #105 V5.3 hotfix.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Comece grátis — Trial 14 dias sem cartão · ZappIQ',
  description:
    'Crie sua conta ZappIQ em 3 minutos. Trial 14 dias sem cartão de crédito. WhatsApp Cloud API oficial Meta + IA conversacional + voz pt-BR. Cancela quando quiser.',
  keywords: [
    'cadastrar ZappIQ',
    'trial WhatsApp',
    'criar conta ZappIQ',
    'signup ZappIQ',
    'começar grátis',
    'WhatsApp Business API trial',
  ],
  openGraph: {
    title: 'Comece grátis — Trial 14 dias sem cartão · ZappIQ',
    description: 'Conta ZappIQ em 3 minutos. Trial 14 dias gratuitos sem cartão.',
    type: 'website',
    url: 'https://zappiq.com.br/cadastro',
  },
  alternates: {
    canonical: 'https://zappiq.com.br/cadastro',
  },
};

export default function CadastroPage() {
  return (
    <PublicLayout>
      <Cadastro />
    </PublicLayout>
  );
}
