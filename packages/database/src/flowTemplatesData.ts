/**
 * FLOW_TEMPLATES_DATA — fonte unica dos 15 templates Maestro V1.
 *
 * Usado por:
 *   - packages/database/prisma/seeds/flowTemplates.ts (seed manual)
 *   - apps/api/src/bootstrap/seedFlowTemplates.ts (bootstrap startup)
 *
 * Sem prisma calls aqui — so a estrutura de dados.
 */

import type { FlowTemplateVertical, FlowTemplateCategory, FlowTriggerType } from '@prisma/client';

export interface FlowTemplateSeed {
  name: string;
  description: string;
  vertical: FlowTemplateVertical;
  category: FlowTemplateCategory;
  nodes: any[];
  edges: any[];
  triggerType: FlowTriggerType;
  order: number;
  isActive: boolean;
}

function n(id: string, type: string, x: number, y: number, label: string, extra: Record<string, any> = {}) {
  return { id, type, position: { x, y }, data: { label, ...extra } };
}
function e(source: string, target: string, label?: string) {
  return { id: `e-${source}-${target}`, source, target, ...(label ? { label } : {}) };
}
function T(
  v: FlowTemplateVertical,
  c: FlowTemplateCategory,
  name: string,
  description: string,
  nodes: any[],
  edges: any[],
  triggerType: FlowTriggerType,
  order: number
): FlowTemplateSeed {
  return { name, description, vertical: v, category: c, nodes, edges, triggerType, order, isActive: true };
}

export const FLOW_TEMPLATES_DATA: FlowTemplateSeed[] = [
  // ═══ DENTISTA ═══
  T('DENTISTA', 'BOAS_VINDAS_QUALIFICACAO',
    'Dentista — Boas-vindas + Qualificacao',
    'Recebe lead novo, apresenta a clinica, qualifica intencao (avaliacao, urgencia, estetica, ortodontia) e direciona pra proxima acao.',
    [
      n('1', 'input', 100, 100, 'Lead chegou'),
      n('2', 'message', 100, 200, 'Saudacao', { message: 'Oi! Sou a Iza da Clinica X. Como posso ajudar?' }),
      n('3', 'ai_node', 100, 320, 'Iza qualifica', { intent: 'identificar tipo de demanda (avaliacao, urgencia, estetica, ortodontia)' }),
      n('4', 'condition', 100, 460, 'Tipo de demanda?'),
      n('5a', 'message', 0, 600, 'Avaliacao', { message: 'Avaliacao gratuita disponivel. Posso agendar?' }),
      n('5b', 'message', 200, 600, 'Urgencia', { message: 'Entendi a urgencia. Temos hora hoje as 14h ou 16h. Qual prefere?' }),
      n('6', 'action', 100, 740, 'Marcar lead score', { action: 'update_lead_score', score: 60 }),
      n('7', 'human_handoff', 100, 880, 'Passa pra recepcao'),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5a','avaliacao'), e('4','5b','urgencia'), e('5a','6'), e('5b','6'), e('6','7') ],
    'FIRST_CONTACT', 1),

  T('DENTISTA', 'AGENDAMENTO_RECUPERACAO',
    'Dentista — Agendamento + Recuperacao 24h',
    'Cliente nao retornou apos 24h da primeira conversa. Iza dispara follow-up oferecendo agendar com lembrete de horario livre.',
    [
      n('1', 'input', 100, 100, 'Inativo 24h'),
      n('2', 'message', 100, 220, 'Lembrete', { message: 'Oi! Vi que voce tinha interesse em avaliacao. Ainda quer agendar?' }),
      n('3', 'ai_node', 100, 360, 'Iza ouve resposta', { intent: 'aceita ou recusa agendamento' }),
      n('4', 'condition', 100, 500, 'Aceitou?'),
      n('5a', 'action', 0, 640, 'Agenda Google', { action: 'create_calendar_event' }),
      n('5b', 'action', 200, 640, 'Salva nao interessado', { action: 'update_lead_status', status: 'NOT_INTERESTED' }),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5a','sim'), e('4','5b','nao') ],
    'TIMEOUT_24H', 2),

  T('DENTISTA', 'NPS_POS_VENDA',
    'Dentista — NPS pos-consulta',
    'Apos consulta finalizada, manda NPS 1-10. Promotores (>=9) recebem pedido de review Google; detratores ganham contato humano.',
    [
      n('1', 'input', 100, 100, 'Consulta finalizada'),
      n('2', 'message', 100, 220, 'NPS', { message: 'Como foi sua experiencia hoje? De 0 a 10' }),
      n('3', 'ai_node', 100, 360, 'Coleta nota', { intent: 'extrair nota NPS 0-10' }),
      n('4', 'condition', 100, 500, 'Nota >= 9?'),
      n('5a', 'message', 0, 640, 'Promotor', { message: 'Que otimo! Deixaria review aqui? <link Google>' }),
      n('5b', 'message', 200, 640, 'Detrator/Neutro', { message: 'Obrigada! Posso te ajudar com algo?' }),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5a','promotor'), e('4','5b','detrator') ],
    'CUSTOM', 3),

  // ═══ SALAO BELEZA ═══
  T('SALAO_BELEZA', 'BOAS_VINDAS_QUALIFICACAO',
    'Salao — Boas-vindas + Qualificacao',
    'Recebe lead, apresenta servicos (corte/coloracao/escova/manicure), qualifica preferencia de profissional e horario.',
    [
      n('1', 'input', 100, 100, 'Lead chegou'),
      n('2', 'message', 100, 220, 'Saudacao', { message: 'Oi! Sou a Iza do Salao X.' }),
      n('3', 'ai_node', 100, 360, 'Qualifica servico', { intent: 'corte, coloracao, escova, manicure' }),
      n('4', 'condition', 100, 500, 'Profissional preferida?'),
      n('5', 'message', 100, 640, 'Apresenta agenda', { message: 'Temos horarios essa semana. Qual dia prefere?' }),
      n('6', 'human_handoff', 100, 780, 'Recepcao confirma'),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5'), e('5','6') ],
    'FIRST_CONTACT', 4),

  T('SALAO_BELEZA', 'AGENDAMENTO_RECUPERACAO',
    'Salao — Recuperacao 48h',
    'Cliente que nao agendou em 48h recebe oferta com 10% off no primeiro corte.',
    [
      n('1', 'input', 100, 100, 'Inativo 48h'),
      n('2', 'message', 100, 220, 'Oferta', { message: 'Saudades! 10% off no seu primeiro corte essa semana' }),
      n('3', 'ai_node', 100, 360, 'Iza confirma', { intent: 'aceita oferta?' }),
      n('4', 'action', 100, 500, 'Aplica cupom', { action: 'create_coupon', discount: 10 }),
      n('5', 'human_handoff', 100, 640, 'Agendamento humano'),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5') ],
    'TIMEOUT_48H', 5),

  T('SALAO_BELEZA', 'NPS_POS_VENDA',
    'Salao — NPS pos-servico',
    'Apos servico, manda NPS + pede foto resultado pra Instagram (com permissao). Detratores ganham contato pessoal.',
    [
      n('1', 'input', 100, 100, 'Servico finalizado'),
      n('2', 'message', 100, 220, 'NPS', { message: 'Curtiu o resultado? De 0 a 10' }),
      n('3', 'ai_node', 100, 360, 'Coleta nota'),
      n('4', 'condition', 100, 500, 'Nota >= 9?'),
      n('5a', 'message', 0, 640, 'Pede foto', { message: 'Adorei! Posso compartilhar foto no Insta marcando voce?' }),
      n('5b', 'message', 200, 640, 'Detrator', { message: 'Posso te chamar pra entender melhor?' }),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5a','promotor'), e('4','5b','detrator') ],
    'CUSTOM', 6),

  // ═══ ACADEMIA ═══
  T('ACADEMIA', 'BOAS_VINDAS_QUALIFICACAO',
    'Academia — Boas-vindas + Aula experimental',
    'Lead novo recebe oferta de aula experimental gratis + qualifica objetivo (emagrecimento, hipertrofia, condicionamento).',
    [
      n('1', 'input', 100, 100, 'Lead chegou'),
      n('2', 'message', 100, 220, 'Saudacao', { message: 'Oi! Aqui e a Iza da Academia X. Aula experimental gratuita pra voce!' }),
      n('3', 'ai_node', 100, 360, 'Qualifica objetivo', { intent: 'emagrecimento, hipertrofia, condicionamento, outro' }),
      n('4', 'message', 100, 500, 'Pede dia/horario', { message: 'Qual dia e horario voce prefere pra fazer a experimental?' }),
      n('5', 'action', 100, 640, 'Agenda experimental'),
      n('6', 'human_handoff', 100, 780, 'Recepcao confirma'),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5'), e('5','6') ],
    'FIRST_CONTACT', 7),

  T('ACADEMIA', 'AGENDAMENTO_RECUPERACAO',
    'Academia — Recuperacao membro inativo 14d',
    'Membro que parou de frequentar ha 14 dias recebe mensagem motivacional + oferta de 1 sessao gratis com personal trainer.',
    [
      n('1', 'input', 100, 100, 'Inativo 14d'),
      n('2', 'message', 100, 220, 'Motivacao', { message: 'Tudo bem? Vimos que voce nao tem vindo. Posso te ajudar a voltar?' }),
      n('3', 'ai_node', 100, 360, 'Detecta motivo', { intent: 'preguica, falta de tempo, dor, sem motivacao' }),
      n('4', 'message', 100, 500, 'Oferece PT gratis', { message: 'Que tal 1 sessao gratis com personal pra retomar? Eu agendo' }),
      n('5', 'action', 100, 640, 'Agenda PT'),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5') ],
    'TIMEOUT_14D', 8),

  T('ACADEMIA', 'NPS_POS_VENDA',
    'Academia — NPS mensal',
    'Mensalmente, manda NPS pra membros ativos + pergunta sugestao melhoria. Alimenta cohort de retencao.',
    [
      n('1', 'input', 100, 100, 'Cron mensal'),
      n('2', 'message', 100, 220, 'NPS', { message: 'Como foi seu mes? De 0 a 10' }),
      n('3', 'ai_node', 100, 360, 'Coleta nota + sugestao', { intent: 'extrair NPS + sugestao' }),
      n('4', 'action', 100, 500, 'Salva resposta', { action: 'save_nps_response' }),
    ],
    [ e('1','2'), e('2','3'), e('3','4') ],
    'CUSTOM', 9),

  // ═══ PETSHOP ═══
  T('PETSHOP', 'BOAS_VINDAS_QUALIFICACAO',
    'Petshop — Boas-vindas + Cadastro do pet',
    'Lead novo, pergunta nome do tutor + nome do pet + raca + idade pra cadastrar e personalizar futuras conversas.',
    [
      n('1', 'input', 100, 100, 'Lead chegou'),
      n('2', 'message', 100, 220, 'Saudacao', { message: 'Oi! Sou a Iza do Petshop X. Qual o nome do seu pet?' }),
      n('3', 'ai_node', 100, 360, 'Coleta nome+raca+idade', { intent: 'extrair dados do pet' }),
      n('4', 'action', 100, 500, 'Cadastra pet', { action: 'create_contact_with_pet' }),
      n('5', 'message', 100, 640, 'Oferta primeira visita', { message: 'Que fofo! Banho+tosa com 15% off pra primeira visita?' }),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5') ],
    'FIRST_CONTACT', 10),

  T('PETSHOP', 'AGENDAMENTO_RECUPERACAO',
    'Petshop — Reagendamento banho mensal',
    'Cliente que fez banho ha 30 dias recebe lembrete + oferta de reagendar com o mesmo profissional.',
    [
      n('1', 'input', 100, 100, 'Cron 30d apos banho'),
      n('2', 'message', 100, 220, 'Lembrete', { message: 'Hora do banho mensal do {nome_pet}? Posso agendar' }),
      n('3', 'ai_node', 100, 360, 'Iza confirma'),
      n('4', 'action', 100, 500, 'Agenda banho'),
    ],
    [ e('1','2'), e('2','3'), e('3','4') ],
    'TIMEOUT_30D', 11),

  T('PETSHOP', 'NPS_POS_VENDA',
    'Petshop — NPS apos servico',
    'Manda foto + NPS apos banho/tosa. Promotores ganham 5% off na proxima visita.',
    [
      n('1', 'input', 100, 100, 'Banho finalizado'),
      n('2', 'message', 100, 220, 'Manda foto + NPS', { message: 'Olha como ficou! De 0 a 10, gostou?' }),
      n('3', 'ai_node', 100, 360, 'Coleta nota'),
      n('4', 'condition', 100, 500, 'Nota >= 9?'),
      n('5', 'action', 100, 640, 'Aplica cupom 5%', { action: 'create_coupon', discount: 5 }),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5','promotor') ],
    'CUSTOM', 12),

  // ═══ ECOMMERCE MODA ═══
  T('ECOMMERCE_MODA', 'BOAS_VINDAS_QUALIFICACAO',
    'E-com Moda — Boas-vindas + Cupom primeira compra',
    'Lead novo recebe boas-vindas + cupom 10% off primeira compra + pergunta estilo (casual/festa/trabalho) pra recomendar pecas.',
    [
      n('1', 'input', 100, 100, 'Lead chegou'),
      n('2', 'message', 100, 220, 'Cupom', { message: 'Bem-vinda! Cupom PRIMEIRA10 pra 10% off' }),
      n('3', 'ai_node', 100, 360, 'Qualifica estilo', { intent: 'casual, festa, trabalho, outro' }),
      n('4', 'message', 100, 500, 'Recomendacao', { message: 'Olha umas pecas que combinam com seu estilo! <link catalogo>' }),
    ],
    [ e('1','2'), e('2','3'), e('3','4') ],
    'FIRST_CONTACT', 13),

  T('ECOMMERCE_MODA', 'AGENDAMENTO_RECUPERACAO',
    'E-com Moda — Recuperacao carrinho abandonado 2h',
    'Cliente colocou produto no carrinho mas nao finalizou em 2h. Iza dispara com oferta de frete gratis.',
    [
      n('1', 'input', 100, 100, 'Carrinho abandonado 2h'),
      n('2', 'message', 100, 220, 'Carrinho', { message: 'Vi que voce ficou interessada em {produto}. Frete gratis se finalizar hoje!' }),
      n('3', 'ai_node', 100, 360, 'Iza ouve'),
      n('4', 'condition', 100, 500, 'Aceita?'),
      n('5', 'message', 100, 640, 'Link checkout', { message: 'Aqui o link: {checkout_url}?coupon=FRETE_GRATIS' }),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5','sim') ],
    'CART_ABANDONED', 14),

  T('ECOMMERCE_MODA', 'NPS_POS_VENDA',
    'E-com Moda — NPS pos-entrega',
    'Apos confirmacao de entrega (rastreio mostrado como ENTREGUE), manda NPS + pede foto pra Insta.',
    [
      n('1', 'input', 100, 100, 'Pedido entregue'),
      n('2', 'message', 100, 220, 'Chegou?', { message: 'Chegou! De 0 a 10, gostou?' }),
      n('3', 'ai_node', 100, 360, 'Coleta nota'),
      n('4', 'condition', 100, 500, 'Nota >= 9?'),
      n('5', 'message', 100, 640, 'Pede foto', { message: 'Que bom! Manda foto vestida pra eu repostar no Insta marcando voce?' }),
    ],
    [ e('1','2'), e('2','3'), e('3','4'), e('4','5','promotor') ],
    'CUSTOM', 15),
];
