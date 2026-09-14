import { permanentRedirect } from 'next/navigation';

/* ══════════════════════════════════════════════════════════════════════════
 * /como-funciona-survey: DESPUBLICADA (14/09/2026)
 * --------------------------------------------------------------------------
 * A página descrevia um processamento que não acontece: as respostas do
 * questionário não passam por um modelo que gera base estruturada, tom de
 * marca, árvores de decisão nem mensagens de teste. O que o código faz é
 * concatenar as respostas num texto e mandar para a busca. Também prometia
 * ligação de um CSM em 7 dias para quem não terminasse, sendo que sem o envio
 * final não existe nem organização cadastrada.
 *
 * A rota faz redirecionamento permanente para a home e sai do rodapé e do
 * popup do questionário. Quando a descrição do processo for reescrita com o
 * que o produto faz, a página volta. O conteúdo original está no histórico do
 * git.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'ZappIQ',
  description: 'Atendimento e vendas no WhatsApp com IA. Teste 14 dias grátis.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: 'https://zappiq.com.br/',
  },
};

export default function ComoFuncionaSurveyRedirectPage() {
  permanentRedirect('/');
}
