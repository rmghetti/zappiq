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
    featureKey: 'mira.perfil.modo',
    titulo: 'B2B ou B2C',
    clientSafe: true,
    oQueE:
      'A escolha entre vender para empresas (B2B) ou para consumidores e negócios locais (B2C) muda como o Mira mapeia. No B2B, a base é o CNPJ e o quadro societário. No B2C, a descoberta usa presença local (Google) e o perfil do público.',
    paraQueServe:
      'Serve para o motor certo trabalhar para você. Os dois modos usam a mesma inteligência de qualificação, mas procuram em lugares diferentes.',
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
      'O botão Aprofundar com IA chama os agentes de análise para um Alvo específico: eles cruzam os dados verificados da conta com o seu catálogo e escrevem as oportunidades número 1 e 2, a dor provável e o roteiro de primeira mensagem para cada decisor.',
    paraQueServe:
      'Serve para transformar dado em conversa. Em vez de olhar a firmografia crua, você recebe a pauta pronta: qual produto oferecer, por quê, e como abrir o papo com cada pessoa do comitê.',
    comoImplementar: [
      'Abra o dossiê do Alvo e clique em Aprofundar com IA.',
      'A análise usa só os dados verificados: um verificador descarta qualquer item sem lastro (produto fora do catálogo, decisor desconhecido, contato inventado).',
      'Revise o roteiro antes de usar: análise de IA tem confiança de inferência, marcada no dossiê.',
    ],
    exemploResultado:
      'Num Alvo de indústria, a análise aponta a oportunidade número 1 (serviço de backup gerenciado, pela atividade e porte) e escreve o roteiro para o sócio-administrador. O vendedor ajusta uma frase e envia. Resposta em duas horas.',
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
];
