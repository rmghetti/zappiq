import { SegmentTemplate } from '../../../components/landing/SegmentTemplate';
import type { SegmentPageData } from '../../../components/landing/SegmentTemplate';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZappIQ para Saúde — Automação WhatsApp para Clínicas e Consultórios',
  description: 'Automatize agendamentos, confirmações e atendimento de pacientes pelo WhatsApp. Reduza faltas em 60% e agilize o atendimento da sua clínica.',
  openGraph: {
    title: 'ZappIQ para Saúde — Automação WhatsApp para Clínicas',
    description: 'Reduza faltas em 60%. Agende consultas automaticamente. Atenda pacientes 24/7 com IA.',
  },
};

/* PLACEHOLDER: substituir por dados reais do segmento saúde */
const data: SegmentPageData = {
  slug: 'saude',
  name: 'Saúde',
  businessType: 'Clínicas e Consultórios',
  heroTitle: 'ZappIQ para Saúde: Automação WhatsApp feita para clínicas e consultórios',
  heroSubtitle: 'Agende consultas, confirme horários, envie lembretes e atenda pacientes 24/7 — tudo pelo WhatsApp, com IA que entende o contexto médico.',
  pains: [
    { icon: 'Clock', title: 'Pacientes esperando resposta', desc: 'Pacientes ligam e mandam WhatsApp, mas ninguém responde a tempo. Muitos desistem e vão para outro consultório.' },
    { icon: 'Users', title: 'Recepção sobrecarregada', desc: 'A equipe gasta horas confirmando consultas, reagendando e respondendo perguntas repetitivas.' },
    { icon: 'FileX', title: 'Altas taxas de no-show', desc: 'Sem lembretes automáticos, a taxa de faltas chega a 30%. Horários vazios = receita perdida.' },
    { icon: 'Phone', title: 'Sem visibilidade do funil', desc: 'Não sabe quantos leads vieram do WhatsApp, quantos agendaram ou o ticket médio por canal.' },
  ],
  solutions: [
    { icon: 'Calendar', title: 'Agendamento automático', desc: 'Pacientes agendam direto pelo WhatsApp. A IA mostra horários disponíveis e confirma na hora.' },
    { icon: 'Brain', title: 'IA especializada em saúde', desc: 'Respostas inteligentes sobre horários, preparo para exames, localização e convênios aceitos.' },
    { icon: 'MessageCircle', title: 'Lembretes e confirmação', desc: 'Envio automático de lembretes 24h e 1h antes. Paciente confirma ou reagenda em um toque.' },
    { icon: 'BarChart3', title: 'Dashboard de métricas', desc: 'Visualize taxas de agendamento, no-show, tempo de resposta e satisfação dos pacientes.' },
  ],
  testimonial: {
    name: 'Dra. Camila Ferreira',
    role: 'Diretora Clínica',
    company: 'Clínica Vida Plena',
    initials: 'CF',
    text: 'Reduzimos o no-show de 28% para 8% em dois meses. A IA agenda, confirma e lembra — minha recepcionista agora foca no acolhimento presencial.',
  },
};

export default function SaudePage() {
  return <SegmentTemplate data={data} />;
}
