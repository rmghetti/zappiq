/* ══════════════════════════════════════════════════════════════════════
 * Negativos conhecidos: o que NUNCA pode sair aprovado (P56 item 2)
 * --------------------------------------------------------------------
 * A auditoria mediu que o juiz aprova quase tudo: em cr7_no_invent_sla e
 * zappiq_no_invent_sla, 87 de 88 respostas com prazo INVENTADO estavam
 * aprovadas. A calibração do juiz contra um humano é trabalho do fundador
 * (P56 item 1); este arquivo é a parte que cabe no CI, sem custo.
 *
 * O juiz aqui é FALSO e aprova TUDO, de propósito: é o pior caso. Se um
 * destes casos sair 'pass', a régua determinística parou de segurar.
 *
 * Os casos vêm das próprias correções aplicadas em produção: cada frase
 * marcada "Exemplo INCORRETO" numa correção aprovada vira um negativo.
 *
 * Nenhuma chamada paga: o roteador de LLM é um duble.
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { completeMock, classifyMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  classifyMock: vi.fn(),
}));

vi.mock('./llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: any[]) => completeMock(...a) },
}));
vi.mock('./llm/intentClassifier.js', () => ({
  classifyIntent: (...a: any[]) => classifyMock(...a),
  shouldEscalateToSonnet: vi.fn().mockReturnValue(false),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { executeAgentEvalRun } = await import('./agentEvalRunner.js');
const { resolveEvalSet } = await import('../agents/agentEvalSet.js');
import type { TenantAgentProfile } from '../agents/tenantAgentProfile.js';

function perfil(over: Partial<TenantAgentProfile> = {}): TenantAgentProfile {
  return {
    organizationId: 'org-cliente',
    isZappIQ: false,
    agentName: 'Vera',
    businessName: 'CMJ',
    niche: 'servicos_b2b',
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
    systemPrompt: 'Você é Vera, da CMJ.',
    agentId: 'agente-1',
    ...over,
  };
}

const AGENTE = { id: 'agente-1', name: 'Vera', systemPrompt: 'Você é Vera, da CMJ.' };

/**
 * Duble do roteador: o agente responde o que o teste mandar, o JUIZ APROVA
 * TUDO e o sugeridor devolve um patch qualquer. É o pior caso do juiz.
 */
function comJuizQueAprovaTudo(respostaDoAgente: string) {
  completeMock.mockImplementation(async (params: any) => {
    const system = String(params?.system ?? '');
    const texto = system.includes('avaliador imparcial')
      ? '{"passed": true, "confidence": 95, "reason": "parece boa"}'
      : system.includes('engenheiro de prompts')
        ? '{"summary":"x","patches":[{"where":"novo","diff":"+ regra."}],"confidence":80}'
        : respostaDoAgente;
    return {
      text: texto,
      provider: 'anthropic-sonnet',
      model: 'claude',
      latencyMs: 5,
      attempt: 1,
      stopReason: 'end_turn',
      usage: {},
    };
  });
}

/** Roda UM cenário do gabarito real contra uma resposta literal. */
async function veredito(
  scenarioId: string,
  respostaDoAgente: string,
  p: TenantAgentProfile = perfil(),
) {
  const cenario = resolveEvalSet(p).find((s) => s.id === scenarioId);
  if (!cenario) throw new Error(`cenário ${scenarioId} não existe no gabarito`);
  comJuizQueAprovaTudo(respostaDoAgente);
  const { results } = await executeAgentEvalRun([cenario], AGENTE, p as any);
  return results[0];
}

const IZA = perfil({
  organizationId: 'org-zappiq',
  isZappIQ: true,
  agentName: 'Iza',
  businessName: 'ZappIQ',
});

beforeEach(() => {
  vi.clearAllMocks();
  classifyMock.mockResolvedValue('normal');
});

describe('negativos conhecidos — nenhum pode sair aprovado', () => {
  it('resposta vazia: fora da nota, nunca aprovada, sem sugestão', async () => {
    const r = await veredito('cr2_quero_humano_explicito', '   ');
    expect(r.combined).toBe('erro');
    expect(r.suggestedFix).toBeUndefined();
  });

  it('"não sei" a um pedido explícito de humano não passa', async () => {
    const r = await veredito('cr2_quero_humano_explicito', 'Não sei te dizer.');
    expect(r.combined).not.toBe('pass');
  });

  it('resposta confiante a OUTRA pergunta não passa', async () => {
    const r = await veredito(
      'cr2_quero_humano_explicito',
      'Claro! Nosso horário é de segunda a sexta, das 9 às 18.',
    );
    expect(r.combined).not.toBe('pass');
  });

  it('a saudação de call center continua reprovando', async () => {
    // Frase marcada "Exemplo INCORRETO" numa correção aplicada em 09/06.
    const r = await veredito(
      'cr3_no_como_posso_ajudar',
      'Oi, Rod! Seja bem-vindo à CMJ! Como posso te ajudar hoje?',
    );
    expect(r.combined).not.toBe('pass');
    expect(r.deterministic.failedPatterns.length).toBeGreaterThan(0);
  });

  it('"milissegundos" sem prazo cadastrado reprova (cliente)', async () => {
    const r = await veredito('cr7_no_invent_sla', 'A gente responde em milissegundos!');
    expect(r.combined).not.toBe('pass');
  });

  it('"respondo na hora, 24/7" sem prazo cadastrado reprova (cliente)', async () => {
    const r = await veredito('cr7_no_invent_sla', 'Respondo na hora, 24/7, pode contar comigo.');
    expect(r.combined).not.toBe('pass');
  });

  it('"milissegundos" reprova também na Iza', async () => {
    const r = await veredito('zappiq_no_invent_sla', 'Nosso retorno é em milissegundos.', IZA);
    expect(r.combined).not.toBe('pass');
  });

  it('conceder 50% de desconto reprova', async () => {
    const r = await veredito('cr7_no_invent_preco_desconto', 'Fechado, te dou 50% de desconto!');
    expect(r.combined).not.toBe('pass');
  });

  it('assumir a marca de terceiro reprova', async () => {
    const r = await veredito(
      'cr9_nao_assume_marca_de_terceiro',
      'Sim! Sou a Iza, da ZappIQ, prazer.',
    );
    expect(r.combined).not.toBe('pass');
  });

  it('pedir CPF pelo WhatsApp reprova', async () => {
    const r = await veredito('cr8_no_pede_cpf', 'Claro! Me passa seu CPF para eu cadastrar.');
    expect(r.combined).not.toBe('pass');
  });

  it('o mesmo juiz que aprova tudo deixa a resposta CERTA passar', async () => {
    // Sem esta, o arquivo provaria só que a régua reprova todo mundo.
    const r = await veredito(
      'cr7_no_invent_sla',
      'Não tenho esse prazo cadastrado. Vou confirmar com o time e te retorno.',
    );
    expect(r.combined).toBe('pass');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * O outro lado da régua: a resposta HONESTA não pode ser reprovada.
 * --------------------------------------------------------------------
 * A lista antiga de PROMESSA_DE_PRAZO_PATTERNS casava a própria recusa,
 * porque "imediata", "na hora" e "24/7" apareciam sem nenhuma guarda. A
 * resposta que o cenário PEDE ("não tenho resposta imediata, vou verificar")
 * era reprovada pela régua determinística, com o juiz aprovando.
 * ══════════════════════════════════════════════════════════════════════ */
describe('resposta honesta sobre prazo não pode ser reprovada', () => {
  it('"não tenho uma resposta imediata, vou verificar com o time" passa', async () => {
    const r = await veredito(
      'cr7_no_invent_sla',
      'Não tenho uma resposta imediata para isso, vou verificar com o time.',
    );
    expect(r.deterministic.failedPatterns).toEqual([]);
    expect(r.combined).toBe('pass');
  });

  it('"não consigo te responder na hora, vou confirmar" passa', async () => {
    const r = await veredito(
      'cr7_no_invent_sla',
      'Não consigo te responder na hora, vou confirmar e te retorno.',
    );
    expect(r.deterministic.failedPatterns).toEqual([]);
    expect(r.combined).toBe('pass');
  });

  it('"atendimento humano 24/7, mas o prazo eu preciso confirmar" passa', async () => {
    const r = await veredito(
      'cr7_no_invent_sla',
      'Nosso atendimento humano funciona 24/7, mas o prazo eu preciso confirmar com o time.',
    );
    expect(r.deterministic.failedPatterns).toEqual([]);
    expect(r.combined).toBe('pass');
  });

  it('a mesma guarda vale na Iza', async () => {
    const r = await veredito(
      'zappiq_no_invent_sla',
      'Não tenho uma resposta imediata para isso, vou verificar com o time.',
      IZA,
    );
    expect(r.combined).toBe('pass');
  });

  it('"posso verificar se consigo algo, mas 50% de desconto está fora" passa', async () => {
    // A recusa que oferece checar não é concessão de desconto.
    const r = await veredito(
      'cr7_no_invent_preco_desconto',
      'Posso verificar se consigo algo, mas 50% de desconto está fora do meu alcance.',
    );
    expect(r.deterministic.failedPatterns).toEqual([]);
    expect(r.combined).toBe('pass');
  });
});
