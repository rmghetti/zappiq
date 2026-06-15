import { describe, it, expect } from 'vitest';
import { toAnthropicMessages, contentToString } from './LLMRouter.js';

describe('content blocks', () => {
  it('string content passa igual', () => {
    expect(toAnthropicMessages([{ role: 'user', content: 'oi' }] as any)).toEqual([{ role: 'user', content: 'oi' }]);
  });
  it('array de blocks (tool_use/tool_result) mapeia nativo', () => {
    const msgs = [
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'wh', input: { a: 1 } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"ok":true}' }] },
    ];
    const r = toAnthropicMessages(msgs as any);
    expect(r[0].content[0]).toMatchObject({ type: 'tool_use', id: 't1', name: 'wh' });
    expect(r[1].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1', content: '{"ok":true}' });
  });
  it('contentToString junta texto, ignora tool blocks', () => {
    expect(contentToString('x')).toBe('x');
    expect(contentToString([{ type: 'text', text: 'a' }, { type: 'tool_use', id: 'i', name: 'n', input: {} }] as any)).toBe('a');
  });
  it('filtra mensagens system', () => {
    expect(toAnthropicMessages([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }] as any)).toEqual([{ role: 'user', content: 'u' }]);
  });
});
