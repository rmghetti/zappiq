import { SegmentTemplate } from '../../../components/landing/SegmentTemplate';
import type { SegmentPageData } from '../../../components/landing/SegmentTemplate';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZappIQ para Varejo — Automação WhatsApp para Lojas e E-commerce',
  description: 'Venda mais pelo WhatsApp com IA. Recupere carrinhos abandonados, envie ofertas e atenda clientes 24/7. +35% de conversão no primeiro mês.',
  openGraph: {
    title: 'ZappIQ para Varejo — Venda Mais pelo WhatsApp',
    description: 'Recupere carrinhos abandonados, envie ofertas e atenda clientes 24/7 com IA.',
  },
};

/* PLACEHOLDER: substituir por dados reais do segmento varejo */
const data: SegmentPageData = {
  slug: 'varejo',
  name: 'Varejo',
  businessType: 'Lojas e E-commerce',
  heroTitle: 'ZappIQ para Varejo: Transforme o WhatsApp no seu melhor canal de vendas',
  heroSubtitle: 'Recupere carrinhos abandonados, envie ofertas personalizadas, responda dúvidas sobre produtos e feche vendas — tudo automatizado pelo WhatsApp.',
  pains: [
    { icon: 'ShoppingCart', title: 'Carrinhos abandonados', desc: 'Clientes adicionam ao carrinho mas não finalizam. Sem follow-up, essa receita é perdida.' },
    { icon: 'Clock', title: 'Respostas lentas', desc: 'Cliente perguntou sobre tamanho, cor ou frete — demorou para responder? Comprou no concorrente.' },
    { icon: 'TrendingDown', title: 'Baixa recorrência', desc: 'Vende uma vez e perde o contato. Sem pós-venda automatizado, o cliente não volta.' },
    { icon: 'Eye', title: 'Sem visão do funil', desc: 'Não sabe de onde vêm os leads, quais produtos interessam mais, nem o ticket médio por canal.' },
  ],
  solutions: [
    { icon: 'MessageCircle', title: 'Recuperação de carrinho', desc: 'Mensagem automática para quem abandonou o carrinho, com link de pagamento e cupom de incentivo.' },
    { icon: 'Brain', title: 'Vendedor IA 24/7', desc: 'Responde sobre produtos, tamanhos, frete e formas de pagamento. Envia link de compra na hora.' },
    { icon: 'Megaphone', title: 'Campanhas segmentadas', desc: 'Envie promoções, lançamentos e reativações para listas segmentadas por interesse e histórico.' },
    { icon: 'BarChart3', title: 'Analytics de vendas', desc: 'Dashboard com conversão por campanha, ticket médio, produtos mais vendidos e ROI em tempo real.' },
  ],
  testimonial: {
    name: 'Ricardo Mendes',
    role: 'CEO',
    company: 'TrendMix Moda',
    initials: 'RM',
    text: 'No primeiro mês, recuperamos 23% dos carrinhos abandonados e aumentamos 35% as vendas pelo WhatsApp. O Pulse AI vende de madrugada!',
  },
};

export default function VarejoPage() {
  return <SegmentTemplate data={data} />;
}
