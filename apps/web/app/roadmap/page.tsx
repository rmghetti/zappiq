import { permanentRedirect } from 'next/navigation';

/* ══════════════════════════════════════════════════════════════════════════
 * /roadmap: DESPUBLICADA (14/09/2026)
 * --------------------------------------------------------------------------
 * A página se apresentava como "status real" e listava como disponível o que
 * a auditoria mediu em produção como ausente ou diferente: embeddings de
 * outro fornecedor, índice de busca que não está em uso, ingestão de planilha
 * (o serviço recusa) e itens "em desenvolvimento" com previsão de maio e
 * junho, já vencidas.
 *
 * Enquanto não houver um status verificado contra o código, a rota faz
 * redirecionamento permanente para a home, sai do sitemap e sai dos menus.
 * O conteúdo original está no histórico do git, caso a página volte.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'ZappIQ',
  description: 'Atendimento e vendas no WhatsApp com IA. Teste 14 dias grátis.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: 'https://zappiq.com.br/',
  },
};

export default function RoadmapRedirectPage() {
  permanentRedirect('/');
}
