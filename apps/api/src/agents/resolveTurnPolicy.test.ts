/* ══════════════════════════════════════════════════════════════════════
 * resolveTurnPolicy: a MESMA decisão que pickTierAndOverride toma hoje.
 * --------------------------------------------------------------------
 * A tarefa manda juntar sem mudar o resultado. A prova é uma matriz de
 * organizações passada pelos dois caminhos: o de hoje (pickTierAndOverride,
 * lendo um banco dublê) e o puro (resolveTurnPolicy, recebendo os mesmos
 * campos). Tier e override têm de bater em todos os casos.
 *
 * As ferramentas seguem as regras por canal que existem hoje nos ifs do
 * WhatsApp e do playground, e o teste tranca o que MELHORA: o playground
 * passa a depender do agendamento de verdade, não do interruptor (A072).
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const orgFindUnique = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    contact: { findUnique: vi.fn() },
    message: { count: vi.fn() },
    agent: { findFirst: vi.fn() },
    appointmentType: { findMany: vi.fn() },
  },
}));

vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn().mockResolvedValue(''),
  invalidateIzaFactsCache: vi.fn(),
}));

// O orquestrador importa o motor de fluxos, e o agendador dele cria a fila
// BullMQ no import, abrindo conexão com o Redis em segundo plano. Fila falsa:
// nenhum teste daqui enfileira nada (o mesmo padrão do PR #375).
vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    on = vi.fn();
  },
  Worker: class {
    on = vi.fn();
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pickTierAndOverride } from './agentOrchestrator.js';
import { decideLlmCostStage } from '../middleware/planLimits.js';
import { ZAPPIQ_ORG_ID } from '../config/zappiqOrg.js';
import { TIER_PRIMARY_PROVIDER } from '../services/llm/LLMRouter.js';
import {
  resolveTurnPolicy,
  TOOL_CONSULTAR_HORARIOS,
  TOOL_MARCAR,
  type TurnPolicyInput,
} from './resolveTurnPolicy.js';

const AGORA = new Date('2026-09-16T17:00:00Z');

/** Uma organização como o findUnique de pickTierAndOverride a devolve. */
interface OrgDoBanco {
  plan: string | null;
  settings: Record<string, any> | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  isTrialActive: boolean;
  trialConverted: boolean;
  stripeSubscriptionId: string | null;
}

const PAGANTE = {
  trialStartedAt: new Date('2026-06-01T00:00:00Z'),
  trialEndsAt: new Date('2026-06-08T00:00:00Z'),
  isTrialActive: false,
  trialConverted: true,
  stripeSubscriptionId: 'sub_123',
};

const EM_TRIAL = {
  trialStartedAt: new Date('2026-09-10T00:00:00Z'),
  trialEndsAt: new Date('2026-09-30T00:00:00Z'),
  isTrialActive: true,
  trialConverted: false,
  stripeSubscriptionId: null,
};

const NOVO = {
  trialStartedAt: null,
  trialEndsAt: null,
  isTrialActive: false,
  trialConverted: false,
  stripeSubscriptionId: null,
};

const MATRIZ: Array<{ nome: string; orgId: string; org: OrgDoBanco; ecoMode?: boolean }> = [
  { nome: 'pagante GROWTH', orgId: 'org-a', org: { plan: 'GROWTH', settings: {}, ...PAGANTE } },
  { nome: 'pagante SCALE', orgId: 'org-b', org: { plan: 'SCALE', settings: {}, ...PAGANTE } },
  { nome: 'pagante com plano IZA_PRO (sem tier conhecido)', orgId: 'org-c', org: { plan: 'IZA_PRO', settings: {}, ...PAGANTE } },
  { nome: 'em trial com plano SCALE', orgId: 'org-d', org: { plan: 'SCALE', settings: {}, ...EM_TRIAL } },
  { nome: 'estágio NOVO sem trial', orgId: 'org-e', org: { plan: 'GROWTH', settings: {}, ...NOVO } },
  { nome: 'pagante em Modo Econômico', orgId: 'org-f', org: { plan: 'SCALE', settings: {}, ...PAGANTE }, ecoMode: true },
  {
    nome: 'forceProvider em llm_routing',
    orgId: 'org-g',
    org: { plan: 'GROWTH', settings: { llm_routing: { forceProvider: 'openai-mini' } }, ...PAGANTE },
  },
  {
    nome: 'tierOverride válido em llm_routing',
    orgId: 'org-h',
    org: { plan: 'GROWTH', settings: { llm_routing: { tierOverride: 'BUSINESS' } }, ...PAGANTE },
  },
  {
    nome: 'tierOverride inválido cai no plano',
    orgId: 'org-i',
    org: { plan: 'GROWTH', settings: { llm_routing: { tierOverride: 'PLATINUM' } }, ...PAGANTE },
  },
  {
    nome: 'useDefaultCascade',
    orgId: 'org-j',
    org: { plan: 'GROWTH', settings: { llm_routing: { useDefaultCascade: true } }, ...PAGANTE },
  },
  {
    nome: 'trial vence o forceProvider',
    orgId: 'org-k',
    org: { plan: 'GROWTH', settings: { llm_routing: { forceProvider: 'openai-mini' } }, ...EM_TRIAL },
  },
  { nome: 'ZappIQ em trial não cai no STARTER', orgId: ZAPPIQ_ORG_ID, org: { plan: 'SCALE', settings: {}, ...EM_TRIAL } },
  { nome: 'ZappIQ em Modo Econômico não cai no STARTER', orgId: ZAPPIQ_ORG_ID, org: { plan: 'SCALE', settings: {}, ...PAGANTE }, ecoMode: true },
  {
    nome: 'ZappIQ com useDefaultCascade (a vitrine da Iza)',
    orgId: ZAPPIQ_ORG_ID,
    org: { plan: 'SCALE', settings: { llm_routing: { useDefaultCascade: true } }, ...PAGANTE },
  },
];

function entradaPura(caso: (typeof MATRIZ)[number], canal: TurnPolicyInput['canal'] = 'whatsapp'): TurnPolicyInput {
  return {
    canal,
    plano: caso.org.plan,
    ehZappIQ: caso.orgId === ZAPPIQ_ORG_ID,
    estagioDoTrial: decideLlmCostStage(caso.org as any, AGORA),
    ecoMode: caso.ecoMode === true,
    llmRouting: caso.org.settings?.llm_routing ?? null,
    agendamentoAtivo: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

describe('resolveTurnPolicy: tier e override iguais aos de pickTierAndOverride', () => {
  for (const caso of MATRIZ) {
    it(caso.nome, async () => {
      orgFindUnique.mockResolvedValue(caso.org);

      const hoje = await pickTierAndOverride(caso.orgId, { ecoMode: caso.ecoMode });
      const politica = resolveTurnPolicy(entradaPura(caso));

      expect({ tier: politica.tier, forceProvider: politica.override }).toEqual({
        tier: hoje.tier,
        forceProvider: hoje.forceProvider,
      });
      expect(politica.motivo.length).toBeGreaterThan(5);
    });
  }

  it('o Instagram decide igual ao WhatsApp', () => {
    for (const caso of MATRIZ) {
      const wa = resolveTurnPolicy(entradaPura(caso, 'whatsapp'));
      const ig = resolveTurnPolicy(entradaPura(caso, 'instagram'));
      expect({ tier: ig.tier, override: ig.override }, caso.nome).toEqual({ tier: wa.tier, override: wa.override });
    }
  });
});

describe('resolveTurnPolicy: o modelo primário segue o tier ou a cascata padrão', () => {
  it('sem tier e sem override, a cascata padrão começa em Sonnet', () => {
    const p = resolveTurnPolicy(entradaPura(MATRIZ[2]));
    expect(p.tier).toBeUndefined();
    expect(p.modelo).toBe('anthropic-sonnet');
  });

  it('com tier, o modelo é o primário da tabela do roteador', () => {
    const p = resolveTurnPolicy(entradaPura(MATRIZ[0]));
    expect(p.tier).toBe('GROWTH');
    expect(p.modelo).toBe(TIER_PRIMARY_PROVIDER.GROWTH);
  });

  it('forceProvider vira o modelo, sem cascata', () => {
    const p = resolveTurnPolicy(entradaPura(MATRIZ[6]));
    expect(p.override).toBe('openai-mini');
    expect(p.modelo).toBe('openai-mini');
  });
});

describe('resolveTurnPolicy: ferramentas por canal, como hoje', () => {
  const base = entradaPura(MATRIZ[0]);

  it('WhatsApp e Instagram recebem as duas ferramentas só com o agendamento de pé', () => {
    for (const canal of ['whatsapp', 'instagram'] as const) {
      expect(resolveTurnPolicy({ ...base, canal, agendamentoAtivo: true }).tools).toEqual([
        TOOL_CONSULTAR_HORARIOS,
        TOOL_MARCAR,
      ]);
      expect(resolveTurnPolicy({ ...base, canal, agendamentoAtivo: false }).tools).toEqual([]);
    }
  });

  it('o Testar minha IA só consulta horários, nunca marca (A072)', () => {
    expect(resolveTurnPolicy({ ...base, canal: 'playground', agendamentoAtivo: true }).tools).toEqual([
      TOOL_CONSULTAR_HORARIOS,
    ]);
    expect(resolveTurnPolicy({ ...base, canal: 'playground', agendamentoAtivo: false }).tools).toEqual([]);
  });

  it('chat do site, retomada do Maestro e Qualidade nunca recebem ferramentas', () => {
    for (const canal of ['site', 'maestro_retomada', 'qualidade'] as const) {
      expect(resolveTurnPolicy({ ...base, canal, agendamentoAtivo: true }).tools, canal).toEqual([]);
    }
  });

  it('com ferramentas, o modelo passa a ser um provedor com function calling', () => {
    const p = resolveTurnPolicy({ ...base, canal: 'whatsapp', agendamentoAtivo: true });
    expect(p.tier).toBe('GROWTH');
    expect(p.modelo).toBe('anthropic-sonnet');
    expect(p.motivo).toContain('function calling');
  });
});

describe('resolveTurnPolicy: canais com regra própria hoje', () => {
  it('retomada do Maestro usa só o tier do plano, ignorando trial e Modo Econômico (como flowAiResume)', () => {
    const emTrial = entradaPura(MATRIZ[3], 'maestro_retomada');
    expect(resolveTurnPolicy(emTrial).tier).toBe('SCALE');
    expect(resolveTurnPolicy({ ...emTrial, ecoMode: true }).tier).toBe('SCALE');
    expect(resolveTurnPolicy({ ...emTrial, plano: 'IZA_PRO' }).tier).toBeUndefined();
  });

  it('Qualidade e chat do site seguem na cascata padrão, sem tier', () => {
    for (const canal of ['qualidade', 'site'] as const) {
      const p = resolveTurnPolicy(entradaPura(MATRIZ[0], canal));
      expect(p.tier, canal).toBeUndefined();
      expect(p.override, canal).toBeUndefined();
      expect(p.modelo, canal).toBe('anthropic-sonnet');
    }
  });
});
