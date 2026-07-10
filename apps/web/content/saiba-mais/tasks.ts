import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Tasks (Tarefas).
 */
export const tasksContent: SaibaMaisContent[] = [
  {
    featureKey: 'tasks.overview',
    titulo: 'Tarefas',
    clientSafe: true,
    oQueE:
      'Tarefas é a lista de follow-ups que a própria IA cria pra você, sem que ninguém peça. Enquanto a Iza conversa com seus clientes no WhatsApp, ela percebe quando alguém demonstra interesse de compra, faz uma pergunta que precisa de resposta de gente ou combina algo que merece um lembrete. Essas situações viram tarefas aqui, prontas pra você agir. Não existe botão de criar tarefa na mão: elas aparecem sozinhas.',
    paraQueServe:
      'Serve pra garantir que nenhum cliente quente fique esquecido. Em vez de você reler conversa por conversa procurando quem precisa de um retorno, a IA já separa isso numa lista única, com prazo e com o contato ou negócio ligado a cada item. É o jeito de fechar o ciclo: a Iza atende, identifica a oportunidade e te avisa na hora certa de agir.',
    comoImplementar: [
      'Abra o menu Tarefas no menu lateral para ver tudo que a IA já identificou pra você.',
      'Use os filtros no topo (Pendentes, Concluídas, Todas) pra escolher o que quer enxergar.',
      'Clique no nome do contato ou do negócio dentro de uma tarefa pra abrir a conversa ou o deal relacionado no CRM.',
      'Depois de resolver, marque a tarefa como concluída clicando no círculo à esquerda do título.',
    ],
    exemploResultado:
      'Numa clínica de estética com 300 conversas por mês, a Iza percebe que uma cliente perguntou o valor de um procedimento e sumiu sem agendar. Em vez de essa oportunidade se perder, ela vira automaticamente uma tarefa "Retomar contato sobre orçamento de harmonização", com o nome da cliente e prazo de 2 dias. A recepcionista abre Tarefas de manhã, vê os 4 follow-ups pendentes do dia e retoma cada um com uma mensagem, sem precisar vasculhar o histórico de conversas.',
  },
];
