import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Analytics.
 * Fonte inicial (prova de conceito). Itens adicionais entram após a varredura.
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
      'Abra o menu Analytics e vá até o bloco Pulso, no topo da página.',
      'Escolha o período que quer enxergar (ontem, últimos 7 dias ou um intervalo personalizado).',
      'Clique em qualquer indicador para abrir o detalhe e ver as conversas por trás daquele número.',
    ],
    exemploResultado:
      'Numa loja com 400 conversas por dia, o Pulso mostra pela manhã que a IA resolveu 320 sozinha (80%), que 12 clientes ficaram sem resposta acima de 10 minutos e que o assunto "troca de produto" foi o que mais gerou dúvida. Com isso, o dono já sabe onde treinar a IA e qual fila priorizar, sem abrir uma conversa sequer.',
    relacionados: ['analytics.ia-vs-humano', 'analytics.vendas-atribuidas'],
  },
];
