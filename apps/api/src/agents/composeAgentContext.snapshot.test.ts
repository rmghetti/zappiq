/* ══════════════════════════════════════════════════════════════════════
 * Snapshot do prompt: a função pura produz BYTE A BYTE o texto de hoje.
 * --------------------------------------------------------------------
 * Tarefa C1a (Passo 12 do plano "Treinar IA e Qualidade 100% funcional").
 *
 * Cinco caminhos montavam o prompt do agente de formas diferentes. Antes de
 * trocar qualquer consumidor pela função pura composeAgentContext, este
 * teste prova que ela devolve exatamente o que buildSystemPromptForContact
 * (o caminho do WhatsApp/Instagram) devolve hoje, para as mesmas entradas.
 *
 * Como a prova é feita:
 *   1. As fixtures em __fixtures__/ foram GRAVADAS com o código de hoje, antes
 *      da refatoração (REGRAVAR_FIXTURES=1 regrava a partir do caminho
 *      antigo, com a flag contextoUnico desligada).
 *   2. O caminho antigo (flag desligada) tem de bater com a fixture.
 *   3. A função pura, alimentada com os mesmos dados, tem de bater também.
 *   4. O caminho novo (flag contextoUnico ligada) tem de bater igualmente.
 *
 * Duas organizações: uma cliente (a Vera, do CMJ) e a Iza, com iza_facts.
 * Nenhum teste aqui chama modelo, base de conhecimento ou banco: tudo é dublê.
 *
 * Rodada 2 do PR #377: a 5ª fixture (contexto-vera-regras) foi gravada pelo
 * caminho de antes do PR #375 (regrasComoRegistros ligado, contextoUnico
 * desligado) e prova que o motor único põe as regras aprovadas pelo dono no
 * MESMO lugar, byte a byte. As 4 fixtures antigas não mudaram.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const contactFindUnique = vi.fn();
const messageCount = vi.fn();
const agentFindFirst = vi.fn();
const orgFindUnique = vi.fn();
const tipoFindMany = vi.fn();
const getIzaFactsBlock = vi.fn();
const isFlagOn = vi.fn();
// PR #375: as regras aprovadas pelo dono, lidas pelo serviço de verdade
// (agentRulesService). Só a tabela é dublê.
const agentRuleFindMany = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { findUnique: (...a: any[]) => contactFindUnique(...a) },
    message: { count: (...a: any[]) => messageCount(...a) },
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    appointmentType: { findMany: (...a: any[]) => tipoFindMany(...a) },
    agentRule: { findMany: (...a: any[]) => agentRuleFindMany(...a) },
  },
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

vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: (...a: any[]) => getIzaFactsBlock(...a),
  invalidateIzaFactsCache: vi.fn(),
}));

vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: (...a: any[]) => isFlagOn(...a),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { buildSystemPromptForContact, buildAgentContextForContact } from './agentOrchestrator.js';
import { ZAPPIQ_ORG_ID } from '../config/zappiqOrg.js';
import {
  composeAgentContext,
  NOMES_DAS_PARTES,
  type AgentContextInput,
} from './composeAgentContext.js';
import { buildLiveProfileBlock } from './tenantLiveProfile.js';
import { buildTenantLinksBlock } from './tenantConversionUrls.js';
import { montarBlocoDeRegras, TITULO_BLOCO_DE_REGRAS } from './regrasDoAgente.js';
import { buildEvalSystemPrompt } from '../services/agentEvalRunner.js';

// ── Relógio fixo: o '# Agora' entra no prompt ─────────────────────────
const AGORA = new Date('2026-09-16T17:00:00Z'); // quarta, 14:00 em São Paulo

// ── Fixture 1: a Vera, do CMJ (organização cliente) ───────────────────
const ORG_CMJ = 'org-do-cmj';
const PROMPT_DA_VERA = [
  '## IDENTIDADE',
  'Você é Vera, atendente virtual da CMJ Ferramentas.',
  '## TOM DE VOZ — AMIGÁVEL',
  'Fale com "você", frases curtas.',
  '## CATÁLOGO',
  'Serra circular, furadeira, esmerilhadeira.',
].join('\n');

const SETTINGS_CMJ = {
  agentName: 'Vera',
  businessName: 'CMJ',
  tone: 'formal',
  greetingMessage: 'Olá! Aqui é a Vera, da CMJ. Como posso ajudar?',
  handoffMessage: 'Vou chamar um especialista da CMJ para falar com você.',
  businessHoursConfig: {
    timezone: 'America/Sao_Paulo',
    days: {
      0: null,
      1: { open: '09:00', close: '18:00' },
      2: { open: '09:00', close: '18:00' },
      3: { open: '09:00', close: '18:00' },
      4: { open: '09:00', close: '18:00' },
      5: { open: '09:00', close: '18:00' },
      6: null,
    },
  },
  surveyAnswers: {
    identidade_empresa: {
      ide_site_url: 'cmj.com.br',
      pre_desconto_maximo: 'Até 5% no PIX, nunca acima disso.',
    },
  },
};

const RAG_CMJ = [
  '[cardapio-de-servicos.pdf] A serra circular custa R$ 890 à vista.',
  '[politica-de-troca.txt] Troca em até 7 dias com nota fiscal.',
].join('\n\n');

const AGENDAMENTO_CMJ = { ativo: true, tipos: ['Visita técnica', 'Orçamento'] };

const CONTATO_JOAO = { leadStatus: 'NEW', name: 'João', _count: { conversations: 1 } };

// ── Fixture 2: a Iza (org canônica da ZappIQ, com iza_facts) ──────────
const PROMPT_DA_IZA = [
  '## IDENTIDADE',
  'Você é a **Iza**, consultora comercial da ZappIQ.',
  '## PRICING',
  'Consulte a seção FATOS ATUAIS para preços vigentes.',
].join('\n');

const SETTINGS_IZA = {
  agentName: 'Iza',
  businessName: 'ZappIQ',
  tone: 'friendly',
  greetingMessage: 'Oi! Eu sou a Iza, da ZappIQ.',
  surveyAnswers: { identidade_empresa: { ide_site_url: 'https://zappiq.com.br' } },
};

const FACTS_DA_IZA = [
  '# FATOS ATUAIS (sincronizados em runtime)',
  '- Plano Lite: R$ 197/mês',
  '- Trial: 7 dias',
].join('\n');

// ── Fixtures em disco ────────────────────────────────────────────────
const PASTA = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const REGRAVAR = process.env.REGRAVAR_FIXTURES === '1';

function lerOuGravar(nome: string, textoDeHoje: string): string {
  const caminho = join(PASTA, `${nome}.txt`);
  if (REGRAVAR || !existsSync(caminho)) {
    mkdirSync(PASTA, { recursive: true });
    writeFileSync(caminho, textoDeHoje, 'utf8');
  }
  return readFileSync(caminho, 'utf8');
}

export function sha256(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

/** Estado dos interruptores neste caso. Tudo desligado por padrão. */
let flags: Record<string, boolean> = {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  flags = {};
  isFlagOn.mockImplementation(async (_org: string, flag: string) => flags[flag] === true);
  getIzaFactsBlock.mockResolvedValue(FACTS_DA_IZA);
  orgFindUnique.mockResolvedValue(null);
  tipoFindMany.mockResolvedValue([]);
  agentRuleFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

function armarVera(opts: { messageCount?: number } = {}) {
  contactFindUnique.mockResolvedValue(CONTATO_JOAO);
  messageCount.mockResolvedValue(opts.messageCount ?? 7);
  agentFindFirst.mockResolvedValue({
    id: 'agente-vera',
    name: 'Vera',
    role: 'comercial',
    systemPrompt: PROMPT_DA_VERA,
  });
}

function armarIza() {
  contactFindUnique.mockResolvedValue({ leadStatus: 'NEW', name: null, _count: { conversations: 1 } });
  messageCount.mockResolvedValue(1);
  agentFindFirst.mockResolvedValue({
    id: 'agente-iza',
    name: 'Iza',
    role: 'comercial',
    systemPrompt: PROMPT_DA_IZA,
  });
}

const ENTRADA_VERA = {
  organizationId: ORG_CMJ,
  contactId: 'contato-joao',
  contactPhone: '5511999999999',
  orgSettings: SETTINGS_CMJ,
  ragContext: RAG_CMJ,
  ragStatus: 'ok' as const,
  agendamento: AGENDAMENTO_CMJ,
  temHistoricoNoContexto: true,
};

const ENTRADA_IZA = {
  organizationId: ZAPPIQ_ORG_ID,
  contactId: 'contato-lead',
  contactPhone: '5511988887777',
  orgSettings: SETTINGS_IZA,
  ragContext: '',
  ragStatus: 'sem_resultado' as const,
  agendamento: null,
  temHistoricoNoContexto: false,
};

/* ── 1. O caminho de hoje bate com a fixture gravada ───────────────── */

describe('fixtures gravadas com o código de hoje (flag contextoUnico desligada)', () => {
  it('Vera (CMJ), perfil vivo ligado, com histórico, base com resultado', async () => {
    armarVera();
    flags = { perfilVivo: true };

    const hoje = await buildSystemPromptForContact(ENTRADA_VERA);
    const fixture = lerOuGravar('contexto-vera-perfil-vivo', hoje);

    expect(hoje).toBe(fixture);
  });

  it('Vera (CMJ), perfil vivo desligado (o prompt de antes do A8)', async () => {
    armarVera();

    const hoje = await buildSystemPromptForContact(ENTRADA_VERA);
    const fixture = lerOuGravar('contexto-vera-sem-perfil-vivo', hoje);

    expect(hoje).toBe(fixture);
  });

  it('Vera (CMJ), histórico fora do contexto (A212) e base fora do ar', async () => {
    armarVera();
    flags = { perfilVivo: true };

    const hoje = await buildSystemPromptForContact({
      ...ENTRADA_VERA,
      ragStatus: 'servico_fora',
      temHistoricoNoContexto: false,
    });
    const fixture = lerOuGravar('contexto-vera-a212-base-fora', hoje);

    expect(hoje).toBe(fixture);
  });

  it('Iza (ZappIQ), primeiro contato, com iza_facts e saudação', async () => {
    armarIza();

    const hoje = await buildSystemPromptForContact(ENTRADA_IZA);
    const fixture = lerOuGravar('contexto-iza-primeiro-contato', hoje);

    expect(hoje).toBe(fixture);
    // Os fatos da plataforma entram SÓ na org da Iza, entre o CORE e o prompt.
    expect(fixture).toContain(FACTS_DA_IZA);
    expect(fixture.indexOf(FACTS_DA_IZA)).toBeLessThan(fixture.indexOf(PROMPT_DA_IZA));
  });

  it('a org de cliente NUNCA recebe os iza_facts', async () => {
    armarVera();
    flags = { perfilVivo: true };

    const hoje = await buildSystemPromptForContact(ENTRADA_VERA);

    expect(hoje).not.toContain('FATOS ATUAIS');
  });
});

/* ── 2. A função pura, com os mesmos dados, bate com a fixture ─────── */

/**
 * Traduz os dublês acima na entrada da função pura. É o que o carregador
 * (agentContextLoader) faz em produção; aqui é feito à mão para a prova não
 * depender dele.
 */
function entradaPura(opts: {
  org: string;
  settings: Record<string, any>;
  agente: { id: string; name: string; systemPrompt: string; role: string };
  contato: AgentContextInput['contato'];
  ragContext: string;
  ragStatus: 'ok' | 'sem_resultado' | 'servico_fora';
  agendamento: { ativo: boolean; tipos?: string[] } | null;
  perfilVivo: boolean;
  izaFacts: string;
  origem?: AgentContextInput['origem'];
  instrucaoDeCanal?: string;
  regrasDoCliente?: string;
}): AgentContextInput {
  return {
    origem: opts.origem ?? 'whatsapp',
    agente: opts.agente,
    organizacao: {
      id: opts.org,
      nome: opts.settings.businessName ?? '',
      settings: opts.settings,
      ehZappIQ: opts.org === ZAPPIQ_ORG_ID,
    },
    contato: opts.contato,
    blocos: {
      izaFacts: opts.izaFacts,
      perfilVivo: opts.perfilVivo
        ? buildLiveProfileBlock(opts.settings, null, { now: AGORA, agendamento: opts.agendamento })
        : '',
      links: buildTenantLinksBlock(opts.settings, opts.settings.businessName),
      rag: opts.ragContext,
      regrasDoCliente: opts.regrasDoCliente,
    },
    agora: AGORA,
    ragStatus: opts.ragStatus,
    instrucaoDeCanal: opts.instrucaoDeCanal,
  };
}

const AGENTE_VERA = { id: 'agente-vera', name: 'Vera', systemPrompt: PROMPT_DA_VERA, role: 'comercial' };
const AGENTE_IZA = { id: 'agente-iza', name: 'Iza', systemPrompt: PROMPT_DA_IZA, role: 'comercial' };

const CONTATO_VERA: AgentContextInput['contato'] = {
  nome: 'João',
  leadStatus: 'NEW',
  primeiroContato: false,
  totalMensagens: 7,
  telefone: '5511999999999',
  historicoNoContexto: true,
};

function lerFixture(nome: string): string {
  return readFileSync(join(PASTA, `${nome}.txt`), 'utf8');
}

describe('composeAgentContext (função pura) produz o texto de hoje byte a byte', () => {
  it('Vera (CMJ), perfil vivo ligado', () => {
    const saida = composeAgentContext(
      entradaPura({
        org: ORG_CMJ,
        settings: SETTINGS_CMJ,
        agente: AGENTE_VERA,
        contato: CONTATO_VERA,
        ragContext: RAG_CMJ,
        ragStatus: 'ok',
        agendamento: AGENDAMENTO_CMJ,
        perfilVivo: true,
        izaFacts: '',
      }),
    );

    const fixture = lerFixture('contexto-vera-perfil-vivo');
    expect(saida.systemPrompt).toBe(fixture);
    expect(saida.hash).toBe(sha256(fixture));
  });

  it('Vera (CMJ), perfil vivo desligado', () => {
    const saida = composeAgentContext(
      entradaPura({
        org: ORG_CMJ,
        settings: SETTINGS_CMJ,
        agente: AGENTE_VERA,
        contato: CONTATO_VERA,
        ragContext: RAG_CMJ,
        ragStatus: 'ok',
        agendamento: AGENDAMENTO_CMJ,
        perfilVivo: false,
        izaFacts: '',
      }),
    );

    expect(saida.systemPrompt).toBe(lerFixture('contexto-vera-sem-perfil-vivo'));
  });

  it('Vera (CMJ), A212 e base fora do ar', () => {
    const saida = composeAgentContext(
      entradaPura({
        org: ORG_CMJ,
        settings: SETTINGS_CMJ,
        agente: AGENTE_VERA,
        contato: { ...CONTATO_VERA, historicoNoContexto: false },
        ragContext: RAG_CMJ,
        ragStatus: 'servico_fora',
        agendamento: AGENDAMENTO_CMJ,
        perfilVivo: true,
        izaFacts: '',
      }),
    );

    expect(saida.systemPrompt).toBe(lerFixture('contexto-vera-a212-base-fora'));
  });

  it('Iza (ZappIQ), primeiro contato com iza_facts', () => {
    const saida = composeAgentContext(
      entradaPura({
        org: ZAPPIQ_ORG_ID,
        settings: SETTINGS_IZA,
        agente: AGENTE_IZA,
        contato: {
          nome: null,
          leadStatus: 'NEW',
          primeiroContato: true,
          totalMensagens: 1,
          telefone: '5511988887777',
        },
        ragContext: '',
        ragStatus: 'sem_resultado',
        agendamento: null,
        perfilVivo: false,
        izaFacts: FACTS_DA_IZA,
      }),
    );

    const fixture = lerFixture('contexto-iza-primeiro-contato');
    expect(saida.systemPrompt).toBe(fixture);
    expect(saida.hash).toBe(sha256(fixture));
  });

  it('os iza_facts não entram em org de cliente, mesmo que alguém os passe', () => {
    const saida = composeAgentContext(
      entradaPura({
        org: ORG_CMJ,
        settings: SETTINGS_CMJ,
        agente: AGENTE_VERA,
        contato: CONTATO_VERA,
        ragContext: RAG_CMJ,
        ragStatus: 'ok',
        agendamento: AGENDAMENTO_CMJ,
        perfilVivo: true,
        izaFacts: FACTS_DA_IZA,
      }),
    );

    expect(saida.systemPrompt).toBe(lerFixture('contexto-vera-perfil-vivo'));
    expect(saida.partes.find((p) => p.nome === 'iza_facts')?.chars).toBe(0);
  });

  it('a instrução de canal entra DEPOIS do CORE e antes de tudo o mais (A076)', () => {
    const saida = composeAgentContext(
      entradaPura({
        org: ORG_CMJ,
        settings: SETTINGS_CMJ,
        agente: AGENTE_VERA,
        contato: CONTATO_VERA,
        ragContext: RAG_CMJ,
        ragStatus: 'ok',
        agendamento: AGENDAMENTO_CMJ,
        perfilVivo: true,
        izaFacts: '',
        instrucaoDeCanal: 'INSTRUÇÃO DO PASSO ATUAL DO FLUXO (Maestro): pergunte o CEP.',
      }),
    );

    const texto = saida.systemPrompt;
    const fimDoCore = texto.indexOf('INSTRUÇÃO DO PASSO ATUAL');
    expect(fimDoCore).toBeGreaterThan(0);
    // Tudo que vem antes da instrução é exatamente o CORE.
    expect(texto.slice(0, fimDoCore - 1)).toBe(lerFixture('contexto-vera-perfil-vivo').split('\n## IDENTIDADE')[0]);
    // E o prompt do agente vem depois dela.
    expect(texto.indexOf('## IDENTIDADE')).toBeGreaterThan(fimDoCore);
  });
});

/* ── 3. Orçamento por bloco (A063) ─────────────────────────────────── */

describe('orçamento por bloco: partes somadas no máximo 20% acima do total de hoje', () => {
  const casos: Array<{ nome: string; entrada: AgentContextInput }> = [
    {
      nome: 'contexto-vera-perfil-vivo',
      entrada: entradaPura({
        org: ORG_CMJ,
        settings: SETTINGS_CMJ,
        agente: AGENTE_VERA,
        contato: CONTATO_VERA,
        ragContext: RAG_CMJ,
        ragStatus: 'ok',
        agendamento: AGENDAMENTO_CMJ,
        perfilVivo: true,
        izaFacts: '',
      }),
    },
    {
      nome: 'contexto-iza-primeiro-contato',
      entrada: entradaPura({
        org: ZAPPIQ_ORG_ID,
        settings: SETTINGS_IZA,
        agente: AGENTE_IZA,
        contato: {
          nome: null,
          leadStatus: 'NEW',
          primeiroContato: true,
          totalMensagens: 1,
          telefone: '5511988887777',
        },
        ragContext: '',
        ragStatus: 'sem_resultado',
        agendamento: null,
        perfilVivo: false,
        izaFacts: FACTS_DA_IZA,
      }),
    },
  ];

  for (const caso of casos) {
    it(`${caso.nome}: a soma das partes cabe no orçamento e as partes têm nome fixo`, () => {
      const saida = composeAgentContext(caso.entrada);
      const totalDeHoje = lerFixture(caso.nome).length;
      const soma = saida.partes.reduce((acc, p) => acc + p.chars, 0);

      // A soma exclui só os '\n' de junção, então nunca passa do total; o teto
      // de 20% é a régua da tarefa, para quem for acrescentar bloco novo.
      expect(soma).toBeLessThanOrEqual(Math.ceil(totalDeHoje * 1.2));
      expect(soma).toBeGreaterThan(totalDeHoje * 0.9);
      expect(saida.partes.map((p) => p.nome)).toEqual([...NOMES_DAS_PARTES]);
      // O CORE é sempre a maior fatia estável do prompt.
      expect(saida.partes[0].nome).toBe('core');
      expect(saida.partes[0].chars).toBeGreaterThan(5000);
    });
  }
});

/* ── 4. O caminho NOVO (flag contextoUnico ligada) bate com a fixture ── */

describe('buildSystemPromptForContact com contextoUnico LIGADO: mesmo texto, agora pelo motor único', () => {
  it('Vera (CMJ), perfil vivo ligado', async () => {
    armarVera();
    flags = { perfilVivo: true, contextoUnico: true };

    const novo = await buildSystemPromptForContact(ENTRADA_VERA);

    expect(novo).toBe(lerFixture('contexto-vera-perfil-vivo'));
    // Prova de que foi o motor único: o Agent foi escolhido pela regra nova
    // (papel por leadStatus, live, mais recente), com o select do carregador.
    const chamada = agentFindFirst.mock.calls[0][0];
    expect(chamada.where).toEqual({ organizationId: ORG_CMJ, role: 'comercial', status: 'live' });
    expect(chamada.select).toEqual({ id: true, name: true, systemPrompt: true, role: true });
  });

  it('Vera (CMJ), perfil vivo desligado', async () => {
    armarVera();
    flags = { contextoUnico: true };

    expect(await buildSystemPromptForContact(ENTRADA_VERA)).toBe(lerFixture('contexto-vera-sem-perfil-vivo'));
  });

  it('Vera (CMJ), A212 e base fora do ar', async () => {
    armarVera();
    flags = { perfilVivo: true, contextoUnico: true };

    const novo = await buildSystemPromptForContact({
      ...ENTRADA_VERA,
      ragStatus: 'servico_fora',
      temHistoricoNoContexto: false,
    });

    expect(novo).toBe(lerFixture('contexto-vera-a212-base-fora'));
  });

  it('Iza (ZappIQ), primeiro contato com iza_facts', async () => {
    armarIza();
    flags = { contextoUnico: true };

    expect(await buildSystemPromptForContact(ENTRADA_IZA)).toBe(lerFixture('contexto-iza-primeiro-contato'));
  });

  it('buildAgentContextForContact devolve hash, partes e a marca do motor único', async () => {
    armarVera();
    flags = { perfilVivo: true, contextoUnico: true };

    const saida = await buildAgentContextForContact(ENTRADA_VERA);
    const fixture = lerFixture('contexto-vera-perfil-vivo');

    expect(saida.viaContextoUnico).toBe(true);
    expect(saida.systemPrompt).toBe(fixture);
    expect(saida.hash).toBe(sha256(fixture));
    expect(saida.partes.map((p) => p.nome)).toEqual([...NOMES_DAS_PARTES]);
    expect(saida.contexto?.agente.id).toBe('agente-vera');
    expect(saida.contexto?.contato).toMatchObject({ nome: 'João', totalMensagens: 7, primeiroContato: false });
  });

  it('com a flag DESLIGADA, o hash é o mesmo e as partes ficam vazias (caminho de antes)', async () => {
    armarVera();
    flags = { perfilVivo: true };

    const saida = await buildAgentContextForContact(ENTRADA_VERA);

    expect(saida.viaContextoUnico).toBe(false);
    expect(saida.hash).toBe(sha256(lerFixture('contexto-vera-perfil-vivo')));
    expect(saida.partes).toEqual([]);
  });

  it('a instrução do passo do Maestro entra depois do CORE com o motor único (A076)', async () => {
    armarVera();
    flags = { perfilVivo: true, contextoUnico: true };

    const novo = await buildSystemPromptForContact({
      ...ENTRADA_VERA,
      instrucaoDeCanal: 'INSTRUÇÃO DO PASSO ATUAL DO FLUXO (Maestro): confirme o CEP.',
    });

    const fixture = lerFixture('contexto-vera-perfil-vivo');
    const core = fixture.split('\n## IDENTIDADE')[0];
    expect(novo.startsWith(core)).toBe(true);
    expect(novo.indexOf('INSTRUÇÃO DO PASSO ATUAL')).toBe(core.length + 1);
    expect(novo.indexOf('## IDENTIDADE')).toBeGreaterThan(novo.indexOf('INSTRUÇÃO DO PASSO ATUAL'));
  });

  it('sem Agent vivo, o motor único devolve ao fallback de sempre (promptEngine)', async () => {
    contactFindUnique.mockResolvedValue(CONTATO_JOAO);
    messageCount.mockResolvedValue(7);
    agentFindFirst.mockResolvedValue(null);
    flags = { contextoUnico: true };

    const saida = await buildAgentContextForContact(ENTRADA_VERA);

    expect(saida.viaContextoUnico).toBe(false);
    // O fallback do promptEngine começa pelo CORE e traz o nome do agente das settings.
    expect(saida.systemPrompt.startsWith(lerFixture('contexto-vera-perfil-vivo').split('\n## IDENTIDADE')[0])).toBe(true);
    expect(saida.systemPrompt).toContain('# Cliente atual');
  });

  it('CONVERTED sem agente de suporte cai no comercial, não no prompt genérico (A069)', async () => {
    contactFindUnique.mockResolvedValue({ leadStatus: 'CONVERTED', name: 'João', _count: { conversations: 3 } });
    messageCount.mockResolvedValue(7);
    agentFindFirst.mockImplementation(async (args: any) =>
      args.where.role === 'comercial'
        ? { id: 'agente-vera', name: 'Vera', role: 'comercial', systemPrompt: PROMPT_DA_VERA }
        : null,
    );
    flags = { perfilVivo: true, contextoUnico: true };

    const saida = await buildAgentContextForContact(ENTRADA_VERA);

    expect(saida.viaContextoUnico).toBe(true);
    expect(saida.contexto?.agente.role).toBe('comercial');
    expect(saida.systemPrompt).toContain(PROMPT_DA_VERA);
    expect(saida.systemPrompt).toContain('Status do lead: CONVERTED');
    expect(agentFindFirst.mock.calls.map((c: any[]) => c[0].where.role)).toEqual(['suporte', 'comercial']);
  });
});

/* ── 5. A 5ª fixture: regras aprovadas pelo dono (PR #375) ─────────── */

/**
 * Rodada 2 do PR #377. O compositor reservava `regrasDoCliente` e o
 * carregador não preenchia: com `regrasComoRegistros` E `contextoUnico`
 * ligados, a organização perdia as regras em todos os canais. A 5ª fixture é
 * o texto do caminho de antes do #375; o motor único tem de dar o mesmo.
 */
describe('5ª fixture: as regras aprovadas pelo dono no mesmo lugar, nos dois motores', () => {
  const REGRAS = [
    {
      id: 'regra-nome',
      organizationId: ORG_CMJ,
      agentId: 'agente-vera',
      scenarioId: 'cr5_nome_disponivel_usar',
      texto: 'Chame o cliente pelo nome quando souber.',
      origem: 'sugestao_ia',
      status: 'ativa',
      createdAt: new Date('2026-09-10T12:00:00Z'),
    },
    {
      id: 'regra-desconto',
      organizationId: ORG_CMJ,
      agentId: 'agente-vera',
      scenarioId: 'cr7_no_invent_preco_desconto',
      texto: '+ **REGRA INVIOLÁVEL #14 - DESCONTO:** Desconto só no PIX, até 5%. Acima disso, chame um especialista.',
      origem: 'editada',
      status: 'ativa',
      createdAt: new Date('2026-09-12T12:00:00Z'),
    },
  ];
  const BLOCO = montarBlocoDeRegras(REGRAS as any);

  it('caminho de antes (#375), regrasComoRegistros ligado: grava a 5ª fixture', async () => {
    armarVera();
    agentRuleFindMany.mockResolvedValue(REGRAS);
    flags = { perfilVivo: true, regrasComoRegistros: true };

    const hoje = await buildSystemPromptForContact(ENTRADA_VERA);
    const fixture = lerOuGravar('contexto-vera-regras', hoje);

    expect(hoje).toBe(fixture);
    expect(fixture).toContain(BLOCO);
    // A posição do #375: depois do perfil vivo e antes dos links.
    expect(fixture.indexOf('# Como você atende nesta empresa')).toBeLessThan(fixture.indexOf(TITULO_BLOCO_DE_REGRAS));
    expect(fixture.indexOf(TITULO_BLOCO_DE_REGRAS)).toBeLessThan(fixture.indexOf('### Links oficiais'));
    // É a fixture do perfil vivo com o bloco no meio, e nada mais.
    expect(fixture.replace(`${BLOCO}\n`, '')).toBe(lerFixture('contexto-vera-perfil-vivo'));
  });

  it('a função pura com regrasDoCliente produz a 5ª fixture byte a byte', () => {
    const saida = composeAgentContext(
      entradaPura({
        org: ORG_CMJ,
        settings: SETTINGS_CMJ,
        agente: AGENTE_VERA,
        contato: CONTATO_VERA,
        ragContext: RAG_CMJ,
        ragStatus: 'ok',
        agendamento: AGENDAMENTO_CMJ,
        perfilVivo: true,
        izaFacts: '',
        regrasDoCliente: BLOCO,
      }),
    );

    const fixture = lerFixture('contexto-vera-regras');
    expect(saida.systemPrompt).toBe(fixture);
    expect(saida.hash).toBe(sha256(fixture));
    expect(saida.partes.find((p) => p.nome === 'regras_do_cliente')?.chars).toBe(BLOCO.length);
  });

  it('com contextoUnico E regrasComoRegistros ligados, a casca produz a 5ª fixture pelo motor único', async () => {
    armarVera();
    agentRuleFindMany.mockResolvedValue(REGRAS);
    flags = { perfilVivo: true, regrasComoRegistros: true, contextoUnico: true };

    const saida = await buildAgentContextForContact(ENTRADA_VERA);

    expect(saida.viaContextoUnico).toBe(true);
    expect(saida.systemPrompt).toBe(lerFixture('contexto-vera-regras'));
    // Uma leitura só, das regras do agente que o turno usa.
    expect(agentRuleFindMany).toHaveBeenCalledTimes(1);
    expect(agentRuleFindMany.mock.calls[0][0].where).toEqual({
      organizationId: ORG_CMJ,
      agentId: 'agente-vera',
      status: 'ativa',
    });
  });

  it('regra na tabela com regrasComoRegistros DESLIGADO: as 4 fixtures antigas não mudam, nos dois motores, sem consulta', async () => {
    agentRuleFindMany.mockResolvedValue(REGRAS);
    const casos: Array<{ fixture: string; armar: () => void; flags: Record<string, boolean>; entrada: any }> = [
      { fixture: 'contexto-vera-perfil-vivo', armar: armarVera, flags: { perfilVivo: true }, entrada: ENTRADA_VERA },
      { fixture: 'contexto-vera-sem-perfil-vivo', armar: armarVera, flags: {}, entrada: ENTRADA_VERA },
      {
        fixture: 'contexto-vera-a212-base-fora',
        armar: armarVera,
        flags: { perfilVivo: true },
        entrada: { ...ENTRADA_VERA, ragStatus: 'servico_fora', temHistoricoNoContexto: false },
      },
      { fixture: 'contexto-iza-primeiro-contato', armar: armarIza, flags: {}, entrada: ENTRADA_IZA },
    ];
    for (const caso of casos) {
      for (const contextoUnico of [false, true]) {
        caso.armar();
        flags = { ...caso.flags, contextoUnico };
        const texto = await buildSystemPromptForContact(caso.entrada);
        expect(texto, `${caso.fixture} contextoUnico=${contextoUnico}`).toBe(lerFixture(caso.fixture));
      }
    }
    expect(agentRuleFindMany).not.toHaveBeenCalled();
  });

  it('no avaliador, o bloco fica depois do system_prompt e antes de # Cliente atual, nos dois motores', () => {
    // O avaliador de antes (#375) e o compositor com origem 'qualidade', sem
    // perfil vivo e sem links: CORE, prompt e bloco são o mesmo texto, e o
    // bloco do cliente vem logo depois. O que muda dali em diante (linha em
    // branco, cabeçalho "(eval test mock)", saudação, base, data) é a
    // diferença de propósito do motor único na Qualidade (A036), anterior a
    // esta rodada.
    const cenario = { id: 'cr7_no_invent_preco_desconto', userMessage: 'tem desconto?' };
    const legado = buildEvalSystemPrompt({ systemPrompt: PROMPT_DA_VERA }, cenario, BLOCO);
    const novo = composeAgentContext({
      origem: 'qualidade',
      agente: AGENTE_VERA,
      organizacao: { id: ORG_CMJ, nome: 'CMJ', settings: {}, ehZappIQ: false },
      contato: { nome: 'Rod', leadStatus: 'NEW', primeiroContato: true, totalMensagens: 1, telefone: '+5511999999999' },
      blocos: { izaFacts: '', perfilVivo: '', links: '', rag: '', regrasDoCliente: BLOCO },
      agora: AGORA,
    }).systemPrompt;

    const core = lerFixture('contexto-vera-perfil-vivo').split('\n## IDENTIDADE')[0];
    const ateAsRegras = `${[core, PROMPT_DA_VERA, BLOCO].join('\n')}\n`;
    expect(legado.startsWith(`${ateAsRegras}\n# Cliente atual (eval test mock)\n`)).toBe(true);
    expect(novo.startsWith(`${ateAsRegras}# Cliente atual\n`)).toBe(true);
  });
});
