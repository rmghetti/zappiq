/**
 * Zap Impulso — tarefa de aprovação do Co-Piloto.
 *
 * O Co-Piloto (autonomyLevel padrão 2) promete "IA propõe, humano aprova" mas
 * nada no código lia isso. Estes testes travam o contrato: TODA campanha nova
 * pede revisão, e a tarefa é honesta sobre ser só um LEMBRETE (não trava
 * disparo — ver o comentário no topo de impulsoAprovacao.ts).
 */
import { describe, it, expect } from 'vitest';
import { precisaAprovacao, montarTarefaAprovacao } from './impulsoAprovacao.js';

describe('precisaAprovacao', () => {
  it('DRAFT e SCHEDULED pedem revisão — são os dois únicos status de criação', () => {
    expect(precisaAprovacao({ status: 'DRAFT' })).toBe(true);
    expect(precisaAprovacao({ status: 'SCHEDULED' })).toBe(true);
  });

  it('não pede revisão de novo para status que já passaram do ponto de aprovação', () => {
    expect(precisaAprovacao({ status: 'ACTIVE' })).toBe(false);
    expect(precisaAprovacao({ status: 'COMPLETED' })).toBe(false);
    expect(precisaAprovacao({ status: 'PAUSED' })).toBe(false);
  });
});

describe('montarTarefaAprovacao', () => {
  const base = {
    id: 'camp_1',
    name: 'Reativação de clientes inativos',
    status: 'SCHEDULED',
    channels: ['whatsapp', 'email'],
    audienceSegment: { description: 'clientes sem compra há 90 dias' },
    scheduledAt: '2026-07-20T10:00:00.000Z',
  };

  it('o título nomeia a campanha, pra reconhecer sem abrir mais nada', () => {
    const t = montarTarefaAprovacao(base);
    expect(t.title).toBe('Aprovar campanha: Reativação de clientes inativos');
  });

  it('a descrição resume canais e público', () => {
    const t = montarTarefaAprovacao(base);
    expect(t.description).toContain('whatsapp, email');
    expect(t.description).toContain('clientes sem compra há 90 dias');
  });

  it('campanha agendada: o prazo é a própria data do disparo', () => {
    const t = montarTarefaAprovacao(base);
    expect(t.dueDate.toISOString()).toBe('2026-07-20T10:00:00.000Z');
    expect(t.description).toContain('agendada para');
  });

  it('sem agendamento: prazo padrão de 24h, e a descrição diz que só sai ao publicar', () => {
    const semAgenda = { ...base, scheduledAt: null };
    const antes = Date.now();
    const t = montarTarefaAprovacao(semAgenda);
    const depois = Date.now();
    expect(t.dueDate.getTime()).toBeGreaterThanOrEqual(antes + 24 * 60 * 60 * 1000 - 1000);
    expect(t.dueDate.getTime()).toBeLessThanOrEqual(depois + 24 * 60 * 60 * 1000 + 1000);
    expect(t.description).toContain('sem agendamento');
  });

  it('sem canal ou sem segmento: não quebra, fala a falta em vez de undefined', () => {
    const vazia = { ...base, channels: [], audienceSegment: null };
    const t = montarTarefaAprovacao(vazia);
    expect(t.description).toContain('canal não definido');
    expect(t.description).toContain('segmento não definido');
    expect(t.description).not.toContain('undefined');
  });
});
