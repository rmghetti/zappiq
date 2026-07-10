import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área CRM (/crm, /crm/agenda, /crm/atribuicao).
 * Cobre pipeline de vendas (kanban), agenda interna e atribuição de campanhas.
 */
export const crmContent: SaibaMaisContent[] = [
  // ─────────────────────────────────────────────────────────────────
  // /crm - Pipeline de Vendas
  // ─────────────────────────────────────────────────────────────────
  {
    featureKey: 'crm.pipeline',
    titulo: 'Pipeline de Vendas',
    clientSafe: true,
    oQueE:
      'O Pipeline é a lista dos seus negócios em andamento, organizados em colunas por fase: Novo, Qualificado, Proposta, Negociação, Ganho e Perdido. Cada cartão é um negócio, chamado de "deal" aqui dentro, com um cliente, um valor e uma fase atual.',
    paraQueServe:
      'Serve para você ver de relance quantas vendas estão em andamento, em que fase cada uma está e quanto dinheiro está em jogo, sem precisar abrir planilha nem perguntar pro time como estão as negociações.',
    comoImplementar: [
      'Na primeira vez que a IA identifica uma intenção de compra numa conversa de WhatsApp, ela cria um deal aqui automaticamente, já com o contato vinculado. Se esse contato já tiver um negócio aberto, a IA move esse negócio para a fase de Proposta em vez de criar um novo.',
      'Para criar um deal você mesmo, clique em "Novo Deal" no canto superior direito, ou no botão + no topo de qualquer coluna.',
      'Arraste o cartão para outra coluna quando o negócio avançar. Ao soltar em "Perdido", o sistema pede o motivo da perda.',
      'Clique em qualquer cartão para abrir os detalhes: editar título e valor, ver o contato, a conversa de origem e o histórico completo do negócio.',
    ],
    exemploResultado:
      'Numa loja de móveis planejados com 25 conversas novas por semana, o dono via antes as vendas se perdendo em conversas separadas no WhatsApp. Com o Pipeline, ele vê em segundos que tem 8 negócios em "Proposta" parados há mais de 5 dias e liga pra esses clientes primeiro, em vez de atender por ordem de chegada.',
    relacionados: ['crm.pipeline.kanban', 'crm.pipeline.kpis', 'crm.pipeline.deal-drawer'],
  },
  {
    featureKey: 'crm.pipeline.kpis',
    titulo: 'Indicadores do Pipeline',
    clientSafe: true,
    oQueE:
      'É a barra com 6 números no topo do Pipeline. Win Rate é a taxa de negócios ganhos. Ticket Médio é o valor médio de cada venda. Forecast é a previsão de quanto você deve faturar com os negócios ainda abertos. Sales Velocity é a velocidade em que o dinheiro entra, em reais por dia. Ciclo Médio é quantos dias, em média, um negócio leva do início até ser ganho. Perdas é quantos negócios foram perdidos no período, com o motivo mais comum.',
    paraQueServe:
      'Serve pra você entender, de forma rápida, se o seu funil de vendas está saudável: se está vendendo bem, se o ticket está caindo, se está demorando demais pra fechar e por que está perdendo negócio.',
    comoImplementar: [
      'Os 6 cartões ficam sempre visíveis no topo da página /crm, acima do kanban.',
      'Passe o mouse sobre o texto pequeno abaixo do número de cada cartão pra ver o detalhe completo (ex: quantos negócios entraram na conta daquele número).',
      'Os números são recalculados automaticamente sempre que um deal muda de fase.',
      'Use o cartão "Perdas" pra ver rápido qual é o motivo de perda mais comum e agir sobre ele (preço, concorrente, demora na resposta etc).',
    ],
    exemploResultado:
      'Numa clínica odontológica, o dono percebe que o Win Rate caiu de 40% para 22% num mês e que o motivo de perda mais comum virou "Preço". Com esse alerta, ele revisa a tabela de valores dos planos antes de perder ainda mais pacientes.',
    relacionados: ['crm.pipeline.kpis.win-rate', 'crm.pipeline.kpis.forecast', 'crm.pipeline.kpis.sales-velocity'],
  },
  {
    featureKey: 'crm.pipeline.kanban',
    titulo: 'Kanban de vendas',
    clientSafe: true,
    oQueE:
      'O kanban é o quadro com as colunas Novo, Qualificado, Proposta, Negociação, Ganho e Perdido. Cada coluna representa uma fase do processo de venda, da primeira conversa até o fechamento.',
    paraQueServe:
      'Serve pra você acompanhar visualmente onde cada negócio está parado e mover ele pra frente conforme a conversa avança com o cliente, sem depender de planilha ou memória.',
    comoImplementar: [
      'Clique e segure num cartão, arraste até a coluna da nova fase e solte. O negócio muda de fase na hora.',
      'Mova pra "Qualificado" quando o cliente já demonstrou interesse real. Pra "Proposta" quando você já enviou preço. Pra "Negociação" quando ele está negociando condições.',
      'Ao soltar um cartão em "Ganho", o negócio é contado como venda fechada nos indicadores. Ao soltar em "Perdido", o sistema abre uma janela pra você registrar o motivo.',
      'O motivo de perda registrado alimenta o cartão "Perdas" e o rodapé "Por que perdemos", então vale sempre preencher com sinceridade.',
    ],
    exemploResultado:
      'Numa loja de roupas, a vendedora arrasta o cartão de uma cliente de "Proposta" pra "Negociação" assim que ela pede desconto. No fim do mês, o dono olha o kanban e vê 6 cartões parados há mais de uma semana em "Proposta" e decide ligar pra esses clientes antes que esfriem.',
    relacionados: ['crm.pipeline', 'crm.pipeline.deal-drawer'],
  },
  {
    featureKey: 'crm.pipeline.deal-drawer',
    titulo: 'Detalhes do negócio',
    clientSafe: true,
    oQueE:
      'É o painel que abre do lado direito da tela quando você clica num cartão do kanban. Mostra o título e o valor do negócio (editáveis), o contato vinculado, a conversa de WhatsApp que deu origem ao negócio (quando existe) e uma linha do tempo com tudo que já aconteceu nesse negócio.',
    paraQueServe:
      'Serve pra você editar rapidamente um negócio, entender o histórico completo sem precisar procurar em outro lugar, e abrir a conversa original no WhatsApp com um clique.',
    comoImplementar: [
      'Clique em qualquer cartão do kanban pra abrir o painel.',
      'Clique em "Editar", em Detalhes, pra mudar o título ou o valor do negócio. Depois clique em Salvar.',
      'Na seção Contato, use o botão WhatsApp pra abrir a conversa direto no wa.me, ou "Abrir conversa" pra ver a conversa dentro do próprio Dashboard.',
      'Role até Atividades pra ver a linha do tempo: cada mudança de fase, nota, mensagem e resumo gerado pela IA fica registrado ali, na ordem em que aconteceu.',
    ],
    exemploResultado:
      'Um vendedor recebe uma ligação de um cliente que já conversou pelo WhatsApp semanas atrás. Ele abre o negócio dele no Pipeline, vê no painel a conversa de origem e o resumo que a IA fez daquela conversa, e já sabe exatamente o que o cliente queria sem precisar perguntar de novo.',
    relacionados: ['crm.pipeline.kanban', 'crm.pipeline.deal-drawer.timeline'],
  },
  {
    featureKey: 'crm.pipeline.deal-drawer.timeline',
    titulo: 'Linha do tempo do negócio',
    clientSafe: true,
    oQueE:
      'É a lista de atividades dentro do painel de detalhes do negócio. Cada linha é um evento: o negócio foi criado, mudou de fase, recebeu uma nota, virou tarefa, ou a IA gerou um resumo da conversa. Alguns eventos são registrados automaticamente pelo sistema, outros por uma pessoa da equipe.',
    paraQueServe:
      'Serve pra reconstruir rapidamente o histórico de um negócio sem precisar perguntar pra quem atendeu antes, principalmente quando mais de uma pessoa cuida das vendas.',
    comoImplementar: [
      'Abra o negócio no kanban e role até a seção Atividades, no fim do painel.',
      'Cada item mostra o tipo do evento (ex: "Mudança de estágio", "Resumo da IA"), a data e, quando existe, um texto explicando o que aconteceu.',
      'Quando o evento tem uma conversa relacionada, clique em "Ver conversa" pra abrir ela direto.',
    ],
    exemploResultado:
      'Numa imobiliária com 3 corretores usando o mesmo Pipeline, um corretor assume um negócio que outro estava cuidando. Ele abre a linha do tempo e vê que o cliente já visitou o imóvel, pediu desconto e recebeu uma proposta há 4 dias, então já entra na ligação sabendo o contexto todo.',
    relacionados: ['crm.pipeline.deal-drawer'],
  },
  {
    featureKey: 'crm.pipeline.kpis.win-rate',
    titulo: 'Win Rate',
    clientSafe: true,
    oQueE:
      'Win Rate é a taxa de negócios que você ganha, em português: percentual de vendas fechadas. A conta é simples: número de negócios ganhos dividido pela soma de ganhos mais perdidos, no período mostrado.',
    paraQueServe:
      'Serve pra saber se o seu processo de venda está funcionando. Um Win Rate baixo indica que muitos negócios estão esfriando ou sendo perdidos antes de fechar, e vale investigar o motivo no cartão de Perdas.',
    comoImplementar: [
      'O cartão fica na barra de indicadores, no topo do /crm, com o rótulo "Win Rate".',
      'O texto pequeno abaixo mostra a conta exata, tipo "8 de 20 fechados", que já é ganhos + perdidos no período.',
      'Compare o número ao longo dos meses: uma queda constante é sinal de alerta pra revisar preço, atendimento ou concorrência.',
    ],
    exemploResultado:
      'Numa academia, 20 negócios fecharam no mês: 8 viraram matrícula e 12 foram perdidos. O Win Rate é 8 dividido por 20, ou seja, 40%. O dono passa a acompanhar esse número todo mês pra saber se as ações de vendas estão melhorando ou piorando.',
    relacionados: ['crm.pipeline.kpis', 'crm.pipeline.conversao-estagio'],
  },
  {
    featureKey: 'crm.pipeline.kpis.forecast',
    titulo: 'Forecast',
    clientSafe: true,
    oQueE:
      'Forecast é a previsão de faturamento com os negócios que ainda estão abertos no pipeline. Ele não soma o valor cheio de cada negócio: cada fase tem uma probabilidade de virar venda (por exemplo, um negócio em Negociação tem mais chance de fechar do que um em Novo), e o sistema pondera o valor de cada negócio por essa chance antes de somar.',
    paraQueServe:
      'Serve pra você ter uma estimativa realista de quanto vai faturar nos próximos dias, sem contar como certo um negócio que ainda está no começo da conversa.',
    comoImplementar: [
      'O cartão "Forecast" fica na barra de indicadores do /crm, com o total já calculado.',
      'Pra ver de onde vem esse número, role até o rodapé da página e abra o bloco "De onde vem o forecast", que mostra o cálculo por fase.',
      'Use esse número pro planejamento de caixa: ele é mais confiável do que somar o valor de todos os negócios abertos.',
    ],
    exemploResultado:
      'Uma prestadora de serviços tem R$ 30 mil em negócios abertos em Novo (chance baixa de fechar) e R$ 15 mil em Negociação (chance alta). O Forecast pondera isso e mostra algo como R$ 13,5 mil de previsão realista, em vez dos R$ 45 mil somados sem critério, evitando que o dono planeje gastos com base num valor otimista demais.',
    relacionados: ['crm.pipeline.forecast-breakdown', 'crm.pipeline.kpis'],
  },
  {
    featureKey: 'crm.pipeline.kpis.sales-velocity',
    titulo: 'Sales Velocity',
    clientSafe: true,
    oQueE:
      'Sales Velocity é a velocidade em que a receita entra no seu negócio, medida em reais por dia. A conta junta 4 informações: quantos negócios você ganhou no período, sua taxa de vendas ganhas (Win Rate), o ticket médio e quanto tempo, em média, um negócio leva pra fechar (Ciclo Médio).',
    paraQueServe:
      'Serve como um termômetro único da saúde comercial: se esse número sobe, significa que você está vendendo mais rápido, com ticket maior ou com ciclo de venda mais curto. Se cai, alguma dessas engrenagens travou.',
    comoImplementar: [
      'O cartão "Sales Velocity" fica na barra de indicadores do /crm, mostrado em reais por dia.',
      'Acompanhe esse número junto com os outros 5 cartões: se ele cair, olhe o Win Rate, o Ticket Médio e o Ciclo Médio pra descobrir qual dos três piorou.',
      'Ações que aumentam esse número: fechar negócios mais rápido, vender ticket maior ou converter mais propostas em vendas.',
    ],
    exemploResultado:
      'Uma loja de eletrônicos ganhou 40 negócios no período, com Win Rate de 30%, ticket médio de R$ 800 e ciclo médio de 10 dias. O Sales Velocity dá algo perto de R$ 960 por dia. Se o dono reduzir o tempo de resposta e o ciclo cair pra 7 dias, esse número sobe mesmo sem ganhar mais negócios, porque o dinheiro entra mais rápido.',
    relacionados: ['crm.pipeline.kpis', 'crm.pipeline.kpis.win-rate'],
  },
  {
    featureKey: 'crm.pipeline.conversao-estagio',
    titulo: 'Conversão por estágio',
    clientSafe: true,
    oQueE:
      'É o bloco no rodapé do Pipeline que mostra, fase por fase, quantos negócios que passaram por ali seguiram em frente. Por exemplo, "3/10 · 30%" quer dizer que, de 10 negócios que chegaram naquela fase, só 3 avançaram pra próxima.',
    paraQueServe:
      'Serve pra achar o gargalo do seu funil de vendas: a fase onde os negócios mais travam ou somem é onde vale a pena focar esforço, seja treinando a equipe, ajustando o discurso de venda ou revisando o preço.',
    comoImplementar: [
      'Role até o rodapé da página /crm e veja o bloco "Conversão por estágio · últimos X dias".',
      'Cada linha é uma fase, com a barrinha mostrando visualmente o percentual de avanço.',
      'Procure a fase com a barra mais curta: é ali que mais negócios estão sendo perdidos ou abandonados.',
    ],
    exemploResultado:
      'Numa escola de idiomas, o bloco mostra que 9 de 10 negócios avançam de "Novo" pra "Qualificado" (90%), mas só 2 de 9 avançam de "Proposta" pra "Negociação" (22%). Isso mostra que o problema não é atrair interesse, é a proposta enviada, e o dono revisa o material de vendas usado nessa fase.',
    relacionados: ['crm.pipeline.kpis.win-rate', 'crm.pipeline'],
  },
  {
    featureKey: 'crm.pipeline.forecast-breakdown',
    titulo: 'De onde vem o forecast',
    clientSafe: true,
    oQueE:
      'É o bloco no rodapé do Pipeline que detalha o cálculo do Forecast, fase por fase. Pra cada fase aberta, mostra o valor bruto (soma de todos os negócios daquela fase, sem desconto) e o valor projetado (o valor bruto multiplicado pela chance de fechamento daquela fase). A barra cinza clara mostra o valor bruto e a barra roxa, por cima, mostra o valor projetado.',
    paraQueServe:
      'Serve pra você entender por que o Forecast não é a soma simples dos negócios abertos, e enxergar em qual fase está concentrado o valor que você realmente pode esperar receber.',
    comoImplementar: [
      'Role até o rodapé da página /crm e veja o bloco "De onde vem o forecast".',
      'A porcentagem entre parênteses ao lado do nome da fase é a chance de fechamento usada na conta daquela fase.',
      'A barra roxa (valor projetado) sempre é menor ou igual à barra cinza (valor bruto), porque é o valor bruto multiplicado pela chance.',
      'O total no fim do bloco bate com o número do cartão "Forecast" no topo da página.',
    ],
    exemploResultado:
      'Uma consultoria tem R$ 20 mil em negócios na fase Negociação, com 70% de chance de fechamento. O bloco mostra a barra cinza em R$ 20 mil e a barra roxa em R$ 14 mil, deixando claro que, apesar de ter R$ 20 mil em jogo, o valor esperado real é R$ 14 mil.',
    relacionados: ['crm.pipeline.kpis.forecast'],
  },

  // ─────────────────────────────────────────────────────────────────
  // /crm/agenda - Agenda interna (hub de agendamentos)
  // ─────────────────────────────────────────────────────────────────
  {
    featureKey: 'crm.agenda',
    titulo: 'Agenda',
    clientSafe: true,
    oQueE:
      'A Agenda é o lugar único onde ficam todos os próximos agendamentos do seu negócio (até 60 dias à frente), sejam eles marcados pela IA numa conversa de WhatsApp ou sincronizados de um calendário externo, como Google Agenda. Ela é a fonte da verdade: tudo que a IA agenda aparece aqui primeiro.',
    paraQueServe:
      'Serve pra você e sua equipe confirmarem, remarcarem ou cancelarem um horário marcado pela IA, e registrarem se o cliente compareceu, sem precisar checar WhatsApp e calendário separadamente.',
    comoImplementar: [
      'Os agendamentos aparecem automaticamente aqui assim que a IA marca um horário numa conversa, agrupados por dia.',
      'Use os ícones do lado direito de cada horário pra confirmar, marcar como concluído, registrar não comparecimento ou cancelar.',
      'Pra IA começar a agendar sozinha, configure os tipos de agendamento (ex: "Consulta", "Visita") em Treinar IA → Agendamento.',
      'Clique em "Atualizar" no topo da página pra recarregar a lista com os agendamentos mais recentes.',
    ],
    exemploResultado:
      'Numa clínica de estética, a IA marca uma avaliação pelo WhatsApp às 22h de um sábado. Na segunda de manhã, a recepcionista abre a Agenda, vê o horário já com o nome da cliente e o telefone, e confirma o atendimento com um clique, sem ter ficado de plantão no fim de semana.',
    relacionados: ['crm.agenda.origem'],
  },
  {
    featureKey: 'crm.agenda.origem',
    titulo: 'Origem do agendamento',
    clientSafe: true,
    oQueE:
      'É a etiqueta pequena ao lado de cada agendamento que mostra de onde ele veio. "Via IA" quer dizer que a própria IA marcou esse horário durante uma conversa de WhatsApp. "Calendário externo" quer dizer que o agendamento veio de um Google Agenda conectado à sua conta. Quando não aparece etiqueta, o horário foi registrado direto por alguém da equipe.',
    paraQueServe:
      'Serve pra você distinguir rapidamente quais horários a IA está gerando sozinha versus quais vieram de outro lugar, e acompanhar se a IA está realmente ajudando a preencher a agenda.',
    comoImplementar: [
      'A etiqueta aparece automaticamente na segunda linha de cada agendamento, junto com o telefone do cliente.',
      'Se você já usa Google Agenda e quer que ele sincronize com essa Agenda, configure a conexão em Treinar IA → Agendamento.',
      'Compare ao longo do tempo quantos agendamentos vêm com a etiqueta "via IA": esse número cresce conforme a IA fica mais treinada em agendamento.',
    ],
    exemploResultado:
      'Num consultório de fisioterapia com Google Agenda conectado, o dono vê que metade dos horários da semana tem a etiqueta "via IA" e a outra metade "calendário externo", vindos de pacientes antigos que ainda ligam. Isso mostra o quanto a IA já está assumindo do trabalho de agendar.',
    relacionados: ['crm.agenda'],
  },

  // ─────────────────────────────────────────────────────────────────
  // /crm/atribuicao - Atribuição de campanhas
  // ─────────────────────────────────────────────────────────────────
  {
    featureKey: 'crm.atribuicao',
    titulo: 'Atribuição de campanhas',
    clientSafe: true,
    oQueE:
      'Atribuição é ligar uma campanha de WhatsApp que você disparou a vendas reais que ela gerou. Essa página mostra o caminho completo de cada campanha: quantas mensagens foram enviadas, quantas pessoas responderam, quantos viraram contato, quantos viraram negócio no Pipeline e quantos desses negócios você realmente ganhou.',
    paraQueServe:
      'Serve pra você saber quais campanhas realmente trazem venda, não só resposta ou curtida, e decidir em qual tipo de campanha vale a pena investir mais tempo e dinheiro.',
    comoImplementar: [
      'Acesse pelo botão "Atribuição" no topo do Pipeline (/crm), ou direto em /crm/atribuicao.',
      'Cada linha da tabela é uma campanha disparada em Campanhas, com o funil completo: enviadas, respostas, contatos, deals, ganhos e receita.',
      'Use as abas "ROI", "Receita" e "Mais recentes" pra ordenar a tabela pelo critério que mais importa pra você.',
      'Leia o aviso azul no fim da página pra entender como o custo de cada campanha (CAC) é estimado.',
    ],
    exemploResultado:
      'Uma loja de cosméticos dispara duas campanhas no mesmo mês: uma de reengajamento e uma de lançamento de produto. Na página de Atribuição, o dono vê que a campanha de reengajamento trouxe menos respostas, mas gerou 3 vezes mais vendas fechadas, e passa a repetir esse tipo de campanha com mais frequência.',
    relacionados: ['crm.atribuicao.kpis.roi', 'crm.atribuicao.tabela-campanhas'],
  },
  {
    featureKey: 'crm.atribuicao.kpis.roi',
    titulo: 'ROI geral',
    clientSafe: true,
    oQueE:
      'ROI é o retorno sobre o investimento, em português: quanto você ganhou de volta pra cada real gasto em campanhas. A conta é (receita gerada menos custo da campanha) dividido pelo custo da campanha. Um ROI de +200% quer dizer que, pra cada R$ 1 gasto, voltaram R$ 3 (o R$ 1 investido mais R$ 2 de lucro). Um ROI negativo quer dizer que a campanha gastou mais do que trouxe de volta.',
    paraQueServe:
      'Serve pra você ter, num único número, se suas campanhas de WhatsApp estão dando lucro ou prejuízo, somando todas elas.',
    comoImplementar: [
      'O cartão "ROI geral" fica entre os 4 indicadores no topo de /crm/atribuicao.',
      'O texto pequeno abaixo mostra o CAC estimado (custo de aquisição de cliente) usado na conta.',
      'Se o número aparecer em vermelho, é negativo: suas campanhas custaram mais do que trouxeram de receita ganha até agora.',
      'Compare com o ROI de cada campanha individual na tabela abaixo pra achar qual campanha está puxando a média pra baixo.',
    ],
    exemploResultado:
      'Uma barbearia gastou R$ 200 estimados numa campanha de promoção e ela gerou R$ 900 em serviços fechados. O ROI é (900 menos 200) dividido por 200, ou seja, +350%. O dono vê que vale muito a pena repetir esse tipo de disparo.',
    relacionados: ['crm.atribuicao', 'crm.atribuicao.kpis.receita-atribuida'],
  },
  {
    featureKey: 'crm.atribuicao.kpis.receita-atribuida',
    titulo: 'Receita atribuída',
    clientSafe: true,
    oQueE:
      'Receita atribuída é a soma do valor de todos os negócios que você ganhou e que vieram de uma campanha rastreada. Ela não é o faturamento total do seu negócio: é só a parte que dá pra ligar diretamente a uma campanha de WhatsApp que você disparou.',
    paraQueServe:
      'Serve pra você medir o retorno financeiro real das suas campanhas, sem confundir com vendas que vieram de outros canais, como indicação ou busca orgânica.',
    comoImplementar: [
      'O cartão "Receita atribuída" fica no topo de /crm/atribuicao, com o texto pequeno mostrando quantos negócios ganhos entraram nessa conta.',
      'Só entram aqui negócios que estão marcados como "Ganho" no Pipeline e que têm uma campanha de origem identificada.',
      'Compare esse valor mês a mês pra acompanhar se suas campanhas estão gerando mais ou menos venda com o tempo.',
    ],
    exemploResultado:
      'Uma pizzaria fatura R$ 40 mil no mês, mas só R$ 6 mil desse valor vieram de negócios criados a partir de campanhas de WhatsApp disparadas. O dono não confunde os R$ 40 mil com o resultado das campanhas: usa os R$ 6 mil pra decidir se vale continuar disparando.',
    relacionados: ['crm.atribuicao.kpis.roi', 'crm.atribuicao.tabela-campanhas'],
  },
  {
    featureKey: 'crm.atribuicao.tabela-campanhas',
    titulo: 'Tabela de campanhas',
    clientSafe: true,
    oQueE:
      'É a tabela com uma linha por campanha disparada, mostrando o caminho completo dela: quantas mensagens foram Enviadas, quantas geraram Respostas, quantas viraram Contatos novos, quantos desses viraram negócio (Deals) no Pipeline, quantos foram Ganhos, quanta Receita eles geraram, o CAC (custo estimado por cliente conquistado) e o ROI (retorno sobre o investimento) de cada campanha.',
    paraQueServe:
      'Serve pra comparar campanhas lado a lado e enxergar em qual ponto do caminho (enviar, responder, virar contato, virar negócio, fechar venda) cada uma perde mais gente, pra melhorar a próxima.',
    comoImplementar: [
      'A tabela fica logo abaixo dos 4 indicadores gerais em /crm/atribuicao.',
      'Leia da esquerda pra direita como um funil: cada coluna é uma etapa mais adiante da anterior, sempre com um número igual ou menor.',
      'Clique nas abas de ordenação acima da tabela ("ROI", "Receita", "Mais recentes") pra reorganizar as linhas pelo critério que importa no momento.',
      'Passe o mouse sobre o nome da campanha se ele estiver cortado, pra ver o nome completo.',
    ],
    exemploResultado:
      'Uma loja de calçados compara duas campanhas na tabela: a Campanha A teve 500 envios e 40 respostas, mas só 2 vendas. A Campanha B teve 200 envios, 60 respostas e 10 vendas. Mesmo enviando menos, a Campanha B teve ROI muito melhor, e o dono passa a priorizar esse formato de mensagem nas próximas campanhas.',
    relacionados: ['crm.atribuicao', 'crm.atribuicao.kpis.roi'],
  },
];
