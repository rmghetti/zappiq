// TEMPORÁRIO — prova de que o step "Test API (Vitest)" reprova o CI.
// Este arquivo é removido logo após a verificação.
import { describe, expect, it } from 'vitest';

describe('prova de que o CI pega teste quebrado', () => {
  it('falha de propósito', () => {
    expect(1).toBe(2);
  });
});
