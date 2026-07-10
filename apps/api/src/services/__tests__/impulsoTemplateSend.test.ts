import { describe, it, expect } from 'vitest';
import {
  hasTemplateVariables,
  templateVariableNumbers,
  isVariableMapComplete,
  resolveVariableValue,
  buildTemplateComponents,
  resolveCampaignSend,
} from '../impulsoTemplateSend.js';

describe('templateVariableNumbers / hasTemplateVariables', () => {
  it('extrai números distintos e ordenados', () => {
    expect(templateVariableNumbers('Oi {{1}}, da {{2}} — de novo {{1}}')).toEqual([1, 2]);
    expect(templateVariableNumbers('sem nada')).toEqual([]);
  });
  it('detecta presença de variáveis', () => {
    expect(hasTemplateVariables('Oi {{1}}!')).toBe(true);
    expect(hasTemplateVariables('Oi!')).toBe(false);
  });
});

describe('isVariableMapComplete', () => {
  it('completo quando todo {{N}} tem origem válida', () => {
    const vars = [
      { index: 1, source: 'contact.firstName' as const },
      { index: 2, source: 'fixed' as const, fixedText: 'Loja X' },
    ];
    expect(isVariableMapComplete('Oi {{1}}, aqui é da {{2}}', vars)).toBe(true);
  });
  it('incompleto quando falta uma variável', () => {
    expect(isVariableMapComplete('Oi {{1}} {{2}}', [{ index: 1, source: 'contact.name' as const }])).toBe(false);
  });
  it('fixed sem texto = incompleto', () => {
    expect(isVariableMapComplete('Oi {{1}}', [{ index: 1, source: 'fixed' as const, fixedText: '' }])).toBe(false);
  });
  it('corpo sem variáveis = sempre completo', () => {
    expect(isVariableMapComplete('Oi!', undefined)).toBe(true);
  });
});

describe('resolveVariableValue', () => {
  it('primeiro nome do contato', () => {
    expect(resolveVariableValue({ index: 1, source: 'contact.firstName' }, { name: 'Ana Paula Souza' })).toBe('Ana');
  });
  it('empresa, com fallback quando vazia', () => {
    expect(resolveVariableValue({ index: 1, source: 'contact.company', fallback: 'sua empresa' }, { company: null })).toBe('sua empresa');
  });
  it('texto fixo', () => {
    expect(resolveVariableValue({ index: 1, source: 'fixed', fixedText: 'promo' }, {})).toBe('promo');
  });
  it('nunca retorna vazio (reserva genérica)', () => {
    expect(resolveVariableValue({ index: 1, source: 'contact.name' }, { name: '' })).toBe('cliente');
  });
});

describe('buildTemplateComponents', () => {
  it('monta body com parâmetros resolvidos, na ordem', () => {
    const comps = buildTemplateComponents(
      'Oi {{1}}, aqui é da {{2}}',
      [
        { index: 1, source: 'contact.firstName' },
        { index: 2, source: 'fixed', fixedText: 'Clínica Sorriso' },
      ],
      { name: 'João Silva' },
    );
    expect(comps).toEqual([
      { type: 'body', parameters: [ { type: 'text', text: 'João' }, { type: 'text', text: 'Clínica Sorriso' } ] },
    ]);
  });
  it('corpo sem variáveis = array vazio', () => {
    expect(buildTemplateComponents('Oi!', undefined, {})).toEqual([]);
  });
});

describe('resolveCampaignSend', () => {
  it('aprovado sem variável -> template', () => {
    const p = resolveCampaignSend(
      { message: 'oi', template: { name: 't', language: 'pt_BR', bodyText: 'Oi tudo bem', metaStatus: 'APPROVED' } },
      'whatsapp',
    );
    expect(p.kind).toBe('template');
  });
  it('aprovado com variável E mapa completo -> template', () => {
    const p = resolveCampaignSend(
      {
        message: 'oi',
        template: {
          name: 't', language: 'pt_BR', bodyText: 'Oi {{1}}!', metaStatus: 'APPROVED',
          variables: [{ index: 1, source: 'contact.firstName' }],
        },
      },
      'whatsapp',
    );
    expect(p.kind).toBe('template');
    if (p.kind === 'template') expect(p.variables).toHaveLength(1);
  });
  it('aprovado com variável mas mapa incompleto -> texto', () => {
    const p = resolveCampaignSend(
      { message: 'oi', template: { name: 't', language: 'pt_BR', bodyText: 'Oi {{1}}!', metaStatus: 'APPROVED', variables: [] } },
      'whatsapp',
    );
    expect(p.kind).toBe('text');
  });
  it('não aprovado -> texto', () => {
    const p = resolveCampaignSend(
      { message: 'oi', template: { name: 't', language: 'pt_BR', bodyText: 'oi', metaStatus: 'PENDING' } },
      'whatsapp',
    );
    expect(p.kind).toBe('text');
  });
  it('instagram -> sempre texto', () => {
    const p = resolveCampaignSend(
      { message: 'oi', template: { name: 't', language: 'pt_BR', bodyText: 'oi', metaStatus: 'APPROVED' } },
      'instagram',
    );
    expect(p.kind).toBe('text');
  });
});
