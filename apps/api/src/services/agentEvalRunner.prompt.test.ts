/**
 * buildEvalSystemPrompt: o prompt do teste de Qualidade, byte a byte.
 * ============================================================================
 * Tarefa A3 (Raio-X do prompt). A montagem do prompt do teste de Qualidade
 * morava dentro de runScenario, colada na chamada ao modelo. Para o Raio-X
 * poder mostrar esse prompt sem gastar LLM, virou função pura exportada.
 *
 * A string esperada foi fixada a partir do código do dia da extração. O teste
 * existe para provar que a extração não mudou um caractere, e para deixar
 * visível, em texto, o quanto este prompt é menor que o de produção: sem base
 * de conhecimento, sem saudação, sem links e sem data (achado A036).
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';

import { buildEvalSystemPrompt } from './agentEvalRunner.js';
import { CORE_AGENT_RULES_V1 } from '../agents/coreAgentRules.js';

const agente = { systemPrompt: '## IDENTIDADE\nVocê é a Vera do CMJ.' };

describe('buildEvalSystemPrompt', () => {
  it('monta o prompt do cenário simples exatamente como a produção monta hoje', () => {
    const prompt = buildEvalSystemPrompt(agente, { id: 'cr1_aceitacao_direta' });

    expect(prompt).toBe(
      [
        CORE_AGENT_RULES_V1,
        '## IDENTIDADE\nVocê é a Vera do CMJ.',
        '',
        '# Cliente atual (eval test mock)',
        'Nome registrado: Rod',
        'Telefone: +5511999999999',
        'Status do lead: NEW',
        'Mensagens trocadas até agora: 1',
        'Primeiro contato? SIM',
      ].join('\n'),
    );
  });

  it('omite o nome falso nos cenários que testam justamente a falta de nome', () => {
    const prompt = buildEvalSystemPrompt(agente, { id: 'cr5_nome_ausente_saudacao' });

    // A052 (14/09/2026): a linha passou a ser a MESMA da produção, que diz o
    // que fazer e não só o estado. O teste media um prompt que ninguém usa.
    expect(prompt).toContain(
      'Nome registrado: (ainda não capturado, peça no primeiro turno conforme REGRA 9)',
    );
    expect(prompt).not.toContain('Nome registrado: Rod');
  });

  it('conta o histórico e deixa de anunciar primeiro contato', () => {
    const prompt = buildEvalSystemPrompt(agente, {
      id: 'cr1_aceitacao_apos_oferta',
      history: [
        { role: 'user', content: 'quanto custa?' },
        { role: 'assistant', content: 'depende do plano' },
      ],
    });

    expect(prompt).toContain('Mensagens trocadas até agora: 3');
    // A052: mesma frase da produção (agentOrchestrator), com a instrução.
    expect(prompt).toContain(
      'Primeiro contato? NÃO (já tem histórico, não pergunte nome de novo, use o que está acima)',
    );
  });

  it('agente sem prompt customizado recebe só as regras base, com aviso', () => {
    const prompt = buildEvalSystemPrompt({ systemPrompt: null }, { id: 'qualquer' });

    expect(prompt).toContain('(agente sem system_prompt customizado — só CORE rules)');
    expect(prompt.startsWith(CORE_AGENT_RULES_V1)).toBe(true);
  });

  // Rodada 3 do PR #375. Com `regrasComoRegistros` ligado, aplicar cria o
  // registro e não toca no prompt. Se o avaliador montar o prompt sem o
  // bloco, o re-teste e a execução semanal medem o agente SEM a regra que o
  // dono acabou de aprovar, e a nota da organização migrada nunca mais
  // reflete as regras.
  it('o bloco de regras entra logo depois do prompt do agente, antes de "# Cliente atual"', () => {
    const bloco = '# Regras aprovadas pelo dono\n1. Chame o cliente pelo nome quando souber.';

    const prompt = buildEvalSystemPrompt(agente, { id: 'cr1_aceitacao_direta' }, bloco);

    expect(prompt).toBe(
      [
        CORE_AGENT_RULES_V1,
        '## IDENTIDADE\nVocê é a Vera do CMJ.',
        bloco,
        '',
        '# Cliente atual (eval test mock)',
        'Nome registrado: Rod',
        'Telefone: +5511999999999',
        'Status do lead: NEW',
        'Mensagens trocadas até agora: 1',
        'Primeiro contato? SIM',
      ].join('\n'),
    );
  });

  it('sem bloco (interruptor desligado), o prompt é byte a byte o de hoje', () => {
    const semArgumento = buildEvalSystemPrompt(agente, { id: 'cr1_aceitacao_direta' });

    expect(buildEvalSystemPrompt(agente, { id: 'cr1_aceitacao_direta' }, '')).toBe(semArgumento);
    expect(buildEvalSystemPrompt(agente, { id: 'cr1_aceitacao_direta' }, undefined)).toBe(
      semArgumento,
    );
    expect(semArgumento).not.toContain('# Regras aprovadas pelo dono');
  });

  it('não traz base de conhecimento, saudação, links nem data (achado A036)', () => {
    const prompt = buildEvalSystemPrompt(agente, { id: 'cr7_preco_da_base' });

    expect(prompt).not.toContain('# Contexto recuperado (RAG)');
    expect(prompt).not.toContain('# Saudação configurada');
    expect(prompt).not.toContain('Links oficiais');
    expect(prompt).not.toContain('# Agora');
  });
});
