import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Qualidade da IA (/treinar/qualidade).
 *
 * /knowledge-base é redirect puro pra /ai-training (rota legada sem UI própria),
 * por isso não recebe gatilhos: o conteúdo abaixo cobre só /treinar/qualidade.
 */
export const qualidadeContent: SaibaMaisContent[] = [
  {
    featureKey: 'qualidade.overview',
    titulo: 'Qualidade da IA',
    clientSafe: true,
    oQueE:
      'A tela roda testes automáticos que simulam conversas de clientes com o seu agente: um cliente insatisfeito, alguém querendo comprar, um pedido pra falar com um humano. Depois de cada teste, a IA mostra o que o agente respondeu certo e sugere correções pro que não respondeu bem.',
    paraQueServe:
      'Serve pra você acompanhar, sem escutar conversa por conversa, se o agente está respondendo do jeito certo, e corrigir rápido antes que um erro aconteça com um cliente de verdade.',
    comoImplementar: [
      'Escolha o agente no topo da página, se você tiver mais de um.',
      'Clique em "Executar teste agora" pra rodar uma nova bateria de simulações (leva de 3 a 5 minutos).',
      'Veja o card de Saúde e a lista de "Comportamentos para revisar" à direita.',
      'Pra cada comportamento reprovado, aplique a correção sugerida ou recuse se não fizer sentido pro seu negócio.',
    ],
    exemploResultado:
      'Numa loja de eletrônicos, o dono roda o teste na segunda de manhã e vê que o agente está em "Atenção" (78%). Dois cenários reprovaram: o agente usou uma gíria proibida numa simulação de reclamação e esqueceu de chamar o cliente pelo nome. Ele aplica as duas correções sugeridas e, na execução automática da semana seguinte, a nota sobe pra 92%.',
    relacionados: ['qualidade.saude-score', 'qualidade.cenarios-revisar', 'qualidade.executar-teste'],
  },
  {
    featureKey: 'qualidade.saude-score',
    titulo: 'Saúde do agente',
    clientSafe: true,
    oQueE:
      'É a nota do agente na última bateria de testes, resumida em três níveis: Bom (90% ou mais dos cenários passaram), Atenção (entre 70% e 89%) e Crítico (menos de 70%). Logo abaixo, a nota aparece dividida em duas partes: Conhecimento do negócio e Comportamento.',
    paraQueServe:
      'Serve pra você saber de cara, sem entrar em nenhum detalhe técnico, se o agente está pronto pra atender sozinho ou se precisa de ajuste antes de continuar confiando nele com clientes reais.',
    comoImplementar: [
      'Veja o card no topo da tela de Qualidade da IA, logo depois de escolher o agente.',
      'Se estiver em "Atenção" ou "Crítico", desça até "Comportamentos para revisar" pra ver o que causou a nota baixa.',
      'Leia as duas partes separadas. Conhecimento do negócio testa perguntas geradas do que você cadastrou: suas perguntas e respostas e os campos de preço, horário, formas de pagamento e endereço do questionário. Comportamento testa situações comuns de atendimento, iguais para todos os clientes. Sem nada cadastrado, a parte de conhecimento mostra "Sem base cadastrada" em vez de uma nota.',
    ],
    exemploResultado:
      'Numa clínica de estética, o agente aparece com Comportamento em 62%, porque reprovou em transbordo para humano e em cliente insatisfeito, e Conhecimento do negócio em 50%, porque não soube o preço da limpeza de pele. A dona aplica as correções de comportamento, cadastra o preço que faltava e acompanha as duas partes na execução seguinte.',
    relacionados: ['qualidade.overview', 'qualidade.kpis-cenarios'],
  },
  {
    featureKey: 'qualidade.cenarios-revisar',
    titulo: 'Comportamentos para revisar',
    clientSafe: true,
    oQueE:
      'É a lista dos cenários de teste que o agente não passou, ou passou só parcialmente, na última execução. Cada cenário é uma simulação de conversa, não é um cliente real, criada pra testar uma situação específica: um cliente insatisfeito, alguém pedindo pra falar com um humano, uma pergunta que você cadastrou. Logo abaixo fica a lista completa da execução, com os aprovados também.',
    paraQueServe:
      'Serve pra você ver exatamente onde o agente errou e decidir, um por um, se aplica a correção que a IA sugere ou se recusa porque aquilo não se aplica ao seu negócio.',
    comoImplementar: [
      'Clique em cada linha da lista pra abrir o detalhe do cenário.',
      'Leia o diagnóstico e a interação testada (a conversa simulada, a resposta que o agente deu de verdade e a evidência do avaliador).',
      'Se o agente errou por falta de informação, use "Cadastrar esta informação": ele abre o Treinar IA com a pergunta já escrita. Se o problema foi de conduta, aplique a correção sugerida, edite o texto antes de aplicar, ou recuse.',
    ],
    exemploResultado:
      'Num escritório de contabilidade, aparecem três comportamentos pra revisar: o agente não encaminhou um cliente irritado pra um humano, usou um termo técnico difícil de entender e não confirmou o CNPJ antes de dar uma informação sensível. O dono trata os três em cinco minutos.',
    relacionados: ['qualidade.correcao-sugerida', 'qualidade.interacao-testada', 'qualidade.kpis-cenarios'],
  },
  {
    featureKey: 'qualidade.correcao-sugerida',
    titulo: 'Correção sugerida',
    clientSafe: true,
    oQueE:
      'É o ajuste de texto que a IA propõe pras instruções do seu agente, pra corrigir o comportamento que reprovou no teste. Aparece um resumo em português simples e, logo abaixo, o texto exato que vai ser acrescentado às instruções. A correção nunca apaga nada que já existe: ela soma uma regra nova, reforçando o ponto que falhou. Não precisa entender formato técnico, só ler o resumo e conferir o texto se quiser. Ao lado tem uma porcentagem de confiança, que mostra o quanto a IA acredita que essa correção resolve o problema.',
    paraQueServe:
      'Serve pra você decidir com segurança se aplica a mudança no agente, sem precisar escrever a regra você mesmo.',
    comoImplementar: [
      'Leia o resumo em destaque, logo acima do texto técnico.',
      'O texto exato já aparece logo abaixo do resumo, num bloco separado. Não precisa clicar em nada pra ver.',
      'Se a confiança estiver baixa ou o texto não fizer sentido pro seu negócio, use "Editar antes de aplicar" ou recuse a sugestão.',
    ],
    exemploResultado:
      'Numa pet shop, a correção sugerida vem com 85% de confiança e o resumo diz "adicionar regra pra sempre oferecer agendamento de banho quando o cliente perguntar sobre preço". O dono lê, concorda e aplica direto, sem precisar mexer no texto.',
    relacionados: ['qualidade.aplicar-correcao', 'qualidade.editar-correcao'],
  },
  {
    featureKey: 'qualidade.aplicar-correcao',
    titulo: 'Aplicar correção',
    clientSafe: true,
    oQueE:
      'É o botão que grava a correção sugerida direto nas instruções do agente. Depois de confirmar, o ajuste passa a valer nas próximas conversas do WhatsApp. No chat do site pode levar até 5 minutos, porque as instruções ficam em cache.',
    paraQueServe:
      'Serve pra corrigir o comportamento do agente rápido, sem precisar mexer em nenhuma configuração técnica.',
    comoImplementar: [
      'Leia a correção sugerida e, se quiser, escreva uma observação sobre por que está aplicando.',
      'Clique em "Aplicar correção" e confirme na caixa que aparece.',
      'Depois de aplicada, clique em "Re-testar agora": ele roda o cenário três vezes e mostra quantas passaram. O re-teste fica registrado, mas não entra no histórico nem muda a nota; quem atualiza a nota é a próxima execução completa.',
      'Se algo sair diferente do esperado, use "Reverter aplicação" pra voltar o agente ao comportamento de antes.',
    ],
    exemploResultado:
      'Numa academia, o dono aplica a correção pra um cenário de cancelamento de plano. Ele clica em "Re-testar agora" e vê ali que o cenário passou. Como o re-teste não muda a nota, ele confere o efeito na nota na execução da semana seguinte.',
    relacionados: ['qualidade.correcao-sugerida', 'qualidade.editar-correcao'],
  },
  {
    featureKey: 'qualidade.executar-teste',
    titulo: 'Executar teste agora',
    clientSafe: true,
    oQueE:
      'É o botão que dispara uma nova bateria de testes no agente, fora da execução automática que já roda uma vez por semana sozinha. O teste demora de 3 a 5 minutos e usa IA pra simular as conversas, por isso só pode ser rodado uma vez a cada 24 horas por agente.',
    paraQueServe:
      'Serve pra conferir na hora se uma correção que você aplicou, ou um treinamento novo que você deu à IA, já melhorou o comportamento do agente, sem precisar esperar a execução automática da semana.',
    comoImplementar: [
      'Escolha o agente no topo da página, se você tiver mais de um.',
      'Clique em "Executar teste agora" e aguarde: o botão avisa que está executando enquanto o teste roda.',
      'Quando terminar, o resultado aparece sozinho na lista de execuções à esquerda.',
      'Se tentar rodar de novo antes de completar 24 horas, a tela avisa quando o próximo teste fica disponível.',
    ],
    exemploResultado:
      'Numa loja de roupas, o dono treina a IA com a política de troca nova pela manhã e clica em "Executar teste agora" às 10h. Às 10h04 o resultado chega mostrando que o cenário de troca, que antes reprovava, passou a aprovar.',
    relacionados: ['qualidade.historico-execucoes', 'qualidade.overview'],
  },
  {
    featureKey: 'qualidade.editar-correcao',
    titulo: 'Editar antes de aplicar',
    clientSafe: true,
    oQueE:
      'É a opção de mudar o texto da correção sugerida pela IA antes de aplicar, abrindo uma caixa de texto onde dá pra reescrever a regra do seu jeito.',
    paraQueServe:
      'Serve pra ajustar a correção quando a sugestão da IA está no caminho certo mas não do jeito exato que você quer, ou pra fortalecer uma regra que já foi aplicada antes e não pegou.',
    comoImplementar: [
      'Clique em "Editar antes de aplicar", dentro do bloco da correção sugerida.',
      'Reescreva o texto na caixa. Regra boa é regra específica: diga o que a IA deve fazer, em que situação, e dê um exemplo da frase certa. Não precisa escrever em letras maiúsculas nem numerar a regra.',
      'Clique em "Aplicar correção" pra gravar o texto editado, ou em "Voltar à sugestão original" pra descartar a edição.',
    ],
    exemploResultado:
      'Numa clínica veterinária, uma correção já aplicada antes não impediu o agente de prometer prazo de exame errado. O dono edita o texto e troca por algo mais direto: "Nunca informe prazo de exame sem confirmar com a recepção. Se perguntarem, responda que vai checar e retorna." Aplica de novo e o cenário passa a aprovar no re-teste.',
    relacionados: ['qualidade.correcao-sugerida', 'qualidade.aplicar-correcao'],
  },
  {
    featureKey: 'qualidade.interacao-testada',
    titulo: 'Interação testada',
    clientSafe: true,
    oQueE:
      'É o registro da conversa simulada usada naquele teste: as mensagens anteriores, a mensagem que a IA mandou fingindo ser um cliente, a resposta que o seu agente deu de verdade e o trecho que o avaliador usou para decidir. O contato do teste é fictício ("Cliente Teste"): não é uma conversa com um cliente real.',
    paraQueServe:
      'Serve pra você ler com os próprios olhos o que o agente respondeu e julgar se concorda com o diagnóstico da IA, antes de decidir aplicar ou recusar a correção.',
    comoImplementar: [
      'Abra um cenário na lista de "Comportamentos para revisar".',
      'Leia "Mensagem enviada" (o que o cliente simulado perguntou) e "Resposta do agente" (o que o seu agente respondeu de verdade).',
      'Compare com a evidência do avaliador e com o diagnóstico, que explicam por que aquilo foi aprovado ou reprovado.',
    ],
    exemploResultado:
      'Numa imobiliária, a interação testada mostra o cliente simulado perguntando sobre a taxa de condomínio e o agente respondendo um valor sem confirmar de qual imóvel se tratava. Ao ler a troca, o dono entende na hora por que aquilo foi marcado como reprovado.',
    relacionados: ['qualidade.cenarios-revisar', 'qualidade.correcao-sugerida'],
  },
  {
    featureKey: 'qualidade.historico-execucoes',
    titulo: 'Últimas execuções',
    clientSafe: true,
    oQueE:
      'É a lista das últimas vezes que o teste de qualidade rodou nesse agente, com a data, quem disparou e o resultado de cada uma. Além das vezes que você clica em "Executar teste agora", existe uma execução automática que roda sozinha uma vez por semana, mesmo sem ninguém pedir.',
    paraQueServe:
      'Serve pra acompanhar a evolução do agente ao longo do tempo e comparar se as correções que você aplicou realmente melhoraram a nota nas execuções seguintes.',
    comoImplementar: [
      'Veja a coluna à esquerda da tela, com uma execução por linha.',
      'Clique numa execução pra abrir o resultado completo dela à direita.',
      'Repare na etiqueta de cada execução: "Manual (você)" foi disparada por você, "Semanal automático" rodou sozinha.',
    ],
    exemploResultado:
      'Num escritório de advocacia, o histórico mostra que a nota do agente subiu de 68% pra 91% em três execuções semanais seguidas, depois que o dono foi aplicando as correções sugeridas a cada semana.',
    relacionados: ['qualidade.executar-teste', 'qualidade.saude-score'],
  },
  {
    featureKey: 'qualidade.kpis-cenarios',
    titulo: 'Aprovados, Parciais, Reprovados e Críticos',
    clientSafe: true,
    oQueE:
      'São os quatro números que resumem o resultado da execução. Aprovados é o que o agente respondeu certo. Parciais é quando o agente acertou parte da resposta mas deixou passar algum detalhe, e parcial conta como não aprovado na nota: o cenário só soma quando a regra automática e o avaliador aprovam juntos. Reprovados é quando o agente errou o comportamento esperado. Críticos é o subconjunto dos reprovados que envolve um risco mais sério, como prometer algo errado ou não encaminhar um cliente insatisfeito pra um humano.',
    paraQueServe:
      'Serve pra você priorizar: comece sempre pelos Críticos, porque são os que têm mais chance de custar um cliente ou gerar um problema real, e só depois olhe os Parciais.',
    comoImplementar: [
      'Veja os quatro cards logo abaixo do card de Saúde do agente.',
      'Desça até "Comportamentos para revisar" e procure primeiro os marcados como "Crítico".',
      'Depois de tratar os Críticos, revise os Reprovados e, por último, os Parciais.',
    ],
    exemploResultado:
      'Numa rede de farmácias, a execução mostra 14 Aprovados, 3 Parciais, 2 Reprovados e 1 Crítico. O dono trata primeiro o Crítico, que era o agente não confirmando a necessidade de receita médica antes de informar disponibilidade do remédio.',
    relacionados: ['qualidade.cenarios-revisar', 'qualidade.saude-score'],
  },
];
