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
      'Tarefas é a lista de follow-ups que a própria IA cria pra você, sem que ninguém peça. Enquanto a Iza conversa com seus clientes no WhatsApp, ela percebe quando alguém demonstra intenção de compra, por exemplo pede o preço, diz que quer fechar ou pergunta como comprar. Nessa hora ela cria automaticamente uma tarefa de follow-up, pronta pra você agir. Não existe botão de criar tarefa na mão: ela aparece sozinha quando esse sinal acontece.',
    paraQueServe:
      'Serve pra garantir que nenhum cliente quente fique esquecido. Em vez de você reler conversa por conversa procurando quem precisa de um retorno, a IA já separa isso numa lista única, com prazo e com o contato ou negócio ligado a cada item. É o jeito de fechar o ciclo: a Iza atende, identifica a intenção de compra e te avisa na hora certa de agir.',
    comoImplementar: [
      'Abra o menu Tarefas no menu lateral para ver tudo que a IA já identificou pra você.',
      'Use os filtros no topo (Pendentes, Concluídas, Todas) pra escolher o que quer enxergar.',
      'Clique no nome do contato ou do negócio dentro de uma tarefa pra ir até a tela de Contatos ou do CRM e localizar a conversa ou o negócio relacionado.',
      'Depois de resolver, marque a tarefa como concluída clicando na caixinha à esquerda do título.',
    ],
    exemploResultado:
      'Numa clínica de estética, uma cliente pergunta o valor de um procedimento e diz que quer fechar. A Iza percebe a intenção de compra e cria automaticamente a tarefa "Follow-up: fechar a venda", já vinculada ao contato e ao negócio, com prazo de 1 dia. A recepcionista abre Tarefas de manhã, vê os follow-ups pendentes e retoma o contato antes do prazo vencer.',
  },
];
