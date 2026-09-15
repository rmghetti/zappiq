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
const mockQaFind = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: (...a: any[]) => mockOrgFind(...a) },
    agent: { findFirst: (...a: any[]) => mockAgentFind(...a) },
    qAPair: { findMany: (...a: any[]) => mockQaFind(...a) },
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { resolveTenantAgentProfile } = await import('./tenantAgentProfile.js');

beforeEach(() => {
  vi.clearAllMocks();
  mockQaFind.mockResolvedValue([]);
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

// ════════════════════════════════════════════════════════════════════
// C2 (Passo 13, P13): o perfil carrega o que vira cenário de conhecimento.
// ════════════════════════════════════════════════════════════════════
describe('resolveTenantAgentProfile: Q&A ativos e fatos do questionário (C2)', () => {
  it('carrega só os Q&A ATIVOS da organização, na ordem de prioridade', async () => {
    mockOrgFind.mockResolvedValue({ id: CMJ_ORG_ID, name: 'CMJ', settings: {} });
    mockAgentFind.mockResolvedValue({ id: 'ag1', name: 'Vera', systemPrompt: 'x' });
    mockQaFind.mockResolvedValue([
      { id: 'qa1', question: ' Qual o prazo? ', answer: 'Até 5 dias úteis.' },
      { id: 'qa2', question: 'sem resposta', answer: '   ' },
    ]);

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);

    const consulta = mockQaFind.mock.calls[0][0];
    expect(consulta.where).toEqual({ organizationId: CMJ_ORG_ID, isActive: true });
    expect(consulta.orderBy).toEqual([{ priority: 'desc' }, { createdAt: 'asc' }]);
    // O vazio não vira caso de teste.
    expect(p.qaAtivos).toEqual([{ id: 'qa1', pergunta: 'Qual o prazo?', resposta: 'Até 5 dias úteis.' }]);
  });

  it('lê preço, horário, desconto, pagamento e endereço em qualquer ramo do questionário', async () => {
    mockOrgFind.mockResolvedValue({
      id: CMJ_ORG_ID,
      name: 'CMJ',
      settings: {
        surveyAnswers: {
          identidade_empresa: {
            pre_tabela_precos: 'Programa: R$ 35.000/mês',
            ide_endereco_principal: 'Av. Paulista, 1000',
          },
          precos_condicoes: {
            pre_formas_pagamento: ['Pix', 'Boleto bancário'],
            pre_desconto_maximo: 'Até 5%',
          },
          ide_horarios_funcionamento: 'Seg-Sex 9h às 18h',
        },
      },
    });
    mockAgentFind.mockResolvedValue({ id: 'ag1', name: 'Vera', systemPrompt: 'x' });

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);

    expect(p.fatos?.precos).toBe('Programa: R$ 35.000/mês');
    expect(p.fatos?.endereco).toBe('Av. Paulista, 1000');
    expect(p.fatos?.pagamento).toMatch(/Pix/);
    expect(p.fatos?.pagamento).toMatch(/Boleto/);
    expect(p.fatos?.descontoMaximo).toBe('Até 5%');
    expect(p.fatos?.horario).toBe('Seg-Sex 9h às 18h');
  });

  it('o horário OFICIAL é o das configurações, não o texto do questionário', async () => {
    mockOrgFind.mockResolvedValue({
      id: CMJ_ORG_ID,
      name: 'CMJ',
      settings: {
        businessHours: { weekdays: '08:00-17:00' },
        surveyAnswers: { identidade_empresa: { ide_horarios_funcionamento: 'Seg-Sex 9h às 18h' } },
      },
    });
    mockAgentFind.mockResolvedValue({ id: 'ag1', name: 'Vera', systemPrompt: 'x' });

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);
    expect(p.fatos?.horario).toMatch(/08:00/);
    expect(p.fatos?.horario).not.toMatch(/9h/);
  });

  it('Q&A indisponível (banco fora) não derruba o perfil: segue sem eles', async () => {
    mockOrgFind.mockResolvedValue({ id: CMJ_ORG_ID, name: 'CMJ', settings: {} });
    mockAgentFind.mockResolvedValue({ id: 'ag1', name: 'Vera', systemPrompt: 'x' });
    mockQaFind.mockRejectedValue(new Error('banco fora'));

    const p = await resolveTenantAgentProfile(CMJ_ORG_ID);
    expect(p.qaAtivos).toEqual([]);
    expect(p.agentName).toBe('Vera');
  });
});
