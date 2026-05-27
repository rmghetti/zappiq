// ─────────────────────────────────────────────────────────
// ZappIQ — Configuração comercial central (2026)
// Fonte única de verdade. Backend, landing, dashboard e
// Stripe Products derivam deste arquivo.
//
// Alinhado com ZappIQ_Modelo_Comercial_2026.docx (v2026.1).
// ─────────────────────────────────────────────────────────

export type PlanId = 'IZA_LITE' | 'STARTER' | 'GROWTH' | 'SCALE' | 'BUSINESS' | 'ENTERPRISE';

export interface PlanLimits {
  /** Atendentes humanos simultâneos (-1 = ilimitado) */
  agents: number;
  /** Mensagens de IA processadas/mês (-1 = ilimitado) */
  aiMessagesPerMonth: number;
  /** Disparos outbound (marketing/utility)/mês (-1 = ilimitado) */
  broadcastsPerMonth: number;
  /** Contatos no CRM (-1 = ilimitado) */
  contacts: number;
  /** Fluxos de automação ativos (-1 = ilimitado) */
  flows: number;
  /** Números WhatsApp Business API (-1 = ilimitado) */
  whatsappNumbers: number;
  /** Documentos na base de conhecimento RAG (-1 = ilimitado) */
  knowledgeBaseDocs: number;
  /** Retenção de logs (dias) */
  logRetentionDays: number;
  /** Integrações nativas habilitadas (-1 = todas) */
  integrations: number;
  /** Horas de integração customizada incluídas/mês */
  customIntegrationHoursPerMonth: number;
}

export interface PlanFeatures {
  echoCopilot: boolean;              // Copiloto de sugestões para agente humano
  radarInsights: boolean;            // Analytics operacional nativo (todos os planos)
  radar360: boolean;                 // BI avançado, cohort, previsão ML (incluído no Enterprise)
  ssoSaml: boolean;                  // SSO SAML 2.0 / OIDC
  apiOpen: boolean;                  // API pública documentada
  whiteLabel: boolean;               // Marca própria no painel
  dedicatedOnboarding: boolean;      // Onboarding guiado por CSM
  dedicatedCsm: boolean;             // Customer Success Manager dedicado
  slaContractual: boolean;           // SLA 99,9% com créditos automáticos
  dedicatedInfra: boolean;           // Pool de infraestrutura isolado
  soc24x7: boolean;                  // SOC/NOC dedicado 24/7
  dpoDirect: boolean;                // DPO como contato direto + ROP customizado
  support: 'email' | 'chat' | 'priority' | 'multichannel-24x7';
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  description: string;
  /** Preço mensal em BRL (null = custom quote) */
  priceMonthly: number | null;
  /** Desconto anual em % (ex: 20) */
  annualDiscountPercent: number;
  /** Sinaliza como destaque na UI */
  highlight: boolean;
  /** Indica tier premium (Enterprise) */
  premium: boolean;
  /** Ordem de exibição */
  order: number;
  /** V4: Trial gratuito em dias (0 = sem trial). Iza Lite usa 14. */
  trialDays?: number;
  /** V4: Plano descontinuado — escondido nos cards de venda (UI filtra). */
  deprecated?: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Bullet points para a UI (descritivos) */
  bullets: string[];
  cta: { label: string; href: string };
}

// ═══════════════════════════════════════════════════════════
// PLANOS
// ═══════════════════════════════════════════════════════════

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  IZA_LITE: {
    id: 'IZA_LITE',
    name: 'Iza Lite',
    tagline: 'Comece em 5 minutos — 14 dias gratis pra validar',
    description:
      'Trial 14 dias gratuito. Apos isso, R\$ 249,00/mes (ou R\$ 199,20/mes no plano anual). Pensado pra autonomo, solo e PME validando o canal antes de escalar pro Growth.',
    priceMonthly: 249.00,
    annualDiscountPercent: 20,
    highlight: true,
    premium: false,
    order: 0,
    trialDays: 14,
    limits: {
      agents: 1,
      aiMessagesPerMonth: 1500,
      broadcastsPerMonth: 200,
      contacts: 1000,
      flows: 3,
      whatsappNumbers: 1,
      knowledgeBaseDocs: 10,
      logRetentionDays: 90,
      integrations: 5,
      customIntegrationHoursPerMonth: 0,
    },
    features: {
      echoCopilot: false,
      radarInsights: true,
      radar360: false,
      ssoSaml: false,
      apiOpen: false,
      whiteLabel: false,
      dedicatedOnboarding: false,
      dedicatedCsm: false,
      slaContractual: false,
      dedicatedInfra: false,
      soc24x7: false,
      dpoDirect: false,
      support: 'email',
    },
    bullets: [
      'TRIAL 14 DIAS GRATIS — apos isso R\$ 249,00/mes',
      'Anual: R\$ 199,20/mes (economiza 20%)',
      '1 atendente humano',
      '1.500 mensagens de IA/mes',
      '200 disparos (utility/marketing)/mes',
      '1.000 contatos no CRM',
      '3 fluxos de automacao (Maestro Inteligente)',
      '1 numero WhatsApp Business + 1 Instagram Direct',
      'Base de conhecimento RAG (10 docs)',
      'Agent Quality (Eval continuo da IA)',
      'Radar Insights (analytics operacional)',
      'Suporte por e-mail',
    ],
    cta: { label: 'Comecar 14 dias gratis', href: '/cadastro?plan=iza_lite' },
  },

  STARTER: {
    id: 'STARTER',
    name: 'Starter (legado)',
    tagline: 'Plano descontinuado em 2026-05-27 — substituido por Iza Lite Trial',
    deprecated: true,
    description:
      'Profissionais liberais, solopreneurs e micro-operações validando o canal WhatsApp com IA.',
    priceMonthly: 197,
    annualDiscountPercent: 20,
    highlight: false,
    premium: false,
    order: 1,
    limits: {
      agents: 3,
      aiMessagesPerMonth: 1500,
      broadcastsPerMonth: 500,
      contacts: 1000,
      flows: 3,
      whatsappNumbers: 1,
      knowledgeBaseDocs: 10,
      logRetentionDays: 90,
      integrations: 5,
      customIntegrationHoursPerMonth: 0,
    },
    features: {
      echoCopilot: false,
      radarInsights: true,
      radar360: false,
      ssoSaml: false,
      apiOpen: false,
      whiteLabel: false,
      dedicatedOnboarding: false,
      dedicatedCsm: false,
      slaContractual: false,
      dedicatedInfra: false,
      soc24x7: false,
      dpoDirect: false,
      support: 'email',
    },
    bullets: [
      '3 atendentes humanos',
      '1.500 mensagens de IA/mês',
      '500 disparos (utility/marketing)/mês',
      '1.000 contatos no CRM',
      '3 fluxos de automação',
      '1 número WhatsApp Business',
      'Base de conhecimento RAG (10 docs)',
      'Radar Insights (analytics operacional)',
      'Suporte por e-mail',
    ],
    cta: { label: 'Começar 14 dias grátis', href: '/cadastro?plan=starter' },
  },

  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    tagline: 'Para equipes em crescimento',
    description:
      'PMEs com equipe de atendimento, pipeline de leads ativo e necessidade de integrações.',
    priceMonthly: 497,
    annualDiscountPercent: 20,
    highlight: true,
    premium: false,
    order: 2,
    limits: {
      agents: 10,
      aiMessagesPerMonth: 8000,
      broadcastsPerMonth: 5000,
      contacts: 10000,
      flows: 15,
      whatsappNumbers: 2,
      knowledgeBaseDocs: 50,
      logRetentionDays: 180,
      integrations: 15,
      customIntegrationHoursPerMonth: 0,
    },
    features: {
      echoCopilot: true,
      radarInsights: true,
      radar360: false,
      ssoSaml: false,
      apiOpen: true,
      whiteLabel: false,
      dedicatedOnboarding: false,
      dedicatedCsm: false,
      slaContractual: false,
      dedicatedInfra: false,
      soc24x7: false,
      dpoDirect: false,
      support: 'chat',
    },
    bullets: [
      '10 atendentes humanos',
      '8.000 mensagens de IA/mês',
      '5.000 disparos/mês',
      '10.000 contatos no CRM',
      '15 fluxos de automação',
      '2 números WhatsApp Business',
      'Echo Copilot (IA sugere para o humano)',
      'API aberta + Webhooks',
      '15 integrações nativas (HubSpot, RD, Pipedrive, Salesforce...)',
      'Suporte por chat (dias úteis)',
    ],
    cta: { label: 'Começar 14 dias grátis', href: '/cadastro?plan=growth' },
  },

  SCALE: {
    id: 'SCALE',
    name: 'Scale',
    tagline: 'Operação seria com KPI auditavel',
    description:
      'Redes, franquias e operacoes multi-time com volume alto, observabilidade avancada, SLA contratual e governanca LGPD madura. Absorve tudo do antigo Business V3.2.',
    priceMonthly: 1497,
    annualDiscountPercent: 20,
    highlight: false,
    premium: false,
    order: 3,
    trialDays: 0,
    limits: {
      agents: 75,
      aiMessagesPerMonth: 80000,
      broadcastsPerMonth: 60000,
      contacts: 200000,
      flows: -1,
      whatsappNumbers: 15,
      knowledgeBaseDocs: -1,
      logRetentionDays: 730,
      integrations: -1,
      customIntegrationHoursPerMonth: 20,
    },
    features: {
      echoCopilot: true,
      radarInsights: true,
      radar360: true,
      ssoSaml: true,
      apiOpen: true,
      whiteLabel: true,
      dedicatedOnboarding: true,
      dedicatedCsm: true,
      slaContractual: true,
      dedicatedInfra: false,
      soc24x7: false,
      dpoDirect: true,
      support: 'priority',
    },
    bullets: [
      '75 atendentes humanos',
      '80.000 mensagens de IA/mes',
      '60.000 disparos/mes',
      '200.000 contatos no CRM',
      '15 numeros WhatsApp Business',
      'Base de conhecimento ilimitada',
      'Radar 360 Observabilidade incluida',
      'SLA contratual 99,9% com creditos automaticos',
      'SSO (SAML 2.0 / OIDC) + auditoria LGPD completa',
      '20h/mes de integracao customizada',
      'White-label + Customer Success Manager dedicado',
      'Retencao de logs: 24 meses',
      'DPO como contato direto + ROP customizado',
      'Suporte prioritario com tempo de resposta garantido',
      'Memory Layer Mem0 (em rollout)',
      'Vision inbound (imagens WA/IG)',
      'Outcome Beta opt-in (Conversa Convertida)',
    ],
    cta: { label: 'Falar com especialista', href: '/contato?plan=scale' },
  },

  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business (legado)',
    tagline: 'Plano descontinuado em 2026-05-27 — funcionalidades absorvidas pelo Scale V4',
    deprecated: true,
    description:
      'Operações de missão crítica que precisam de SLA contratual, observabilidade avançada e governança LGPD madura — sem migrar para um contrato totalmente customizado.',
    priceMonthly: 1997,
    annualDiscountPercent: 20,
    highlight: false,
    premium: false,
    order: 4,
    limits: {
      agents: 75,
      aiMessagesPerMonth: 80000,
      broadcastsPerMonth: 60000,
      contacts: 200000,
      flows: -1,
      whatsappNumbers: 15,
      knowledgeBaseDocs: -1,
      logRetentionDays: 730,
      integrations: -1,
      customIntegrationHoursPerMonth: 20,
    },
    features: {
      echoCopilot: true,
      radarInsights: true,
      radar360: true,
      ssoSaml: true,
      apiOpen: true,
      whiteLabel: true,
      dedicatedOnboarding: true,
      dedicatedCsm: true,
      slaContractual: true,
      dedicatedInfra: false,
      soc24x7: false,
      dpoDirect: true,
      support: 'priority',
    },
    bullets: [
      '75 atendentes humanos',
      '80.000 mensagens de IA/mês',
      '60.000 disparos/mês',
      '200.000 contatos no CRM',
      '15 números WhatsApp Business',
      'Base de conhecimento ilimitada',
      'Radar 360° Observabilidade incluída',
      'SLA contratual 99,9% com créditos automáticos',
      'SSO (SAML 2.0 / OIDC) + auditoria LGPD completa',
      '20h/mês de integração customizada',
      'Retenção de logs: 24 meses',
      'DPO como contato direto + ROP customizado',
      'Customer Success Manager dedicado',
      'Suporte prioritário com tempo de resposta garantido',
    ],
    cta: { label: 'Falar com especialista', href: '/enterprise' },
  },

  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Para operações estratégicas sob medida',
    description:
      'Contrato customizado com infraestrutura isolada, SOC/NOC dedicado 24/7 e governança completa.',
    priceMonthly: null, // sob consulta — baseline do Word doc: a partir de R$ 9.900/mês
    annualDiscountPercent: 10,
    highlight: false,
    premium: true,
    order: 5,
    limits: {
      agents: -1,
      aiMessagesPerMonth: -1,
      broadcastsPerMonth: -1,
      contacts: -1,
      flows: -1,
      whatsappNumbers: -1,
      knowledgeBaseDocs: -1,
      logRetentionDays: 1825, // 5 anos
      integrations: -1,
      customIntegrationHoursPerMonth: 40,
    },
    features: {
      echoCopilot: true,
      radarInsights: true,
      radar360: true,
      ssoSaml: true,
      apiOpen: true,
      whiteLabel: true,
      dedicatedOnboarding: true,
      dedicatedCsm: true,
      slaContractual: true,
      dedicatedInfra: true,
      soc24x7: true,
      dpoDirect: true,
      support: 'multichannel-24x7',
    },
    bullets: [
      'Tudo do Business, sem limites',
      'Infraestrutura isolada (pool dedicado)',
      'SOC / NOC dedicado 24/7',
      'Onboarding white-glove (30 dias)',
      '40h/mês de integração customizada',
      'Retenção de logs: até 5 anos',
      'DPO contato direto + ROP totalmente customizado',
      'Suporte 24/7 multicanal (telefone, chat, e-mail, Slack Connect)',
      'Revisões trimestrais de QBR com roadmap conjunto',
      'Contratos customizados, MSA, DPA e termos específicos',
    ],
    cta: { label: 'Falar com especialista', href: '/enterprise' },
  },
};

// ═══════════════════════════════════════════════════════════
// ADD-ONS (cobrados além do plano base)
// ═══════════════════════════════════════════════════════════

export interface AddonConfig {
  id: string;
  name: string;
  description: string;
  /** Preço mensal em BRL (quando aplicável). Null = por consumo. */
  priceMonthly: number | null;
  /** Texto de preço alternativo (ex: "R$ 0,08 por mensagem") */
  priceLabel?: string;
  /** Em quais planos este add-on faz sentido */
  availableFor: PlanId[];
  /** Se está incluso (sem custo adicional) em planos específicos */
  includedIn: PlanId[];
}

export const ADDONS: Record<string, AddonConfig> = {
  RADAR_360: {
    id: 'RADAR_360',
    name: 'Radar 360° Observabilidade',
    description:
      'BI conversacional com cohort analysis, previsão de pipeline (ML), benchmarking de mercado e alertas proativos. Exporta para Power BI e Looker.',
    priceMonthly: 397,
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: ['BUSINESS', 'ENTERPRISE'],
  },
  EXTRA_WHATSAPP_NUMBER: {
    id: 'EXTRA_WHATSAPP_NUMBER',
    name: 'Número WhatsApp adicional',
    description: 'Número extra conectado à mesma plataforma, com roteamento de fila independente.',
    priceMonthly: 147,
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS'],
    includedIn: [],
  },
  EXTRA_AI_MESSAGES: {
    id: 'EXTRA_AI_MESSAGES',
    name: 'Pacote 10.000 mensagens IA extras',
    description: 'Excedente sobre a cota do plano. Cobrado uma vez por pacote consumido no ciclo.',
    priceMonthly: 197,
    priceLabel: 'R$ 197 / pacote de 10k',
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS'],
    includedIn: [],
  },
  EXTRA_BROADCASTS: {
    id: 'EXTRA_BROADCASTS',
    name: 'Pacote 10.000 disparos extras',
    description:
      'Excedente de disparos outbound. Custo de conversação Meta (utility/marketing) é repassado à parte.',
    priceMonthly: 247,
    priceLabel: 'R$ 247 / pacote de 10k',
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS'],
    includedIn: [],
  },
  EXTRA_AGENT_SEAT: {
    id: 'EXTRA_AGENT_SEAT',
    name: 'Seat adicional de atendente',
    description: 'Usuário extra além do limite do plano.',
    priceMonthly: 89,
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS'],
    includedIn: [],
  },
  CUSTOM_INTEGRATION_HOURS: {
    id: 'CUSTOM_INTEGRATION_HOURS',
    name: 'Horas de integração customizada',
    description: 'Desenvolvimento sob demanda pela squad de arquitetura ZappIQ.',
    priceMonthly: null,
    priceLabel: 'R$ 340 / hora (pacote 10h: R$ 2.900)',
    availableFor: ['GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
  DEDICATED_INFRA: {
    id: 'DEDICATED_INFRA',
    name: 'Infraestrutura isolada (pool dedicado)',
    description:
      'Worker pool e banco dedicados, sem vizinhança multi-tenant. SLA e performance garantidos.',
    priceMonthly: 2200,
    availableFor: ['BUSINESS', 'ENTERPRISE'],
    includedIn: ['ENTERPRISE'],
  },
  SOC_NOC_24X7: {
    id: 'SOC_NOC_24X7',
    name: 'SOC / NOC dedicado 24/7',
    description:
      'Monitoramento ativo com analistas humanos. Incident commander, postmortems formais, status page customizada.',
    priceMonthly: 3800,
    availableFor: ['BUSINESS', 'ENTERPRISE'],
    includedIn: ['ENTERPRISE'],
  },
  EXTENDED_LOG_RETENTION: {
    id: 'EXTENDED_LOG_RETENTION',
    name: 'Retenção estendida de logs (5 anos)',
    description: 'Retenção acima do padrão do plano, para compliance setorial (saúde, financeiro).',
    priceMonthly: 490,
    availableFor: ['SCALE', 'BUSINESS'],
    includedIn: ['ENTERPRISE'],
  },
  // ─────────────────────────────────────────────────────────
  // V4 #161 (PR #72 — 2026-05-04 v4 FINAL): Voice add-ons.
  //
  // CONTEXTO HISTÓRICO COMPLETO:
  //   v1 (PR #70): OpenAI tts-1, R$ 89,90 a R$ 1.299,90, margem ~76%
  //   v2: Google Neural2, R$ 16,90 a R$ 199,90, ERRADO (custo TTS subestimado
  //     5x). Margem real seria 22% a -24% (PREJUÍZO). ARQUIVADO antes de venda.
  //   v3: R$ 46,90 a R$ 558,90, margem 53-70% (média 65%). Substituído por
  //     v4 antes de qualquer venda — Rodrigo decidiu margens mais altas.
  //   v4 (FINAL — ESTE): R$ 79,90 a R$ 929,90, margem 70-80% (média 77,1%).
  //     Curva linear -2pp por pacote. Aprovado Rodrigo 2026-05-04.
  //
  // Provider PRIMÁRIO: Google Cloud TTS Neural2-C ($0.012/min @ 750 chars).
  // Provider FALLBACK: OpenAI tts-1 ($0.015/min) — só dispara se Google falhar.
  //
  // Trial 14d / 30 min em Voice 200 e Voice 400.
  // Hard ceiling 2× minutos inclusos — acima vira conversa Enterprise.
  //
  // Pricing curve estritamente decrescente em R$/min:
  //   Voice 200:  R$ 0,3995/min  (R$ 79,90)   → margem 80,5%
  //   Voice 400:  R$ 0,3448/min  (R$ 137,90)  → margem 78,3%
  //   Voice 600:  R$ 0,3082/min  (R$ 184,90)  → margem 76,2%
  //   Voice 800:  R$ 0,2811/min  (R$ 224,90)  → margem 74,5%
  //   Voice 1500: R$ 0,2533/min  (R$ 379,90)  → margem 72,2%
  //   Voice 4000: R$ 0,2325/min  (R$ 929,90)  → margem 70,2%
  //
  // Overage curve descendente alinhada com margem do pacote:
  //   200/400/600/800/1500/4000 = R$ 0,35 / 0,30 / 0,28 / 0,25 / 0,22 / 0,20
  //
  // Stripe Price IDs v4 LIVE (criados 2026-05-04). v3 arquivados.
  // ─────────────────────────────────────────────────────────
  VOICE_200: {
    id: 'VOICE_200',
    name: 'Voice 200 — add-on de voz outbound (pt-BR Neural)',
    description:
      '200 minutos/mês de TTS com voz natural pt-BR (Google Neural2). Overage R$ 0,35/min. Trial 14 dias com 30 min grátis. Stripe price_1TTBQmKlp5SWv74Xb5e5Y9hA (prod_US5b5W8BDsOyU0).',
    priceMonthly: 79.9,
    priceLabel: 'R$ 79,90/mês — 200 min',
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
  VOICE_400: {
    id: 'VOICE_400',
    name: 'Voice 400 — add-on de voz outbound (pt-BR Neural)',
    description:
      '400 minutos/mês de TTS pt-BR natural. Overage R$ 0,30/min. Trial 14 dias com 30 min grátis. Stripe price_1TTBQvKlp5SWv74XSwCoSFnf (prod_US5brzwtrvWGBn).',
    priceMonthly: 137.9,
    priceLabel: 'R$ 137,90/mês — 400 min',
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
  VOICE_600: {
    id: 'VOICE_600',
    name: 'Voice 600 — add-on de voz outbound (pt-BR Neural)',
    description:
      '600 minutos/mês de TTS pt-BR natural. Overage R$ 0,28/min. Stripe price_1TTBR5Klp5SWv74XILSYFDHS (prod_US5bijQ5sOGPTf).',
    priceMonthly: 184.9,
    priceLabel: 'R$ 184,90/mês — 600 min',
    availableFor: ['GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
  VOICE_800: {
    id: 'VOICE_800',
    name: 'Voice 800 — add-on de voz outbound (pt-BR Neural)',
    description:
      '800 minutos/mês de TTS pt-BR natural. Overage R$ 0,25/min. Stripe price_1TTBRCKlp5SWv74XiLq3JFpp (prod_US5b42q8QDMyJC).',
    priceMonthly: 224.9,
    priceLabel: 'R$ 224,90/mês — 800 min',
    availableFor: ['GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
  VOICE_1500: {
    id: 'VOICE_1500',
    name: 'Voice 1.500 — add-on de voz outbound (pt-BR Neural)',
    description:
      '1.500 minutos/mês de TTS pt-BR natural. Overage R$ 0,22/min. Stripe price_1TTBRKKlp5SWv74Xej7QUZOo (prod_US5b2csvlZSjDx).',
    priceMonthly: 379.9,
    priceLabel: 'R$ 379,90/mês — 1.500 min',
    availableFor: ['SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
  VOICE_4000: {
    id: 'VOICE_4000',
    name: 'Voice 4.000 — add-on de voz outbound (pt-BR Neural)',
    description:
      '4.000 minutos/mês de TTS pt-BR natural. Overage R$ 0,20/min. Hard ceiling 8.000 min/mês — acima vira conversa Enterprise. Stripe price_1TTBRSKlp5SWv74XxIRs5gr1 (prod_US5bjZBsYDjffz).',
    priceMonthly: 929.9,
    priceLabel: 'R$ 929,90/mês — 4.000 min',
    availableFor: ['BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
};

// V4 #161 (PR #72) — Voice add-on metadata v4 FINAL.
export interface VoiceAddonMeta {
  minutesIncluded: number;
  overagePerMinBrl: number;
  /** Hard ceiling: minutesIncluded × 2. Acima disso, conversa Enterprise. */
  hardCeilingMinutes: number;
  trialDays: number;
  trialMinutes: number;
  stripeProductId: string;
  stripePriceId: string;
}

export const VOICE_ADDON_META: Record<string, VoiceAddonMeta> = {
  VOICE_200: {
    minutesIncluded: 200, overagePerMinBrl: 0.35, hardCeilingMinutes: 400,
    trialDays: 14, trialMinutes: 30,
    stripeProductId: 'prod_US5b5W8BDsOyU0',
    stripePriceId: 'price_1TTBQmKlp5SWv74Xb5e5Y9hA',
  },
  VOICE_400: {
    minutesIncluded: 400, overagePerMinBrl: 0.30, hardCeilingMinutes: 800,
    trialDays: 14, trialMinutes: 30,
    stripeProductId: 'prod_US5brzwtrvWGBn',
    stripePriceId: 'price_1TTBQvKlp5SWv74XSwCoSFnf',
  },
  VOICE_600: {
    minutesIncluded: 600, overagePerMinBrl: 0.28, hardCeilingMinutes: 1200,
    trialDays: 0, trialMinutes: 0,
    stripeProductId: 'prod_US5bijQ5sOGPTf',
    stripePriceId: 'price_1TTBR5Klp5SWv74XILSYFDHS',
  },
  VOICE_800: {
    minutesIncluded: 800, overagePerMinBrl: 0.25, hardCeilingMinutes: 1600,
    trialDays: 0, trialMinutes: 0,
    stripeProductId: 'prod_US5b42q8QDMyJC',
    stripePriceId: 'price_1TTBRCKlp5SWv74XiLq3JFpp',
  },
  VOICE_1500: {
    minutesIncluded: 1500, overagePerMinBrl: 0.22, hardCeilingMinutes: 3000,
    trialDays: 0, trialMinutes: 0,
    stripeProductId: 'prod_US5b2csvlZSjDx',
    stripePriceId: 'price_1TTBRKKlp5SWv74Xej7QUZOo',
  },
  VOICE_4000: {
    minutesIncluded: 4000, overagePerMinBrl: 0.20, hardCeilingMinutes: 8000,
    trialDays: 0, trialMinutes: 0,
    stripeProductId: 'prod_US5bjZBsYDjffz',
    stripePriceId: 'price_1TTBRSKlp5SWv74XxIRs5gr1',
  },
};

// Stripe IDs v1 (LEGACY OpenAI — clientes que assinaram antes de 2026-05-04
// continuam ativos no v1 até churn ou upgrade ativo).
export const VOICE_ADDON_LEGACY_V1_STRIPE_IDS = {
  VOICE_200_V1: { product: 'prod_US2Nf2zRn1dn2H', price: 'price_1TT8J8Klp5SWv74XG5O4Xww2', priceBrl: 89.9 },
  VOICE_400_V1: { product: 'prod_US2NGJ6tk2AGPh', price: 'price_1TT8JIKlp5SWv74XglVhUFLG', priceBrl: 169.9 },
  VOICE_600_V1: { product: 'prod_US2NL4KgL8LsJl', price: 'price_1TT8JPKlp5SWv74XZrZYTN19', priceBrl: 239.9 },
  VOICE_800_V1: { product: 'prod_US2Nzdk9qWJw9R', price: 'price_1TT8JVKlp5SWv74Xe9hBfPAf', priceBrl: 299.9 },
  VOICE_1500_V1: { product: 'prod_US2N18PMNq8X3l', price: 'price_1TT8JbKlp5SWv74XIib1o6eL', priceBrl: 499.9 },
  VOICE_4000_V1: { product: 'prod_US2N7nMCXScddo', price: 'price_1TT8JlKlp5SWv74XwQCxeKrA', priceBrl: 1299.9 },
} as const;

// Stripe IDs v2 e v3 (DEPRECATED — arquivados antes de qualquer venda).
// Documentado APENAS pra rastreabilidade. Nunca use estes IDs em código novo.
export const VOICE_ADDON_DEPRECATED_STRIPE_IDS = {
  // v2 (custo TTS calculado errado — preços em prejuízo)
  VOICE_200_V2_ERRADO: { product: 'prod_US4cooECtyeV5N', price: 'price_1TTATpKlp5SWv74XemiBN86A', priceBrl: 16.9 },
  VOICE_400_V2_ERRADO: { product: 'prod_US4cwl8gVOnepV', price: 'price_1TTATwKlp5SWv74XoD3EU2I1', priceBrl: 29.9 },
  VOICE_600_V2_ERRADO: { product: 'prod_US4co7Z39TMV0d', price: 'price_1TTAUFKlp5SWv74X6OWYNd5I', priceBrl: 39.9 },
  VOICE_800_V2_ERRADO: { product: 'prod_US4cggAQR7eCcS', price: 'price_1TTAUMKlp5SWv74Xp9r976HR', priceBrl: 49.9 },
  VOICE_1500_V2_ERRADO: { product: 'prod_US4cy0LXPQtkQO', price: 'price_1TTAUUKlp5SWv74XUmUIG17B', priceBrl: 79.9 },
  VOICE_4000_V2_ERRADO: { product: 'prod_US4coegcABrtCl', price: 'price_1TTAUbKlp5SWv74X0gLbYKQk', priceBrl: 199.9 },
  // v3 (margens 53-70% — substituído por v4 com margens 70-80%)
  VOICE_200_V3: { product: 'prod_US5CuMnWPeXkod', price: 'price_1TTB30Klp5SWv74Xt1QeYoQT', priceBrl: 46.9 },
  VOICE_400_V3: { product: 'prod_US5CJnYyhTORTn', price: 'price_1TTB3JKlp5SWv74XIleKEx8n', priceBrl: 84.9 },
  VOICE_600_V3: { product: 'prod_US5C6YUQs24uVs', price: 'price_1TTB3QKlp5SWv74XuRt14pjS', priceBrl: 114.9 },
  VOICE_800_V3: { product: 'prod_US5D9zDFnPDGdK', price: 'price_1TTB3YKlp5SWv74XqJmA5TuH', priceBrl: 137.9 },
  VOICE_1500_V3: { product: 'prod_US5DsG2treo6VH', price: 'price_1TTB3fKlp5SWv74XPDmbdW5Q', priceBrl: 232.9 },
  VOICE_4000_V3: { product: 'prod_US5DjMK7SCUYqp', price: 'price_1TTB3oKlp5SWv74XZpMLqqjj', priceBrl: 558.9 },
} as const;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

export const PLAN_IDS: PlanId[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];

export function getPlan(id: PlanId): PlanConfig {
  return PLAN_CONFIG[id];
}

export function getAnnualPrice(plan: PlanConfig): number | null {
  if (plan.priceMonthly === null) return null;
  return Math.round(plan.priceMonthly * (1 - plan.annualDiscountPercent / 100));
}

export function isWithinLimit(limit: number, usage: number): boolean {
  if (limit === -1) return true; // ilimitado
  return usage <= limit;
}

export function formatLimit(limit: number): string {
  if (limit === -1) return 'Ilimitado';
  return limit.toLocaleString('pt-BR');
}

export function listPlans(): PlanConfig[] {
  return PLAN_IDS.map((id) => PLAN_CONFIG[id]).sort((a, b) => a.order - b.order);
}

export function listAddons(): AddonConfig[] {
  return Object.values(ADDONS);
}

export function getAddonsForPlan(planId: PlanId): AddonConfig[] {
  return Object.values(ADDONS).filter((a) => a.availableFor.includes(planId));
}

export function listActivePlans(): PlanConfig[] {
  return listPlans().filter((p) => !p.deprecated);
}

export function listLegacyPlans(): PlanConfig[] {
  return listPlans().filter((p) => p.deprecated);
}

export function planMonthlyPrice(plan: PlanConfig): number | null {
  return plan.priceMonthly;
}

export function planAnnualMonthlyEquivalent(plan: PlanConfig): number | null {
  if (plan.priceMonthly === null) return null;
  return Number((plan.priceMonthly * (1 - plan.annualDiscountPercent / 100)).toFixed(2));
}

export function planAnnualTotal(plan: PlanConfig): number | null {
  const eq = planAnnualMonthlyEquivalent(plan);
  return eq === null ? null : Number((eq * 12).toFixed(2));
}
