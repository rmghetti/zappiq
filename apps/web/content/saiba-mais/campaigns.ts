import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Campaigns (Zap Impulso).
 *
 * Não inclui os planos do Impulso (Start/Pro/Scale/Enterprise): esse conteúdo
 * já existe no ImpulsoPlanDetailModal e não deve ser duplicado aqui.
 */
export const campaignsContent: SaibaMaisContent[] = [
  {
    featureKey: 'campaigns.iza-estrategista',
    titulo: 'Criar com a Iza',
    clientSafe: true,
    oQueE:
      'É o jeito mais rápido de montar uma campanha: você escreve o objetivo numa frase, tipo "reativar quem sumiu há 30 dias com 15% de desconto", e a Iza monta a campanha inteira sozinha. Ela decide para quem enviar, escreve a mensagem na voz da sua marca, sugere o melhor horário e estima quanto vai custar.',
    paraQueServe:
      'Serve para você não precisar saber nada de marketing para vender mais. Nada é enviado sem sua aprovação: a Iza entrega um rascunho completo, você lê, ajusta o que quiser e só então decide disparar.',
    comoImplementar: [
      'Clique no botão "Criar com a Iza" no topo da página.',
      'Escreva o objetivo da campanha numa frase, ou clique num dos exemplos prontos para começar mais rápido.',
      'Clique em "Gerar campanha" e aguarde a Iza montar o rascunho: público, canais, horário e mensagem.',
      'Leia a mensagem sugerida. Se quiser mudar alguma palavra, clique em "Editar" e depois em "Salvar mensagem".',
      'Não gostou do resultado? Clique em "Refazer" para gerar outra versão sem perder o objetivo escrito.',
      'Quando estiver satisfeito, clique em "Criar campanha". Ela entra como Rascunho e só sai para os clientes quando você clicar em "Disparar".',
    ],
    exemploResultado:
      'Numa loja de roupas, o dono escreve "avisar sobre a nova coleção de inverno para quem comprou nos últimos 3 meses". A Iza monta uma campanha para 180 contatos, sugere envio às 11h de quinta-feira e escreve a mensagem já com o tom da loja. Estimativa: cerca de 18 respostas e custo em torno de R$ 60. O dono só lê, aprova e dispara.',
    relacionados: ['campaigns.status-badge', 'campaigns.coach-insights'],
  },
  {
    featureKey: 'campaigns.status-badge',
    titulo: 'Status da campanha',
    clientSafe: true,
    oQueE:
      'É a etiqueta colorida ao lado do nome de cada campanha, mostrando em que ponto ela está. Existem cinco: Rascunho, Agendada, Enviando, Concluída e Pausada.',
    paraQueServe:
      'Serve para você saber, só de bater o olho na lista, o que já aconteceu com cada campanha e se precisa fazer alguma coisa agora ou não.',
    comoImplementar: [
      'Rascunho: a campanha foi criada mas ainda não tem data marcada. Clique em "Disparar" quando quiser enviá-la agora. Não dá para editar depois de criada: se precisar mudar algo, exclua e crie de novo com os ajustes.',
      'Agendada: já tem data e hora marcadas. Ela vai sair sozinha no horário certo, você não precisa fazer nada.',
      'Enviando: as mensagens estão sendo entregues aos contatos neste momento.',
      'Concluída: a ZappIQ já enfileirou o disparo para todos os contatos. Os números (Enviados, Entregues, Lidos, Respostas) podem continuar subindo por alguns instantes, até o último envio sair de fato e o WhatsApp confirmar entrega e leitura.',
      'Pausada: a campanha foi cancelada antes de terminar e não teve mais envios. Clique em "Disparar" se quiser tentar de novo.',
    ],
    exemploResultado:
      'Numa clínica com 6 campanhas na tela, o dono vê de relance: 2 Agendadas para o fim de semana, 1 Enviando agora e 3 Concluídas do mês passado. Sem abrir nenhuma, ele já sabe que não precisa agir, as agendadas vão sair sozinhas nos horários certos.',
    relacionados: ['campaigns.funil-entrega'],
  },
  {
    featureKey: 'campaigns.funil-entrega',
    titulo: 'Funil de entrega (Enviados, Entregues, Lidos, Respostas)',
    clientSafe: true,
    oQueE:
      'São as quatro etapas por onde cada mensagem de campanha passa. Enviados é quanto a ZappIQ confirmou que saiu com sucesso (mensagens que falharam no envio não entram nesse número). Entregues é quanto chegou de fato no celular do contato. Lidos é quanto foi aberto, mas esse número só conta quem tem a confirmação de leitura (aquele "visto") ativada no WhatsApp, muita gente desativa isso. Respostas é quanto de fato respondeu.',
    paraQueServe:
      'Serve para você entender onde a campanha está perdendo força. Se Entregues cai muito perto de Enviados, o problema é técnico (número errado, WhatsApp bloqueado). Se Lidos cai bem abaixo de Entregues, não é sinal de problema, é só gente com a confirmação de leitura desligada. O que realmente importa para o resultado é Respostas.',
    comoImplementar: [
      'Abra o card de qualquer campanha na lista "Suas campanhas".',
      'Veja os quatro números lado a lado, com uma barrinha colorida embaixo de cada um mostrando a proporção em relação ao total enviado.',
      'Compare as barras: quanto menor a barra em relação à anterior, maior a queda naquela etapa.',
      'Use o número de Respostas para saber, na prática, quantas pessoas de fato reagiram à campanha.',
    ],
    exemploResultado:
      'Numa campanha para 300 contatos: 296 mensagens foram Enviadas, 290 chegaram como Entregues, 210 aparecem como Lidas (muita gente com confirmação de leitura desligada) e 34 pessoas Responderam. Isso é uma taxa de resposta de cerca de 11%, um resultado bom, mesmo com o número de Lidos parecendo baixo.',
    relacionados: ['campaigns.status-badge', 'campaigns.coach-insights'],
  },
  {
    featureKey: 'campaigns.coach-insights',
    titulo: 'Insights do Coach',
    clientSafe: true,
    oQueE:
      'São dicas automáticas que a Iza escreve depois de analisar os números de uma campanha. Aparecem como cartões coloridos embaixo dos resultados do card: verde quando algo foi bem, roxo claro quando é só uma informação, e amarelo quando merece atenção.',
    paraQueServe:
      'Serve para você não precisar interpretar número nenhum sozinho. A Iza já olhou os dados e te diz, em português simples, o que está funcionando e o que vale ajustar na próxima campanha.',
    comoImplementar: [
      'Um insight pode aparecer já no Rascunho, antes de disparar, com uma dica de quantos contatos enviar. Depois que a campanha começa a receber respostas, novos cartões vão surgindo. Role até o final do card para ver.',
      'Leia o cartão de insight: o título resume o ponto, e o texto abaixo explica o porquê e o que fazer.',
      'Use a dica para decidir a próxima ação, por exemplo, revisar a oferta, mudar o horário de envio ou repetir uma campanha que foi bem.',
    ],
    exemploResultado:
      'Uma campanha de recuperação de carrinho fecha com 2% de taxa de resposta. O Coach mostra um cartão amarelo sugerindo revisar o desconto oferecido ou testar um horário de envio diferente na próxima tentativa.',
    relacionados: ['campaigns.funil-entrega', 'campaigns.iza-estrategista'],
  },
  {
    featureKey: 'campaigns.metrica.receita-atribuida',
    titulo: 'Receita atribuída',
    clientSafe: true,
    oQueE:
      'É o valor em reais que uma venda gerou depois de vir de uma campanha específica. "Atribuída" só quer dizer "ligada a essa campanha": a venda foi conectada à mensagem que originou ela. Hoje esse número aparece zerado para todo mundo, porque essa conexão automática ainda depende de conectar suas contas de anúncio (Meta, Google), um recurso que está em construção.',
    paraQueServe:
      'Serve para, no futuro, você ver quanto dinheiro voltou de cada campanha sem precisar calcular na mão. Enquanto essa conexão não existe, o R$ 0 não significa que a campanha não vendeu nada, só que a ZappIQ ainda não tem como somar essa venda automaticamente.',
    comoImplementar: [
      'Veja o card "Receita atribuída" no topo da página, junto das outras métricas de campanhas.',
      'Por enquanto, acompanhe as vendas geradas por campanha manualmente pelo CRM, olhando as oportunidades criadas pelos contatos que responderam.',
      'Quando o pilar "Loop de Performance" (na seção "Como funciona o Impulso") estiver disponível, conectar suas contas de anúncio vai preencher esse número sozinho.',
    ],
    exemploResultado:
      'Uma confeitaria dispara uma campanha de Dia das Mães e fecha R$ 4.200 em bolos com quem respondeu. Hoje esse valor não aparece sozinho em "Receita atribuída" (o card mostra R$ 0), porque nenhuma conta de anúncio está conectada ainda. Quando o Loop de Performance estiver no ar, essa venda vai aparecer automaticamente ligada à campanha que a gerou.',
    relacionados: ['campaigns.coach-insights'],
  },
];
