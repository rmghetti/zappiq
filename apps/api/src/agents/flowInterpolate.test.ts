import { describe, it, expect } from 'vitest';
import { renderTemplate } from './flowInterpolate.js';

const scope = {
  vars: { nome: 'Ana', idade: 30, pedido: { id: 7 } },
  contact: { name: 'Ana Silva', tags: ['vip'] },
  system: { businessName: 'Loja X', agentName: 'Iza' },
};

describe('renderTemplate', () => {
  it('resolve vars, contact e system', () => {
    expect(renderTemplate('Oi {{vars.nome}}, da {{system.businessName}}', scope))
      .toBe('Oi Ana, da Loja X');
    expect(renderTemplate('{{contact.name}}', scope)).toBe('Ana Silva');
  });

  it('var ausente vira vazio; fallback é respeitado', () => {
    expect(renderTemplate('[{{vars.x}}]', scope)).toBe('[]');
    expect(renderTemplate('[{{vars.x | "padrão"}}]', scope)).toBe('[padrão]');
  });

  it('tolera espaços e múltiplos tokens', () => {
    expect(renderTemplate('{{ vars.nome }} tem {{ vars.idade }}', scope)).toBe('Ana tem 30');
  });

  it('objeto/array vira JSON seguro, nunca [object Object]', () => {
    expect(renderTemplate('{{vars.pedido}}', scope)).toBe('{"id":7}');
  });

  it('token malformado é deixado intacto, sem lançar', () => {
    expect(renderTemplate('a {{ } b', scope)).toBe('a {{ } b');
  });

  it('string sem token retorna igual', () => {
    expect(renderTemplate('texto puro', scope)).toBe('texto puro');
  });
});
