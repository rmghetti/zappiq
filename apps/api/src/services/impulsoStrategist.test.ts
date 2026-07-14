/* ══════════════════════════════════════════════════════════════════════
 * Impulso Estrategista · persona é do tenant (14/07/2026)
 * --------------------------------------------------------------------
 * O que este teste tranca:
 *   draftCampaignFromObjective roda com o orgId do CLIENTE e a copy que ela
 *   produz é disparada na base DELE. O SYSTEM era fixo: "Voce e a Iza,
 *   gerente de campanhas de vendas da ZappIQ". Ou seja, a campanha do CMJ
 *   nascia escrita por uma vendedora de outra empresa, com risco de citar a
 *   ZappIQ pro cliente final do CMJ.
 *
 * Os testes olham o system prompt que SAI pro LLM (via mock do router), não
 * o código-fonte, e passam o guard real de marca por cima.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockComplete, mockResolveProfile } = vi.hoisted(() => ({
  mockComplete: vi.fn(),
  mockResolveProfile: vi.fn(),
}));

vi.mock('./llm/LLMRouter.js', () => ({
  llmRouter: { complete: mockComplete },
}));

vi.mock('../agents/tenantAgentProfile.js', () => ({
  resolveTenantAgentProfile: mockResolveProfile,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { draftCampaignFromObjective } from './impulsoStrategist.js';
// Guard real (módulo puro, sem I/O) rodando contra o prompt real.
import { findForeignBrandLeaks } from '../agents/tenantIsolationGuard.js';

/** Perfil mínimo que o buildSystem consome. */
function perfil(over: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-cmj',
    isZappIQ: false,
    agentName: 'Vera',
    businessName: 'CMJ',
    niche: 'odontologia',
    tone: 'friendly',
    siteUrl: null,
    servicos: null,
    precos: null,
    descontoMaximo: null,
    regrasComerciais: null,
    temSiteUrl: false,
    temServicos: false,
    temPrecos: false,
    identityDrift: false,
    systemPrompt: null,
    agentId: null,
    ...over,
  };
}

const DRAFT_JSON = JSON.stringify({
  name: 'Reativação',
  segmentDescription: 'base com opt-in',
  channels: ['whatsapp'],
  copy: { whatsapp: 'Oi! Temos novidade.' },
  suggestedSchedule: 'terça 10h',
  budgetPlan: {},
  estimate: {},
  autonomyLevelSuggested: 2,
  rationale: 'ok',
});

const respondeDraft = () =>
  mockComplete.mockResolvedValueOnce({
    text: DRAFT_JSON,
    provider: 'anthropic-sonnet',
    model: 'claude-sonnet-4-6',
    latencyMs: 900,
    attempt: 1,
  });

const systemEnviado = () => mockComplete.mock.calls[0][0].system as string;

describe('draftCampaignFromObjective: persona do CLIENTE', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockResolveProfile.mockReset();
    mockResolveProfile.mockResolvedValue(perfil());
  });

  it('resolve o perfil com o orgId que veio da rota', async () => {
    respondeDraft();
    await draftCampaignFromObjective({ orgId: 'org-cmj', objective: 'reativar inativos' });
    expect(mockResolveProfile).toHaveBeenCalledWith('org-cmj');
  });

  it('o system NÃO cita a Iza nem a ZappIQ pro tenant', async () => {
    respondeDraft();
    await draftCampaignFromObjective({ orgId: 'org-cmj', objective: 'reativar inativos' });
    const leaks = findForeignBrandLeaks(systemEnviado(), { strict: true });
    expect(leaks).toEqual([]);
  });

  it('o system usa agentName, businessName e niche do tenant', async () => {
    respondeDraft();
    await draftCampaignFromObjective({ orgId: 'org-cmj', objective: 'reativar inativos' });
    const system = systemEnviado();
    expect(system).toContain('Vera');
    expect(system).toContain('CMJ');
    expect(system).toContain('odontologia');
  });

  it('niche "generic" (cliente não cadastrou) não vira texto no prompt', async () => {
    mockResolveProfile.mockResolvedValue(perfil({ niche: 'generic' }));
    respondeDraft();
    await draftCampaignFromObjective({ orgId: 'org-x', objective: 'vender mais' });
    expect(systemEnviado()).not.toContain('generic');
    expect(systemEnviado()).not.toContain('no ramo de');
  });

  it('perfil neutro (sem dados) continua sem marca da ZappIQ', async () => {
    // Pior caso: lookup falhou e o profile voltou nos defaults neutros.
    mockResolveProfile.mockResolvedValue(
      perfil({ agentName: 'Assistente', businessName: 'sua empresa', niche: 'generic' }),
    );
    respondeDraft();
    await draftCampaignFromObjective({ orgId: 'org-y', objective: 'vender mais' });
    expect(findForeignBrandLeaks(systemEnviado(), { strict: true })).toEqual([]);
    expect(systemEnviado()).toContain('sua empresa');
  });
});

describe('draftCampaignFromObjective: persona da ZappIQ (dogfood)', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockResolveProfile.mockReset();
  });

  it('na org da ZappIQ a Iza continua sendo a persona legítima', async () => {
    mockResolveProfile.mockResolvedValue(
      perfil({ isZappIQ: true, agentName: 'Iza', businessName: 'ZappIQ' }),
    );
    respondeDraft();
    await draftCampaignFromObjective({ orgId: 'org-zappiq', objective: 'captar leads' });
    const system = systemEnviado();
    expect(system).toContain('Iza');
    expect(system).toContain('ZappIQ');
  });
});

describe('draftCampaignFromObjective: contrato preservado', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockResolveProfile.mockReset();
    mockResolveProfile.mockResolvedValue(perfil());
  });

  it('parseia o JSON do modelo normalmente', async () => {
    respondeDraft();
    const draft = await draftCampaignFromObjective({ orgId: 'org-cmj', objective: 'reativar' });
    expect(draft.name).toBe('Reativação');
    expect(draft.channels).toContain('whatsapp');
  });

  it('cai no fallback quando o modelo não devolve JSON', async () => {
    mockComplete.mockResolvedValueOnce({
      text: 'desculpe, não consegui',
      provider: 'anthropic-sonnet',
      model: 'claude-sonnet-4-6',
      latencyMs: 900,
      attempt: 1,
    });
    const draft = await draftCampaignFromObjective({ orgId: 'org-cmj', objective: 'reativar' });
    expect(draft.name).toBe('Campanha (rascunho)');
    // Fallback é texto nosso, hardcoded: não pode carregar marca da ZappIQ.
    expect(findForeignBrandLeaks(JSON.stringify(draft), { strict: true })).toEqual([]);
  });
});
