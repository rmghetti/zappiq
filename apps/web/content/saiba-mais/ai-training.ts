import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área AI Training (/ai-training).
 */
export const aiTrainingContent: SaibaMaisContent[] = [
  {
    featureKey: 'ai-training.readiness-score',
    titulo: 'AI Readiness Score',
    clientSafe: true,
    oQueE:
      'É o percentual que mostra o quanto a sua IA já está pronta para atender bem. Ele soma cinco pedaços: o questionário de qualificação do seu negócio, a identidade e o tom de voz, os documentos que você subiu, as perguntas e respostas cadastradas e os canais conectados (WhatsApp e Instagram).',
    paraQueServe:
      'Serve para você saber de cara, sem abrir cada aba, se falta algo importante para a IA responder bem os seus clientes. Quanto mais alto o número, mais contexto a IA tem para não dar respostas genéricas.',
    comoImplementar: [
      'Veja o percentual no card colorido no topo da página de Treinamento.',
      'Clique em qualquer linha do Breakdown, logo abaixo, para ir direto para a aba que ainda falta completar.',
      'Use a lista de Próximas ações, ao lado, para saber exatamente qual passo dá mais pontos agora.',
      'O número atualiza sozinho assim que você salva algo em qualquer aba.',
    ],
    exemploResultado:
      'Numa clínica de estética que acabou de assinar a ZappIQ, o Readiness começa em 20%, só com os dados básicos do cadastro. Depois que o dono responde o questionário, sobe para 55%. Ao subir 8 documentos e conectar o WhatsApp, chega a 90%, e a IA passa a responder dúvida de preço e horário sem inventar nada.',
    relacionados: ['dashboard.agent-training-widget'],
  },
  {
    featureKey: 'ai-training.scheduling.tipo-agendamento',
    titulo: 'Tipo de agendamento',
    clientSafe: true,
    oQueE:
      'É o formulário onde você cadastra um horário que a IA pode marcar com o cliente, como Consulta, Reunião ou Visita. Cada tipo tem suas próprias regras: quanto tempo dura, se é presencial ou online, em quais dias e horários você atende, com quanta antecedência o cliente precisa avisar e quais dados pedir na hora de marcar.',
    paraQueServe:
      'Serve para a IA só oferecer horários que fazem sentido para o seu negócio, sem marcar em cima de outro compromisso nem oferecer um horário que você não atende.',
    comoImplementar: [
      'Na aba Agendamento, marque "Quero que meu agente faça agendamentos".',
      'Clique em "Adicionar tipo de agendamento" e dê um nome, como Consulta ou Visita técnica.',
      'Defina a duração, se é presencial, online, por telefone ou vídeo, e o endereço se for presencial.',
      'Marque os dias da semana e o horário de atendimento de cada dia.',
      'Preencha a antecedência mínima em minutos e até quantos dias no futuro a IA pode marcar.',
      'Se quiser, adicione um campo extra para o cliente preencher, como "Qual convênio?", e uma política de cancelamento.',
      'Clique em Salvar tipo. Ele aparece na lista e a IA já pode usá-lo na conversa.',
    ],
    exemploResultado:
      'Um consultório de fisioterapia cadastra o tipo "Sessão", com 50 minutos, presencial, de segunda a sexta das 8h às 18h, com antecedência mínima de 2 horas. Quando um cliente pede para marcar pelo WhatsApp, a IA só oferece horários dentro dessa janela e cria o agendamento direto na Agenda do CRM.',
    relacionados: ['ai-training.scheduling.confirmacao-manual'],
  },
  {
    featureKey: 'ai-training.training-history',
    titulo: 'Histórico de treinamento',
    clientSafe: true,
    oQueE:
      'É a lista de tudo que já foi alterado no treinamento da sua IA: documentos enviados ou removidos, Q&A criadas ou editadas, o questionário e a identidade atualizados, com data, hora e quem fez a mudança.',
    paraQueServe:
      'Serve para você ter rastro de quem mexeu no treinamento da IA e quando, útil se algo mudou de comportamento e você quer entender o que foi alterado, ou se mais de uma pessoa da equipe treina a IA.',
    comoImplementar: [
      'Vá até a aba Documentos e role até o fim da página.',
      'Veja os eventos mais recentes na lista, com o tipo de ação e quem fez.',
      'Clique em "Ver todos os eventos" para abrir o histórico completo.',
    ],
    exemploResultado:
      'Numa loja com dois funcionários treinando a IA, o histórico mostra que a atendente Ana subiu a tabela de preços na terça e o dono editou a identidade do agente na quinta. Se a IA passar a responder algo diferente, dá para saber exatamente o que mudou e quando.',
    relacionados: ['ai-training.readiness-score'],
  },
  {
    featureKey: 'ai-training.scheduling.confirmacao-manual',
    titulo: 'Exigir minha confirmação antes de valer',
    clientSafe: true,
    oQueE:
      'É uma opção dentro do cadastro de cada tipo de agendamento. Quando marcada, o horário que a IA agenda com o cliente fica pendente até você confirmar manualmente. Quando desmarcada, o agendamento já entra valendo assim que a IA marca com o cliente.',
    paraQueServe:
      'Serve para você revisar antes de um horário virar compromisso oficial, útil quando o agendamento depende de checar disponibilidade de um profissional específico ou de algo que a IA não enxerga sozinha.',
    comoImplementar: [
      'Na aba Agendamento, ao criar ou editar um tipo, marque a caixa "Exigir minha confirmação antes de valer".',
      'Deixe desmarcada se quer que o horário já valha na hora, sem revisão manual.',
      'Agendamentos pendentes de confirmação aparecem na Agenda do CRM, dentro da aba de agendamentos.',
    ],
    exemploResultado:
      'Um salão com um único cabeleireiro marca essa opção no tipo "Corte com o Marcelo". Quando a IA agenda um horário, ele fica como pendente na Agenda até o dono confirmar que o Marcelo está mesmo disponível naquele dia, evitando marcar dois clientes ao mesmo tempo.',
    relacionados: ['ai-training.scheduling.tipo-agendamento'],
  },
];
