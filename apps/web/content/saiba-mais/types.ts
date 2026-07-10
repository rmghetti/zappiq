/**
 * Registro central de conteúdo do "Saiba mais" (fonte única da verdade).
 *
 * Cada item explica um recurso do Dashboard para um dono de PME leigo, nos
 * quatro blocos do padrão MACHIA: o que é, para que serve, como implementar e
 * um exemplo de resultado na operação.
 *
 * Este mesmo conteúdo, quando `clientSafe: true`, vira o corpus da Iza Ajuda
 * (Fase 2). Por isso os campos são dados serializáveis (nada de JSX): o `mockup`
 * é uma string de SVG/HTML inline, renderizada de forma controlada pelo modal.
 *
 * Voz: pt-BR com acentuação, padrão /voz-humana, sem travessão.
 */

export interface SaibaMaisContent {
  /** Identificador estável no formato area.recurso[.subrecurso], ex: "analytics.pulso" */
  featureKey: string;
  /** Rótulo curto exibido no header do popup */
  titulo: string;
  /** Bloco 1: definição curta, sem jargão */
  oQueE: string;
  /** Bloco 2: o benefício concreto na operação do cliente */
  paraQueServe: string;
  /** Bloco 3: passo a passo prático dentro da própria tela */
  comoImplementar: string[];
  /** Bloco 4: caso realista com números plausíveis */
  exemploResultado: string;
  /** SVG/HTML inline opcional para ilustrar (autorado por nós, renderizado no modal) */
  mockup?: string;
  /** true = pode entrar no corpus da Iza Ajuda (Fase 2). Padrão para telas de cliente. */
  clientSafe: boolean;
  /** Outras featureKeys relacionadas, para navegação futura */
  relacionados?: string[];
}

/** Um tour pontual: sequência de passos ancorados em elementos da tela (Fase 1, secção 5.5). */
export interface TourStep {
  /** Seletor CSS ou data-attribute do elemento alvo na tela */
  alvo: string;
  /** featureKey do Saiba mais correspondente (fonte do texto detalhado) */
  featureKey?: string;
  /** Microcopy da ação esperada neste passo, ex: "Clique em Conectar WhatsApp" */
  acao: string;
}

export interface Tour {
  /** Identificador do tour, ex: "conectar-whatsapp" */
  tourKey: string;
  titulo: string;
  passos: TourStep[];
}
