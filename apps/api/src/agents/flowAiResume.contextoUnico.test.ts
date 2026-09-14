/* ══════════════════════════════════════════════════════════════════════
 * Retomada do Maestro pelo motor único (C1a, A076).
 * --------------------------------------------------------------------
 * Antes, a retomada por timer montava um system próprio: persona cortada em
 * 4.000 caracteres, sem CORE, sem links, sem saudação, sem perfil vivo. O
 * prompt de cliente tem de 4 a 6,5 mil caracteres e o da Iza 26,9 mil: a
 * retomada falava por um agente pela metade.
 *
 * O que este teste prova, com dublês (nenhum modelo, nenhum banco real):
 *   1. DESLIGADO: o caminho leve de antes, com o corte de 4.000 e sem CORE.
 *   2. LIGADO: o system vem do motor único: CORE primeiro, a instrução da
 *      retomada logo depois, a persona INTEIRA, links, '# Cliente atual'
 *      pelo contato da conversa e '# Agora'. O user (histórico + instrução
 *      do passo) é o mesmo dos dois caminhos.
 *   3. Sem Agent vivo, o motor único devolve ao caminho leve.
 *   4. O tier vem da política com modeloPorPolitica ligado (o do plano).
 *   5. Fail-closed continua: LLM fora devolve null e nada é enviado.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const complete = vi.fn();
const isFlagOn = vi.fn();
const agentFindFirst = vi.fn();
const orgFindUnique = vi.fn();
const messageFindMany = vi.fn();
const conversationFindUnique = vi.fn();
const contactFindUnique = vi.fn();
const messageCount = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    message: {
      findMany: (...a: any[]) => messageFindMany(...a),
      count: (...a: any[]) => messageCount(...a),
    },
    conversation: { findUnique: (...a: any[]) => conversationFindUnique(...a) },
    contact: { findUnique: (...a: any[]) => contactFindUnique(...a) },
    kBDocument: { findMany: vi.fn(async () => []) },
    QAPair: { findMany: vi.fn(async () => []) },
  },
}));

// Parcial de propósito: a política do turno lê TIER_PRIMARY_PROVIDER do
// roteador de verdade; só a chamada ao modelo é dublê.
vi.mock('../services/llm/LLMRouter.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, llmRouter: { complete: (...a: any[]) => complete(...a) } };
});
vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: (...a: any[]) => isFlagOn(...a),
}));
vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => ''),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateAiResumeReply, buildAiResumeInstruction } from './flowAiResume.js';
import { CORE_AGENT_RULES_V1 } from './coreAgentRules.js';

const AGORA = new Date('2026-09-16T17:00:00Z');
const ORG = 'org-do-cmj';
const CONVERSA = 'conversa-1';
// Persona longa de propósito: acima do corte de 4.000 do caminho leve.
const PERSONA = `## IDENTIDADE\nVocê é Vera, atendente virtual da CMJ.\n## CATÁLOGO\n${'Serra circular, furadeira, esmerilhadeira. '.repeat(120)}\n## FIM DA PERSONA: marcador-do-fim`;
const SETTINGS = {
  agentName: 'Vera',
  businessName: 'CMJ',
  greetingMessage: 'Olá! Aqui é a Vera, da CMJ.',
  surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
};

let flags: Record<string, boolean> = {};

function systemEnviado(): string {
  return String(complete.mock.calls[0][0].system);
}
function userEnviado(): string {
  return String(complete.mock.calls[0][0].messages[0].content);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  flags = {};
  isFlagOn.mockImplementation(async (_o: string, f: string) => flags[f] === true);
  agentFindFirst.mockResolvedValue({ id: 'a1', name: 'Vera', role: 'comercial', systemPrompt: PERSONA });
  orgFindUnique.mockResolvedValue({
    plan: 'GROWTH',
    settings: SETTINGS,
    trialStartedAt: new Date('2026-01-01'),
    trialEndsAt: new Date('2026-01-08'),
    isTrialActive: false,
    trialConverted: true,
    stripeSubscriptionId: 'sub_1',
  });
  messageFindMany.mockResolvedValue([
    { direction: 'OUTBOUND', content: 'Te mandei a proposta.' },
    { direction: 'INBOUND', content: 'Oi, quanto custa a serra?' },
  ]);
  conversationFindUnique.mockResolvedValue({ contactId: 'contato-joao', contact: { phone: '5511999999999' } });
  contactFindUnique.mockResolvedValue({ leadStatus: 'QUALIFIED', name: 'João', _count: {} });
  messageCount.mockResolvedValue(2);
  complete.mockResolvedValue({ text: 'Oi João, ficou alguma dúvida sobre a proposta?' });
});

afterEach(() => {
  vi.useRealTimers();
});

const ENTRADA = { organizationId: ORG, conversationId: CONVERSA, aiPrompt: 'Reengaje sobre a proposta.' };

describe('contextoUnico DESLIGADO: o caminho leve de antes', () => {
  it('persona cortada em 4.000, sem CORE, com o brief do negócio', async () => {
    const reply = await generateAiResumeReply(ENTRADA);

    expect(reply).toBe('Oi João, ficou alguma dúvida sobre a proposta?');
    const system = systemEnviado();
    expect(system.startsWith(CORE_AGENT_RULES_V1)).toBe(false);
    expect(system).not.toContain('marcador-do-fim');
    expect(system).toContain('# Contexto do negócio');
    expect(system.endsWith(buildAiResumeInstruction())).toBe(true);
    expect(system).not.toContain('# Cliente atual');
    expect(conversationFindUnique).not.toHaveBeenCalled();
    expect(complete.mock.calls[0][0].tier).toBe('GROWTH');
  });
});

describe('contextoUnico LIGADO: a persona inteira pelo motor único', () => {
  beforeEach(() => {
    flags = { contextoUnico: true };
  });

  it('CORE primeiro, instrução da retomada logo depois, persona inteira, links, cliente e agora', async () => {
    await generateAiResumeReply(ENTRADA);

    const system = systemEnviado();
    expect(system.startsWith(CORE_AGENT_RULES_V1)).toBe(true);
    expect(system.indexOf(buildAiResumeInstruction())).toBe(CORE_AGENT_RULES_V1.length + 1);
    expect(system).toContain('marcador-do-fim');
    expect(system.indexOf('## IDENTIDADE')).toBeGreaterThan(system.indexOf('# Sua tarefa agora'));
    expect(system).toContain('### Links oficiais de CMJ');
    expect(system).toContain('# Cliente atual\nNome registrado: João\nTelefone: 5511999999999\nStatus do lead: QUALIFIED\nMensagens trocadas até agora: 2');
    expect(system).toContain('# Agora\n16/09/2026, 14:00:00');
    // Não é primeiro contato: a saudação não entra na retomada.
    expect(system).not.toContain('# Saudação configurada');
    expect(system).not.toContain('# Contexto do negócio');
  });

  it('o user é o mesmo dos dois caminhos: histórico rotulado e a instrução do passo', async () => {
    await generateAiResumeReply(ENTRADA);

    const user = userEnviado();
    expect(user).toContain('Agente: Te mandei a proposta.');
    expect(user).toContain('Cliente: Oi, quanto custa a serra?');
    expect(user).toContain('INSTRUÇÃO DO PASSO ATUAL DO FLUXO (Maestro): Reengaje sobre a proposta.');
    expect(user.trim().endsWith('Escreva agora a mensagem de retomada.')).toBe(true);
  });

  it('o Agent é escolhido pela regra única (papel pelo status do lead)', async () => {
    await generateAiResumeReply(ENTRADA);

    const buscas = agentFindFirst.mock.calls.map((c: any[]) => c[0].where);
    expect(buscas).toContainEqual({ organizationId: ORG, role: 'comercial', status: 'live' });
  });

  it('sem Agent vivo, volta ao caminho leve (sem persona)', async () => {
    agentFindFirst.mockResolvedValue(null);

    const reply = await generateAiResumeReply(ENTRADA);

    expect(reply).toBe('Oi João, ficou alguma dúvida sobre a proposta?');
    const system = systemEnviado();
    expect(system.startsWith(CORE_AGENT_RULES_V1)).toBe(false);
    expect(system).toContain('# Contexto do negócio');
  });

  it('o tier segue o plano; com modeloPorPolitica, vem da política da retomada', async () => {
    await generateAiResumeReply(ENTRADA);
    expect(complete.mock.calls[0][0].tier).toBe('GROWTH');

    complete.mockClear();
    flags = { contextoUnico: true, modeloPorPolitica: true };
    await generateAiResumeReply(ENTRADA);
    expect(complete.mock.calls[0][0].tier).toBe('GROWTH');
  });

  it('LLM fora continua fail-closed: null, nenhuma mensagem', async () => {
    complete.mockRejectedValue(new Error('provider down'));

    await expect(generateAiResumeReply(ENTRADA)).resolves.toBeNull();
  });
});
