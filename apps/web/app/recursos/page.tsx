import type { Metadata } from 'next';
import { RecursosPage } from './RecursosPage';

export const metadata: Metadata = {
  title: 'Recursos Gratuitos — ZappIQ | E-books, Templates e Ferramentas',
  description: 'Baixe grátis: Guia de Automação WhatsApp, Templates de Fluxo, Calculadora de ROI e Checklist de Migração para API.',
  openGraph: {
    title: 'Recursos Gratuitos — ZappIQ',
    description: 'E-books, templates e ferramentas gratuitas para automatizar seu WhatsApp Business.',
  },
};

export default function Page() {
  return <RecursosPage />;
}
