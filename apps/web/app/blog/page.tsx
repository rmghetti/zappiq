import type { Metadata } from 'next';
import BlogPage from './BlogPage';

export const metadata: Metadata = {
  title: 'Blog ZappIQ — Insights sobre Automação WhatsApp para Negócios',
  description:
    'Artigos, guias e dicas sobre automação de WhatsApp com IA, vendas, atendimento ao cliente e gestão para PMEs brasileiras. Aprenda a escalar seu negócio com o ZappIQ.',
  openGraph: {
    title: 'Blog ZappIQ — Insights sobre Automação WhatsApp',
    description:
      'Artigos e guias sobre automação de WhatsApp com IA para PMEs brasileiras.',
    type: 'website',
    locale: 'pt_BR',
    /* PLACEHOLDER: substituir por URL real */
    url: 'https://zappiq.com.br/blog',
  },
};

export default function BlogListingPage() {
  return <BlogPage />;
}
