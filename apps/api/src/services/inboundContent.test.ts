import { describe, it, expect } from 'vitest';
import { inboundContentFromMessage } from './inboundContent.js';

describe('inboundContentFromMessage', () => {
  it('texto normal → body', () => {
    expect(inboundContentFromMessage({ type: 'text', text: { body: 'oi' } })).toBe('oi');
  });
  it('botão tocado → title', () => {
    expect(inboundContentFromMessage({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'planos', title: 'Planos' } } })).toBe('Planos');
  });
  it('item de lista → title', () => {
    expect(inboundContentFromMessage({ type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'o3', title: 'Opção 3' } } })).toBe('Opção 3');
  });
  it('legenda de mídia → caption', () => {
    expect(inboundContentFromMessage({ type: 'image', caption: 'foto', image: { id: 'x' } })).toBe('foto');
  });
  it('mídia sem legenda → marcador [type]', () => {
    expect(inboundContentFromMessage({ type: 'image', image: { id: 'x' } })).toBe('[image]');
  });
  it('tipo desconhecido sem texto → [type]', () => {
    expect(inboundContentFromMessage({ type: 'location' })).toBe('[location]');
  });
});
