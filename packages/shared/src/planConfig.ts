// ─────────────────────────────────────────────────────────
// ZappIQ — Configuração comercial central (2026)
// Fonte única de verdade. Backend, landing, dashboard e
// Stripe Products derivam deste arquivo.
//
// Alinhado com ZappIQ_Modelo_Comercial_2026.docx (v2026.1).
// ─────────────────────────────────────────────────────────

export type PlanId = 'STARTER' | 'GROWTH' | 'SCALE' | 'BUSINESS' | 'ENTERPRISE';

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
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Para começar a automatizar',
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
    cta: { label: 'Começar 14 dias grátis', href: '/onboarding' },
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
    cta: { label: 'Começar 14 dias grátis', href: '/onboarding' },
  },

  SCALE: {
    id: 'SCALE',
    name: 'Scale',
    tagline: 'Para operações em escala',
    description:
      'Redes, franquias e operações multi-time com volume alto e exigência de uptime.',
    priceMonthly: 997,
    annualDiscountPercent: 20,
    highlight: false,
    premium: false,
    order: 3,
    limits: {
      agents: 30,
      aiMessagesPerMonth: 25000,
      broadcastsPerMonth: 20000,
      contacts: 50000,
      flows: -1,
      whatsappNumbers: 5,
      knowledgeBaseDocs: 200,
      logRetentionDays: 365,
      integrations: -1,
      customIntegrationHoursPerMonth: 8,
    },
    features: {
      echoCopilot: true,
      radarInsights: true,
      radar360: false,
      ssoSaml: false,
      apiOpen: true,
      whiteLabel: true,
      dedicatedOnboarding: true,
      dedicatedCsm: false,
      slaContractual: false,
      dedicatedInfra: false,
      soc24x7: false,
      dpoDirect: false,
      support: 'priority',
    },
    bullets: [
      '30 atendentes humanos',
      '25.000 mensagens de IA/mês',
      '20.000 disparos/mês',
      '50.000 contatos no CRM',
      'Fluxos ilimitados',
      '5 números WhatsApp Business',
      'White-label (sua marca no painel)',
      'Integrações ilimitadas + 8h/mês de integração customizada',
      'Onboarding dedicado (14 dias)',
      'Retenção de logs: 12 meses',
      'Suporte prioritário',
    ],
    cta: { label: 'Começar 14 dias grátis', href: '/onboarding' },
  },

  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'Para operações críticas com SLA formal',
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
  VOICE_INBOUND: {
    id: 'VOICE_INBOUND',
    name: 'Voice Inbound',
    description:
      'Recebimento de mensagens de voz com transcrição automática via Whisper. Transcrição ilimitada (prática) para fluxos de atendimento e compreensão de intenção.',
    priceMonthly: 197,
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
  VOICE_OUTBOUND: {
    id: 'VOICE_OUTBOUND',
    name: 'Voice Outbound',
    description:
      'Envio de mensagens de voz geradas por TTS (OpenAI ou ElevenLabs). 500 minutos/mês inclusos; excedente cobrado a R$ 0,50/min.',
    priceMonthly: 497,
    priceLabel: 'R$ 497/mês (500 min) + R$ 0,50/min excedente',
    availableFor: ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'],
    includedIn: [],
  },
};

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
