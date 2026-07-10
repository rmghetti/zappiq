import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Conversations (Inbox).
 *
 * Cobre o Inbox como um todo, as ações de handoff humano ↔ IA, o treinamento
 * inline do agente e o painel de contexto de CRM ao lado da conversa.
 */
export const conversationsContent: SaibaMaisContent[] = [
  {
    featureKey: 'conversations.inbox',
    titulo: 'Conversas (Inbox)',
    clientSafe: true,
    oQueE:
      'É a tela onde você vê e responde as conversas do WhatsApp e do Instagram da sua empresa. Ela é dividida em três partes lado a lado: a lista de conversas à esquerda, o bate-papo no meio e as informações do cliente à direita.',
    paraQueServe:
      'Serve para você acompanhar tudo o que a Iza está conversando com seus clientes, assumir uma conversa quando quiser responder pessoalmente e ver na hora o histórico de vendas daquele contato, sem trocar de tela.',
    comoImplementar: [
      'Na lista à esquerda, use a busca ou os filtros de status e canal para achar uma conversa.',
      'Clique numa conversa para abrir o bate-papo no meio da tela.',
      'No painel da direita, veja o cadastro do contato, a oportunidade de venda ligada a ele, as tarefas pendentes e o histórico de tudo que já aconteceu.',
      'Use os botões no topo da conversa (Assumir, Nota, Encerrar) quando precisar agir manualmente.',
    ],
    exemploResultado:
      'Numa clínica odontológica com 25 conversas abertas no dia, a dona abre o Inbox de manhã, vê de relance quais estão com a Iza e quais precisam de atenção humana, e responde direto na tela sem precisar abrir o WhatsApp Business no celular.',
    relacionados: ['conversations.assumir-handoff', 'conversations.retomar-ia'],
  },
  {
    featureKey: 'conversations.assumir-handoff',
    titulo: 'Assumir conversa',
    clientSafe: true,
    oQueE:
      'É o botão que coloca você no controle de uma conversa no lugar da Iza. Ao clicar, a Iza para de responder automaticamente aquele cliente e a conversa fica marcada com o seu nome.',
    paraQueServe:
      'Serve para os momentos em que você quer responder pessoalmente, por exemplo numa negociação delicada ou quando o cliente pede para falar com um humano. Assim você evita que a Iza mande uma mensagem em cima da sua.',
    comoImplementar: [
      'Abra a conversa que quer assumir.',
      'Clique no botão Assumir, no canto superior direito da tela de conversa.',
      'A partir daí a Iza fica pausada só naquela conversa e um aviso amarelo aparece confirmando isso.',
      'Quando terminar de atender, clique em Retomar Iza para devolver a conversa para a IA.',
    ],
    exemploResultado:
      'Numa loja de roupas, um cliente reclama de um produto com defeito. A dona clica em Assumir, resolve a troca pessoalmente por mensagem, e depois clica em Retomar Iza para a IA voltar a cuidar do atendimento normal daquele contato.',
    relacionados: ['conversations.retomar-ia', 'conversations.status-badge'],
  },
  {
    featureKey: 'conversations.retomar-ia',
    titulo: 'IA pausada e Retomar Iza',
    clientSafe: true,
    oQueE:
      'É o aviso que aparece quando a Iza não está mais respondendo uma conversa, seja porque alguém da equipe assumiu ou porque a conversa foi atribuída a um atendente. O botão Retomar Iza devolve o controle para a inteligência artificial.',
    paraQueServe:
      'Serve para você nunca esquecer uma conversa parada no atendimento humano. Enquanto o aviso estiver na tela, o cliente não recebe nenhuma resposta automática, então é importante saber quando reativar a Iza.',
    comoImplementar: [
      'Abra uma conversa que está com o aviso amarelo "IA pausada, em atendimento humano" no topo.',
      'Termine de responder o que for preciso manualmente.',
      'Clique no botão Retomar Iza, ao lado do aviso.',
      'A partir desse clique, a Iza volta a responder normalmente as próximas mensagens daquele cliente.',
    ],
    exemploResultado:
      'Numa academia, um instrutor assume uma conversa para tirar uma dúvida específica sobre plano de treino. Ele esquece de clicar em Retomar Iza depois, e o cliente fica dois dias sem resposta automática até alguém perceber o aviso amarelo parado na tela.',
    relacionados: ['conversations.assumir-handoff'],
  },
  {
    featureKey: 'conversations.corrigir-treinar',
    titulo: 'Corrigir & treinar o agente',
    clientSafe: true,
    oQueE:
      'É o botão que aparece quando você passa o mouse sobre uma resposta que a Iza deu. Ele abre uma janela para você reescrever a resposta certa, e essa correção vira um ensinamento permanente para a IA.',
    paraQueServe:
      'Serve para consertar erros da Iza direto de onde eles aconteceram, sem precisar ir até a área de treinamento. É a forma mais rápida de ensinar o agente a responder melhor da próxima vez que alguém perguntar algo parecido.',
    comoImplementar: [
      'Passe o mouse sobre uma mensagem que a Iza enviou dentro de uma conversa.',
      'Clique em "Corrigir & treinar [nome do agente]", que aparece embaixo da mensagem.',
      'Confira a pergunta do cliente, veja a resposta incorreta que a Iza deu, e escreva no campo abaixo a resposta correta.',
      'Clique em Salvar & treinar. A partir daí, essa pergunta e resposta entram na base de conhecimento do agente.',
    ],
    exemploResultado:
      'Numa clínica veterinária, um cliente pergunta se atendem emergência aos domingos e a Iza responde errado. A veterinária corrige a resposta pelo botão, e da próxima vez que um cliente perguntar algo parecido, a Iza já responde certo, sem precisar de nova correção.',
    relacionados: ['conversations.assumir-handoff'],
  },
  {
    featureKey: 'conversations.crm.lead-score',
    titulo: 'Score do lead',
    clientSafe: true,
    oQueE:
      'É um número de 0 a 100 que mostra o quanto aquele contato parece interessado em comprar, calculado automaticamente pela ZappIQ a partir do jeito que ele interage nas conversas.',
    paraQueServe:
      'Serve para você priorizar quem atender primeiro quando tiver muitos contatos ao mesmo tempo. Scores mais altos, com barra verde, indicam leads mais quentes. Scores baixos, com barra cinza, indicam contatos ainda frios.',
    comoImplementar: [
      'Abra qualquer conversa e olhe o painel à direita.',
      'No card do contato, veja o número ao lado de "Score" e a barra colorida logo abaixo.',
      'Verde é um lead avançado, amarelo é um lead em andamento, cinza é um lead ainda no início.',
      'Use esse número para decidir quem merece uma ligação ou mensagem prioritária no seu dia.',
    ],
    exemploResultado:
      'Numa loja de móveis planejados, dois clientes escrevem no mesmo dia. Um já perguntou preço e pediu visita, com score 82 e barra verde, e outro só mandou "oi, vocês fazem cozinha?", com score 15 e barra cinza. O vendedor atende primeiro o de score mais alto.',
    relacionados: ['conversations.crm.contato'],
  },
  {
    featureKey: 'conversations.nota-interna',
    titulo: 'Nota interna',
    clientSafe: true,
    oQueE:
      'É um recado que só a sua equipe vê, nunca o cliente. Fica registrado dentro da conversa, mas não é enviado pelo WhatsApp nem pelo Instagram.',
    paraQueServe:
      'Serve para deixar um lembrete ou uma observação sobre o atendimento, por exemplo "cliente pediu desconto, aguardar aprovação do gerente", sem misturar isso com a conversa real com o cliente.',
    comoImplementar: [
      'Abra a conversa e clique no botão Nota, no topo da tela.',
      'Escreva o recado no campo amarelo que aparece.',
      'Clique em Salvar.',
      'A nota fica salva junto com a conversa. Hoje ela ainda não aparece na linha do tempo nem em outro lugar da tela, então use como lembrete rápido pra você mesmo e avise a equipe por outro canal se for algo importante.',
    ],
    exemploResultado:
      'Numa barbearia, o atendente anota "cliente é alérgico a um dos produtos, avisar antes de aplicar" numa nota interna, como lembrete rápido durante o próprio atendimento. Como a nota ainda não aparece pra outra pessoa depois, ele também avisa o colega por WhatsApp interno pra garantir que ninguém esqueça.',
    relacionados: ['conversations.crm.timeline'],
  },
  {
    featureKey: 'conversations.crm.oportunidade',
    titulo: 'Oportunidade (negócio)',
    clientSafe: true,
    oQueE:
      'É o card que mostra se aquele contato tem uma venda em andamento, criada automaticamente pela IA ou por alguém da sua equipe. Ele mostra o nome da oportunidade, em qual etapa do funil de vendas ela está e o valor estimado.',
    paraQueServe:
      'Serve para você ver, direto da conversa, se aquele cliente já é um negócio real em andamento, sem precisar abrir a tela de Pipeline de Vendas separadamente.',
    comoImplementar: [
      'Abra uma conversa e olhe o painel à direita, na seção Oportunidade.',
      'Se houver um negócio aberto para aquele contato, você vê o título, a etapa (com uma cor) e o valor, quando ele já tiver sido preenchido.',
      'Se aparecer "Nenhuma oportunidade aberta ainda", é porque ninguém criou um negócio para esse contato.',
      'Para gerenciar o negócio por completo, como mudar a etapa ou preencher o valor, acesse a tela de Pipeline de Vendas.',
    ],
    exemploResultado:
      'Numa imobiliária, a Iza identifica que um cliente quer alugar um apartamento e cria automaticamente uma oportunidade na etapa Proposta, ainda sem valor definido. O corretor vê isso direto na conversa e completa o valor do aluguel na tela de Pipeline de Vendas.',
    relacionados: ['conversations.crm.contato'],
  },
  {
    featureKey: 'conversations.crm.contato',
    titulo: 'Card de contato',
    clientSafe: true,
    oQueE:
      'É o resumo do cliente que aparece no painel à direita de cada conversa: nome, empresa (se houver), status dele no funil de vendas, score de interesse e as etiquetas (tags) atribuídas a ele.',
    paraQueServe:
      'Serve para você entender quem é aquele cliente e em que momento da jornada de compra ele está, sem precisar ir até a tela de Contatos para conferir o cadastro completo.',
    comoImplementar: [
      'Abra qualquer conversa.',
      'No painel à direita, veja o card no topo com o nome, telefone ou empresa do contato.',
      'Confira a etiqueta colorida de status (Novo, Contatado, Qualificado, Desqualificado, Cliente) e o score logo abaixo.',
      'Se houver tags, como "cliente antigo" ou "interessado em plano anual", elas aparecem em pequenos rótulos cinza no fim do card.',
    ],
    exemploResultado:
      'Numa clínica de estética, a recepcionista abre a conversa de um contato e vê no card que ele já está "Qualificado", com score 68 e a tag "procedimento a laser". Isso ajuda a direcionar a conversa certa sem perguntar tudo de novo.',
    relacionados: ['conversations.crm.lead-score', 'conversations.status-badge'],
  },
  {
    featureKey: 'conversations.status-badge',
    titulo: 'Status da conversa',
    clientSafe: true,
    oQueE:
      'É a etiqueta que mostra em que ponto está o atendimento daquela conversa. Hoje ela aparece em inglês (OPEN, WAITING, ASSIGNED ou CLOSED), mas o sentido é esse: OPEN é a Iza respondendo normalmente. WAITING é quando o cliente mandou mensagem e ainda não teve resposta. ASSIGNED é quando um atendente humano pegou a conversa. CLOSED é quando o atendimento foi encerrado.',
    paraQueServe:
      'Serve para você bater o olho na lista de conversas e saber quais precisam de atenção agora, sem precisar abrir uma por uma.',
    comoImplementar: [
      'Veja a etiqueta colorida ao lado do telefone do contato, no topo da conversa aberta.',
      'Verde é OPEN (aberta), amarelo é WAITING (aguardando), azul é ASSIGNED (assumida por um humano) e cinza é CLOSED (fechada).',
      'Use os filtros de status na lista à esquerda (Todas, Abertas, Aguardando, Fechadas) para focar no que importa.',
      'Uma conversa Fechada pode ser reaberta a qualquer momento pelo botão Reabrir.',
    ],
    exemploResultado:
      'Numa pizzaria, o dono filtra a lista por "Aguardando" no fim do dia e encontra três clientes que mandaram mensagem fora do horário de atendimento humano e ainda não tiveram retorno, mesmo com a Iza ativa.',
    relacionados: ['conversations.crm.contato'],
  },
  {
    featureKey: 'conversations.crm.timeline',
    titulo: 'Linha do tempo do contato',
    clientSafe: true,
    oQueE:
      'É o histórico completo de tudo que já aconteceu com aquele contato: mudanças de etapa no funil, resumos que a IA fez da conversa, notas internas, eventos de campanha e outros registros. Cada item tem um ícone e fica organizado do mais recente para o mais antigo.',
    paraQueServe:
      'Serve para você entender rapidamente a jornada daquele cliente com a sua empresa, sem precisar rolar a conversa inteira para lembrar o que já foi combinado.',
    comoImplementar: [
      'Abra uma conversa e role o painel à direita até a seção Linha do tempo.',
      'Cada item mostra o que aconteceu, a data e quem foi o responsável (IA, Humano ou Sistema).',
      'Ícones diferentes representam eventos diferentes: mudança de etapa, resumo da IA, nota interna, evento de campanha, entre outros.',
      'Use essa seção antes de responder um cliente antigo para relembrar o contexto sem reler tudo.',
    ],
    exemploResultado:
      'Numa loja de informática, o vendedor abre a conversa de um cliente que sumiu há um mês. Na linha do tempo, ele vê que a IA resumiu a última conversa como "cliente esperando peça em estoque" e retoma o assunto exatamente de onde parou.',
    relacionados: ['conversations.nota-interna', 'conversations.crm.oportunidade'],
  },
  {
    featureKey: 'conversations.crm.tarefas',
    titulo: 'Próximos passos (tarefas)',
    clientSafe: true,
    oQueE:
      'É a lista de tarefas ligadas àquele contato, criadas automaticamente pela IA quando ela percebe que o cliente quer fechar negócio (a tarefa se chama sempre "Follow-up: fechar a venda"), ou criadas manualmente pela sua equipe.',
    paraQueServe:
      'Serve para você não esquecer o que precisa fazer com aquele cliente depois da conversa, com o prazo visível quando houver.',
    comoImplementar: [
      'Abra uma conversa e veja a seção Próximos passos, no painel à direita.',
      'Cada tarefa mostra o título e, se tiver, a data de vencimento.',
      'Se aparecer "Sem tarefas pendentes", é porque nenhuma foi criada para esse contato ainda.',
      'Para marcar uma tarefa como concluída ou ver todas as tarefas da empresa juntas, acesse a tela Tarefas no menu principal.',
    ],
    exemploResultado:
      'Numa oficina mecânica, a Iza percebe durante a conversa que o cliente demonstrou intenção de fechar negócio e cria automaticamente a tarefa "Follow-up: fechar a venda", com vencimento pro dia seguinte. O mecânico vê isso no painel da conversa e não deixa passar.',
    relacionados: ['conversations.crm.oportunidade'],
  },
];
