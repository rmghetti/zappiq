import type { Metadata } from 'next';
import { CasesPage } from './CasesPage';

export const metadata: Metadata = {
  title: 'Cases de Sucesso — ZappIQ | Resultados Reais de Clientes',
  description: 'Veja como empresas reais estão usando ZappIQ para automatizar WhatsApp, aumentar vendas e reduzir custos. Cases com métricas comprovadas.',
  openGraph: {
    title: 'Cases de Sucesso — ZappIQ',
    description: 'Resultados reais: +250% leads, -70% tempo de resposta, +R$180k receita. Veja como.',
  },
};

export default function Page() {
  return <CasesPage />;
}
