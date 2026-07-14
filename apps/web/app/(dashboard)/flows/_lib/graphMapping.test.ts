import { describe, it, expect } from 'vitest';
import {
  apiNodesToCanvasNodes,
  canvasNodesToApiNodes,
  unsupportedNodeTypes,
  type MaestroApiNode,
} from './graphMapping';

/* ══════════════════════════════════════════════════════════════════════════
 * O contrato que este arquivo existe para travar:
 *
 *   salvar NUNCA pode apagar o `type` de um nó que o editor não sabe desenhar.
 *
 * O bug que motivou o teste: apiNodesToCanvas() coagia todo tipo fora do
 * NODE_META para 'message', e o save gravava esse tipo coagido por cima do
 * original. Abrir um fluxo e clicar em Salvar destruía o tipo, em silêncio e
 * para sempre. Hoje o motor e a rota aceitam type livre (flowEngine tipa
 * `type: string`; a rota valida z.array(z.any())), então quem introduzir um
 * tipo novo no motor sem atualizar o NODE_META do editor cai exatamente aqui.
 * ══════════════════════════════════════════════════════════════════════════ */

// Vocabulário canônico do editor (NODE_META). Duplicado aqui de propósito: o
// NODE_META carrega ícone (React) e não pode ser importado num teste puro. O
// alinhamento NODE_META ⇄ motor já é travado por
// apps/api/src/agents/flowTemplateContract.test.ts.
const SUPORTADOS = new Set([
  'start', 'message', 'condition', 'ask', 'ai', 'tag',
  'update_lead', 'transfer', 'wait', 'schedule', 'goto_flow',
]);
const isSupported = (t: string) => SUPORTADOS.has(t);

const opts = {
  labelFor: (t: string) => (isSupported(t) ? `rótulo de ${t}` : t),
  genId: () => 'id_gerado',
};

/** O round-trip completo do editor: abrir o fluxo e salvar sem tocar em nada. */
const abrirESalvar = (apiNodes: MaestroApiNode[]) =>
  canvasNodesToApiNodes(apiNodesToCanvasNodes(apiNodes, opts));

describe('round-trip API ⇄ canvas', () => {
  it('abrir e salvar preserva o tipo de um nó que o editor não conhece', () => {
    const original: MaestroApiNode[] = [
      { id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: {} },
      {
        id: 'n2',
        // Tipo que o motor ganhou numa versão futura e o NODE_META não tem.
        type: 'send_invoice',
        position: { x: 10, y: 20 },
        data: { amount: 99, currency: 'BRL' },
      },
    ];

    const salvo = abrirESalvar(original);

    expect(salvo[1].type).toBe('send_invoice');
    expect(salvo[1].type).not.toBe('message');
  });

  it('preserva o data do nó desconhecido intacto (nenhum campo perdido ou inventado)', () => {
    const salvo = abrirESalvar([
      { id: 'n1', type: 'send_invoice', position: { x: 0, y: 0 }, data: { amount: 99, nested: { a: [1, 2] } } },
    ]);

    expect(salvo[0].data).toMatchObject({ amount: 99, nested: { a: [1, 2] } });
    expect(salvo[0].position).toEqual({ x: 0, y: 0 });
  });

  it('salvar duas vezes seguidas não degrada o tipo (idempotente)', () => {
    const original: MaestroApiNode[] = [
      { id: 'n1', type: 'send_invoice', position: { x: 0, y: 0 }, data: {} },
    ];

    const umaVez = abrirESalvar(original);
    const duasVezes = abrirESalvar(umaVez);

    expect(duasVezes[0].type).toBe('send_invoice');
    expect(duasVezes).toEqual(umaVez);
  });

  it('preserva todo tipo suportado do vocabulário canônico', () => {
    const nodes: MaestroApiNode[] = [...SUPORTADOS].map((t, i) => ({
      id: `n${i}`, type: t, position: { x: 0, y: i }, data: {},
    }));

    expect(abrirESalvar(nodes).map((n) => n.type)).toEqual([...SUPORTADOS]);
  });

  it('nó SEM type vira message: é o único caso em que o editor escolhe o tipo', () => {
    // Legítimo porque não havia informação a perder.
    const salvo = abrirESalvar([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }]);
    expect(salvo[0].type).toBe('message');
  });

  it('rotula o nó desconhecido com o tipo cru quando não há label', () => {
    const canvas = apiNodesToCanvasNodes(
      [{ id: 'n1', type: 'send_invoice', position: { x: 0, y: 0 }, data: {} }],
      opts,
    );
    expect(canvas[0].data.label).toBe('send_invoice');
  });

  it('respeita o label que já existe no nó desconhecido', () => {
    const salvo = abrirESalvar([
      { id: 'n1', type: 'send_invoice', position: { x: 0, y: 0 }, data: { label: 'Cobrança' } },
    ]);
    expect(salvo[0].label).toBe('Cobrança');
  });

  it('gera id e posição para nó que chega sem eles, sem tocar no tipo', () => {
    const salvo = abrirESalvar([{ type: 'send_invoice' } as MaestroApiNode]);
    expect(salvo[0].id).toBe('id_gerado');
    expect(salvo[0].position).toEqual({ x: 120, y: 60 });
    expect(salvo[0].type).toBe('send_invoice');
  });

  it('aceita lista vazia e nula', () => {
    expect(apiNodesToCanvasNodes([], opts)).toEqual([]);
    expect(apiNodesToCanvasNodes(null, opts)).toEqual([]);
  });
});

describe('unsupportedNodeTypes', () => {
  it('acha os tipos que o editor não desenha, ordenados e sem repetir', () => {
    const tipos = unsupportedNodeTypes(
      [
        { type: 'message' },
        { type: 'send_invoice' },
        { type: 'send_invoice' },
        { type: 'call_webhook' },
        { type: 'ai' },
      ],
      isSupported,
    );
    expect(tipos).toEqual(['call_webhook', 'send_invoice']);
  });

  it('devolve vazio quando todo tipo é suportado', () => {
    expect(unsupportedNodeTypes([{ type: 'message' }, { type: 'ai' }], isSupported)).toEqual([]);
  });

  it('a chave de memo é estável entre reordenações do grafo', () => {
    // Por que importa: nodeTypes do React Flow é memoizado nessa chave. Se ela
    // oscilasse a cada mudança em `nodes`, todo nó do canvas remontaria a cada
    // arrastar.
    const a = unsupportedNodeTypes([{ type: 'b_type' }, { type: 'a_type' }], isSupported).join('|');
    const b = unsupportedNodeTypes([{ type: 'a_type' }, { type: 'b_type' }], isSupported).join('|');
    expect(a).toBe(b);
  });

  it('ignora nó sem type', () => {
    expect(unsupportedNodeTypes([{}, { type: undefined }], isSupported)).toEqual([]);
  });
});
