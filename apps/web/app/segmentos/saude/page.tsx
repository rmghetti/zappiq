import { SegmentTemplate } from '../../../components/landing/SegmentTemplate';
import type { SegmentPageData } from '../../../components/landing/SegmentTemplate';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZappIQ para Saúde: Automação WhatsApp para Clínicas e Consultórios',
  description: 'Agende consultas e atenda pacientes pelo WhatsApp, 24 horas por dia, com IA que consulta o horário livre e marca na agenda.',
  openGraph: {
    title: 'ZappIQ para Saúde: Automação WhatsApp para Clínicas',
    description: 'Agende consultas dentro da conversa. Atenda pacientes 24/7 com IA.',
  },
};

/* PLACEHOLDER: substituir por dados reais do segmento saúde */
const data: SegmentPageData = {
  slug: 'saúde',
  name: 'Saúde',
  businessType: 'Clínicas e Consultórios',
  heroTitle: 'ZappIQ para Saúde: Automação WhatsApp feita para clínicas e consultórios',
  heroSubtitle: 'Agende consultas e atenda pacientes 24/7, tudo pelo WhatsApp, com IA que consulta o horário livre e entende o contexto da clínica.',
  pains: [
    { icon: 'Clock', title: 'Pacientes esperando resposta', desc: 'Pacientes ligam e mandam WhatsApp, mas ninguém responde a tempo. Muitos desistem e vão para outro consultório.' },
    { icon: 'Users', title: 'Recepção sobrecarregada', desc: 'A equipe gasta horas confirmando consultas, reagendando e respondendo perguntas repetitivas.' },
    { icon: 'FileX', title: 'Agenda parada fora do expediente', desc: 'Quem tenta marcar de madrugada ou no domingo não encontra ninguém, e o horário livre continua vazio.' },
    { icon: 'Phone', title: 'Sem visibilidade do funil', desc: 'Não sabe quantos leads vieram do WhatsApp, quantos agendaram ou o ticket médio por canal.' },
  ],
  solutions: [
    { icon: 'Calendar', title: 'Agendamento automático', desc: 'Pacientes agendam direto pelo WhatsApp. A IA consulta os horários livres de verdade e marca na hora.' },
    { icon: 'Brain', title: 'IA especializada em saúde', desc: 'Respostas inteligentes sobre horários, preparo para exames, localização e convênios aceitos.' },
    { icon: 'MessageCircle', title: 'Agenda que a recepção enxerga', desc: 'Cada compromisso marcado pela IA cai na agenda do painel, com nome, horário e o que o paciente pediu.' },
    { icon: 'BarChart3', title: 'Dashboard de métricas', desc: 'Visualize volume de conversas, tempo de resposta e os agendamentos que a IA criou.' },
  ],
  /* Sem depoimento: nenhuma clínica autorizou a própria fala até aqui, e
   * cena inventada entre aspas é depoimento falso, mesmo sem nome real. Fica
   * a descrição da capacidade, que a plataforma cumpre. */
  capacidade:
    'Um paciente manda mensagem às onze da noite e sai da conversa com o horário marcado. A recepção abre o dia com a agenda pronta.',
};

export default function SaudePage() {
  return <SegmentTemplate data={data} />;
}
