/**
 * ZappIQ Maestro — Biblioteca de Blueprints (#288 "Maestro monta pra você")
 * ============================================================================
 * Arquitetura HÍBRIDA: a ESTRUTURA do fluxo (nós + arestas) é determinística e
 * vive aqui — garante grafo sempre válido pro flowEngine. A IA (flowGenerator)
 * só PREENCHE o conteúdo textual de cada nó (texto da mensagem, prompt do nó-IA,
 * nome da tag) e escreve o racional. Se a IA falhar, usamos o conteúdo-padrão
 * deste arquivo (fallback determinístico) — o "monta pra você" nunca quebra.
 *
 * Cada blueprint é linear e seguro na v1: start → message → tag → ai.
 * (Trilho fixo dá a recepção + classificação determinística; o nó-IA assume a
 * conversa usando o MESMO conhecimento do agente.) Estruturas mais ricas
 * (condição, humano, agendamento ramificado) entram na v2.
 * ============================================================================
 */

export type BlueprintGoal =
  | 'atendimento'
  | 'agendamento'
  | 'qualificacao'
  | 'faq'
  | 'posvenda';

/** Chaves de conteúdo que a IA preenche por nó. */
export interface BlueprintContent {
  /** Texto da mensagem de boas-vindas (nó message). */
  welcomeText: string;
  /** Nome da tag aplicada (nó tag). kebab-case curto. */
  tag: string;
  /** Instrução/prompt do nó-IA (o que a IA deve fazer ao assumir). */
  aiPrompt: string;
  /** Nome amigável do fluxo. */
  flowName: string;
}

export interface Blueprint {
  id: string;
  goal: BlueprintGoal;
  label: string;
  /** Quando usar — vai pro racional e pro prompt da IA. */
  description: string;
  /** Conteúdo-padrão (fallback determinístico se a IA falhar). */
  defaults: BlueprintContent;
}

/** Os 4 nós fixos de todo blueprint v1 (estrutura imutável). */
export const BLUEPRINT_NODE_IDS = {
  start: 'n_start',
  message: 'n_msg',
  tag: 'n_tag',
  ai: 'n_ai',
} as const;

/**
 * Monta o grafo final (nodes/edges) a partir do conteúdo preenchido.
 * Estrutura garantida: start → message → tag → ai.
 */
export function buildGraphFromContent(content: BlueprintContent): {
  nodes: any[];
  edges: any[];
} {
  const { start, message, tag, ai } = BLUEPRINT_NODE_IDS;
  return {
    nodes: [
      { id: start, type: 'start', data: { label: 'Início' } },
      { id: message, type: 'message', data: { label: 'Mensagem', text: content.welcomeText } },
      { id: tag, type: 'tag', data: { label: 'Marcar tag', tag: content.tag } },
      { id: ai, type: 'ai', data: { label: 'Nó-IA', prompt: content.aiPrompt } },
    ],
    edges: [
      { id: 'e_start_msg', source: start, target: message },
      { id: 'e_msg_tag', source: message, target: tag },
      { id: 'e_tag_ai', source: tag, target: ai },
    ],
  };
}

/** Catálogo de blueprints por objetivo. */
export const BLUEPRINTS: Record<BlueprintGoal, Blueprint> = {
  atendimento: {
    id: 'bp_atendimento_v1',
    goal: 'atendimento',
    label: 'Atendimento & dúvidas',
    description:
      'Recebe o cliente, registra como novo contato e deixa a IA responder dúvidas usando o conhecimento do negócio, transferindo pra um humano quando necessário.',
    defaults: {
      flowName: 'Atendimento inicial',
      welcomeText: 'Olá! 👋 Que bom te ver por aqui. Como posso te ajudar hoje?',
      tag: 'novo-contato',
      aiPrompt:
        'Atenda o cliente de forma simpática e objetiva, respondendo dúvidas com base no conhecimento do negócio. Se for algo que exige um humano, ofereça transferir.',
    },
  },
  agendamento: {
    id: 'bp_agendamento_v1',
    goal: 'agendamento',
    label: 'Agendamento',
    description:
      'Saúda o cliente, marca interesse em agendar e deixa a IA coletar os dados (serviço, melhor dia/horário) e confirmar dentro do horário de funcionamento.',
    defaults: {
      flowName: 'Agendamento',
      welcomeText: 'Olá! 👋 Quer agendar um horário com a gente? Me conta o que você precisa.',
      tag: 'quer-agendar',
      aiPrompt:
        'Ajude o cliente a agendar: pergunte o serviço desejado e o melhor dia/horário, respeite o horário de funcionamento e confirme o agendamento de forma clara.',
    },
  },
  qualificacao: {
    id: 'bp_qualificacao_v1',
    goal: 'qualificacao',
    label: 'Qualificação de lead',
    description:
      'Recepciona o lead, marca como lead em qualificação e deixa a IA fazer 2-3 perguntas-chave pra entender necessidade, urgência e fit antes de avançar.',
    defaults: {
      flowName: 'Qualificação de lead',
      welcomeText: 'Olá! 👋 Para te atender da melhor forma, posso te fazer algumas perguntas rápidas?',
      tag: 'lead-em-qualificacao',
      aiPrompt:
        'Qualifique o lead com 2-3 perguntas curtas (necessidade, urgência e orçamento/fit). Seja simpático, uma pergunta por vez, e ao final resuma o que entendeu.',
    },
  },
  faq: {
    id: 'bp_faq_v1',
    goal: 'faq',
    label: 'Tira-dúvidas (FAQ)',
    description:
      'Boas-vindas, marca o contato e deixa a IA responder as perguntas frequentes usando a base de conhecimento, sem enrolação.',
    defaults: {
      flowName: 'Tira-dúvidas',
      welcomeText: 'Oi! 👋 Pode mandar sua dúvida que eu te respondo na hora.',
      tag: 'duvida-faq',
      aiPrompt:
        'Responda as dúvidas do cliente de forma curta e direta usando a base de conhecimento do negócio. Se não souber, ofereça falar com um humano.',
    },
  },
  posvenda: {
    id: 'bp_posvenda_v1',
    goal: 'posvenda',
    label: 'Pós-venda & suporte',
    description:
      'Recebe o cliente que já comprou, marca como pós-venda e deixa a IA dar suporte (status, troca, dúvida de uso) com tom acolhedor.',
    defaults: {
      flowName: 'Pós-venda',
      welcomeText: 'Olá! 👋 Já é nosso cliente? Me conta como posso ajudar com seu pedido ou produto.',
      tag: 'pos-venda',
      aiPrompt:
        'Dê suporte de pós-venda com tom acolhedor: status de pedido, troca/devolução, dúvida de uso. Resolva o que der e ofereça humano nos casos sensíveis.',
    },
  },
};

/**
 * Mapa niche (segmento do cadastro) → objetivo default sugerido.
 * Usado quando o cliente NÃO digita um objetivo explícito.
 */
const NICHE_TO_GOAL: Record<string, BlueprintGoal> = {
  healthcare: 'agendamento',
  clinica: 'agendamento',
  saude: 'agendamento',
  odonto: 'agendamento',
  estetica: 'agendamento',
  education: 'qualificacao',
  educacao: 'qualificacao',
  marketing: 'qualificacao',
  consulting: 'qualificacao',
  consultoria: 'qualificacao',
  imobiliaria: 'qualificacao',
  realestate: 'qualificacao',
  retail: 'atendimento',
  varejo: 'atendimento',
  ecommerce: 'posvenda',
  banking: 'atendimento',
  financas: 'atendimento',
  food: 'atendimento',
  restaurante: 'atendimento',
};

/** Escolhe o blueprint por objetivo explícito ou, na falta, pelo niche. */
export function pickBlueprint(opts: { goal?: string; niche?: string | null }): Blueprint {
  const explicit = (opts.goal || '').toLowerCase().trim();
  if (explicit && explicit in BLUEPRINTS) {
    return BLUEPRINTS[explicit as BlueprintGoal];
  }
  const niche = (opts.niche || '').toLowerCase().trim();
  const goalFromNiche = NICHE_TO_GOAL[niche];
  if (goalFromNiche) return BLUEPRINTS[goalFromNiche];
  return BLUEPRINTS.atendimento; // fallback universal
}
