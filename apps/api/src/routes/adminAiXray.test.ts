/**
 * POST /api/admin/ai-xray: Raio-X do que a IA recebe.
 * ============================================================================
 * Tarefa A3. O que este teste precisa provar:
 *
 *   1. É rota de SUPERADMIN. Qualquer outro papel leva 403.
 *   2. O corpo é validado: 1 a 25 mensagens, nada fora disso.
 *   3. NUNCA chama modelo de linguagem. O LLMRouter e o cliente de chat são
 *      injetados lançando exceção: se o Raio-X chamar qualquer um, o teste cai.
 *   4. Cada canal monta o prompt pelo caminho da produção daquele canal, o que
 *      inclui reproduzir o defeito A057 (o Instagram roda com as configurações
 *      do cliente vazias). Quando o defeito for corrigido, o Raio-X passa a
 *      mostrar a correção sozinho.
 *
 * Sem supertest: o server.ts puxa Redis, OTel e BullMQ no import. Aqui a gente
 * pega o router, percorre a pilha real da rota (authMiddleware falso que só
 * injeta o usuário + requireRole DE VERDADE + handler) e chama com req/res
 * falsos. É o mesmo padrão de conversations.tenant.test.ts.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Quem está logado neste teste ─────────────────────────────────────── */
let usuarioAtual: any = { userId: 'u1', organizationId: 'org-admin', role: 'SUPERADMIN' };

vi.mock('../middleware/auth.js', async (original) => {
  const real = await (original() as Promise<typeof import('../middleware/auth.js')>);
  return {
    ...real,
    // requireRole continua REAL: é ele que precisa devolver o 403.
    authMiddleware: (req: any, _res: any, next: any) => {
      req.user = usuarioAtual;
      next();
    },
  };
});

/* ── Banco falso ──────────────────────────────────────────────────────── */
const orgFindUnique = vi.fn();
const agentFindFirst = vi.fn();
const qaFindMany = vi.fn();
const contactFindUnique = vi.fn().mockResolvedValue(null);
const messageCount = vi.fn().mockResolvedValue(0);
// resolveSchedulingRuntime só chega aqui quando scheduling.enabled é true.
const appointmentTypeFindMany = vi.fn().mockResolvedValue([]);
// O chat do site carrega o prompt por SQL cru (webChatService.loadOrgSystemPrompt).
const queryRawUnsafe = vi.fn();
// C3: as regras aprovadas pelo dono, lidas por agentRulesService.
const agentRuleFindMany = vi.fn().mockResolvedValue([]);

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    qAPair: { findMany: (...a: any[]) => qaFindMany(...a) },
    contact: { findUnique: (...a: any[]) => contactFindUnique(...a) },
    message: { count: (...a: any[]) => messageCount(...a) },
    appointmentType: { findMany: (...a: any[]) => appointmentTypeFindMany(...a) },
    agentRule: { findMany: (...a: any[]) => agentRuleFindMany(...a) },
    $queryRawUnsafe: (...a: any[]) => queryRawUnsafe(...a),
  },
}));

/* ── RAG falso (nenhuma chamada de rede) ──────────────────────────────── */
const searchWithSources = vi.fn().mockResolvedValue({
  context: 'Trecho da base: o rodízio custa R$ 89.',
  sources: [{ source: 'cardapio.pdf', similarity: 0.61, snippet: 'rodízio R$ 89' }],
});

vi.mock('../services/ragService.js', () => ({
  searchWithSources: (...a: any[]) => searchWithSources(...a),
  search: vi.fn(),
  namespaceFor: (id: string) => `org_${id}`,
}));

/* ── Modelo de linguagem: injetado lançando. Chamou, quebrou. ─────────── */
const llmComplete = vi.fn(() => {
  throw new Error('o Raio-X chamou o modelo, e não pode');
});
const chatCompletion = vi.fn(() => {
  throw new Error('o Raio-X chamou o modelo, e não pode');
});

vi.mock('../services/llm/LLMRouter.js', () => ({
  llmRouter: { complete: llmComplete },
}));
vi.mock('../services/llm/langchainClient.js', () => ({
  chatCompletion,
}));

vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn().mockResolvedValue(''),
  invalidateIzaFactsCache: vi.fn(),
}));

// O perfil vivo (A8) consulta o interruptor por organização. Sem este mock, o
// Raio-X tentaria abrir conexão com o Redis no meio de um teste que não pode
// tocar em infraestrutura. Controlável por caso: o Raio-X precisa mostrar o
// bloco vivo nos DOIS canais quando o interruptor está ligado.
const isFlagOn = vi.fn().mockResolvedValue(false);
vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: (...a: any[]) => isFlagOn(...a),
}));

// O Raio-X importa o orquestrador, que importa o motor de fluxos, e o
// agendador dele cria a fila BullMQ no import, abrindo conexão com o Redis em
// segundo plano. Fila falsa: nenhum teste daqui enfileira nada.
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { default: router } = await import('./adminAiXray.js');

/* ── Utilidades do teste ──────────────────────────────────────────────── */

type Camada = { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: any }> } };

function pilhaDaRota(method: string, path: string) {
  const stack = (router as unknown as { stack: Camada[] }).stack;
  const camada = stack.find((l) => l.route?.path === path && !!l.route?.methods?.[method]);
  if (!camada?.route) throw new Error(`rota ${method} ${path} não encontrada`);
  return camada.route.stack.map((s) => s.handle);
}

function fazerRes() {
  const res: any = { statusCode: 200, body: undefined, terminou: false };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: any) => {
    res.body = b;
    res.terminou = true;
    return res;
  });
  return res;
}

/** Percorre a pilha real da rota, parando quando alguém responde. */
async function chamar(body: any) {
  const handlers = pilhaDaRota('post', '/');
  const req: any = { body, headers: {}, params: {}, query: {} };
  const res = fazerRes();
  for (const handler of handlers) {
    let seguiu = false;
    await handler(req, res, (err?: any) => {
      if (err) throw err;
      seguiu = true;
    });
    if (res.terminou || !seguiu) break;
  }
  return res;
}

const SETTINGS_DA_ORG = {
  niche: 'restaurante',
  agentName: 'Antonella',
  businessName: 'Cantina da Nona',
  tone: 'formal',
  greetingMessage: 'Bom dia! Que bom ter você por aqui na Cantina da Nona.',
  businessHours: { weekdays: '09:00 às 18:00', sunday: '12:00 às 22:00' },
  surveyAnswers: { identidade_empresa: { ide_site_url: 'cantinadanona.com.br' } },
};

const PROMPT_DO_AGENTE = '## IDENTIDADE\nVocê é a Antonella da Cantina da Nona.\n## TOM DE VOZ — FORMAL\nrespeitosa';

beforeEach(() => {
  vi.clearAllMocks();
  isFlagOn.mockResolvedValue(false);
  contactFindUnique.mockResolvedValue(null);
  messageCount.mockResolvedValue(0);
  appointmentTypeFindMany.mockResolvedValue([]);
  usuarioAtual = { userId: 'u1', organizationId: 'org-admin', role: 'SUPERADMIN' };
  orgFindUnique.mockResolvedValue({ id: 'org-1', name: 'Cantina da Nona', settings: SETTINGS_DA_ORG });
  agentFindFirst.mockResolvedValue({ id: 'a1', name: 'Antonella', systemPrompt: PROMPT_DO_AGENTE });
  qaFindMany.mockResolvedValue([{ id: 'q1', question: 'Vocês atendem aos sábados?' }]);
  queryRawUnsafe.mockResolvedValue([{ system_prompt: PROMPT_DO_AGENTE }]);
  agentRuleFindMany.mockResolvedValue([]);
  searchWithSources.mockResolvedValue({
    context: 'Trecho da base: o rodízio custa R$ 89.',
    sources: [{ source: 'cardapio.pdf', similarity: 0.61, snippet: 'rodízio R$ 89' }],
  });
});

const corpoValido = {
  organizationId: 'org-1',
  canal: 'whatsapp',
  messages: [{ role: 'user', content: 'vocês abrem domingo?' }],
};

/* ── 1. Portão de papel ───────────────────────────────────────────────── */

describe('POST /api/admin/ai-xray: quem pode entrar', () => {
  it('403 para quem não é SUPERADMIN', async () => {
    usuarioAtual = { userId: 'u2', organizationId: 'org-1', role: 'ADMIN' };

    const res = await chamar(corpoValido);

    expect(res.statusCode).toBe(403);
    expect(orgFindUnique).not.toHaveBeenCalled();
  });

  it('403 também para AUDITOR e AGENT', async () => {
    for (const role of ['AUDITOR', 'AGENT']) {
      usuarioAtual = { userId: 'u3', organizationId: 'org-1', role };
      const res = await chamar(corpoValido);
      expect(res.statusCode, role).toBe(403);
    }
  });

  it('SUPERADMIN passa', async () => {
    const res = await chamar(corpoValido);

    expect(res.statusCode).toBe(200);
  });
});

/* ── 2. Validação do corpo ────────────────────────────────────────────── */

describe('POST /api/admin/ai-xray: validação do corpo', () => {
  it('400 com 26 mensagens', async () => {
    const messages = Array.from({ length: 26 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));

    const res = await chamar({ ...corpoValido, messages });

    expect(res.statusCode).toBe(400);
    expect(orgFindUnique).not.toHaveBeenCalled();
  });

  it('aceita exatamente 25 mensagens', async () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));

    const res = await chamar({ ...corpoValido, messages });

    expect(res.statusCode).toBe(200);
    expect(res.body.turnos).toHaveLength(25);
  });

  it('400 com lista de mensagens vazia', async () => {
    const res = await chamar({ ...corpoValido, messages: [] });

    expect(res.statusCode).toBe(400);
  });

  it('400 com canal desconhecido', async () => {
    const res = await chamar({ ...corpoValido, canal: 'telegrama' });

    expect(res.statusCode).toBe(400);
  });

  it('404 quando a organização não existe', async () => {
    orgFindUnique.mockResolvedValue(null);

    const res = await chamar(corpoValido);

    expect(res.statusCode).toBe(404);
  });
});

/* ── 3. Nunca chama o modelo ──────────────────────────────────────────── */

describe('POST /api/admin/ai-xray: não gasta LLM', () => {
  it('nenhum canal chama o modelo', async () => {
    for (const canal of ['whatsapp', 'instagram', 'site', 'playground', 'qualidade']) {
      const res = await chamar({ ...corpoValido, canal });
      expect(res.statusCode, canal).toBe(200);
    }

    expect(llmComplete).not.toHaveBeenCalled();
    expect(chatCompletion).not.toHaveBeenCalled();
  });
});

/* ── 4. O que cada canal monta ────────────────────────────────────────── */

describe('POST /api/admin/ai-xray: o prompt de cada canal', () => {
  it('WhatsApp consulta a base e devolve fatias, fontes e checagens', async () => {
    const res = await chamar(corpoValido);

    expect(searchWithSources).toHaveBeenCalledWith('org-1', 'vocês abrem domingo?', 5);
    const turno = res.body.turnos[0];
    expect(turno.mensagem).toBe('vocês abrem domingo?');
    expect(turno.prompt_chars).toBeGreaterThan(100);
    expect(turno.fatias.map((f: any) => f.titulo)).toContain('Regras base (CORE)');
    expect(turno.fontes).toEqual([{ source: 'cardapio.pdf', similarity: 0.61 }]);
    expect(turno.checagens.length).toBeGreaterThanOrEqual(8);
  });

  it('o chat do site e o teste de Qualidade não consultam a base (achados A068 e A036)', async () => {
    for (const canal of ['site', 'qualidade']) {
      vi.clearAllMocks();
      orgFindUnique.mockResolvedValue({ id: 'org-1', name: 'Cantina da Nona', settings: SETTINGS_DA_ORG });
      agentFindFirst.mockResolvedValue({ id: 'a1', name: 'Antonella', systemPrompt: PROMPT_DO_AGENTE });
      qaFindMany.mockResolvedValue([]);

      const res = await chamar({ ...corpoValido, canal });

      expect(searchWithSources, canal).not.toHaveBeenCalled();
      const base = res.body.turnos[0].checagens.find((c: any) => c.id === 'base_consultada');
      expect(base.ok, canal).toBe(false);
      expect(res.body.turnos[0].fontes, canal).toEqual([]);
    }
  });

  it('o Instagram agora roda com as configurações do cliente, igual ao WhatsApp (A057 corrigido)', async () => {
    // Este caso nasceu reproduzindo o defeito: o webhook do Instagram
    // enfileirava orgSettings vazio e a saudação configurada sumia no Direct.
    // Corrigido em 14/09/2026 (tarefa A8). O Raio-X mostra a correção.
    const noWhatsapp = await chamar({ ...corpoValido, canal: 'whatsapp' });
    const noInstagram = await chamar({ ...corpoValido, canal: 'instagram' });

    const saudacao = (res: any) =>
      res.body.turnos[0].checagens.find((c: any) => c.id === 'saudacao_no_primeiro_contato');

    expect(saudacao(noWhatsapp).ok).toBe(true);
    expect(saudacao(noInstagram).ok).toBe(true);
  });

  it('só as mensagens do cliente viram turno; as do agente entram no histórico', async () => {
    const res = await chamar({
      ...corpoValido,
      messages: [
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: 'olá, tudo bem?' },
        { role: 'user', content: 'quanto custa o rodízio?' },
      ],
    });

    expect(res.body.turnos.map((t: any) => t.mensagem)).toEqual(['oi', 'quanto custa o rodízio?']);
  });

  it('a resposta devolve a organização e o canal pedidos', async () => {
    const res = await chamar({ ...corpoValido, canal: 'playground' });

    expect(res.body.organizationId).toBe('org-1');
    expect(res.body.canal).toBe('playground');
  });
});

/* ── 5. O canal site usa o carregador do próprio chat do site ─────────── */

describe('POST /api/admin/ai-xray: o canal site não reimplementa a escolha do prompt', () => {
  it('carrega o prompt por webChatService.loadOrgSystemPrompt, não por agent.findFirst', async () => {
    // Org nova de propósito: loadOrgSystemPrompt guarda o prompt em memória
    // por 5 minutos, então uma org já usada em outro teste não bateria no SQL.
    orgFindUnique.mockResolvedValue({ id: 'org-site-1', name: 'Cantina', settings: SETTINGS_DA_ORG });

    const res = await chamar({ ...corpoValido, organizationId: 'org-site-1', canal: 'site' });

    expect(res.statusCode).toBe(200);
    expect(queryRawUnsafe).toHaveBeenCalled();
    expect(String(queryRawUnsafe.mock.calls[0][0])).toContain('FROM agents');
    expect(queryRawUnsafe.mock.calls[0][1]).toBe('org-site-1');
    // A rota não pode ter cópia da regra: quem escolhe o agente é o serviço.
    expect(agentFindFirst).not.toHaveBeenCalled();
    expect(res.body.turnos[0].prompt_chars).toBeGreaterThan(100);
  });

  it('422 sem_prompt quando a organização não tem agente comercial ativo', async () => {
    orgFindUnique.mockResolvedValue({ id: 'org-sem-agente', name: 'Sem agente', settings: SETTINGS_DA_ORG });
    queryRawUnsafe.mockResolvedValue([]);

    const res = await chamar({ ...corpoValido, organizationId: 'org-sem-agente', canal: 'site' });

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('sem_prompt');
    expect(res.body.message).toContain('agente comercial ativo');
  });

  it('o 422 é só do canal site; o de Qualidade segue montando com o prompt vazio', async () => {
    orgFindUnique.mockResolvedValue({ id: 'org-sem-agente-2', name: 'Sem agente', settings: SETTINGS_DA_ORG });
    queryRawUnsafe.mockResolvedValue([]);
    agentFindFirst.mockResolvedValue(null);

    const res = await chamar({ ...corpoValido, organizationId: 'org-sem-agente-2', canal: 'qualidade' });

    expect(res.statusCode).toBe(200);
  });

  it('falha inesperada de banco continua dando 500, não 422', async () => {
    orgFindUnique.mockRejectedValue(new Error('banco fora do ar'));

    const res = await chamar({ ...corpoValido, canal: 'site' });

    expect(res.statusCode).toBe(500);
  });

  it('banco fora do ar na busca do agente do site dá 500, não 422 de sem_prompt', async () => {
    // Org nova de propósito: o cache de 5 minutos do loadOrgSystemPrompt
    // devolveria o prompt de um teste anterior e a consulta nem aconteceria.
    orgFindUnique.mockResolvedValue({ id: 'org-site-caiu', name: 'Cantina', settings: SETTINGS_DA_ORG });
    queryRawUnsafe.mockRejectedValue(new Error('banco fora do ar'));

    const res = await chamar({ ...corpoValido, organizationId: 'org-site-caiu', canal: 'site' });

    expect(res.statusCode).toBe(500);
    expect(res.body.error).not.toBe('sem_prompt');
  });
});


/* ── 6. O perfil vivo aparece nos DOIS canais ─────────────────────────── */
/*
 * Correção da revisão do PR #368. O Raio-X do canal `site` montava o prompt
 * sem o bloco vivo e sem a saudação, então quem ligasse o interruptor e
 * fosse conferir no Raio-X veria o prompt de antes e concluiria que a
 * correção não funcionou. O Raio-X só vale se repetir o caminho da produção
 * de cada canal, inteiro.
 */

const CABECALHO_VIVO = '# Como você atende nesta empresa';
const CABECALHO_SAUDACAO = '# Saudação configurada pelo dono do negócio';

/** Junta as fatias de volta: é o prompt inteiro, caractere por caractere. */
function promptDoTurno(res: any, indice = 0): string {
  return res.body.turnos[indice].fatias.map((f: any) => f.texto).join('\n');
}

describe('POST /api/admin/ai-xray: o bloco vivo com o interruptor ligado', () => {
  it('com o interruptor DESLIGADO, nenhum canal mostra o bloco vivo', async () => {
    for (const canal of ['whatsapp', 'site']) {
      const res = await chamar({ ...corpoValido, canal });
      expect(promptDoTurno(res), canal).not.toContain(CABECALHO_VIVO);
    }
  });

  it('com o interruptor LIGADO, o bloco vivo aparece no WhatsApp E no site', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');

    for (const canal of ['whatsapp', 'site']) {
      const res = await chamar({ ...corpoValido, canal });
      const prompt = promptDoTurno(res);

      expect(res.statusCode, canal).toBe(200);
      expect(prompt, canal).toContain(CABECALHO_VIVO);
      // Só perfilVivo ligada: é o caminho de antes que mostra o bloco vivo.
      expect(res.body.turnos[0].motor, canal).toBe('antes');
      // O horário do cadastro, já normalizado pelo bloco vivo.
      expect(prompt, canal).toContain('Segunda a sexta: 09:00 às 18:00');
      expect(prompt, canal).toContain('Você é Antonella, de Cantina da Nona.');
    }
  });

  it('com o interruptor LIGADO, a saudação do dono entra no primeiro turno do site (A068)', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');

    const res = await chamar({
      ...corpoValido,
      canal: 'site',
      messages: [
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: 'olá' },
        { role: 'user', content: 'vocês abrem domingo?' },
      ],
    });

    // Primeiro turno: histórico vazio, saudação entra.
    expect(promptDoTurno(res, 0)).toContain(CABECALHO_SAUDACAO);
    expect(promptDoTurno(res, 0)).toContain('Que bom ter você por aqui na Cantina da Nona');
    // Turno seguinte: já tem histórico, a saudação não se repete.
    expect(promptDoTurno(res, 1)).not.toContain(CABECALHO_SAUDACAO);
  });

  it('a checagem horario_confere fica VERDE nos dois canais com o interruptor ligado', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');

    for (const canal of ['whatsapp', 'site']) {
      const res = await chamar({ ...corpoValido, canal });
      const horario = res.body.turnos[0].checagens.find((c: any) => c.id === 'horario_confere');
      expect(horario.ok, canal).toBe(true);
    }
  });
});

/* ── 7. Agendamento e histórico no prompt do WhatsApp/Instagram ───────── */
/*
 * O Raio-X montava o prompt do WhatsApp sem resolver o agendamento e sem
 * dizer se o histórico está no contexto. Os dois mudam o texto que a IA
 * recebe, então o Raio-X mostrava um prompt que a produção não monta.
 */

describe('POST /api/admin/ai-xray: as regras aprovadas pelo dono (C3)', () => {
  const REGRA = {
    id: 'regra-1',
    organizationId: 'org-1',
    agentId: 'a1',
    scenarioId: 'cr5_nome_disponivel_usar',
    texto: 'Chame o cliente pelo nome quando souber.',
    origem: 'sugestao_ia',
    status: 'ativa',
    createdAt: new Date('2026-09-14T10:00:00Z'),
  };

  it('com o interruptor DESLIGADO, nenhum canal mostra o bloco de regras', async () => {
    agentRuleFindMany.mockResolvedValue([REGRA]);
    for (const canal of ['whatsapp', 'site']) {
      const res = await chamar({ ...corpoValido, canal });
      expect(promptDoTurno(res), canal).not.toContain('# Regras aprovadas pelo dono');
    }
    // Desligado nem consulta o banco: é a mesma conta de hoje por turno.
    expect(agentRuleFindMany).not.toHaveBeenCalled();
  });

  it('com o interruptor LIGADO, o bloco aparece no WhatsApp E no site', async () => {
    // Só o interruptor deste caso (rodada 2 do PR #377): `true` para todos
    // ligaria também o motor único, que tem teste próprio mais abaixo.
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'regrasComoRegistros');
    agentRuleFindMany.mockResolvedValue([REGRA]);

    for (const canal of ['whatsapp', 'site']) {
      const res = await chamar({ ...corpoValido, canal });
      const prompt = promptDoTurno(res);
      expect(res.statusCode, canal).toBe(200);
      expect(prompt, canal).toContain('# Regras aprovadas pelo dono');
      expect(prompt, canal).toContain('1. Chame o cliente pelo nome quando souber.');
    }
  });

  // Rodada 3 do PR #375. O avaliador montava o prompt sem o bloco: o Raio-X
  // do canal de Qualidade mostrava, corretamente, que o teste media o agente
  // SEM a regra aprovada. Agora o canal monta com o bloco do agente testado.
  it('com o interruptor LIGADO, o teste de Qualidade também recebe o bloco, do agente testado', async () => {
    // Só o interruptor deste caso (rodada 2 do PR #377): `true` para todos
    // ligaria também o motor único, que tem teste próprio mais abaixo.
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'regrasComoRegistros');
    agentRuleFindMany.mockResolvedValue([REGRA]);

    const res = await chamar({ ...corpoValido, canal: 'qualidade' });

    expect(res.statusCode).toBe(200);
    const prompt = promptDoTurno(res);
    expect(prompt).toContain('# Regras aprovadas pelo dono');
    expect(prompt).toContain('1. Chame o cliente pelo nome quando souber.');
    // Antes do bloco do cliente, como no orquestrador.
    expect(prompt.indexOf('# Regras aprovadas pelo dono')).toBeLessThan(
      prompt.indexOf('# Cliente atual (eval test mock)'),
    );
    // Filtrado pelo agente que o canal carregou (a1), não só pela organização.
    expect(agentRuleFindMany.mock.calls[0][0].where).toMatchObject({
      organizationId: 'org-1',
      agentId: 'a1',
    });
  });

  // Rodada 3 do PR #375 (item 4). O canal site montava o bloco por
  // organização, sem agentId, enquanto o chat do site monta por agente
  // (webChatService.idDoAgenteComercial). Com dois agentes vivos, o Raio-X
  // mostraria as regras do outro. Agora os dois usam o MESMO seletor.
  it('com o interruptor LIGADO, o canal site filtra as regras pelo agente comercial, como o chat', async () => {
    // Só o interruptor deste caso (rodada 2 do PR #377): `true` para todos
    // ligaria também o motor único, que tem teste próprio mais abaixo.
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'regrasComoRegistros');
    agentRuleFindMany.mockResolvedValue([REGRA]);
    orgFindUnique.mockResolvedValue({ id: 'org-site-agente', name: 'Cantina', settings: SETTINGS_DA_ORG });

    const res = await chamar({ ...corpoValido, organizationId: 'org-site-agente', canal: 'site' });

    expect(res.statusCode).toBe(200);
    expect(promptDoTurno(res)).toContain('1. Chame o cliente pelo nome quando souber.');
    // O seletor do chat do site: comercial, vivo, o mais antigo.
    expect(agentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-site-agente', role: 'comercial', status: 'live' },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(agentRuleFindMany.mock.calls[0][0].where).toMatchObject({
      organizationId: 'org-site-agente',
      agentId: 'a1',
    });
  });

  it('com o interruptor DESLIGADO, o canal site nem procura o agente para as regras', async () => {
    orgFindUnique.mockResolvedValue({ id: 'org-site-off', name: 'Cantina', settings: SETTINGS_DA_ORG });

    const res = await chamar({ ...corpoValido, organizationId: 'org-site-off', canal: 'site' });

    expect(res.statusCode).toBe(200);
    expect(agentFindFirst).not.toHaveBeenCalled();
    expect(agentRuleFindMany).not.toHaveBeenCalled();
  });

  it('com o interruptor DESLIGADO, o teste de Qualidade fica byte a byte como hoje', async () => {
    agentRuleFindMany.mockResolvedValue([REGRA]);

    const res = await chamar({ ...corpoValido, canal: 'qualidade' });

    expect(res.statusCode).toBe(200);
    expect(promptDoTurno(res)).not.toContain('# Regras aprovadas pelo dono');
    expect(agentRuleFindMany).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/ai-xray: agendamento e histórico no WhatsApp', () => {
  it('resolve o agendamento e mostra a linha honesta quando não há tipo ativo', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');
    orgFindUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Cantina da Nona',
      // O caso do CMJ: interruptor ligado, zero tipo cadastrado.
      settings: { ...SETTINGS_DA_ORG, scheduling: { enabled: true } },
      plan: 'IZA_PRO',
    });
    appointmentTypeFindMany.mockResolvedValue([]);

    for (const canal of ['whatsapp', 'instagram']) {
      const res = await chamar({ ...corpoValido, canal });
      expect(promptDoTurno(res), canal).toContain('Agendamento: não ofereça agendamento por aqui');
    }
  });

  it('com tipo ativo e direito ao recurso, o prompt lista o que dá para marcar', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');
    orgFindUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Cantina da Nona',
      settings: { ...SETTINGS_DA_ORG, scheduling: { enabled: true }, addons: ['SCHEDULING_AGENT'] },
      plan: 'IZA_PRO',
    });
    appointmentTypeFindMany.mockResolvedValue([{ name: 'Reserva de mesa' }]);

    const res = await chamar(corpoValido);

    expect(promptDoTurno(res)).toContain('Agendamento: disponível para: Reserva de mesa');
  });

  it('o primeiro turno diz que o histórico NÃO está no contexto (A212)', async () => {
    isFlagOn.mockImplementation(async (_o: string, f: string) => f === 'perfilVivo');
    // Contato antigo: o contador do CONTATO já passou de 1, mas o Raio-X
    // começa sem uma linha de histórico no contexto. É o achado A212: a
    // conversa fecha sozinha em 72 h e quem volta abre outra, então o
    // contador do contato e o histórico enviado ao modelo discordam.
    contactFindUnique.mockResolvedValue({ leadStatus: 'QUALIFIED', name: 'Bia', _count: {} });
    messageCount.mockResolvedValue(9);

    const res = await chamar({
      ...corpoValido,
      messages: [
        { role: 'user', content: 'oi de novo' },
        { role: 'assistant', content: 'olá!' },
        { role: 'user', content: 'e o rodízio?' },
      ],
    });

    expect(promptDoTurno(res, 0)).toContain('o que foi conversado antes NÃO está aqui');
    // Terceira mensagem: agora o histórico está no contexto de verdade.
    expect(promptDoTurno(res, 1)).toContain('Primeiro contato? NÃO (já tem histórico');
  });
});

/* ── 8. Hash, partes e motor por turno (C1a) ──────────────────────────── */
/*
 * O Raio-X passa a dizer QUE motor montou o prompt de cada canal, o hash do
 * prompt inteiro e o hash estável do tenant (só os blocos que não mudam com
 * a mensagem, a base nem o relógio). Com o interruptor contextoUnico ligado,
 * o WhatsApp e o site têm de mostrar o MESMO hash estável: é a prova, para o
 * fundador, de que os dois canais atendem pelo mesmo agente.
 */

describe('POST /api/admin/ai-xray: hash, partes e motor por turno', () => {
  const ligar = (ativas: string[]) =>
    isFlagOn.mockImplementation(async (_org: string, flag: string) => ativas.includes(flag));

  it('com tudo desligado, cada turno tem hash e partes, e o motor é o de antes', async () => {
    for (const canal of ['whatsapp', 'site', 'qualidade']) {
      const res = await chamar({ ...corpoValido, canal });
      const turno = res.body.turnos[0];
      expect(turno.motor, canal).toBe('antes');
      expect(turno.hash, canal).toMatch(/^[0-9a-f]{64}$/);
      expect(turno.hash_estavel, canal).toBeNull();
      expect(turno.partes.length, canal).toBeGreaterThan(0);
      expect(turno.partes[0], canal).toMatchObject({ nome: 'Regras base (CORE)' });
    }
  });

  it('com contextoUnico ligado, WhatsApp e site mostram o MESMO hash estável', async () => {
    ligar(['contextoUnico', 'perfilVivo']);

    const wa = await chamar({ ...corpoValido, canal: 'whatsapp' });
    const site = await chamar({ ...corpoValido, canal: 'site' });

    expect(wa.body.turnos[0].motor).toBe('unico');
    expect(site.body.turnos[0].motor).toBe('unico');
    expect(wa.body.turnos[0].hash_estavel).toMatch(/^[0-9a-f]{64}$/);
    expect(site.body.turnos[0].hash_estavel).toBe(wa.body.turnos[0].hash_estavel);
    // O hash inteiro difere de propósito: o site tem a instrução de canal.
    expect(site.body.turnos[0].hash).not.toBe(wa.body.turnos[0].hash);
    expect(site.body.turnos[0].partes.find((p: any) => p.nome === 'instrucao_de_canal').chars).toBeGreaterThan(0);
    expect(wa.body.turnos[0].partes.find((p: any) => p.nome === 'instrucao_de_canal').chars).toBe(0);
  });

  it('com contextoUnico ligado, o site NÃO consulta a base sem ragNoChatDoSite, e consulta com ele', async () => {
    ligar(['contextoUnico']);
    let res = await chamar({ ...corpoValido, canal: 'site' });
    expect(searchWithSources).not.toHaveBeenCalled();
    expect(res.body.turnos[0].fontes).toEqual([]);
    expect(res.body.turnos[0].motor).toBe('unico');
    // O site pelo motor único não passa pelo carregador com cache.
    expect(queryRawUnsafe).not.toHaveBeenCalled();

    vi.clearAllMocks();
    ligar(['contextoUnico', 'ragNoChatDoSite']);
    orgFindUnique.mockResolvedValue({ id: 'org-1', name: 'Cantina da Nona', settings: SETTINGS_DA_ORG });
    agentFindFirst.mockResolvedValue({ id: 'a1', name: 'Antonella', systemPrompt: PROMPT_DO_AGENTE });
    qaFindMany.mockResolvedValue([]);
    searchWithSources.mockResolvedValue({
      context: 'Trecho da base: o rodízio custa R$ 89.',
      sources: [{ source: 'cardapio.pdf', similarity: 0.61, snippet: 'rodízio R$ 89' }],
    });
    res = await chamar({ ...corpoValido, canal: 'site' });
    expect(searchWithSources).toHaveBeenCalledWith('org-1', 'vocês abrem domingo?', 5);
    expect(res.body.turnos[0].fontes).toEqual([{ source: 'cardapio.pdf', similarity: 0.61 }]);
    expect(promptDoTurno(res)).toContain('Trecho da base: o rodízio custa R$ 89.');
  });

  it('com contextoUnico ligado, a Qualidade consulta a base e monta com o contato mock e a data fixa (A036)', async () => {
    ligar(['contextoUnico']);

    const res = await chamar({ ...corpoValido, canal: 'qualidade' });

    expect(searchWithSources).toHaveBeenCalledWith('org-1', 'vocês abrem domingo?', 5);
    const turno = res.body.turnos[0];
    expect(turno.motor).toBe('unico');
    const base = turno.checagens.find((c: any) => c.id === 'base_consultada');
    expect(base.ok).toBe(true);
    const prompt = promptDoTurno(res);
    expect(prompt).toContain('Nome registrado: Rod');
    expect(prompt).toContain('# Agora\n14/09/2026, 12:00:00');
    expect(prompt).toContain('### Links oficiais de Cantina da Nona');
  });

  it('a instrução de canal do site fica DEPOIS do CORE com o motor único (A076)', async () => {
    ligar(['contextoUnico']);

    const res = await chamar({ ...corpoValido, canal: 'site' });

    const prompt = promptDoTurno(res);
    const canal = prompt.indexOf('# CANAL DE COMUNICAÇÃO');
    expect(canal).toBeGreaterThan(0);
    expect(prompt.indexOf(PROMPT_DO_AGENTE)).toBeGreaterThan(canal);
  });
});
