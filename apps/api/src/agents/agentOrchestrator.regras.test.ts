/* ══════════════════════════════════════════════════════════════════════
 * O bloco de regras aprovadas entra no prompt (e SÓ com o interruptor).
 * --------------------------------------------------------------------
 * Mesma régua do teste do perfil vivo, pelo mesmo motivo: fundir na main
 * publica a API na hora, para todos os agentes em produção ao mesmo tempo.
 *
 *   1. DESLIGADO, o prompt é byte a byte o de hoje: nem o bloco aparece,
 *      nem o banco é consultado.
 *   2. LIGADO, o bloco entra no lugar combinado, depois do prompt gravado
 *      e do perfil vivo, antes dos links e do RAG.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const agentFindFirst = vi.fn();
const messageCount = vi.fn();
const isFlagOn = vi.fn();
const blocoDeRegras = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: {
      findUnique: vi.fn().mockResolvedValue({
        leadStatus: 'NEW',
        name: 'João',
        _count: { conversations: 1 },
      }),
    },
    message: { count: (...args: any[]) => messageCount(...args) },
    agent: { findFirst: (...args: any[]) => agentFindFirst(...args) },
    organization: { findUnique: vi.fn().mockResolvedValue(null) },
    appointmentType: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn().mockResolvedValue(''),
  invalidateIzaFactsCache: vi.fn(),
}));

vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: (...args: any[]) => isFlagOn(...args),
}));

vi.mock('../services/agentRulesService.js', () => ({
  blocoDeRegrasDaOrganizacao: (...args: any[]) => blocoDeRegras(...args),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { buildSystemPromptForContact } from './agentOrchestrator.js';
import { CORE_AGENT_RULES_V1 } from './coreAgentRules.js';

const ORG = 'org-do-cmj';
const PROMPT_DO_AGENTE = '## IDENTIDADE\nVocê é Vera, atendente virtual da CMJ.';
const AGORA_UTC = new Date('2026-09-16T17:00:00Z');

const ENTRADA = {
  organizationId: ORG,
  contactId: 'contato-1',
  contactPhone: '5511999999999',
  orgSettings: { agentName: 'Vera', businessName: 'CMJ', tone: 'formal' },
  ragContext: '',
};

const BLOCO = [
  '# Regras aprovadas pelo dono',
  'Correções aprovadas pelo dono do negócio. Valem sobre o texto acima e não',
  'substituem as REGRAS BASE DO AGENTE, que continuam prevalecendo.',
  '',
  '1. Chame o cliente pelo nome quando souber.',
].join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA_UTC);
  agentFindFirst.mockResolvedValue({
    id: 'agente-vivo-1',
    systemPrompt: PROMPT_DO_AGENTE,
    name: 'Vera',
  });
  messageCount.mockResolvedValue(7);
  isFlagOn.mockResolvedValue(false);
  blocoDeRegras.mockResolvedValue('');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('interruptor regrasComoRegistros DESLIGADO', () => {
  it('o prompt é byte a byte o de hoje', async () => {
    const prompt = await buildSystemPromptForContact(ENTRADA);

    const agora = AGORA_UTC.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const esperado = [
      CORE_AGENT_RULES_V1,
      PROMPT_DO_AGENTE,
      '# Cliente atual',
      'Nome registrado: João',
      'Telefone: 5511999999999',
      'Status do lead: NEW',
      'Mensagens trocadas até agora: 7',
      'Primeiro contato? NÃO (já tem histórico — não pergunte nome de novo, use o que está acima)',
      '# Contexto recuperado (RAG)',
      '# Agora',
      agora,
    ].join('\n');

    expect(prompt).toBe(esperado);
    expect(prompt).not.toContain('# Regras aprovadas pelo dono');
  });
});

describe('interruptor LIGADO', () => {
  it('o bloco entra depois do prompt gravado e antes do "# Cliente atual"', async () => {
    blocoDeRegras.mockResolvedValue(BLOCO);

    const prompt = await buildSystemPromptForContact(ENTRADA);

    expect(prompt).toContain(BLOCO);
    expect(prompt.indexOf(PROMPT_DO_AGENTE)).toBeLessThan(prompt.indexOf(BLOCO));
    // "# Cliente atual" também aparece dentro do CORE (CR-5), então a
    // âncora é a linha que só existe no bloco do contato.
    expect(prompt.indexOf(BLOCO)).toBeLessThan(prompt.indexOf('Nome registrado: João'));
    // As REGRAS BASE continuam em primeiro lugar: o bloco não passa na frente.
    expect(prompt.indexOf(CORE_AGENT_RULES_V1)).toBeLessThan(prompt.indexOf(BLOCO));
  });

  // PI-3 da revisão: o bloco é do AGENTE, não da organização inteira.
  //
  // Hoje cada organização tem um agente comercial vivo, então filtrar por
  // organização dava no mesmo. Basta a segunda ligar um agente de suporte
  // para as regras do comercial vazarem para ele. O id já estava sendo
  // lido nesta função: faltava passar adiante.
  it('o bloco é pedido para o AGENTE deste canal, não só para a organização', async () => {
    blocoDeRegras.mockResolvedValue(BLOCO);
    await buildSystemPromptForContact(ENTRADA);
    expect(blocoDeRegras).toHaveBeenCalledWith(ORG, { agentId: 'agente-vivo-1' });
  });

  it('organização sem agente semeado cai no fallback e pede sem agente', async () => {
    agentFindFirst.mockResolvedValue(null);
    blocoDeRegras.mockResolvedValue(BLOCO);
    const prompt = await buildSystemPromptForContact(ENTRADA);
    expect(blocoDeRegras).toHaveBeenCalledWith(ORG, { agentId: null });
    expect(prompt).toContain(BLOCO);
  });

  it('falha ao montar o bloco não derruba a resposta ao cliente', async () => {
    blocoDeRegras.mockRejectedValue(new Error('banco fora'));
    const prompt = await buildSystemPromptForContact(ENTRADA);
    expect(prompt).toContain(PROMPT_DO_AGENTE);
    expect(prompt).not.toContain('# Regras aprovadas pelo dono');
  });
});
