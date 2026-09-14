/**
 * buildWebChatSystemPrompt: o prompt do chat do site, byte a byte.
 * ============================================================================
 * Tarefa A3 (Raio-X do prompt). O chat do site montava o system prompt dentro
 * de processWebChatTurn, no meio da chamada ao modelo. Para o Raio-X poder
 * mostrar esse prompt sem gastar um centavo de LLM, a montagem virou uma
 * função pura exportada.
 *
 * Este teste existe para provar que a extração NÃO mudou o texto: a string
 * esperada abaixo foi fixada a partir do código do dia da extração. Se alguém
 * mexer na montagem sem querer, o teste mostra exatamente qual caractere mudou.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';

import { buildWebChatSystemPrompt } from './webChatService.js';
import { CORE_AGENT_RULES_V1 } from '../agents/coreAgentRules.js';

const CANAL_IZA =
  'Você está respondendo no CHAT IN-PAGE do site zappiq.com.br (não WhatsApp). Visitante anônimo navegando a landing page. Mantenha as mesmas regras, tom e calibração. Sempre que fizer sentido, ofereça mudar pro WhatsApp pra continuar a conversa com histórico salvo (use Markdown link: `[WhatsApp](https://wa.me/5511926160159)`).';

const CANAL_CLIENTE =
  'Você está respondendo no CHAT do site institucional da empresa (widget embedado, não WhatsApp). Visitante anônimo navegando o site. Mantenha as mesmas regras, tom e calibração de sempre.';

const FORMATO_LINKS =
  '**FORMATO DE LINKS NESTE CANAL (CRÍTICO):** o chat in-page renderiza links em formato Markdown `[texto](url)` como clicáveis. URLs em texto plano viram texto comum. SEMPRE use formato Markdown ao oferecer cadastro, demo, ou qualquer URL.';

describe('buildWebChatSystemPrompt', () => {
  it('monta o prompt da org de cliente exatamente como a produção monta hoje', () => {
    const prompt = buildWebChatSystemPrompt({
      orgPrompt: '## IDENTIDADE\nVocê é a Vera do CMJ.',
      factsBlock: '',
      isIzaCanonical: false,
    });

    expect(prompt).toBe(
      [
        CORE_AGENT_RULES_V1,
        '## IDENTIDADE\nVocê é a Vera do CMJ.',
        '# CANAL DE COMUNICAÇÃO',
        CANAL_CLIENTE,
        FORMATO_LINKS,
      ].join('\n\n'),
    );
  });

  it('monta o prompt da Iza com os fatos da plataforma e a instrução do canal dela', () => {
    const prompt = buildWebChatSystemPrompt({
      orgPrompt: '## IDENTIDADE\nVocê é a Iza.',
      factsBlock: '# FATOS ATUAIS DA PLATAFORMA\nWhatsApp: LIVE',
      isIzaCanonical: true,
    });

    expect(prompt).toBe(
      [
        CORE_AGENT_RULES_V1,
        '# FATOS ATUAIS DA PLATAFORMA\nWhatsApp: LIVE',
        '## IDENTIDADE\nVocê é a Iza.',
        '# CANAL DE COMUNICAÇÃO',
        CANAL_IZA,
        FORMATO_LINKS,
      ].join('\n\n'),
    );
  });

  it('bloco de fatos vazio não deixa separador sobrando entre CORE e prompt do agente', () => {
    const semFatos = buildWebChatSystemPrompt({
      orgPrompt: 'PROMPT',
      factsBlock: '',
      isIzaCanonical: false,
    });
    const comFatos = buildWebChatSystemPrompt({
      orgPrompt: 'PROMPT',
      factsBlock: 'FATOS',
      isIzaCanonical: false,
    });

    expect(semFatos).toContain(`${CORE_AGENT_RULES_V1}\n\nPROMPT`);
    expect(comFatos).toContain(`${CORE_AGENT_RULES_V1}\n\nFATOS\n\nPROMPT`);
  });

  /* ── C3: regras aprovadas pelo dono ─────────────────────────── */

  it('sem regras aprovadas, o prompt é byte a byte o de hoje', () => {
    const semRegras = buildWebChatSystemPrompt({
      orgPrompt: 'PROMPT',
      factsBlock: '',
      isIzaCanonical: false,
      regrasBlock: '',
    });
    const comoAntes = buildWebChatSystemPrompt({
      orgPrompt: 'PROMPT',
      factsBlock: '',
      isIzaCanonical: false,
    });
    expect(semRegras).toBe(comoAntes);
    expect(semRegras).not.toContain('# Regras aprovadas pelo dono');
  });

  it('com regras, o bloco entra depois do prompt gravado e antes do canal', () => {
    const bloco = '# Regras aprovadas pelo dono\n\n1. Chame o cliente pelo nome.';
    const prompt = buildWebChatSystemPrompt({
      orgPrompt: 'PROMPT',
      factsBlock: '',
      isIzaCanonical: false,
      regrasBlock: bloco,
    });

    expect(prompt).toContain(`PROMPT\n\n${bloco}`);
    expect(prompt.indexOf(bloco)).toBeLessThan(prompt.indexOf('# CANAL DE COMUNICAÇÃO'));
    // As REGRAS BASE continuam na frente: o bloco não passa por cima delas.
    expect(prompt.indexOf(CORE_AGENT_RULES_V1)).toBeLessThan(prompt.indexOf(bloco));
  });

  it('a única diferença entre a Iza e um cliente é o bloco de fatos e a instrução de canal', () => {
    const daIza = buildWebChatSystemPrompt({ orgPrompt: 'P', factsBlock: '', isIzaCanonical: true });
    const doCliente = buildWebChatSystemPrompt({ orgPrompt: 'P', factsBlock: '', isIzaCanonical: false });

    expect(daIza).toContain(CANAL_IZA);
    expect(daIza).not.toContain(CANAL_CLIENTE);
    expect(doCliente).toContain(CANAL_CLIENTE);
    expect(doCliente).not.toContain(CANAL_IZA);
  });
});
