/* ══════════════════════════════════════════════════════════════════════
 * Tests do promptEngine: o prompt do cliente não pode ter marca nossa.
 * --------------------------------------------------------------------
 * Por quê (14/07/2026, CMJ):
 *   BASE_INSTRUCTIONS tinha as URLs da ZappIQ hardcoded. Como
 *   agentProvisioningService.buildSeedSystemPrompt() chama getSystemPrompt()
 *   e grava o resultado no Agent.systemPrompt de TODO cliente novo, a Vera
 *   (agente do CMJ) mandava lead do CMJ pro https://zappiq.com.br/cadastro.
 *
 * A trava aqui é o próprio findForeignBrandLeaks do tenantIsolationGuard:
 * se alguém reintroduzir marca/link/preço nosso no prompt genérico, quebra
 * o CI em vez de quebrar a conversa de um lead do cliente.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { getSystemPrompt } from './promptEngine.js';
import { findForeignBrandLeaks } from './tenantIsolationGuard.js';

// Tenant real que sofreu o bug. niche 'servicos_b2b' não existe no catálogo e
// cai no 'generic' de propósito: é o caminho que uma org sem niche pega.
const CMJ = {
  businessName: 'CMJ',
  agentName: 'Vera',
  niche: 'servicos_b2b',
  tone: 'friendly',
};

describe('getSystemPrompt: isolamento de marca (o bug do CMJ)', () => {
  it('prompt do cliente NÃO leva marca da ZappIQ (zero leaks no guard)', () => {
    const prompt = getSystemPrompt(CMJ);
    expect(findForeignBrandLeaks(prompt)).toEqual([]);
  });

  it('modo estrito: nem marca, nem preço/trial/SKU nosso', () => {
    const prompt = getSystemPrompt(CMJ);
    expect(findForeignBrandLeaks(prompt, { strict: true })).toEqual([]);
  });

  it('não sobra nenhuma URL da ZappIQ hardcoded', () => {
    const prompt = getSystemPrompt(CMJ).toLowerCase();
    expect(prompt).not.toContain('zappiq');
    expect(prompt).not.toContain('/cadastro');
    expect(prompt).not.toContain('/onboarding');
  });

  it('vale pra todo niche do catálogo, não só o generic', () => {
    for (const niche of ['dentista', 'imobiliaria', 'ecommerce', 'generic']) {
      const prompt = getSystemPrompt({ ...CMJ, niche });
      expect(findForeignBrandLeaks(prompt, { strict: true })).toEqual([]);
    }
  });

  it('mantém a identidade do tenant (Vera, da CMJ)', () => {
    const prompt = getSystemPrompt(CMJ);
    expect(prompt).toContain('Você é Vera');
    expect(prompt).toContain('CMJ');
  });
});

describe('getSystemPrompt: conversionUrls do tenant', () => {
  it('com conversionUrls: renderiza os links DO CLIENTE', () => {
    const prompt = getSystemPrompt({
      ...CMJ,
      conversionUrls: {
        signup: 'https://cmj.com.br/diagnostico',
        site: 'https://cmj.com.br',
        scheduling: 'https://cmj.com.br/agenda',
      },
    });

    expect(prompt).toContain('### Links oficiais de CMJ');
    expect(prompt).toContain('https://cmj.com.br/diagnostico');
    expect(prompt).toContain('https://cmj.com.br');
    expect(prompt).toContain('https://cmj.com.br/agenda');
    // Link do cliente entrou, marca nossa continua fora.
    expect(findForeignBrandLeaks(prompt, { strict: true })).toEqual([]);
  });

  it('com conversionUrls parcial: só renderiza o que o cliente tem', () => {
    const prompt = getSystemPrompt({
      ...CMJ,
      conversionUrls: { site: 'https://cmj.com.br' },
    });

    expect(prompt).toContain('### Links oficiais de CMJ');
    expect(prompt).toContain('- Site oficial: https://cmj.com.br');
    expect(prompt).not.toContain('Cadastro / próximo passo');
    expect(prompt).not.toContain('Agendamento:');
  });

  it('SEM conversionUrls: nenhum bloco de link é renderizado', () => {
    const prompt = getSystemPrompt(CMJ);
    expect(prompt).not.toContain('Links oficiais');
    expect(prompt).not.toContain('URLs canônicas');
  });

  it('conversionUrls null ou objeto vazio: também sem bloco', () => {
    expect(getSystemPrompt({ ...CMJ, conversionUrls: null })).not.toContain('Links oficiais');
    expect(getSystemPrompt({ ...CMJ, conversionUrls: {} })).not.toContain('Links oficiais');
  });

  it('sem links, mantém a instrução genérica de não inventar URL', () => {
    const prompt = getSystemPrompt(CMJ);
    expect(prompt).toContain('https://');
    expect(prompt).toContain('NUNCA invente uma URL');
    expect(prompt).toContain('diga que vai verificar');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * 14/09/2026 (A8) — o que o seed NÃO pode mais gravar.
 * --------------------------------------------------------------------
 * O prompt do seed é gravado uma vez, no cadastro, e nunca mais relido.
 * Tudo que for dado VIVO (tom, horário, data, capacidade de agendamento)
 * tem de sair de lá e ser montado no turno (tenantLiveProfile). O que
 * ficou congelado em produção: 14 de 15 agentes com "TOM DE VOZ AMIGÁVEL"
 * para organizações configuradas como profissional, 4 com "Domingo:
 * Fechado" para negócio aberto no domingo, e a data do dia do cadastro.
 * ══════════════════════════════════════════════════════════════════════ */
describe('getSystemPrompt: o que sai do texto gravado (A060, A153, A164, A194, A233)', () => {
  it('sem currentDateTime, NÃO grava data nenhuma no prompt', () => {
    const prompt = getSystemPrompt(CMJ);
    expect(prompt).not.toContain('Data/hora atual');
  });

  it('com currentDateTime (fallback, que recebe a hora fresca), a data entra', () => {
    const prompt = getSystemPrompt({ ...CMJ, currentDateTime: '16/09/2026, 14:00:00' });
    expect(prompt).toContain('Data/hora atual: 16/09/2026, 14:00:00');
  });

  it('sem tone, não existe seção de tom (o tom vivo entra no turno)', () => {
    const prompt = getSystemPrompt({ ...CMJ, tone: undefined });
    expect(prompt).not.toContain('TOM DE VOZ');
  });

  it('com tone, o fallback continua com a seção (org sem Agent seedado)', () => {
    expect(getSystemPrompt({ ...CMJ, tone: 'formal' })).toContain('TOM DE VOZ');
  });

  it('nunca grava o Fluxo de Agendamento nem promessa de lembrete', () => {
    for (const niche of ['dentista', 'academia', 'restaurante', 'psicologo', 'generic']) {
      const prompt = getSystemPrompt({ ...CMJ, niche });
      expect(prompt, niche).not.toContain('Fluxo de Agendamento');
      expect(prompt, niche).not.toContain('lembrete será enviado');
      expect(prompt, niche).not.toContain('<action>schedule</action>');
    }
  });

  it('o bloco <buttons> sai do formato de saída (A233: o clique volta como texto)', () => {
    expect(getSystemPrompt(CMJ)).not.toContain('<buttons>');
  });

  it('horário do painel (inglês) vira texto único, sem inventar domingo', () => {
    const prompt = getSystemPrompt({
      ...CMJ,
      businessHours: { weekdays: '09:00 às 18:00', saturday: '09:00 às 13:00' },
    });
    expect(prompt).toContain('Segunda a sexta: 09:00 às 18:00');
    expect(prompt).not.toMatch(/Domingo/i);
  });

  it('horário do cadastro (português) é lido, e domingo aberto aparece aberto', () => {
    const prompt = getSystemPrompt({
      ...CMJ,
      businessHours: { Segunda: 'fechado', Domingo: '12:00-22:00' },
    });
    expect(prompt).toContain('Domingo: 12:00 às 22:00');
  });

  it('horário presente mas ilegível vira "não informado", nunca "Domingo: Fechado"', () => {
    const prompt = getSystemPrompt({ ...CMJ, businessHours: { qualquerCoisa: '' } });
    expect(prompt).not.toMatch(/Domingo:\s*Fechado/i);
    expect(prompt).toContain('não informado');
  });

  it('nunca mais promete funcionar 24/7 no bloco de horário', () => {
    const prompt = getSystemPrompt({ ...CMJ, businessHours: { weekdays: '09:00 às 18:00' } });
    expect(prompt).not.toContain('24/7');
  });

  it('o segmento com acento do cadastro acha o modelo certo (A155)', () => {
    const prompt = getSystemPrompt({ ...CMJ, niche: 'psicólogo' });
    expect(prompt).toContain('PSICOLOGIA');
    expect(prompt).toContain('188');
  });
});
