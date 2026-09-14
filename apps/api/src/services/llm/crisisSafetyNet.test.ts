/* ══════════════════════════════════════════════════════════════════════
 * P62: o que acontece DEPOIS que o pré-filtro vê um sinal de crise.
 *
 * A regra de ouro: a resposta do agente NÃO é substituída. A linha do CVV
 * é acrescentada. Substituir por template é o defeito de A251 e A232, e num
 * momento de crise seria pior.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi } from 'vitest';
import {
  acrescentarAcolhimento,
  acionarRedeDeCrise,
  acionarTransbordoDeCompliance,
} from './crisisSafetyNet.js';
import {
  LINHA_DE_ACOLHIMENTO_CVV,
  LINHA_DE_TRANSBORDO_DE_CRISE,
} from './blockedVerticalFilter.js';

const RESPOSTA = 'Entendo. Me conta um pouco mais sobre o que você precisa?';

describe('acrescentarAcolhimento: acrescenta, nunca substitui', () => {
  it('a resposta do agente continua inteira', () => {
    const saida = acrescentarAcolhimento(RESPOSTA, { comTransbordo: false });
    expect(saida).toContain(RESPOSTA);
  });

  it('o CVV entra com telefone, horário e site', () => {
    const saida = acrescentarAcolhimento(RESPOSTA, { comTransbordo: false });
    expect(saida).toContain('188');
    expect(saida).toContain('24 horas');
    expect(saida).toContain('cvv.org.br');
  });

  it('nos canais reais promete a pessoa; no playground não promete', () => {
    expect(acrescentarAcolhimento(RESPOSTA, { comTransbordo: true })).toContain(
      LINHA_DE_TRANSBORDO_DE_CRISE,
    );
    expect(acrescentarAcolhimento(RESPOSTA, { comTransbordo: false })).not.toContain(
      LINHA_DE_TRANSBORDO_DE_CRISE,
    );
  });

  it('não duplica quando a linha já está na resposta', () => {
    const jaTem = `${RESPOSTA}\n\n${LINHA_DE_ACOLHIMENTO_CVV}`;
    const saida = acrescentarAcolhimento(jaTem, { comTransbordo: false });
    expect(saida.split('188').length - 1).toBe(1);
  });

  it('resposta vazia devolve a linha sozinha, nunca string vazia', () => {
    const saida = acrescentarAcolhimento('', { comTransbordo: false });
    expect(saida).toContain('188');
    expect(saida.trim().length).toBeGreaterThan(0);
  });

  it('o texto é acolhedor e não faz diagnóstico nem promessa de cura', () => {
    const saida = acrescentarAcolhimento(RESPOSTA, { comTransbordo: true });
    expect(saida).not.toMatch(/depress[ãa]o|transtorno|diagn[óo]stico|tratamento/i);
  });
});

function deps(over: Record<string, any> = {}) {
  return {
    pausarIa: vi.fn(async () => undefined),
    avisarDono: vi.fn(async () => 'task-1'),
    registrarEvento: vi.fn(async () => 'evt-1'),
    ...over,
  };
}

describe('acionarRedeDeCrise: pausa, avisa e registra', () => {
  const entrada = {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    canal: 'whatsapp' as const,
    regra: 'crise_me_matar',
  };

  it('marca a conversa como aguardando humano', async () => {
    const d = deps();
    await acionarRedeDeCrise(entrada, d);
    expect(d.pausarIa).toHaveBeenCalledWith('conv-1', 'org-1');
  });

  it('avisa o dono com notificação persistente', async () => {
    const d = deps();
    await acionarRedeDeCrise(entrada, d);
    expect(d.avisarDono).toHaveBeenCalledTimes(1);
  });

  it('grava o evento de auditoria SEM o texto da mensagem', async () => {
    const d = deps();
    await acionarRedeDeCrise(entrada, d);

    const gravado = d.registrarEvento.mock.calls[0][0];
    expect(gravado).toEqual({
      organizationId: 'org-1',
      conversationId: 'conv-1',
      canal: 'whatsapp',
      categoria: 'crise',
      regra: 'crise_me_matar',
      acao: 'acolhimento',
    });
    expect(Object.keys(gravado)).not.toContain('mensagem');
    expect(Object.keys(gravado)).not.toContain('texto');
  });

  it('o aviso ao dono não carrega o texto do cliente', async () => {
    const d = deps();
    await acionarRedeDeCrise(entrada, d);
    const aviso = JSON.stringify(d.avisarDono.mock.calls[0][0]);
    expect(aviso).not.toContain('me matar');
  });

  it('no playground não pausa conversa nenhuma (não existe conversa real)', async () => {
    const d = deps();
    await acionarRedeDeCrise(
      { ...entrada, canal: 'playground', conversationId: null },
      d,
    );
    expect(d.pausarIa).not.toHaveBeenCalled();
    expect(d.registrarEvento).toHaveBeenCalledTimes(1);
  });

  it('falha em qualquer etapa NÃO derruba o turno do cliente', async () => {
    const d = deps({
      pausarIa: vi.fn(async () => {
        throw new Error('banco fora');
      }),
      avisarDono: vi.fn(async () => {
        throw new Error('banco fora');
      }),
      registrarEvento: vi.fn(async () => {
        throw new Error('banco fora');
      }),
    });
    await expect(acionarRedeDeCrise(entrada, d)).resolves.toBeDefined();
  });
});

describe('acionarTransbordoDeCompliance: o mesmo, com outra etiqueta', () => {
  it('registra categoria compliance e ação transbordo', async () => {
    const d = deps();
    await acionarTransbordoDeCompliance(
      {
        organizationId: 'org-1',
        conversationId: 'conv-1',
        canal: 'whatsapp',
        regra: 'pornografia',
      },
      d,
    );

    expect(d.registrarEvento.mock.calls[0][0]).toMatchObject({
      categoria: 'compliance',
      acao: 'transbordo',
      regra: 'pornografia',
    });
    expect(d.pausarIa).toHaveBeenCalledWith('conv-1', 'org-1');
    expect(d.avisarDono).toHaveBeenCalledTimes(1);
  });
});
