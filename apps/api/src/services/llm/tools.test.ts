/* ══════════════════════════════════════════════════════════════════════
 * Tools registry · gate de isolamento por tenant (14/07/2026)
 * --------------------------------------------------------------------
 * O que este teste tranca:
 *   `get_org_billing_summary` devolve plano, mensagens consumidas, limite,
 *   percentual de uso e teto em R$ da organização. Isso é dado do contrato
 *   da ZappIQ com o tenant. Se a tool for oferecida ao agente que o CLIENTE
 *   criou (a "Vera" do CMJ), o consumidor final dele consegue extrair o
 *   faturamento do cliente perguntando "qual o plano de vocês?".
 *
 * Por que o teste existe:
 *   O campo `internalOnly` e o filtro em getToolsForContext existiam desde o
 *   PR #V4-006, mas NENHUMA tool declarava a flag e NENHUM caller passava
 *   `isIzaOrg`. `!undefined === true` → toda tool saía pra todo tenant. O
 *   gate estava morto e ninguém percebeu porque nada chamava tools em prod.
 *   Estes testes falham se alguém desarmar qualquer uma das duas pontas.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi } from 'vitest';

// tools.ts importa prisma no topo (handler da billing summary). Mock evita
// conexão real de banco: aqui só interessa a lista de definitions.
vi.mock('@zappiq/database', () => ({
  prisma: { organization: { findUnique: vi.fn() } },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getToolsForContext, listToolNames } from './tools.js';

const BILLING = 'get_org_billing_summary';
const names = (opts: Parameters<typeof getToolsForContext>[0]) =>
  getToolsForContext(opts).map((t) => t.name);

describe('a ferramenta de cobrança saiu do ar (A228)', () => {
  it('nem a organização da ZappIQ recebe get_org_billing_summary', () => {
    // A tool lia o contrato da organização DA CONVERSA. Na Iza essa
    // organização é a própria ZappIQ, então qualquer lead que perguntasse
    // "qual o meu plano?" receberia o consumo e o teto em reais da ZappIQ.
    // Ela volta quando resolver a empresa de quem fala, e por interruptor
    // próprio, nunca de carona no interruptor do Agendamento.
    expect(names({ hasScheduling: true, isIzaOrg: true })).not.toContain(BILLING);
  });

  it('org de CLIENTE com agendamento NÃO recebe get_org_billing_summary', () => {
    expect(names({ hasScheduling: true })).not.toContain(BILLING);
  });

  it('sem contexto nenhum a tool interna continua fora (default nega)', () => {
    expect(names({})).not.toContain(BILLING);
  });

  it('não é executável: sumiu do registro, não só do filtro', () => {
    expect(listToolNames()).not.toContain(BILLING);
  });
});

describe('getToolsForContext: agendamento do cliente segue intacto', () => {
  it('cliente com hasScheduling recebe as tools de booking', () => {
    const out = names({ hasScheduling: true });
    expect(out).toContain('check_availability');
    expect(out).toContain('create_appointment');
  });

  it('cliente SEM agendamento não recebe tool nenhuma', () => {
    expect(names({})).toEqual([]);
    expect(names({ hasScheduling: false })).toEqual([]);
  });

  it('o gate de billing não derruba o agendamento junto', () => {
    // Regressão: fix errado seria filtrar tudo quando isIzaOrg é falsy.
    const cliente = names({ hasScheduling: true });
    expect(cliente.length).toBeGreaterThan(0);
    expect(cliente.every((n) => n !== BILLING)).toBe(true);
  });
});
