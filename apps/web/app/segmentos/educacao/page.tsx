import { SegmentTemplate } from '../../../components/landing/SegmentTemplate';
import type { SegmentPageData } from '../../../components/landing/SegmentTemplate';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZappIQ para Educação: Automação WhatsApp para Escolas e Cursos',
  description: 'Responda dúvidas de pais e alunos 24/7, organize as matrículas e acompanhe a inadimplência. Ideal para escolas, cursos e instituições de ensino.',
  openGraph: {
    title: 'ZappIQ para Educação: Automatize Matrículas e Atendimento',
    description: 'Responda pais e alunos 24/7, organize matrículas e acompanhe a inadimplência pelo WhatsApp.',
  },
};

/* PLACEHOLDER: substituir por dados reais do segmento educação */
const data: SegmentPageData = {
  slug: 'educação',
  name: 'Educação',
  businessType: 'Escolas e Cursos',
  heroTitle: 'ZappIQ para Educação: Automatize matrículas e comunicação escolar',
  heroSubtitle: 'Responda pais e alunos instantaneamente, organize as matrículas e acompanhe a inadimplência, tudo pelo WhatsApp com IA.',
  pains: [
    { icon: 'GraduationCap', title: 'Matrículas perdidas', desc: 'Pais perguntam sobre vagas e valores, mas a secretaria demora para responder. Eles matriculam na concorrência.' },
    { icon: 'Clock', title: 'Secretaria sobrecarregada', desc: 'A equipe gasta o dia respondendo as mesmas perguntas: horários, valores, documentos necessários.' },
    { icon: 'UserX', title: 'Evasão sem aviso', desc: 'Alunos param de frequentar e ninguém percebe a tempo. Sem comunicação proativa, a evasão cresce.' },
    { icon: 'CreditCard', title: 'Inadimplência alta', desc: 'A cobrança fica para depois, ninguém sabe quem já foi avisado, e a inadimplência consome o fluxo de caixa.' },
  ],
  solutions: [
    { icon: 'Brain', title: 'IA para matrículas', desc: 'Responde dúvidas sobre turmas, valores e documentos. Envia link de matrícula online automaticamente.' },
    { icon: 'MessageCircle', title: 'Comunicação com pais', desc: 'Envie avisos, boletins e comunicados para turmas inteiras. Pais respondem e a IA gerencia.' },
    { icon: 'Calendar', title: 'Avisos em massa, quando você manda', desc: 'Comunicado de aula, prova, evento ou vencimento sai por campanha para a turma inteira. Quem dispara é a secretaria; a plataforma não programa envio sozinha.' },
    { icon: 'BarChart3', title: 'Dashboard educacional', desc: 'Métricas de engajamento, taxas de matrícula, inadimplência e satisfação dos pais em tempo real.' },
  ],
  testimonial: {
    name: 'Prof. Ana Beatriz',
    role: 'Coordenadora',
    company: 'Escola Nova Era',
    initials: 'AB',
    text: 'Aumentamos as matrículas em 45% no semestre passado. A IA responde pais no fim de semana e de madrugada, quando eles realmente pesquisam.',
  },
};

export default function EducacaoPage() {
  return <SegmentTemplate data={data} />;
}
