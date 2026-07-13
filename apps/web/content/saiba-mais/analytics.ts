import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Radar 360°.
 */
export const analyticsContent: SaibaMaisContent[] = [
  {
    featureKey: 'analytics.pulso',
    titulo: 'Pulso',
    clientSafe: true,
    oQueE:
      'O Pulso é o resumo diário da saúde do seu atendimento. Toda madrugada a ZappIQ analisa as conversas do dia anterior e monta um panorama do que foi bem, do que travou e do que merece sua atenção, sem você precisar garimpar número por número.',
    paraQueServe:
      'Serve para você bater o olho de manhã e saber, em segundos, se a operação está saudável: quantas conversas a IA resolveu sozinha, onde ela precisou de gente, e se apareceu algum problema que pode custar cliente ou venda.',
    comoImplementar: [
      'Abra o menu Radar 360° e vá até o bloco Pulso, no topo da página.',
      'Leia o resumo do dia anterior, que já vem pronto assim que a página carrega.',
      'Se quiser uma leitura mais atual, clique em "Atualizar" (ou "Gerar com IA", na primeira vez) dentro do próprio bloco Pulso.',
    ],
    exemploResultado:
      'Numa loja com 400 conversas no dia anterior, o Pulso mostra pela manhã que a IA automatizou 80% do atendimento, que 36 conversas foram fechadas e que o tempo médio de 1ª resposta ficou em 40 segundos. Com isso, o dono já sabe se a operação está indo bem ou se precisa reforçar a equipe, sem abrir uma conversa sequer.',
    relacionados: ['analytics.vendas-ia', 'analytics.resultado.kpis'],
  },
  {
    featureKey: 'analytics.pagina',
    titulo: 'Radar 360°',
    clientSafe: true,
    oQueE:
      'A página do Radar 360° reúne em um só lugar os números da sua operação de atendimento. Ela é dividida em quatro blocos: Resultado (o que a operação entregou), Vendas atribuídas à IA (quanto disso virou venda), Operação (como está o atendimento no dia a dia) e Campanhas (o alcance dos disparos em massa).',
    paraQueServe:
      'Serve para você decidir rápido sem abrir conversa por conversa: onde a IA está indo bem, onde precisa de mais treino e se as campanhas estão trazendo resposta.',
    comoImplementar: [
      'Escolha o período no topo da página (24 horas, 7 dias, 30 dias ou um intervalo específico).',
      'Leia o Pulso, o resumo em texto logo abaixo do seletor de período.',
      'Desça pelos quatro blocos: Resultado, Vendas atribuídas à IA, Operação e Campanhas.',
      'Clique numa barra do gráfico de Volume ou numa fatia do gráfico de Sentimento para abrir a lista de mensagens ou conversas por trás daquele número.',
    ],
    exemploResultado:
      'Numa clínica com 300 conversas por mês, o dono abre o Radar 360° na segunda de manhã, vê que a IA resolveu 78% sozinha na semana anterior, que o sentimento das conversas ficou majoritariamente neutro e que a última campanha de reengajamento trouxe 40 respostas. Em menos de um minuto ele sabe se precisa agir em algo.',
    relacionados: ['analytics.pulso', 'analytics.resultado.kpis'],
  },
  {
    featureKey: 'analytics.resultado.kpis',
    titulo: 'Resultado da operação',
    clientSafe: true,
    oQueE:
      'Este bloco mostra quatro números centrais do período escolhido: quanto a IA respondeu sozinha, quantas conversas foram resolvidas, quantos contatos novos entraram e a nota média de satisfação (CSAT). Ao lado de cada número aparece a variação em relação ao período anterior: pp quando é uma taxa (pontos percentuais), % quando é uma quantidade, ou um número puro, como +0,4, quando é uma nota, como no caso do CSAT.',
    paraQueServe:
      'Serve para você ver de relance se a operação está melhorando ou piorando, sem precisar comparar planilhas ou abrir relatório nenhum.',
    comoImplementar: [
      'Escolha o período no topo da página: os quatro cards se atualizam automaticamente.',
      'Compare o valor com a variação pequena abaixo dele: seta para cima e verde é melhora, seta para baixo e vermelho é piora em relação ao período anterior.',
      'Clique no card de CSAT para ver a explicação específica dessa métrica.',
    ],
    exemploResultado:
      'Numa loja de roupas com 500 conversas por mês, os cards mostram Respostas pela IA em 82% (+5pp), Conversas resolvidas em 410 (+12%), Novos contatos em 96 (+3%) e CSAT em 4,6. O dono percebe que a IA melhorou a automação sem perder satisfação do cliente.',
    relacionados: ['analytics.resultado.csat', 'analytics.pulso'],
  },
  {
    featureKey: 'analytics.resultado.csat',
    titulo: 'CSAT (satisfação do cliente)',
    clientSafe: true,
    oQueE:
      'CSAT é a sigla em inglês para satisfação do cliente. Aqui ela aparece como uma nota média de 0 a 5, calculada a partir das avaliações que os clientes respondem sobre o atendimento que receberam. Esse mecanismo de avaliação ainda não vem ativo por padrão: enquanto não houver notas registradas na sua operação, o card mostra "-".',
    paraQueServe:
      'Quando a avaliação estiver ativa, serve para você saber se o jeito que a IA e a equipe estão atendendo realmente agrada quem conversa no WhatsApp, não só se as conversas estão sendo resolvidas rápido.',
    comoImplementar: [
      'Veja a nota no card CSAT, dentro do bloco Resultado.',
      'Se aparecer "-", é porque ainda não há avaliações de clientes registradas nesse período.',
      'Para ativar a coleta de avaliação de satisfação na sua operação, fale com o suporte da ZappIQ.',
    ],
    exemploResultado:
      'Numa academia com 200 conversas no mês e avaliação já ativa, o CSAT aparece em 4,2. Ao comparar com o mês anterior, que estava em 4,6, o dono percebe a queda e vai direto no gráfico de sentimento das conversas para achar o que mudou.',
    relacionados: ['analytics.resultado.kpis', 'analytics.operacao.sentimento'],
  },
  {
    featureKey: 'analytics.vendas-ia',
    titulo: 'Vendas atribuídas à IA',
    clientSafe: true,
    oQueE:
      'Esta seção mostra quanto em vendas ganhas no CRM teve participação da Iza na conversa: o que ela fechou sozinha, sem um humano entrar nas últimas 24 horas antes do fechamento, e o que ela ajudou a fechar, mesmo com um humano concluindo depois.',
    paraQueServe:
      'Serve para você enxergar o retorno financeiro real da IA no atendimento, não só o número de conversas que ela respondeu.',
    comoImplementar: [
      'Marque as vendas como ganhas no CRM, na tela de Pipeline, quando elas fecharem normalmente.',
      'Volte ao Radar 360° e veja o valor total dividido em "Fechada pela IA" e "Assistida pela IA", no resumo do topo.',
      'Clique num negócio da lista para abrir o detalhe e ver as mensagens da Iza que ajudaram a fechar aquela venda.',
      'Se aparecer um vínculo sugerido pela IA na caixa amarela no topo, confirme ou recuse: isso evita que a mesma sugestão volte a aparecer para esse negócio e mantém o valor de vendas atribuídas correto.',
    ],
    exemploResultado:
      'Numa clínica odontológica que fechou R$ 18.000 em vendas no mês, o Radar 360° mostra R$ 11.000 fechados pela Iza sozinha e R$ 7.000 assistidos, onde ela conversou mas um atendente humano finalizou. O dono usa esse número para justificar manter o plano da IA.',
    relacionados: ['analytics.vendas-ia.influencia'],
  },
  {
    featureKey: 'analytics.vendas-ia.influencia',
    titulo: 'Influência da Iza',
    clientSafe: true,
    oQueE:
      'É um percentual que mostra o quanto a Iza participou da conversa que levou àquela venda, calculado comparando quantas mensagens foram da IA e quantas foram de um humano naquele negócio.',
    paraQueServe:
      'Serve para diferenciar vendas onde a IA fez quase tudo sozinha de vendas onde ela só deu uma força pontual, ajudando você a decidir onde vale a pena investir mais treinamento da IA.',
    comoImplementar: [
      'Abra a seção Vendas atribuídas à IA e clique num negócio da lista para expandir o detalhe.',
      'Veja o percentual de Influência da Iza, junto com a contagem de mensagens da IA e de humanos.',
      'Role para ver os momentos específicos que a Iza destravou naquela conversa.',
    ],
    exemploResultado:
      'Num negócio fechado em R$ 2.400, a Influência da Iza aparece em 75%, com 9 mensagens da IA contra 3 de um humano. O dono entende que a IA fez a maior parte do trabalho de convencimento antes do fechamento.',
    relacionados: ['analytics.vendas-ia'],
  },
  {
    featureKey: 'analytics.operacao.volume',
    titulo: 'Volume de mensagens recebidas',
    clientSafe: true,
    oQueE:
      'É um gráfico de barras com a quantidade de mensagens que os clientes enviaram no período escolhido, organizadas por hora em períodos curtos ou por dia em períodos mais longos. O gráfico conta só o que os clientes mandaram, não as respostas enviadas.',
    paraQueServe:
      'Serve para identificar os horários e dias de maior movimento, ajudando a planejar quando reforçar a equipe humana ou revisar como a IA está respondendo nos picos.',
    comoImplementar: [
      'Escolha o período no topo da página.',
      'Passe o mouse sobre uma barra para ver o total exato daquele horário ou dia.',
      'Clique numa barra para abrir a lista das mensagens daquele recorte.',
    ],
    exemploResultado:
      'Num restaurante que recebe pedidos por WhatsApp, o gráfico mostra picos entre 11h30 e 13h todos os dias. O dono usa essa informação para garantir que alguém acompanhe a IA de perto nesse horário.',
    relacionados: ['analytics.operacao.sentimento'],
  },
  {
    featureKey: 'analytics.operacao.primeira-resposta',
    titulo: 'Tempo de 1ª resposta',
    clientSafe: true,
    oQueE:
      'É quanto tempo, em média, o cliente espera até receber a primeira resposta depois de mandar mensagem. Quando aparece "p95", é o tempo que cobre 95% dos casos, ou seja, o pior tempo de espera que a maioria dos clientes ainda enfrenta.',
    paraQueServe:
      'Serve para saber se o atendimento está respondendo rápido o suficiente para não perder o cliente para a concorrência, já que no WhatsApp a expectativa de resposta é quase imediata.',
    comoImplementar: [
      'Veja o card 1ª resposta (média), no bloco Operação.',
      'Compare com o p95 logo abaixo: se a diferença for grande, alguns clientes esperam bem mais que a média.',
      'Se o tempo estiver alto, veja se a IA está pausada em algumas conversas por atendimento humano assumido.',
    ],
    exemploResultado:
      'Numa loja de móveis, a média de 1ª resposta é 40 segundos, mas o p95 é 6 minutos. O dono percebe que a maioria é atendida na hora, mas alguns clientes esperam bem mais, e vai investigar se são conversas que caíram para atendimento humano.',
    relacionados: ['analytics.pulso'],
  },
  {
    featureKey: 'analytics.operacao.sentimento',
    titulo: 'Sentimento das conversas',
    clientSafe: true,
    oQueE:
      'É um gráfico de pizza que mostra como as conversas são classificadas por sentimento: Positivo, Neutro ou Negativo, a partir do que o cliente escreveu, não é uma pesquisa que o cliente responde. A ideia é que a IA faça essa leitura automaticamente, mas esse recurso ainda não está ligado ao fluxo normal de mensagens: por enquanto, esse gráfico costuma aparecer vazio, com a mensagem "Sem dados de sentimento".',
    paraQueServe:
      'Quando ativo, serve para você priorizar atenção humana nas conversas marcadas como Negativo antes que o cliente desista ou reclame em outro lugar.',
    comoImplementar: [
      'Veja a fatia de cada sentimento no gráfico, dentro do bloco Operação.',
      'Se o gráfico aparecer vazio, é porque a classificação automática ainda não está ativa na sua operação.',
      'Quando houver dados, clique numa fatia para abrir a lista das conversas daquele sentimento e revise as marcadas como Negativo primeiro.',
    ],
    exemploResultado:
      'Numa barbearia com 150 conversas no mês e a classificação já ativa, o gráfico mostra 70% Neutro, 22% Positivo e 8% Negativo. O dono abre as 12 conversas Negativo e descobre que a maioria reclamava do mesmo horário lotado, então ajusta a agenda.',
    relacionados: ['analytics.operacao.volume'],
  },
  {
    featureKey: 'analytics.campanhas.funil',
    titulo: 'Funil de campanhas',
    clientSafe: true,
    oQueE:
      'É o resultado das campanhas de WhatsApp que você enviou em massa, mostrado em quatro etapas: Enviadas, Entregues, Lidas e Respondidas. Cada etapa mostra quanto sobrou da etapa anterior. A etapa Lidas depende do cliente ter a confirmação de leitura ativada no WhatsApp dele, então pode aparecer menor do que a leitura real.',
    paraQueServe:
      'Serve para entender onde a campanha perde força: se o problema é no envio, na entrega, ou se as pessoas leem mas não respondem. Isso ajuda a decidir se o texto, o horário ou a lista de contatos precisam mudar.',
    comoImplementar: [
      'Envie uma campanha na tela de Campanhas, usando um template aprovado pela Meta.',
      'Volte ao Radar 360° e veja o funil no bloco Campanhas: cada etapa mostra o número absoluto e o percentual em relação ao total enviado.',
      'Se a maior queda estiver entre Entregues e Lidas, ou entre Lidas e Respondidas, ajuste o texto ou o horário do próximo disparo.',
    ],
    exemploResultado:
      'Numa clínica que disparou uma campanha de reengajamento para 300 contatos, o funil mostra 300 enviadas, 280 entregues, 190 lidas e 45 respondidas. O dono percebe que quase metade das entregues não abriu a mensagem e decide testar um horário diferente na próxima campanha.',
    relacionados: ['analytics.vendas-ia'],
  },
];
