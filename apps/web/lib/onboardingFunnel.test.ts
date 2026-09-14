import { describe, it, expect } from 'vitest';
import {
  EVENTO_PASSO,
  EVENTO_CONCLUSAO,
  EVENTO_ERRO,
  motivoDoErro,
  propsDoErro,
  propsDoPasso,
} from './onboardingFunnel';

/** Mesma validação da rota POST /api/analytics. Evento fora dela é descartado. */
const REGEX_DA_ROTA = /^[a-z][a-z0-9_]{2,63}$/;

describe('funil do cadastro: os três eventos', () => {
  it('os nomes passam na validação da rota de analytics', () => {
    for (const nome of [EVENTO_PASSO, EVENTO_CONCLUSAO, EVENTO_ERRO]) {
      expect(nome).toMatch(REGEX_DA_ROTA);
    }
  });

  it('props do passo têm só número', () => {
    const props = propsDoPasso(3, 8);
    expect(props).toEqual({ step: 3, total_steps: 8 });
    for (const valor of Object.values(props)) {
      expect(typeof valor).toBe('number');
    }
  });
});

describe('motivoDoErro: etiqueta fechada, sem dado pessoal', () => {
  it('traduz os status que o cadastro devolve de verdade', () => {
    expect(motivoDoErro(409)).toBe('ja_registrado');
    expect(motivoDoErro(400)).toBe('validacao');
    expect(motivoDoErro(422)).toBe('validacao');
    expect(motivoDoErro(401)).toBe('sem_permissao');
    expect(motivoDoErro(429)).toBe('limite_de_tentativas');
    expect(motivoDoErro(500)).toBe('servidor');
    expect(motivoDoErro(503)).toBe('servidor');
  });

  it('reconhece falha de rede quando não houve resposta', () => {
    expect(motivoDoErro(null, new Error('Failed to fetch'))).toBe('rede');
    expect(motivoDoErro(null, new Error('NetworkError when attempting to fetch'))).toBe('rede');
  });

  it('cai em desconhecido sem inventar categoria', () => {
    expect(motivoDoErro(null, new Error('deu ruim'))).toBe('desconhecido');
    expect(motivoDoErro(null, undefined)).toBe('desconhecido');
    expect(motivoDoErro(418)).toBe('desconhecido');
  });

  it('NUNCA devolve a mensagem do servidor (pode ter e-mail do cliente)', () => {
    const vazando = new Error('Falha ao criar conta de lead@exemplo.com.br, CNPJ 12.345.678/0001-90');
    const motivo = motivoDoErro(null, vazando);
    expect(motivo).not.toContain('@');
    expect(motivo).not.toContain('exemplo');
    expect(JSON.stringify(propsDoErro(2, motivo))).not.toContain('exemplo');
  });

  it('props do erro levam só o passo e a etiqueta', () => {
    expect(propsDoErro(2, 'validacao')).toEqual({ step: 2, reason: 'validacao' });
  });
});
