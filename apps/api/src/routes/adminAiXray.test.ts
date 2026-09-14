/**
 * POST /api/admin/ai-xray — Raio-X do que a IA recebe.
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

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    qAPair: { findMany: (...a: any[]) => qaFindMany(...a) },
    contact: { findUnique: vi.fn().mockResolvedValue(null) },
    message: { count: vi.fn().mockResolvedValue(0) },
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
  usuarioAtual = { userId: 'u1', organizationId: 'org-admin', role: 'SUPERADMIN' };
  orgFindUnique.mockResolvedValue({ id: 'org-1', name: 'Cantina da Nona', settings: SETTINGS_DA_ORG });
  agentFindFirst.mockResolvedValue({ id: 'a1', name: 'Antonella', systemPrompt: PROMPT_DO_AGENTE });
  qaFindMany.mockResolvedValue([{ id: 'q1', question: 'Vocês atendem aos sábados?' }]);
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

describe('POST /api/admin/ai-xray — quem pode entrar', () => {
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

describe('POST /api/admin/ai-xray — validação do corpo', () => {
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

describe('POST /api/admin/ai-xray — não gasta LLM', () => {
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

describe('POST /api/admin/ai-xray — o prompt de cada canal', () => {
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

  it('o Instagram roda com as configurações vazias, então a saudação do cliente some (achado A057)', async () => {
    const noWhatsapp = await chamar({ ...corpoValido, canal: 'whatsapp' });
    const noInstagram = await chamar({ ...corpoValido, canal: 'instagram' });

    const saudacaoWhatsapp = noWhatsapp.body.turnos[0].checagens.find(
      (c: any) => c.id === 'saudacao_no_primeiro_contato',
    );
    const saudacaoInstagram = noInstagram.body.turnos[0].checagens.find(
      (c: any) => c.id === 'saudacao_no_primeiro_contato',
    );

    expect(saudacaoWhatsapp.ok).toBe(true);
    expect(saudacaoInstagram.ok).toBe(false);
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

