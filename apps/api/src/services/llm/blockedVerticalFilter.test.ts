/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Tests do pre-filter de verticais bloqueadas
 *
 * Cobertura crítica:
 *   ✓ Match em frases comuns que cliente real mandaria
 *   ✓ Match com variações de grafia (acentos, caps, espaços)
 *   ✓ NÃO match em segmentos legítimos com palavras superficiais
 *   ✓ Templates retornados são os esperados
 *   ✓ matchedSnippet preserva o trecho original (audit)
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  detectBlockedVertical,
  isBlocked,
  listBlockedVerticals,
} from './blockedVerticalFilter.js';

describe('blockedVerticalFilter — apostas', () => {
  it('detecta "casa de apostas"', () => {
    const r = detectBlockedVertical('tenho casa de apostas, querem usar a IA');
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.vertical).toBe('apostas');
      expect(r.suggestedResponse).toContain('apostas');
    }
  });

  it('detecta "cassino online"', () => {
    expect(detectBlockedVertical('vamos abrir um cassino online no Brasil').blocked).toBe(true);
  });

  it('detecta "apostas esportivas"', () => {
    expect(detectBlockedVertical('plataforma de apostas esportivas pra Copa').blocked).toBe(true);
  });

  it('detecta marca conhecida (bet365)', () => {
    const r = detectBlockedVertical('quero algo tipo bet365');
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('apostas');
  });

  it('detecta com variação de caps', () => {
    expect(detectBlockedVertical('CASA DE APOSTAS no exterior').blocked).toBe(true);
  });

  it('detecta plural "casas de apostas"', () => {
    expect(detectBlockedVertical('grupo de casas de apostas').blocked).toBe(true);
  });

  it('NÃO detecta "casa" sozinha (genérico)', () => {
    expect(detectBlockedVertical('vendo casa em Floripa').blocked).toBe(false);
  });

  it('NÃO detecta "esportivo" sozinho (academia, vestuário etc)', () => {
    expect(detectBlockedVertical('loja de roupa esportiva').blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — cripto não-regulada', () => {
  it('detecta "corretora de cripto P2P"', () => {
    const r = detectBlockedVertical('fundamos uma corretora de cripto P2P');
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('cripto-nao-regulada');
  });

  it('detecta "P2P de cripto"', () => {
    expect(detectBlockedVertical('plataforma P2P de cripto sem KYC').blocked).toBe(true);
  });

  it('detecta "ICO"', () => {
    expect(detectBlockedVertical('vamos lançar um ICO').blocked).toBe(true);
  });

  it('detecta "corretora sem registro CVM"', () => {
    expect(
      detectBlockedVertical('corretora sem registro CVM, mas com volume alto').blocked,
    ).toBe(true);
  });

  it('NÃO detecta "criptografia" (segurança, não cripto-moeda)', () => {
    expect(
      detectBlockedVertical('precisamos de criptografia ponta-a-ponta').blocked,
    ).toBe(false);
  });

  it('NÃO detecta "Bitcoin" sozinho (legítimo regulado)', () => {
    expect(detectBlockedVertical('aceitamos Bitcoin como pagamento').blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — pornografia', () => {
  it('detecta "OnlyFans"', () => {
    const r = detectBlockedVertical('sou criadora de OnlyFans');
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('pornografia');
  });

  it('detecta "conteúdo adulto"', () => {
    expect(detectBlockedVertical('plataforma de conteúdo adulto').blocked).toBe(true);
  });

  it('detecta "site adulto"', () => {
    expect(detectBlockedVertical('temos um site adulto com 10k assinantes').blocked).toBe(true);
  });

  it('NÃO detecta "público adulto" (segmento etário, não pornografia)', () => {
    expect(detectBlockedVertical('produto pra público adulto 30+').blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — MLM', () => {
  it('detecta "MLM" exato', () => {
    const r = detectBlockedVertical('trabalho com MLM de suplementos');
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('mlm');
  });

  it('detecta "marketing multinível"', () => {
    expect(detectBlockedVertical('estrutura de marketing multinível').blocked).toBe(true);
  });

  it('detecta "marketing de rede"', () => {
    expect(detectBlockedVertical('é marketing de rede mesmo').blocked).toBe(true);
  });

  it('detecta marca conhecida (Hinode)', () => {
    expect(detectBlockedVertical('sou consultora Hinode').blocked).toBe(true);
  });

  it('NÃO detecta "marketing" sozinho', () => {
    expect(detectBlockedVertical('precisamos de marketing digital').blocked).toBe(false);
  });

  it('NÃO detecta "rede" sozinho (rede de varejo, rede social)', () => {
    expect(detectBlockedVertical('rede de farmácias com 50 lojas').blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — false positives e edge cases', () => {
  it('retorna no-match em string vazia', () => {
    expect(detectBlockedVertical('').blocked).toBe(false);
  });

  it('retorna no-match em null', () => {
    expect(detectBlockedVertical(null).blocked).toBe(false);
  });

  it('retorna no-match em undefined', () => {
    expect(detectBlockedVertical(undefined).blocked).toBe(false);
  });

  it('retorna no-match em texto comum de saudação', () => {
    expect(detectBlockedVertical('oi tudo bem? sou da empresa Acme').blocked).toBe(false);
  });

  it('retorna no-match em pergunta de preço', () => {
    expect(detectBlockedVertical('quanto custa o plano Growth?').blocked).toBe(false);
  });

  it('retorna no-match em pedido de demo', () => {
    expect(
      detectBlockedVertical('pode me mandar link pra agendar uma demo?').blocked,
    ).toBe(false);
  });
});

describe('blockedVerticalFilter — matchedSnippet pra audit', () => {
  it('preserva o trecho que casou', () => {
    const r = detectBlockedVertical('tenho CASA DE APOSTAS aqui');
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.matchedSnippet.toLowerCase()).toBe('casa de apostas');
    }
  });
});

describe('blockedVerticalFilter — helpers', () => {
  it('isBlocked retorna boolean simples', () => {
    expect(isBlocked('tenho casa de apostas')).toBe(true);
    expect(isBlocked('oi quero saber sobre voces')).toBe(false);
  });

  it('listBlockedVerticals retorna 4 verticais', () => {
    const list = listBlockedVerticals();
    expect(list).toHaveLength(4);
    expect(list).toContain('apostas');
    expect(list).toContain('cripto-nao-regulada');
    expect(list).toContain('pornografia');
    expect(list).toContain('mlm');
  });
});
