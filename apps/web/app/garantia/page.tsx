import { redirect } from 'next/navigation';

/* ══════════════════════════════════════════════════════════════════════════
 * /garantia — DEPRECATED (V4 purge · abr/2026)
 * --------------------------------------------------------------------------
 * A política "Garantia 60 dias" foi removida do produto em V4. Substituída
 * por trial de 14 dias corridos, ao fim dos quais o cliente escolhe a forma
 * de pagamento pra seguir contratando.
 *
 * Esta rota executa redirect 301-like (via Next redirect()) para /#precos,
 * preservando SEO de backlinks antigos sem expor página morta.
 *
 * Fonte de decisão: Rodrigo Ghetti · escopo V4 Chatbase-style · abr/2026.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Planos ZappIQ · 14 dias grátis',
  description:
    'A garantia de 60 dias foi substituída por 14 dias grátis. Teste a plataforma sem cartão; ao final do trial, escolha a forma de pagamento.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: 'https://zappiq.com.br/#precos',
  },
};

export default function GarantiaRedirectPage() {
  redirect('/#precos');
}
