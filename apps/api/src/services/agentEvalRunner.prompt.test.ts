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

    expect(prompt).toContain('Nome registrado: (não informado)');
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
    expect(prompt).toContain('Primeiro contato? NÃO');
  });

  it('agente sem prompt customizado recebe só as regras base, com aviso', () => {
    const prompt = buildEvalSystemPrompt({ systemPrompt: null }, { id: 'qualquer' });

    expect(prompt).toContain('(agente sem system_prompt customizado — só CORE rules)');
    expect(prompt.startsWith(CORE_AGENT_RULES_V1)).toBe(true);
  });

  it('não traz base de conhecimento, saudação, links nem data (achado A036)', () => {
    const prompt = buildEvalSystemPrompt(agente, { id: 'cr7_preco_da_base' });

    expect(prompt).not.toContain('# Contexto recuperado (RAG)');
    expect(prompt).not.toContain('# Saudação configurada');
    expect(prompt).not.toContain('Links oficiais');
    expect(prompt).not.toContain('# Agora');
  });
});
