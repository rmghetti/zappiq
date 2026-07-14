/**
 * Contrato dos templates Maestro × motor/editor.
 *
 * Os 48 templates de FLOW_TEMPLATES_DATA são copiados verbatim pro fluxo do
 * cliente em POST /api/flows/templates/:id/duplicate. Se o vocabulário de nó
 * ou o campo de texto divergirem do que o flowEngine executa, o cliente recebe
 * um fluxo decorativo: preview bonito, execução vazia.
 *
 * Estes testes travam o contrato nos dois sentidos:
 *   1. todo tipo de nó existe no motor;
 *   2. todo nó message entrega texto de verdade quando o motor caminha o grafo.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FLOW_TEMPLATES_DATA } from '../../../../packages/database/src/flowTemplatesData.js';
import { resolveFlowStep, type FlowGraph } from './flowEngine.js';
import { validateGraph } from './flowGraphValidation.js';

/**
 * Tipos que o flowEngine.resolveFlowStep trata no switch (o resto cai no default
 * → encerra o fluxo em silêncio). É a MESMA lista do NODE_META do editor
 * (apps/web/app/(dashboard)/flows/page.tsx) — os três têm que andar juntos.
 */
const ENGINE_NODE_TYPES = new Set([
  'start', 'message', 'condition', 'ask', 'ai', 'tag',
  'update_lead', 'transfer', 'wait', 'schedule', 'goto_flow',
]);

const graphOf = (t: { nodes: any[]; edges: any[] }): FlowGraph => ({
  nodes: t.nodes as any,
  edges: t.edges as any,
});

describe('contrato: templates Maestro × flowEngine', () => {
  it('todo nó de todo template usa um tipo que o motor executa', () => {
    const offenders: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      for (const node of t.nodes) {
        if (!ENGINE_NODE_TYPES.has(node.type)) {
          offenders.push(`${t.name} → nó ${node.id} tipo "${node.type}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('todo template tem exatamente um nó start (o motor procura type==="start")', () => {
    const offenders: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      const starts = t.nodes.filter((n: any) => n.type === 'start');
      if (starts.length !== 1) offenders.push(`${t.name} → ${starts.length} nós start`);
    }
    expect(offenders).toEqual([]);
  });

  it('caminhar o grafo emite pelo menos um texto (não é fluxo decorativo)', () => {
    const silent: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      const r = resolveFlowStep(graphOf(t), { cursor: null, vars: {} }, 'oi');
      const spoke = r.effects.some(
        (e) => (e.kind === 'send_text' && e.text.trim() !== '') || e.kind === 'send_interactive' || e.kind === 'send_media',
      );
      if (!spoke) silent.push(`${t.name} → next=${r.next}, efeitos=${JSON.stringify(r.effects)}`);
    }
    expect(silent).toEqual([]);
  });

  it('todo nó message carrega texto no campo que o motor lê (data.text)', () => {
    const offenders: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      for (const node of t.nodes as any[]) {
        if (node.type !== 'message') continue;
        const hasText = typeof node.data?.text === 'string' && node.data.text.trim() !== '';
        const hasMedia = !!node.data?.media?.url;
        const hasInteractive = !!node.data?.interactive?.options?.length;
        if (!hasText && !hasMedia && !hasInteractive) {
          offenders.push(`${t.name} → nó ${node.id} ("${node.data?.label}") sem data.text`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('nenhum nó carrega campo do vocabulário antigo (data.message/intent/action)', () => {
    const offenders: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      for (const node of t.nodes as any[]) {
        for (const legado of ['message', 'intent', 'action']) {
          if (node.data?.[legado] !== undefined) offenders.push(`${t.name} → nó ${node.id} tem data.${legado}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('todo nó ai e ask carrega a instrução no campo que o motor lê', () => {
    const offenders: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      for (const node of t.nodes as any[]) {
        if (node.type === 'ai' && !String(node.data?.prompt ?? '').trim()) {
          offenders.push(`${t.name} → nó ${node.id} (ai) sem data.prompt`);
        }
        if (node.type === 'ask') {
          if (!String(node.data?.question ?? '').trim()) offenders.push(`${t.name} → nó ${node.id} (ask) sem data.question`);
          if (!String(node.data?.varName ?? '').trim()) offenders.push(`${t.name} → nó ${node.id} (ask) sem data.varName`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('interpolação usa {{chave.dupla}} — chave simples nunca é substituída', () => {
    // O renderTemplate só troca {{x}}. Um {x} solto vaza cru pro cliente.
    const offenders: string[] = [];
    const chaveSimples = /(^|[^{])\{[a-zA-Z_][a-zA-Z0-9_]*\}/;
    for (const t of FLOW_TEMPLATES_DATA) {
      for (const node of t.nodes as any[]) {
        for (const campo of ['text', 'question', 'prompt']) {
          const v = node.data?.[campo];
          if (typeof v === 'string' && chaveSimples.test(v)) {
            offenders.push(`${t.name} → nó ${node.id} .${campo}: ${v}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('todo template passa no validateGraph do backend (mesmas regras do editor)', () => {
    const offenders: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      const { errors } = validateGraph(t.nodes, t.edges);
      if (errors.length) offenders.push(`${t.name} → ${errors.join(' | ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('todo {{token}} em texto ao cliente tem fallback (senão vira buraco na mensagem)', () => {
    // renderTemplate troca token ausente por '' quando não há fallback: sem isso,
    // "Que fofo, {{vars.nome_pet}}!" vira "Que fofo, !" no WhatsApp do cliente.
    const TOKEN = /\{\{\s*([a-zA-Z0-9_$.]+)\s*(?:\|\s*"([^"]*)"\s*)?\}\}/g;
    const offenders: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      for (const node of t.nodes as any[]) {
        for (const campo of ['text', 'question']) {
          const v = node.data?.[campo];
          if (typeof v !== 'string') continue;
          for (const m of v.matchAll(TOKEN)) {
            if (m[2] === undefined) offenders.push(`${t.name} → nó ${node.id} .${campo}: {{${m[1]}}} sem fallback`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('o NODE_META do editor conhece todo tipo que o motor executa', () => {
    // O bug original nasceu de TRÊS vocabulários divergindo (templates, motor,
    // editor). Os dois primeiros estão travados pelos testes acima. Este lê o
    // NODE_META do editor direto da fonte: se alguém mexer lá sem alinhar aqui,
    // este teste quebra antes de o cliente receber nó coagido pra "Mensagem".
    const editor = fileURLToPath(new URL('../../../web/app/(dashboard)/flows/page.tsx', import.meta.url));
    const src = readFileSync(editor, 'utf8');
    const bloco = src.match(/const NODE_META:[^=]*=\s*\{([\s\S]*?)\n\};/);
    expect(bloco, `NODE_META não encontrado em ${editor} — o teste precisa ser atualizado`).toBeTruthy();

    const chaves = [...bloco![1].matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map((m) => m[1]);
    expect(chaves.length, 'regex de NODE_META não casou nenhuma chave').toBeGreaterThan(5);
    expect(new Set(chaves)).toEqual(ENGINE_NODE_TYPES);
  });

  it('todo condition ramifica de verdade: tem ramo padrão e nenhuma aresta órfã', () => {
    const offenders: string[] = [];
    for (const t of FLOW_TEMPLATES_DATA) {
      const ids = new Set(t.nodes.map((n: any) => n.id));
      for (const edge of t.edges as any[]) {
        if (!ids.has(edge.source)) offenders.push(`${t.name} → aresta ${edge.id} sai de nó inexistente`);
        if (!ids.has(edge.target)) offenders.push(`${t.name} → aresta ${edge.id} aponta pra nó inexistente`);
      }
      for (const node of t.nodes as any[]) {
        if (node.type !== 'condition') continue;
        const out = (t.edges as any[]).filter((e) => e.source === node.id);
        if (out.length < 2) offenders.push(`${t.name} → condition ${node.id} com ${out.length} saída(s)`);
        if (!out.some((e) => e.data?.when?.match === 'else')) {
          offenders.push(`${t.name} → condition ${node.id} sem ramo padrão (else)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('simulação de conversa (o fluxo que o cliente recebe funciona)', () => {
  const dentista = FLOW_TEMPLATES_DATA.find((t) => t.name === 'Dentista: Boas-vindas + Qualificação')!;

  it('turno 1: manda a saudação com botões e para esperando a resposta', () => {
    const r = resolveFlowStep(graphOf(dentista), { cursor: null, vars: {} }, 'oi');
    expect(r.effects[0]).toMatchObject({ kind: 'send_interactive', type: 'button' });
    expect(r.next).toBe('await_input');
    expect(r.state.cursor).toBe('3'); // parou no condition
  });

  it('turno 2 (toca "Estou com dor"): entra no ramo de urgência, pontua e passa pro humano', () => {
    const r = resolveFlowStep(graphOf(dentista), { cursor: '3', vars: {} }, 'Estou com dor');
    expect(r.effects).toContainEqual(
      expect.objectContaining({ kind: 'send_text', text: expect.stringContaining('Sinto muito pela dor') }),
    );
    expect(r.effects).toContainEqual({ kind: 'update_lead', field: 'leadScore', value: 60 });
    expect(r.effects).toContainEqual({ kind: 'handoff' });
  });

  it('turno 2 (resposta fora dos botões): cai no ramo padrão e entrega pra IA', () => {
    const r = resolveFlowStep(graphOf(dentista), { cursor: '3', vars: {} }, 'quero saber sobre clareamento');
    expect(r.next).toBe('ai');
    expect(r.aiPrompt).toContain('outro assunto');
  });

  it('interpola {{system.businessName}} com o nome do negócio do tenant', () => {
    const r = resolveFlowStep(graphOf(dentista), { cursor: null, vars: {} }, 'oi', {
      ctx: {
        contact: { name: null, tags: [], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {} },
        now: null,
        businessHours: null,
        system: { businessName: 'Clínica Sorriso' },
      },
    });
    expect(JSON.stringify(r.effects)).toContain('Clínica Sorriso');
  });

  it('NPS: nota 10 vai pro promotor, nota 6 vai pro detrator e chama humano', () => {
    const nps = FLOW_TEMPLATES_DATA.find((t) => t.name === 'Dentista: NPS pós-consulta')!;
    const promotor = resolveFlowStep(graphOf(nps), { cursor: '3', vars: {} }, '10');
    expect(JSON.stringify(promotor.effects)).toContain('Google');

    const detrator = resolveFlowStep(graphOf(nps), { cursor: '3', vars: {} }, '6');
    expect(detrator.effects).toContainEqual({ kind: 'handoff' });
  });
});
