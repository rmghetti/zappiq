/* ══════════════════════════════════════════════════════════════════════
 * postProcessReply: a mesma saída bruta vira o mesmo texto em todo canal.
 * --------------------------------------------------------------------
 * Tarefa C1b (Passo 12, parte B), achado A189. As travas de saída existiam,
 * mas cada canal chamava um pedaço delas: o filtro de voz só no WhatsApp e
 * no Testar minha IA, a guarda de marca só nas correções, a retomada do
 * Maestro sem extrair <reply>, o chat do site descartando as tags de ação.
 *
 * O que este teste tranca:
 *   1. PARIDADE: para a mesma saída bruta, o texto é o mesmo nos seis
 *      canais, e é o mesmo que o WhatsApp já produzia
 *      (extractProductionReplyText, que segue sendo a definição única).
 *   2. As tags de ação são LIDAS (handoff, set_contact_name, ...), com os
 *      dados e os botões, em vez de descartadas.
 *   3. A guarda de marca roda sobre a resposta real: vazou marca da
 *      ZappIQ para o cliente de outro negócio, o texto não sai, sai a
 *      resposta segura do canal e o alerta volta para quem chamou.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';

import {
  postProcessReply,
  CANAIS_DA_SAIDA,
  RESPOSTA_SEGURA_DO_CANAL,
  TEXTO_SEGURO_AO_CLIENTE,
  type CanalDaSaida,
} from './postProcessReply.js';
import { extractProductionReplyText } from './replyText.js';

const CLIENTE = { id: 'org-cmj', ehZappIQ: false, nome: 'CMJ' };
const VERA = { nome: 'Vera' };

/** Saídas brutas de verdade: prosa + <reply>, tags, prefixo vazado, travessão. */
const SAIDAS_BRUTAS = [
  'Oi, tudo bem? Sou a Vera, da CMJ.',
  'Claro! A consultoria dura 3 meses.\n<reply>Claro! A consultoria dura 3 meses \u2014 e começa na semana que vem.</reply>',
  '<action>set_contact_name</action><action_data>{"name":"Ana"}</action_data>Prazer, Ana! Além disso, posso te mandar o material.',
  '[áudio] Oi! No entanto, o horário é das 9h às 18h.',
  '<reply>Vou te passar para a equipe agora.</reply><action>handoff</action>',
  'Escolha uma opção:<buttons>[{"id":"a","title":"Ver planos"}]</buttons>',
];

describe('paridade: o mesmo texto em todos os canais', () => {
  for (const bruto of SAIDAS_BRUTAS) {
    it(`"${bruto.slice(0, 40)}..." sai igual nos seis canais e igual ao WhatsApp de hoje`, () => {
      const esperado = extractProductionReplyText(bruto);
      const textos = CANAIS_DA_SAIDA.map(
        (canal) => postProcessReply({ bruto, canal, organizacao: CLIENTE, agente: VERA }).texto,
      );
      expect(new Set(textos).size, `textos por canal: ${JSON.stringify(textos)}`).toBe(1);
      expect(textos[0]).toBe(esperado);
    });
  }

  it('os seis canais existem e cada um tem uma resposta segura definida', () => {
    expect([...CANAIS_DA_SAIDA].sort()).toEqual(
      ['instagram', 'maestro_retomada', 'playground', 'qualidade', 'site', 'whatsapp'].sort(),
    );
    for (const canal of CANAIS_DA_SAIDA) {
      expect(typeof RESPOSTA_SEGURA_DO_CANAL[canal]).toBe('string');
    }
  });

  it('nenhuma tag chega ao texto, em nenhum canal', () => {
    for (const bruto of SAIDAS_BRUTAS) {
      for (const canal of CANAIS_DA_SAIDA) {
        const { texto } = postProcessReply({ bruto, canal, organizacao: CLIENTE, agente: VERA });
        expect(texto).not.toMatch(/<\/?(reply|action|action_data|buttons)\b/i);
      }
    }
  });

  it('o filtro de voz vale em todos os canais (travessão e conectivo de redação saem)', () => {
    for (const canal of CANAIS_DA_SAIDA) {
      const { texto } = postProcessReply({
        bruto: 'Temos turmas \u2014 inclusive aos sábados. No entanto, as vagas acabam rápido.',
        canal,
        organizacao: CLIENTE,
        agente: VERA,
      });
      expect(texto).not.toContain('\u2014');
      expect(texto).not.toMatch(/No entanto/);
    }
  });
});

describe('as tags de ação são lidas, não descartadas', () => {
  it('handoff aparece em acoes, em todo canal', () => {
    for (const canal of CANAIS_DA_SAIDA) {
      const saida = postProcessReply({
        bruto: '<reply>Vou chamar alguém da equipe.</reply><action>handoff</action>',
        canal,
        organizacao: CLIENTE,
        agente: VERA,
      });
      expect(saida.acoes).toEqual(['handoff']);
      expect(saida.texto).toBe('Vou chamar alguém da equipe.');
    }
  });

  it('lê os dados da ação e os botões', () => {
    const saida = postProcessReply({
      bruto:
        '<action>set_contact_name</action><action_data>{"name":"Ana"}</action_data>Prazer, Ana!<buttons>[{"id":"b1","title":"Ver planos"}]</buttons>',
      canal: 'whatsapp',
      organizacao: CLIENTE,
      agente: VERA,
    });
    expect(saida.acoes).toEqual(['set_contact_name']);
    expect(saida.tags.actionData).toEqual({ name: 'Ana' });
    expect(saida.tags.buttons).toEqual([{ id: 'b1', title: 'Ver planos' }]);
    expect(saida.texto).toBe('Prazer, Ana!');
  });

  it('várias ações vêm em ordem, sem repetir', () => {
    const saida = postProcessReply({
      bruto: '<action>save_lead</action>Ok!<action>handoff</action><action>handoff</action>',
      canal: 'site',
      organizacao: CLIENTE,
      agente: VERA,
    });
    expect(saida.acoes).toEqual(['save_lead', 'handoff']);
  });

  it('JSON quebrado nas tags não derruba nada: vira null', () => {
    const saida = postProcessReply({
      bruto: 'Oi!<action_data>{nome: Ana</action_data><buttons>[{"id":</buttons>',
      canal: 'whatsapp',
      organizacao: CLIENTE,
      agente: VERA,
    });
    expect(saida.tags.actionData).toBeNull();
    expect(saida.tags.buttons).toBeNull();
    expect(saida.texto).toBe('Oi!');
  });

  it('sem tag nenhuma: acoes vazia, tags nulas, nenhum alerta', () => {
    const saida = postProcessReply({
      bruto: 'Oi! Aqui é a Vera.',
      canal: 'site',
      organizacao: CLIENTE,
      agente: VERA,
    });
    expect(saida.acoes).toEqual([]);
    expect(saida.tags).toEqual({ actionData: null, buttons: null });
    expect(saida.alertas).toEqual([]);
    expect(saida.bloqueada).toBe(false);
  });
});

describe('guarda de marca sobre a resposta real (A189)', () => {
  const VAZAMENTO = 'Aqui é a Vera, da ZappIQ, a plataforma que a gente usa.';

  const canaisQueEntregam: CanalDaSaida[] = ['whatsapp', 'instagram', 'site'];

  for (const canal of canaisQueEntregam) {
    it(`${canal}: o texto com a marca da ZappIQ NÃO sai; sai a resposta segura do canal`, () => {
      const saida = postProcessReply({ bruto: VAZAMENTO, canal, organizacao: CLIENTE, agente: VERA });
      expect(saida.texto).toBe(RESPOSTA_SEGURA_DO_CANAL[canal]);
      expect(saida.texto).toBe(TEXTO_SEGURO_AO_CLIENTE);
      expect(saida.texto).not.toMatch(/zappiq/i);
      expect(saida.bloqueada).toBe(true);
      expect(saida.alertas).toEqual(['guarda_de_marca:ZappIQ']);
    });
  }

  it('retomada do Maestro: a resposta segura é o silêncio (nada vai ao cliente)', () => {
    const saida = postProcessReply({
      bruto: VAZAMENTO,
      canal: 'maestro_retomada',
      organizacao: CLIENTE,
      agente: VERA,
    });
    expect(saida.texto).toBe('');
    expect(saida.bloqueada).toBe(true);
    expect(saida.alertas).toEqual(['guarda_de_marca:ZappIQ']);
  });

  it('Testar minha IA: o dono vê que a guarda segurou e o que o cliente receberia', () => {
    const saida = postProcessReply({ bruto: VAZAMENTO, canal: 'playground', organizacao: CLIENTE, agente: VERA });
    expect(saida.texto).toBe(RESPOSTA_SEGURA_DO_CANAL.playground);
    expect(saida.texto).toContain(TEXTO_SEGURO_AO_CLIENTE);
    expect(saida.texto).not.toMatch(/zappiq/i);
    expect(saida.bloqueada).toBe(true);
  });

  it('Qualidade: o texto fica como veio (o teste existe para achar o vazamento) e o alerta vai junto', () => {
    const saida = postProcessReply({ bruto: VAZAMENTO, canal: 'qualidade', organizacao: CLIENTE, agente: VERA });
    expect(saida.texto).toBe(extractProductionReplyText(VAZAMENTO));
    expect(saida.bloqueada).toBe(false);
    expect(saida.alertas).toEqual(['guarda_de_marca:ZappIQ']);
  });

  it('a organização da ZappIQ fala da própria marca à vontade', () => {
    const saida = postProcessReply({
      bruto: 'Oi! Sou a Iza, da ZappIQ.',
      canal: 'whatsapp',
      organizacao: { id: 'org-zappiq', ehZappIQ: true, nome: 'ZappIQ' },
      agente: { nome: 'Iza' },
    });
    expect(saida.texto).toBe('Oi! Sou a Iza, da ZappIQ.');
    expect(saida.alertas).toEqual([]);
    expect(saida.bloqueada).toBe(false);
  });

  it('cliente cuja agente se chama Iza: o nome dela não é vazamento', () => {
    const saida = postProcessReply({
      bruto: 'Oi! Sou a Iza, da Clínica Luz.',
      canal: 'whatsapp',
      organizacao: { id: 'org-luz', ehZappIQ: false, nome: 'Clínica Luz' },
      agente: { nome: 'Iza' },
    });
    expect(saida.texto).toBe('Oi! Sou a Iza, da Clínica Luz.');
    expect(saida.alertas).toEqual([]);
  });

  it('palavras comuns do português não disparam a guarda (organiza, humanizar, autoriza)', () => {
    const saida = postProcessReply({
      bruto: 'A equipe organiza tudo e autoriza o atendimento humanizado.',
      canal: 'site',
      organizacao: CLIENTE,
      agente: VERA,
    });
    expect(saida.bloqueada).toBe(false);
    expect(saida.alertas).toEqual([]);
  });

  it('marca só dentro de uma tag de ação não conta: o cliente não lê a tag', () => {
    const saida = postProcessReply({
      bruto: 'Oi, aqui é a Vera.<action_data>{"origem":"zappiq"}</action_data>',
      canal: 'whatsapp',
      organizacao: CLIENTE,
      agente: VERA,
    });
    expect(saida.bloqueada).toBe(false);
    expect(saida.texto).toBe('Oi, aqui é a Vera.');
  });
});

describe('entrada vazia ou nula', () => {
  it('não lança e devolve texto vazio', () => {
    for (const bruto of ['', null, undefined]) {
      const saida = postProcessReply({ bruto, canal: 'whatsapp', organizacao: CLIENTE, agente: VERA });
      expect(saida.texto).toBe('');
      expect(saida.acoes).toEqual([]);
    }
  });
});
