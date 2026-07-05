/**
 * W3.3 · Regressão anti-fabricação nos e-mails de trial (D+1/D+3/D+7).
 *
 * Bug original: trialFollowupService passava `50 + random` como AI Readiness
 * Score e `R$10k + random` como economia — números INVENTADOS chegando a leads
 * reais. Fix: readiness real (computeAIReadiness) e economia derivada da mesma
 * fonte do savingsEmail (computeSavings). E, quando o dado real não existe, os
 * templates DEVEM OMITIR a frase em vez de imprimir um placeholder.
 *
 * Estes testes travam o contrato de omissão dos templates (funções puras, sem
 * DB) + a natureza determinística/derivada do cálculo de economia.
 */
import { describe, it, expect } from 'vitest';
import { renderTrialMidwayEmail } from './trialMidway.js';
import { renderTrialLastDayEmail } from './trialLastDay.js';
import {
  renderTrialSavingsFollowupEmail,
  computeSavings,
} from './trialSavingsFollowup.js';

describe('trialMidway · omite dado ausente em vez de inventar', () => {
  it('sem aiReadinessScore → não imprime o score renderizado ("/100")', () => {
    const { html, text } = renderTrialMidwayEmail({
      firstName: 'Maria',
      daysRemaining: 13,
      ctaUrl: 'https://app/x',
    });
    // O comentário HTML "<!-- AI Readiness Score -->" pode existir; o que NÃO
    // pode aparecer é o número renderizado. "/100" só existe dentro do bloco.
    expect(html).not.toContain('/100');
    expect(text).not.toContain('AI Readiness Score:');
  });

  it('com aiReadinessScore real → imprime exatamente esse número', () => {
    const { html, text } = renderTrialMidwayEmail({
      firstName: 'Maria',
      daysRemaining: 13,
      aiReadinessScore: 42,
      ctaUrl: 'https://app/x',
    });
    expect(html).toContain('42');
    expect(html).toContain('/100');
    expect(text).toContain('AI Readiness Score: 42/100');
  });

  it('sem savings (undefined) → não imprime bloco de economia', () => {
    const { html, text } = renderTrialMidwayEmail({
      firstName: 'Maria',
      daysRemaining: 13,
      aiReadinessScore: 42,
      ctaUrl: 'https://app/x',
    });
    expect(html).not.toContain('Economia projetada');
    expect(text).not.toContain('Economia projetada');
  });

  it('savings ≤ 0 → tratado como ausente (sem bloco)', () => {
    const { html } = renderTrialMidwayEmail({
      firstName: 'Maria',
      daysRemaining: 13,
      savings: 0,
      ctaUrl: 'https://app/x',
    });
    expect(html).not.toContain('Economia projetada');
  });

  it('savings real > 0 → imprime o valor formatado', () => {
    const { html, text } = renderTrialMidwayEmail({
      firstName: 'Maria',
      daysRemaining: 13,
      savings: 23636,
      ctaUrl: 'https://app/x',
    });
    expect(html).toContain('Economia projetada');
    expect(html).toContain('23.636');
    expect(text).toContain('23.636');
  });
});

describe('trialLastDay · omite economia ausente em vez de inventar', () => {
  it('sem savings → subject e corpo não citam valor em reais fabricado', () => {
    const { subject, html, text } = renderTrialLastDayEmail({
      firstName: 'Ana',
      ctaUrl: 'https://app/x',
    });
    expect(subject).toContain('Último dia de trial');
    expect(subject).not.toContain('R$');
    expect(html).not.toContain('Sua economia no 1º ano');
    expect(text).not.toContain('Sua economia no 1º ano');
    // Cupom continua presente — a mensagem de urgência não depende do número.
    expect(html).toContain('LASTDAY14');
  });

  it('com savings real → mostra número no subject e no corpo', () => {
    const { subject, html, text } = renderTrialLastDayEmail({
      firstName: 'Ana',
      savings: 23636,
      ctaUrl: 'https://app/x',
    });
    expect(subject).toContain('23.636');
    expect(html).toContain('Sua economia no 1º ano');
    expect(html).toContain('23.636');
    expect(text).toContain('23.636');
  });
});

describe('trialSavingsFollowup · readiness opcional', () => {
  it('sem aiReadinessScore → bloco some', () => {
    const { html, text } = renderTrialSavingsFollowupEmail({
      firstName: 'Rodrigo',
      daysRemaining: 11,
      competitorSetupBrl: 8000,
      competitorMonthlyBrl: 1500,
      ctaUrl: 'https://app/x',
    });
    expect(html).not.toContain('AI Readiness Score');
    expect(text).not.toContain('AI Readiness Score');
  });
});

describe('computeSavings · economia é DERIVADA e determinística (não aleatória)', () => {
  it('baseline pública Blip vs. ZappIQ Starter → valor fixo e reprodutível', () => {
    // 8000 setup + 1500*12 = 26000 (concorrente) − 197*12 = 2364 (ZappIQ)
    const a = computeSavings(8000, 1500, 197);
    const b = computeSavings(8000, 1500, 197);
    expect(a.savings).toBe(23636);
    expect(a.savings).toBe(b.savings); // determinístico: mesma entrada, mesma saída
  });

  it('nunca negativa (clamp em 0)', () => {
    const { savings } = computeSavings(0, 0, 999);
    expect(savings).toBe(0);
  });
});
