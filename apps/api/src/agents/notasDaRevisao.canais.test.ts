/* ══════════════════════════════════════════════════════════════════════
 * Notas da revisão de 14/09 que atravessam os canais (C1b).
 * --------------------------------------------------------------------
 *   Nota 1: o turno do site lê os interruptores UMA vez.
 *   Nota 2: um seletor de agente só (A077). Numa organização com DOIS
 *           agentes comerciais vivos, todo canal usa o mais recente; antes
 *           o chat do site pegava o mais antigo. Hoje as 15 organizações
 *           têm um só: a prova é por fixture, não pelo banco.
 *   Nota 4: a linha de agendamento do perfil vivo é a MESMA no WhatsApp,
 *           no chat do site e na Qualidade.
 *   Nota 5: o chat do site segue o tier do plano com `modeloPorPolitica`;
 *           desligado, a chamada é a de hoje.
 *
 * Banco dublê com a regra de verdade do findFirst (filtro e ordem por
 * createdAt), para a escolha do agente ser provada e não suposta.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    on = vi.fn();
  },
  Worker: class {
    on = vi.fn();
  },
}));

const ORG = 'org-com-dois-agentes';

const AGENTES = [
  {
    id: 'agente-antigo',
    organizationId: ORG,
    name: 'Vera Antiga',
    role: 'comercial',
    status: 'live',
    systemPrompt: '## IDENTIDADE\nPROMPT DO AGENTE ANTIGO',
    createdAt: new Date('2026-01-10T12:00:00Z'),
  },
  {
    id: 'agente-novo',
    organizationId: ORG,
    name: 'Vera',
    role: 'comercial',
    status: 'live',
    systemPrompt: '## IDENTIDADE\nPROMPT DO AGENTE NOVO',
    createdAt: new Date('2026-09-01T12:00:00Z'),
  },
];

const SETTINGS = {
  agentName: 'Vera',
  businessName: 'Clínica Luz',
  scheduling: { enabled: true },
};

let flagsLigadas: string[] = [];

/** findFirst com a regra do Prisma: filtra pelo where e ordena por createdAt. */
function agenteFindFirst(args: any) {
  const where = args?.where ?? {};
  const lista = AGENTES.filter(
    (a) =>
      (!where.organizationId || a.organizationId === where.organizationId) &&
      (!where.role || a.role === where.role) &&
      (!where.status || a.status === where.status),
  ).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
  const ordem = args?.orderBy?.createdAt ?? 'asc';
  const escolhido = ordem === 'desc' ? lista[lista.length - 1] : lista[0];
  return Promise.resolve(escolhido ? { ...escolhido } : null);
}

const orgFeatureFlagFindMany = vi.fn(async () => flagsLigadas.map((flag) => ({ flag, enabled: true })));

vi.mock('@zappiq/database', () => ({
  prisma: {
    agent: { findFirst: (a: any) => agenteFindFirst(a) },
    organization: {
      findUnique: vi.fn(async () => ({
        plan: 'GROWTH',
        settings: SETTINGS,
        trialStartedAt: new Date('2026-01-01'),
        trialEndsAt: new Date('2026-01-08'),
        isTrialActive: false,
        trialConverted: true,
        stripeSubscriptionId: 'sub_1',
      })),
    },
    appointmentType: { findMany: vi.fn(async () => [{ name: 'Consulta' }]) },
    contact: {
      findUnique: vi.fn(async () => ({ leadStatus: 'NEW', name: 'João', _count: {} })),
      upsert: vi.fn(async () => ({ id: 'contato-web' })),
    },
    conversation: {
      findFirst: vi.fn(async () => ({ id: 'conversa-web' })),
      findUnique: vi.fn(async () => ({ aiPaused: false, contactId: 'contato-1', contact: { phone: '5511999999999' } })),
      create: vi.fn(async () => ({ id: 'conversa-web' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    message: {
      count: vi.fn(async () => 2),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (a: any) => ({ id: 'm1', ...a.data })),
    },
    agentRule: { findMany: vi.fn(async () => []) },
    orgFeatureFlag: {
      findMany: (...a: any[]) => (orgFeatureFlagFindMany as any)(...a),
      findUnique: vi.fn(async ({ where }: any) =>
        flagsLigadas.includes(where.organizationId_flag.flag) ? { enabled: true } : null,
      ),
    },
    prefilterEvent: { create: vi.fn(async () => ({ id: 'e1' })) },
    kBDocument: { findMany: vi.fn(async () => []) },
    QAPair: { findMany: vi.fn(async () => []) },
  },
}));

const cacheGet = vi.fn(async () => null);
vi.mock('../services/cloud/index.js', () => ({
  cache: {
    get: (...a: any[]) => (cacheGet as any)(...a),
    set: vi.fn(async () => true),
    del: vi.fn(async () => true),
    setNX: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    expire: vi.fn(async () => true),
  },
}));
vi.mock('../services/ragService.js', () => ({
  searchDetailed: vi.fn(async () => ({ context: '', sources: [], status: 'sem_resultado', fromCache: false })),
}));
const chatCompletion = vi.fn(async () => ({ text: 'Oi!', inputTokens: 1, outputTokens: 1, provider: 'p', model: 'm' }));
vi.mock('../services/llm/langchainClient.js', () => ({
  chatCompletion: (...a: any[]) => (chatCompletion as any)(...a),
  classify: vi.fn(),
}));
const complete = vi.fn(async () => ({ text: 'Oi, João!' }));
vi.mock('../services/llm/LLMRouter.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, llmRouter: { complete: (...a: any[]) => (complete as any)(...a) } };
});
vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => ''),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => undefined) }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { buildAgentContextForContact, resolveSchedulingRuntime } = await import('./agentOrchestrator.js');
const { processWebChatTurn, limparCacheDoAgenteDoSite, idDoAgenteComercial } = await import(
  '../services/webChatService.js'
);
const { generateAiResumeReply } = await import('./flowAiResume.js');
const { criarMontadorDeContextoDoEval } = await import('../services/agentEvalContext.js');
const { lerFlagsDoTurno } = await import('./agentContextLoader.js');

beforeEach(() => {
  vi.clearAllMocks();
  limparCacheDoAgenteDoSite();
  flagsLigadas = [];
});

async function promptDoWhatsApp(): Promise<string> {
  const r = await buildAgentContextForContact({
    origem: 'whatsapp',
    organizationId: ORG,
    contactId: 'contato-1',
    contactPhone: '5511999999999',
    orgSettings: SETTINGS,
    ragContext: '',
    agendamento: await resolveSchedulingRuntime(ORG, SETTINGS),
    flags: await lerFlagsDoTurno(ORG),
  });
  return r.systemPrompt;
}

async function promptDoSite(): Promise<string> {
  await processWebChatTurn({ sessionId: 'sessao-1', message: 'oi', organizationId: ORG } as any);
  return String((chatCompletion.mock.calls.at(-1) as any[])[0]);
}

async function promptDaRetomada(): Promise<string> {
  await generateAiResumeReply({ organizationId: ORG, conversationId: 'conversa-1', aiPrompt: 'Retome.' });
  return String((complete.mock.calls.at(-1) as any[])[0].system);
}

describe('nota 2: um seletor de agente só (fixture com dois agentes comerciais vivos)', () => {
  for (const motor of ['caminho de antes', 'motor único'] as const) {
    it(`${motor}: WhatsApp, chat do site e retomada usam o MESMO agente, o mais recente`, async () => {
      flagsLigadas = motor === 'motor único' ? ['contextoUnico'] : [];

      const whatsapp = await promptDoWhatsApp();
      const site = await promptDoSite();
      const retomada = await promptDaRetomada();

      for (const [canal, prompt] of [
        ['whatsapp', whatsapp],
        ['site', site],
        ['retomada', retomada],
      ]) {
        expect(prompt, canal).toContain('PROMPT DO AGENTE NOVO');
        expect(prompt, canal).not.toContain('PROMPT DO AGENTE ANTIGO');
      }
    });
  }

  it('as regras do site são do mesmo agente do prompt (o mais recente)', async () => {
    await expect(idDoAgenteComercial(ORG)).resolves.toBe('agente-novo');
  });
});

describe('nota 4: a mesma linha de agendamento no WhatsApp, no site e na Qualidade', () => {
  const LINHA = '- Agendamento: disponível para: Consulta';

  it('motor único com perfil vivo: a linha aparece nos três', async () => {
    flagsLigadas = ['contextoUnico', 'perfilVivo'];

    const whatsapp = await promptDoWhatsApp();
    const site = await promptDoSite();
    const montar = criarMontadorDeContextoDoEval(
      { id: 'agente-novo', name: 'Vera', systemPrompt: AGENTES[1].systemPrompt },
      ORG,
    );
    const qualidade = (await montar({ id: 'cr1', userMessage: 'oi', history: [] } as any, { regrasBlock: '' }))!
      .systemPrompt;

    expect(whatsapp).toContain(LINHA);
    expect(site).toContain(LINHA);
    expect(qualidade).toContain(LINHA);
  });

  it('caminho de antes com perfil vivo: o site também tem a linha', async () => {
    flagsLigadas = ['perfilVivo'];
    expect(await promptDoWhatsApp()).toContain(LINHA);
    expect(await promptDoSite()).toContain(LINHA);
  });

  it('sem o perfil vivo, nenhum canal tem a linha (nada muda para quem não ligou)', async () => {
    expect(await promptDoWhatsApp()).not.toContain('- Agendamento:');
    expect(await promptDoSite()).not.toContain('- Agendamento:');
  });
});

describe('nota 1: o turno do site lê os interruptores uma vez', () => {
  it('com tudo ligado, uma leitura só (a chave única), nenhuma por interruptor', async () => {
    flagsLigadas = ['contextoUnico', 'perfilVivo', 'regrasComoRegistros', 'modeloPorPolitica', 'ragNoChatDoSite'];

    await promptDoSite();

    const leituras = cacheGet.mock.calls.map((c: any[]) => String(c[0])).filter((k) => k.startsWith('zappiq:flag'));
    expect(leituras).toEqual([`zappiq:flags:${ORG}`]);
    expect(orgFeatureFlagFindMany).toHaveBeenCalledTimes(1);
  });
});

describe('nota 5: tier do chat do site pelo plano', () => {
  it('com modeloPorPolitica, a chamada leva o tier do plano (GROWTH)', async () => {
    flagsLigadas = ['modeloPorPolitica'];
    await promptDoSite();
    expect((chatCompletion.mock.calls.at(-1) as any[])[4]).toEqual({ tier: 'GROWTH', forceProvider: undefined });
  });

  it('desligado, a chamada é a de hoje: sem roteamento (cascata padrão)', async () => {
    await promptDoSite();
    expect((chatCompletion.mock.calls.at(-1) as any[]).length).toBe(4);
  });
});
