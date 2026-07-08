/**
 * impulsoPlansContent — fonte única do conteúdo descritivo do Zap Impulso e dos
 * 3 planos (Start/Pro/Scale). Usado pelo "Saiba mais" (ImpulsoPlanDetailModal)
 * e mantido em sincronia com o documento de gestão (.doc) da solução.
 */

export type PlanKey = 'IMPULSO_START' | 'IMPULSO_PRO' | 'IMPULSO_SCALE';

export const ZAP_IMPULSO_INTRO = {
  title: 'O que é o Zap Impulso',
  paragraphs: [
    'O Zap Impulso é o módulo de vendas proativas da ZappIQ. Em vez de só esperar o cliente chamar, a Iza (a IA da ZappIQ) cria, dispara e acompanha campanhas de ponta a ponta pelos seus canais: WhatsApp, e-mail, SMS e, quando a conta tem Instagram conectado, também o Instagram Direct.',
    'Você descreve o objetivo em uma frase (por exemplo, "reativar quem comprou e sumiu há 30 dias com 15% de desconto") e a Iza monta a campanha inteira: o público segmentado da sua base, a mensagem na voz da sua marca, o melhor horário, a verba sugerida e a estimativa de resultado. Você revisa, ajusta o texto se quiser e aprova.',
    'Depois do disparo, o Copiloto acompanha os números de cada campanha e sugere o que ajustar para bater a meta. Tudo respeitando o consentimento de marketing dos contatos (LGPD) e as políticas da Meta.',
  ],
  pillars: [
    { name: 'Iza Estrategista', desc: 'Objetivo em linguagem natural vira campanha completa, pronta para aprovar.' },
    { name: 'Disparo omnichannel', desc: 'Envio para a sua base por WhatsApp, e-mail e SMS (e Instagram, se conectado).' },
    { name: 'Copiloto & Coach', desc: 'A Iza acompanha os resultados e orienta o que e o quanto operar.' },
    { name: 'Loop de Performance', desc: 'Anúncios trazem o lead para a conversa e a venda volta para otimizar a mídia.' },
    { name: 'Auto-otimização', desc: 'A Iza testa variações e concentra o volume na que mais vende, sozinha.' },
  ],
};

export interface PlanContent {
  key: PlanKey;
  name: string;
  price: number;
  tagline: string;
  forWho: string;
  active: string[];
  limits: string[];
  scenario: { title: string; text: string };
}

export const PLAN_CONTENT: Record<PlanKey, PlanContent> = {
  IMPULSO_START: {
    key: 'IMPULSO_START',
    name: 'Start',
    price: 197,
    tagline: 'Para começar a vender com a Iza.',
    forWho: 'Negócios que querem começar a vender de forma proativa pela própria base, sem mídia paga.',
    active: [
      'Iza Estrategista: descreva o objetivo e a Iza monta a campanha completa.',
      'Studio: edite manualmente a campanha e o texto da mensagem quando quiser.',
      'Disparo por WhatsApp, e-mail e SMS (Instagram Direct se a conta estiver conectada).',
      'Segmentação da base por tags, status do lead, pontuação, recência e mais.',
      'Copiloto & Coach: sugestões do que ajustar a cada campanha.',
      'IA de campanha inclusa (sem custo de LLM por campanha).',
    ],
    limits: [
      'Até 5.000 contatos ativos.',
      'Sem anúncios pagos (Meta, Google, TikTok) nem atribuição de receita de mídia.',
      '1 número de WhatsApp.',
      'Mensagens de marketing do WhatsApp cobradas por uso (custo da Meta repassado).',
    ],
    scenario: {
      title: 'Exemplo: loja de roupas reativando clientes',
      text: 'A loja quer trazer de volta quem comprou e sumiu. No Start, o dono diz à Iza "reativar quem comprou nos últimos 6 meses e não voltou, com 15% de desconto". A Iza monta o segmento (ex.: 1.200 contatos com opt-in de marketing), escreve a mensagem na voz da marca, sugere disparar na terça às 10h e envia pelo WhatsApp. No Coach, o dono acompanha entregues, respostas e quem voltou a comprar, e a Iza sugere o próximo passo.',
    },
  },
  IMPULSO_PRO: {
    key: 'IMPULSO_PRO',
    name: 'Pro',
    price: 497,
    tagline: 'Quem quer o loop de anúncios fechado.',
    forWho: 'Quem investe em mídia paga e quer ligar o anúncio à conversa e à venda medida, com a IA otimizando sozinha.',
    active: [
      'Tudo do Start.',
      'Anúncios Meta: Click-to-WhatsApp (CTWA), Lead Ads e CAPI (conversão de volta para o Meta).',
      'Atribuição de receita: liga a venda ao anúncio que a originou.',
      'Pix no chat: cobrança e pagamento dentro da conversa.',
      'Auto-otimização: a Iza testa variações da campanha e concentra a verba na que mais vende.',
      'TikTok: Instant Messaging Ads levando o lead para o WhatsApp.',
    ],
    limits: [
      'Até 25.000 contatos.',
      'Sem Google Ads nem conversões offline (venda na loja física).',
      'Sem autopiloto total nem múltiplos números de WhatsApp.',
    ],
    scenario: {
      title: 'Exemplo: infoproduto fechando o loop de anúncios',
      text: 'Um infoprodutor roda anúncio no Instagram/Facebook com botão "Enviar mensagem". O lead cai no WhatsApp, a Iza qualifica e conduz a venda com Pix no chat. A CAPI devolve a conversão ao Meta, que passa a otimizar por quem COMPRA (não só por quem clica), baixando o custo por venda. Em paralelo, a Iza testa três variações de copy e concentra a verba na que mais converte.',
    },
  },
  IMPULSO_SCALE: {
    key: 'IMPULSO_SCALE',
    name: 'Scale',
    price: 997,
    tagline: 'Operação de performance com verba.',
    forWho: 'Operações que já investem em mídia com volume e querem múltiplos canais, autonomia e escala.',
    active: [
      'Tudo do Pro.',
      'Google Ads + conversões offline (venda fora do digital sobe para otimizar a mídia).',
      'Autopiloto: a Iza opera em nível de autonomia mais alto, com governança.',
      'Múltiplos números de WhatsApp (ex.: uma unidade/loja por número).',
      'Contatos ilimitados.',
    ],
    limits: [
      'Sem limite de contatos.',
      'Indicado para quem já tem verba de mídia recorrente (o valor do plano é o software; a mídia é à parte).',
    ],
    scenario: {
      title: 'Exemplo: rede com várias unidades',
      text: 'Uma rede com várias lojas investe em Meta e Google. No Scale, cada unidade tem seu próprio número de WhatsApp, a Iza roda campanhas em autopiloto respeitando as regras definidas, sobe as conversões offline (vendas na loja física) para Meta e Google otimizarem, e consolida a atribuição de receita por canal e por unidade num só painel.',
    },
  },
};

/**
 * Comparativo entre os 3 planos. value: true = incluso, false = não incluso,
 * string = valor específico (ex.: limite). O detalhe destaca a coluna do plano.
 */
export interface CompareRow {
  label: string;
  start: boolean | string;
  pro: boolean | string;
  scale: boolean | string;
}

export const PLAN_COMPARISON: CompareRow[] = [
  { label: 'Iza Estrategista + Studio', start: true, pro: true, scale: true },
  { label: 'WhatsApp + e-mail + SMS', start: true, pro: true, scale: true },
  { label: 'Instagram Direct (se a conta tiver Instagram conectado)', start: true, pro: true, scale: true },
  { label: 'Copiloto & Coach', start: true, pro: true, scale: true },
  { label: 'Contatos ativos', start: '5.000', pro: '25.000', scale: 'Ilimitado' },
  { label: 'Anúncios Meta (CTWA, Lead Ads, CAPI)', start: false, pro: true, scale: true },
  { label: 'Atribuição de receita + Pix no chat', start: false, pro: true, scale: true },
  { label: 'Auto-otimização (a IA testa e escala sozinha)', start: false, pro: true, scale: true },
  { label: 'TikTok (Ads levando ao WhatsApp)', start: false, pro: true, scale: true },
  { label: 'Google Ads + conversões offline', start: false, pro: false, scale: true },
  { label: 'Autopiloto + múltiplos números', start: false, pro: false, scale: true },
];

export const PLAN_ORDER: PlanKey[] = ['IMPULSO_START', 'IMPULSO_PRO', 'IMPULSO_SCALE'];
