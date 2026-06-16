import { describe, it, expect } from 'vitest';
import { parseWebhookEvent } from './whatsappService.js';

const evt = (message: any) => ({
  entry: [{ changes: [{ value: { metadata: { phone_number_id: 'p1' }, contacts: [{ profile: { name: 'Ana' } }], messages: [message] } }] }],
});

describe('parseWebhookEvent — interactive', () => {
  it('button_reply: text recebe o title e expõe buttonId', () => {
    const r = parseWebhookEvent(evt({ from: '55', id: 'm1', type: 'interactive',
      interactive: { type: 'button_reply', button_reply: { id: 'planos', title: 'Planos' } } }));
    expect(r?.text).toBe('Planos');
    expect((r as any)?.buttonId).toBe('planos');
  });

  it('list_reply: text recebe o title e expõe listId', () => {
    const r = parseWebhookEvent(evt({ from: '55', id: 'm2', type: 'interactive',
      interactive: { type: 'list_reply', list_reply: { id: 'opt3', title: 'Opção 3' } } }));
    expect(r?.text).toBe('Opção 3');
    expect((r as any)?.listId).toBe('opt3');
  });

  it('texto normal continua intacto', () => {
    const r = parseWebhookEvent(evt({ from: '55', id: 'm3', type: 'text', text: { body: 'oi' } }));
    expect(r?.text).toBe('oi');
  });
});
