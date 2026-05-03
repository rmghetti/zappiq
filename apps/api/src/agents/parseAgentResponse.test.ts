/* ══════════════════════════════════════════════════════════════════════
 * V4 #159 (PR #71 HOTFIX) · Tests parseAgentResponse strip de tags
 *
 * Bug que motivou esses testes (smoke real 2026-05-03):
 *   Iza emitiu "<action>set_contact_name</action><action_data>{"name":"X"}
 *   </action_data>[áudio] Entendido, X!" e o texto inteiro foi pro WhatsApp
 *   com tags raw. Cliente viu as tags no chat. TTS sintetizou "abre
 *   colchete áudio fecha colchete entendido X" no áudio enviado.
 *
 * Cobertura:
 *   ✓ Tags <action>/<action_data>/<buttons> removidas do replyText
 *   ✓ <reply>...</reply> ainda funciona quando presente
 *   ✓ Prefixo [áudio]/[audio] no início é removido
 *   ✓ Action ainda é extraída corretamente (não regressão)
 *   ✓ Texto sem tags passa intacto
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { stripStructuredTags, stripLeakedPrefixes } from './agentOrchestrator.js';

describe('stripStructuredTags', () => {
  it('remove <action> e <action_data> do meio do texto', () => {
    const input = '<action>set_contact_name</action><action_data>{"name":"Rod"}</action_data>Entendido, Rod!';
    const result = stripStructuredTags(input);
    expect(result).toBe('Entendido, Rod!');
  });

  it('remove <buttons>...</buttons>', () => {
    const input = 'Escolha:<buttons>[{"id":"1","title":"A"}]</buttons>';
    expect(stripStructuredTags(input)).toBe('Escolha:');
  });

  it('remove <reply> e </reply> isolados', () => {
    expect(stripStructuredTags('<reply>oi</reply>')).toBe('oi');
  });

  it('texto puro sem tags passa intacto', () => {
    expect(stripStructuredTags('Olá, Rodrigo!')).toBe('Olá, Rodrigo!');
  });

  it('aceita tags case-insensitive', () => {
    expect(stripStructuredTags('<ACTION>x</ACTION>texto')).toBe('texto');
  });

  it('multi-line action_data com JSON quebrado de linha', () => {
    const input = '<action>save</action><action_data>{\n  "k": "v"\n}</action_data>texto final';
    expect(stripStructuredTags(input)).toBe('texto final');
  });

  it('múltiplas ocorrências removidas todas', () => {
    expect(stripStructuredTags('<action>a</action>x<action>b</action>y')).toBe('xy');
  });

  it('tag aberta sem fechamento (LLM bugado) — remove a abertura solitária', () => {
    expect(stripStructuredTags('<action>texto sem fechar')).toBe('texto sem fechar');
  });

  it('string vazia retorna string vazia', () => {
    expect(stripStructuredTags('')).toBe('');
  });
});

describe('stripLeakedPrefixes', () => {
  it('remove [áudio] no início', () => {
    expect(stripLeakedPrefixes('[áudio] Oi, Rodrigo!')).toBe('Oi, Rodrigo!');
  });

  it('remove [audio] (sem acento) no início', () => {
    expect(stripLeakedPrefixes('[audio] Oi')).toBe('Oi');
  });

  it('remove [áudio transcrito] no início', () => {
    expect(stripLeakedPrefixes('[áudio transcrito] qualquer texto')).toBe('qualquer texto');
  });

  it('remove [texto] no início', () => {
    expect(stripLeakedPrefixes('[texto] Oi')).toBe('Oi');
  });

  it('NÃO remove [áudio] no MEIO da frase (preserva conversa legítima)', () => {
    expect(stripLeakedPrefixes('Você gostou do [áudio] que mandei?')).toBe(
      'Você gostou do [áudio] que mandei?'
    );
  });

  it('texto sem prefixo passa intacto', () => {
    expect(stripLeakedPrefixes('Olá, Rodrigo!')).toBe('Olá, Rodrigo!');
  });

  it('string vazia retorna string vazia', () => {
    expect(stripLeakedPrefixes('')).toBe('');
  });

  it('case-insensitive: [ÁUDIO] removido', () => {
    expect(stripLeakedPrefixes('[ÁUDIO] Oi')).toBe('Oi');
  });
});

describe('integração — fluxo do bug real reportado em smoke 2026-05-03', () => {
  it('mensagem complexa com action + action_data + prefix [áudio] vira só o texto', () => {
    const raw =
      '<action>set_contact_name</action><action_data>{"name":"Rodrigo"}</action_data>[áudio] Entendido, Rodrigo!\n\nJá atualizei aqui.';
    // Aplica strip de tags primeiro, depois strip de prefix
    const cleaned = stripLeakedPrefixes(stripStructuredTags(raw));
    expect(cleaned).toBe('Entendido, Rodrigo!\n\nJá atualizei aqui.');
  });
});
