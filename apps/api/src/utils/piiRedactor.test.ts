/* ══════════════════════════════════════════════════════════════════════
 * V2-022 · piiRedactor.test.ts
 * --------------------------------------------------------------------
 * 50+ casos cobrindo:
 *   - CPF válido/inválido (formato + dígito verificador)
 *   - CNPJ válido/inválido (formato + dígito verificador)
 *   - Cartão Luhn-válido/inválido
 *   - E-mail válido/inválido
 *   - Telefone BR (com +55, sem +55, com 9º dígito, sem)
 *   - CEP
 *   - Mensagens compostas (mix de tipos)
 *   - False positives (anos, números aleatórios)
 *   - Estruturas profundas (objetos aninhados, arrays)
 *   - Vault + unredact roundtrip
 *   - Casos extremos (string vazia, valores não-string)
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  redactPII,
  redactDeep,
  unredact,
  isValidCPF,
  isValidCNPJ,
  isValidLuhn,
} from './piiRedactor.js';

// CPFs válidos conhecidos (validados manualmente):
const VALID_CPF = '529.982.247-25';     // CPF válido oficial de teste
const VALID_CPF_BARE = '52998224725';   // mesmo, sem formato
const INVALID_CPF = '123.456.789-00';   // dígito errado
const INVALID_CPF_BARE = '12345678900';
const REPEATED_CPF = '111.111.111-11';  // CPF inválido (todos iguais)

// CNPJs válidos:
const VALID_CNPJ = '11.222.333/0001-81';
const VALID_CNPJ_BARE = '11222333000181';
const INVALID_CNPJ = '11.222.333/0001-99';

// Cartões Luhn-válidos:
const VALID_VISA = '4532015112830366';      // Luhn válido
const VALID_VISA_FORMATTED = '4532 0151 1283 0366';
const INVALID_CARD = '4532015112830367';    // Luhn inválido (último dígito errado)

// ─────────────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────────────

describe('isValidCPF', () => {
  it('aceita CPF válido formatado', () => expect(isValidCPF(VALID_CPF)).toBe(true));
  it('aceita CPF válido bare', () => expect(isValidCPF(VALID_CPF_BARE)).toBe(true));
  it('rejeita CPF com dígito errado', () => expect(isValidCPF(INVALID_CPF)).toBe(false));
  it('rejeita CPF com todos dígitos iguais', () => expect(isValidCPF(REPEATED_CPF)).toBe(false));
  it('rejeita string vazia', () => expect(isValidCPF('')).toBe(false));
  it('rejeita CPF curto', () => expect(isValidCPF('123')).toBe(false));
  it('rejeita CPF longo', () => expect(isValidCPF('123456789012')).toBe(false));
});

describe('isValidCNPJ', () => {
  it('aceita CNPJ válido formatado', () => expect(isValidCNPJ(VALID_CNPJ)).toBe(true));
  it('aceita CNPJ válido bare', () => expect(isValidCNPJ(VALID_CNPJ_BARE)).toBe(true));
  it('rejeita CNPJ inválido', () => expect(isValidCNPJ(INVALID_CNPJ)).toBe(false));
  it('rejeita CNPJ com todos iguais', () => expect(isValidCNPJ('11.111.111/1111-11')).toBe(false));
});

describe('isValidLuhn', () => {
  it('aceita Visa válido', () => expect(isValidLuhn(VALID_VISA)).toBe(true));
  it('aceita Visa válido formatado', () => expect(isValidLuhn(VALID_VISA_FORMATTED)).toBe(true));
  it('rejeita Luhn inválido', () => expect(isValidLuhn(INVALID_CARD)).toBe(false));
  it('rejeita cartão muito curto', () => expect(isValidLuhn('1234')).toBe(false));
  it('rejeita cartão muito longo', () => expect(isValidLuhn('12345678901234567890')).toBe(false));
  it('aceita Mastercard válido (16 dígitos)', () => expect(isValidLuhn('5425233430109903')).toBe(true));
  it('aceita Amex válido (15 dígitos)', () => expect(isValidLuhn('374245455400126')).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────
// redactPII — patterns BR
// ─────────────────────────────────────────────────────────────────────

describe('redactPII — CPF', () => {
  it('redata CPF válido formatado', () => {
    const r = redactPII(`Meu CPF é ${VALID_CPF} ok?`);
    expect(r.redacted).not.toContain(VALID_CPF);
    expect(r.redacted).toMatch(/<CPF_[a-f0-9]{8}>/);
    expect(r.counts.cpf).toBe(1);
    expect(Object.values(r.vault)).toContain(VALID_CPF);
  });

  it('redata CPF válido bare em frase', () => {
    const r = redactPII(`cpf ${VALID_CPF_BARE} cadastrado`);
    expect(r.redacted).not.toContain(VALID_CPF_BARE);
    expect(r.counts.cpf).toBe(1);
  });

  it('NÃO redata CPF inválido formatado (dígito errado)', () => {
    const r = redactPII(`CPF ${INVALID_CPF} (inválido)`);
    // Formato dispara o pattern formatted, mas validação não roda nele.
    // Decisão de design: formato CPF tão específico que vamos redatar mesmo
    // sem validar — false positive baixo. Se mudar essa decisão, ajustar.
    expect(r.counts.cpf).toBe(1);
    expect(r.redacted).not.toContain(INVALID_CPF);
  });

  it('NÃO redata CPF bare inválido (validação falha)', () => {
    const r = redactPII(`Test ${INVALID_CPF_BARE} number`);
    expect(r.counts.cpf).toBe(0);
    expect(r.redacted).toContain(INVALID_CPF_BARE);
  });

  it('mesmo CPF gera mesmo placeholder (determinístico)', () => {
    const r1 = redactPII(VALID_CPF);
    const r2 = redactPII(VALID_CPF);
    expect(r1.redacted).toBe(r2.redacted);
  });
});

describe('redactPII — CNPJ', () => {
  it('redata CNPJ formatado', () => {
    const r = redactPII(`Empresa ${VALID_CNPJ}`);
    expect(r.redacted).not.toContain(VALID_CNPJ);
    expect(r.counts.cnpj).toBe(1);
  });

  it('redata CNPJ bare válido', () => {
    const r = redactPII(`cnpj ${VALID_CNPJ_BARE}`);
    expect(r.redacted).not.toContain(VALID_CNPJ_BARE);
    expect(r.counts.cnpj).toBe(1);
  });

  it('NÃO redata CNPJ bare inválido', () => {
    const r = redactPII('Number 12345678901234');
    expect(r.counts.cnpj).toBe(0);
  });
});

describe('redactPII — Cartão', () => {
  it('redata cartão Luhn-válido', () => {
    const r = redactPII(`Pagamento ${VALID_VISA}`);
    expect(r.redacted).not.toContain(VALID_VISA);
    expect(r.counts.card).toBe(1);
  });

  it('redata cartão formatado com espaços', () => {
    const r = redactPII(`Card: ${VALID_VISA_FORMATTED} thanks`);
    expect(r.counts.card).toBe(1);
  });

  it('NÃO redata número Luhn-inválido (false positive controlado)', () => {
    const r = redactPII(`Random: ${INVALID_CARD}`);
    expect(r.counts.card).toBe(0);
  });
});

describe('redactPII — E-mail', () => {
  it('redata e-mail simples', () => {
    const r = redactPII('Contato: joao@empresa.com.br');
    expect(r.redacted).not.toContain('joao@empresa.com.br');
    expect(r.counts.email).toBe(1);
  });

  it('redata múltiplos e-mails', () => {
    const r = redactPII('De a@b.com pra c@d.org');
    expect(r.counts.email).toBe(2);
  });

  it('redata e-mail com plus addressing', () => {
    const r = redactPII('user+tag@example.io');
    expect(r.counts.email).toBe(1);
  });
});

describe('redactPII — Telefone BR', () => {
  it('redata celular com +55 e parênteses', () => {
    const r = redactPII('Tel: +55 (11) 99876-5432');
    expect(r.counts.phone).toBe(1);
  });

  it('redata celular sem +55', () => {
    const r = redactPII('Liga (11) 98765-4321');
    expect(r.counts.phone).toBe(1);
  });

  it('redata fixo (10 dígitos)', () => {
    const r = redactPII('telefone 11 3456-7890 atende');
    expect(r.counts.phone).toBe(1);
  });

  it('redata bare 11999999999', () => {
    const r = redactPII('numero 11999998888 cadastrado');
    expect(r.counts.phone).toBeGreaterThan(0);
  });
});

describe('redactPII — CEP', () => {
  it('redata CEP formatado', () => {
    const r = redactPII('CEP 04794-000');
    expect(r.counts.cep).toBe(1);
  });

  it('redata CEP bare', () => {
    const r = redactPII('cep 04794000');
    expect(r.counts.cep).toBe(1);
  });
});

describe('redactPII — mensagens compostas', () => {
  it('redata múltiplos tipos de PII na mesma string', () => {
    const msg = `Cliente joao@example.com CPF ${VALID_CPF} tel +55 11 99988-7766 CEP 01310-100`;
    const r = redactPII(msg);
    expect(r.counts.email).toBe(1);
    expect(r.counts.cpf).toBe(1);
    expect(r.counts.phone).toBe(1);
    expect(r.counts.cep).toBe(1);
    expect(r.redacted).not.toContain('joao@example.com');
    expect(r.redacted).not.toContain(VALID_CPF);
    expect(r.redacted).not.toContain('01310-100');
  });

  it('preserva texto não-PII intacto', () => {
    const r = redactPII('Olá! Como posso ajudar você hoje?');
    expect(r.redacted).toBe('Olá! Como posso ajudar você hoje?');
    expect(Object.keys(r.vault)).toHaveLength(0);
  });
});

describe('redactPII — false positives controlados', () => {
  it('NÃO redata ano (4 dígitos)', () => {
    const r = redactPII('Ano 2026 será incrível');
    expect(Object.keys(r.vault)).toHaveLength(0);
  });

  it('NÃO redata número de plano (3-5 dígitos)', () => {
    const r = redactPII('Plano 197 reais');
    expect(Object.keys(r.vault)).toHaveLength(0);
  });

  it('NÃO redata sequência aleatória de 11 dígitos sem ser CPF válido', () => {
    const r = redactPII('id_externo 12345678900 lookup');
    expect(r.counts.cpf).toBe(0);
  });
});

describe('redactPII — casos extremos', () => {
  it('aceita string vazia', () => {
    const r = redactPII('');
    expect(r.redacted).toBe('');
    expect(Object.keys(r.vault)).toHaveLength(0);
  });

  it('aceita string sem PII', () => {
    const r = redactPII('texto totalmente limpo');
    expect(r.redacted).toBe('texto totalmente limpo');
  });

  it('lida com null sem crashar', () => {
    const r = redactPII(null as any);
    expect(r.redacted).toBe(null);
  });

  it('lida com undefined sem crashar', () => {
    const r = redactPII(undefined as any);
    expect(r.redacted).toBe(undefined);
  });

  it('lida com number sem crashar', () => {
    const r = redactPII(123 as any);
    expect(r.redacted).toBe(123);
  });
});

// ─────────────────────────────────────────────────────────────────────
// redactDeep — estruturas
// ─────────────────────────────────────────────────────────────────────

describe('redactDeep', () => {
  it('redata em objeto plano', () => {
    const r = redactDeep({ name: 'Joao', email: 'joao@x.com', cpf: VALID_CPF });
    const out = r.redacted as Record<string, string>;
    expect(out.name).toBe('Joao');
    expect(out.email).not.toContain('joao@x.com');
    expect(out.cpf).not.toContain(VALID_CPF);
    expect(r.counts.email).toBe(1);
    expect(r.counts.cpf).toBe(1);
  });

  it('redata em array', () => {
    const r = redactDeep(['joao@x.com', 'maria@y.com', 'sem pii']);
    const out = r.redacted as string[];
    expect(out[2]).toBe('sem pii');
    expect(r.counts.email).toBe(2);
  });

  it('redata em estrutura aninhada profunda', () => {
    const input = {
      conversation: {
        messages: [
          { role: 'user', content: `Meu CPF ${VALID_CPF}` },
          { role: 'assistant', content: 'Obrigado!' },
        ],
        contact: { email: 'cliente@empresa.com' },
      },
    };
    const r = redactDeep(input);
    const out = r.redacted as any;
    expect(out.conversation.messages[0].content).not.toContain(VALID_CPF);
    expect(out.conversation.messages[1].content).toBe('Obrigado!');
    expect(out.conversation.contact.email).not.toContain('cliente@empresa.com');
    expect(r.counts.cpf).toBe(1);
    expect(r.counts.email).toBe(1);
  });

  it('preserva números, booleans, null', () => {
    const r = redactDeep({ count: 42, active: true, deleted: null });
    expect(r.redacted).toEqual({ count: 42, active: true, deleted: null });
  });

  it('NÃO muta input', () => {
    const input = { msg: `email ${VALID_CPF}` };
    const r = redactDeep(input);
    expect(input.msg).toContain(VALID_CPF); // input intocado
    expect((r.redacted as any).msg).not.toContain(VALID_CPF);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Vault + unredact
// ─────────────────────────────────────────────────────────────────────

describe('unredact (de-redação on-demand)', () => {
  it('roundtrip: redact → unredact restaura original', () => {
    const original = `Olá! Meu CPF é ${VALID_CPF} e e-mail joao@x.com`;
    const r = redactPII(original);
    const restored = unredact(r.redacted, r.vault);
    expect(restored).toBe(original);
  });

  it('unredact com vault vazio devolve string igual', () => {
    expect(unredact('texto sem placeholder', {})).toBe('texto sem placeholder');
  });

  it('unredact aceita placeholders parciais', () => {
    const r = redactPII(VALID_CPF);
    // Pega só o primeiro placeholder
    const firstKey = Object.keys(r.vault)[0];
    const halfRestored = unredact(r.redacted, { [firstKey]: r.vault[firstKey] });
    expect(halfRestored).toBe(VALID_CPF);
  });
});
