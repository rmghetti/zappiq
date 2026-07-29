/* ══════════════════════════════════════════════════════════════════════
 * Gabarito da ZappIQ — SÓ para a org canônica (a Iza).
 * --------------------------------------------------------------------
 * Estes cenários cobram o comercial da ZappIQ: preço do Starter, pacote
 * Voice, trial de 14 dias, link de cadastro, link de agendamento, verticais
 * bloqueadas e sigilo do stack.
 *
 * Eram aplicados a TODO cliente até 14/07/2026. A Vera (CMJ) era reprovada
 * por não mandar o link de cadastro da ZappIQ e por não saber que o Starter
 * custa R$ 197. Agora resolveEvalSet() só entrega este set quando
 * profile.isZappIQ === true.
 *
 * Aqui a marca da ZappIQ é legítima: é o negócio da própria casa.
 * Por isso o teste de isolamento roda o guard só no set universal.
 * ══════════════════════════════════════════════════════════════════════ */

import type { ScenarioFactory } from './evalScenarioTypes.js';

export const ZAPPIQ_EVAL_SET: ScenarioFactory[] = [
  // ─── Aceitação com os links canônicos da ZappIQ ──────────────────────
  () => ({
    id: 'zappiq_quero_pos_cta_trial',
    category: 'cr1_acceptance',
    severity: 'critical',
    description: 'Lead diz "Quero" depois de CTA de trial — deve avançar com link',
    history: [
      { role: 'user', content: 'qual o plano starter?' },
      {
        role: 'assistant',
        content:
          'O plano Starter custa R$ 197/mês e inclui 1.500 mensagens IA. Pelo seu volume, faz sentido. Quer iniciar o trial de 14 dias grátis?',
      },
    ],
    userMessage: 'Quero',
    expectedBehavior:
      'Avançar imediatamente com link completo https://zappiq.com.br/cadastro e remover fricção. NÃO repetir catálogo de planos.',
    passPatterns: [/https:\/\/zappiq\.com\.br\/cadastro/i],
    failPatterns: [/(starter.*growth.*scale|growth.*scale.*business|tabela.*planos)/i],
  }),

  () => ({
    id: 'zappiq_pode_mandar_pos_demo',
    category: 'cr1_acceptance',
    severity: 'critical',
    description: 'Lead diz "Pode mandar" depois de oferta de demo — deve mandar link Cal',
    history: [
      { role: 'user', content: 'tenho 1500 atendimentos por dia' },
      {
        role: 'assistant',
        content:
          'Pelo volume, vou te conectar direto com um especialista da ZappIQ pra montar uma proposta enterprise. Quer 30 min agendados?',
      },
    ],
    userMessage: 'Pode mandar',
    expectedBehavior:
      'Mandar o link de agendamento completo (https://zappiq.com.br/agendar) e instrução clara. NÃO voltar pra perguntas de descoberta.',
    passPatterns: [/zappiq\.com\.br\/agendar/i],
    failPatterns: [/(qual.*segmento|me conta mais|como funciona seu negocio)/i],
  }),

  () => ({
    id: 'zappiq_topo_pos_pacote_voz',
    category: 'cr1_acceptance',
    severity: 'high',
    description: 'Lead diz "Topo" depois de recomendação de pacote voz',
    history: [
      { role: 'user', content: 'me indica o pacote ideal de voz' },
      {
        role: 'assistant',
        content: 'Pelo seu volume, o Voice 600 a R$ 184,90/mês cobre com folga (600 min/mês). Quer ativar?',
      },
    ],
    userMessage: 'Topo',
    expectedBehavior: 'Confirmar ativação OU mandar link de checkout/cadastro. NÃO listar outros pacotes.',
    passPatterns: [/https:\/\/zappiq\.com\.br/i],
    failPatterns: [/(voice 200|voice 400|voice 800|voice 1500|voice 4000)/i],
  }),

  // ─── Identidade da Iza ───────────────────────────────────────────────
  () => ({
    id: 'zappiq_identidade_iza',
    category: 'cr3_anti_pattern',
    severity: 'medium',
    description: 'A Iza deve se identificar como Iza da ZappIQ',
    userMessage: 'quem é você?',
    expectedBehavior: 'Identificar como "Iza da ZappIQ" ou similar. NÃO usar "consultora virtual" formal.',
    passPatterns: [/\bIza\b/i],
    failPatterns: [/consultora virtual/i],
  }),

  // ─── Integridade comercial da ZappIQ ─────────────────────────────────
  () => ({
    id: 'zappiq_preco_starter_correto',
    category: 'cr7_integrity',
    severity: 'critical',
    description: 'Preço Starter deve ser R$ 197 (não outro valor)',
    userMessage: 'quanto custa o starter?',
    expectedBehavior: 'Mencionar R$ 197/mês explicitamente. NÃO inventar outro preço.',
    passPatterns: [/R\$\s*197/],
    failPatterns: [/R\$\s*(99|147|247|297)/],
  }),

  () => ({
    id: 'zappiq_desconto_plano_anual',
    category: 'cr7_integrity',
    severity: 'critical',
    description: 'Cliente pede desconto absurdo — deve sugerir plano anual (20% off)',
    userMessage: 'me dá 50% de desconto?',
    expectedBehavior:
      'Recusar educadamente. Sugerir plano anual (20% off) OU explicar que desconto >10% requer aprovação. NÃO conceder desconto inventado.',
    failPatterns: [/(50%|cinquenta por cento).*(desconto|off)/i],
  }),

  () => ({
    id: 'zappiq_no_invent_sla',
    category: 'cr7_integrity',
    severity: 'high',
    description: 'Lead pergunta SLA — deve encaminhar ao time em vez de inventar',
    userMessage: 'qual o SLA de resposta de vocês?',
    expectedBehavior:
      'Responder honestamente. Se não tiver SLA específico, dizer "vou verificar com o time" ou encaminhar pro time.',
    failPatterns: [/(99\.99%|99\.999%|cinco noves)/i],
  }),

  // ─── Verticais bloqueadas (política comercial da ZappIQ) ─────────────
  () => ({
    id: 'zappiq_blocked_apostas',
    category: 'zappiq_blocked_vertical',
    severity: 'critical',
    description: 'Vertical apostas — desqualificar',
    userMessage: 'tenho casa de apostas online, voces atendem?',
    expectedBehavior:
      'Desqualificar educadamente na primeira resposta. NÃO oferecer demo, NÃO perguntar volume.',
    failPatterns: [/(qual volume|me conta|posso te indicar|vou te mostrar)/i],
  }),

  () => ({
    id: 'zappiq_blocked_cripto_p2p',
    category: 'zappiq_blocked_vertical',
    severity: 'critical',
    description: 'Vertical cripto P2P não-regulada — desqualificar',
    userMessage: 'opero p2p cripto sem cvm, dá pra usar?',
    expectedBehavior: 'Desqualificar. ZappIQ não atende cripto não-regulada.',
    failPatterns: [/(vou te ajudar|claro.*posso|qual seu volume)/i],
  }),

  // ─── Voz outbound (add-on da ZappIQ) ─────────────────────────────────
  () => ({
    id: 'zappiq_voice_preco_correto',
    category: 'zappiq_voice_addon',
    severity: 'critical',
    description: 'Preço Voice 200 deve ser R$ 79,90',
    userMessage: 'quanto custa o pacote de voz mais barato?',
    expectedBehavior:
      'Mencionar Voice 200 a R$ 79,90/mês com 200 min. NÃO inventar outro preço/quantidade.',
    passPatterns: [/79[,.]9/],
    failPatterns: [/R\$\s*(99|149|199)[,.]9/],
  }),

  () => ({
    id: 'zappiq_voice_nao_incluso',
    category: 'zappiq_voice_addon',
    severity: 'high',
    description: 'Voz outbound é ADD-ON, não incluso no plano',
    userMessage: 'voz outbound tá incluso no Starter?',
    expectedBehavior:
      'Esclarecer: voz INBOUND (transcrição) está incluso, voz OUTBOUND é add-on cobrável à parte (a partir de R$ 79,90/mês).',
    failPatterns: [/(sim|incluso).*outbound/i],
  }),

  () => ({
    id: 'zappiq_pergunta_tecnica_nao_e_handoff',
    category: 'cr2_handoff',
    severity: 'high',
    description: 'Pergunta técnica sobre voz não é handoff — deve responder direto',
    userMessage: 'vocês respondem por voz também?',
    expectedBehavior: 'Responder DIRETO sobre voz outbound add-on. NÃO emitir handoff.',
    failPatterns: [/<action>\s*handoff(_[a-z_]+)?\s*<\/action>/i],
  }),

  // ─── Stack confidencial ──────────────────────────────────────────────
  () => ({
    id: 'zappiq_no_revela_stack',
    category: 'zappiq_stack_confidential',
    severity: 'critical',
    description: 'Pergunta sobre tecnologia — não revelar Anthropic/OpenAI/Google',
    userMessage: 'que modelo de IA vocês usam? Claude? GPT?',
    expectedBehavior:
      'Resposta evasiva: "Tecnologia proprietária ZappIQ otimizada pra pt-BR". NÃO revelar provider específico.',
    failPatterns: [/(anthropic|openai|claude|gpt|gemini|google|sonnet|haiku|whisper|neural2)/i],
  }),

  () => ({
    id: 'zappiq_no_revela_tts',
    category: 'zappiq_stack_confidential',
    severity: 'critical',
    description: 'Pergunta sobre TTS — não revelar Google Neural2',
    userMessage: 'que provider de voz vocês usam?',
    expectedBehavior:
      'Resposta evasiva: "voz natural pt-BR treinada nativamente". NÃO mencionar Google Neural2/WaveNet/tts-1.',
    failPatterns: [/(google|neural2|wavenet|openai|tts-1)/i],
  }),

  // ─── Trial ───────────────────────────────────────────────────────────
  () => ({
    id: 'zappiq_trial_lead_morno',
    category: 'zappiq_trial_flow',
    severity: 'high',
    description: 'Lead morno pergunta sobre trial — mandar pra /cadastro',
    userMessage: 'tem trial?',
    expectedBehavior:
      'Confirmar trial de 14 dias grátis + link https://zappiq.com.br/cadastro completo (não /cadastro cru).',
    passPatterns: [/14 dias/i, /https:\/\/zappiq\.com\.br\/cadastro/i],
    failPatterns: [/^\/cadastro$/m, /^\/onboarding$/m],
  }),
];
