import { SegmentTemplate } from '../../../components/landing/SegmentTemplate';
import type { SegmentPageData } from '../../../components/landing/SegmentTemplate';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZappIQ para Serviços B2B — Automação WhatsApp para Empresas',
  description: 'Qualifique leads, agende reuniões e acompanhe propostas pelo WhatsApp com IA. Ideal para consultorias, agências e prestadores de serviço.',
  openGraph: {
    title: 'ZappIQ para Serviços B2B — Qualifique Leads com IA',
    description: 'Qualifique leads, agende reuniões e acompanhe propostas pelo WhatsApp com IA.',
  },
};

/* PLACEHOLDER: substituir por dados reais do segmento B2B */
const data: SegmentPageData = {
  slug: 'servicos-b2b',
  name: 'Serviços B2B',
  businessType: 'Empresas de Serviços',
  heroTitle: 'ZappIQ para Serviços B2B: Qualifique leads e feche contratos pelo WhatsApp',
  heroSubtitle: 'Automatize a qualificação de leads, agendamento de reuniões e acompanhamento de propostas. Ideal para consultorias, agências e prestadores de serviço.',
  pains: [
    { icon: 'Briefcase', title: 'Leads frios perdidos', desc: 'O lead pediu informação, ninguém respondeu rápido, ele fechou com a concorrência.' },
    { icon: 'Clock', title: 'Follow-up manual', desc: 'Sua equipe perde horas enviando follow-ups um por um. Muitos leads caem no esquecimento.' },
    { icon: 'UserX', title: 'Qualificação ineficiente', desc: 'Time comercial gasta tempo com leads não qualificados em vez de focar nos que vão fechar.' },
    { icon: 'FileSearch', title: 'Propostas sem rastreamento', desc: 'Enviou proposta pelo WhatsApp? Não sabe se abriu, leu ou precisa de follow-up.' },
  ],
  solutions: [
    { icon: 'Brain', title: 'Qualificação com IA', desc: 'O Pulse AI faz perguntas de qualificação (BANT) e prioriza leads com maior chance de conversão.' },
    { icon: 'Workflow', title: 'Fluxos automatizados', desc: 'Crie sequências de follow-up automáticas: proposta enviada → lembrete 3 dias → oferta especial.' },
    { icon: 'Users', title: 'CRM integrado', desc: 'Todos os contatos e conversas em um CRM visual. Tags, estágios do funil e histórico completo.' },
    { icon: 'BarChart3', title: 'Pipeline de vendas', desc: 'Visualize o funil completo: leads → qualificados → proposta → fechamento. Métricas em tempo real.' },
  ],
  testimonial: {
    name: 'Fernanda Costa',
    role: 'Diretora Comercial',
    company: 'Nexus Consultoria',
    initials: 'FC',
    text: 'O Pulse AI qualifica 80% dos leads antes de chegar no meu time. Reduzimos o ciclo de vendas de 14 para 5 dias e dobramos os contratos fechados.',
  },
};

export default function ServicosB2BPage() {
  return <SegmentTemplate data={data} />;
}
