/* ══════════════════════════════════════════════════════════════════════
 * agentContextLoader: a camada de IO do motor único, com dublês.
 * --------------------------------------------------------------------
 * O snapshot (composeAgentContext.snapshot.test.ts) já prova o texto. Aqui
 * o que se prova é o comportamento do carregador nas bordas: a escolha do
 * Agent (A077, A069), o contato explícito (Testar minha IA, Qualidade), a
 * política fail-soft e o interruptor que nunca lança.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const agentFindFirst = vi.fn();
const contactFindUnique = vi.fn();
const messageCount = vi.fn();
const orgFindUnique = vi.fn();
const isFlagOn = vi.fn();
const getIzaFactsBlock = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    contact: { findUnique: (...a: any[]) => contactFindUnique(...a) },
    message: { count: (...a: any[]) => messageCount(...a) },
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
  },
}));

vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: (...a: any[]) => isFlagOn(...a),
}));

vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: (...a: any[]) => getIzaFactsBlock(...a),
  invalidateIzaFactsCache: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  flagLigada,
  resolveAgentForTurn,
  roleParaLeadStatus,
  carregarContato,
  montarContextoDoTurno,
  carregarPoliticaDoTurno,
} from './agentContextLoader.js';
import { ZAPPIQ_ORG_ID } from '../config/zappiqOrg.js';
import { CORE_AGENT_RULES_V1 } from './coreAgentRules.js';

const AGORA = new Date('2026-09-16T17:00:00Z');
const AGENTE = { id: 'a1', name: 'Vera', systemPrompt: '## IDENTIDADE\nVocê é Vera.', role: 'comercial' };

beforeEach(() => {
  vi.clearAllMocks();
  isFlagOn.mockResolvedValue(false);
  getIzaFactsBlock.mockResolvedValue('# FATOS ATUAIS\n- Lite: R$ 197');
  agentFindFirst.mockResolvedValue(AGENTE);
  contactFindUnique.mockResolvedValue(null);
  messageCount.mockResolvedValue(0);
});

describe('flagLigada', () => {
  it('erro na leitura vira desligado, nunca exceção', async () => {
    isFlagOn.mockRejectedValue(new Error('redis fora'));
    await expect(flagLigada('org', 'contextoUnico')).resolves.toBe(false);
  });

  it('repassa o valor lido', async () => {
    isFlagOn.mockResolvedValue(true);
    await expect(flagLigada('org', 'contextoUnico')).resolves.toBe(true);
    expect(isFlagOn).toHaveBeenCalledWith('org', 'contextoUnico');
  });
});

describe('resolveAgentForTurn (A077, A069)', () => {
  it('papel pelo status do lead: só CONVERTED pede suporte', () => {
    expect(roleParaLeadStatus('NEW')).toBe('comercial');
    expect(roleParaLeadStatus('QUALIFIED')).toBe('comercial');
    expect(roleParaLeadStatus('CONVERTED')).toBe('suporte');
    expect(roleParaLeadStatus(null)).toBe('comercial');
  });

  it('busca live, mais recente, pelo papel do lead', async () => {
    const agente = await resolveAgentForTurn('org-1', 'NEW');

    expect(agente).toEqual(AGENTE);
    expect(agentFindFirst).toHaveBeenCalledTimes(1);
    expect(agentFindFirst.mock.calls[0][0]).toMatchObject({
      where: { organizationId: 'org-1', role: 'comercial', status: 'live' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('CONVERTED sem suporte cai no comercial', async () => {
    agentFindFirst.mockImplementation(async (args: any) => (args.where.role === 'comercial' ? AGENTE : null));

    const agente = await resolveAgentForTurn('org-1', 'CONVERTED');

    expect(agente?.role).toBe('comercial');
    expect(agentFindFirst.mock.calls.map((c: any[]) => c[0].where.role)).toEqual(['suporte', 'comercial']);
  });

  it('CONVERTED com suporte vivo usa o suporte, sem segunda busca', async () => {
    agentFindFirst.mockResolvedValue({ ...AGENTE, id: 'a2', role: 'suporte' });

    const agente = await resolveAgentForTurn('org-1', 'CONVERTED');

    expect(agente?.role).toBe('suporte');
    expect(agentFindFirst).toHaveBeenCalledTimes(1);
  });

  it('sem agente vivo com prompt devolve null', async () => {
    agentFindFirst.mockResolvedValue({ ...AGENTE, systemPrompt: '' });
    await expect(resolveAgentForTurn('org-1', 'NEW')).resolves.toBeNull();
  });
});

describe('carregarContato', () => {
  it('contato inexistente é primeiro contato', async () => {
    const c = await carregarContato('nao-existe', '5511');
    expect(c).toEqual({ nome: null, leadStatus: 'NEW', primeiroContato: true, totalMensagens: 0, telefone: '5511' });
  });

  it('conta as mensagens do contato e tira o primeiro contato', async () => {
    contactFindUnique.mockResolvedValue({ leadStatus: 'QUALIFIED', name: ' Bia ', _count: {} });
    messageCount.mockResolvedValue(4);

    const c = await carregarContato('c1');

    expect(c).toMatchObject({ nome: 'Bia', leadStatus: 'QUALIFIED', primeiroContato: false, totalMensagens: 4 });
  });

  it('banco fora vira primeiro contato, sem exceção', async () => {
    contactFindUnique.mockRejectedValue(new Error('P1001'));
    await expect(carregarContato('c1')).resolves.toMatchObject({ primeiroContato: true, totalMensagens: 0 });
  });
});

describe('montarContextoDoTurno', () => {
  it('contato explícito dispensa o lookup (Testar minha IA, A072)', async () => {
    const saida = await montarContextoDoTurno({
      origem: 'playground',
      organizationId: 'org-1',
      orgSettings: { businessName: 'CMJ', greetingMessage: 'Olá!' },
      contato: { nome: null, leadStatus: 'NEW', primeiroContato: false, totalMensagens: 3 },
      ragContext: '',
      agora: AGORA,
    });

    expect(saida).not.toBeNull();
    expect(contactFindUnique).not.toHaveBeenCalled();
    expect(saida!.systemPrompt).toContain('Mensagens trocadas até agora: 3');
    expect(saida!.systemPrompt).toContain('Primeiro contato? NÃO (já tem histórico');
    // Segundo turno da sessão: a saudação não se repete.
    expect(saida!.systemPrompt).not.toContain('# Saudação configurada');
  });

  it('agente explícito dispensa a escolha (Qualidade avalia um agente específico)', async () => {
    const saida = await montarContextoDoTurno({
      origem: 'qualidade',
      organizationId: 'org-1',
      orgSettings: {},
      agente: { ...AGENTE, id: 'agente-da-run' },
      contato: { nome: 'Rod', leadStatus: 'NEW', primeiroContato: true, totalMensagens: 1 },
      ragContext: 'trecho da base',
      agora: AGORA,
    });

    expect(agentFindFirst).not.toHaveBeenCalled();
    expect(saida!.agente.id).toBe('agente-da-run');
    expect(saida!.systemPrompt).toContain('# Contexto recuperado (RAG)\ntrecho da base');
    expect(saida!.systemPrompt).toContain('# Agora\n16/09/2026, 14:00:00');
  });

  it('sem Agent devolve null', async () => {
    agentFindFirst.mockResolvedValue(null);
    await expect(
      montarContextoDoTurno({ origem: 'whatsapp', organizationId: 'org-1', orgSettings: {}, contactId: 'c1', ragContext: '' }),
    ).resolves.toBeNull();
  });

  it('iza_facts só na org da ZappIQ, e falha nos fatos não derruba o turno', async () => {
    const cliente = await montarContextoDoTurno({
      origem: 'whatsapp', organizationId: 'org-1', orgSettings: {}, contactId: 'c1', ragContext: '', agora: AGORA,
    });
    expect(cliente!.systemPrompt).not.toContain('FATOS ATUAIS');
    expect(getIzaFactsBlock).not.toHaveBeenCalled();

    const iza = await montarContextoDoTurno({
      origem: 'whatsapp', organizationId: ZAPPIQ_ORG_ID, orgSettings: {}, contactId: 'c1', ragContext: '', agora: AGORA,
    });
    expect(iza!.systemPrompt).toContain('# FATOS ATUAIS');

    getIzaFactsBlock.mockRejectedValue(new Error('banco fora'));
    const semFatos = await montarContextoDoTurno({
      origem: 'whatsapp', organizationId: ZAPPIQ_ORG_ID, orgSettings: {}, contactId: 'c1', ragContext: '', agora: AGORA,
    });
    expect(semFatos!.systemPrompt.startsWith(CORE_AGENT_RULES_V1)).toBe(true);
    expect(semFatos!.systemPrompt).not.toContain('FATOS ATUAIS');
  });

  it('o perfil vivo entra só com o interruptor, e o carregador consulta o interruptor certo', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');
    const saida = await montarContextoDoTurno({
      origem: 'whatsapp', organizationId: 'org-1', orgSettings: { agentName: 'Vera' }, contactId: 'c1', ragContext: '', agora: AGORA,
    });
    expect(saida!.perfilVivoLigado).toBe(true);
    expect(saida!.systemPrompt).toContain('# Como você atende nesta empresa');
    expect(isFlagOn).toHaveBeenCalledWith('org-1', 'perfilVivo');
  });
});

describe('carregarPoliticaDoTurno', () => {
  it('lê a organização e decide pela função pura', async () => {
    orgFindUnique.mockResolvedValue({
      plan: 'GROWTH', settings: {}, trialStartedAt: new Date('2026-01-01'), trialEndsAt: new Date('2026-01-08'),
      isTrialActive: false, trialConverted: true, stripeSubscriptionId: 'sub_1',
    });

    const p = await carregarPoliticaDoTurno('org-1', { canal: 'whatsapp', agendamentoAtivo: true });

    expect(p.tier).toBe('GROWTH');
    expect(p.tools).toEqual(['check_availability', 'create_appointment']);
    expect(p.modelo).toBe('anthropic-sonnet');
  });

  it('organização inexistente e banco fora caem na cascata padrão, sem ferramentas', async () => {
    orgFindUnique.mockResolvedValue(null);
    const semOrg = await carregarPoliticaDoTurno('org-x', { canal: 'whatsapp', agendamentoAtivo: true });
    expect(semOrg.tier).toBeUndefined();

    orgFindUnique.mockRejectedValue(new Error('P1001'));
    const erro = await carregarPoliticaDoTurno('org-x', { canal: 'whatsapp', agendamentoAtivo: true });
    expect(erro).toMatchObject({ tier: undefined, override: undefined, tools: [], modelo: 'anthropic-sonnet' });
    expect(erro.motivo).toContain('erro');
  });
});
