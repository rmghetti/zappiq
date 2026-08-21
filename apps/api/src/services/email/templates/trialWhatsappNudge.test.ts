/**
 * W7 · lembrete D+7 "você ainda não ligou seu WhatsApp" (trial por ativação).
 * Contrato do template (função pura, sem DB): os dois caminhos aparecem
 * (conectar canal + demo no navegador), a promessa central é honesta ("os 14
 * dias só começam a contar na 1ª conversa"), nada de número inventado e nada
 * de travessão (regra de voz da casa).
 */
import { describe, it, expect } from 'vitest';
import { renderTrialWhatsappNudgeEmail } from './trialWhatsappNudge.js';

const CONNECT = 'https://app.zappiq.com.br/settings?utm_campaign=trial_w7#canais';
const DEMO = 'https://app.zappiq.com.br/ai-training?utm_campaign=trial_w7';

describe('trialWhatsappNudge (W7)', () => {
  it('traz o CTA de conectar o canal E o link da demo no navegador', () => {
    const { html, text } = renderTrialWhatsappNudgeEmail({
      firstName: 'Maria',
      connectUrl: CONNECT,
      demoUrl: DEMO,
    });
    expect(html).toContain('Conectar meu WhatsApp');
    expect(html).toContain(DEMO);
    expect(text).toContain(CONNECT);
    expect(text).toContain(DEMO);
  });

  it('explica que os 14 dias só começam a contar na primeira conversa', () => {
    const { html, text } = renderTrialWhatsappNudgeEmail({
      firstName: 'Maria',
      connectUrl: CONNECT,
      demoUrl: DEMO,
    });
    expect(html).toContain('só começam a contar');
    expect(text).toContain('só começam a contar');
    expect(text).toContain('não perdeu nem um dia');
  });

  it('sem travessão e sem valor em reais inventado', () => {
    const { subject, html, text } = renderTrialWhatsappNudgeEmail({
      firstName: 'Maria',
      connectUrl: CONNECT,
      demoUrl: DEMO,
    });
    for (const out of [subject, html, text]) {
      expect(out).not.toContain('—'); // travessão
      expect(out).not.toContain('R$'); // nenhum número de economia fabricado
    }
  });

  it('escapa HTML vindo do nome do usuário', () => {
    const { html } = renderTrialWhatsappNudgeEmail({
      firstName: '<b>Maria</b>',
      connectUrl: CONNECT,
      demoUrl: DEMO,
    });
    expect(html).not.toContain('<b>Maria</b>');
    expect(html).toContain('&lt;b&gt;Maria&lt;/b&gt;');
  });
});
