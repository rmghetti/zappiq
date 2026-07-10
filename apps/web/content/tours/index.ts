/**
 * Registro dos tours pontuais (Fase 1, secção 5.5 do design).
 *
 * Apenas 3 fluxos sequenciais difíceis têm tour: conectar WhatsApp, primeiro
 * fluxo no Maestro e configurar o Treinar IA. Cada passo aponta um alvo
 * (data-tour na tela) e a ação esperada, e pode referenciar a featureKey do
 * Saiba mais para o detalhe.
 */
import type { Tour } from '@/content/saiba-mais/types';

export const TOURS: Record<string, Tour> = {
  'conectar-whatsapp': {
    tourKey: 'conectar-whatsapp',
    titulo: 'Conectar o WhatsApp',
    passos: [
      {
        alvo: '[data-tour="canais-ativar"]',
        acao: 'Comece escolhendo o que ativar: só WhatsApp, só Instagram ou os dois. Deixe o WhatsApp marcado para conectar agora.',
      },
      {
        alvo: '[data-tour="canais-whatsapp-1clique"]',
        acao: 'Clique em "Conectar com a Meta" para ligar seu WhatsApp em um clique. Uma janela da Meta abre e você faz login na conta do seu negócio.',
        featureKey: 'settings.canais.whatsapp-1-clique',
      },
      {
        alvo: '[data-tour="canais-whatsapp-manual"]',
        acao: 'Se preferir, use o formulário manual: cole o Phone Number ID, o WABA ID e o Access Token. É a alternativa para quem já tem esses dados na Meta.',
        featureKey: 'settings.canais.whatsapp-manual',
      },
    ],
  },

  'primeiro-fluxo-maestro': {
    tourKey: 'primeiro-fluxo-maestro',
    titulo: 'Seu primeiro fluxo',
    passos: [
      {
        alvo: '[data-tour="maestro-tutorial"]',
        acao: 'Antes de montar, veja o tutorial de 5 a 7 minutos. Ele mostra como o Maestro desenha a operação inteira, sem template pronto.',
      },
      {
        alvo: '[data-tour="maestro-inteligente"]',
        acao: 'O caminho mais fácil: deixe o Maestro Inteligente ler o que você treinou na IA e montar o fluxo sob medida. É só escolher os objetivos.',
        featureKey: 'flows.mapa-operacao.arquitetar',
      },
      {
        alvo: '[data-tour="maestro-novo-fluxo"]',
        acao: 'Prefere no controle? Clique em "Criar fluxo" para começar do zero, ou em "Mapa da Operação" para ver e conectar tudo que já existe.',
      },
    ],
  },

  'treinar-ia': {
    tourKey: 'treinar-ia',
    titulo: 'Treinar a sua IA',
    passos: [
      {
        alvo: '[data-tour="ait-readiness"]',
        acao: 'Este é o Readiness: o quanto sua IA está pronta para atender bem. Cada informação que você adicionar abaixo faz esse número subir na hora.',
        featureKey: 'ai-training.readiness-score',
      },
      {
        alvo: '[data-tour="ait-blocos"]',
        acao: 'Passe pelas abas na ordem: Qualificação, Documentos, Perguntas & Respostas e Identidade. Cada uma ensina algo diferente para a IA.',
      },
      {
        alvo: '[data-tour="ait-blocos"]',
        acao: 'Quando terminar, abra "Testar minha IA" e converse com ela para ver como ficou. Volte e ajuste sempre que quiser.',
      },
    ],
  },
};

export function getTour(tourKey: string): Tour | undefined {
  return TOURS[tourKey];
}

export function allTourKeys(): string[] {
  return Object.keys(TOURS);
}
