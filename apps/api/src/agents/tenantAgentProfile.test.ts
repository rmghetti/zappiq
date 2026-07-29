/**
 * tenantAgentProfile.test.ts
 * ============================================================================
 * O perfil é a fonte da verdade do tenant: quem é o agente que o CLIENTE
 * criou. Nenhum caminho pode cair pra "Iza" quando o dado falta — cair pra Iza
 * foi exatamente o que produziu o bug do CMJ.
 *
 * Cobertura:
 *   ✓ lê nome do agente / empresa / nicho da org do cliente
 *   ✓ Agent.name ganha de settings.agentName (é o que roda em produção)
 *   ✓ marca isZappIQ só pra org canônica
 *   ✓ detecta o que o cliente treinou (preços/serviços) pra eval condicional
 *   ✓ org sem dado nenhum → defaults neutros, NUNCA "Iza"/"ZappIQ"
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ZAPPIQ_ORG_ID = 'cmo1ywwfe00ko1jskexiexsm4';
const CMJ_ORG_ID = 'cmr4x0zmn007msdhtqn6lfkia';

const mockOrgFind = vi.fn();
const mockAgentFind = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: (...a: any[]) => mockOrgFind(...a) },
    agent: { findFirst: (...a: any[]) => mockAgentFind(...a) },
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { resolveTenantAgentProfile } = await import('./tenantAgentProfile.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveTenantAgentProfile — org de cliente', () => {
  it('lê a identidade real do agente do cliente', async () => {
    mockOrgFind.mockResolvedValue({
      id: CMJ_ORG_ID,
      name: 'CMJ',
      settings: {
        agentName: 'Vera',
        businessName: 'CMJ',
        niche: 'servicos_b2b',
        tone: 'friendly',
        surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
      },
    });
    mockAgentFind.mockResolvedValue({ id: 'ag1', name: 'Vera', systemPrompt: 'Você é Vera...' });

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);

    expect(p.isZappIQ).toBe(false);
    expect(p.agentName).toBe('Vera');
    expect(p.businessName).toBe('CMJ');
    expect(p.niche).toBe('servicos_b2b');
    expect(p.siteUrl).toBe('cmj.com.br');
  });

  it('prefere Agent.name a settings.agentName (é o que roda em produção)', async () => {
    // Drift real: o cliente renomeou em /treinar mas o Agent não foi re-semeado.
    mockOrgFind.mockResolvedValue({
      id: CMJ_ORG_ID,
      name: 'CMJ',
      settings: { agentName: 'Sofia', businessName: 'CMJ' },
    });
    mockAgentFind.mockResolvedValue({ id: 'ag1', name: 'Vera', systemPrompt: 'x' });

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);
    expect(p.agentName).toBe('Vera');
    expect(p.identityDrift).toBe(true); // sinaliza pra UI/eval
  });

  it('sem Agent no banco, usa settings e não acusa drift', async () => {
    mockOrgFind.mockResolvedValue({
      id: CMJ_ORG_ID,
      name: 'CMJ',
      settings: { agentName: 'Sofia', businessName: 'CMJ' },
    });
    mockAgentFind.mockResolvedValue(null);

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);
    expect(p.agentName).toBe('Sofia');
    expect(p.identityDrift).toBe(false);
  });
});

describe('resolveTenantAgentProfile — nunca vaza a Iza', () => {
  it('org totalmente vazia cai em defaults neutros', async () => {
    mockOrgFind.mockResolvedValue({ id: 'org-vazia', name: '', settings: {} });
    mockAgentFind.mockResolvedValue(null);

    const p = await resolveTenantAgentProfile('org-vazia');

    expect(p.agentName).toBe('Assistente');
    expect(p.businessName).toBe('sua empresa');
    expect(p.isZappIQ).toBe(false);

    // Nenhum VALOR do perfil pode carregar a marca. (Checar o JSON inteiro
    // não serve: a própria chave `isZappIQ` casaria com /zappiq/i.)
    const valores = Object.values(p).filter((v): v is string => typeof v === 'string');
    for (const v of valores) {
      expect(v).not.toMatch(/\bIza\b/i);
      expect(v).not.toMatch(/zappiq/i);
    }
  });

  it('org inexistente falha fechado (cliente, não ZappIQ)', async () => {
    mockOrgFind.mockResolvedValue(null);
    mockAgentFind.mockResolvedValue(null);

    const p = await resolveTenantAgentProfile('nao-existe');
    expect(p.isZappIQ).toBe(false);
    expect(p.agentName).toBe('Assistente');
  });

  it('erro no banco não derruba o turno e não vira ZappIQ', async () => {
    mockOrgFind.mockRejectedValue(new Error('db down'));
    mockAgentFind.mockResolvedValue(null);

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);
    expect(p.isZappIQ).toBe(false);
    expect(p.organizationId).toBe(CMJ_ORG_ID);
  });
});

describe('resolveTenantAgentProfile — org da ZappIQ', () => {
  it('marca isZappIQ para a org canônica', async () => {
    mockOrgFind.mockResolvedValue({
      id: ZAPPIQ_ORG_ID,
      name: 'ZappIQ-Superadmin',
      settings: { agentName: 'Iza', businessName: 'ZappIQ' },
    });
    mockAgentFind.mockResolvedValue({ id: 'ag0', name: 'Iza', systemPrompt: 'x' });

    const p = await resolveTenantAgentProfile(ZAPPIQ_ORG_ID);
    expect(p.isZappIQ).toBe(true);
    expect(p.agentName).toBe('Iza');
  });
});

describe('resolveTenantAgentProfile — o que o cliente treinou', () => {
  it('detecta preços e serviços preenchidos (eval condicional)', async () => {
    mockOrgFind.mockResolvedValue({
      id: 'org-restaurante',
      name: 'Antonella',
      settings: {
        agentName: 'Antonella',
        businessName: 'Antonella Italian Food',
        niche: 'restaurante',
        surveyAnswers: {
          identidade_empresa: {
            com_lista_servicos: '- Rodízio de massas (R$ 89)',
            pre_tabela_precos: 'Rodízio R$ 89 por pessoa',
            pre_desconto_maximo: '10%',
          },
        },
      },
    });
    mockAgentFind.mockResolvedValue({ id: 'ag2', name: 'Antonella', systemPrompt: 'x' });

    const p = await resolveTenantAgentProfile('org-restaurante');
    expect(p.temServicos).toBe(true);
    expect(p.temPrecos).toBe(true);
    expect(p.precos).toContain('R$ 89');
  });

  it('cliente que não treinou preço não deve ser cobrado por isso', async () => {
    // CMJ real: 23 respostas, com_lista_servicos vazio.
    mockOrgFind.mockResolvedValue({
      id: CMJ_ORG_ID,
      name: 'CMJ',
      settings: {
        agentName: 'Vera',
        businessName: 'CMJ',
        surveyAnswers: { identidade_empresa: { com_lista_servicos: '   ' } },
      },
    });
    mockAgentFind.mockResolvedValue({ id: 'ag1', name: 'Vera', systemPrompt: 'x' });

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);
    expect(p.temServicos).toBe(false);
    expect(p.temPrecos).toBe(false);
  });
});
