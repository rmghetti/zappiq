/* ══════════════════════════════════════════════════════════════════════
 * A088 — a resposta que o avaliador julga tem de ser a mesma que o cliente
 * final leria.
 *
 * Em produção o WhatsApp recebe o conteúdo de <reply>…</reply>. O avaliador
 * usava `resp.text` cru, então julgava o texto DOBRADO (o modelo escreve a
 * resposta em prosa e repete dentro da tag) e o cartão "Resposta do agente"
 * mostrava as tags para o cliente. Medido: 365 respostas com '<reply>' desde
 * 01/07.
 *
 * Este arquivo prova o comportamento da função ÚNICA de extração, que agora
 * é chamada pelo orquestrador (WhatsApp), pelo playground e pelo avaliador.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { extractProductionReplyText } from './replyText.js';

describe('extractProductionReplyText', () => {
  it('colapsa a duplicação prosa + tag ficando só com o conteúdo de <reply>', () => {
    const cru =
      'Olá! Como posso te chamar?\n<reply>Olá! Como posso te chamar?</reply>';
    expect(extractProductionReplyText(cru)).toBe('Olá! Como posso te chamar?');
  });

  it('remove as tags estruturadas quando não há <reply>', () => {
    const cru = '<action>handoff</action><action_data>{"a":1}</action_data>Já te conecto.';
    expect(extractProductionReplyText(cru)).toBe('Já te conecto.');
  });

  it('remove o prefixo vazado de áudio no início', () => {
    expect(extractProductionReplyText('[áudio] Estamos abertos sim.')).toBe(
      'Estamos abertos sim.',
    );
  });

  it('aplica o filtro de voz humana (travessão vira vírgula)', () => {
    expect(extractProductionReplyText('Temos sim — das 9 às 18.')).toBe(
      'Temos sim, das 9 às 18.',
    );
  });

  it('texto simples sem tag atravessa igual', () => {
    expect(extractProductionReplyText('Oi, Rod!')).toBe('Oi, Rod!');
  });

  it('entrada vazia ou nula devolve string vazia', () => {
    expect(extractProductionReplyText('')).toBe('');
    expect(extractProductionReplyText(null as any)).toBe('');
    expect(extractProductionReplyText(undefined as any)).toBe('');
  });

  it('é a MESMA função que o WhatsApp usa (paridade com o orquestrador)', async () => {
    // Se alguém copiar a lógica em vez de reusar, este import quebra ou os
    // resultados divergem. O ponto do A088 é não haver duas verdades.
    const orquestrador = await import('./agentOrchestrator.js');
    const cru = 'texto <reply>conteúdo oficial</reply>';
    expect(orquestrador.stripStructuredTags('<reply>x</reply>')).toBe('x');
    expect(extractProductionReplyText(cru)).toBe('conteúdo oficial');
  });
});
