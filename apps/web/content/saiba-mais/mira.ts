import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais do Mira Prospects (add-on de inteligência e
 * qualificação de oportunidades). Voz: pt-BR, /voz-humana, sem travessão.
 */
export const miraContent: SaibaMaisContent[] = [
  {
    featureKey: 'mira.overview',
    titulo: 'Mira Prospects',
    clientSafe: true,
    oQueE:
      'O Mira Prospects é a inteligência de oportunidades da ZappIQ. Você diz o que vende e para quem, e agentes de IA saem mapeando o seu mercado: encontram empresas e negócios com o perfil ideal, descobrem quem decide a compra, qual a dor do momento e qual produto seu resolve. Cada conta aprovada vira um Alvo: uma oportunidade qualificada com dossiê completo, pronta para o seu time trabalhar.',
    paraQueServe:
      'Serve para acabar com a prospecção no escuro. Em vez de comprar lista fria ou depender só de quem chega, você recebe uma fila de oportunidades priorizadas por nota, com contexto de sobra para abordar bem: quem procurar, sobre o que falar e por que agora. Tudo grava no CRM da ZappIQ e sai em relatório quando você quiser.',
    comoImplementar: [
      'Ative o Mira Prospects em Plano e Fatura (disponível a partir do plano Growth).',
      'Preencha o Perfil de Prospecção: seu segmento, seus produtos e quem é o cliente ideal.',
      'Acompanhe a fila em Alvos: os agentes mapeiam, qualificam e priorizam sozinhos.',
      'Abra o dossiê de cada Alvo e use o roteiro de abordagem, ou exporte tudo em Relatórios.',
    ],
    exemploResultado:
      'Uma distribuidora de TI no plano Growth ativa a faixa Essencial (50 Alvos/mês). Na primeira semana recebe 18 Alvos prontos, sendo 5 com nota acima de 80. O vendedor aborda os 5 usando o gancho do dossiê e agenda 2 reuniões que viram propostas no CRM.',
  },
  {
    featureKey: 'mira.quota',
    titulo: 'Alvos do mês (cota)',
    clientSafe: true,
    oQueE:
      'A cota é a quantidade de Alvos verificados que a sua faixa do Mira Prospects entrega por mês (Essencial 50, Pro 200, Scale 600). Só conta na cota o Alvo que passou no controle de qualidade: com dados verificados e dossiê completo. Tentativa e rascunho não descontam nada.',
    paraQueServe:
      'Serve para você pagar por resultado entregue, não por promessa. A barra mostra quanto já foi usado no mês. Quando a cota termina, a geração de novos Alvos pausa até a virada do mês, ou você contrata um pacote avulso que libera mais Alvos na hora.',
    comoImplementar: [
      'Acompanhe a barra de cota na Visão geral do Mira Prospects.',
      'Se a cota esgotar, vá em Plano e Fatura e contrate um pacote avulso (50, 200 ou 600 Alvos).',
      'Se precisar de mais volume todo mês, suba de faixa: sai mais barato que comprar pacote repetido.',
      'Na virada do mês a cota volta ao valor da sua faixa automaticamente.',
    ],
    exemploResultado:
      'Uma imobiliária na faixa Essencial usa os 50 Alvos até o dia 20. Compra um pacote avulso de 50 (R$ 356) para não parar a prospecção e, no mês seguinte, faz upgrade para a faixa Pro (R$ 597 por 200 Alvos), que custa menos por Alvo.',
  },
  {
    featureKey: 'mira.perfil',
    titulo: 'Perfil de Prospecção',
    clientSafe: true,
    oQueE:
      'O Perfil de Prospecção é o mapa que orienta os agentes do Mira: o que você vende (catálogo), quem compra (perfil de cliente ideal), onde ficam, quem decide a compra e contra quem você compete. É o primeiro passo do produto. Se você já treinou a IA da ZappIQ, parte dessas informações é reaproveitada.',
    paraQueServe:
      'Serve para os agentes procurarem exatamente o que interessa. Quanto mais completo o perfil, mais certeiros ficam os Alvos: o cruzamento entre a dor da conta e o seu catálogo é o que gera as oportunidades número 1 e número 2 de cada dossiê.',
    comoImplementar: [
      'Escolha se você vende para empresas (B2B) ou para consumidores (B2C).',
      'Preencha o segmento e cadastre seus principais produtos e serviços.',
      'Descreva o cliente ideal: atividade (CNAE), porte e região no B2B; perfil e região no B2C.',
      'Liste os cargos que decidem a compra e os seus diferenciais. Salve e acompanhe a prontidão.',
    ],
    exemploResultado:
      'Uma empresa de segurança de TI define CNAEs de indústria, porte médio, região Sudeste e decisores CEO, Diretor de TI e CISO. Com o perfil 85% pronto, os Alvos chegam com o comitê certo mapeado e a oportunidade apontando para o produto de SOC.',
  },
  {
    featureKey: 'mira.campanhas',
    titulo: 'Campanhas de prospecção',
    clientSafe: true,
    oQueE:
      'Cada disparo dos agentes de mapeamento é uma campanha de prospecção: um pedido nomeado ("clínicas em Campinas", "minha carteira de dezembro") que fica registrado com os parâmetros, o resultado e os Alvos que criou. É diferente das campanhas do Zap Impulso, que disparam mensagens: aqui os agentes saem procurando mercado.',
    paraQueServe:
      'Serve para você disparar e GERIR a prospecção, em vez de apertar um botão e perder o rastro. Cada campanha mostra quantos Alvos encontrou e quantos ficaram prontos, e um clique abre só os Alvos daquela campanha. Assim você compara buscas, repete o que funcionou e entende para onde foi a cota.',
    comoImplementar: [
      'Complete o Perfil de Prospecção (mínimo 60%): é dele que os agentes partem.',
      'Clique em Nova campanha e escolha o tipo: descobrir novos clientes ou mapear a carteira que você já tem.',
      'Descreva o que procurar. Sem região digitada, vale a região do seu Perfil.',
      'Dê um nome se quiser; sem nome, batizamos pela busca e pela data.',
    ],
    exemploResultado:
      'A campanha "Clínicas de Campinas (15/jul)" encontrou 18 negócios, qualificou 7 como prontos e aparece na lista do hub. Uma semana depois, você repete a mesma busca em outra cidade e compara os resultados lado a lado.',
  },
  {
    featureKey: 'mira.perfil.modo',
    titulo: 'B2B ou B2C',
    clientSafe: true,
    oQueE:
      'A escolha muda onde a Mira procura. No B2B, a base é o CNPJ da Receita e o quadro societário: o Alvo é uma empresa registrada. No B2C, a fonte é a presença no Google: o Alvo é um negócio local, com endereço, telefone e avaliações. Nos dois casos o Alvo é um negócio; a Mira não prospecta pessoa física, porque não existe fonte pública legítima para isso.',
    paraQueServe:
      'Serve para o motor certo trabalhar para você. Os dois usam a mesma inteligência de qualificação e procuram em lugares diferentes. Se você vende direto ao consumidor final, escolha B2C para mapear os negócios locais que te interessam (parceria, revenda, conta corporativa) e use o perfil do consumidor para afiar a abordagem; para falar com a sua base de consumidores, quem trabalha é o Zap Impulso.',
    comoImplementar: [
      'Selecione o modo que representa a maior parte das suas vendas.',
      'Se você atende os dois públicos, comece pelo que quer prospectar primeiro; dá para mudar depois.',
    ],
    exemploResultado:
      'Uma clínica escolhe B2C e recebe Alvos de bairros próximos com perfil compatível. Uma software house escolhe B2B e recebe empresas por CNAE e porte, com sócios e decisores nominais.',
  },
  {
    featureKey: 'mira.perfil.segmento',
    titulo: 'Segmento do seu negócio',
    clientSafe: true,
    oQueE:
      'O segmento é a descrição curta do seu ramo (por exemplo, contabilidade, infraestrutura de TI, estética). Os subsegmentos afinam a busca (por exemplo, cloud e NOC dentro de TI).',
    paraQueServe:
      'Serve de bússola para os agentes entenderem o seu mundo e reconhecerem sinais relevantes nas contas-alvo (uma notícia sobre migração de sistema importa para quem vende TI, não para quem vende uniforme).',
    comoImplementar: [
      'Escreva o segmento principal em uma frase simples.',
      'Adicione subsegmentos se o seu foco tiver nichos (opcional, ajuda na precisão).',
    ],
    exemploResultado:
      'Segmento "infraestrutura e segurança de TI" com subsegmentos "cloud" e "SOC" faz o agente de demandas priorizar notícias de migração para nuvem e vagas de segurança nas contas mapeadas.',
  },
  {
    featureKey: 'mira.perfil.catalogo',
    titulo: 'Catálogo de produtos e serviços',
    clientSafe: true,
    oQueE:
      'A lista do que você vende, com uma descrição curta do que cada item resolve. É contra este catálogo que o Mira cruza as demandas de cada conta.',
    paraQueServe:
      'Serve para transformar demanda em oportunidade concreta. Quando o agente descobre que uma conta está migrando para a nuvem, ele olha o seu catálogo e aponta qual produto seu resolve aquilo, com o racional pronto para o vendedor usar.',
    comoImplementar: [
      'Cadastre de 3 a 10 itens principais (dá para editar sempre).',
      'Na descrição, diga o problema que o item resolve, não só o nome técnico.',
    ],
    exemploResultado:
      'Catálogo com "Migração cloud gerenciada: leva ERP e arquivos para a nuvem sem parar a operação" permite ao dossiê apontar: demanda número 1 (migração anunciada) resolvida pela sua oferta número 1, com racional pronto.',
  },
  {
    featureKey: 'mira.perfil.icp',
    titulo: 'Perfil do cliente ideal (ICP)',
    clientSafe: true,
    oQueE:
      'O ICP é o retrato de quem compra bem de você. No B2B: atividade (CNAE), porte e região. No B2C: descrição do público e regiões. É o filtro que separa alvo bom de curioso.',
    paraQueServe:
      'Serve para a descoberta não desperdiçar a sua cota com contas fora do perfil. O fit com o ICP é um dos maiores pesos do Mira Score.',
    comoImplementar: [
      'No B2B, informe pelo menos dois entre: CNAE/atividade, porte e região.',
      'No B2C, descreva o público em uma frase e liste as regiões de atuação.',
      'Refine com o tempo: o perfil é vivo e os agentes re-miram quando ele muda.',
    ],
    exemploResultado:
      'Com ICP "distribuidoras (CNAE 46), porte ME/EPP, interior de SP", a fila passa a mostrar só distribuidoras da região, e a nota de fit explica o porquê de cada uma.',
  },
  {
    featureKey: 'mira.perfil.areas',
    titulo: 'Quem decide a compra',
    clientSafe: true,
    oQueE:
      'Os papéis que participam da decisão de compra do que você vende (por exemplo: CEO, Diretor de TI, CISO, Compras). O Mira usa esses papéis para montar o comitê de compra de cada Alvo.',
    paraQueServe:
      'Serve para o dossiê chegar com as pessoas certas, não com um contato genérico. Vender para empresa é falar com quem aprova o orçamento, quem decide tecnicamente e quem pode vetar.',
    comoImplementar: [
      'Liste de 2 a 5 cargos que costumam participar da compra do seu produto.',
      'Pense em quem assina, quem usa e quem pode barrar (jurídico, segurança, compras).',
    ],
    exemploResultado:
      'Definindo CEO, Diretor de TI e CISO, o Alvo chega com os três mapeados por nome: o sócio-diretor (do registro público do CNPJ), o gestor de TI e o responsável de segurança, cada um com seu papel.',
  },
  {
    featureKey: 'mira.perfil.diferenciais',
    titulo: 'Diferenciais e concorrentes',
    clientSafe: true,
    oQueE:
      'Seus pontos fortes (o que faz o cliente escolher você) e os concorrentes que costuma enfrentar. Alimentam o roteiro de abordagem e a leitura de fornecedores atuais das contas.',
    paraQueServe:
      'Serve para a abordagem nascer afiada: o roteiro destaca o diferencial certo contra o fornecedor que já atende a conta, quando ele é identificado.',
    comoImplementar: [
      'Liste 2 a 5 diferenciais concretos (SLA, prazo, preço fixo, atendimento 24/7).',
      'Liste os concorrentes mais comuns nas suas disputas.',
    ],
    exemploResultado:
      'Sabendo que a conta usa um concorrente com suporte lento e que seu diferencial é SLA de 4 horas, o roteiro sugere abrir a conversa por continuidade de operação, não por preço.',
  },
  {
    featureKey: 'mira.perfil.dores',
    titulo: 'O que você resolve',
    clientSafe: true,
    oQueE:
      'As dores que o seu produto resolve, os resultados que ele entrega e as situações que levam alguém a procurar você. É a ponte entre o seu catálogo e a realidade de cada conta: o catálogo diz o que você vende, este bloco diz por que alguém compraria.',
    paraQueServe:
      'Serve para a Mira reconhecer uma oportunidade quando ela aparece. Sem isso, os agentes até acham empresas do perfil certo, mas não sabem ligar um sinal ("a empresa abriu duas filiais") a uma dor sua ("operação cresce e a infra não acompanha"). É essa ligação que vira a oportunidade nº 1 do dossiê.',
    comoImplementar: [
      'Liste as dores com as palavras do cliente, não com as suas. Ele fala "o sistema cai", não "baixa disponibilidade".',
      'Nos resultados, prefira número: "reduz custo de infra em 30%" trabalha melhor que "reduz custo".',
      'Nos casos de uso, pense no gatilho: o que aconteceu na empresa na semana em que ela procurou você?',
    ],
    exemploResultado:
      'Você declara a dor "downtime derruba a operação" e o caso de uso "migração para nuvem". Ao encontrar uma conta que acabou de contratar um time de infra, a Mira cruza os dois e o dossiê chega dizendo por que aquela conta faz sentido agora.',
  },
  {
    featureKey: 'mira.perfil.sinais',
    titulo: 'Maturidade e timing',
    clientSafe: true,
    oQueE:
      'As tecnologias que a empresa-alvo já usa e os sinais de que ela está no momento de comprar (contratando na área, abrindo filial, trocando de sistema). Junto vai o seu ciclo de venda típico.',
    paraQueServe:
      'Serve para ordenar a fila. Duas empresas podem ter o mesmo perfil e uma delas estar pronta para comprar hoje enquanto a outra só daqui a um ano. Sinal de intenção é o que separa as duas, e é onde o seu time deve gastar a energia primeiro.',
    comoImplementar: [
      'Em tecnologias, liste o que indica que a empresa tem maturidade para o seu produto (usa CRM, tem e-commerce, tem ERP).',
      'Em sinais, pense no que você observa antes de uma boa venda acontecer.',
      'O ciclo de venda calibra a urgência: ciclo curto pede abordagem rápida, ciclo longo pede relacionamento.',
    ],
    exemploResultado:
      'Você marca "contratando na área de TI" como sinal. Uma conta com três vagas abertas de infraestrutura sobe na fila e o dossiê abre justamente por aí.',
  },
  {
    featureKey: 'mira.perfil.corte',
    titulo: 'Critérios de corte',
    clientSafe: true,
    oQueE:
      'O avesso do perfil ideal: o que faz você descartar uma conta (red flags) e o que ela precisa obrigatoriamente ter para valer a pena (must-haves). Em B2B entram também os seus clientes-referência atuais.',
    paraQueServe:
      'Serve para a fila não encher de oportunidade ruim. Dizer quem você não quer é tão informativo quanto dizer quem você quer, e costuma ser mais fácil de responder. Os clientes-referência viram base de semelhança: a Mira procura contas parecidas com quem já compra de você e dá certo.',
    comoImplementar: [
      'Nas red flags, pense nas últimas negociações que morreram. O que elas tinham em comum?',
      'Nos must-haves, liste só o que é eliminatório de verdade, não o que é desejável.',
      'Nos clientes-referência, cite os que você gostaria de clonar, não necessariamente os maiores.',
    ],
    exemploResultado:
      'Você marca "sem equipe de TI própria" como red flag. Contas que se encaixam nela deixam de consumir a sua cota de Alvos, e a fila fica só com quem tem chance real.',
  },
  {
    featureKey: 'mira.perfil.negocioAlvo',
    titulo: 'Que negócio local prospectar',
    clientSafe: true,
    oQueE:
      'Os tipos de negócio local que a Mira vai procurar no Google para você: clínicas, academias, pizzarias, oficinas. É o par do campo de CNAEs do B2B: no B2B a Mira procura empresa na base da Receita pelo código de atividade; no B2C ela procura estabelecimento no Google pelo tipo.',
    paraQueServe:
      'Serve porque a descoberta precisa saber o que procurar. Uma coisa é o negócio que você quer alcançar, outra é o consumidor que compra dele; os dois moram neste perfil, mas fazem trabalhos diferentes. Este campo comanda a busca. O bloco do consumidor, logo abaixo, comanda a qualificação e a abordagem.',
    comoImplementar: [
      'Liste os tipos de negócio com o nome que aparece na placa, não o nome técnico: "academia" acha mais que "atividade física e recreativa".',
      'Um tipo por vez. Cada um vira uma busca separada dentro da campanha.',
      'Se você vende direto ao consumidor final e não para negócios, a descoberta não é o seu caminho: use o Zap Impulso para trabalhar a base que você já tem.',
    ],
    exemploResultado:
      'Você declara "clínicas de estética" e "academias" em Moema. A campanha traz os estabelecimentos reais dos dois tipos na região, cada um com telefone, avaliações e nota, e a qualificação usa o perfil do consumidor que você descreveu para montar a conversa.',
  },
  {
    featureKey: 'mira.perfil.regiaoB2c',
    titulo: 'Onde o consumidor está',
    clientSafe: true,
    oQueE:
      'A região que você atende, o tipo de região (capital, interior, litoral, raio de quilômetros) e os canais onde o seu público circula.',
    paraQueServe:
      'Serve para negócio local não desperdiçar cota. Uma pizzaria em Moema não ganha nada recebendo consumidor de Campinas. O raio de atendimento é o filtro mais importante do B2C, e o canal orienta por onde a abordagem faz sentido.',
    comoImplementar: [
      'Comece pela região onde você realmente entrega ou atende hoje, não pela que gostaria.',
      'Se o seu negócio é físico, use o raio: "raio 20km" costuma ser mais honesto que o nome do bairro.',
      'Nos canais, marque só onde você tem presença de verdade.',
    ],
    exemploResultado:
      'Você define "Moema" e "raio 8km". A descoberta passa a devolver só negócios e consumidores dentro da sua área de entrega, e a cota rende.',
  },
  {
    featureKey: 'mira.perfil.gatilhosB2c',
    titulo: 'O que move a compra no B2C',
    clientSafe: true,
    oQueE:
      'As dores e desejos do consumidor, o momento de vida que dispara a compra, os interesses e os hábitos de consumo dele.',
    paraQueServe:
      'Serve porque no B2C o momento costuma valer mais que o perfil. Duas pessoas com a mesma idade, renda e bairro se comportam de forma completamente diferente se uma delas acabou de ter um filho. Demografia diz quem é, momento de vida diz quando falar.',
    comoImplementar: [
      'Nos gatilhos, pense no que mudou na vida da pessoa pouco antes de ela comprar de você.',
      'Nas dores e desejos, seja concreto: "economizar tempo" e "status" movem compras diferentes.',
      'Nos hábitos, registre o que muda a abordagem: quem parcela responde a oferta diferente de quem paga à vista.',
    ],
    exemploResultado:
      'Uma loja de móveis marca "mudou de casa" como gatilho. A fila passa a priorizar quem está nesse momento, e a conversa começa pelo problema real da pessoa, não por catálogo.',
  },
  {
    featureKey: 'mira.motorA',
    titulo: 'Mapear carteira',
    clientSafe: true,
    oQueE:
      'O mapeamento da carteira transforma os clientes e contatos que você já tem em Alvos qualificados. Você cola os CNPJs (ou importa do CRM) e a Mira enriquece cada conta na fonte oficial da Receita Federal: razão social, atividade, porte, situação e o quadro societário, que vira o mapa de decisores.',
    paraQueServe:
      'Serve para vender mais para quem você já conhece. Cliente atual tem muito mais chance de comprar de novo do que um desconhecido, e a carteira costuma estar desorganizada em planilhas. A Mira organiza, enriquece e prioriza tudo pelo Mira Score.',
    comoImplementar: [
      'Clique em Mapear carteira na tela de Alvos.',
      'Cole os CNPJs (um por linha, até 50 por vez) ou clique em Importar CNPJs do meu CRM.',
      'Clique em Mapear agora e aguarde: a Mira busca cada conta na fonte oficial.',
      'Contas inativas na Receita e duplicadas são puladas e não gastam a sua cota.',
    ],
    exemploResultado:
      'Um distribuidor cola 30 CNPJs de clientes antigos. Em um minuto, 24 viram Alvos verificados com sócios mapeados; 4 estavam inativos (não gastaram cota) e 2 eram duplicados. A fila aparece ordenada por score e ele redescobre 6 contas quentes esquecidas.',
  },
  {
    featureKey: 'mira.motorB',
    titulo: 'Descobrir novos',
    clientSafe: true,
    oQueE:
      'A descoberta de novos é o motor que busca negócios que ainda não estão na sua carteira. Você descreve o que procurar e onde, e a Mira tem duas trilhas: para Empresas (B2B), ela consulta a base de CNPJ da Receita (via BigQuery da Base dos Dados, ou índice local) filtrando por CNAE e UF do seu Perfil, e cai para o índice público de busca só se precisar; para Negócio local (B2C), usa a presença no Google Places. Em todos os casos, cada candidato é sempre verificado de novo na Receita antes de virar Alvo.',
    paraQueServe:
      'Serve para encher o topo do funil com o perfil certo, sem comprar lista fria. No B2B, só desconta cota o Alvo verificado (ativo na Receita e com decisor no quadro societário); empresas achadas sem CNPJ resolvido ficam como candidatos, para qualificar depois, e não gastam cota. No B2C, só entra negócio com contato verificável.',
    comoImplementar: [
      'Clique em Descobrir novos na tela de Alvos.',
      'Escolha a trilha: Empresas (B2B) ou Negócio local (B2C).',
      'Descreva o que procurar e, se quiser, a cidade ou região.',
      'Clique em Descobrir agora: os Alvos verificados e os candidatos aparecem na fila, priorizados pelo Mira Score.',
    ],
    exemploResultado:
      'Uma empresa de uniformes busca "restaurantes em Sorocaba". A Mira acha 20, resolve e verifica 12 CNPJs na Receita (viram Alvos prontos, com sócios mapeados) e deixa 8 como candidatos para qualificar. O vendedor começa pelos de maior nota no mesmo dia.',
  },
  {
    featureKey: 'mira.aprofundar',
    titulo: 'Aprofundar com IA',
    clientSafe: true,
    oQueE:
      'O botão Aprofundar com IA faz duas coisas num clique. Primeiro, cruza os dados verificados da conta com o seu catálogo e escreve as oportunidades número 1 e 2, a dor provável e o roteiro de primeira mensagem para cada decisor. Depois, sai e pesquisa a pegada pública da conta na internet: o que ela publicou, o que saiu de novo sobre ela e quem já a atende hoje.',
    paraQueServe:
      'Serve para transformar dado em conversa, com contexto de verdade. A primeira parte te dá a pauta (qual produto, por quê, como abrir o papo). A segunda enche os blocos que ficavam vazios: Demandas recentes, Fornecedores atuais e Releases desta conta. E como a pesquisa traz evidência nova, a nota do Alvo é recalculada na hora: um Alvo com janela de entrada e fornecedor mapeado sobe de posição na fila.',
    comoImplementar: [
      'Abra o dossiê do Alvo e clique em Aprofundar com IA. As duas fases rodam juntas, em poucos segundos.',
      'Confira os blocos que a pesquisa encher: Demandas com evidência trazem o link da fonte; Fornecedores atuais dizem quem atende a conta hoje e o quanto é deslocável.',
      'Olhe a nota antes e depois: o fator Janela e incumbente só pontua com o que a pesquisa achou.',
      'Revise o roteiro antes de usar. O que é presunção vem marcado como presunção; o que tem fonte vem com o link.',
    ],
    exemploResultado:
      'Num Alvo de indústria, a análise aponta o backup gerenciado como oportunidade 1 e escreve o roteiro para o sócio-administrador. A pesquisa acha um post da conta anunciando expansão da fábrica e uma notícia citando o ERP que ela usa. A nota sai de 33 para 52, o vendedor abre o papo pela expansão e já sabe contra quem está competindo.',
  },
  {
    featureKey: 'mira.alvos',
    titulo: 'Alvos (fila de prospecção)',
    clientSafe: true,
    oQueE:
      'A fila de oportunidades que os agentes mapearam e qualificaram, ordenada pelo Mira Score (a nota de prioridade). Cada linha é uma conta com dossiê; clique para abrir.',
    paraQueServe:
      'Serve para o seu time atacar primeiro o que tem mais chance de fechar. Em vez de uma planilha com 500 nomes iguais, uma fila com nota, motivo e contexto.',
    comoImplementar: [
      'Use os filtros para ver os Prontos (passaram na qualificação) ou os Em qualificação.',
      'Abra o Alvo para ver o dossiê completo e o roteiro de abordagem.',
      'Busque por nome ou CNPJ quando quiser achar uma conta específica.',
    ],
    exemploResultado:
      'Segunda de manhã, o gestor filtra Prontos, ordena pelo score e distribui os 10 primeiros para o time. Cada vendedor já sabe com quem falar e sobre o quê antes do primeiro contato.',
  },
  {
    featureKey: 'mira.alvos.classificacoes',
    titulo: 'Prontos, Em qualificação e Entregues',
    clientSafe: true,
    relacionados: ['mira.quota', 'mira.alvos', 'mira.aprofundar'],
    oQueE:
      'São as fases da vida de um Alvo dentro da Mira. Em qualificação é a conta que foi encontrada mas ainda não passou no controle de qualidade. Pronto é a conta verificada, com dossiê completo, liberada para o seu time trabalhar. Entregue é a que já saiu daqui: pousou no seu CRM ou entrou num relatório. Existe ainda o Arquivado, para o que você descartou.',
    paraQueServe:
      'Serve para você confiar na fila. A separação existe para que ninguém do seu time gaste tempo (ou queime a imagem da sua empresa) abordando uma conta com dado pela metade. E para o seu bolso: só o Alvo Pronto desconta da sua cota. Conta encontrada que não passou na verificação não custa nada.',
    comoImplementar: [
      'Em qualificação: a conta foi achada, mas falta o que o gate exige. No B2B, o gate pede empresa ATIVA na Receita e ao menos um decisor no quadro societário. No B2C, pede contato verificável (telefone ou site). Exemplo típico: firma individual sem sócios, ou negócio sem telefone público.',
      'Pronto: passou no gate. Tem razão social conferida na fonte oficial, decisor nominal, Mira Score e dossiê. É o que você distribui para o time. Exemplo: uma metalúrgica ativa em SP, com dois sócios-administradores mapeados e nota 52.',
      'Entregue: você já agiu sobre ela. Pousou no CRM (virou contato e negócio) ou saiu num relatório. Sai da fila de trabalho e vira histórico, mas continua sendo monitorada pelos Releases.',
      'Arquivado: você descartou (fora do ICP, duplicado, não quero). Some da fila sem apagar o histórico.',
    ],
    exemploResultado:
      'Uma campanha de metalúrgicas em SP verifica 10 empresas e cria 10 Alvos: 6 ficam Prontos (têm sócios no quadro societário) e 4 ficam Em qualificação (são firmas individuais, sem sócio para abordar). A cota desconta 6, não 10. O gestor distribui os 6 Prontos; 2 viram negócio no CRM e passam a Entregues.',
    mockup: `<svg viewBox="0 0 660 196" role="img" width="100%" style="max-width:660px;margin:0 auto;display:block" xmlns="http://www.w3.org/2000/svg">
      <style>
        .t{font:600 12px system-ui,sans-serif}
        .s{font:10.5px system-ui,sans-serif;fill:#6B7280}
        .c{font:600 9px system-ui,sans-serif;letter-spacing:.05em}
      </style>
      <rect x="8" y="30" width="150" height="76" rx="10" fill="#FFFBEB" stroke="#F59E0B" stroke-width="1.5"/>
      <text class="c" x="22" y="50" fill="#B45309">EM QUALIFICAÇÃO</text>
      <text class="t" x="22" y="70" fill="#111827">Achada, não conferida</text>
      <text class="s" x="22" y="87">Falta decisor ou contato.</text>
      <text class="s" x="22" y="100">Não gasta cota.</text>

      <path d="M166 68 l22 0 m-7 -6 l7 6 l-7 6" fill="none" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <text class="s" x="170" y="58" style="font-size:9px">passou no gate</text>

      <rect x="196" y="30" width="150" height="76" rx="10" fill="#F0FBF6" stroke="#2FB57A" stroke-width="1.5"/>
      <text class="c" x="210" y="50" fill="#0F7A50">PRONTO</text>
      <text class="t" x="210" y="70" fill="#111827">Verificada, com dossiê</text>
      <text class="s" x="210" y="87">Decisor + nota + fontes.</text>
      <text class="s" x="210" y="100">Desconta 1 da cota.</text>

      <path d="M354 68 l22 0 m-7 -6 l7 6 l-7 6" fill="none" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <text class="s" x="356" y="58" style="font-size:9px">você agiu</text>

      <rect x="384" y="30" width="150" height="76" rx="10" fill="#F5F6FF" stroke="#4A52D0" stroke-width="1.5"/>
      <text class="c" x="398" y="50" fill="#3730A3">ENTREGUE</text>
      <text class="t" x="398" y="70" fill="#111827">Pousou no CRM</text>
      <text class="s" x="398" y="87">Virou contato e negócio.</text>
      <text class="s" x="398" y="100">Segue monitorada.</text>

      <rect x="552" y="30" width="100" height="76" rx="10" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1.5" stroke-dasharray="4 3"/>
      <text class="c" x="566" y="50" fill="#6B7280">ARQUIVADO</text>
      <text class="t" x="566" y="70" fill="#6B7280">Descartada</text>
      <text class="s" x="566" y="87">Fora do ICP</text>
      <text class="s" x="566" y="100">ou duplicada.</text>

      <rect x="8" y="126" width="644" height="54" rx="8" fill="#F0FBF6" stroke="#2FB57A" stroke-width="1.2" stroke-dasharray="4 3"/>
      <text class="t" x="26" y="145" fill="#0F7A50">Só o Pronto desconta da cota</text>
      <text class="s" x="26" y="161">Conta encontrada que não passa na verificação fica em qualificação e não custa nada.</text>
      <text class="s" x="26" y="174">Você paga por dossiê entregue, não por tentativa.</text>
    </svg>`,
  },
  {
    featureKey: 'mira.dossie',
    titulo: 'Dossiê do Alvo',
    clientSafe: true,
    oQueE:
      'O raio-X da oportunidade: nota explicada, comitê de compra, demandas recentes, oportunidades do seu portfólio, fornecedores atuais, janela de entrada e as fontes de onde cada informação veio.',
    paraQueServe:
      'Serve para abordar como quem fez o dever de casa. O vendedor chega sabendo a dor, a pessoa certa e o gancho do momento, o que muda completamente a taxa de resposta.',
    comoImplementar: [
      'Leia o resumo e o "por que essa nota" para entender a prioridade.',
      'Veja o comitê de compra e escolha por quem começar (o provável campeão está marcado).',
      'Use as oportunidades número 1 e 2 como pauta da primeira conversa.',
    ],
    exemploResultado:
      'O dossiê mostra: demanda número 1 é migração para a nuvem (notícia de expansão), decisor é o Diretor de TI, fornecedor atual tem contrato vencendo em 4 meses. O vendedor aborda com a pauta certa e agenda a reunião na primeira tentativa.',
  },
  {
    featureKey: 'mira.dossie.comite',
    titulo: 'Comitê de compra',
    clientSafe: true,
    oQueE:
      'As pessoas que participam da decisão na conta-alvo, com nome e papel: quem aprova o orçamento, quem decide tecnicamente, quem usa e quem pode vetar. O selo QSA indica que a pessoa vem do registro público do CNPJ (sócio ou administrador), a fonte mais confiável.',
    paraQueServe:
      'Serve para não vender para a pessoa errada. Comprar é decisão de grupo; o comitê mostra o mapa do grupo e marca o provável campeão (quem tem a ganhar com a mudança). O botão Mapear decisores busca cargos atuais (Diretor, Head, Gerente) na pegada pública: o que os buscadores já indexaram e páginas públicas de liderança. O selo web marca quem veio dessa pegada; o selo QSA, do registro do CNPJ. A Mira nunca usa login de rede social, então a conta da empresa fica protegida.',
    comoImplementar: [
      'Comece pelo campeão marcado com a coroa, ou pelo papel mais próximo da dor.',
      'Clique em Mapear decisores no dossiê para trazer cargos atuais da pegada pública.',
      'Confira a porcentagem de confiança de cada pessoa antes de abordar: nome sem fonte é descartado pelo verificador.',
    ],
    exemploResultado:
      'Em vez de mandar mensagem para o e-mail geral, o vendedor mapeia os decisores, encontra a Diretora de TI atual (selo web, 2 fontes) e fala com ela sobre o gargalo de operação, com ponte do sócio-administrador (selo QSA). Duas conversas, uma reunião marcada.',
  },
  {
    featureKey: 'mira.decisores',
    titulo: 'Mapear decisores',
    clientSafe: true,
    oQueE:
      'O botão Mapear decisores busca quem manda em cada área da conta-alvo agora: Diretor, Head, Gerente, C-level. A Mira procura no LinkedIn e em páginas públicas de liderança pelo índice de busca (sem usar login de rede social) e traz nome e cargo atual de cada responsável, priorizando as áreas compradoras que você definiu no Perfil.',
    paraQueServe:
      'Serve para falar com a pessoa certa de primeira. O quadro societário (QSA) mostra os donos; este botão completa o mapa com quem opera as áreas no dia a dia, que muitas vezes é quem sente a dor e patrocina a compra.',
    comoImplementar: [
      'Abra o dossiê do Alvo e clique em Mapear decisores.',
      'Os encontrados entram no Comitê de compra com o selo da fonte (LinkedIn ou web) e a porcentagem de confiança.',
      'Nome sem fonte verificável é descartado automaticamente: a Mira não inventa gente.',
      'Sem e-mail e telefone nesta etapa: contato direto vem do seu CRM ou do relacionamento (a Mira não coleta contato pessoal sem base legal).',
    ],
    exemploResultado:
      'Num Alvo industrial, o QSA trazia só os dois sócios. O Mapear decisores encontrou o Diretor de TI e a Gerente de Infraestrutura atuais, com selo LinkedIn. O roteiro de abordagem passou a falar com quem realmente decide a compra técnica.',
  },
  {
    featureKey: 'mira.dossie.demandas',
    titulo: 'Demandas recentes',
    clientSafe: true,
    oQueE:
      'As duas necessidades mais quentes da conta agora, descobertas em fontes públicas (notícias, comunicados, vagas abertas, editais), cada uma com a evidência de onde veio.',
    paraQueServe:
      'Serve para falar do problema do cliente, não do seu produto. Abordagem que abre com a dor real da conta responde muito mais.',
    comoImplementar: [
      'Use a demanda número 1 como assunto da primeira mensagem.',
      'Clique na evidência para ver a fonte antes de citar o fato.',
    ],
    exemploResultado:
      'A conta abriu 3 vagas de analista de segurança (evidência: portal de vagas). O vendedor abre com "vi que o time de segurança está crescendo" e oferece o diagnóstico de SOC. Resposta no mesmo dia.',
  },
  {
    featureKey: 'mira.dossie.oportunidades',
    titulo: 'Oportunidades no seu portfólio',
    clientSafe: true,
    oQueE:
      'O cruzamento entre as demandas da conta e o seu catálogo: qual produto seu resolve a demanda número 1 e qual resolve a número 2, com o racional do encaixe.',
    paraQueServe:
      'Serve para transformar contexto em proposta. É a ponte pronta entre a dor deles e a sua oferta.',
    comoImplementar: [
      'Valide o racional sugerido e ajuste ao seu jeito de vender.',
      'Leve a oportunidade número 1 como pauta e guarde a número 2 para a segunda conversa.',
    ],
    exemploResultado:
      'Demanda: adequação à LGPD após incidente no setor. Oportunidade número 1: seu serviço de conformidade. O vendedor monta a proposta em cima do racional do dossiê e encurta o ciclo em semanas.',
  },
  {
    featureKey: 'mira.dossie.incumbentes',
    titulo: 'Fornecedores atuais',
    clientSafe: true,
    oQueE:
      'Quem já atende a conta na sua categoria, quando identificável por sinais públicos, com uma leitura de quão deslocável o fornecedor está (alta, média ou baixa).',
    paraQueServe:
      'Serve para calibrar a estratégia: conta sem fornecedor é venda de projeto; conta com fornecedor frágil é venda de troca, e o argumento muda.',
    comoImplementar: [
      'Verifique a evidência do incumbente antes de citar concorrente na conversa.',
      'Use seus diferenciais (do Perfil) contra a fraqueza apontada.',
    ],
    exemploResultado:
      'O dossiê aponta contrato de datacenter local vencendo em 4 meses (deslocabilidade alta). O vendedor cronometra a abordagem para a janela de renovação e entra na concorrência na hora certa.',
  },
  {
    featureKey: 'mira.dossie.janela',
    titulo: 'Janela de entrada',
    clientSafe: true,
    oQueE:
      'O momento e o gatilho recomendados para abordar a conta: renovação de contrato chegando, liderança nova no cargo, expansão anunciada, edital aberto.',
    paraQueServe:
      'Serve para chegar na hora em que a conta está aberta a conversar. O mesmo pitch, na janela certa, rende muito mais.',
    comoImplementar: [
      'Priorize Alvos com janela aberta agora.',
      'Se a janela for futura, crie uma tarefa de follow-up para a data.',
    ],
    exemploResultado:
      'CISO novo assumiu há 60 dias (gestor novo costuma revisar fornecedores nos primeiros meses). O vendedor aborda nessa janela e consegue a reunião que o antecessor nunca deu.',
  },
  {
    featureKey: 'mira.dossie.fontes',
    titulo: 'Fontes verificadas',
    clientSafe: true,
    oQueE:
      'A lista de onde cada informação do dossiê veio, com endereço e data. Registro oficial (CNPJ, quadro societário, editais) nasce verificado; os demais fatos pedem mais de uma fonte para subir a confiança.',
    paraQueServe:
      'Serve para você confiar no que está lendo e conferir antes de citar um fato na conversa. Transparência total: dado sem fonte não entra no dossiê.',
    comoImplementar: [
      'Clique na fonte para abrir o original.',
      'Prefira citar fatos com confiança alta na abordagem.',
    ],
    exemploResultado:
      'Antes da reunião, o vendedor abre as fontes das duas demandas e chega citando a notícia certa, com a data certa. Credibilidade na primeira impressão.',
  },
  {
    featureKey: 'mira.releases',
    titulo: 'Releases dos Alvos',
    clientSafe: true,
    oQueE:
      'A vigilância semanal das suas contas mapeadas. Toda semana os agentes varrem os Alvos em duas camadas: o registro oficial (Receita: mudança de sócio, situação, porte) e a pegada pública da conta (posts de LinkedIn quando indexados publicamente e notícias), trazendo só o que é relevante para as suas ofertas. Cada item explica por que importa, aponta a fonte e sugere o gancho de abordagem.',
    paraQueServe:
      'Serve para reabordar na hora certa sem monitorar nada manualmente. O Alvo que não respondeu no mês passado pode ter acabado de postar no LinkedIn a expansão que muda a conversa. Os itens da Receita têm confiança alta (registro oficial); os da pegada pública vêm marcados com confiança menor e o link da fonte.',
    comoImplementar: [
      'Abra Releases dos Alvos toda semana (os não lidos ficam destacados).',
      'Use o gancho sugerido para reabrir a conversa com contexto novo.',
      'Marque como lida para manter a caixa limpa.',
    ],
    exemploResultado:
      'Um Alvo parado há 3 semanas anuncia a compra de um concorrente. O release chega segunda com o gancho "expansão gera integração de sistemas". O vendedor reaborda e a conta finalmente responde.',
  },
  {
    featureKey: 'mira.relatorios',
    titulo: 'Relatórios',
    clientSafe: true,
    oQueE:
      'A exportação dos seus Alvos qualificados em CSV (abre no Excel e no Google Sheets), com score, confiança, firmografia e janela de entrada. O relatório executivo em PDF chega na sequência.',
    paraQueServe:
      'Serve para levar a inteligência para onde o seu processo estiver: reunião comercial, planilha do time ou outra ferramenta.',
    comoImplementar: [
      'Clique em Exportar CSV para baixar a fila completa.',
      'Use os filtros da tela de Alvos antes, se quiser exportar um recorte.',
    ],
    exemploResultado:
      'O gestor exporta o CSV na sexta, filtra os Alvos com score acima de 70 na planilha e distribui as metas de abordagem da semana seguinte na reunião de segunda.',
  },
  {
    featureKey: 'mira.analytics',
    titulo: 'Telemetria do Mira Prospects',
    clientSafe: true,
    oQueE:
      'O painel do Mira dentro do Analytics: em um lugar você vê o funil de Alvos (quantos descobertos, em qualificação, prontos e entregues), o Mira Score médio, a cota do mês, quantos decisores foram mapeados e quantos Alvos já viraram oportunidade no CRM.',
    paraQueServe:
      'Serve para você enxergar a saúde da prospecção sem abrir cada tela: se os Alvos estão avançando no funil, se a cota está sendo bem usada e se a inteligência está de fato virando conversa e venda.',
    comoImplementar: [
      'Abra Analytics e role até o bloco Mira Prospects (só aparece se o Mira estiver ativo).',
      'Troque o período (7, 30 ou 90 dias) para ver a evolução.',
      'Use o funil para achar gargalos: muitos "em qualificação" parados pode pedir mais aprofundamento.',
    ],
    exemploResultado:
      'O gestor vê que 40 Alvos ficaram prontos no mês, mas só 8 foram para o CRM. Ele cobra o time para trabalhar a fila e a conversão sobe na semana seguinte.',
  },
  {
    featureKey: 'mira.analytics.fontes',
    titulo: 'Qualidade das fontes',
    clientSafe: true,
    oQueE:
      'A tabela que mostra, por fonte de dados (Receita, pegada pública do LinkedIn/web, Google Places), quantas consultas foram feitas, a taxa de acerto (match) e a latência média. É a prova de que a inteligência vem de dado real e verificado.',
    paraQueServe:
      'Serve para transparência e confiança: você acompanha de onde vem cada informação e com que qualidade. Match baixo numa fonte sinaliza que aquele tipo de dado está mais escasso para o seu perfil.',
    comoImplementar: [
      'Leia a taxa de match: verde (alta) é dado abundante e confiável para o seu ICP.',
      'A latência ajuda a entender a velocidade de cada fonte.',
      'A Mira nunca inventa: o que não tem fonte, não entra.',
    ],
    exemploResultado:
      'A fonte da Receita mostra 95% de match; a pegada pública do LinkedIn, 60%. O gestor entende que os decisores por cargo dependem do que está indexado publicamente e calibra a expectativa.',
  },

  /* ── "Por que essa nota": os 5 fatores do Mira Score ────────────────
   * Um Saiba mais por fator, ao lado do nome dele no dossiê. Explicam o que
   * o fator É e o que faz ele subir; o "motivo" ao lado da barra explica o
   * que gerou a nota DAQUELE Alvo. Os pesos (25/25/20/15/15) são os do
   * score.ts: se mudarem lá, mudam aqui. */
  {
    featureKey: 'mira.score',
    titulo: 'Mira Score (a nota do Alvo)',
    clientSafe: true,
    relacionados: ['mira.score.fit', 'mira.score.demanda', 'mira.score.decisores', 'mira.score.portfolio', 'mira.score.janela'],
    oQueE:
      'Uma nota de 0 a 100 que diz por onde começar. Ela não mede se a empresa é boa: mede o quanto ESTA conta faz sentido para VOCÊ, agora. Sai da soma de cinco fatores com peso fixo: Fit de ICP (25), Demanda e sinais (25), Cobertura de decisores (20), Encaixe de portfólio (15) e Janela e incumbente (15).',
    paraQueServe:
      'Serve para o seu time não gastar o dia decidindo a quem ligar. E é explicável de propósito: cada fator mostra quanto valeu e por quê. Nota sem explicação vira superstição, e ninguém confia a própria comissão a uma caixa-preta.',
    comoImplementar: [
      'Abra o dossiê e olhe o bloco "Por que essa nota": cada barra é um fator, com o que ele valeu do total possível.',
      'Leia o motivo ao lado: ele diz o que aconteceu NESTE Alvo (ex.: "CNAE bate com o ICP" ou "nenhum decisor mapeado ainda").',
      'Nota baixa quase sempre é dado faltando, não conta ruim. Complete o Perfil de Prospecção e clique em Aprofundar com IA: os dois sobem a nota de verdade.',
      'Clique no "Saiba mais" de cada fator para entender o que o alimenta.',
    ],
    exemploResultado:
      'Um Alvo aparece com 33. O gestor abre e vê: Fit 7/25 (o CNAE não estava declarado no Perfil), Janela 0/15 ("entra quando você clicar em Aprofundar"). Ele completa o Perfil e aprofunda. A mesma conta vai a 61 e sobe 12 posições na fila.',
  },
  {
    featureKey: 'mira.score.fit',
    titulo: 'Fit de ICP (25 pontos)',
    clientSafe: true,
    relacionados: ['mira.score', 'mira.perfil.icp'],
    oQueE:
      'O quanto a conta parece com o cliente ideal que VOCÊ declarou no Perfil de Prospecção. Compara três coisas objetivas do registro oficial: a atividade (CNAE), a região e o porte.',
    paraQueServe:
      'Serve para separar "é uma empresa" de "é uma empresa que eu atendo". É o fator que mais depende de você: sem CNAE, região e porte declarados no Perfil, não existe com o que comparar, e a nota fica baixa por falta de referência, não por culpa da conta.',
    comoImplementar: [
      'Sobe quando: a atividade da conta bate com um CNAE ou atividade declarada no Perfil (o maior peso), a região está no seu alvo, e o porte é compatível.',
      'Pontua parcial quando a atividade é próxima mas não idêntica (ex.: você declarou "distribuidoras de TI" e a conta é de comércio atacadista de eletrônicos).',
      'Fica em zero quando: você não declarou CNAE nenhum no Perfil, ou a conta é de um ramo que você não pediu.',
      'Para melhorar: preencha CNAEs/atividades, regiões e portes no bloco "Quem é o seu cliente ideal" do Perfil.',
    ],
    exemploResultado:
      'Uma distribuidora de TI declara o CNAE 4651-6, região SP e porte médio. Uma conta de mesmo CNAE em Campinas com porte médio pontua alto no fit. Uma padaria em SP, com o mesmo porte e região, pontua só a região: 7 de 25.',
  },
  {
    featureKey: 'mira.score.demanda',
    titulo: 'Demanda e sinais (25 pontos)',
    clientSafe: true,
    relacionados: ['mira.score', 'mira.aprofundar', 'mira.perfil.sinais'],
    oQueE:
      'O quanto existe indício de que a conta precisa de algo AGORA. Junta o que o registro oficial mostra (empresa recente, situação ativa, capital social), o que o mercado dela mostra (o setor está contratando ou demitindo, pelos dados do CAGED) e, principalmente, o que a própria conta publicou.',
    paraQueServe:
      'Serve para achar o timing. Duas contas idênticas no papel não valem o mesmo se uma acabou de anunciar expansão. Este é o fator que mais muda depois do Aprofundar com IA: demanda que a conta publicou vale mais que qualquer inferência nossa sobre o registro dela.',
    comoImplementar: [
      'Sobe com: empresa recente (fase de montar operação), situação ATIVA, capital social relevante, setor contratando no CAGED.',
      'Sobe bastante com demanda evidenciada: a pesquisa da web achou a conta dizendo (ou a notícia mostrando) que ela precisa de algo. Vem com o link da fonte.',
      'O motivo é honesto sobre o estágio: antes de aprofundar ele diz "sinais profundos entram quando você clicar em Aprofundar com IA"; depois, ou traz a evidência ou diz "pesquisamos e não achamos demanda declarada".',
      'Para melhorar: clique em Aprofundar com IA, e declare seus Sinais de intenção no Perfil (eles ensinam a pesquisa a reconhecer o que é timing para o SEU negócio).',
    ],
    exemploResultado:
      'Uma metalúrgica ativa, com capital de R$ 500 mil, num setor contratando, marca 10 de 25. Depois do Aprofundar, a pesquisa acha um post dela anunciando nova planta: vira 18 de 25, com o link do post no dossiê.',
  },
  {
    featureKey: 'mira.score.decisores',
    titulo: 'Cobertura de decisores (20 pontos)',
    clientSafe: true,
    relacionados: ['mira.score', 'mira.decisores', 'mira.dossie.comite'],
    oQueE:
      'Quantas pessoas com poder de decisão a Mira conseguiu nomear nesta conta. No B2B, a base é o quadro societário da Receita (fonte oficial), somado a quem o Mapear decisores achar na pegada pública por cargo. No B2C, o decisor é o próprio dono no balcão, então o que conta é ter contato direto.',
    paraQueServe:
      'Serve porque conta sem nome não é oportunidade, é endereço. Você pode ter a empresa perfeita mapeada e não ter para quem ligar. Cada decisor a mais é uma porta a mais, e o roteiro de abordagem do dossiê é escrito por pessoa.',
    comoImplementar: [
      'Sobe a cada decisor nominal mapeado, até o teto do fator.',
      'Fica em zero quando a conta não tem sócio no quadro societário (típico de firma individual ou MEI) e nada foi achado na pegada pública. É também o motivo mais comum de um Alvo ficar Em qualificação em vez de Pronto.',
      'Para melhorar: clique em Mapear decisores no dossiê. Ele procura por cargo no índice público e ainda busca contato (LinkedIn, e-mail, telefone) de quem já estava mapeado só com nome.',
      'Declare no Perfil quem decide a compra no seu negócio (bloco do comitê): a busca procura esses cargos, não cargos genéricos.',
    ],
    exemploResultado:
      'Uma metalúrgica com dois sócios-administradores no quadro societário marca 14 de 20 sem esforço nenhum. O Mapear decisores acha o Gerente Industrial no LinkedIn e a conta chega ao teto do fator, com três portas de entrada.',
  },
  {
    featureKey: 'mira.score.portfolio',
    titulo: 'Encaixe de portfólio (15 pontos)',
    clientSafe: true,
    relacionados: ['mira.score', 'mira.perfil.catalogo', 'mira.dossie.oportunidades'],
    oQueE:
      'O quanto o que VOCÊ vende encaixa no que ESTA conta faz. É o cruzamento entre o seu catálogo declarado no Perfil e a atividade da conta.',
    paraQueServe:
      'Serve para a nota responder "eu tenho o que vender para eles?", e não só "eles são grandes?". Sem catálogo cadastrado, a Mira não tem como saber o que você oferece, e este fator fica zerado por completo: é o campo que mais barato sobe a nota da fila inteira de uma vez.',
    comoImplementar: [
      'Sobe quando a atividade da conta é compatível com o seu catálogo. O cruzamento fino (qual produto, com que argumento) é o que o Aprofundar com IA escreve nas Oportunidades.',
      'Fica em zero quando você não cadastrou catálogo no Perfil. O motivo diz isso com todas as letras: "cadastre o catálogo no Perfil para o cruzamento demanda × oferta".',
      'Para melhorar: cadastre seus produtos e serviços no bloco Catálogo do Perfil de Prospecção, com uma descrição curta de cada.',
    ],
    exemploResultado:
      'Uma consultoria de infraestrutura cadastra três serviços no Perfil. Todos os Alvos de indústria da fila sobem no fator de uma vez, porque a atividade deles passa a ter com o que ser cruzada. O Aprofundar então aponta qual dos três serviços vai em cada conta.',
  },
  {
    featureKey: 'mira.score.janela',
    titulo: 'Janela e incumbente (15 pontos)',
    clientSafe: true,
    relacionados: ['mira.score', 'mira.aprofundar', 'mira.dossie.incumbentes', 'mira.dossie.janela'],
    oQueE:
      'Duas perguntas num fator só: existe um motivo para ser AGORA (a janela), e quem já atende essa conta hoje (o incumbente). Os dois vêm da pesquisa na web que o Aprofundar com IA faz.',
    paraQueServe:
      'Serve para separar a conta que faz sentido da conta que faz sentido HOJE. Janela é o gatilho: mudou de dono, anunciou expansão, abriu filial, trocou a diretoria. Incumbente é quem você vai ter que deslocar, e saber disso é acionável dos dois lados: te dá o argumento certo e evita a abordagem ingênua de quem acha que a conta está descoberta.',
    comoImplementar: [
      'Este fator só pontua depois que você clica em Aprofundar com IA. Antes disso ele vale 0, e o motivo diz exatamente isso, em vez de fingir que a conta não tem janela.',
      'Sobe quando a pesquisa acha um gatilho de entrada, e sobe de novo quando nomeia um fornecedor atual com evidência pública.',
      'Se a pesquisa rodou e não achou nada, o fator fica em 0, mas o motivo passa a dizer "pesquisamos e não achamos". Isso é informação sobre a conta (pegada pública fraca), diferente de "ainda não procuramos".',
      'Nunca inventamos o fornecedor pelo setor: só entra quem aparece nomeado numa fonte real, com o link no dossiê.',
    ],
    exemploResultado:
      'Um Alvo estava com 33 e o fator zerado. Depois do Aprofundar, a pesquisa acha o anúncio de expansão da fábrica e uma notícia citando o ERP que a conta usa. O fator vai a 15, a nota sobe para 52, e o vendedor abre a conversa pela expansão sabendo contra quem compete.',
    mockup: `<svg viewBox="0 0 640 182" role="img" width="100%" style="max-width:640px;margin:0 auto;display:block" xmlns="http://www.w3.org/2000/svg">
      <style>
        .rot{font:600 10px system-ui,sans-serif;letter-spacing:.05em}
        .t{font:600 12px system-ui,sans-serif;fill:#111827}
        .s{font:10.5px system-ui,sans-serif;fill:#6B7280}
      </style>
      <text class="rot" x="14" y="16" fill="#6B7280">OS TRÊS ESTADOS DO FATOR (E OS DOIS ZEROS NÃO SÃO IGUAIS)</text>

      <rect x="14" y="28" width="196" height="72" rx="9" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1.5"/>
      <text class="t" x="28" y="48">0 / 15</text>
      <text class="s" x="28" y="66">Você ainda não aprofundou.</text>
      <text class="s" x="28" y="80">Não sabemos, e dizemos isso.</text>
      <text class="s" x="28" y="94" style="fill:#4A52D0;font-weight:600">→ clique em Aprofundar com IA</text>

      <rect x="222" y="28" width="196" height="72" rx="9" fill="#FFFBEB" stroke="#F59E0B" stroke-width="1.5"/>
      <text class="t" x="236" y="48">0 / 15</text>
      <text class="s" x="236" y="66">Pesquisamos e não achamos.</text>
      <text class="s" x="236" y="80">A conta tem pegada fraca.</text>
      <text class="s" x="236" y="94" style="fill:#B45309;font-weight:600">isto é informação, não lacuna</text>

      <rect x="430" y="28" width="196" height="72" rx="9" fill="#F0FBF6" stroke="#2FB57A" stroke-width="1.5"/>
      <text class="t" x="444" y="48">15 / 15</text>
      <text class="s" x="444" y="66">Janela: anunciou expansão.</text>
      <text class="s" x="444" y="80">Incumbente: usa o ERP X.</text>
      <text class="s" x="444" y="94" style="fill:#0F7A50;font-weight:600">com link da fonte no dossiê</text>

      <rect x="14" y="114" width="612" height="56" rx="8" fill="#F5F6FF" stroke="#4A52D0" stroke-width="1.2" stroke-dasharray="4 3"/>
      <text class="t" x="32" y="134" style="fill:#3730A3">Por que os dois zeros são diferentes</text>
      <text class="s" x="32" y="150">O primeiro é ausência de pesquisa. O segundo é resultado de pesquisa.</text>
      <text class="s" x="32" y="163">Só o segundo te diz algo sobre a conta, e é por isso que o motivo muda.</text>
    </svg>`,
  },
];
