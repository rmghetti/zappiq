import { describe, it, expect } from 'vitest';
import { buildAiResumePrompt, MAX_HISTORY_MESSAGES } from './flowAiResume.js';

const baseCtx = {
  brief: 'Negócio: Clínica Sorriso.\nSegmento: odontologia.',
  personaPrompt: null as string | null,
  history: [
    { direction: 'INBOUND', content: 'Oi, quanto custa a limpeza?' },
    { direction: 'OUTBOUND', content: 'A limpeza sai por R$ 150. Quer agendar?' },
  ],
  aiPrompt: 'Reengaje o cliente sobre a proposta enviada, pergunte se ficou alguma dúvida.',
};

describe('buildAiResumePrompt', () => {
  it('inclui a instrução do nó-IA no prompt de usuário', () => {
    const { user } = buildAiResumePrompt(baseCtx);
    expect(user).toContain('Reengaje o cliente sobre a proposta enviada');
  });

  it('system instrui retomada proativa: UMA mensagem curta, pt-BR, sem assinatura', () => {
    const { system } = buildAiResumePrompt(baseCtx);
    expect(system).toContain('retomando proativamente');
    expect(system).toContain('UMA mensagem');
    expect(system).toContain('500');
    expect(system).toContain('sem assinatura');
    // Contexto do negócio entra no system
    expect(system).toContain('Clínica Sorriso');
  });

  it('formata o histórico com rótulos Cliente/Agente, na ordem recebida (antiga → recente)', () => {
    const { user } = buildAiResumePrompt(baseCtx);
    expect(user).toContain('Cliente: Oi, quanto custa a limpeza?');
    expect(user).toContain('Agente: A limpeza sai por R$ 150. Quer agendar?');
    expect(user.indexOf('Cliente:')).toBeLessThan(user.indexOf('Agente:'));
  });

  it('trunca histórico longo para as últimas MAX_HISTORY_MESSAGES mensagens', () => {
    const history = Array.from({ length: 50 }, (_, i) => ({
      direction: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND',
      content: `msg-${i}`,
    }));
    const { user } = buildAiResumePrompt({ ...baseCtx, history });
    // As 30 primeiras caem fora; as 20 últimas ficam
    expect(user).not.toContain('msg-29');
    expect(user).toContain('msg-30');
    expect(user).toContain('msg-49');
    expect(MAX_HISTORY_MESSAGES).toBe(20);
  });

  it('histórico vazio (conversa purgada) não quebra — prompt segue sem o bloco', () => {
    const { user } = buildAiResumePrompt({ ...baseCtx, history: [] });
    expect(user).not.toContain('Cliente:');
    expect(user).toContain('Reengaje o cliente');
  });

  it('persona entra no system quando disponível', () => {
    const { system } = buildAiResumePrompt({
      ...baseCtx,
      personaPrompt: 'Você é a Iza, assistente da Clínica Sorriso.',
    });
    expect(system).toContain('Você é a Iza');
  });
});
