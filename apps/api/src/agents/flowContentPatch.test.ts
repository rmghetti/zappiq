import { describe, it, expect } from 'vitest';
import { extractEditableContent, applyContentPatch, diffContent } from './flowContentPatch.js';

const NODES = [
  { id: 's', type: 'start' },
  { id: 'm1', type: 'message', data: { text: 'Olá!' } },
  { id: 'c', type: 'condition' },
  { id: 'm2', type: 'message', data: { text: 'Até logo' } },
  { id: 't1', type: 'tag', data: { tag: 'lead-novo' } },
  { id: 'a1', type: 'ai', data: { prompt: 'Tire dúvidas', model: 'sonnet' } },
];

describe('extractEditableContent', () => {
  it('extrai TODOS os nós de conteúdo (não só o primeiro de cada tipo)', () => {
    expect(extractEditableContent(NODES as any)).toEqual([
      { nodeId: 'm1', field: 'text', value: 'Olá!' },
      { nodeId: 'm2', field: 'text', value: 'Até logo' },
      { nodeId: 't1', field: 'tag', value: 'lead-novo' },
      { nodeId: 'a1', field: 'prompt', value: 'Tire dúvidas' },
    ]);
  });
});

describe('applyContentPatch', () => {
  it('aplica só os campos do patch, preservando estrutura e demais dados', () => {
    const out = applyContentPatch(NODES as any, [
      { nodeId: 'm1', field: 'text', value: 'Oi! Bem-vindo à Clínica Sorriso 😬' },
      { nodeId: 'a1', field: 'prompt', value: 'Cite horários reais: seg-sex 8h-18h' },
    ]);
    expect(out.find((n: any) => n.id === 'm1').data.text).toBe('Oi! Bem-vindo à Clínica Sorriso 😬');
    expect(out.find((n: any) => n.id === 'a1').data).toEqual({ prompt: 'Cite horários reais: seg-sex 8h-18h', model: 'sonnet' });
    expect(out.find((n: any) => n.id === 'm2').data.text).toBe('Até logo');
    expect(out.map((n: any) => n.id)).toEqual(['s', 'm1', 'c', 'm2', 't1', 'a1']);
  });
  it('ignora patch para nó inexistente (estrutura travada)', () => {
    const out = applyContentPatch(NODES as any, [{ nodeId: 'zz', field: 'text', value: 'hack' }]);
    expect(out).toEqual(NODES);
  });
});

describe('diffContent', () => {
  it('lista apenas campos que mudaram', () => {
    const diff = diffContent(NODES as any, [
      { nodeId: 'm1', field: 'text', value: 'NOVO' },
      { nodeId: 'm2', field: 'text', value: 'Até logo' },
    ]);
    expect(diff).toEqual([{ nodeId: 'm1', field: 'text', before: 'Olá!', after: 'NOVO' }]);
  });
});
