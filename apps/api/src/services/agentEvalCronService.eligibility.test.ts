/**
 * agentEvalCronService.eligibility.test.ts — A045 / A067
 * ============================================================================
 * O ciclo semanal pegava TODO agente com status 'live'. Em produção isso
 * significava 9 organizações '-STAGING', 2 contas com trial vencido sem
 * assinatura e organizações que nunca cadastraram base: 13 alertas no Slack
 * toda segunda e cerca de USD 60 por mês de LLM sem dono.
 *
 * isEvalEligible é a porta única do ciclo. Aqui provamos que ela:
 *   ✓ deixa de fora organização de teste (nome OU slug com 'STAGING')
 *   ✓ deixa de fora trial vencido sem assinatura (mesmo critério do paywall)
 *   ✓ deixa de fora organização sem base cadastrada (sem RAG e sem Q&A ativo)
 *   ✓ deixa passar a organização paga com base cadastrada
 * ============================================================================
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@zappiq/database', () => ({ prisma: {} }));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { isEvalEligible } = await import('./agentEvalCronService.js');

const AGORA = new Date('2026-09-14T00:00:00Z');
const ONTEM = new Date('2026-09-13T00:00:00Z');
const AMANHA = new Date('2026-09-15T00:00:00Z');

/** Organização paga, com base cadastrada: o caso que DEVE ser avaliado. */
function orgPagante(overrides: Record<string, unknown> = {}) {
  return {
    name: 'CMJ',
    slug: 'cmj',
    temBase: true,
    stripeSubscriptionId: 'sub_real',
    subscriptionStatus: 'active',
    now: AGORA,
    ...overrides,
  };
}

describe('isEvalEligible — quem o cron pode avaliar', () => {
  it('avalia a organização paga com base cadastrada', () => {
    expect(isEvalEligible(orgPagante())).toEqual({ elegivel: true });
  });

  it('avalia a organização em trial dentro da janela, com base cadastrada', () => {
    const r = isEvalEligible(
      orgPagante({
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        isTrialActive: true,
        trialEndsAt: AMANHA,
      }),
    );
    expect(r).toEqual({ elegivel: true });
  });
});

describe('isEvalEligible — organização de teste fica de fora', () => {
  it('exclui pelo nome, sem diferenciar caixa', () => {
    expect(isEvalEligible(orgPagante({ name: 'Padaria do Ze-STAGING' }))).toEqual({
      elegivel: false,
      motivo: 'staging',
    });
    expect(isEvalEligible(orgPagante({ name: 'loja staging' }))).toEqual({
      elegivel: false,
      motivo: 'staging',
    });
  });

  it('exclui pelo slug, mesmo com nome limpo', () => {
    expect(isEvalEligible(orgPagante({ name: 'Padaria do Ze', slug: 'padaria-staging' }))).toEqual({
      elegivel: false,
      motivo: 'staging',
    });
  });
});

describe('isEvalEligible — trial vencido sem assinatura fica de fora', () => {
  it('exclui quem passou do fim do trial e nunca pagou', () => {
    const r = isEvalEligible(
      orgPagante({
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        trialEndsAt: ONTEM,
        isTrialActive: false,
      }),
    );
    expect(r).toEqual({ elegivel: false, motivo: 'paywall' });
  });

  it('exclui quem cancelou (churn)', () => {
    const r = isEvalEligible(orgPagante({ churnedAt: ONTEM }));
    expect(r).toEqual({ elegivel: false, motivo: 'paywall' });
  });

  it('mantém quem venceu mas está na carência de migração (paywall soft)', () => {
    // Mesmo critério do requireActivePlan: só o bloqueio duro tira acesso.
    const r = isEvalEligible(
      orgPagante({
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        trialEndsAt: ONTEM,
        isTrialActive: false,
        paywallGraceUntil: AMANHA,
      }),
    );
    expect(r).toEqual({ elegivel: true });
  });

  it('mantém quem está inadimplente (past_due continua com acesso)', () => {
    const r = isEvalEligible(orgPagante({ subscriptionStatus: 'past_due' }));
    expect(r).toEqual({ elegivel: true });
  });
});

describe('isEvalEligible — sem base cadastrada fica de fora', () => {
  it('exclui organização sem trecho no RAG e sem Q&A ativo', () => {
    expect(isEvalEligible(orgPagante({ temBase: false }))).toEqual({
      elegivel: false,
      motivo: 'sem_base',
    });
  });

  it('a organização de teste vence a falta de base no motivo registrado', () => {
    // Ordem importa só pro log: 'staging' é a razão mais barata de apurar.
    expect(isEvalEligible(orgPagante({ name: 'X-STAGING', temBase: false }))).toEqual({
      elegivel: false,
      motivo: 'staging',
    });
  });
});
