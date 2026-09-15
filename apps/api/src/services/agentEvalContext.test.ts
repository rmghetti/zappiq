/* ══════════════════════════════════════════════════════════════════════
 * agentEvalContext: o cenário da Qualidade com o contexto de produção.
 * --------------------------------------------------------------------
 * O que este teste prova, com dublês (nenhum modelo, base ou banco real):
 *   1. Criar o montador não custa IO; o interruptor é lido no primeiro
 *      cenário e só uma vez por execução.
 *   2. Desligado, devolve null (o runner usa o prompt de antes).
 *   3. Ligado, o prompt é o de produção: CORE, prompt do agente, links,
 *      '# Cliente atual' com o mock de sempre, base pela busca real com a
 *      mensagem do cenário, e a data FIXA.
 *   4. Base fora do ar grava ragStatus 'servico_fora' e o aviso honesto.
 *   5. Cenários nome_ausente omitem o nome; histórico tira o primeiro contato.
 *   6. Rodada 2 do PR #377: as regras aprovadas pelo dono entram pelo bloco
 *      que QUEM CHAMOU o avaliador já leu, sem nova leitura por cenário.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const isFlagOn = vi.fn();
const orgFindUnique = vi.fn();
const searchDetailed = vi.fn();
const agentRuleFindMany = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    agent: { findFirst: vi.fn() },
    contact: { findUnique: vi.fn() },
    message: { count: vi.fn() },
    agentRule: { findMany: (...a: any[]) => agentRuleFindMany(...a) },
  },
}));
vi.mock('./featureFlags.js', () => ({ isFlagOn: (...a: any[]) => isFlagOn(...a) }));
vi.mock('./ragService.js', () => ({ searchDetailed: (...a: any[]) => searchDetailed(...a) }));
vi.mock('./izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => ''),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  criarMontadorDeContextoDoEval,
  contatoDoCenario,
  DATA_FIXA_DO_EVAL,
  PROMPT_AUSENTE,
} from './agentEvalContext.js';
import { CORE_AGENT_RULES_V1 } from '../agents/coreAgentRules.js';
import { textoDoAgora } from '../agents/composeAgentContext.js';

const ORG = 'org-do-cmj';
const AGENTE = { id: 'a1', name: 'Vera', systemPrompt: '## IDENTIDADE\nVocê é Vera, da CMJ.' };
const CENARIO = {
  id: 'cr7_preco_da_base_correto',
  category: 'cr7_no_invent' as const,
  description: 'preço',
  userMessage: 'quanto custa a serra circular?',
  expectedBehavior: 'informar o preço da base',
  severity: 'critical' as const,
};

let flags: Record<string, boolean> = {};

beforeEach(() => {
  vi.clearAllMocks();
  flags = {};
  isFlagOn.mockImplementation(async (_o: string, f: string) => flags[f] === true);
  agentRuleFindMany.mockResolvedValue([]);
  orgFindUnique.mockResolvedValue({
    settings: { businessName: 'CMJ', surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } } },
  });
  searchDetailed.mockResolvedValue({
    context: '[tabela.pdf] Serra circular: R$ 890.',
    sources: [{ source: 'tabela.pdf', similarity: 0.8, snippet: 'serra' }],
    status: 'ok',
    fromCache: false,
  });
});

describe('contatoDoCenario: o mock de sempre', () => {
  it('marcador Cliente Teste (não é nome de gente), telefone fixo, NEW, primeiro contato sem histórico', () => {
    expect(contatoDoCenario({ id: 'cr1_x' })).toEqual({
      nome: 'Cliente Teste',
      leadStatus: 'NEW',
      primeiroContato: true,
      totalMensagens: 1,
      telefone: '+5511999999999',
    });
  });

  it('omite o nome nos cenários nome_ausente e conta o histórico', () => {
    const c = contatoDoCenario({
      id: 'cr5_nome_ausente_saudacao',
      history: [{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'olá' }],
    });
    expect(c.nome).toBeNull();
    expect(c.primeiroContato).toBe(false);
    expect(c.totalMensagens).toBe(3);
  });
});

describe('criarMontadorDeContextoDoEval', () => {
  it('criar não faz IO; desligado devolve null e lê o interruptor uma vez só', async () => {
    const montar = criarMontadorDeContextoDoEval(AGENTE, ORG);
    expect(isFlagOn).not.toHaveBeenCalled();

    expect(await montar(CENARIO as any)).toBeNull();
    expect(await montar(CENARIO as any)).toBeNull();

    expect(isFlagOn.mock.calls.filter((c) => c[1] === 'contextoUnico')).toHaveLength(1);
    expect(orgFindUnique).not.toHaveBeenCalled();
    expect(searchDetailed).not.toHaveBeenCalled();
  });

  it('ligado: prompt de produção com base pela mensagem do cenário e data fixa', async () => {
    flags = { contextoUnico: true };
    const montar = criarMontadorDeContextoDoEval(AGENTE, ORG);

    const ctx = await montar(CENARIO as any);

    expect(ctx).not.toBeNull();
    expect(searchDetailed).toHaveBeenCalledWith(ORG, 'quanto custa a serra circular?', 5);
    const p = ctx!.systemPrompt;
    expect(p.startsWith(CORE_AGENT_RULES_V1)).toBe(true);
    expect(p).toContain(AGENTE.systemPrompt);
    expect(p).toContain('### Links oficiais de CMJ');
    expect(p).toContain('# Cliente atual\nNome registrado: Cliente Teste\nTelefone: +5511999999999\nStatus do lead: NEW\nMensagens trocadas até agora: 1\nPrimeiro contato? SIM');
    expect(p).toContain('# Contexto recuperado (RAG)\n[tabela.pdf] Serra circular: R$ 890.');
    expect(p).toContain(`# Agora\n${textoDoAgora(DATA_FIXA_DO_EVAL)}`);
    expect(ctx!.ragStatus).toBe('ok');
    expect(ctx!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ctx!.partes.find((x) => x.nome === 'rag')!.chars).toBeGreaterThan(0);
  });

  it('as settings da organização são lidas uma vez por execução', async () => {
    flags = { contextoUnico: true };
    const montar = criarMontadorDeContextoDoEval(AGENTE, ORG);

    await montar(CENARIO as any);
    await montar({ ...CENARIO, id: 'outro' } as any);

    expect(orgFindUnique).toHaveBeenCalledTimes(1);
    expect(searchDetailed).toHaveBeenCalledTimes(2);
  });

  it('base fora do ar: ragStatus servico_fora e o aviso honesto no prompt', async () => {
    flags = { contextoUnico: true };
    searchDetailed.mockResolvedValue({ context: '', sources: [], status: 'servico_fora', fromCache: false });
    const montar = criarMontadorDeContextoDoEval(AGENTE, ORG);

    const ctx = await montar(CENARIO as any);

    expect(ctx!.ragStatus).toBe('servico_fora');
    expect(ctx!.systemPrompt).toContain('base de conhecimento indisponível neste momento');
  });

  it('busca que lança também vira servico_fora, sem derrubar o cenário', async () => {
    flags = { contextoUnico: true };
    searchDetailed.mockRejectedValue(new Error('ECONNREFUSED'));
    const montar = criarMontadorDeContextoDoEval(AGENTE, ORG);

    const ctx = await montar(CENARIO as any);

    expect(ctx!.ragStatus).toBe('servico_fora');
  });

  it('agente sem prompt entra com o texto de ausência de sempre', async () => {
    flags = { contextoUnico: true };
    const montar = criarMontadorDeContextoDoEval({ ...AGENTE, systemPrompt: null }, ORG);

    const ctx = await montar(CENARIO as any);

    expect(ctx!.systemPrompt).toContain(PROMPT_AUSENTE);
  });

  it('o mesmo cenário dá o mesmo hash (data fixa, base igual)', async () => {
    flags = { contextoUnico: true };
    const montar = criarMontadorDeContextoDoEval(AGENTE, ORG);

    const a = await montar(CENARIO as any);
    const b = await montar(CENARIO as any);

    expect(a!.hash).toBe(b!.hash);
  });
});

describe('criarMontadorDeContextoDoEval: as regras aprovadas pelo dono (rodada 2 do PR #377)', () => {
  const BLOCO = ['# Regras aprovadas pelo dono', '', '1. Chame o cliente pelo nome quando souber.'].join('\n');

  it('o bloco do chamador entra depois do prompt do agente e antes de # Cliente atual, sem ler de novo', async () => {
    flags = { contextoUnico: true, regrasComoRegistros: true };
    const montar = criarMontadorDeContextoDoEval(AGENTE, ORG);

    const ctx = await montar(CENARIO as any, { regrasBlock: BLOCO });
    const p = ctx!.systemPrompt;

    expect(p).toContain(BLOCO);
    expect(p.indexOf(AGENTE.systemPrompt)).toBeLessThan(p.indexOf(BLOCO));
    // '\n# Cliente atual\n' é o cabeçalho do bloco; o CORE cita o nome entre crases.
    expect(p.indexOf(BLOCO)).toBeLessThan(p.indexOf('\n# Cliente atual\n'));
    expect(ctx!.partes.find((x) => x.nome === 'regras_do_cliente')!.chars).toBe(BLOCO.length);
    // O MESMO texto que o chamador leu: nenhuma consulta nova por cenário.
    expect(agentRuleFindMany).not.toHaveBeenCalled();
    expect(isFlagOn).not.toHaveBeenCalledWith(ORG, 'regrasComoRegistros');
  });

  it('bloco vazio do chamador: nenhum bloco no prompt e nenhuma consulta, mesmo com o interruptor ligado', async () => {
    flags = { contextoUnico: true, regrasComoRegistros: true };
    agentRuleFindMany.mockResolvedValue([{ id: 'r1', scenarioId: null, texto: 'Regra do banco.', origem: 'manual' }]);
    const montar = criarMontadorDeContextoDoEval(AGENTE, ORG);

    const ctx = await montar(CENARIO as any, { regrasBlock: '' });

    expect(ctx!.systemPrompt).not.toContain('# Regras aprovadas pelo dono');
    expect(agentRuleFindMany).not.toHaveBeenCalled();
  });
});
