/* ══════════════════════════════════════════════════════════════════════
 * Motor único: sem trecho da base, sem cabeçalho vazio (C1b, nota 6 da
 * revisão de 14/09).
 * --------------------------------------------------------------------
 * Quando a busca na base não devolvia nada, o prompt levava a linha
 * "# Contexto recuperado (RAG)" sozinha, sem conteúdo embaixo. No chat do
 * site com a base desligada isso aparecia em TODO turno. Cabeçalho vazio
 * ensina o modelo a achar que consultou e não achou ("não tenho essa
 * informação"). Agora o bloco só entra com trecho, ou com o aviso de base
 * fora do ar (A028), que é conteúdo.
 *
 * Só o motor único (interruptor `contextoUnico`) muda: o caminho de antes
 * segue byte a byte igual (composeAgentContext.snapshot.test.ts).
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { buildRagBlock, composeAgentContext, TEXTO_BASE_INDISPONIVEL } from './composeAgentContext.js';

describe('buildRagBlock', () => {
  it('sem trecho: bloco vazio, com a busca ok ou sem resultado', () => {
    expect(buildRagBlock('', 'ok')).toBe('');
    expect(buildRagBlock('', 'sem_resultado')).toBe('');
    expect(buildRagBlock('   ', 'ok')).toBe('');
  });

  it('com trecho: cabeçalho e trecho, como sempre', () => {
    expect(buildRagBlock('[catalogo.pdf] Serra R$ 890', 'ok')).toBe(
      '# Contexto recuperado (RAG)\n[catalogo.pdf] Serra R$ 890',
    );
  });

  it('base fora do ar: cabeçalho e o aviso (é conteúdo, e o modelo precisa saber)', () => {
    expect(buildRagBlock('', 'servico_fora')).toBe(`# Contexto recuperado (RAG)\n${TEXTO_BASE_INDISPONIVEL}`);
  });
});

describe('composeAgentContext sem trecho da base', () => {
  const entrada = (rag: string, ragStatus: 'ok' | 'sem_resultado' | 'servico_fora') => ({
    origem: 'site' as const,
    agente: { id: 'a1', name: 'Vera', systemPrompt: 'Você é a Vera.', role: 'comercial' },
    organizacao: { id: 'org-1', nome: 'CMJ', settings: {}, ehZappIQ: false },
    contato: { nome: null, leadStatus: 'NEW', primeiroContato: true, totalMensagens: 1 },
    blocos: { izaFacts: '', perfilVivo: '', links: '', rag },
    agora: new Date('2026-09-14T15:00:00Z'),
    ragStatus,
  });

  it('não manda o cabeçalho sem conteúdo, e a parte rag fica com 0 caracteres', () => {
    const saida = composeAgentContext(entrada('', 'sem_resultado'));
    expect(saida.systemPrompt).not.toContain('# Contexto recuperado (RAG)');
    expect(saida.partes.find((p) => p.nome === 'rag')!.chars).toBe(0);
    // O resto do prompt segue no lugar: cliente atual e agora.
    expect(saida.systemPrompt).toContain('# Cliente atual');
    expect(saida.systemPrompt).toContain('# Agora');
  });

  it('com trecho, o bloco entra no lugar de sempre (antes de # Agora)', () => {
    const saida = composeAgentContext(entrada('[tabela] R$ 890', 'ok'));
    const rag = saida.systemPrompt.indexOf('# Contexto recuperado (RAG)\n[tabela] R$ 890');
    expect(rag).toBeGreaterThan(0);
    expect(saida.systemPrompt.indexOf('# Agora')).toBeGreaterThan(rag);
  });
});
