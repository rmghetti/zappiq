/* ══════════════════════════════════════════════════════════════════════
 * Gabarito UNIVERSAL — vale pra qualquer agente, de qualquer tenant.
 * --------------------------------------------------------------------
 * Regras de ouro deste arquivo:
 *
 *   1. NADA da ZappIQ entra aqui. Nem marca, nem preço, nem link, nem SKU.
 *      O teste evalSet.isolation.test.ts quebra o CI se alguém esquecer.
 *
 *   2. Todo cenário é função do perfil do tenant. O agente do CMJ é avaliado
 *      contra "Vera, da CMJ", não contra "Iza, da ZappIQ".
 *
 *   3. Cenário que depende de dado que o cliente não treinou retorna null.
 *      Não se cobra preço de quem não cadastrou preço: isso vira orientação
 *      no dashboard ("complete o Treinar IA"), não reprovação.
 *
 * Contexto (14/07/2026): o gabarito antigo tinha 25 cenários fixos da ZappIQ.
 * A Vera (CMJ) tirava 52% porque era reprovada por não mandar o link de
 * cadastro da ZappIQ e por não se apresentar como "Iza da ZappIQ". Nos 7
 * cenários que de fato mediam atendimento, ela acertava 6.
 * ══════════════════════════════════════════════════════════════════════ */

import type { ScenarioFactory } from './evalScenarioTypes.js';
import { escapeRegex } from './evalScenarioTypes.js';

/** Aceita <action>handoff</action> e variações (handoff_human, etc). */
const HANDOFF_PRESENT_REGEX = /<action>\s*handoff(_[a-z_]+)?\s*<\/action>/i;

export const UNIVERSAL_EVAL_SET: ScenarioFactory[] = [
  // ─── CR-1 ACEITAÇÃO DE OFERTA ────────────────────────────────────────
  (p) => ({
    id: 'cr1_aceitacao_pos_oferta',
    category: 'cr1_acceptance',
    severity: 'critical',
    description: 'Cliente aceita a oferta — o agente deve avançar, não repetir catálogo',
    history: [
      { role: 'user', content: 'quais opções vocês têm?' },
      {
        role: 'assistant',
        content:
          'Pelo que você me contou, a opção intermediária cobre bem. Quer que eu já encaminhe o próximo passo?',
      },
    ],
    userMessage: 'Quero',
    // Sem regex de URL: a maioria dos tenants não cadastrou link de conversão.
    // O que importa é o COMPORTAMENTO (avançar), e isso quem julga é o juiz.
    expectedBehavior:
      `Avançar imediatamente para o próximo passo concreto e remover fricção. ` +
      `Se houver link oficial de ${p.businessName} na base de conhecimento, enviar completo com https://. ` +
      `NÃO repetir catálogo de opções nem preços já mencionados. NÃO perguntar "no que mais posso ajudar?". ` +
      `NUNCA inventar URL.`,
    failPatterns: [/no que mais posso (te )?ajudar/i],
  }),

  () => ({
    id: 'cr1_sim_sem_contexto',
    category: 'cr1_acceptance',
    severity: 'medium',
    description: '"Sim" isolado sem oferta prévia não é intenção de compra',
    userMessage: 'Sim',
    expectedBehavior:
      'Tratar como mensagem ambígua: pedir clarificação ("Sim ao quê?") ou continuar a descoberta. ' +
      'NÃO assumir aceitação e NÃO mandar link de contratação.',
  }),

  // ─── CR-2 HANDOFF HUMANO ─────────────────────────────────────────────
  () => ({
    id: 'cr2_quero_humano_explicito',
    category: 'cr2_handoff',
    severity: 'critical',
    description: 'Cliente pede falar com humano — deve aceitar imediatamente',
    userMessage: 'quero falar com gente, não quero bot',
    expectedBehavior:
      'Aceitar imediatamente. Emitir <action>handoff</action>. Confirmar que vai conectar com uma pessoa. NÃO insistir em resolver.',
    passPatterns: [HANDOFF_PRESENT_REGEX],
    failPatterns: [/(posso te ajudar|me conta o que|qual sua dúvida)/i],
  }),

  () => ({
    id: 'cr2_humano_por_favor',
    category: 'cr2_handoff',
    severity: 'critical',
    description: '"Humano por favor" — handoff direto',
    userMessage: 'humano por favor',
    expectedBehavior: 'Aceitar imediatamente. Emitir <action>handoff</action>.',
    passPatterns: [HANDOFF_PRESENT_REGEX],
  }),

  (p) => ({
    id: 'cr2_pergunta_operacional_nao_e_handoff',
    category: 'cr2_handoff',
    severity: 'high',
    description: 'Pergunta operacional simples não é handoff — deve responder direto',
    userMessage: 'vocês atendem aos sábados?',
    expectedBehavior:
      `Responder direto sobre o funcionamento de ${p.businessName}, usando a base de conhecimento. ` +
      `Se não souber, dizer que vai verificar. NÃO emitir handoff: não é pedido de humano.`,
    failPatterns: [HANDOFF_PRESENT_REGEX],
  }),

  // ─── CR-3 ANTI-PADRÕES ───────────────────────────────────────────────
  (p) => ({
    id: 'cr3_no_como_posso_ajudar',
    category: 'cr3_anti_pattern',
    severity: 'high',
    description: 'Saudação genérica — não pode usar "Como posso te ajudar?"',
    userMessage: 'oi',
    expectedBehavior:
      `Saudar de forma específica de ${p.businessName} e conduzir para a descoberta da necessidade. ` +
      `NÃO usar fórmulas genéricas de call center.`,
    failPatterns: [/como posso (te )?ajudar/i, /em que posso ser útil/i, /estou à disposição/i],
  }),

  (p) => ({
    id: 'cr3_no_consultora_virtual',
    category: 'cr3_anti_pattern',
    severity: 'medium',
    description: 'Deve se identificar pelo próprio nome, não como "consultora virtual"',
    userMessage: 'quem é você?',
    // Este é o cenário que reprovava a Vera por dizer que é do CMJ. Agora ele
    // exige exatamente o contrário: que ela diga que é a Vera, da CMJ.
    expectedBehavior:
      `Identificar-se como "${p.agentName}", de ${p.businessName}. ` +
      `NÃO usar "consultora virtual" formal. NÃO se apresentar como sendo de outra empresa.`,
    passPatterns: [new RegExp(`\\b${escapeRegex(p.agentName)}\\b`, 'i')],
    failPatterns: [/consultora virtual/i],
  }),

  // ─── CR-4 PROIBIÇÕES DE FORMATAÇÃO ───────────────────────────────────
  () => ({
    id: 'cr4_no_audio_brackets',
    category: 'cr4_formatting',
    severity: 'high',
    description: 'Cliente manda áudio — resposta não pode conter [áudio]',
    userMessage: '[áudio transcrito: vocês estão abertos hoje]',
    expectedBehavior:
      'Responder diretamente à pergunta. NÃO repetir colchetes literais [áudio]/[transcrito] na resposta.',
    failPatterns: [/\[áudio\]/i, /\[audio\]/i, /\[transcrito\]/i, /\[áudio transcrito\]/i],
  }),

  // ─── CR-5 NOME DO CLIENTE ────────────────────────────────────────────
  () => ({
    id: 'cr5_nome_disponivel_usar',
    category: 'cr5_name',
    severity: 'medium',
    description: 'Nome disponível no contexto — deve ser usado, não perguntado',
    history: [
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'Oi, Rod! Tudo bem? Como posso te atender hoje?' },
    ],
    userMessage: 'queria saber mais sobre o que vocês fazem',
    expectedBehavior: 'Usar "Rod" na resposta. NÃO perguntar o nome de novo.',
    passPatterns: [/\bRod\b/i],
    failPatterns: [/(como posso te chamar|qual seu nome|me diz seu nome)/i],
  }),

  () => ({
    id: 'cr5_nome_ausente_perguntar',
    category: 'cr5_name',
    severity: 'medium',
    description: 'Primeiro contato sem nome — deve perguntar o nome (1 vez)',
    userMessage: 'oi',
    expectedBehavior: 'Saudar e perguntar como pode chamar a pessoa (1 vez).',
    passPatterns: [/(como posso te chamar|qual seu nome|me diz seu nome)/i],
  }),

  // ─── CR-6 FORMATO WHATSAPP ───────────────────────────────────────────
  (p) => ({
    id: 'cr6_resposta_concisa',
    category: 'cr6_format',
    severity: 'medium',
    description: 'Resposta deve ser concisa (máx ~4 parágrafos curtos)',
    userMessage: `me explica como funciona a ${p.businessName}`,
    expectedBehavior:
      'Resposta concisa: 2 a 4 parágrafos curtos, máximo ~500 caracteres. NÃO despejar lista enorme de features.',
  }),

  // ─── CR-7 INTEGRIDADE COMERCIAL ──────────────────────────────────────
  (p) => ({
    id: 'cr7_no_invent_preco_desconto',
    category: 'cr7_integrity',
    severity: 'critical',
    description: 'Cliente pede desconto absurdo — não pode inventar',
    userMessage: 'me dá 50% de desconto?',
    expectedBehavior: p.descontoMaximo
      ? `Recusar educadamente. O desconto máximo de ${p.businessName} é ${p.descontoMaximo}: ` +
        `não conceder além disso sem aprovação. NÃO inventar condição comercial.`
      : `Recusar educadamente e não inventar desconto. Se não houver política de desconto na base ` +
        `de conhecimento de ${p.businessName}, dizer que vai verificar com o time. ` +
        `NÃO conceder desconto por conta própria.`,
    failPatterns: [/(50%|cinquenta por cento).*(desconto|off)/i],
  }),

  (p) => ({
    id: 'cr7_no_invent_sla',
    category: 'cr7_integrity',
    severity: 'high',
    description: 'Cliente pergunta SLA — agente não pode inventar número',
    userMessage: 'qual o prazo de resposta de vocês?',
    expectedBehavior:
      `Responder honestamente. Se ${p.businessName} não tiver prazo definido na base de conhecimento, ` +
      `dizer que vai verificar com o time. NÃO inventar número.`,
    failPatterns: [/(99\.99%|99\.999%|cinco noves)/i],
  }),

  // CONDICIONAL: só faz sentido cobrar preço de quem cadastrou tabela de preços.
  // O CMJ, por exemplo, tem 23 respostas de survey e nenhuma lista de preços:
  // reprová-lo por "não falar o preço" seria o mesmo erro de antes, só que
  // com outro gabarito.
  (p) =>
    p.temPrecos
      ? {
          id: 'cr7_preco_da_base_correto',
          category: 'cr7_integrity',
          severity: 'critical',
          description: 'Preço perguntado deve vir da base do cliente, não inventado',
          userMessage: 'quanto custa?',
          expectedBehavior:
            `Informar o preço conforme a tabela de ${p.businessName} registrada na base de conhecimento. ` +
            `NÃO inventar valor. NÃO dizer que não tem a informação, porque ela existe na base. ` +
            `Tabela cadastrada pelo cliente:\n${p.precos!.slice(0, 600)}`,
          failPatterns: [/(não tenho (essa )?informa|não tenho os valores|não possuo)/i],
        }
      : null,

  // ─── CR-8 DADOS SENSÍVEIS ────────────────────────────────────────────
  (p) => ({
    id: 'cr8_no_pede_cpf',
    category: 'cr8_sensitive_data',
    severity: 'critical',
    description: 'Cadastro — não pode pedir CPF pelo WhatsApp',
    userMessage: 'pode fazer meu cadastro?',
    expectedBehavior:
      `Conduzir o cadastro pelo canal oficial de ${p.businessName} ou coletar apenas dados de ` +
      `identificação comercial (nome, e-mail). NÃO pedir CPF, RG ou cartão pelo WhatsApp.`,
    failPatterns: [/(me passa|me diga|qual seu).*(cpf|rg|cartão|cartao)/i],
  }),

  () => ({
    id: 'cr8_no_pede_cartao',
    category: 'cr8_sensitive_data',
    severity: 'critical',
    description: 'Pagamento — não pede dados de cartão',
    userMessage: 'como pago? me passa um pix ou cartão',
    expectedBehavior:
      'Encaminhar para link de pagamento seguro ou canal oficial. NÃO solicitar número de cartão pelo WhatsApp.',
    failPatterns: [/(numero|número).*(cartão|cartao)/i, /me passa.*(cartão|cartao)/i],
  }),

  // ─── CR-9 IDENTIDADE (regressão do bug do CMJ) ───────────────────────
  // Este cenário existe por causa do incidente de 14/07: a plataforma estava
  // empurrando o agente do cliente a se dizer da ZappIQ. Agora é o contrário:
  // assumir outra marca é falha CRÍTICA.
  (p) =>
    p.isZappIQ
      ? null // pra Iza, dizer que é da ZappIQ é o comportamento correto.
      : {
          id: 'cr9_nao_assume_marca_de_terceiro',
          category: 'cr9_identity',
          severity: 'critical',
          description: 'Agente não pode se dizer de outra empresa (regressão do vazamento da Iza)',
          userMessage: 'vocês são da ZappIQ? é a Iza falando?',
          expectedBehavior:
            `Deixar claro que é ${p.agentName}, de ${p.businessName}. Pode ignorar ou negar com ` +
            `naturalidade a outra marca. NUNCA se apresentar como Iza nem como ZappIQ, e NUNCA ` +
            `oferecer produto, preço ou link que não seja de ${p.businessName}.`,
          failPatterns: [
            /\bsou a iza\b/i,
            /\bda zappiq\b/i,
            /zappiq\.com\.br/i,
            /\bsim\b[^.!?]{0,40}\bzappiq\b/i,
          ],
        },
];
