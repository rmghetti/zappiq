import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Dashboard (home /dashboard).
 * Cobre o AgentTrainingWidget (topo, aparece em todas as páginas) e os
 * cards da visão geral: KPIs, gráfico de mensagens, leads por estágio,
 * dia mais ativo, CSAT e o status colorido das conversas recentes.
 */
export const dashboardContent: SaibaMaisContent[] = [
  {
    featureKey: 'dashboard.agent-training-widget',
    titulo: 'Progresso de treinamento do agente',
    clientSafe: true,
    oQueE:
      'É o card que aparece no topo do dashboard mostrando, em porcentagem, o quanto seu agente de IA já está pronto pra atender bem. Esse número soma 5 partes: as respostas do questionário inicial, a identidade definida (nome e tom de voz), os documentos enviados, as perguntas e respostas cadastradas e o WhatsApp conectado.',
    paraQueServe:
      'Ajuda você a saber, num relance, se pode confiar no agente pra atender clientes reais sozinho ou se ainda falta treino. O card só some quando o agente chega no nível Expert.',
    comoImplementar: [
      "Veja o percentual e o nível (Iniciando, Aprendendo, Pronto ou Expert) no topo do card.",
      "Clique em qualquer uma das ações sugeridas (até 3, ordenadas pelas que mais aumentam o score) pra ir direto resolver aquele ponto.",
      "Clique em 'Ver todas as ações de treinamento' pra abrir a página /ai-training com a lista completa.",
    ],
    exemploResultado:
      'Numa clínica que acabou de assinar a ZappIQ, o agente começa em 20% (Iniciando). Depois que o dono sobe 8 documentos sobre os tratamentos e cadastra 12 perguntas frequentes, o score sobe pra 68% (Aprendendo) e o widget já sugere conectar o WhatsApp como próximo passo.',
    relacionados: ['ai-training.readiness-score'],
  },
  {
    featureKey: 'dashboard.kpi.taxa-automacao',
    titulo: 'Taxa de Automação',
    clientSafe: true,
    oQueE:
      'É o percentual das mensagens recebidas no WhatsApp que a IA respondeu sozinha, sem precisar de um atendente humano digitar nada.',
    paraQueServe:
      'Mostra quanto trabalho da sua equipe está sendo poupado pelo agente de IA. Quanto maior a taxa, menos sua equipe precisa parar o que está fazendo pra responder o WhatsApp.',
    comoImplementar: [
      "Veja o card 'Taxa de Automação' entre os 4 KPIs no topo do dashboard.",
      "Troque o período no seletor acima dos cards (Últimas 24h, 7 dias ou 30 dias) pra comparar taxas diferentes.",
      "Se a taxa estiver baixa, treine o agente enviando documentos e cadastrando Q&A: quanto mais ele sabe, mais perguntas responde sozinho.",
    ],
    exemploResultado:
      'Numa loja de roupas com 500 mensagens recebidas no mês, se a IA respondeu 380 delas sem ajuda humana, a Taxa de Automação aparece como 76%. Depois de treinar o agente com o catálogo completo de produtos, essa taxa sobe pra 90% no mês seguinte.',
    relacionados: ['dashboard.agent-training-widget', 'dashboard.kpi.mensagens'],
  },
  {
    featureKey: 'dashboard.kpi.mensagens',
    titulo: 'Mensagens',
    clientSafe: true,
    oQueE:
      'É o número de mensagens que seus clientes mandaram para o WhatsApp da empresa no período escolhido. Conta só o que o cliente enviou, não as respostas da IA nem da sua equipe.',
    paraQueServe:
      'Mostra o volume de gente entrando em contato pelo WhatsApp, pra você entender se o movimento está subindo ou caindo em relação ao período anterior.',
    comoImplementar: [
      "Veja o número grande no card 'Mensagens', no topo do dashboard.",
      "O selo ao lado (verde pra cima, vermelho pra baixo) compara com o período anterior de mesma duração.",
      "Troque o período no seletor do topo pra ver a variação em janelas diferentes.",
    ],
    exemploResultado:
      'Numa academia, o card mostra 1.240 mensagens nos últimos 7 dias, com selo verde de +18% em relação à semana anterior. O dono percebe que a campanha que rodou na semana trouxe mais gente conversando no WhatsApp.',
    relacionados: ['dashboard.grafico.volume-mensagens', 'dashboard.kpi.taxa-automacao'],
  },
  {
    featureKey: 'dashboard.kpi.conversas-abertas',
    titulo: 'Conversas Abertas',
    clientSafe: true,
    oQueE:
      'É a quantidade de conversas em andamento agora mesmo: esperando resposta, sendo respondidas pela IA ou já assumidas por um atendente humano.',
    paraQueServe:
      'Dá uma foto rápida de quanta coisa está rolando ao vivo no seu WhatsApp, sem precisar abrir a tela de Conversas.',
    comoImplementar: [
      "Veja o número no card 'Conversas Abertas', no topo do dashboard.",
      "Repare que esse card não mostra variação percentual como os outros: é porque ele é uma foto do momento, não um total acumulado do período.",
      "Clique em 'Ver todas' na seção Atividade recente, mais abaixo, pra abrir essas conversas.",
    ],
    exemploResultado:
      'Numa clínica odontológica, o card mostra 14 Conversas Abertas às 10h da manhã. Às 18h, quando o dono confere de novo, o número caiu pra 6, porque a IA e a equipe foram fechando os atendimentos ao longo do dia.',
    relacionados: ['dashboard.status-conversa'],
  },
  {
    featureKey: 'dashboard.kpi.novos-contatos',
    titulo: 'Novos Contatos',
    clientSafe: true,
    oQueE:
      'É o número de pessoas diferentes que mandaram mensagem pela primeira vez pro seu WhatsApp dentro do período escolhido. Cada telefone novo conta uma vez só, mesmo que a pessoa mande várias mensagens.',
    paraQueServe:
      'Mostra quantos leads novos estão chegando pelo WhatsApp, pra você acompanhar se anúncios, indicações ou campanhas estão trazendo gente nova.',
    comoImplementar: [
      "Veja o número no card 'Novos Contatos', no topo do dashboard.",
      "Compare com o selo de variação ao lado pra saber se cresceu ou caiu frente ao período anterior.",
      "Vá em Contatos pra ver a lista completa de quem chegou nesse período.",
    ],
    exemploResultado:
      'Numa clínica de estética, o card mostra 34 Novos Contatos nos últimos 30 dias, com selo de +22%. O dono cruza esse número com a campanha de Instagram que rodou no mês e confirma que valeu o investimento.',
    relacionados: ['dashboard.leads-por-estagio'],
  },
  {
    featureKey: 'dashboard.grafico.volume-mensagens',
    titulo: 'Mensagens no período (gráfico)',
    clientSafe: true,
    oQueE:
      'É o gráfico de área que mostra, dia a dia (ou hora a hora, em janelas curtas), quantas mensagens os clientes mandaram pro seu WhatsApp. Cada ponto do gráfico é a soma de mensagens recebidas naquele intervalo.',
    paraQueServe:
      'Ajuda a enxergar picos e quedas de movimento ao longo do tempo, não só o total do período. Serve pra identificar dias parados ou dias de pico que exigem mais atenção.',
    comoImplementar: [
      "Olhe o gráfico dentro do card 'Mensagens no período', na coluna principal do dashboard.",
      "Passe o olho pelas subidas e descidas: cada pico é um intervalo com mais gente mandando mensagem.",
      "Troque o período no topo da página pra ver o gráfico com mais ou menos detalhe.",
    ],
    exemploResultado:
      'Numa pizzaria, o gráfico mostra um pico alto toda sexta e sábado à noite, e quase nada durante a semana de manhã. O dono usa essa informação pra reforçar o atendimento humano nos horários de pico, mesmo com a IA respondendo a maior parte.',
    relacionados: ['dashboard.kpi.mensagens', 'dashboard.dia-mais-ativo'],
  },
  {
    featureKey: 'dashboard.leads-por-estagio',
    titulo: 'Leads por estágio',
    clientSafe: true,
    oQueE:
      "É um resumo de quantos contatos estão em cada fase: Novos (chegaram nesse período), Em atendimento (conversa ainda aberta) e Finalizados (conversa já encerrada). O estágio muda sozinho, de acordo com o status da conversa, você não precisa mover nada manualmente aqui.",
    paraQueServe:
      'Dá uma visão rápida de quanto do seu atendimento está represado (em atendimento) contra o que já foi resolvido, sem precisar contar conversa por conversa.',
    comoImplementar: [
      "Veja os 3 blocos coloridos no card 'Leads por estágio', na coluna principal do dashboard.",
      "Se o número de 'Em atendimento' estiver alto e não baixar, é sinal de conversas acumulando sem resposta final.",
      "Para gerenciar oportunidades de venda com mais detalhe, use o Pipeline de Vendas em CRM.",
    ],
    exemploResultado:
      'Numa barbearia, o card mostra 12 Novos, 5 Em atendimento e 40 Finalizados na semana. O dono percebe que só 5 conversas estão travadas e checa rapidamente quais são antes de fechar o dia.',
    relacionados: ['dashboard.kpi.novos-contatos', 'dashboard.kpi.conversas-abertas'],
  },
  {
    featureKey: 'dashboard.dia-mais-ativo',
    titulo: 'Dia mais ativo',
    clientSafe: true,
    oQueE:
      'É o gráfico de barras que soma todas as mensagens recebidas no período, separadas por dia da semana, e destaca em azul o dia que teve mais movimento.',
    paraQueServe:
      'Ajuda a planejar a escala da equipe: se um dia da semana é claramente mais movimentado, faz sentido ter mais gente disponível pra apoiar a IA nesse dia.',
    comoImplementar: [
      "Veja as 7 barrinhas, uma por dia da semana, no card 'Dia mais ativo', na coluna lateral do dashboard.",
      "A barra azul mais alta é o dia de pico; o texto abaixo do gráfico confirma qual dia é.",
      "Use essa informação pra decidir em qual dia colocar mais gente de plantão, se sua operação ainda depende de atendimento humano em algum ponto.",
    ],
    exemploResultado:
      'Num salão de beleza, o gráfico mostra que sábado concentra quase o dobro de mensagens de qualquer outro dia. A dona passa a deixar uma atendente de sobreaviso aos sábados, mesmo a IA cuidando da maior parte da semana.',
    relacionados: ['dashboard.grafico.volume-mensagens'],
  },
  {
    featureKey: 'dashboard.status-conversa',
    titulo: 'Cor do status da conversa',
    clientSafe: true,
    oQueE:
      'É a bolinha colorida ao lado de cada conversa, na lista de Atividade recente. Verde é conversa aberta e ativa, amarelo é esperando resposta, azul é uma conversa que um atendente humano assumiu, e cinza é conversa já encerrada.',
    paraQueServe:
      'Deixa você identificar de relance, sem abrir cada conversa, quais precisam de atenção agora (amarelo e azul) e quais já estão resolvidas (cinza).',
    comoImplementar: [
      'Olhe a bolinha à direita de cada linha, na seção Atividade recente do dashboard.',
      'Clique na conversa pra abrir e conferir o motivo daquele status, se precisar.',
      'Para ver todas as conversas com filtro por status, vá em Conversas.',
    ],
    exemploResultado:
      'Num escritório de contabilidade, o dono bate o olho na lista e vê 2 bolinhas azuis, conversas que um funcionário assumiu manualmente. Ele confirma rápido que a equipe já está cuidando delas e não precisa intervir.',
    relacionados: ['dashboard.kpi.conversas-abertas'],
  },
  {
    featureKey: 'dashboard.csat',
    titulo: 'Satisfação (CSAT)',
    clientSafe: true,
    oQueE:
      'É a nota média que seus clientes dão pro atendimento, numa escala de 0 a 10. O marcador fica vazio quando ninguém avaliou ainda dentro do período escolhido.',
    paraQueServe:
      'Mostra se seus clientes estão saindo satisfeitos do atendimento, feito pela IA ou por um humano, pra você identificar cedo se algo precisa melhorar.',
    comoImplementar: [
      "Veja o marcador em formato de meia-lua no card 'Satisfação (CSAT)', na coluna lateral do dashboard.",
      "Se aparecer 'Sem avaliações no período', é porque nenhum cliente avaliou ainda: a pesquisa de satisfação enviada ao final do atendimento precisa estar ativa pra essa nota aparecer.",
      'Troque o período no topo da página pra ver a nota média de janelas diferentes.',
    ],
    exemploResultado:
      "Numa clínica veterinária, o gauge mostra nota 8.4 de 10 nos últimos 30 dias, classificada como 'ótimo'. No mês seguinte a nota cai pra 6.2 depois de um problema de agenda, e o dono usa isso como aviso pra investigar o que mudou no atendimento.",
    relacionados: ['dashboard.kpi.taxa-automacao'],
  },
];
