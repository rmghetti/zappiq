import { redirect } from 'next/navigation';

/* ══════════════════════════════════════════════════════════════════════════
 * /founders: DESCONTINUADO (13/07/2026, decisão do fundador)
 * --------------------------------------------------------------------------
 * O Programa Fundadores (Cohort Founders 2026, 30% vitalício) não é mais
 * promovido. Esta rota executa redirect para /#precos e sai do index, pra
 * não expor a campanha nem quebrar backlinks antigos. Conteúdo original
 * preservado no histórico do git, caso a campanha volte.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Planos ZappIQ · 14 dias grátis',
  description:
    'Conheça os planos da ZappIQ e teste 14 dias grátis, sem cartão. Ao final do trial, você escolhe a forma de pagamento.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: 'https://zappiq.com.br/#precos',
  },
};

export default function FoundersRedirectPage() {
  redirect('/#precos');
}
