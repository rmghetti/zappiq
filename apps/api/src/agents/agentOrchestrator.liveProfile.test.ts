/* ══════════════════════════════════════════════════════════════════════
 * O perfil vivo entra no prompt (e SÓ entra com o interruptor ligado).
 * --------------------------------------------------------------------
 * Duas garantias, nesta ordem de importância:
 *
 *   1. DESLIGADO, o prompt é byte a byte o de hoje. Fundir na main publica
 *      a API na hora, para os 15 agentes em produção ao mesmo tempo. Um
 *      teste que compara a string inteira é a única prova honesta de que
 *      ninguém muda de comportamento sem alguém ligar de propósito.
 *
 *   2. LIGADO, o bloco entra no lugar combinado: logo depois do prompt do
 *      agente e ANTES dos links, da saudação e do RAG. Posição é o que faz
 *      o prefixo estável continuar estável (cache de prompt) e o que faz o
 *      dado vivo vencer o texto congelado, que vem antes.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const agentFindFirst = vi.fn();
const messageCount = vi.fn();
const isFlagOn = vi.fn();
const orgFindUnique = vi.fn();
const tipoFindMany = vi.fn();

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
    organization: { findUnique: (...args: any[]) => orgFindUnique(...args) },
    appointmentType: { findMany: (...args: any[]) => tipoFindMany(...args) },
  },
}));

vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn().mockResolvedValue(''),
  invalidateIzaFactsCache: vi.fn(),
}));

vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: (...args: any[]) => isFlagOn(...args),
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

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  buildSystemPromptForContact,
  buildAgentContextForContact,
  resolveSchedulingRuntime,
} from './agentOrchestrator.js';
import { CORE_AGENT_RULES_V1 } from './coreAgentRules.js';
import { TEXTO_HORARIO_AUSENTE } from './tenantLiveProfile.js';
import { logger } from '../utils/logger.js';

const ORG = 'org-do-cmj';
const PROMPT_DO_AGENTE = '## IDENTIDADE\nVocê é Vera, atendente virtual da CMJ.';
const AGORA_UTC = new Date('2026-09-16T17:00:00Z'); // quarta, 14:00 em São Paulo

const SETTINGS = {
  agentName: 'Vera',
  businessName: 'CMJ',
  tone: 'formal',
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
  surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
};

const ENTRADA = {
  organizationId: ORG,
  contactId: 'contato-1',
  contactPhone: '5511999999999',
  orgSettings: SETTINGS,
  ragContext: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA_UTC);
  agentFindFirst.mockResolvedValue({ systemPrompt: PROMPT_DO_AGENTE, name: 'Vera' });
  messageCount.mockResolvedValue(7);
  isFlagOn.mockResolvedValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('interruptor perfilVivo DESLIGADO: prompt byte a byte igual ao de hoje', () => {
  it('a string inteira bate com a montagem atual, caractere por caractere', async () => {
    const prompt = await buildSystemPromptForContact(ENTRADA);

    const agora = AGORA_UTC.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const esperado = [
      CORE_AGENT_RULES_V1,
      PROMPT_DO_AGENTE,
      '### Links oficiais de CMJ (use EXATAMENTE estes, sem inventar variações)\n- Site oficial: https://cmj.com.br',
      '# Cliente atual',
      'Nome registrado: João',
      'Telefone: 5511999999999',
      'Status do lead: NEW',
      'Mensagens trocadas até agora: 7',
      'Primeiro contato? NÃO (já tem histórico — não pergunte nome de novo, use o que está acima)',
      // A028 (PR #365): busca sem resultado deixa o bloco do RAG VAZIO. A
      // frase "(sem contexto relevante...)" saiu do produto, porque ela
      // dizia a mesma coisa quando a base estava fora do ar.
      '# Contexto recuperado (RAG)',
      '# Agora',
      agora,
    ].join('\n');

    expect(prompt).toBe(esperado);
  });

  it('nada do bloco vivo aparece', async () => {
    const prompt = await buildSystemPromptForContact(ENTRADA);
    expect(prompt).not.toContain('# Como você atende nesta empresa');
    expect(prompt).not.toContain('Agora: aberto');
    expect(prompt).not.toContain(TEXTO_HORARIO_AUSENTE);
  });

  it('o interruptor é consultado pelo nome certo e pela organização certa', async () => {
    await buildSystemPromptForContact(ENTRADA);
    expect(isFlagOn).toHaveBeenCalledWith(ORG, 'perfilVivo');
  });

  it('erro ao ler o interruptor não derruba o turno (segue sem o bloco)', async () => {
    isFlagOn.mockRejectedValue(new Error('redis fora'));
    const prompt = await buildSystemPromptForContact(ENTRADA);
    expect(prompt).toContain(PROMPT_DO_AGENTE);
    expect(prompt).not.toContain('# Como você atende nesta empresa');
  });
});

describe('motor único: erro no carregador não derruba o turno', () => {
  it('banco fora com contextoUnico ligada: o turno responde pelo caminho de antes', async () => {
    // O caminho de antes já cai no promptEngine quando o Agent falha, e o
    // chat do site faz o mesmo. Um erro de banco dentro do motor único não
    // pode ser a única exceção que derruba o turno do WhatsApp.
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'contextoUnico');
    agentFindFirst.mockRejectedValue(new Error('banco fora'));

    const r = await buildAgentContextForContact(ENTRADA);

    expect(r.viaContextoUnico).toBe(false);
    expect(r.systemPrompt).toContain(CORE_AGENT_RULES_V1);
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('motor único falhou'),
      expect.objectContaining({ organizationId: ORG }),
    );
  });
});

describe('interruptor perfilVivo LIGADO: o bloco entra no lugar combinado', () => {
  beforeEach(() => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');
  });

  it('só perfilVivo ligado: o prompt sai pelo caminho de antes, com o bloco vivo', async () => {
    // Este describe prova o caminho de antes com o bloco vivo. O motor único
    // (contextoUnico) tem a própria prova no snapshot; aqui ele fica desligado.
    const r = await buildAgentContextForContact(ENTRADA);
    expect(r.viaContextoUnico).toBe(false);
    expect(r.partes).toEqual([]);
    expect(r.systemPrompt).toContain('# Como você atende nesta empresa');
  });

  it('o bloco vem depois do prompt do agente e antes dos links, da saudação e do RAG', async () => {
    messageCount.mockResolvedValue(1); // primeiro contato: a saudação existe
    const prompt = await buildSystemPromptForContact({
      ...ENTRADA,
      orgSettings: { ...SETTINGS, greetingMessage: 'Olá, que bom te ver!' },
    });

    // lastIndexOf porque o CORE já cita "# Cliente atual" no texto dele: o que
    // interessa aqui é a posição do bloco montado, que vem sempre depois.
    const posPrompt = prompt.indexOf(PROMPT_DO_AGENTE);
    const posBloco = prompt.indexOf('# Como você atende nesta empresa');
    const posLinks = prompt.indexOf('### Links oficiais de CMJ');
    const posCliente = prompt.lastIndexOf('# Cliente atual');
    const posSaudacao = prompt.lastIndexOf('# Saudação configurada pelo dono do negócio');
    const posRag = prompt.lastIndexOf('# Contexto recuperado (RAG)');

    expect(posPrompt).toBeGreaterThanOrEqual(0);
    expect(posBloco).toBeGreaterThan(posPrompt);
    expect(posBloco).toBeLessThan(posLinks);
    expect(posLinks).toBeLessThan(posCliente);
    expect(posCliente).toBeLessThan(posSaudacao);
    expect(posSaudacao).toBeLessThan(posRag);
  });

  it('o horário e o "agora" vêm do businessHoursConfig, calculados por código', async () => {
    const prompt = await buildSystemPromptForContact(ENTRADA);
    expect(prompt).toContain('Segunda a sexta: 09:00 às 18:00');
    expect(prompt).toContain('Agora: aberto');
  });

  it('organização sem horário cadastrado recebe a trava, não "Domingo: Fechado"', async () => {
    const prompt = await buildSystemPromptForContact({
      ...ENTRADA,
      orgSettings: { agentName: 'Vera', businessName: 'CMJ' },
    });
    expect(prompt).toContain(TEXTO_HORARIO_AUSENTE);
    expect(prompt).not.toMatch(/Domingo:\s*Fechado/i);
  });

  it('sem agendamento resolvido pelo chamador, o bloco não fala de agendamento', async () => {
    const prompt = await buildSystemPromptForContact(ENTRADA);
    expect(prompt).not.toContain('- Agendamento:');
  });

  it('agendamento desligado: proíbe oferecer agendamento', async () => {
    const prompt = await buildSystemPromptForContact({
      ...ENTRADA,
      agendamento: { ativo: false },
    });
    expect(prompt).toContain('não ofereça agendamento por aqui');
  });

  it('agendamento ligado: lista os tipos ativos reais', async () => {
    const prompt = await buildSystemPromptForContact({
      ...ENTRADA,
      agendamento: { ativo: true, tipos: ['Avaliação'] },
    });
    expect(prompt).toContain('Agendamento: disponível para: Avaliação');
  });
});

describe('agendamento ligado é tipo ativo E direito ao recurso (A066, A165)', () => {
  beforeEach(() => {
    orgFindUnique.mockResolvedValue({ plan: 'GROWTH', settings: { scheduling: { enabled: true } } });
    tipoFindMany.mockResolvedValue([{ name: 'Avaliação' }, { name: 'Retorno' }]);
  });

  it('interruptor ligado, plano com direito e tipo ativo: agendamento ativo', async () => {
    const r = await resolveSchedulingRuntime(ORG, { scheduling: { enabled: true } });
    expect(r.ativo).toBe(true);
    expect(r.tipos).toEqual(['Avaliação', 'Retorno']);
  });

  it('o caso do CMJ: interruptor ligado e ZERO tipos cadastrados NÃO liga', async () => {
    // Em produção o CMJ tem scheduling.enabled=true e nenhum appointment_type:
    // todo turno ia para Sonnet só para responder que não faz agendamento.
    tipoFindMany.mockResolvedValue([]);
    const r = await resolveSchedulingRuntime(ORG, { scheduling: { enabled: true } });
    expect(r.ativo).toBe(false);
    expect(r.motivo).toBe('sem_tipo_ativo');
  });

  it('tipo cadastrado mas plano sem direito ao recurso: não liga', async () => {
    orgFindUnique.mockResolvedValue({ plan: 'IZA_LITE', settings: {} });
    const r = await resolveSchedulingRuntime(ORG, { scheduling: { enabled: true } });
    expect(r.ativo).toBe(false);
    expect(r.motivo).toBe('sem_direito');
  });

  it('add-on comprado no plano Lite dá direito', async () => {
    orgFindUnique.mockResolvedValue({ plan: 'IZA_LITE', settings: { addons: ['SCHEDULING_AGENT'] } });
    const r = await resolveSchedulingRuntime(ORG, { scheduling: { enabled: true } });
    expect(r.ativo).toBe(true);
  });

  it('optOut do dono desliga, mesmo com tipo e direito', async () => {
    const r = await resolveSchedulingRuntime(ORG, { scheduling: { enabled: true, optOut: true } });
    expect(r.ativo).toBe(false);
    expect(r.motivo).toBe('optou_por_sair');
  });

  it('organização que nunca mexeu no agendamento: desligado, sem consultar tipo', async () => {
    tipoFindMany.mockClear();
    const r = await resolveSchedulingRuntime(ORG, {});
    expect(r.ativo).toBe(false);
    expect(r.motivo).toBe('nao_ligado');
    expect(tipoFindMany).not.toHaveBeenCalled();
  });

  it('erro de banco não liga agendamento por acidente', async () => {
    tipoFindMany.mockRejectedValue(new Error('banco fora'));
    const r = await resolveSchedulingRuntime(ORG, { scheduling: { enabled: true } });
    expect(r.ativo).toBe(false);
  });
});

describe('"já tem histórico": a IA só ouve isso quando o histórico está no contexto (A212)', () => {
  it('com o interruptor ligado e sem histórico no contexto, a frase muda', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');
    const prompt = await buildSystemPromptForContact({ ...ENTRADA, temHistoricoNoContexto: false });
    expect(prompt).not.toContain('já tem histórico');
    expect(prompt).toContain('o que foi conversado antes NÃO está aqui');
  });

  it('com o interruptor ligado e histórico presente, a frase antiga continua', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');
    const prompt = await buildSystemPromptForContact({ ...ENTRADA, temHistoricoNoContexto: true });
    expect(prompt).toContain('já tem histórico');
  });

  it('com o interruptor desligado, nada muda mesmo sem histórico', async () => {
    isFlagOn.mockResolvedValue(false);
    const prompt = await buildSystemPromptForContact({ ...ENTRADA, temHistoricoNoContexto: false });
    expect(prompt).toContain('já tem histórico');
  });
});

describe('as regras do questionário chegam ao prompt (B3)', () => {
  const COM_REGRAS = {
    ...ENTRADA,
    orgSettings: {
      ...SETTINGS,
      surveyAnswers: {
        ...SETTINGS.surveyAnswers,
        precos_condicoes: {
          pre_desconto_maximo: 'Até 10% à vista, aprovado pelo gerente',
          pre_quem_aprova_desconto: 'O gerente comercial',
          pre_tabela_precos: 'Plano mensal R$ 149',
        },
      },
    },
  };

  it('desligado, a política de desconto continua fora do prompt', async () => {
    isFlagOn.mockResolvedValue(false);
    const prompt = await buildSystemPromptForContact(COM_REGRAS);
    expect(prompt).not.toContain('Até 10% à vista');
  });

  it('ligado, quem perguntar sobre desconto encontra a política nas instruções', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');
    const prompt = await buildSystemPromptForContact(COM_REGRAS);
    expect(prompt).toContain('Até 10% à vista, aprovado pelo gerente');
    expect(prompt).toContain('O gerente comercial');
    // A tabela de preços é conhecimento: ela vive na busca, não no prompt.
    expect(prompt).not.toContain('Plano mensal R$ 149');
    // E continua sendo o bloco vivo, depois do prompt gravado do agente.
    const posBloco = prompt.indexOf('# Como você atende nesta empresa');
    expect(posBloco).toBeGreaterThan(prompt.indexOf(PROMPT_DO_AGENTE));
  });
});
