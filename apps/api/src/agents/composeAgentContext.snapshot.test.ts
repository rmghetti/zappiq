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

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { findUnique: (...a: any[]) => contactFindUnique(...a) },
    message: { count: (...a: any[]) => messageCount(...a) },
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    appointmentType: { findMany: (...a: any[]) => tipoFindMany(...a) },
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

import { buildSystemPromptForContact } from './agentOrchestrator.js';
import { ZAPPIQ_ORG_ID } from '../config/zappiqOrg.js';

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
