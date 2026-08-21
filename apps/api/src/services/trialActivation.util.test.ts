/**
 * Trial por ATIVAÇÃO (PR-K, decisão D-plano 20/08/2026).
 *
 * O relógio dos 14 dias começa na 1ª mensagem inbound real de WhatsApp
 * (webhook) ou à força em D+30 do signup (cron diário). Estes testes provam
 * a semântica dos dois gatilhos com um fake de banco que aplica o WHERE do
 * updateMany sobre linhas em memória (mesmos operadores usados no util:
 * igualdade, NULL e { lt } em Date). Assim a idempotência e as exclusões
 * (pagante, churned, janela já concedida) são exercitadas de verdade, não
 * só o shape da chamada.
 */
import { describe, it, expect } from 'vitest';
import {
  activateTrialOnFirstInbound,
  forceActivateDormantTrials,
  trialWindowFrom,
  isWhatsappNudgeDue,
  isWhatsappStillDisconnected,
  TRIAL_DURATION_DAYS,
  DORMANT_ACTIVATION_AFTER_DAYS,
  type TrialActivationDb,
} from './trialActivation.util.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-20T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);

interface OrgRow {
  id: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  stripeSubscriptionId: string | null;
  paidAt: Date | null;
  churnedAt: Date | null;
  createdAt: Date;
  isTrialActive: boolean;
}

/** Org recém-cadastrada no desenho novo: datas NULL, janela "aberta". */
function freshOrg(id: string, overrides: Partial<OrgRow> = {}): OrgRow {
  return {
    id,
    trialStartedAt: null,
    trialEndsAt: null,
    stripeSubscriptionId: null,
    paidAt: null,
    churnedAt: null,
    createdAt: daysAgo(1),
    isTrialActive: true,
    ...overrides,
  };
}

/**
 * Fake de banco com a MESMA semântica do updateMany usada pelo util:
 * igualdade estrita, `null` casa só NULL e `{ lt: Date }` compara datas.
 */
function fakeDb(rows: OrgRow[]): TrialActivationDb & { rows: OrgRow[] } {
  return {
    rows,
    organization: {
      updateMany: async ({ where, data }: any) => {
        const matches = rows.filter((row) => {
          for (const [key, cond] of Object.entries(where)) {
            const value = (row as any)[key];
            if (cond !== null && !(cond instanceof Date) && typeof cond === 'object' && 'lt' in (cond as any)) {
              if (!(value instanceof Date) || !(value.getTime() < (cond as any).lt.getTime())) return false;
            } else if (cond === null) {
              if (value !== null) return false;
            } else if (value !== cond) {
              return false;
            }
          }
          return true;
        });
        for (const m of matches) Object.assign(m, data);
        return { count: matches.length };
      },
    },
  };
}

describe('trialWindowFrom', () => {
  it('janela de exatamente 14 dias a partir da ativação', () => {
    const w = trialWindowFrom(NOW);
    expect(w.trialStartedAt).toEqual(NOW);
    expect(w.trialEndsAt.getTime() - w.trialStartedAt.getTime()).toBe(TRIAL_DURATION_DAYS * DAY_MS);
  });
});

describe('activateTrialOnFirstInbound · 1ª conversa real liga o relógio', () => {
  it('1º inbound ativa (count 1) e seta a janela de 14 dias', async () => {
    const db = fakeDb([freshOrg('org1')]);
    const count = await activateTrialOnFirstInbound(db, 'org1', NOW);
    expect(count).toBe(1);
    expect(db.rows[0].trialStartedAt).toEqual(NOW);
    expect(db.rows[0].trialEndsAt).toEqual(new Date(NOW.getTime() + 14 * DAY_MS));
    expect(db.rows[0].isTrialActive).toBe(true);
  });

  it('é idempotente: 2º inbound não muda as datas (count 0)', async () => {
    const db = fakeDb([freshOrg('org1')]);
    await activateTrialOnFirstInbound(db, 'org1', NOW);
    const firstStart = db.rows[0].trialStartedAt;
    const firstEnd = db.rows[0].trialEndsAt;

    const later = new Date(NOW.getTime() + 2 * DAY_MS);
    const second = await activateTrialOnFirstInbound(db, 'org1', later);
    expect(second).toBe(0);
    expect(db.rows[0].trialStartedAt).toEqual(firstStart);
    expect(db.rows[0].trialEndsAt).toEqual(firstEnd);
  });

  it('org com assinatura Stripe NÃO ganha trial', async () => {
    const db = fakeDb([freshOrg('org1', { stripeSubscriptionId: 'sub_123' })]);
    const count = await activateTrialOnFirstInbound(db, 'org1', NOW);
    expect(count).toBe(0);
    expect(db.rows[0].trialStartedAt).toBeNull();
    expect(db.rows[0].trialEndsAt).toBeNull();
  });

  it('org que já pagou, cancelou ou já teve janela não reabre trial', async () => {
    const paid = freshOrg('paga', { paidAt: daysAgo(5) });
    const churned = freshOrg('churn', { churnedAt: daysAgo(5) });
    const legacy = freshOrg('legada', { trialEndsAt: daysAgo(90) });
    const db = fakeDb([paid, churned, legacy]);
    expect(await activateTrialOnFirstInbound(db, 'paga', NOW)).toBe(0);
    expect(await activateTrialOnFirstInbound(db, 'churn', NOW)).toBe(0);
    expect(await activateTrialOnFirstInbound(db, 'legada', NOW)).toBe(0);
    expect(paid.trialStartedAt).toBeNull();
    expect(churned.trialStartedAt).toBeNull();
    expect(legacy.trialStartedAt).toBeNull();
  });

  it('só toca a org do inbound, nunca as vizinhas', async () => {
    const db = fakeDb([freshOrg('org1'), freshOrg('org2')]);
    await activateTrialOnFirstInbound(db, 'org1', NOW);
    expect(db.rows[1].trialStartedAt).toBeNull();
  });
});

describe('forceActivateDormantTrials · D+30 pega só conta dormente', () => {
  it('ativa a dormente (>30d, sem trial, sem assinatura) e ignora as demais', async () => {
    const dormente = freshOrg('dormente', { createdAt: daysAgo(31) });
    const recente = freshOrg('recente', { createdAt: daysAgo(10) });
    const pagante = freshOrg('pagante', { createdAt: daysAgo(60), stripeSubscriptionId: 'sub_9' });
    const jaAtivada = freshOrg('ativada', {
      createdAt: daysAgo(45),
      trialStartedAt: daysAgo(20),
      trialEndsAt: daysAgo(6),
    });
    const db = fakeDb([dormente, recente, pagante, jaAtivada]);

    const count = await forceActivateDormantTrials(db, NOW);

    expect(count).toBe(1);
    expect(dormente.trialStartedAt).toEqual(NOW);
    expect(dormente.trialEndsAt).toEqual(new Date(NOW.getTime() + 14 * DAY_MS));
    expect(recente.trialStartedAt).toBeNull();
    expect(pagante.trialStartedAt).toBeNull();
    expect(jaAtivada.trialStartedAt).toEqual(daysAgo(20)); // intocada
  });

  it('exatamente D+30 ainda não dispara (corte é estritamente > 30 dias)', async () => {
    const noLimite = freshOrg('limite', { createdAt: daysAgo(DORMANT_ACTIVATION_AFTER_DAYS) });
    const db = fakeDb([noLimite]);
    // createdAt == cutoff não satisfaz `lt` (menor estrito).
    expect(await forceActivateDormantTrials(db, NOW)).toBe(0);
  });

  it('rodar de novo no dia seguinte não reativa quem já foi ativado', async () => {
    const dormente = freshOrg('dormente', { createdAt: daysAgo(31) });
    const db = fakeDb([dormente]);
    expect(await forceActivateDormantTrials(db, NOW)).toBe(1);
    const amanha = new Date(NOW.getTime() + DAY_MS);
    expect(await forceActivateDormantTrials(db, amanha)).toBe(0);
    expect(dormente.trialStartedAt).toEqual(NOW);
  });
});

describe('isWhatsappNudgeDue · lembrete D+7 só para quem não conectou canal', () => {
  const base = { trialStartedAt: null, whatsappPhoneNumberId: null };

  it('elegível: sem trial ativado, sem canal e signup com 7+ dias', () => {
    expect(isWhatsappNudgeDue({ ...base, createdAt: daysAgo(7) }, NOW)).toBe(true);
    expect(isWhatsappNudgeDue({ ...base, createdAt: daysAgo(12) }, NOW)).toBe(true);
  });

  it('cedo demais (menos de 7 dias) não dispara', () => {
    expect(isWhatsappNudgeDue({ ...base, createdAt: daysAgo(6) }, NOW)).toBe(false);
    expect(isWhatsappNudgeDue({ ...base, createdAt: daysAgo(0) }, NOW)).toBe(false);
  });

  it('quem JÁ conectou o WhatsApp não recebe', () => {
    expect(
      isWhatsappNudgeDue(
        { trialStartedAt: null, whatsappPhoneNumberId: '5511999', createdAt: daysAgo(10) },
        NOW,
      ),
    ).toBe(false);
  });

  it('quem já ativou o trial (1ª conversa chegou) não recebe', () => {
    expect(
      isWhatsappNudgeDue(
        { trialStartedAt: daysAgo(2), whatsappPhoneNumberId: null, createdAt: daysAgo(10) },
        NOW,
      ),
    ).toBe(false);
  });

  it('isWhatsappStillDisconnected: re-check do worker antes do envio', () => {
    expect(isWhatsappStillDisconnected({ trialStartedAt: null, whatsappPhoneNumberId: null })).toBe(true);
    expect(isWhatsappStillDisconnected({ trialStartedAt: NOW, whatsappPhoneNumberId: null })).toBe(false);
    expect(isWhatsappStillDisconnected({ trialStartedAt: null, whatsappPhoneNumberId: '123' })).toBe(false);
  });
});
