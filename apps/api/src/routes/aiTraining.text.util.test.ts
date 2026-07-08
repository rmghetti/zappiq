import { describe, it, expect } from 'vitest';
import { textDocSchema } from './aiTraining.text.util.js';

describe('textDocSchema (colar texto direto)', () => {
  it('aceita título e conteúdo válidos', () => {
    const r = textDocSchema.safeParse({
      title: 'Política de troca',
      content: 'Aceitamos trocas em até 7 dias corridos com nota fiscal e produto sem uso.',
    });
    expect(r.success).toBe(true);
  });

  it('faz trim de título e conteúdo', () => {
    const r = textDocSchema.parse({
      title: '  Horário  ',
      content: '   Atendemos de segunda a sexta das 9h às 18h, sábado até meio-dia.   ',
    });
    expect(r.title).toBe('Horário');
    expect(r.content.startsWith('Atendemos')).toBe(true);
  });

  it('rejeita conteúdo curto demais (não vira conhecimento útil)', () => {
    expect(textDocSchema.safeParse({ title: 'X', content: 'oi' }).success).toBe(false);
    expect(textDocSchema.safeParse({ title: 'Título ok', content: 'muito curto' }).success).toBe(false);
  });

  it('rejeita título vazio e conteúdo acima do teto', () => {
    expect(textDocSchema.safeParse({ title: '', content: 'x'.repeat(50) }).success).toBe(false);
    expect(textDocSchema.safeParse({ title: 'ok', content: 'x'.repeat(50001) }).success).toBe(false);
  });
});
