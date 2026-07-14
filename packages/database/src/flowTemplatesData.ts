/**
 * FLOW_TEMPLATES_DATA — fonte unica dos 48 templates Maestro (16 verticais x 3 jornadas).
 *
 * Usado por:
 *   - packages/database/prisma/seeds/flowTemplates.ts (seed manual)
 *   - apps/api/src/bootstrap/seedFlowTemplates.ts (upsert no startup)
 *
 * Sem prisma calls aqui — so a estrutura de dados.
 *
 * ┌── CONTRATO (leia antes de editar) ────────────────────────────────────────┐
 * │ O template e copiado VERBATIM pro fluxo do cliente em                     │
 * │ POST /api/flows/templates/:id/duplicate. Nao existe camada de traducao.   │
 * │ Logo, o que esta aqui tem que falar o MESMO vocabulario que:              │
 * │                                                                           │
 * │   - o motor  → apps/api/src/agents/flowEngine.ts (switch em resolveFlowStep)
 * │   - o editor → apps/web/app/(dashboard)/flows/page.tsx (NODE_META)        │
 * │                                                                           │
 * │ TIPOS DE NO validos: start, message, condition, ask, ai, tag, update_lead,│
 * │                      transfer, wait, schedule, goto_flow.                 │
 * │ Qualquer outro tipo cai no default do motor e ENCERRA o fluxo em silencio.│
 * │                                                                           │
 * │ CAMPOS por no (o motor le exatamente estes):                              │
 * │   message      → data.text  (+ data.media | data.interactive)             │
 * │   ai           → data.prompt                                              │
 * │   ask          → data.question, data.varName, data.validation             │
 * │   tag          → data.tag                                                 │
 * │   update_lead  → data.field, data.value                                   │
 * │ Nao existe data.message. Nao existe no "action"/"input"/"ai_node".        │
 * │                                                                           │
 * │ ARESTAS: a ramificacao vive em data.when / data.predicates. Um `label`    │
 * │ solto na aresta e decorativo — o motor nao le.                            │
 * │                                                                           │
 * │ INTERPOLACAO: {{vars.x}}, {{contact.name}}, {{system.businessName}}, com  │
 * │ fallback {{x | "padrao"}}. Chave simples ({x}) NAO interpola.             │
 * │                                                                           │
 * │ O contrato esta travado por teste:                                        │
 * │   apps/api/src/agents/flowTemplateContract.test.ts                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * LIMITE DO MOTOR que molda o desenho destes fluxos: um `condition` so ramifica
 * consumindo a mensagem que acabou de chegar. `ask` -> `condition` NAO funciona
 * (o ask consome a msg e o condition seguinte fica esperando outra). Por isso a
 * ramificacao aqui sempre nasce de `message` -> `condition`, com o predicado
 * lendo o TEXTO da resposta.
 *
 * Capacidades que o motor NAO tem (nao invente no de fluxo pra elas): criar
 * evento no Google Calendar, emitir cupom, gravar pedido. Onde a jornada pede
 * isso, o fluxo marca tag/lead e passa pra um humano (transfer) — honesto e
 * funcional. Trocar por automacao real e trabalho de produto, nao de template.
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

// ── Construtores de no ───────────────────────────────────────────────────────
// Forma identica a que o editor grava (flows/page.tsx ~611): label no topo E em
// data.label. Assim template e fluxo salvo pelo cliente sao o mesmo formato.
function n(id: string, type: string, x: number, y: number, label: string, extra: Record<string, any> = {}) {
  return { id, type, position: { x, y }, label, data: { label, ...extra } };
}

const start = (id: string, x: number, y: number, label: string) => n(id, 'start', x, y, label);
const msg = (id: string, x: number, y: number, label: string, text: string, extra: Record<string, any> = {}) =>
  n(id, 'message', x, y, label, { text, ...extra });
/** message com botoes (max 3). O condition seguinte ramifica pelo TITULO tocado. */
const buttons = (id: string, x: number, y: number, label: string, text: string, options: { id: string; title: string }[]) =>
  n(id, 'message', x, y, label, { text, interactive: { type: 'button', options } });
const ai = (id: string, x: number, y: number, label: string, prompt: string) => n(id, 'ai', x, y, label, { prompt });
const ask = (id: string, x: number, y: number, label: string, question: string, varName: string, validation?: any) =>
  n(id, 'ask', x, y, label, { question, varName, ...(validation ? { validation } : {}) });
const cond = (id: string, x: number, y: number, label: string) => n(id, 'condition', x, y, label);
const tag = (id: string, x: number, y: number, label: string, t: string) => n(id, 'tag', x, y, label, { tag: t });
const lead = (id: string, x: number, y: number, label: string, field: string, value: any) =>
  n(id, 'update_lead', x, y, label, { field, value });
const human = (id: string, x: number, y: number, label: string) => n(id, 'transfer', x, y, label);

// ── Construtores de aresta ───────────────────────────────────────────────────
const eid = (s: string, t: string) => `e-${s}-${t}`;
/** Aresta simples (fluxo linear). */
const e = (s: string, t: string) => ({ id: eid(s, t), source: s, target: t, data: {} });
/** Ramo por palavra-chave contida na resposta. Use raiz sem acento ("urgen"). */
const ekw = (s: string, t: string, value: string) =>
  ({ id: eid(s, t), source: s, target: t, data: { when: { match: 'contains', value } } });
/** Ramo por regex na resposta. */
const ere = (s: string, t: string, value: string) =>
  ({ id: eid(s, t), source: s, target: t, data: { when: { match: 'regex', value } } });
/** Ramo padrao. Todo condition deve ter um. */
const eels = (s: string, t: string) => ({ id: eid(s, t), source: s, target: t, data: { when: { match: 'else' } } });

/** Regex de promotor de NPS: resposta 9 ou 10. */
const NPS_PROMOTOR = '^\\D*(9|10)\\b';

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

/**
 * Jornada de NPS — mesma espinha em todas as verticais.
 * start → pergunta a nota → condition le a resposta → promotor | detrator.
 * A ramificacao le o TEXTO da resposta (o motor nao ramifica por variavel).
 */
function npsTemplate(
  v: FlowTemplateVertical,
  name: string,
  description: string,
  order: number,
  pergunta: string,
  promotor: string,
  detrator: string,
): FlowTemplateSeed {
  return T(v, 'NPS_POS_VENDA', name, description,
    [
      start('1', 100, 60, 'Serviço finalizado'),
      msg('2', 100, 180, 'Pede a nota', pergunta),
      cond('3', 100, 300, 'Nota 9 ou 10?'),
      msg('4a', 0, 430, 'Promotor', promotor),
      msg('4b', 240, 430, 'Neutro ou detrator', detrator),
      human('5', 240, 560, 'Time assume'),
    ],
    [e('1', '2'), e('2', '3'), ere('3', '4a', NPS_PROMOTOR), eels('3', '4b'), e('4b', '5')],
    'CUSTOM', order);
}

export const FLOW_TEMPLATES_DATA: FlowTemplateSeed[] = [
  // ═══════════════════════════ DENTISTA ═══════════════════════════
  T('DENTISTA', 'BOAS_VINDAS_QUALIFICACAO',
    'Dentista: Boas-vindas + Qualificação',
    'Recebe lead novo, apresenta a clínica, qualifica a intenção (avaliação, urgência, estética, ortodontia) e leva para a recepção com o lead já pontuado.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Saudação', 'Oi! Sou o assistente da {{system.businessName | "clínica"}}. Como posso te ajudar hoje?', [
        { id: 'avaliacao', title: 'Quero uma avaliação' },
        { id: 'urgencia', title: 'Estou com dor' },
        { id: 'outro', title: 'Outro assunto' },
      ]),
      cond('3', 100, 320, 'Tipo de demanda?'),
      msg('4a', 0, 460, 'Dor / urgência', 'Sinto muito pela dor. Conseguimos te encaixar ainda hoje, às 14h ou às 16h. Qual horário fica melhor?'),
      msg('4b', 240, 460, 'Avaliação', 'A primeira avaliação é gratuita. Tenho horários esta semana. Qual dia costuma ser melhor pra você?'),
      ai('4c', 480, 460, 'IA entende o assunto', 'A pessoa escolheu "outro assunto". Descubra o que ela precisa (estética, ortodontia, retorno, convênio ou dúvida) fazendo uma pergunta por vez. Não prometa preço, prazo nem diagnóstico. Quando entender, diga que a recepção vai confirmar os detalhes.'),
      lead('5', 100, 600, 'Pontua o lead', 'leadScore', 60),
      human('6', 100, 720, 'Passa pra recepção'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'dor'), ekw('3', '4b', 'avalia'), eels('3', '4c'),
      e('4a', '5'), e('4b', '5'), e('4c', '5'), e('5', '6'),
    ],
    'FIRST_CONTACT', 1),

  T('DENTISTA', 'AGENDAMENTO_RECUPERACAO',
    'Dentista: Recuperação 24h',
    'Lead não retornou 24h depois da primeira conversa. O fluxo reabre o assunto, separa quem ainda quer agendar de quem não quer e entrega os interessados para a recepção.',
    [
      start('1', 100, 60, 'Inativo há 24h'),
      buttons('2', 100, 180, 'Reabre o assunto', 'Oi! Vi que você teve interesse numa avaliação com a gente. Ainda quer agendar?', [
        { id: 'sim', title: 'Quero agendar' },
        { id: 'depois', title: 'Deixa pra depois' },
      ]),
      cond('3', 100, 320, 'Ainda quer?'),
      tag('4a', 0, 460, 'Marca interesse', 'quer-agendar'),
      msg('4b', 240, 460, 'Fica pra depois', 'Sem problema! Quando quiser, é só chamar por aqui. 🙂'),
      tag('5b', 240, 580, 'Marca sem interesse agora', 'nao-agora'),
      human('5a', 0, 580, 'Recepção agenda'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'agendar'), eels('3', '4b'),
      e('4a', '5a'), e('4b', '5b'),
    ],
    'TIMEOUT_24H', 2),

  npsTemplate('DENTISTA',
    'Dentista: NPS pós-consulta',
    'Depois da consulta, pergunta a nota de 0 a 10. Promotores recebem o convite para avaliar no Google; os demais vão para uma pessoa do time.',
    3,
    'Como foi sua consulta hoje? De 0 a 10, o quanto você recomendaria a {{system.businessName | "nossa clínica"}} para um amigo?',
    'Que bom saber! 💙 Se puder deixar essa avaliação no Google, ajuda muito outras pessoas a nos encontrarem: {{vars.link_google | "(coloque aqui o link da sua página no Google)"}}',
    'Obrigado pela sinceridade. Quero entender o que não foi bem para corrigir. Já vou te passar para alguém do time.'),

  // ═══════════════════════════ SALAO_BELEZA ═══════════════════════════
  T('SALAO_BELEZA', 'BOAS_VINDAS_QUALIFICACAO',
    'Salão: Boas-vindas + Qualificação',
    'Recebe o lead, apresenta os serviços, descobre o que a pessoa quer fazer e passa para a recepção montar o horário.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Saudação', 'Oi! Sou o assistente do {{system.businessName | "salão"}}. O que você quer fazer?', [
        { id: 'corte', title: 'Corte' },
        { id: 'cor', title: 'Coloração' },
        { id: 'outros', title: 'Outros serviços' },
      ]),
      cond('3', 100, 320, 'Qual serviço?'),
      msg('4a', 0, 460, 'Corte', 'Perfeito! Corte leva cerca de 1h. Prefere manhã ou tarde?'),
      msg('4b', 240, 460, 'Coloração', 'Ótimo! Coloração leva de 2h a 3h e o valor depende do comprimento. Prefere manhã ou tarde?'),
      ai('4c', 480, 460, 'IA descobre o serviço', 'Descubra qual serviço a pessoa quer (escova, manicure, hidratação, penteado ou outro) e se ela tem preferência de profissional. Uma pergunta por vez. Não prometa preço fechado nem horário: diga que a recepção confirma.'),
      tag('5', 100, 600, 'Marca lead de serviço', 'quer-servico'),
      human('6', 100, 720, 'Recepção monta o horário'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'corte'), ekw('3', '4b', 'colora'), eels('3', '4c'),
      e('4a', '5'), e('4b', '5'), e('4c', '5'), e('5', '6'),
    ],
    'FIRST_CONTACT', 4),

  T('SALAO_BELEZA', 'AGENDAMENTO_RECUPERACAO',
    'Salão: Recuperação 48h',
    'Quem não fechou horário em 48h recebe um empurrãozinho com desconto na primeira visita. Quem aceita é marcado e vai para a recepção.',
    [
      start('1', 100, 60, 'Inativo há 48h'),
      buttons('2', 100, 180, 'Oferta', 'Saudades de você por aqui! 💇 Esta semana o seu primeiro corte sai com 10% de desconto. Quer garantir?', [
        { id: 'sim', title: 'Quero garantir' },
        { id: 'nao', title: 'Agora não' },
      ]),
      cond('3', 100, 320, 'Aceitou?'),
      tag('4a', 0, 460, 'Marca desconto prometido', 'desconto-primeira-visita'),
      msg('5a', 0, 580, 'Confirma', 'Show! Já anotei seu desconto. A recepção entra em contato pra fechar o melhor horário. 💛'),
      human('6a', 0, 700, 'Recepção fecha o horário'),
      msg('4b', 240, 460, 'Agora não', 'Tudo bem! O convite fica de pé. Quando quiser, é só chamar. 🙂'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'garantir'), eels('3', '4b'),
      e('4a', '5a'), e('5a', '6a'),
    ],
    'TIMEOUT_48H', 5),

  npsTemplate('SALAO_BELEZA',
    'Salão: NPS pós-serviço',
    'Depois do serviço, pergunta a nota. Promotores recebem o convite para a foto do resultado no Instagram; os demais vão para uma pessoa do time.',
    6,
    'Curtiu o resultado de hoje? De 0 a 10, o quanto você recomendaria o {{system.businessName | "salão"}} para uma amiga?',
    'Amei saber! ✨ Posso publicar a foto do resultado no nosso Instagram marcando você? Se preferir que não, é só falar.',
    'Obrigado por contar. Quero entender o que faltou pra acertar da próxima vez. Já te passo pra alguém do time.'),

  // ═══════════════════════════ ACADEMIA ═══════════════════════════
  T('ACADEMIA', 'BOAS_VINDAS_QUALIFICACAO',
    'Academia: Boas-vindas + Aula experimental',
    'Lead novo recebe a oferta de aula experimental, conta o objetivo e escolhe o melhor dia. A recepção confirma a vaga.',
    [
      start('1', 100, 60, 'Lead chegou'),
      msg('2', 100, 180, 'Saudação', 'Oi! Sou o assistente da {{system.businessName | "academia"}}. Sua primeira aula experimental é por nossa conta. 💪'),
      ai('3', 100, 300, 'IA qualifica objetivo', 'Descubra o objetivo da pessoa (emagrecimento, hipertrofia, condicionamento, saúde ou outro) e há quanto tempo ela está parada. Uma pergunta por vez. Não passe treino nem dieta: isso é com o professor.'),
      ask('4', 100, 420, 'Melhor dia e horário', 'Qual dia e horário são melhores pra sua aula experimental?', 'preferencia_horario'),
      lead('5', 100, 540, 'Salva preferência', 'preferencia_horario', '{{vars.preferencia_horario}}'),
      tag('6', 100, 660, 'Marca experimental', 'aula-experimental'),
      human('7', 100, 780, 'Recepção confirma a vaga'),
      human('8', 340, 540, 'Recepção ajuda'),
    ],
    [
      e('1', '2'), e('2', '3'), e('3', '4'),
      e('4', '5'), eels('4', '8'),
      e('5', '6'), e('6', '7'),
    ],
    'FIRST_CONTACT', 7),

  T('ACADEMIA', 'AGENDAMENTO_RECUPERACAO',
    'Academia: Recuperação de membro inativo 14d',
    'Membro parado há 14 dias recebe uma mensagem sem cobrança, conta o motivo e ganha a oferta de uma sessão com o personal.',
    [
      start('1', 100, 60, 'Inativo há 14 dias'),
      msg('2', 100, 180, 'Reaproxima', 'Oi! Senti sua falta nos treinos. 🙂 Aconteceu alguma coisa ou foi só a rotina apertando?'),
      ai('3', 100, 300, 'IA entende o motivo', 'Descubra por que a pessoa parou de treinar (falta de tempo, desânimo, dor ou lesão, viagem, outro) e acolha sem cobrar nem julgar. Se ela citar dor ou lesão, não dê orientação clínica: diga que o professor vai avaliar.'),
      buttons('4', 100, 420, 'Oferece o personal', 'Que tal voltar com uma sessão gratuita com um personal, só pra retomar o ritmo?', [
        { id: 'sim', title: 'Quero a sessão' },
        { id: 'nao', title: 'Agora não' },
      ]),
      cond('5', 100, 560, 'Aceitou?'),
      tag('6a', 0, 700, 'Marca retorno', 'quer-voltar'),
      human('7a', 0, 820, 'Recepção agenda o personal'),
      msg('6b', 240, 700, 'Agora não', 'Tudo certo! Quando bater vontade, a gente te espera. 💪'),
    ],
    [
      e('1', '2'), e('2', '3'), e('3', '4'), e('4', '5'),
      ekw('5', '6a', 'sess'), eels('5', '6b'),
      e('6a', '7a'),
    ],
    'TIMEOUT_14D', 8),

  npsTemplate('ACADEMIA',
    'Academia: NPS mensal',
    'Todo mês pergunta a nota para os membros ativos. Promotores recebem o convite de indicação; os demais falam com uma pessoa do time.',
    9,
    'Como foi seu mês de treinos? De 0 a 10, o quanto você recomendaria a {{system.businessName | "academia"}} para um amigo?',
    'Que massa! 💪 Se quiser trazer alguém pra treinar com você, a gente libera uma aula experimental pra essa pessoa. É só mandar o nome.',
    'Valeu por contar. Quero entender o que dá pra melhorar. Já vou te passar pra alguém do time.'),

  // ═══════════════════════════ PETSHOP ═══════════════════════════
  T('PETSHOP', 'BOAS_VINDAS_QUALIFICACAO',
    'Petshop: Boas-vindas + Cadastro do pet',
    'Lead novo, captura o nome do pet para o CRM e usa esse nome nas próximas conversas. Fecha com a oferta da primeira visita.',
    [
      start('1', 100, 60, 'Lead chegou'),
      ask('2', 100, 180, 'Nome do pet', 'Oi! Sou o assistente do {{system.businessName | "petshop"}}. Pra começar: qual é o nome do seu pet?', 'nome_pet'),
      lead('3', 100, 300, 'Salva o pet no CRM', 'nome_pet', '{{vars.nome_pet}}'),
      ai('4', 100, 420, 'IA completa o cadastro', 'Você já sabe o nome do pet ({{vars.nome_pet}}). Descubra a raça e a idade dele, uma pergunta por vez, com leveza. Não dê orientação veterinária.'),
      msg('5', 100, 540, 'Oferta da primeira visita', 'Que fofo, {{vars.nome_pet | "seu pet"}}! 🐾 Na primeira visita, banho e tosa saem com 15% de desconto. Quer que a gente separe um horário?'),
      human('6', 100, 660, 'Time monta o horário'),
      human('7', 340, 300, 'Time ajuda no cadastro'),
    ],
    [
      e('1', '2'), e('2', '3'), eels('2', '7'),
      e('3', '4'), e('4', '5'), e('5', '6'),
    ],
    'FIRST_CONTACT', 10),

  T('PETSHOP', 'AGENDAMENTO_RECUPERACAO',
    'Petshop: Reagendamento do banho mensal',
    'Trinta dias depois do último banho, lembra o tutor pelo nome do pet e entrega quem aceitar para o time montar o horário.',
    [
      start('1', 100, 60, 'Cron 30d após o banho'),
      buttons('2', 100, 180, 'Lembrete', 'Oi! Já faz um mês do último banho do {{vars.nome_pet | "seu pet"}}. 🐾 Quer que a gente separe um horário?', [
        { id: 'sim', title: 'Quero agendar' },
        { id: 'nao', title: 'Ainda não' },
      ]),
      cond('3', 100, 320, 'Aceitou?'),
      tag('4a', 0, 460, 'Marca banho', 'quer-banho'),
      human('5a', 0, 580, 'Time monta o horário'),
      msg('4b', 240, 460, 'Ainda não', 'Sem problema! Quando o {{vars.nome_pet | "seu pet"}} precisar, é só chamar. 🐶'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'agendar'), eels('3', '4b'),
      e('4a', '5a'),
    ],
    'TIMEOUT_30D', 11),

  npsTemplate('PETSHOP',
    'Petshop: NPS após o serviço',
    'Depois do banho ou tosa, pergunta a nota. Promotores recebem o convite de desconto na próxima visita; os demais falam com o time.',
    12,
    'Olha como o {{vars.nome_pet | "seu pet"}} ficou! 🐾 De 0 a 10, o quanto você recomendaria o {{system.businessName | "nosso petshop"}}?',
    'Que alegria! 🐶 Sua próxima visita tem 5% de desconto, já deixei anotado aqui.',
    'Obrigado por contar. Quero entender o que não agradou. Já te passo pra alguém do time.'),

  // ═══════════════════════════ ECOMMERCE_MODA ═══════════════════════════
  T('ECOMMERCE_MODA', 'BOAS_VINDAS_QUALIFICACAO',
    'E-commerce de moda: Boas-vindas + Cupom da primeira compra',
    'Lead novo recebe o cupom de primeira compra, conta o estilo que procura e a IA recomenda peças com base nisso.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Cupom', 'Bem-vinda! 💕 Use o cupom PRIMEIRA10 e ganhe 10% na sua primeira compra. Que tipo de peça você procura?', [
        { id: 'casual', title: 'Casual do dia a dia' },
        { id: 'festa', title: 'Festa' },
        { id: 'trabalho', title: 'Trabalho' },
      ]),
      cond('3', 100, 320, 'Qual estilo?'),
      tag('4a', 0, 460, 'Estilo casual', 'estilo-casual'),
      tag('4b', 240, 460, 'Estilo festa', 'estilo-festa'),
      tag('4c', 480, 460, 'Estilo trabalho', 'estilo-trabalho'),
      ai('5', 100, 600, 'IA recomenda', 'Você já sabe o estilo que a cliente procura pelas tags da conversa. Recomende de 2 a 3 peças do catálogo que combinem, explicando em uma frase por que cada uma combina. Lembre do cupom PRIMEIRA10. Não invente peça, preço nem prazo de entrega que você não tenha visto no catálogo.'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'festa'), ekw('3', '4c', 'trabalho'), eels('3', '4a'),
      e('4a', '5'), e('4b', '5'), e('4c', '5'),
    ],
    'FIRST_CONTACT', 13),

  T('ECOMMERCE_MODA', 'AGENDAMENTO_RECUPERACAO',
    'E-commerce de moda: Carrinho abandonado 2h',
    'Duas horas depois do carrinho parado, oferece frete grátis e devolve o link do checkout para quem responder que quer.',
    [
      start('1', 100, 60, 'Carrinho parado há 2h'),
      buttons('2', 100, 180, 'Frete grátis', 'Vi que você ficou de olho em {{vars.produto | "uma peça"}}. 👀 Se finalizar hoje, o frete é por nossa conta. Quer?', [
        { id: 'sim', title: 'Quero finalizar' },
        { id: 'nao', title: 'Depois eu vejo' },
      ]),
      cond('3', 100, 320, 'Aceitou?'),
      tag('4a', 0, 460, 'Marca carrinho quente', 'carrinho-quente'),
      msg('5a', 0, 580, 'Link do checkout', 'Oba! Aqui está: {{vars.checkout_url | "(coloque aqui o link do checkout)"}} 💛 O frete grátis já está aplicado.'),
      msg('4b', 240, 460, 'Depois', 'Tranquilo! Deixei sua sacolinha guardada por aqui. 🛍'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'finalizar'), eels('3', '4b'),
      e('4a', '5a'),
    ],
    'CART_ABANDONED', 14),

  npsTemplate('ECOMMERCE_MODA',
    'E-commerce de moda: NPS pós-entrega',
    'Quando o rastreio marca entregue, pergunta a nota. Promotores recebem o convite da foto para o Instagram; os demais falam com o time.',
    15,
    'Chegou! 📦 De 0 a 10, o quanto você recomendaria a {{system.businessName | "nossa loja"}} para uma amiga?',
    'Que alegria! ✨ Se quiser mandar uma foto usando a peça, a gente adora repostar marcando você.',
    'Obrigado por contar. Quero entender o que não saiu como você esperava. Já te passo pra alguém do time.'),

  // ═══════════════════════════ PSICOLOGO ═══════════════════════════
  T('PSICOLOGO', 'BOAS_VINDAS_QUALIFICACAO',
    'Psicologia: Acolhimento + Qualificação',
    'Recebe quem procura ajuda com acolhimento, entende a demanda sem invadir e encaminha para a agenda de avaliação.',
    [
      start('1', 100, 60, 'Lead chegou'),
      msg('2', 100, 180, 'Acolhe', 'Oi. Que bom que você chegou até aqui. Procurar ajuda já é um passo grande. 💙 Pode me contar, no seu tempo, o que te trouxe?'),
      ai('3', 100, 300, 'IA acolhe e entende', 'Acolha com empatia e descubra, sem pressa e sem insistir, o que a pessoa procura (ansiedade, relacionamento, luto, trabalho, outro) e se já fez terapia antes. Nunca dê diagnóstico, interpretação clínica nem conselho terapêutico: isso é do profissional. Se aparecer qualquer sinal de risco à vida, oriente imediatamente a procurar o CVV no 188 ou o serviço de emergência mais próximo e passe a conversa para uma pessoa da equipe.'),
      msg('4', 100, 420, 'Oferece a avaliação', 'Obrigado por confiar. O primeiro passo é uma sessão de avaliação, pra entender junto o melhor caminho. Quer que eu veja os horários disponíveis?'),
      human('5', 100, 540, 'Secretaria confirma'),
    ],
    [e('1', '2'), e('2', '3'), e('3', '4'), e('4', '5')],
    'FIRST_CONTACT', 16),

  T('PSICOLOGO', 'AGENDAMENTO_RECUPERACAO',
    'Psicologia: Reagendamento de sessão perdida',
    'Paciente faltou. A mensagem não cobra, abre espaço e oferece remarcar.',
    [
      start('1', 100, 60, 'Sessão perdida'),
      buttons('2', 100, 180, 'Reabre sem cobrar', 'Oi. Senti sua falta na sessão de hoje. Sem cobrança nenhuma, tá? 💙 Quer que eu veja um novo horário?', [
        { id: 'sim', title: 'Quero remarcar' },
        { id: 'depois', title: 'Depois eu falo' },
      ]),
      cond('3', 100, 320, 'Quer remarcar?'),
      tag('4a', 0, 460, 'Marca remarcação', 'quer-remarcar'),
      human('5a', 0, 580, 'Secretaria remarca'),
      msg('4b', 240, 460, 'Depois', 'Tudo bem. Fico por aqui quando você quiser retomar. 💙'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'remarcar'), eels('3', '4b'),
      e('4a', '5a'),
    ],
    'CUSTOM', 17),

  T('PSICOLOGO', 'NPS_POS_VENDA',
    'Psicologia: Check-in pós-sessão',
    'Check-in delicado depois da sessão. Aqui não se pede nota: o retorno é aberto e vai para o profissional.',
    [
      start('1', 100, 60, 'Sessão finalizada'),
      msg('2', 100, 180, 'Check-in', 'Oi. Só passei pra saber como você está depois da nossa conversa de hoje. Sem pressa pra responder. 💙'),
      ai('3', 100, 300, 'IA escuta', 'Acolha o que a pessoa trouxer, sem interpretar, sem diagnosticar e sem dar conselho clínico. Responda curto e humano. Se ela pedir para falar com o profissional ou se aparecer qualquer sinal de risco à vida, oriente a procurar o CVV no 188 ou o serviço de emergência mais próximo e passe a conversa para uma pessoa da equipe imediatamente.'),
    ],
    [e('1', '2'), e('2', '3')],
    'CUSTOM', 18),

  // ═══════════════════════════ ADVOGADO ═══════════════════════════
  T('ADVOGADO', 'BOAS_VINDAS_QUALIFICACAO',
    'Advocacia: Triagem de área + Reunião',
    'Identifica a área jurídica, separa o que é urgente e encaminha para a reunião com o advogado.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Apresentação', 'Olá! Sou o assistente do {{system.businessName | "escritório"}}. Sobre qual assunto você precisa de ajuda?', [
        { id: 'trabalhista', title: 'Trabalhista' },
        { id: 'familia', title: 'Família' },
        { id: 'outro', title: 'Outro assunto' },
      ]),
      cond('3', 100, 320, 'Qual área?'),
      tag('4a', 0, 460, 'Trabalhista', 'area-trabalhista'),
      tag('4b', 240, 460, 'Família', 'area-familia'),
      ai('4c', 480, 460, 'IA identifica a área', 'Descubra a área jurídica do caso (cível, consumidor, previdenciário, criminal, empresarial ou outra) e se existe algum prazo correndo. Uma pergunta por vez. Nunca dê orientação jurídica, opinião sobre chances de êxito nem estimativa de valor: quem faz isso é o advogado na reunião.'),
      msg('5', 100, 600, 'Convida pra reunião', 'Obrigado. O próximo passo é uma reunião com um dos nossos advogados, pra analisar seu caso com atenção. Quer que eu verifique os horários?'),
      human('6', 100, 720, 'Advogado assume'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'trabalhista'), ekw('3', '4b', 'famil'), eels('3', '4c'),
      e('4a', '5'), e('4b', '5'), e('4c', '5'), e('5', '6'),
    ],
    'FIRST_CONTACT', 19),

  T('ADVOGADO', 'AGENDAMENTO_RECUPERACAO',
    'Advocacia: Resgate de prazo decisivo',
    'Lead com prazo próximo que não agendou. A mensagem lembra do prazo sem alarmar e leva direto ao advogado.',
    [
      start('1', 100, 60, 'Inativo 24h com prazo'),
      buttons('2', 100, 180, 'Lembra do prazo', 'Olá! Sobre o seu caso: prazos jurídicos costumam ser curtos e, depois que passam, nem sempre dá pra recuperar. Quer falar com um advogado ainda hoje?', [
        { id: 'sim', title: 'Quero falar hoje' },
        { id: 'nao', title: 'Depois eu retorno' },
      ]),
      cond('3', 100, 320, 'Quer falar?'),
      tag('4a', 0, 460, 'Marca urgência', 'prazo-urgente'),
      human('5a', 0, 580, 'Advogado assume'),
      msg('4b', 240, 460, 'Depois', 'Certo. Fico à disposição, e se o prazo apertar é só chamar por aqui.'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'hoje'), eels('3', '4b'),
      e('4a', '5a'),
    ],
    'TIMEOUT_24H', 20),

  npsTemplate('ADVOGADO',
    'Advocacia: NPS pós-causa',
    'Depois da sentença ou do acordo, pergunta a nota. Promotores recebem o convite para avaliar no Google; os demais falam com o escritório.',
    21,
    'Agora que seu caso foi encerrado: de 0 a 10, o quanto você recomendaria o {{system.businessName | "nosso escritório"}} para alguém?',
    'Ficamos muito satisfeitos. Se puder registrar isso no Google, ajuda outras pessoas a nos encontrarem: {{vars.link_google | "(coloque aqui o link da sua página no Google)"}}',
    'Agradeço a sinceridade. Quero entender o que poderia ter sido melhor. Já vou te passar para um responsável.'),

  // ═══════════════════════════ NUTRICIONISTA ═══════════════════════════
  T('NUTRICIONISTA', 'BOAS_VINDAS_QUALIFICACAO',
    'Nutrição: Avaliação + Objetivo',
    'Descobre o objetivo de quem chega e encaminha para a consulta de avaliação.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Saudação', 'Oi! Sou o assistente do consultório. Qual é o seu objetivo com a nutrição?', [
        { id: 'emagrecer', title: 'Emagrecer' },
        { id: 'massa', title: 'Ganhar massa' },
        { id: 'saude', title: 'Saúde e exames' },
      ]),
      cond('3', 100, 320, 'Qual objetivo?'),
      tag('4a', 0, 460, 'Emagrecimento', 'objetivo-emagrecer'),
      tag('4b', 240, 460, 'Ganho de massa', 'objetivo-massa'),
      tag('4c', 480, 460, 'Saúde', 'objetivo-saude'),
      msg('5', 100, 600, 'Oferece a avaliação', 'Perfeito. O primeiro passo é a consulta de avaliação, onde a nutricionista monta um plano só pra você. Quer ver os horários?'),
      human('6', 100, 720, 'Recepção confirma'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'massa'), ekw('3', '4c', 'saúde'), eels('3', '4a'),
      e('4a', '5'), e('4b', '5'), e('4c', '5'), e('5', '6'),
    ],
    'FIRST_CONTACT', 22),

  T('NUTRICIONISTA', 'AGENDAMENTO_RECUPERACAO',
    'Nutrição: Retorno em 30 dias',
    'Trinta dias depois do plano, convida para o retorno e passa quem aceita para a recepção.',
    [
      start('1', 100, 60, 'Cron 30 dias'),
      buttons('2', 100, 180, 'Convida pro retorno', 'Oi! Já faz um mês do seu plano alimentar. 🥗 O retorno é onde a gente ajusta o que não encaixou na rotina. Quer marcar?', [
        { id: 'sim', title: 'Quero marcar' },
        { id: 'nao', title: 'Ainda não' },
      ]),
      cond('3', 100, 320, 'Aceitou?'),
      tag('4a', 0, 460, 'Marca retorno', 'quer-retorno'),
      human('5a', 0, 580, 'Recepção marca'),
      msg('4b', 240, 460, 'Ainda não', 'Sem problema! Quando quiser retomar, é só chamar por aqui. 🥗'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'marcar'), eels('3', '4b'),
      e('4a', '5a'),
    ],
    'TIMEOUT_30D', 23),

  T('NUTRICIONISTA', 'NPS_POS_VENDA',
    'Nutrição: Check-in semanal',
    'Acompanhamento semanal da adesão ao plano, sem cobrança, com a IA escutando o que atrapalhou.',
    [
      start('1', 100, 60, 'Cron semanal'),
      msg('2', 100, 180, 'Check-in', 'Oi! Como foi sua semana com o plano? Pode ser sincero, sem medo de decepcionar ninguém. 🙂'),
      ai('3', 100, 300, 'IA escuta a adesão', 'Descubra como foi a adesão ao plano na semana e o que atrapalhou (rotina, fome, viagem, eventos, desânimo). Acolha sem julgar nem cobrar. Nunca ajuste o plano, não troque alimento e não dê orientação nutricional: registre o relato e diga que a nutricionista avalia no retorno.'),
    ],
    [e('1', '2'), e('2', '3')],
    'CUSTOM', 24),

  // ═══════════════════════════ IMOBILIARIA ═══════════════════════════
  T('IMOBILIARIA', 'BOAS_VINDAS_QUALIFICACAO',
    'Imobiliária: Qualificação BANT',
    'Separa quem quer comprar de quem quer alugar, coleta o essencial com a IA, pontua o lead e entrega ao corretor.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Saudação', 'Olá! Sou o assistente da {{system.businessName | "imobiliária"}}. Você procura imóvel pra comprar ou pra alugar?', [
        { id: 'comprar', title: 'Comprar' },
        { id: 'alugar', title: 'Alugar' },
      ]),
      cond('3', 100, 320, 'Comprar ou alugar?'),
      tag('4a', 0, 460, 'Compra', 'quer-comprar'),
      tag('4b', 240, 460, 'Locação', 'quer-alugar'),
      ai('5', 100, 600, 'IA qualifica', 'Descubra o tipo de imóvel, o bairro de interesse, a faixa de valor e o prazo pra decidir. Uma pergunta por vez, de forma leve. Não invente imóvel, valor nem condição de financiamento: quem confirma isso é o corretor.'),
      lead('6', 100, 720, 'Pontua o lead', 'leadScore', 70),
      human('7', 100, 840, 'Corretor assume'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'alugar'), eels('3', '4a'),
      e('4a', '5'), e('4b', '5'), e('5', '6'), e('6', '7'),
    ],
    'FIRST_CONTACT', 25),

  T('IMOBILIARIA', 'AGENDAMENTO_RECUPERACAO',
    'Imobiliária: Lembrete de visita 24h',
    'Vinte e quatro horas antes da visita, confirma a presença e avisa o corretor quando alguém precisa remarcar.',
    [
      start('1', 100, 60, 'Visita em 24h'),
      buttons('2', 100, 180, 'Lembrete', 'Oi! Sua visita ao imóvel é amanhã. 🏠 Está tudo certo pra você?', [
        { id: 'sim', title: 'Confirmado' },
        { id: 'remarcar', title: 'Preciso remarcar' },
      ]),
      cond('3', 100, 320, 'Confirmou?'),
      msg('4a', 0, 460, 'Confirmado', 'Perfeito! Até amanhã. Qualquer imprevisto, é só avisar por aqui. 🏠'),
      tag('5a', 0, 580, 'Visita confirmada', 'visita-confirmada'),
      tag('4b', 240, 460, 'Quer remarcar', 'quer-remarcar-visita'),
      human('5b', 240, 580, 'Corretor remarca'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'remarcar'), eels('3', '4a'),
      e('4a', '5a'), e('4b', '5b'),
    ],
    'CUSTOM', 26),

  T('IMOBILIARIA', 'NPS_POS_VENDA',
    'Imobiliária: NPS pós-visita',
    'Depois da visita, pergunta a nota. Quem gostou segue para a proposta; quem não gostou ajuda a IA a refinar a busca.',
    [
      start('1', 100, 60, 'Visita finalizada'),
      msg('2', 100, 180, 'Pede a nota', 'E aí, o que achou do imóvel? De 0 a 10, o quanto ele combinou com o que você procura?'),
      cond('3', 100, 300, 'Nota 9 ou 10?'),
      msg('4a', 0, 430, 'Gostou', 'Que ótimo! 🏠 Quer que o corretor prepare uma proposta pra esse imóvel?'),
      human('5a', 0, 550, 'Corretor prepara a proposta'),
      ai('4b', 240, 430, 'IA refina a busca', 'O imóvel não agradou. Descubra o que não serviu (localização, tamanho, preço, estado de conservação, andar) pra refinar a busca. Uma pergunta por vez. Não ofereça imóvel específico nem valor: quem faz isso é o corretor.'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ere('3', '4a', NPS_PROMOTOR), eels('3', '4b'),
      e('4a', '5a'),
    ],
    'CUSTOM', 27),

  // ═══════════════════════════ RESTAURANTE ═══════════════════════════
  T('RESTAURANTE', 'BOAS_VINDAS_QUALIFICACAO',
    'Restaurante: Reserva + Cardápio',
    'Separa quem quer reservar de quem quer ver o cardápio, coleta data e número de pessoas e entrega ao salão.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Saudação', 'Olá! Sou o assistente do {{system.businessName | "restaurante"}}. Como posso ajudar?', [
        { id: 'reserva', title: 'Fazer uma reserva' },
        { id: 'cardapio', title: 'Ver o cardápio' },
      ]),
      cond('3', 100, 320, 'Reserva ou cardápio?'),
      ask('4a', 0, 460, 'Data e pessoas', 'Claro! Pra qual dia, horário e quantas pessoas?', 'reserva_detalhes'),
      lead('5a', 0, 580, 'Salva a reserva', 'reserva_detalhes', '{{vars.reserva_detalhes}}'),
      tag('6a', 0, 700, 'Quer reserva', 'quer-reserva'),
      human('7a', 0, 820, 'Salão confirma a mesa'),
      msg('4b', 280, 460, 'Cardápio', 'Aqui está nosso cardápio: {{vars.link_cardapio | "(coloque aqui o link do cardápio)"}} 🍽 Se quiser reservar mesa, é só me chamar.'),
      human('8', 280, 700, 'Salão ajuda'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'cardápio'), eels('3', '4a'),
      e('4a', '5a'), eels('4a', '8'),
      e('5a', '6a'), e('6a', '7a'),
    ],
    'FIRST_CONTACT', 28),

  T('RESTAURANTE', 'AGENDAMENTO_RECUPERACAO',
    'Restaurante: Lembrete de reserva 3h',
    'Três horas antes, confirma a reserva e libera a mesa quando o cliente não vem.',
    [
      start('1', 100, 60, 'Reserva em 3h'),
      buttons('2', 100, 180, 'Lembrete', 'Oi! Sua mesa está reservada pra hoje. 🍽 Está tudo confirmado?', [
        { id: 'sim', title: 'Confirmado' },
        { id: 'cancelar', title: 'Preciso cancelar' },
      ]),
      cond('3', 100, 320, 'Confirmou?'),
      msg('4a', 0, 460, 'Confirmado', 'Perfeito! Te esperamos. 🍷'),
      tag('4b', 240, 460, 'Liberar a mesa', 'reserva-cancelada'),
      msg('5b', 240, 580, 'Cancelado', 'Sem problema, já liberei a mesa. Quando quiser voltar, é só chamar. 🍽'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'cancelar'), eels('3', '4a'),
      e('4b', '5b'),
    ],
    'CUSTOM', 29),

  npsTemplate('RESTAURANTE',
    'Restaurante: NPS pós-refeição',
    'Depois da conta, pergunta a nota. Promotores recebem o convite para avaliar no Google; os demais falam com o gerente.',
    30,
    'Obrigado pela visita! De 0 a 10, o quanto você recomendaria o {{system.businessName | "nosso restaurante"}} para um amigo?',
    'Que bom saber! 🍷 Se puder deixar essa avaliação no Google, ajuda muita gente a descobrir a gente: {{vars.link_google | "(coloque aqui o link da sua página no Google)"}}',
    'Obrigado pela sinceridade. Quero entender o que não foi bem. Já vou te passar para o gerente.'),

  // ═══════════════════════════ ESCOLA ═══════════════════════════
  T('ESCOLA', 'BOAS_VINDAS_QUALIFICACAO',
    'Escola: Matrícula + Visita guiada',
    'Recebe a família, entende a série e a idade da criança e convida para a visita guiada.',
    [
      start('1', 100, 60, 'Lead chegou'),
      msg('2', 100, 180, 'Saudação', 'Olá! Sou o assistente da {{system.businessName | "escola"}}. Que bom ter você por aqui. 🎒'),
      ai('3', 100, 300, 'IA entende o perfil', 'Descubra a idade e a série pretendida da criança, e se a família busca vaga pra este ano ou pro próximo. Uma pergunta por vez, com acolhimento. Não prometa vaga, valor de mensalidade nem desconto: quem confirma é a secretaria.'),
      buttons('4', 100, 420, 'Convida pra visita', 'A melhor forma de conhecer a escola é visitando. Quer agendar uma visita guiada?', [
        { id: 'sim', title: 'Quero visitar' },
        { id: 'depois', title: 'Só informações' },
      ]),
      cond('5', 100, 560, 'Quer visitar?'),
      tag('6a', 0, 700, 'Quer visita', 'quer-visita'),
      human('7a', 0, 820, 'Secretaria agenda'),
      human('6b', 240, 700, 'Secretaria manda as informações'),
    ],
    [
      e('1', '2'), e('2', '3'), e('3', '4'), e('4', '5'),
      ekw('5', '6a', 'visitar'), eels('5', '6b'),
      e('6a', '7a'),
    ],
    'FIRST_CONTACT', 31),

  T('ESCOLA', 'AGENDAMENTO_RECUPERACAO',
    'Escola: Lembrete de reunião de pais 48h',
    'Quarenta e oito horas antes, confirma a presença dos responsáveis na reunião.',
    [
      start('1', 100, 60, '48h antes'),
      buttons('2', 100, 180, 'Lembrete', 'Olá! A reunião de pais é depois de amanhã. 🎒 Podemos contar com sua presença?', [
        { id: 'sim', title: 'Vou comparecer' },
        { id: 'nao', title: 'Não vou conseguir' },
      ]),
      cond('3', 100, 320, 'Confirmou?'),
      tag('4a', 0, 460, 'Presença confirmada', 'reuniao-confirmada'),
      msg('5a', 0, 580, 'Confirmado', 'Ótimo, te esperamos! 🎒'),
      tag('4b', 240, 460, 'Ausente', 'reuniao-ausente'),
      msg('5b', 240, 580, 'Ausente', 'Sem problema. A coordenação envia um resumo do que foi tratado. 💛'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'comparecer'), eels('3', '4b'),
      e('4a', '5a'), e('4b', '5b'),
    ],
    'TIMEOUT_48H', 32),

  npsTemplate('ESCOLA',
    'Escola: NPS semestral',
    'A cada semestre, pergunta a nota para as famílias. Promotores viram indicação; os demais falam com a coordenação.',
    33,
    'Chegamos ao fim do semestre. De 0 a 10, o quanto você recomendaria a {{system.businessName | "nossa escola"}} para outra família?',
    'Que bom saber disso! 🎒 Se conhece alguma família procurando escola, a gente adora receber indicação sua.',
    'Obrigado pela sinceridade. Quero entender o que podemos melhorar. Já vou te passar para a coordenação.'),

  // ═══════════════════════════ SERVICOS_TECNICOS ═══════════════════════════
  T('SERVICOS_TECNICOS', 'BOAS_VINDAS_QUALIFICACAO',
    'Serviços técnicos: Orçamento + Visita',
    'Coleta a descrição do problema, pede foto e encaminha para o técnico montar o orçamento.',
    [
      start('1', 100, 60, 'Lead chegou'),
      msg('2', 100, 180, 'Saudação', 'Olá! Sou o assistente da {{system.businessName | "nossa equipe"}}. Me conta o que está acontecendo que eu já organizo seu atendimento. 🔧'),
      ai('3', 100, 300, 'IA entende o problema', 'Descubra o que está com defeito, há quanto tempo, e se a pessoa consegue mandar uma foto do problema e do local. Uma pergunta por vez. Nunca estime valor nem prazo e não oriente reparo por conta própria: quem avalia é o técnico.'),
      tag('4', 100, 420, 'Marca orçamento', 'quer-orcamento'),
      lead('5', 100, 540, 'Pontua o lead', 'leadScore', 50),
      human('6', 100, 660, 'Técnico monta o orçamento'),
    ],
    [e('1', '2'), e('2', '3'), e('3', '4'), e('4', '5'), e('5', '6')],
    'FIRST_CONTACT', 34),

  T('SERVICOS_TECNICOS', 'AGENDAMENTO_RECUPERACAO',
    'Serviços técnicos: Lembrete de visita 2h',
    'Duas horas antes, confirma que tem alguém no local para receber o técnico.',
    [
      start('1', 100, 60, '2h antes'),
      buttons('2', 100, 180, 'Lembrete', 'Oi! Nosso técnico chega em cerca de 2 horas. 🔧 Vai ter alguém no local pra receber?', [
        { id: 'sim', title: 'Sim, pode vir' },
        { id: 'remarcar', title: 'Preciso remarcar' },
      ]),
      cond('3', 100, 320, 'Confirmou?'),
      msg('4a', 0, 460, 'Confirmado', 'Perfeito! Ele já está a caminho no horário combinado. 🔧'),
      tag('4b', 240, 460, 'Quer remarcar', 'quer-remarcar-visita'),
      human('5b', 240, 580, 'Time remarca'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'remarcar'), eels('3', '4a'),
      e('4b', '5b'),
    ],
    'CUSTOM', 35),

  npsTemplate('SERVICOS_TECNICOS',
    'Serviços técnicos: NPS pós-serviço',
    'Depois do serviço, pergunta a nota. Promotores recebem o desconto de recompra; os demais falam com o time.',
    36,
    'Serviço finalizado! De 0 a 10, o quanto você recomendaria a {{system.businessName | "nossa equipe"}} para alguém?',
    'Valeu demais! 🔧 Seu próximo serviço tem 10% de desconto, já deixei anotado aqui no seu cadastro.',
    'Obrigado por contar. Quero entender o que não ficou bom. Já vou te passar pra alguém do time.'),

  // ═══════════════════════════ CLINICA_MEDICA ═══════════════════════════
  T('CLINICA_MEDICA', 'BOAS_VINDAS_QUALIFICACAO',
    'Clínica médica: Triagem + Agendamento',
    'Descobre a especialidade e o convênio e encaminha para a recepção montar a agenda. A IA nunca orienta clinicamente.',
    [
      start('1', 100, 60, 'Lead chegou'),
      msg('2', 100, 180, 'Saudação', 'Olá! Sou o assistente da {{system.businessName | "clínica"}}. Vou organizar seu atendimento em um minutinho.'),
      ai('3', 100, 300, 'IA faz a triagem', 'Descubra qual especialidade a pessoa procura, se é primeira consulta ou retorno, e se vai usar convênio ou particular. Uma pergunta por vez. NUNCA dê orientação médica, diagnóstico, interpretação de exame nem sugestão de medicamento. Se a pessoa relatar dor no peito, falta de ar, desmaio, sangramento intenso ou qualquer sinal de emergência, oriente imediatamente a procurar um pronto-socorro ou ligar 192 e passe a conversa para uma pessoa da equipe.'),
      tag('4', 100, 420, 'Marca triagem', 'triagem-feita'),
      msg('5', 100, 540, 'Encaminha', 'Obrigado! Já tenho o que preciso. A recepção vai confirmar o melhor horário com você.'),
      human('6', 100, 660, 'Recepção agenda'),
    ],
    [e('1', '2'), e('2', '3'), e('3', '4'), e('4', '5'), e('5', '6')],
    'FIRST_CONTACT', 37),

  T('CLINICA_MEDICA', 'AGENDAMENTO_RECUPERACAO',
    'Clínica médica: Confirmação de consulta 24h',
    'Vinte e quatro horas antes, confirma a consulta, envia o preparo e libera a vaga quando alguém desmarca.',
    [
      start('1', 100, 60, '24h antes'),
      buttons('2', 100, 180, 'Lembrete', 'Olá! Sua consulta é amanhã. Podemos confirmar?', [
        { id: 'sim', title: 'Confirmar' },
        { id: 'remarcar', title: 'Preciso remarcar' },
      ]),
      cond('3', 100, 320, 'Confirmou?'),
      msg('4a', 0, 460, 'Confirmado + preparo', 'Confirmado! 💙 Leve um documento com foto e a carteirinha do convênio. Se for exame com preparo, siga as orientações que a recepção enviou.'),
      tag('5a', 0, 580, 'Consulta confirmada', 'consulta-confirmada'),
      tag('4b', 240, 460, 'Liberar a vaga', 'quer-remarcar'),
      human('5b', 240, 580, 'Recepção remarca'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'remarcar'), eels('3', '4a'),
      e('4a', '5a'), e('4b', '5b'),
    ],
    'TIMEOUT_24H', 38),

  npsTemplate('CLINICA_MEDICA',
    'Clínica médica: NPS pós-consulta',
    'Depois da consulta, pergunta a nota. Promotores recebem o convite do Doctoralia; os demais falam com a ouvidoria.',
    39,
    'Como foi seu atendimento hoje? De 0 a 10, o quanto você recomendaria a {{system.businessName | "nossa clínica"}} para alguém?',
    'Que bom saber! 💙 Se puder registrar sua experiência no Doctoralia, ajuda outros pacientes a escolherem com confiança: {{vars.link_doctoralia | "(coloque aqui o link do seu perfil no Doctoralia)"}}',
    'Obrigado pela sinceridade. Quero entender o que não foi bem. Já vou te passar para a nossa ouvidoria.'),

  // ═══════════════════════════ CONTABILIDADE ═══════════════════════════
  T('CONTABILIDADE', 'BOAS_VINDAS_QUALIFICACAO',
    'Contabilidade: Qualifica porte + Reunião',
    'Separa quem já tem empresa de quem vai abrir, entende o porte e encaminha para a reunião com o contador.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Saudação', 'Olá! Sou o assistente da {{system.businessName | "contabilidade"}}. Você já tem empresa aberta ou está começando agora?', [
        { id: 'tenho', title: 'Já tenho empresa' },
        { id: 'abrir', title: 'Quero abrir' },
      ]),
      cond('3', 100, 320, 'Já tem empresa?'),
      tag('4a', 0, 460, 'Troca de contador', 'troca-de-contador'),
      tag('4b', 240, 460, 'Abertura de empresa', 'abertura-empresa'),
      ai('5', 100, 600, 'IA qualifica o porte', 'Descubra o porte e o regime da empresa (MEI, Simples, Lucro Presumido), o setor e quantos funcionários tem. Se a pessoa vai abrir agora, descubra o ramo pretendido. Uma pergunta por vez. Nunca dê orientação fiscal, tributária ou contábil e não estime imposto nem honorário: quem faz isso é o contador na reunião.'),
      msg('6', 100, 720, 'Convida pra reunião', 'Perfeito. O próximo passo é uma conversa com um dos nossos contadores pra montar a melhor estrutura pro seu caso. Quer que eu veja os horários?'),
      human('7', 100, 840, 'Contador assume'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'abrir'), eels('3', '4a'),
      e('4a', '5'), e('4b', '5'), e('5', '6'), e('6', '7'),
    ],
    'FIRST_CONTACT', 40),

  T('CONTABILIDADE', 'AGENDAMENTO_RECUPERACAO',
    'Contabilidade: Aviso de vencimento em 5 dias',
    'Cinco dias antes do vencimento, avisa sobre a guia e leva quem tem dúvida direto ao time.',
    [
      start('1', 100, 60, 'Imposto vence em 5 dias'),
      buttons('2', 100, 180, 'Aviso', 'Olá! Sua guia vence em 5 dias. Depois do vencimento entram multa e juros. Está tudo certo por aí?', [
        { id: 'ok', title: 'Já vou pagar' },
        { id: 'duvida', title: 'Tenho uma dúvida' },
      ]),
      cond('3', 100, 320, 'Tem dúvida?'),
      msg('4a', 0, 460, 'Tudo certo', 'Perfeito! Qualquer coisa, é só chamar por aqui. 📊'),
      tag('4b', 240, 460, 'Dúvida na guia', 'duvida-guia'),
      human('5b', 240, 580, 'Time responde'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4b', 'dúvida'), eels('3', '4a'),
      e('4b', '5b'),
    ],
    'CUSTOM', 41),

  npsTemplate('CONTABILIDADE',
    'Contabilidade: NPS mensal',
    'Todo mês pergunta a nota para a carteira. Promotores viram indicação; os demais falam com o responsável.',
    42,
    'Fechamos mais um mês juntos. De 0 a 10, o quanto você recomendaria a {{system.businessName | "nossa contabilidade"}} para outro empresário?',
    'Que bom saber! 📊 Se conhece algum empresário precisando de contador, sua indicação é muito bem-vinda.',
    'Agradeço a sinceridade. Quero entender o que podemos melhorar. Já vou te passar para o responsável pela sua conta.'),

  // ═══════════════════════════ OFICINA ═══════════════════════════
  T('OFICINA', 'BOAS_VINDAS_QUALIFICACAO',
    'Oficina: Diagnóstico + Orçamento',
    'Coleta o modelo do carro e o sintoma e encaminha para o mecânico avaliar.',
    [
      start('1', 100, 60, 'Lead chegou'),
      msg('2', 100, 180, 'Saudação', 'Fala! Sou o assistente da {{system.businessName | "oficina"}}. Me conta o modelo do carro e o que está acontecendo. 🔧'),
      ai('3', 100, 300, 'IA coleta o sintoma', 'Descubra o modelo e o ano do carro, o sintoma (barulho, luz no painel, vazamento, perda de força) e há quanto tempo aparece. Uma pergunta por vez. Nunca dê diagnóstico nem estime valor ou prazo e não oriente reparo por conta própria: quem avalia é o mecânico. Se o relato envolver freio, direção ou fumaça, oriente a não dirigir e a chamar um guincho.'),
      tag('4', 100, 420, 'Marca diagnóstico', 'quer-diagnostico'),
      msg('5', 100, 540, 'Encaminha', 'Beleza! Já passei tudo pro nosso mecânico. Ele vai te falar o que precisa ser feito e quanto fica antes de qualquer serviço.'),
      human('6', 100, 660, 'Mecânico assume'),
    ],
    [e('1', '2'), e('2', '3'), e('3', '4'), e('4', '5'), e('5', '6')],
    'FIRST_CONTACT', 43),

  T('OFICINA', 'AGENDAMENTO_RECUPERACAO',
    'Oficina: Lembrete de revisão',
    'Seis meses depois do último serviço, convida para a revisão e passa quem aceita para o time.',
    [
      start('1', 100, 60, '6 meses após o serviço'),
      buttons('2', 100, 180, 'Convida pra revisão', 'Fala! Já faz 6 meses do último serviço no seu carro. 🚗 Revisão em dia evita conserto caro lá na frente. Quer agendar?', [
        { id: 'sim', title: 'Quero agendar' },
        { id: 'nao', title: 'Agora não' },
      ]),
      cond('3', 100, 320, 'Aceitou?'),
      tag('4a', 0, 460, 'Quer revisão', 'quer-revisao'),
      human('5a', 0, 580, 'Time agenda'),
      msg('4b', 240, 460, 'Agora não', 'Tranquilo! Quando precisar, é só chamar. 🔧'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'agendar'), eels('3', '4b'),
      e('4a', '5a'),
    ],
    'CUSTOM', 44),

  npsTemplate('OFICINA',
    'Oficina: NPS pós-serviço',
    'Depois do serviço, pergunta a nota. Promotores recebem o desconto de recompra; os demais falam com o time.',
    45,
    'Serviço entregue! De 0 a 10, o quanto você recomendaria a {{system.businessName | "nossa oficina"}} para um amigo?',
    'Valeu! 🔧 Seu próximo serviço tem 5% de desconto, já deixei anotado no seu cadastro.',
    'Obrigado por falar a real. Quero entender o que não ficou bom. Já vou te passar pra alguém do time.'),

  // ═══════════════════════════ AGENCIA_DIGITAL ═══════════════════════════
  T('AGENCIA_DIGITAL', 'BOAS_VINDAS_QUALIFICACAO',
    'Agência: Qualificação de MQL + Discovery',
    'Qualifica o lead pelo serviço e pelo porte, pontua e leva ao closer para a call de discovery.',
    [
      start('1', 100, 60, 'Lead chegou'),
      buttons('2', 100, 180, 'Saudação', 'Olá! Sou o assistente da {{system.businessName | "agência"}}. O que você procura agora?', [
        { id: 'trafego', title: 'Tráfego pago' },
        { id: 'social', title: 'Social media' },
        { id: 'outro', title: 'Outro serviço' },
      ]),
      cond('3', 100, 320, 'Qual serviço?'),
      tag('4a', 0, 460, 'Tráfego pago', 'servico-trafego'),
      tag('4b', 240, 460, 'Social media', 'servico-social'),
      tag('4c', 480, 460, 'Outro serviço', 'servico-outro'),
      ai('5', 100, 600, 'IA qualifica MQL', 'Descubra o faturamento aproximado, se já investe em mídia hoje e quanto, e qual o objetivo com o serviço. Uma pergunta por vez, sem soar interrogatório. Não prometa resultado, prazo nem valor de proposta: isso é da call de discovery.'),
      lead('6', 100, 720, 'Pontua o lead', 'leadScore', 70),
      msg('7', 100, 840, 'Convida pra discovery', 'Show! O próximo passo é uma call de discovery de 30 minutos pra desenhar a estratégia pro seu caso. Quer ver os horários?'),
      human('8', 100, 960, 'Closer assume'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'tráfego'), ekw('3', '4b', 'social'), eels('3', '4c'),
      e('4a', '5'), e('4b', '5'), e('4c', '5'), e('5', '6'), e('6', '7'), e('7', '8'),
    ],
    'FIRST_CONTACT', 46),

  T('AGENCIA_DIGITAL', 'AGENDAMENTO_RECUPERACAO',
    'Agência: Resgate de proposta enviada',
    'Cinco dias depois da proposta sem resposta, reabre a conversa e faz a objeção aparecer.',
    [
      start('1', 100, 60, 'Proposta enviada há 5 dias'),
      buttons('2', 100, 180, 'Reabre', 'Oi! Te mandei nossa proposta faz uns dias. Sem pressão nenhuma: prefiro entender o que faz sentido pra você. Como está aí?', [
        { id: 'avancar', title: 'Quero avançar' },
        { id: 'duvida', title: 'Tenho dúvidas' },
        { id: 'nao', title: 'Não vamos seguir' },
      ]),
      cond('3', 100, 320, 'Qual a resposta?'),
      tag('4a', 0, 460, 'Quer avançar', 'proposta-aceita'),
      human('5a', 0, 580, 'Closer fecha'),
      ai('4b', 240, 460, 'IA trata a objeção', 'A pessoa tem dúvidas sobre a proposta. Descubra qual é a real objeção (preço, prazo, escopo, confiança no resultado, momento da empresa) fazendo uma pergunta por vez. Não dê desconto, não mude escopo e não prometa resultado: registre a objeção e passe pro closer.'),
      human('5b', 240, 580, 'Closer responde'),
      tag('4c', 480, 460, 'Perdido', 'proposta-recusada'),
      msg('5c', 480, 580, 'Encerra bem', 'Agradeço o retorno! Se o momento mudar, é só chamar. 👊'),
    ],
    [
      e('1', '2'), e('2', '3'),
      ekw('3', '4a', 'avançar'), ekw('3', '4c', 'não vamos'), eels('3', '4b'),
      e('4a', '5a'), e('4b', '5b'), e('4c', '5c'),
    ],
    'CUSTOM', 47),

  npsTemplate('AGENCIA_DIGITAL',
    'Agência: NPS mensal da carteira',
    'Todo mês pergunta a nota para os clientes de retainer. Promotores viram indicação; os demais falam com o gestor.',
    48,
    'Fechamos mais um mês de trabalho juntos. De 0 a 10, o quanto você recomendaria a {{system.businessName | "nossa agência"}} para outro empresário?',
    'Que bom saber! 🚀 Se conhece alguém que precisa crescer no digital, sua indicação vale muito pra gente.',
    'Agradeço a franqueza. Quero entender o que não está entregando o que você esperava. Já vou te passar para o gestor da sua conta.'),
];
