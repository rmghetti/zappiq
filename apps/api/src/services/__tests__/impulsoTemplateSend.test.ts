import { describe, it, expect } from 'vitest';
import { hasTemplateVariables, resolveCampaignSend } from '../impulsoTemplateSend.js';

describe('hasTemplateVariables', () => {
  it('detecta placeholders da Meta', () => {
    expect(hasTemplateVariables('Oi {{1}}!')).toBe(true);
    expect(hasTemplateVariables('a {{ 2 }} b')).toBe(true);
  });
  it('sem placeholder = false', () => {
    expect(hasTemplateVariables('Oi, tudo bem?')).toBe(false);
    expect(hasTemplateVariables('')).toBe(false);
  });
});

describe('resolveCampaignSend', () => {
  it('template aprovado SEM variavel -> envia como template', () => {
    const p = resolveCampaignSend(
      {
        message: 'Oi! Faz tempo que a gente nao conversa.',
        template: { name: 'reengajamento_24h', language: 'pt_BR', bodyText: 'Oi! Faz tempo.', metaStatus: 'APPROVED' },
      },
      'whatsapp',
    );
    expect(p.kind).toBe('template');
    if (p.kind === 'template') expect(p.templateName).toBe('reengajamento_24h');
  });

  it('template aprovado COM variavel -> cai em texto (sem preenchimento por contato)', () => {
    const p = resolveCampaignSend(
      { message: 'Oi {{1}}!', template: { name: 't', language: 'pt_BR', bodyText: 'Oi {{1}}!', metaStatus: 'APPROVED' } },
      'whatsapp',
    );
    expect(p.kind).toBe('text');
  });

  it('template NAO aprovado -> texto', () => {
    const p = resolveCampaignSend(
      { message: 'oi', template: { name: 't', language: 'pt_BR', bodyText: 'oi', metaStatus: 'PENDING' } },
      'whatsapp',
    );
    expect(p.kind).toBe('text');
  });

  it('sem template -> texto', () => {
    expect(resolveCampaignSend({ message: 'oi', template: null }, 'whatsapp').kind).toBe('text');
  });

  it('instagram -> sempre texto, mesmo com template aprovado', () => {
    const p = resolveCampaignSend(
      { message: 'oi', template: { name: 't', language: 'pt_BR', bodyText: 'oi', metaStatus: 'APPROVED' } },
      'instagram',
    );
    expect(p.kind).toBe('text');
  });
});
