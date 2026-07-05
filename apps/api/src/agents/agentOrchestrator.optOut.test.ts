/**
 * agentOrchestrator.optOut.test.ts — FEATURE 5a.5
 * ============================================================================
 * Opt-out automático no inbound (LGPD / política Meta).
 *
 * Quando o cliente final manda SAIR/PARAR/STOP/CANCELAR/DESCADASTRAR (palavra
 * isolada, case-insensitive), o sistema descadastra o contato e confirma — sem
 * passar pela IA. Aqui testamos a DECISÃO pura (isOptOutMessage): quais textos
 * disparam o opt-out e quais NÃO disparam (falso-positivo é o risco: um "sair"
 * no meio de uma frase não pode descadastrar quem não pediu).
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { isOptOutMessage } from './agentOrchestrator.js';

describe('isOptOutMessage (FEATURE 5a.5)', () => {
  it('dispara para as palavras-chave em maiúsculo', () => {
    expect(isOptOutMessage('SAIR')).toBe(true);
    expect(isOptOutMessage('PARAR')).toBe(true);
    expect(isOptOutMessage('STOP')).toBe(true);
    expect(isOptOutMessage('CANCELAR')).toBe(true);
    expect(isOptOutMessage('DESCADASTRAR')).toBe(true);
  });

  it('é case-insensitive (minúsculo e misto)', () => {
    expect(isOptOutMessage('parar')).toBe(true);
    expect(isOptOutMessage('Stop')).toBe(true);
    expect(isOptOutMessage('sair')).toBe(true);
    expect(isOptOutMessage('Cancelar')).toBe(true);
    expect(isOptOutMessage('descadastrar')).toBe(true);
  });

  it('ignora espaços e pontuação de borda', () => {
    expect(isOptOutMessage('  SAIR  ')).toBe(true);
    expect(isOptOutMessage('parar.')).toBe(true);
    expect(isOptOutMessage('Stop!')).toBe(true);
    expect(isOptOutMessage('"SAIR"')).toBe(true);
    expect(isOptOutMessage('...cancelar...')).toBe(true);
  });

  it('ignora acentos (normalização)', () => {
    // Digitação com acento indevido não deve escapar do opt-out.
    expect(isOptOutMessage('SÁIR')).toBe(true);
    expect(isOptOutMessage('descadastrár')).toBe(true);
  });

  it('NÃO dispara quando a palavra está no meio de uma frase', () => {
    expect(isOptOutMessage('não quero sair de casa')).toBe(false);
    expect(isOptOutMessage('vou parar de fumar ano que vem')).toBe(false);
    expect(isOptOutMessage('quero cancelar meu pedido de pizza')).toBe(false);
    expect(isOptOutMessage('preciso descadastrar meu cartão do app')).toBe(false);
    expect(isOptOutMessage('stop motion é uma técnica legal')).toBe(false);
  });

  it('NÃO dispara para textos aleatórios / vazios', () => {
    expect(isOptOutMessage('oi tudo bem?')).toBe(false);
    expect(isOptOutMessage('quero saber o preço')).toBe(false);
    expect(isOptOutMessage('')).toBe(false);
    expect(isOptOutMessage('   ')).toBe(false);
    expect(isOptOutMessage(null)).toBe(false);
    expect(isOptOutMessage(undefined)).toBe(false);
  });

  it('NÃO dispara para variação que não é palavra-chave exata', () => {
    expect(isOptOutMessage('sairei')).toBe(false);
    expect(isOptOutMessage('parada')).toBe(false);
    expect(isOptOutMessage('cancelado')).toBe(false);
  });
});
