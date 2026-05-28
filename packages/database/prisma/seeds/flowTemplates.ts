/**
 * Seed de 15 templates Maestro V1 — 5 verticais × 3 jornadas
 *
 * Cada template tem 5-8 nodes simples + edges. Quando cliente clica "Usar",
 * endpoint POST /api/flows/templates/:id/duplicate copia nodes/edges
 * e cria novo Flow no org dele (substituindo organizationId).
 *
 * Estrutura de nó: { id, type, position, data: { label, message?, options?... } }
 * Estrutura de edge: { id, source, target, label? }
 *
 * Tipos de nó (compativeis com canvas Maestro existente):
 *   - input (trigger entrada)
 *   - message (envio simples)
 *   - ai_node (Iza responde com KB)
 *   - condition (branching)
 *   - action (CRM update, agendar)
 *   - human_handoff
 */

import { PrismaClient, FlowTemplateVertical, FlowTemplateCategory, FlowTriggerType } from '@prisma/client';

const prisma = new PrismaClient();

function makeNode(id: string, type: string, x: number, y: number, label: string, extra: Record<string, any> = {}) {
  return { id, type, position: { x, y }, data: { label, ...extra } };
}
function makeEdge(source: string, target: string, label?: string) {
  return { id: `e-${source}-${target}`, source, target, ...(label ? { label } : {}) };
}

const T = (v: FlowTemplateVertical, c: FlowTemplateCategory, name: string, description: string, nodes: any[], edges: any[], triggerType: FlowTriggerType, order: number) => ({
  name, description, vertical: v, category: c, nodes, edges, triggerType, order, isActive: true,
});

// ─── 5 verticais × 3 categorias = 15 templates ──────────────────────────────

const templates = [
  // ═══ DENTISTA ═══
  T('DENTISTA', 'BOAS_VINDAS_QUALIFICACAO',
    'Dentista — Boas-vindas + Qualificacao',
    'Recebe lead novo, apresenta a clinica, qualifica intencao (avaliacao, urgencia, estetica, ortodontia) e direciona pra proxima acao.',
    [
      makeNode('1', 'input', 100, 100, 'Lead chegou'),
      makeNode('2', 'message', 100, 200, 'Saudacao', { message: 'Oi! Sou a Iza da Clinica X 🦷 Como posso ajudar?' }),
      makeNode('3', 'ai_node', 100, 320, 'Iza qualifica', { intent: 'identificar tipo de demanda (avaliacao, urgencia, estetica, ortodontia)' }),
      makeNode('4', 'condition', 100, 460, 'Tipo de demanda?'),
      makeNode('5a', 'message', 0, 600, 'Avaliacao', { message: 'Avaliacao gratuita disponivel! Posso agendar?' }),
      makeNode('5b', 'message', 200, 600, 'Urgencia', { message: 'Entendi a urgencia. Temos hora hoje as 14h ou 16h. Qual prefere?' }),
      makeNode('6', 'action', 100, 740, 'Marcar lead score', { action: 'update_lead_score', score: 60 }),
      makeNode('7', 'human_handoff', 100, 880, 'Passa pra recepcao'),
    ],
    [
      makeEdge('1', '2'),
      makeEdge('2', '3'),
      makeEdge('3', '4'),
      makeEdge('4', '5a', 'avaliacao'),
      makeEdge('4', '5b', 'urgencia'),
      makeEdge('5a', '6'),
      makeEdge('5b', '6'),
      makeEdge('6', '7'),
    ],
    'FIRST_CONTACT', 1),

  T('DENTISTA', 'AGENDAMENTO_RECUPERACAO',
    'Dentista — Agendamento + Recuperacao 24h',
    'Cliente nao retornou apos 24h da primeira conversa. Iza dispara follow-up oferecendo agendar de novo com lembrete de horario livre.',
    [
      makeNode('1', 'input', 100, 100, 'Inativo 24h'),
      makeNode('2', 'message', 100, 220, 'Lembrete', { message: 'Oi! Vi que voce tinha interesse em avaliacao. Ainda quer agendar?' }),
      makeNode('3', 'ai_node', 100, 360, 'Iza ouve resposta', { intent: 'aceita ou recusa agendamento' }),
      makeNode('4', 'condition', 100, 500, 'Aceitou?'),
      makeNode('5a', 'action', 0, 640, 'Agenda Google', { action: 'create_calendar_event' }),
      makeNode('5b', 'action', 200, 640, 'Salva nao interessado', { action: 'update_lead_status', status: 'NOT_INTERESTED' }),
    ],
    [
      makeEdge('1', '2'),
      makeEdge('2', '3'),
      makeEdge('3', '4'),
      makeEdge('4', '5a', 'sim'),
      makeEdge('4', '5b', 'nao'),
    ],
    'TIMEOUT_24H', 2),

  T('DENTISTA', 'NPS_POS_VENDA',
    'Dentista — NPS pos-consulta',
    'Apos consulta finalizada, manda NPS 1-10 + pede review Google se nota >=9.',
    [
      makeNode('1', 'input', 100, 100, 'Consulta finalizada'),
      makeNode('2', 'message', 100, 220, 'NPS', { message: 'Como foi sua experiencia hoje? De 0 a 10' }),
      makeNode('3', 'ai_node', 100, 360, 'Coleta nota', { intent: 'extrair nota NPS 0-10' }),
      makeNode('4', 'condition', 100, 500, 'Nota >= 9?'),
      makeNode('5a', 'message', 0, 640, 'Promotor', { message: 'Que otimo! Deixaria review aqui? <link Google>' }),
      makeNode('5b', 'message', 200, 640, 'Detrator/Neutro', { message: 'Obrigada! Posso te ajudar com algo?' }),
    ],
    [
      makeEdge('1', '2'),
      makeEdge('2', '3'),
      makeEdge('3', '4'),
      makeEdge('4', '5a', 'promotor'),
      makeEdge('4', '5b', 'detrator'),
    ],
    'CUSTOM', 3),

  // ═══ SALAO BELEZA ═══
  T('SALAO_BELEZA', 'BOAS_VINDAS_QUALIFICACAO',
    'Salao — Boas-vindas + Qualificacao',
    'Recebe lead, apresenta servicos (corte/coloracao/escova/manicure), qualifica preferencia de profissional e horario.',
    [
      makeNode('1', 'input', 100, 100, 'Lead chegou'),
      makeNode('2', 'message', 100, 220, 'Saudacao', { message: 'Oi linda! Sou a Iza do Salao X ✨' }),
      makeNode('3', 'ai_node', 100, 360, 'Qualifica servico', { intent: 'corte, coloracao, escova, manicure' }),
      makeNode('4', 'condition', 100, 500, 'Profissional preferida?'),
      makeNode('5', 'message', 100, 640, 'Apresenta agenda', { message: 'Temos horarios essa semana! Qual dia prefere?' }),
      makeNode('6', 'human_handoff', 100, 780, 'Recepcao confirma'),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5'), makeEdge('5', '6')],
    'FIRST_CONTACT', 4),

  T('SALAO_BELEZA', 'AGENDAMENTO_RECUPERACAO',
    'Salao — Recuperacao 48h',
    'Cliente que nao agendou em 48h recebe oferta com 10% off no primeiro corte.',
    [
      makeNode('1', 'input', 100, 100, 'Inativo 48h'),
      makeNode('2', 'message', 100, 220, 'Oferta', { message: 'Saudades! 10% off no seu primeiro corte essa semana 💇' }),
      makeNode('3', 'ai_node', 100, 360, 'Iza confirma', { intent: 'aceita oferta?' }),
      makeNode('4', 'action', 100, 500, 'Aplica cupom', { action: 'create_coupon', discount: 10 }),
      makeNode('5', 'human_handoff', 100, 640, 'Agendamento humano'),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5')],
    'TIMEOUT_48H', 5),

  T('SALAO_BELEZA', 'NPS_POS_VENDA',
    'Salao — NPS pos-servico',
    'Apos servico, manda NPS + pede foto resultado pra Instagram (com permissao).',
    [
      makeNode('1', 'input', 100, 100, 'Servico finalizado'),
      makeNode('2', 'message', 100, 220, 'NPS', { message: 'Curtiu o resultado? De 0 a 10' }),
      makeNode('3', 'ai_node', 100, 360, 'Coleta nota'),
      makeNode('4', 'condition', 100, 500, 'Nota >= 9?'),
      makeNode('5a', 'message', 0, 640, 'Pede foto', { message: 'Adorei! Posso compartilhar foto no Insta marcando voce?' }),
      makeNode('5b', 'message', 200, 640, 'Detrator', { message: 'Posso te chamar pra entender melhor?' }),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5a', 'promotor'), makeEdge('4', '5b', 'detrator')],
    'CUSTOM', 6),

  // ═══ ACADEMIA ═══
  T('ACADEMIA', 'BOAS_VINDAS_QUALIFICACAO',
    'Academia — Boas-vindas + Aula experimental',
    'Lead novo recebe oferta de aula experimental gratis + qualifica objetivo (emagrecimento, hipertrofia, condicionamento).',
    [
      makeNode('1', 'input', 100, 100, 'Lead chegou'),
      makeNode('2', 'message', 100, 220, 'Saudacao', { message: 'Oi! Aqui e a Iza da Academia X 💪 Aula experimental gratuita pra voce!' }),
      makeNode('3', 'ai_node', 100, 360, 'Qualifica objetivo', { intent: 'emagrecimento, hipertrofia, condicionamento, outro' }),
      makeNode('4', 'message', 100, 500, 'Pede dia/horario', { message: 'Qual dia e horario voce prefere pra fazer a experimental?' }),
      makeNode('5', 'action', 100, 640, 'Agenda experimental'),
      makeNode('6', 'human_handoff', 100, 780, 'Recepcao confirma'),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5'), makeEdge('5', '6')],
    'FIRST_CONTACT', 7),

  T('ACADEMIA', 'AGENDAMENTO_RECUPERACAO',
    'Academia — Recuperacao membro inativo 14d',
    'Membro que parou de frequentar ha 14 dias recebe mensagem motivacional + oferece personal trainer 1 sessao gratis.',
    [
      makeNode('1', 'input', 100, 100, 'Inativo 14d'),
      makeNode('2', 'message', 100, 220, 'Motivacao', { message: 'Tudo bem? Vimos que voce nao tem vindo. Posso te ajudar a voltar?' }),
      makeNode('3', 'ai_node', 100, 360, 'Detecta motivo', { intent: 'preguica, falta de tempo, dor, sem motivacao' }),
      makeNode('4', 'message', 100, 500, 'Oferece PT gratis', { message: 'Que tal 1 sessao gratis com personal pra retomar? Eu agendo' }),
      makeNode('5', 'action', 100, 640, 'Agenda PT'),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5')],
    'TIMEOUT_14D', 8),

  T('ACADEMIA', 'NPS_POS_VENDA',
    'Academia — NPS mensal',
    'Mensalmente, manda NPS pra membros ativos + pergunta sugestao melhoria.',
    [
      makeNode('1', 'input', 100, 100, 'Cron mensal'),
      makeNode('2', 'message', 100, 220, 'NPS', { message: 'Como foi seu mes? De 0 a 10' }),
      makeNode('3', 'ai_node', 100, 360, 'Coleta nota + sugestao', { intent: 'extrair NPS + sugestao' }),
      makeNode('4', 'action', 100, 500, 'Salva resposta', { action: 'save_nps_response' }),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4')],
    'CUSTOM', 9),

  // ═══ PETSHOP ═══
  T('PETSHOP', 'BOAS_VINDAS_QUALIFICACAO',
    'Petshop — Boas-vindas + Cadastro do pet',
    'Lead novo, pergunta nome do tutor + nome do pet + raca + idade pra cadastrar e personalizar futuras conversas.',
    [
      makeNode('1', 'input', 100, 100, 'Lead chegou'),
      makeNode('2', 'message', 100, 220, 'Saudacao', { message: 'Oi! Sou a Iza do Petshop X 🐾 Qual o nome do seu pet?' }),
      makeNode('3', 'ai_node', 100, 360, 'Coleta nome+raca+idade', { intent: 'extrair dados do pet' }),
      makeNode('4', 'action', 100, 500, 'Cadastra pet', { action: 'create_contact_with_pet' }),
      makeNode('5', 'message', 100, 640, 'Oferta primeira visita', { message: 'Que fofo! Banho+tosa com 15% off pra primeira visita?' }),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5')],
    'FIRST_CONTACT', 10),

  T('PETSHOP', 'AGENDAMENTO_RECUPERACAO',
    'Petshop — Reagendamento banho mensal',
    'Cliente que fez banho ha 30 dias recebe lembrete + oferta de reagendar.',
    [
      makeNode('1', 'input', 100, 100, 'Cron 30d apos banho'),
      makeNode('2', 'message', 100, 220, 'Lembrete', { message: 'Hora do banho mensal do {nome_pet}? Posso agendar' }),
      makeNode('3', 'ai_node', 100, 360, 'Iza confirma'),
      makeNode('4', 'action', 100, 500, 'Agenda banho'),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4')],
    'TIMEOUT_30D', 11),

  T('PETSHOP', 'NPS_POS_VENDA',
    'Petshop — NPS apos servico',
    'Manda foto + NPS apos banho/tosa. Promotores ganham 5% off na proxima.',
    [
      makeNode('1', 'input', 100, 100, 'Banho finalizado'),
      makeNode('2', 'message', 100, 220, 'Manda foto + NPS', { message: 'Olha como ficou! De 0 a 10, gostou?' }),
      makeNode('3', 'ai_node', 100, 360, 'Coleta nota'),
      makeNode('4', 'condition', 100, 500, 'Nota >= 9?'),
      makeNode('5', 'action', 100, 640, 'Aplica cupom 5%', { action: 'create_coupon', discount: 5 }),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5', 'promotor')],
    'CUSTOM', 12),

  // ═══ ECOMMERCE MODA ═══
  T('ECOMMERCE_MODA', 'BOAS_VINDAS_QUALIFICACAO',
    'E-com Moda — Boas-vindas + Cupom primeira compra',
    'Lead novo recebe boas-vindas + cupom 10% off primeira compra + pergunta estilo (casual/festa/trabalho).',
    [
      makeNode('1', 'input', 100, 100, 'Lead chegou'),
      makeNode('2', 'message', 100, 220, 'Cupom', { message: 'Bem-vinda! Cupom PRIMEIRA10 pra 10% off ✨' }),
      makeNode('3', 'ai_node', 100, 360, 'Qualifica estilo', { intent: 'casual, festa, trabalho, outro' }),
      makeNode('4', 'message', 100, 500, 'Recomendacao', { message: 'Olha umas pecas que combinam com seu estilo! <link catalogo>' }),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4')],
    'FIRST_CONTACT', 13),

  T('ECOMMERCE_MODA', 'AGENDAMENTO_RECUPERACAO',
    'E-com Moda — Recuperacao carrinho abandonado 2h',
    'Cliente colocou produto no carrinho mas nao finalizou em 2h. Iza dispara com oferta de frete gratis.',
    [
      makeNode('1', 'input', 100, 100, 'Carrinho abandonado 2h'),
      makeNode('2', 'message', 100, 220, 'Carrinho', { message: 'Vi que voce ficou interessada em {produto}. Frete gratis se finalizar hoje!' }),
      makeNode('3', 'ai_node', 100, 360, 'Iza ouve'),
      makeNode('4', 'condition', 100, 500, 'Aceita?'),
      makeNode('5', 'message', 100, 640, 'Link checkout', { message: 'Aqui o link: {checkout_url}?coupon=FRETE_GRATIS' }),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5', 'sim')],
    'CART_ABANDONED', 14),

  T('ECOMMERCE_MODA', 'NPS_POS_VENDA',
    'E-com Moda — NPS pos-entrega',
    'Apos confirmacao de entrega (rastreio mostrado como ENTREGUE), manda NPS + pede foto pra Insta.',
    [
      makeNode('1', 'input', 100, 100, 'Pedido entregue'),
      makeNode('2', 'message', 100, 220, 'Bem cuidou?', { message: 'Chegou! De 0 a 10, gostou?' }),
      makeNode('3', 'ai_node', 100, 360, 'Coleta nota'),
      makeNode('4', 'condition', 100, 500, 'Nota >= 9?'),
      makeNode('5', 'message', 100, 640, 'Pede foto', { message: 'Que bom! Manda foto vestida pra eu repostar no Insta marcando voce?' }),
    ],
    [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '4'), makeEdge('4', '5', 'promotor')],
    'CUSTOM', 15),
];

async function main() {
  console.log(`Seedando ${templates.length} templates...`);
  for (const t of templates) {
    // Upsert por (vertical, category, name) — idempotente
    const existing = await prisma.flowTemplate.findFirst({
      where: { vertical: t.vertical as FlowTemplateVertical, category: t.category as FlowTemplateCategory, name: t.name },
    });
    if (existing) {
      console.log(`  - ja existe: ${t.name}`);
      continue;
    }
    await prisma.flowTemplate.create({ data: t as any });
    console.log(`  ✓ ${t.vertical} / ${t.category}: ${t.name}`);
  }
  console.log('Seed completo.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
