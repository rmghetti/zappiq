import { describe, it, expect } from 'vitest';
import { aggregate } from './flowAnalytics.js';

describe('aggregate', () => {
  it('soma entries/ends por nó e calcula totalEntries', () => {
    const rows = [
      { nodeId: 'm', nodeType: 'message', nodeLabel: 'Msg', entries: 5, ends: 0 },
      { nodeId: 'm', nodeType: 'message', nodeLabel: 'Msg', entries: 3, ends: 1 },
      { nodeId: 'a', nodeType: 'ai', nodeLabel: 'IA', entries: 4, ends: 2 },
    ];
    const r = aggregate(rows as any);
    const m = r.byNode.find((n) => n.nodeId === 'm');
    expect(m!.entries).toBe(8);
    expect(m!.ends).toBe(1);
    expect(r.totalEntries).toBe(12);
  });

  it('vazio → byNode [] e totalEntries 0', () => {
    expect(aggregate([])).toEqual({ totalEntries: 0, byNode: [] });
  });
});
