import type { Metadata } from 'next';
import { SeloPage } from './SeloPage';

export const metadata: Metadata = {
  title: 'Selo ZappIQ de Atendimento 5 Estrelas — Certificação de Excelência',
  description: 'Conquiste o Selo ZappIQ de Atendimento 5 Estrelas. Empresas com CSAT acima de 4.5 recebem selo digital para site, Instagram e WhatsApp.',
  openGraph: {
    title: 'Selo ZappIQ de Atendimento 5 Estrelas',
    description: 'Certificação de excelência em atendimento via WhatsApp. Conquiste o selo e mostre ao mundo.',
  },
};

export default function Page() {
  return <SeloPage />;
}
