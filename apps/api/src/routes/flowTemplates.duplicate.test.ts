/**
 * Ponta a ponta do "Usar template": linha LEGADA no banco → bootstrap regrava →
 * cliente duplica pela rota HTTP real → o motor executa o fluxo que ele recebeu.
 *
 * Este e o teste que teria pego o bug original: o template era copiado verbatim
 * pro fluxo do cliente, entao qualquer divergencia de vocabulario entre o seed e
 * o flowEngine entregava um fluxo decorativo (preview bonito, execucao vazia).
 *
 * Nao ha Postgres no CI deste app (o padrao do repo e Express nu + prisma
 * mockado), entao o fake abaixo imita o jsonb no que importa pra este contrato:
 * ele serializa o JSON e REORDENA as chaves na volta, que e o comportamento do
 * Postgres capaz de enganar uma comparacao ingenua no upsert.
 */
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { FLOW_TEMPLATES_DATA } from '../../../../packages/database/src/flowTemplatesData.js';
import { resolveFlowStep, type FlowGraph } from '../agents/flowEngine.js';

const ORG = 'org-do-teste';

/** Round-trip de jsonb: perde a ordem original das chaves. */
function comoJsonb<T>(v: T): T {
  const round = JSON.parse(JSON.stringify(v));
  const embaralha = (x: any): any => {
    if (Array.isArray(x)) return x.map(embaralha);
    if (x && typeof x === 'object') {
      const out: any = {};
      for (const k of Object.keys(x).sort().reverse()) out[k] = embaralha(x[k]);
      return out;
    }
    return x;
  };
  return embaralha(round);
}

// ── Fake do flow_templates + flows, em memória ───────────────────────────────
let templates: any[] = [];
let flows: any[] = [];
let seq = 0;

const prismaFake = {
  flowTemplate: {
    findMany: vi.fn(async (args?: any) => {
      let rows = templates.map((t) => comoJsonb(t));
      if (args?.where?.isActive !== undefined) rows = rows.filter((r) => r.isActive === args.where.isActive);
      return rows;
    }),
    findUnique: vi.fn(async ({ where }: any) => {
      const row = templates.find((t) => t.id === where.id);
      return row ? comoJsonb(row) : null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const row = { id: `tpl_${++seq}`, ...JSON.parse(JSON.stringify(data)) };
      templates.push(row);
      return comoJsonb(row);
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const i = templates.findIndex((t) => t.id === where.id);
      templates[i] = { ...templates[i], ...JSON.parse(JSON.stringify(data)) };
      return comoJsonb(templates[i]);
    }),
  },
  flow: {
    create: vi.fn(async ({ data }: any) => {
      const row = { id: `flow_${++seq}`, ...JSON.parse(JSON.stringify(data)) };
      flows.push(row);
      return comoJsonb(row);
    }),
  },
};

// Só o prisma é fake. A regra de upsert e os dados são os REAIS, importados
// direto do source do pacote (o index.ts instancia PrismaClient no import).
vi.mock('@zappiq/database', async () => {
  const data: any = await import('../../../../packages/database/src/flowTemplatesData.js');
  const upsert: any = await import('../../../../packages/database/src/flowTemplatesUpsert.js');
  return {
    prisma: prismaFake,
    FLOW_TEMPLATES_DATA: data.FLOW_TEMPLATES_DATA,
    upsertFlowTemplates: upsert.upsertFlowTemplates,
    formatUpsertResult: upsert.formatUpsertResult,
  };
});

const logSpy = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('../utils/logger', () => ({ logger: logSpy }));
vi.mock('../utils/logger.js', () => ({ logger: logSpy }));

/** O template do Dentista EXATAMENTE como estava semeado em produção (dialeto antigo). */
const LINHA_LEGADA = {
  id: 'tpl_legado',
  name: 'Dentista — Boas-vindas + Qualificacao',
  description: 'Recebe lead novo, apresenta a clinica, qualifica intencao e direciona.',
  vertical: 'DENTISTA',
  category: 'BOAS_VINDAS_QUALIFICACAO',
  triggerType: 'FIRST_CONTACT',
  triggerConfig: null,
  order: 1,
  isActive: true,
  nodes: [
    { id: '1', type: 'input', position: { x: 100, y: 100 }, data: { label: 'Lead chegou' } },
    { id: '2', type: 'message', position: { x: 100, y: 200 }, data: { label: 'Saudacao', message: 'Oi! Sou o assistente da Clinica X. Como posso ajudar?' } },
    { id: '3', type: 'ai_node', position: { x: 100, y: 320 }, data: { label: 'IA qualifica', intent: 'identificar tipo de demanda' } },
    { id: '6', type: 'action', position: { x: 100, y: 740 }, data: { label: 'Marcar lead score', action: 'update_lead_score', score: 60 } },
    { id: '7', type: 'human_handoff', position: { x: 100, y: 880 }, data: { label: 'Passa pra recepcao' } },
  ],
  edges: [
    { id: 'e-1-2', source: '1', target: '2' },
    { id: 'e-2-3', source: '2', target: '3' },
    { id: 'e-3-6', source: '3', target: '6' },
    { id: 'e-6-7', source: '6', target: '7' },
  ],
};

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const { default: router } = await import('./flowTemplates.js');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.organizationId = ORG; next(); });
  app.use('/api/flows/templates', router);
  await new Promise<void>((r) => { server = app.listen(0, r); });
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
});

afterAll(() => { server?.close(); });

beforeEach(() => {
  templates = [];
  flows = [];
  seq = 0;
  vi.clearAllMocks();
});

const graphOf = (f: any): FlowGraph => ({ nodes: f.nodes, edges: f.edges });

describe('bootstrap: a linha legada de produção é regravada no vocabulário do motor', () => {
  it('o fluxo legado é mudo ANTES do bootstrap (o bug original, reproduzido)', () => {
    const r = resolveFlowStep(graphOf(LINHA_LEGADA), { cursor: null, vars: {} }, 'oi');
    expect(r.effects).toEqual([]); // não fala nada
    expect(r.next).toBe('end');    // e morre no primeiro nó
  });

  it('o bootstrap converte a linha legada em canônica (sem migration)', async () => {
    templates = [structuredClone(LINHA_LEGADA)];
    const { bootstrapFlowTemplates } = await import('../bootstrap/seedFlowTemplates.js');
    await bootstrapFlowTemplates();

    const row = templates.find((t) => t.vertical === 'DENTISTA' && t.category === 'BOAS_VINDAS_QUALIFICACAO');
    expect(row.id).toBe('tpl_legado'); // atualizou a MESMA linha, não criou outra
    expect(row.nodes.some((n: any) => n.type === 'start')).toBe(true);
    expect(row.nodes.every((n: any) => !['input', 'ai_node', 'action', 'human_handoff'].includes(n.type))).toBe(true);
    expect(row.nodes.every((n: any) => n.data.message === undefined)).toBe(true);
    expect(templates).toHaveLength(FLOW_TEMPLATES_DATA.length); // 47 inseridos + 1 atualizado
    expect(logSpy.error).not.toHaveBeenCalled();
  });

  it('é idempotente: o 2º boot não reescreve nada, mesmo com o jsonb reordenando chaves', async () => {
    const { bootstrapFlowTemplates } = await import('../bootstrap/seedFlowTemplates.js');
    await bootstrapFlowTemplates();
    vi.clearAllMocks();
    await bootstrapFlowTemplates();

    expect(prismaFake.flowTemplate.create).not.toHaveBeenCalled();
    expect(prismaFake.flowTemplate.update).not.toHaveBeenCalled();
    expect(logSpy.info).toHaveBeenCalledWith(expect.stringContaining('0 criados, 0 atualizados'));
  });
});

describe('POST /:id/duplicate: o cliente recebe um fluxo que funciona', () => {
  beforeEach(async () => {
    templates = [structuredClone(LINHA_LEGADA)];
    const { bootstrapFlowTemplates } = await import('../bootstrap/seedFlowTemplates.js');
    await bootstrapFlowTemplates();
    vi.clearAllMocks();
  });

  it('duplica o template pro org do cliente como rascunho', async () => {
    const tpl = templates.find((t) => t.category === 'BOAS_VINDAS_QUALIFICACAO' && t.vertical === 'DENTISTA');
    const res = await fetch(`${baseUrl}/api/flows/templates/${tpl.id}/duplicate`, { method: 'POST' });
    expect(res.status).toBe(200);

    const criado = flows[0];
    expect(criado.organizationId).toBe(ORG);
    expect(criado.isActive).toBe(false); // rascunho: cliente ativa quando quiser
    expect(criado.name).toContain('Dentista');
  });

  it('os nós chegam com TIPO e TEXTO certos (não viram "Mensagem" vazia)', async () => {
    const tpl = templates.find((t) => t.category === 'BOAS_VINDAS_QUALIFICACAO' && t.vertical === 'DENTISTA');
    await fetch(`${baseUrl}/api/flows/templates/${tpl.id}/duplicate`, { method: 'POST' });
    const criado = flows[0];

    // Todo tipo é do vocabulário do motor E do NODE_META do editor.
    const VOCAB = ['start', 'message', 'condition', 'ask', 'ai', 'tag', 'update_lead', 'transfer', 'wait', 'schedule', 'goto_flow'];
    for (const node of criado.nodes) expect(VOCAB).toContain(node.type);

    // Todo nó message tem texto no campo que o motor lê.
    for (const node of criado.nodes.filter((n: any) => n.type === 'message')) {
      expect(String(node.data.text ?? '') + JSON.stringify(node.data.interactive ?? '')).not.toBe('""');
    }
    // O editor guarda o label no topo E em data.label — o template faz igual.
    for (const node of criado.nodes) expect(node.label).toBe(node.data.label);
  });

  it('o motor EXECUTA o fluxo duplicado: fala, ramifica e chama o humano', async () => {
    const tpl = templates.find((t) => t.category === 'BOAS_VINDAS_QUALIFICACAO' && t.vertical === 'DENTISTA');
    await fetch(`${baseUrl}/api/flows/templates/${tpl.id}/duplicate`, { method: 'POST' });
    const g = graphOf(flows[0]);

    // Turno 1: o fluxo se apresenta e espera a resposta.
    const t1 = resolveFlowStep(g, { cursor: null, vars: {} }, 'oi');
    expect(t1.effects.length).toBeGreaterThan(0);
    expect(t1.next).toBe('await_input');

    // Turno 2: a pessoa diz que está com dor → ramo de urgência → lead score → humano.
    const t2 = resolveFlowStep(g, { cursor: t1.state.cursor!, vars: {} }, 'Estou com dor');
    expect(JSON.stringify(t2.effects)).toContain('Sinto muito pela dor');
    expect(t2.effects).toContainEqual({ kind: 'update_lead', field: 'leadScore', value: 60 });
    expect(t2.effects).toContainEqual({ kind: 'handoff' });
  });

  it('todos os 48 templates duplicados falam no primeiro turno', async () => {
    const mudos: string[] = [];
    for (const tpl of [...templates]) {
      const res = await fetch(`${baseUrl}/api/flows/templates/${tpl.id}/duplicate`, { method: 'POST' });
      expect(res.status).toBe(200);
      const criado = flows[flows.length - 1];
      const r = resolveFlowStep(graphOf(criado), { cursor: null, vars: {} }, 'oi');
      const falou = r.effects.some((e) => e.kind === 'send_text' || e.kind === 'send_interactive' || e.kind === 'send_media');
      if (!falou) mudos.push(tpl.name);
    }
    expect(mudos).toEqual([]);
    expect(flows).toHaveLength(48);
  });
});
