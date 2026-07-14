/**
 * impulsoPlansContent — fonte única do conteúdo descritivo do Zap Impulso e dos
 * planos (Start/Pro/Scale + Enterprise). Usado pelo "Saiba mais"
 * (ImpulsoPlanDetailModal) e mantido em sincronia com o documento de gestão (.doc).
 *
 * Empacotamento por PERFIL de cliente (2026): Start = base própria sem mídia paga;
 * Pro = quem investe em mídia e quer o loop de receita; Scale = operação/rede em
 * autopiloto. Preços de software; mensagens de marketing do WhatsApp são cobradas
 * por uso (franquia por tier + excedente por disparo). Anual com 20% de desconto.
 */

export type PlanKey = 'IMPULSO_START' | 'IMPULSO_PRO' | 'IMPULSO_SCALE';

export const ANNUAL_DISCOUNT = 0.2; // 20% no plano anual

export const ZAP_IMPULSO_INTRO = {
  title: 'O que é o Zap Impulso',
  paragraphs: [
    'O Zap Impulso é o módulo de vendas proativas da ZappIQ. Em vez de só esperar o cliente chamar, a IA do seu negócio cria, dispara e acompanha campanhas de ponta a ponta pelos seus canais: WhatsApp, e-mail, SMS e, quando a conta tem Instagram conectado, também o Instagram Direct.',
    'Você descreve o objetivo em uma frase e a IA monta a campanha inteira: público segmentado da sua base, mensagem na voz da marca, melhor horário, verba sugerida e estimativa de resultado. Você revisa, edita o texto se quiser e aprova.',
    'A diferença do Zap Impulso está em fechar o ciclo com o seu CRM: a venda que acontece na conversa volta para otimizar a mídia (anúncio → conversa → venda → verba), e a IA aprende com o resultado real para vender mais. Tudo respeitando o consentimento de marketing (LGPD) e as políticas da Meta.',
  ],
  pillars: [
    { name: 'IA Estrategista', desc: 'Objetivo em linguagem natural vira campanha completa, pronta para aprovar.' },
    { name: 'Disparo omnichannel', desc: 'WhatsApp, e-mail e SMS (e Instagram, se conectado), a partir da sua base.' },
    { name: 'Copiloto & Coach', desc: 'A IA acompanha os resultados e orienta o que e o quanto operar.' },
    { name: 'Loop de Receita', desc: 'Anúncio traz o lead à conversa e a venda volta ao CRM e à mídia para otimizar a verba.' },
    { name: 'Autopiloto com governança', desc: 'A IA opera dentro de metas, orçamento e limites que você define.' },
  ],
};

export interface PlanContent {
  key: PlanKey;
  name: string;
  price: number; // mensal, no plano mensal
  priceAnnualMonthly: number; // equivalente mensal no plano anual (-20%)
  tagline: string;
  forWho: string;
  active: string[];
  limits: string[];
  scenario: { title: string; text: string };
}

const annual = (m: number) => Math.round((m * (1 - ANNUAL_DISCOUNT)) / 1) ;

export const PLAN_CONTENT: Record<PlanKey, PlanContent> = {
  IMPULSO_START: {
    key: 'IMPULSO_START',
    name: 'Start',
    price: 197,
    priceAnnualMonthly: annual(197),
    tagline: 'Comece a vender pela sua base, sem depender de anúncio.',
    forWho: 'Micro e pequenas empresas que querem vender de forma proativa para a própria carteira de clientes, ainda sem verba de mídia paga.',
    active: [
      'IA Estrategista: descreva o objetivo e a IA monta a campanha completa.',
      'Studio: edite a campanha e o texto da mensagem quando quiser.',
      'Disparo por WhatsApp, e-mail e SMS (Instagram Direct se a conta estiver conectada).',
      'Segmentação da base por tags, status do lead, pontuação, recência e mais.',
      'CRM nativo da ZappIQ integrado às campanhas.',
      'Copiloto & Coach: sugestões do que ajustar a cada campanha.',
      '3 playbooks de venda de 1 clique: reativação, pós-venda e aniversário.',
    ],
    limits: [
      'Até 5.000 contatos ativos.',
      '1.000 disparos de campanha por mês inclusos (excedente por disparo).',
      '1 número de WhatsApp.',
      'Sem mídia paga (Meta/Google/TikTok), atribuição de receita ou audiências preditivas.',
    ],
    scenario: {
      title: 'Exemplo: salão de beleza reativando clientes',
      text: 'O salão quer trazer de volta quem não remarca há 60 dias. No Start, a dona pede para a IA "reativar quem não volta há 2 meses com 15% no primeiro horário". A IA monta o segmento a partir da base, escreve a mensagem, sugere disparar na terça de manhã e envia pelo WhatsApp. No Coach, ela acompanha quantas remarcaram e sugere o próximo passo.',
    },
  },
  IMPULSO_PRO: {
    key: 'IMPULSO_PRO',
    name: 'Pro',
    price: 597,
    priceAnnualMonthly: annual(597),
    tagline: 'Feche o loop entre anúncio, conversa e venda.',
    forWho: 'PMEs que investem em mídia paga (Meta/TikTok) e querem saber qual anúncio deu venda de verdade, com a IA otimizando a verba sozinha.',
    active: [
      'Tudo do Start, com todos os playbooks de venda.',
      'Loop de Receita: anúncios Meta (Click-to-WhatsApp, Lead Ads) + Conversions API mandando a venda de volta ao Meta.',
      'Atribuição de receita: liga cada venda ao anúncio e à conversa que a originou.',
      'Audiências preditivas por IA: propensão a comprar, churn e LTV alimentam a segmentação.',
      'Auto-otimização: a IA testa variações e concentra a verba na que mais vende.',
      'TikTok: Instant Messaging Ads levando o lead ao WhatsApp.',
      'Conector com 1 CRM do cliente (HubSpot, RD Station ou Pipedrive).',
    ],
    limits: [
      'Até 25.000 contatos ativos.',
      '5.000 disparos de campanha por mês inclusos (excedente por disparo).',
      'Sem autopiloto total, Google Ads/conversões offline nem múltiplos números.',
    ],
    scenario: {
      title: 'Exemplo: infoproduto fechando o loop de anúncios',
      text: 'Um infoprodutor roda anúncio com botão "Enviar mensagem". O lead cai no WhatsApp, a IA qualifica e conduz a venda; quando a venda entra no CRM, a Conversions API a devolve ao Meta, que passa a mirar quem COMPRA (não só quem clica), baixando o custo por venda. Em paralelo, a IA testa três variações de copy e concentra a verba na que mais converte.',
    },
  },
  IMPULSO_SCALE: {
    key: 'IMPULSO_SCALE',
    name: 'Scale',
    price: 1297,
    priceAnnualMonthly: annual(1297),
    tagline: 'Operação de performance no autopiloto.',
    forWho: 'Redes e operações com verba e volume, múltiplas unidades ou números, que querem a IA operando sozinha dentro de trilhos.',
    active: [
      'Tudo do Pro.',
      'Autopiloto com governança: a IA decide o que, quando e quanto operar dentro de metas, orçamento e limites que você define.',
      'Conector com múltiplos CRMs do cliente (HubSpot, RD Station, Pipedrive, Salesforce).',
      'Google Ads + conversões offline (venda na loja física otimiza a mídia).',
      'Múltiplos números de WhatsApp (ex.: um por unidade/loja).',
      'Painel de ROI consolidado por campanha, canal e unidade.',
    ],
    limits: [
      'Contatos ilimitados.',
      '20.000 disparos de campanha por mês inclusos (excedente por disparo).',
      'Indicado para quem já investe em mídia recorrente (o valor do plano é o software; a mídia é à parte).',
    ],
    scenario: {
      title: 'Exemplo: rede com várias unidades',
      text: 'Uma rede com 8 lojas investe em Meta e Google. No Scale, cada unidade tem seu número, a IA roda em autopiloto respeitando as regras definidas, sobe as vendas de loja física (offline) para Meta e Google otimizarem, e consolida a atribuição de receita por canal e por unidade num só painel.',
    },
  },
};

/** Enterprise é sob consulta (redes/franquias com volume dedicado). Não tem "Saiba mais" próprio. */
export const ENTERPRISE = {
  name: 'Enterprise',
  tagline: 'Para redes e franquias com volume dedicado.',
  bullets: [
    'Tudo do Scale, com volume de disparos e contatos dedicados.',
    'SLA, onboarding assistido e gestor de conta.',
    'Integrações sob medida e faturamento consolidado.',
  ],
};

export interface CompareRow {
  label: string;
  start: boolean | string;
  pro: boolean | string;
  scale: boolean | string;
}

export const PLAN_COMPARISON: CompareRow[] = [
  { label: 'IA Estrategista + Studio + Coach', start: true, pro: true, scale: true },
  { label: 'WhatsApp + e-mail + SMS (+ Instagram se conectado)', start: true, pro: true, scale: true },
  { label: 'CRM nativo ZappIQ + segmentação', start: true, pro: true, scale: true },
  { label: 'Playbooks de venda de 1 clique', start: '3 básicos', pro: 'Todos', scale: 'Todos' },
  { label: 'Loop de Receita (CTWA + CAPI + atribuição)', start: false, pro: true, scale: true },
  { label: 'Audiências preditivas por IA', start: false, pro: true, scale: true },
  { label: 'Auto-otimização + TikTok', start: false, pro: true, scale: true },
  { label: 'Conector com CRM do cliente', start: false, pro: '1 CRM', scale: 'Múltiplos' },
  { label: 'Autopiloto com governança', start: false, pro: false, scale: true },
  { label: 'Google Ads + conversões offline', start: false, pro: false, scale: true },
  { label: 'Múltiplos números de WhatsApp', start: false, pro: false, scale: true },
  { label: 'Contatos ativos', start: '5.000', pro: '25.000', scale: 'Ilimitado' },
  { label: 'Disparos/mês inclusos', start: '1.000', pro: '5.000', scale: '20.000' },
  { label: 'Preço mensal', start: 'R$ 197', pro: 'R$ 597', scale: 'R$ 1.297' },
];

export const PLAN_ORDER: PlanKey[] = ['IMPULSO_START', 'IMPULSO_PRO', 'IMPULSO_SCALE'];
