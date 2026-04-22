/**
 * Metadata SEO pra /legal/deletar-dados.
 *
 * A page.tsx é 'use client' (form interativo), então metadata não pode ser
 * exportada de lá — Next.js App Router exige server component. Este layout
 * é o wrapper server que injeta <title> e description sem quebrar o client.
 *
 * Evidência: ZappIQ_V32_Actions/sprint_1_pricing_garantia_cloud_api/SEO_PATCH_DELETAR_DADOS.md
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Exercer direitos sobre seus dados — ZappIQ (LGPD Art. 18)',
  description:
    'Canal oficial ZappIQ para titulares exercerem direitos LGPD Art. 18: acesso, correção, exclusão, anonimização, portabilidade e revogação de consentimento. Prazo legal ANPD.',
  alternates: {
    canonical: 'https://zappiq.com.br/legal/deletar-dados',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DeletarDadosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
