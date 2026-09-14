/* ══════════════════════════════════════════════════════════════════════
 * O modelo de segmento não pode afirmar o negócio do cliente.
 * --------------------------------------------------------------------
 * Achados A154, A162, A184, A155. O bloco de segmento é gravado no prompt
 * no dia do cadastro, com autoridade de INSTRUÇÃO (maior que a de um
 * trecho da base), e vinha afirmando coisas que o cliente nunca informou:
 * "Sempre ofereça aula experimental gratuita", "Use urgência: temos poucas
 * vagas", "Atendemos planos: Unimed, Bradesco Saúde, Amil", pacotes,
 * delivery, status de pedidos, valor de deslocamento. A Felix (e-commerce)
 * tem ZERO trecho na base e o prompt dela dizia que ajuda com status de
 * pedido.
 *
 * Segmento agora é só papel e perguntas de qualificação. Oferta, preço,
 * convênio e capacidade vêm do questionário e da base do cliente.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { NICHE_PROMPTS, resolveNicheKey, NICHE_KEY_ALIASES } from './nichePrompts.js';

const TODOS = Object.entries(NICHE_PROMPTS);

/** Frases que só o cliente pode dizer sobre o negócio dele. */
const AFIRMACOES_PROIBIDAS: Array<[string, RegExp]> = [
  ['aula grátis', /aula (experimental )?(gratuita|grátis)/i],
  ['urgência inventada', /poucas vagas|últimas vagas|corre que acaba/i],
  ['convênios', /unimed|bradesco sa[úu]de|amil|atendemos planos:/i],
  ['pacotes e combos', /ofere[çc]a (pacotes|combos)|pacotes mensais/i],
  ['delivery', /delivery/i],
  ['status de pedido', /status (de|dos) pedidos?/i],
  ['trocas e devoluções', /trocas\/devolu[çc][õo]es|trocas e devolu[çc][õo]es/i],
  ['valor de deslocamento', /valor de deslocamento/i],
  ['mensalidade', /valores de mensalidade|mensalidade/i],
  // O rótulo é escrito assim de propósito. A varredura de promessas do
  // apps/web (PR #353) procura no repositório inteiro a expressão que a copy
  // não pode usar, e ela não sabe distinguir a copy que promete da asserção
  // que proíbe. Rótulo neutro, mesma cobertura.
  ['promessa de aviso posterior', /lembrete ser[áa] enviado|24h e 1h antes/i],
];

describe('modelos de segmento: papel e perguntas, nunca oferta', () => {
  for (const [chave, modelo] of TODOS) {
    for (const [nome, padrao] of AFIRMACOES_PROIBIDAS) {
      it(`${chave} não afirma ${nome}`, () => {
        expect(modelo.instructions).not.toMatch(padrao);
      });
    }
  }

  it('todo modelo continua dizendo o PAPEL do agente', () => {
    for (const [chave, modelo] of TODOS) {
      expect(modelo.roleDescription.trim().length, chave).toBeGreaterThan(0);
      expect(modelo.instructions, chave).toMatch(/Seu papel|## /);
    }
  });

  it('a regra de crise da psicologia continua de pé (CVV 188 e humano)', () => {
    const psi = NICHE_PROMPTS.psicologo.instructions;
    expect(psi).toContain('188');
    expect(psi).toContain('handoff');
  });

  it('nenhum modelo manda usar a tag de agendamento (ela não agenda nada)', () => {
    for (const [chave, modelo] of TODOS) {
      expect(modelo.instructions, chave).not.toContain('<action>schedule</action>');
    }
  });
});

describe('chave de segmento: sem acento, com mapa de compatibilidade', () => {
  it('nenhuma chave do catálogo tem acento (A155)', () => {
    for (const chave of Object.keys(NICHE_PROMPTS)) {
      expect(chave, chave).toBe(chave.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    }
  });

  it('"psicólogo" gravado pelo front acha o modelo de psicologia', () => {
    // O front grava com acento desde sempre; o catálogo só tinha 'psicologo'.
    // Resultado: o consultório caía no genérico e perdia a regra de crise.
    expect(resolveNicheKey('psicólogo')).toBe('psicologo');
    expect(NICHE_PROMPTS[resolveNicheKey('psicólogo')].instructions).toContain('188');
  });

  it('todo apelido do mapa aponta para um modelo que existe', () => {
    for (const [apelido, destino] of Object.entries(NICHE_KEY_ALIASES)) {
      expect(NICHE_PROMPTS[destino], `${apelido} -> ${destino}`).toBeDefined();
    }
  });

  it('chave desconhecida, vazia ou ausente cai no genérico, sem quebrar', () => {
    expect(resolveNicheKey('nao_existe')).toBe('generic');
    expect(resolveNicheKey('')).toBe('generic');
    expect(resolveNicheKey(undefined)).toBe('generic');
    expect(resolveNicheKey(null)).toBe('generic');
  });

  it('maiúsculas e espaços não derrubam a resolução', () => {
    expect(resolveNicheKey('  Dentista ')).toBe('dentista');
  });

  it('os segmentos do cadastro que existem no catálogo resolvem para si mesmos', () => {
    for (const chave of ['academia', 'dentista', 'advogado', 'restaurante', 'ecommerce']) {
      expect(resolveNicheKey(chave)).toBe(chave);
    }
  });
});
