/* ══════════════════════════════════════════════════════════════════════
 * A213 e A176: o rascunho do cadastro.
 *
 * A213: a senha escolhida no cadastro ficava gravada EM TEXTO no navegador,
 * para sempre, na chave 'zappiq_onboarding'. Ninguém lia e ninguém apagava:
 * o logout removia token, refresh e user, e deixava a senha.
 *
 * A176: o popup do passo 1 prometia salvamento sozinho e volta quando
 * quiser, mas as cerca de 200 respostas viviam só na memória da página.
 * Fechar a aba perdia tudo.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CHAVE_RASCUNHO,
  sanitizarRascunho,
  salvarRascunho,
  lerRascunho,
  limparRascunho,
  type ArmazenamentoLocal,
} from './onboardingDraft';

/** localStorage de mentira, suficiente para o contrato que usamos. */
function memoria(inicial: Record<string, string> = {}): ArmazenamentoLocal & {
  dump: () => Record<string, string>;
} {
  const dados: Record<string, string> = { ...inicial };
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => {
      dados[k] = v;
    },
    removeItem: (k) => {
      delete dados[k];
    },
    dump: () => ({ ...dados }),
  };
}

const formCompleto = {
  name: 'Rodrigo',
  businessName: 'Empresa Teste',
  email: 'lead@exemplo.com.br',
  password: 'SenhaSuperSecreta#1',
  passwordConfirm: 'SenhaSuperSecreta#1',
  phone: '11999990000',
  segment: 'oficina',
  subsegments: ['funilaria'],
  globalAnswers: { desconto_maximo: 'até 15% com aprovação do gerente' },
  segmentAnswers: { marcas: 'Ford, Fiat' },
  subsegmentAnswers: { funilaria: { prazo: '5 dias' } },
  agentName: 'Bia',
  tone: 'friendly',
  greetingMessage: 'Oi!',
  handoffMessage: 'Já te chamo alguém',
  quotaLimitBehavior: 'notify_decide',
  businessHours: { Segunda: { open: '09:00', close: '18:00', closed: false } },
};

let storage: ReturnType<typeof memoria>;
beforeEach(() => {
  storage = memoria();
});

describe('sanitizarRascunho: a senha nunca entra', () => {
  it('não devolve password nem passwordConfirm', () => {
    const limpo = sanitizarRascunho(formCompleto);
    expect(limpo).not.toHaveProperty('password');
    expect(limpo).not.toHaveProperty('passwordConfirm');
  });

  it('não devolve o e-mail (PII que o rascunho não precisa)', () => {
    expect(sanitizarRascunho(formCompleto)).not.toHaveProperty('email');
  });

  it('preserva o que o rascunho existe para preservar', () => {
    const limpo = sanitizarRascunho(formCompleto) as Record<string, any>;
    expect(limpo.segment).toBe('oficina');
    expect(limpo.globalAnswers.desconto_maximo).toContain('15%');
    expect(limpo.subsegmentAnswers.funilaria.prazo).toBe('5 dias');
    expect(limpo.agentName).toBe('Bia');
  });
});

describe('salvarRascunho: o que chega no navegador', () => {
  it('a senha em texto não aparece em lugar nenhum do que foi gravado', () => {
    salvarRascunho(formCompleto, storage);
    const gravado = storage.getItem(CHAVE_RASCUNHO) || '';
    expect(gravado).not.toContain('SenhaSuperSecreta#1');
    expect(gravado).not.toContain('"password"');
    expect(gravado).not.toContain('passwordConfirm');
  });

  it('grava na chave histórica, para não deixar duas sujeiras no navegador', () => {
    salvarRascunho(formCompleto, storage);
    expect(Object.keys(storage.dump())).toEqual([CHAVE_RASCUNHO]);
  });

  it('não explode quando o navegador recusa gravar (modo privado)', () => {
    const recusa: ArmazenamentoLocal = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => undefined,
    };
    expect(() => salvarRascunho(formCompleto, recusa)).not.toThrow();
  });
});

describe('lerRascunho: o rascunho volta quando o lead volta (A176)', () => {
  it('devolve as respostas gravadas', () => {
    salvarRascunho(formCompleto, storage);
    const voltou = lerRascunho(storage) as Record<string, any>;
    expect(voltou.segment).toBe('oficina');
    expect(voltou.globalAnswers.desconto_maximo).toContain('15%');
  });

  it('nunca devolve senha, mesmo que uma chave antiga tenha uma gravada', () => {
    const sujo = memoria({
      [CHAVE_RASCUNHO]: JSON.stringify({ segment: 'oficina', password: 'antiga123' }),
    });
    const voltou = lerRascunho(sujo) as Record<string, any>;
    expect(voltou.segment).toBe('oficina');
    expect(voltou).not.toHaveProperty('password');
  });

  it('devolve null quando não há rascunho e quando o JSON está corrompido', () => {
    expect(lerRascunho(storage)).toBeNull();
    expect(lerRascunho(memoria({ [CHAVE_RASCUNHO]: '{quebrado' }))).toBeNull();
  });
});

describe('limparRascunho: a chave sai do navegador (A213)', () => {
  it('apaga a chave', () => {
    salvarRascunho(formCompleto, storage);
    expect(storage.getItem(CHAVE_RASCUNHO)).toBeTruthy();
    limparRascunho(storage);
    expect(storage.getItem(CHAVE_RASCUNHO)).toBeNull();
  });

  it('apaga também a chave suja deixada pela versão antiga (com senha)', () => {
    const sujo = memoria({
      [CHAVE_RASCUNHO]: JSON.stringify({ password: 'SenhaSuperSecreta#1' }),
    });
    limparRascunho(sujo);
    expect(sujo.getItem(CHAVE_RASCUNHO)).toBeNull();
  });

  it('não explode quando o navegador recusa apagar', () => {
    const recusa: ArmazenamentoLocal = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(() => limparRascunho(recusa)).not.toThrow();
  });
});
