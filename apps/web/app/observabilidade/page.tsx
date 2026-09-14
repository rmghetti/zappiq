import { permanentRedirect } from 'next/navigation';

/* ══════════════════════════════════════════════════════════════════════════
 * /observabilidade: DESPUBLICADA (14/09/2026)
 * --------------------------------------------------------------------------
 * A página prometia avaliação manual e automática da qualidade das respostas
 * do agente. Isso não existe: nenhuma conversa real é avaliada, e a nota de
 * satisfação nunca foi preenchida em nenhuma conversa da base.
 *
 * Enquanto a avaliação de qualidade das conversas reais não existir, a rota
 * faz redirecionamento permanente para a home, sai do sitemap e sai dos
 * menus. O Radar 360° Pro continua descrito na seção de planos. O conteúdo
 * original está no histórico do git.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'ZappIQ',
  description: 'Atendimento e vendas no WhatsApp com IA. Teste 14 dias grátis.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: 'https://zappiq.com.br/',
  },
};

export default function ObservabilidadeRedirectPage() {
  permanentRedirect('/');
}
