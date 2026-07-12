/* ══════════════════════════════════════════════════════════════════════════
 * Diagnóstico de Perfil ZappIQ — dados (perguntas, planos, produtos, add-ons)
 * --------------------------------------------------------------------------
 * Fonte de verdade dos números: packages/shared/src/planConfig.ts (v2026.1) e
 * a folha de fatos canônicos do reposicionamento. Nomes de produto = Dash.
 * Sem travessão em nenhum texto (padrão de copy da casa).
 * ══════════════════════════════════════════════════════════════════════════ */

export type PlanoId = 'LITE' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';
export type QuestionType = 'single' | 'multi';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  help?: string;
  options?: QuestionOption[];
  maxSelect?: number;
  openField?: boolean; // texto livre (Q15)
  optional?: boolean;
}

/* ── Segmentos (rótulos para o relatório) ── */
export const SEGMENTOS: Record<string, string> = {
  varejo: 'varejo e e-commerce',
  saude: 'saúde e clínicas',
  servicos: 'serviços e B2B',
  educacao: 'educação',
  food: 'alimentação e delivery',
  beleza: 'beleza e estética',
  imobiliaria: 'imobiliária',
  outro: 'sua operação',
};

/* ── As 15 perguntas ── */
export const QUESTIONS: Question[] = [
  {
    id: 'objetivo',
    type: 'multi',
    maxSelect: 2,
    title: 'O que você mais quer resolver com a ZappIQ?',
    help: 'Escolha até 2. Isso define os produtos que vamos destacar pra você.',
    options: [
      { value: 'atender', label: 'Atender mais rápido e 24 horas' },
      { value: 'vender', label: 'Vender e qualificar mais leads' },
      { value: 'campanhas', label: 'Recuperar e reativar clientes com campanhas' },
      { value: 'crm', label: 'Organizar o CRM e o funil de vendas' },
      { value: 'agenda', label: 'Encher a agenda e reduzir no-show' },
      { value: 'medir', label: 'Medir e controlar a operação' },
      { value: 'custo', label: 'Reduzir o custo de atendimento' },
    ],
  },
  {
    id: 'segmento',
    type: 'single',
    title: 'Qual o segmento do seu negócio?',
    options: [
      { value: 'varejo', label: 'Varejo ou e-commerce' },
      { value: 'saude', label: 'Saúde ou clínica' },
      { value: 'servicos', label: 'Serviços ou B2B' },
      { value: 'educacao', label: 'Educação' },
      { value: 'food', label: 'Alimentação ou delivery' },
      { value: 'beleza', label: 'Beleza ou estética' },
      { value: 'imobiliaria', label: 'Imobiliária' },
      { value: 'outro', label: 'Outro' },
    ],
  },
  {
    id: 'canais',
    type: 'single',
    title: 'Em quais canais você atende hoje?',
    options: [
      { value: 'whatsapp', label: 'Só WhatsApp' },
      { value: 'instagram', label: 'Só Instagram' },
      { value: 'ambos', label: 'WhatsApp e Instagram' },
      { value: 'nenhum', label: 'Ainda não atendo por esses canais' },
    ],
  },
  {
    id: 'conversas',
    type: 'single',
    title: 'Quantas conversas você recebe por mês, mais ou menos?',
    options: [
      { value: 'ate1500', label: 'Até 1.500' },
      { value: 'ate8000', label: 'De 1.500 a 8.000' },
      { value: 'ate80000', label: 'De 8.000 a 80.000' },
      { value: 'mais80000', label: 'Mais de 80.000' },
    ],
  },
  {
    id: 'equipe',
    type: 'single',
    title: 'Quantas pessoas atendem hoje?',
    options: [
      { value: 'solo', label: 'Só eu' },
      { value: 'ate10', label: 'De 2 a 10' },
      { value: 'ate75', label: 'De 11 a 75' },
      { value: 'mais75', label: 'Mais de 75' },
    ],
  },
  {
    id: 'contatos',
    type: 'single',
    title: 'Qual o tamanho da sua base de contatos?',
    options: [
      { value: 'ate1000', label: 'Até 1.000' },
      { value: 'ate10000', label: 'De 1.000 a 10.000' },
      { value: 'ate200000', label: 'De 10.000 a 200.000' },
      { value: 'mais200000', label: 'Mais de 200.000' },
    ],
  },
  {
    id: 'numeros',
    type: 'single',
    title: 'Quantos números de WhatsApp ou unidades você opera?',
    options: [
      { value: 'um', label: '1' },
      { value: 'ate5', label: 'De 2 a 5' },
      { value: 'ate15', label: 'De 6 a 15' },
      { value: 'mais15', label: 'Mais de 15' },
    ],
  },
  {
    id: 'campanhas',
    type: 'single',
    title: 'Você faz ou quer fazer disparos e campanhas em massa?',
    options: [
      { value: 'recorrente', label: 'Sim, de forma recorrente' },
      { value: 'esporadico', label: 'Sim, de vez em quando' },
      { value: 'nao', label: 'Não é prioridade agora' },
    ],
  },
  {
    id: 'agendamento',
    type: 'single',
    title: 'Agendamento faz parte do seu negócio (consultas, reuniões, visitas)?',
    options: [
      { value: 'critico', label: 'Sim, é crítico' },
      { value: 'asvezes', label: 'Às vezes' },
      { value: 'nao', label: 'Não' },
    ],
  },
  {
    id: 'audio',
    type: 'single',
    title: 'Seus clientes mandam áudio no WhatsApp?',
    options: [
      { value: 'muito', label: 'Muito' },
      { value: 'asvezes', label: 'Às vezes' },
      { value: 'pouco', label: 'Pouco ou nada' },
    ],
  },
  {
    id: 'crm',
    type: 'single',
    title: 'Como está o seu CRM hoje?',
    options: [
      { value: 'naousa', label: 'Não uso CRM' },
      { value: 'baguncado', label: 'Uso, mas está bagunçado' },
      { value: 'organizado', label: 'Uso e é organizado' },
    ],
  },
  {
    id: 'integracoes',
    type: 'single',
    title: 'Precisa integrar com outras ferramentas (HubSpot, RD, Pipedrive, ERP)?',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'talvez', label: 'Talvez no futuro' },
      { value: 'nao', label: 'Não' },
    ],
  },
  {
    id: 'compliance',
    type: 'single',
    title: 'Seu setor exige segurança e compliance fortes (SLA, SSO, LGPD rígida)?',
    options: [
      { value: 'critico', label: 'Sim, é crítico' },
      { value: 'desejavel', label: 'É desejável' },
      { value: 'nao', label: 'Não é uma exigência' },
    ],
  },
  {
    id: 'momento',
    type: 'single',
    title: 'Qual o momento da sua empresa com IA no atendimento?',
    options: [
      { value: 'validar', label: 'Quero validar o canal' },
      { value: 'escalando', label: 'Estou escalando a operação' },
      { value: 'controle', label: 'Já opero e quero controle e observabilidade' },
    ],
  },
  {
    id: 'dor',
    type: 'single',
    openField: true,
    optional: true,
    title: 'Em uma frase, qual a maior dor que você quer resolver?',
    help: 'Opcional. Ajuda a personalizar o seu relatório.',
  },
];

/* ── Planos (fatos de exibição; números do planConfig.ts v2026.1) ── */
export interface PlanoInfo {
  id: PlanoId;
  nome: string;
  preco: string;
  essencia: string;
  incluso: string[];
}

export const PLANOS: Record<PlanoId, PlanoInfo> = {
  LITE: {
    id: 'LITE',
    nome: 'Lite',
    preco: 'R$ 247/mês (anual R$ 197,60/mês)',
    essencia: 'Para validar o canal com a Iza atendendo, qualificando e no CRM, antes de escalar.',
    incluso: [
      '1 atendente humano',
      '1.500 mensagens de IA por mês',
      '200 disparos por mês',
      'CRM com 1.000 contatos',
      '3 fluxos no Maestro',
      '1 WhatsApp + 1 Instagram',
      'Analytics, Qualidade da IA e Voz de entrada inclusos',
    ],
  },
  GROWTH: {
    id: 'GROWTH',
    nome: 'Growth',
    preco: 'R$ 497/mês (anual R$ 397,60/mês)',
    essencia: 'O mais escolhido. Equipe de atendimento com IA, copiloto, API e agendamento incluídos.',
    incluso: [
      '10 atendentes',
      '8.000 mensagens de IA por mês',
      '5.000 disparos por mês',
      'CRM com 10.000 contatos',
      '15 fluxos no Maestro',
      '2 números de WhatsApp',
      'Echo Copilot, Agendamento pela IA, API e 15 integrações nativas',
    ],
  },
  SCALE: {
    id: 'SCALE',
    nome: 'Scale',
    preco: 'R$ 1.497/mês (anual R$ 1.197,60/mês)',
    essencia: 'Operação séria com SLA contratual, observabilidade executiva e governança madura.',
    incluso: [
      '75 atendentes',
      '80.000 mensagens de IA por mês',
      '60.000 disparos por mês',
      'CRM com 200.000 contatos',
      'Fluxos ilimitados e 15 números',
      'Radar 360 incluído, SLA 99,9% com créditos, SSO',
      'CSM dedicado e integrações ilimitadas',
    ],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    nome: 'Enterprise',
    preco: 'Sob consulta',
    essencia: 'Contrato sob medida com infraestrutura isolada, SOC/NOC dedicado e governança completa.',
    incluso: [
      'Tudo ilimitado (atendentes, mensagens, disparos, contatos, números)',
      'Infraestrutura isolada e SOC/NOC 24/7',
      'Onboarding white-glove e QBR trimestral',
      'Retenção de logs até 5 anos',
      '40h/mês de integração customizada',
    ],
  },
};

/* ── Produtos (para o relatório: o que atende cada objetivo) ── */
export interface ProdutoInfo {
  id: string;
  nome: string;
  caracteristica: string;
  casoUso: string; // usa {seg} como marcador do segmento
}

export const PRODUTOS: Record<string, ProdutoInfo> = {
  iza: {
    id: 'iza',
    nome: 'Iza e Conversas',
    caracteristica: 'O agente de IA que atende 24 horas em texto e áudio, num inbox único de WhatsApp e Instagram, e chama o humano só no que importa.',
    casoUso: 'Em {seg}, a Iza responde na hora, resolve o grosso sozinha e nunca deixa um cliente sem resposta à noite ou no fim de semana.',
  },
  crm: {
    id: 'crm',
    nome: 'CRM',
    caracteristica: 'O CRM que se preenche sozinho a cada conversa: contato, funil e lead score sem digitação, com a receita atribuída à IA.',
    casoUso: 'Em {seg}, cada conversa vira um contato organizado e um follow-up na sua mesa, sem ninguém alimentar planilha.',
  },
  impulso: {
    id: 'impulso',
    nome: 'Zap Impulso',
    caracteristica: 'Você escreve o objetivo em português e a IA monta a campanha inteira, dispara pela API oficial e quem responde cai no atendimento da Iza.',
    casoUso: 'Em {seg}, reativar quem parou de comprar vira uma frase, e a base parada volta a gerar venda.',
  },
  agenda: {
    id: 'agenda',
    nome: 'Agenda',
    caracteristica: 'A IA marca, remarca e cancela dentro da conversa, checando o horário real, sem alucinar agenda.',
    casoUso: 'Em {seg}, a agenda enche sozinha e o no-show cai, sem ida e volta manual para marcar horário.',
  },
  maestro: {
    id: 'maestro',
    nome: 'Maestro',
    caracteristica: 'A IA monta o fluxo de atendimento a partir do seu negócio. Você vê no canvas, ajusta e aprova. Sem consultor.',
    casoUso: 'Em {seg}, você sai do zero ao fluxo pronto numa tarde, no seu jeito de atender.',
  },
  analytics: {
    id: 'analytics',
    nome: 'Analytics e Radar 360',
    caracteristica: 'A operação medida e narrada todo dia sobre fatos, com custo de IA transparente e vendas atribuídas à Iza.',
    casoUso: 'Em {seg}, você vê o que aconteceu e o que fazer sem depender de um analista de BI.',
  },
  qualidade: {
    id: 'qualidade',
    nome: 'Qualidade da IA',
    caracteristica: 'A plataforma testa a Iza, detecta desvio, sugere a correção, você aprova e ela comprova em minutos, com trilha de auditoria.',
    casoUso: 'Em {seg}, você tem a segurança de que a IA não vai fugir do script na frente do cliente.',
  },
  voz: {
    id: 'voz',
    nome: 'Voz Nativa',
    caracteristica: 'A Iza entende o áudio do cliente e responde por voz natural em português, do jeito que o brasileiro usa o WhatsApp.',
    casoUso: 'Em {seg}, o cliente que só manda áudio é atendido na mesma língua, sem fricção.',
  },
};
