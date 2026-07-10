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
      'É a nota geral do agente na última bateria de testes, resumida em três níveis: Bom (90% ou mais dos cenários passaram), Atenção (entre 70% e 89%) e Crítico (menos de 70%). O percentual exato aparece do lado, como detalhe.',
    paraQueServe:
      'Serve pra você saber de cara, sem entrar em nenhum detalhe técnico, se o agente está pronto pra atender sozinho ou se precisa de ajuste antes de continuar confiando nele com clientes reais.',
    comoImplementar: [
      'Veja o card no topo da tela de Qualidade da IA, logo depois de escolher o agente.',
      'Se estiver em "Atenção" ou "Crítico", desça até "Comportamentos para revisar" pra ver o que causou a nota baixa.',
      'Complete o treinamento da IA em /ai-training: boa parte da nota vem do quanto o agente sabe sobre o seu negócio.',
    ],
    exemploResultado:
      'Numa clínica de estética, o agente está com nota "Crítico" (62%) porque ainda não tinha informação suficiente sobre os procedimentos oferecidos. Depois que a dona completa o treinamento com a tabela de preços e as políticas de agendamento, a nota sobe pra "Bom" (94%) na execução seguinte.',
    relacionados: ['qualidade.overview', 'qualidade.kpis-cenarios'],
  },
  {
    featureKey: 'qualidade.cenarios-revisar',
    titulo: 'Comportamentos para revisar',
    clientSafe: true,
    oQueE:
      'É a lista dos cenários de teste que o agente não passou, ou passou só parcialmente, na última execução. Cada cenário é uma simulação de conversa, não é um cliente real, criada pra testar uma situação específica: um cliente insatisfeito, alguém pedindo pra falar com um humano, uma pergunta sobre preço.',
    paraQueServe:
      'Serve pra você ver exatamente onde o agente errou e decidir, um por um, se aplica a correção que a IA sugere ou se recusa porque aquilo não se aplica ao seu negócio.',
    comoImplementar: [
      'Clique em cada linha da lista pra abrir o detalhe do cenário.',
      'Leia o diagnóstico e a interação testada (a mensagem simulada e a resposta que o agente deu de verdade).',
      'Aplique a correção sugerida, edite o texto antes de aplicar, ou recuse.',
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
      'É o botão que grava a correção sugerida direto nas instruções do agente. Depois de confirmar, o ajuste passa a valer imediatamente nas próximas conversas com clientes reais.',
    paraQueServe:
      'Serve pra corrigir o comportamento do agente rápido, sem precisar mexer em nenhuma configuração técnica.',
    comoImplementar: [
      'Leia a correção sugerida e, se quiser, escreva uma observação sobre por que está aplicando.',
      'Clique em "Aplicar correção" e confirme na caixa que aparece.',
      'Depois de aplicada, clique em "Re-testar agora" pra conferir se a correção pegou antes da próxima execução completa.',
      'Se algo sair diferente do esperado, use "Reverter aplicação" pra voltar o agente ao comportamento de antes.',
    ],
    exemploResultado:
      'Numa academia, o dono aplica a correção pra um cenário de cancelamento de plano. Ele clica em "Re-testar agora" e vê que o cenário passou a aprovar. Na execução semanal seguinte, a nota geral do agente sobe 6 pontos percentuais.',
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
      'Reescreva o texto na caixa. Regras mais fortes costumam usar letras maiúsculas e palavras como "REGRA INVIOLÁVEL" ou "PROIBIDO" pra deixar claro que a IA não deve abrir exceção.',
      'Clique em "Aplicar correção" pra gravar o texto editado, ou em "Voltar à sugestão original" pra descartar a edição.',
    ],
    exemploResultado:
      'Numa clínica veterinária, uma correção já aplicada antes não impediu o agente de prometer prazo de exame errado. O dono edita o texto, troca por "PROIBIDO informar prazo de exame sem confirmar com a recepção" em letras maiúsculas, aplica de novo e o cenário passa a aprovar no re-teste.',
    relacionados: ['qualidade.correcao-sugerida', 'qualidade.aplicar-correcao'],
  },
  {
    featureKey: 'qualidade.interacao-testada',
    titulo: 'Interação testada',
    clientSafe: true,
    oQueE:
      'É o registro da conversa simulada usada naquele teste: a mensagem que a IA mandou fingindo ser um cliente, e a resposta que o seu agente deu de verdade. Não é uma conversa com um cliente real, é uma simulação criada só pra avaliar o agente.',
    paraQueServe:
      'Serve pra você ler com os próprios olhos o que o agente respondeu e julgar se concorda com o diagnóstico da IA, antes de decidir aplicar ou recusar a correção.',
    comoImplementar: [
      'Abra um cenário na lista de "Comportamentos para revisar".',
      'Leia "Mensagem enviada" (o que o cliente simulado perguntou) e "Resposta do agente" (o que o seu agente respondeu de verdade).',
      'Compare com o diagnóstico escrito acima, que explica por que aquilo foi considerado errado.',
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
      'São os quatro números que resumem o resultado da execução. Aprovados é o que o agente respondeu certo. Parciais é quando o agente acertou parte da resposta mas deixou passar algum detalhe. Reprovados é quando o agente errou o comportamento esperado. Críticos é o subconjunto dos reprovados que envolve um risco mais sério, como prometer algo errado ou não encaminhar um cliente insatisfeito pra um humano.',
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
