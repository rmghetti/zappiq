/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Tests do pre-filter de verticais bloqueadas
 *
 * Cobertura crítica:
 *   ✓ Match em frases comuns que cliente real mandaria
 *   ✓ Match com variações de grafia (acentos, caps, espaços)
 *   ✓ NÃO match em segmentos legítimos com palavras superficiais
 *   ✓ Templates retornados são os esperados
 *   ✓ matchedSnippet preserva o trecho original (audit)
 *
 * Atualizado 14/07/2026 (duas camadas):
 *   As verticais de política comercial (apostas/cripto/MLM) agora SÓ valem na
 *   org da ZappIQ. Por isso os testes delas passam `ZAPPIQ` explicitamente:
 *   sem org, o filtro trata como cliente e não bloqueia (fail-safe).
 *   ✓ Org de cliente não recebe nossa política nem nossa marca
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  detectBlockedVertical,
  isBlocked,
  listBlockedVerticals,
  BLOCKED_VERTICAL_LAYERS,
} from './blockedVerticalFilter.js';
import { ZAPPIQ_ORG_ID } from '../../config/zappiqOrg.js';
import { findForeignBrandLeaks } from '../../agents/tenantIsolationGuard.js';

/** Contexto da org da ZappIQ (onde a Iza roda e nossa política vale). */
const ZAPPIQ = { organizationId: ZAPPIQ_ORG_ID };
/** Contexto de um tenant real (CMJ). Nossa política comercial não vale aqui. */
const CLIENTE = { organizationId: 'org-cmj-123', businessName: 'CMJ' };

describe('blockedVerticalFilter — apostas', () => {
  it('detecta "casa de apostas"', () => {
    const r = detectBlockedVertical('tenho casa de apostas, querem usar a IA', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.vertical).toBe('apostas');
      expect(r.suggestedResponse).toContain('apostas');
    }
  });

  it('detecta "cassino online"', () => {
    expect(detectBlockedVertical('vamos abrir um cassino online no Brasil', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "apostas esportivas"', () => {
    expect(detectBlockedVertical('plataforma de apostas esportivas pra Copa', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta marca conhecida (bet365)', () => {
    const r = detectBlockedVertical('quero algo tipo bet365', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('apostas');
  });

  it('detecta com variação de caps', () => {
    expect(detectBlockedVertical('CASA DE APOSTAS no exterior', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta plural "casas de apostas"', () => {
    expect(detectBlockedVertical('grupo de casas de apostas', ZAPPIQ).blocked).toBe(true);
  });

  it('NÃO detecta "casa" sozinha (genérico)', () => {
    expect(detectBlockedVertical('vendo casa em Floripa', ZAPPIQ).blocked).toBe(false);
  });

  it('NÃO detecta "esportivo" sozinho (academia, vestuário etc)', () => {
    expect(detectBlockedVertical('loja de roupa esportiva', ZAPPIQ).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — cripto não-regulada', () => {
  it('detecta "corretora de cripto P2P"', () => {
    const r = detectBlockedVertical('fundamos uma corretora de cripto P2P', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('cripto-nao-regulada');
  });

  it('detecta "P2P de cripto"', () => {
    expect(detectBlockedVertical('plataforma P2P de cripto sem KYC', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "ICO"', () => {
    expect(detectBlockedVertical('vamos lançar um ICO', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "corretora sem registro CVM"', () => {
    expect(
      detectBlockedVertical('corretora sem registro CVM, mas com volume alto', ZAPPIQ).blocked,
    ).toBe(true);
  });

  it('NÃO detecta "criptografia" (segurança, não cripto-moeda)', () => {
    expect(
      detectBlockedVertical('precisamos de criptografia ponta-a-ponta', ZAPPIQ).blocked,
    ).toBe(false);
  });

  it('NÃO detecta "Bitcoin" sozinho (legítimo regulado)', () => {
    expect(detectBlockedVertical('aceitamos Bitcoin como pagamento', ZAPPIQ).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — pornografia', () => {
  it('detecta "OnlyFans"', () => {
    const r = detectBlockedVertical('sou criadora de OnlyFans', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('pornografia');
  });

  it('detecta "conteúdo adulto"', () => {
    expect(detectBlockedVertical('plataforma de conteúdo adulto', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "site adulto"', () => {
    expect(detectBlockedVertical('temos um site adulto com 10k assinantes', ZAPPIQ).blocked).toBe(true);
  });

  it('NÃO detecta "público adulto" (segmento etário, não pornografia)', () => {
    expect(detectBlockedVertical('produto pra público adulto 30+', ZAPPIQ).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — MLM', () => {
  it('detecta "MLM" exato', () => {
    const r = detectBlockedVertical('trabalho com MLM de suplementos', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('mlm');
  });

  it('detecta "marketing multinível"', () => {
    expect(detectBlockedVertical('estrutura de marketing multinível', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "marketing de rede"', () => {
    expect(detectBlockedVertical('é marketing de rede mesmo', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta marca conhecida (Hinode)', () => {
    expect(detectBlockedVertical('sou consultora Hinode', ZAPPIQ).blocked).toBe(true);
  });

  it('NÃO detecta "marketing" sozinho', () => {
    expect(detectBlockedVertical('precisamos de marketing digital', ZAPPIQ).blocked).toBe(false);
  });

  it('NÃO detecta "rede" sozinho (rede de varejo, rede social)', () => {
    expect(detectBlockedVertical('rede de farmácias com 50 lojas', ZAPPIQ).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — false positives e edge cases', () => {
  it('retorna no-match em string vazia', () => {
    expect(detectBlockedVertical('', ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em null', () => {
    expect(detectBlockedVertical(null, ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em undefined', () => {
    expect(detectBlockedVertical(undefined, ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em texto comum de saudação', () => {
    expect(detectBlockedVertical('oi tudo bem? sou da empresa Acme', ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em pergunta de preço', () => {
    expect(detectBlockedVertical('quanto custa o plano Growth?', ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em pedido de demo', () => {
    expect(
      detectBlockedVertical('pode me mandar link pra agendar uma demo?', ZAPPIQ).blocked,
    ).toBe(false);
  });
});

describe('blockedVerticalFilter — matchedSnippet pra audit', () => {
  it('preserva o trecho que casou', () => {
    const r = detectBlockedVertical('tenho CASA DE APOSTAS aqui', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.matchedSnippet.toLowerCase()).toBe('casa de apostas');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// Duas camadas (14/07/2026): o bug que chegava ao lead do cliente.
// ══════════════════════════════════════════════════════════════════════

describe('blockedVerticalFilter: política comercial NÃO vaza pro cliente', () => {
  it('lead do CMJ falando de casa de apostas NÃO é bloqueado (funil é do CMJ)', () => {
    expect(detectBlockedVertical('tenho casa de apostas, querem usar a IA', CLIENTE).blocked).toBe(false);
  });

  it('cripto e MLM também passam na org do cliente', () => {
    expect(detectBlockedVertical('fundamos uma corretora de cripto P2P', CLIENTE).blocked).toBe(false);
    expect(detectBlockedVertical('trabalho com MLM de suplementos', CLIENTE).blocked).toBe(false);
  });

  it('as mesmas frases SÃO bloqueadas na org da ZappIQ', () => {
    expect(detectBlockedVertical('tenho casa de apostas', ZAPPIQ).blocked).toBe(true);
    expect(detectBlockedVertical('fundamos uma corretora de cripto P2P', ZAPPIQ).blocked).toBe(true);
    expect(detectBlockedVertical('trabalho com MLM de suplementos', ZAPPIQ).blocked).toBe(true);
  });

  it('fail-safe: org desconhecida = cliente (só compliance)', () => {
    expect(detectBlockedVertical('tenho casa de apostas').blocked).toBe(false);
    expect(detectBlockedVertical('tenho casa de apostas', {}).blocked).toBe(false);
    expect(detectBlockedVertical('tenho casa de apostas', { organizationId: null }).blocked).toBe(false);
    expect(detectBlockedVertical('tenho casa de apostas', { organizationId: '' }).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter: compliance vale pra todo tenant, sem marca', () => {
  it('pornografia é bloqueada TAMBÉM na org do cliente', () => {
    const r = detectBlockedVertical('sou criadora de OnlyFans', CLIENTE);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.vertical).toBe('pornografia');
      expect(r.layer).toBe('compliance');
    }
  });

  it('a mensagem pro lead do cliente NÃO cita a ZappIQ (o bug)', () => {
    const r = detectBlockedVertical('plataforma de conteúdo adulto', CLIENTE);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(findForeignBrandLeaks(r.suggestedResponse)).toEqual([]);
      expect(r.suggestedResponse).toContain('CMJ não atende');
    }
  });

  it('sem businessName a mensagem fica neutra, ainda sem marca', () => {
    const r = detectBlockedVertical('plataforma de conteúdo adulto', { organizationId: 'org-x' });
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(findForeignBrandLeaks(r.suggestedResponse)).toEqual([]);
      expect(r.suggestedResponse).toContain('Não atendemos');
    }
  });

  it('nenhuma resposta a tenant de cliente carrega marca nossa', () => {
    for (const frase of ['sou criadora de OnlyFans', 'site adulto', 'camgirl profissional']) {
      const r = detectBlockedVertical(frase, CLIENTE);
      if (r.blocked) expect(findForeignBrandLeaks(r.suggestedResponse)).toEqual([]);
    }
  });

  it('na org da ZappIQ a resposta pode (e deve) citar a ZappIQ', () => {
    const r = detectBlockedVertical('plataforma de conteúdo adulto', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.suggestedResponse).toContain('ZappIQ');
  });
});

describe('blockedVerticalFilter — helpers', () => {
  it('isBlocked retorna boolean simples', () => {
    expect(isBlocked('tenho casa de apostas', ZAPPIQ)).toBe(true);
    expect(isBlocked('oi quero saber sobre voces', ZAPPIQ)).toBe(false);
  });

  it('isBlocked respeita a org (política nossa não vale pro cliente)', () => {
    expect(isBlocked('tenho casa de apostas', CLIENTE)).toBe(false);
    expect(isBlocked('sou criadora de OnlyFans', CLIENTE)).toBe(true);
  });

  it('listBlockedVerticals retorna 4 verticais', () => {
    const list = listBlockedVerticals();
    expect(list).toHaveLength(4);
    expect(list).toContain('apostas');
    expect(list).toContain('cripto-nao-regulada');
    expect(list).toContain('pornografia');
    expect(list).toContain('mlm');
  });

  it('só pornografia é compliance hoje; o resto é política nossa', () => {
    expect(BLOCKED_VERTICAL_LAYERS.pornografia).toBe('compliance');
    expect(BLOCKED_VERTICAL_LAYERS.apostas).toBe('politica-comercial-zappiq');
    expect(BLOCKED_VERTICAL_LAYERS['cripto-nao-regulada']).toBe('politica-comercial-zappiq');
    expect(BLOCKED_VERTICAL_LAYERS.mlm).toBe('politica-comercial-zappiq');
  });
});
