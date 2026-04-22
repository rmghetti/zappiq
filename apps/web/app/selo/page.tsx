import type { Metadata } from 'next';
import { SeloPage } from '../selo-zappiq/SeloPage';

/* ══════════════════════════════════════════════════════════════════════════
 * /selo — URL canônica V3.2 (antes: /selo-zappiq)
 * --------------------------------------------------------------------------
 * LandingFooter V3.2 aponta para /selo. A rota antiga /selo-zappiq é
 * mantida por compatibilidade com campanhas anteriores e posts de blog
 * já publicados. Mesmo componente, URL mais curta.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: 'Selo ZappIQ de Atendimento 5 Estrelas — Certificação de Excelência',
  description:
    'Conquiste o Selo ZappIQ de Atendimento 5 Estrelas. Empresas com CSAT acima de 4.5 recebem selo digital para site, Instagram e WhatsApp.',
  openGraph: {
    title: 'Selo ZappIQ de Atendimento 5 Estrelas',
    description:
      'Certificação de excelência em atendimento via WhatsApp. Conquiste o selo e mostre ao mundo.',
  },
};

export default function Page() {
  return <SeloPage />;
}
