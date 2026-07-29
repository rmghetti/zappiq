/**
 * evalSet.isolation.test.ts — O TESTE DO "NUNCA MAIS"
 * ============================================================================
 * Incidente de 14/07/2026 (relato do CMJ): a funcionalidade "Qualidade da IA"
 * avaliava a Vera (agente do CMJ) contra o gabarito da Iza. Evidência real,
 * extraída de produção:
 *
 *   cenário cr3_no_como_posso_ajudar → FAIL
 *   juiz: "A resposta não saúda especificamente a ZappIQ (saudou apenas 'Rod'
 *          e mencionou CMJ)"
 *   sugestão: "patch cria regra obrigatória de saudação personalizada [ZappIQ]"
 *
 * Ou seja: a Vera foi reprovada POR DIZER QUE É DO CMJ, e a plataforma queria
 * gravar no prompt dela uma regra pra saudar em nome da ZappIQ.
 *
 * Este arquivo existe pra que isso quebre o CI, não o cliente.
 *
 * Se você está lendo isto porque este teste falhou: você adicionou um cenário
 * com marca, preço ou link da ZappIQ ao gabarito UNIVERSAL. Mova-o para
 * evalSetZappIQ.ts (que só roda na org da Iza) ou parametrize-o pelo perfil
 * do tenant.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { resolveEvalSet, getSkippedScenarios, EVAL_SET_VERSION } from './agentEvalSet.js';
import { findForeignBrandLeaks } from './tenantIsolationGuard.js';
import type { TenantAgentProfile } from './tenantAgentProfile.js';

function perfil(over: Partial<TenantAgentProfile> = {}): TenantAgentProfile {
  return {
    organizationId: 'cmr4x0zmn007msdhtqn6lfkia',
    isZappIQ: false,
    agentName: 'Vera',
    businessName: 'CMJ',
    niche: 'servicos_b2b',
    tone: 'friendly',
    siteUrl: 'cmj.com.br',
    servicos: null,
    precos: null,
    descontoMaximo: null,
    regrasComerciais: null,
    temSiteUrl: true,
    temServicos: false,
    temPrecos: false,
    identityDrift: false,
    systemPrompt: 'Você é Vera, atendente virtual da CMJ.',
    agentId: 'c39b19bb-d730-42be-855a-db2c21ecab94',
    ...over,
  };
}

const CMJ = perfil();
const ZAPPIQ = perfil({
  organizationId: 'cmo1ywwfe00ko1jskexiexsm4',
  isZappIQ: true,
  agentName: 'Iza',
  businessName: 'ZappIQ',
});

/** Todo texto de um cenário que o agente ou o juiz podem ver. */
function textoDoCenario(s: any): string {
  return [
    s.id,
    s.description,
    s.userMessage,
    s.expectedBehavior,
    ...(s.history || []).map((h: any) => h.content),
    ...(s.passPatterns || []).map(String),
    ...(s.failPatterns || []).map(String),
  ].join('\n');
}

describe('gabarito do cliente NÃO pode conter marca da ZappIQ', () => {
  const cenarios = resolveEvalSet(CMJ);

  it('nenhum cenário do CMJ menciona Iza, ZappIQ ou links da ZappIQ', () => {
    const vazamentos = cenarios.flatMap((s) => {
      // cr9 é o cenário-armadilha: ele CITA a ZappIQ de propósito, na pergunta
      // do lead, pra verificar que a Vera NÃO morde a isca. É a única exceção.
      if (s.id === 'cr9_nao_assume_marca_de_terceiro') return [];
      return findForeignBrandLeaks(textoDoCenario(s), { strict: true }).map((l) => ({
        cenario: s.id,
        termo: l.term,
        trecho: l.excerpt,
      }));
    });

    expect(vazamentos).toEqual([]);
  });

  it('nenhum cenário do CMJ cobra preço, SKU ou trial da ZappIQ', () => {
    const texto = cenarios.map(textoDoCenario).join('\n');
    expect(texto).not.toMatch(/R\$\s*197/);
    expect(texto).not.toMatch(/\bVoice\s*\d{3}/i);
    expect(texto).not.toMatch(/zappiq\.com\.br\/agendar/i);
    expect(texto).not.toMatch(/14\s*dias\s*grátis/i);
  });

  it('os cenários falam do negócio do CLIENTE', () => {
    const texto = cenarios.map(textoDoCenario).join('\n');
    expect(texto).toContain('CMJ');
    expect(texto).toContain('Vera');
  });

  it('nenhum cenário exclusivo da ZappIQ escapa pro cliente', () => {
    const ids = cenarios.map((s) => s.id);
    expect(ids.filter((id) => id.startsWith('zappiq_'))).toEqual([]);
  });
});

describe('a Vera é avaliada como Vera, da CMJ', () => {
  it('o cenário de identidade exige o nome do agente do cliente', () => {
    const s = resolveEvalSet(CMJ).find((x) => x.id === 'cr3_no_consultora_virtual')!;
    expect(s.expectedBehavior).toContain('Vera');
    expect(s.expectedBehavior).toContain('CMJ');
    // O passPattern agora aprova quem se diz "Vera" (antes exigia "Iza").
    expect(s.passPatterns![0].test('Oi! Sou a Vera, da CMJ.')).toBe(true);
    expect(s.passPatterns![0].test('Oi! Sou a Iza, da ZappIQ.')).toBe(false);
  });

  it('existe cenário crítico que reprova assumir marca de terceiro', () => {
    const s = resolveEvalSet(CMJ).find((x) => x.id === 'cr9_nao_assume_marca_de_terceiro')!;
    expect(s).toBeDefined();
    expect(s.severity).toBe('critical');
    // A resposta que a plataforma QUERIA que a Vera desse agora reprova.
    const respostaContaminada = 'Sim! Sou a Iza da ZappIQ, acesse https://zappiq.com.br/cadastro';
    expect(s.failPatterns!.some((p) => p.test(respostaContaminada))).toBe(true);
    // A resposta correta passa.
    const respostaCorreta = 'Não, aqui é a Vera, da CMJ. Como posso te atender?';
    expect(s.failPatterns!.every((p) => !p.test(respostaCorreta))).toBe(true);
  });

  it('a Iza não é testada contra o cenário anti-marca (ela É a marca)', () => {
    const ids = resolveEvalSet(ZAPPIQ).map((s) => s.id);
    expect(ids).not.toContain('cr9_nao_assume_marca_de_terceiro');
    expect(ids).toContain('zappiq_identidade_iza');
  });
});

describe('não se cobra do cliente o que ele não treinou', () => {
  it('CMJ (sem tabela de preços) não recebe o cenário de preço', () => {
    const ids = resolveEvalSet(CMJ).map((s) => s.id);
    expect(ids).not.toContain('cr7_preco_da_base_correto');
  });

  it('e o dashboard explica por que o teste não rodou', () => {
    const skipped = getSkippedScenarios(CMJ);
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped[0].reason).toContain('Treinar IA');
  });

  it('cliente COM tabela de preços é avaliado com os preços dele', () => {
    const antonella = perfil({
      agentName: 'Antonella',
      businessName: 'Antonella Italian Food',
      niche: 'restaurante',
      precos: 'Rodízio de massas R$ 89 por pessoa',
      temPrecos: true,
    });
    const s = resolveEvalSet(antonella).find((x) => x.id === 'cr7_preco_da_base_correto')!;
    expect(s).toBeDefined();
    expect(s.expectedBehavior).toContain('R$ 89');
    expect(getSkippedScenarios(antonella)).toEqual([]);
  });
});

describe('a Iza continua sendo avaliada como Iza', () => {
  it('a org da ZappIQ recebe o gabarito comercial dela', () => {
    const ids = resolveEvalSet(ZAPPIQ).map((s) => s.id);
    expect(ids).toContain('zappiq_preco_starter_correto');
    expect(ids).toContain('zappiq_trial_lead_morno');
    expect(ids).toContain('zappiq_no_revela_stack');
    expect(ids).toContain('zappiq_blocked_apostas');
  });

  it('a ZappIQ tem mais cenários que o cliente (universal + próprios)', () => {
    expect(resolveEvalSet(ZAPPIQ).length).toBeGreaterThan(resolveEvalSet(CMJ).length);
  });

  it('não pede à ZappIQ que cadastre preço no survey (ela tem cenário próprio)', () => {
    expect(getSkippedScenarios(ZAPPIQ)).toEqual([]);
    expect(resolveEvalSet(ZAPPIQ).map((s) => s.id)).toContain('zappiq_preco_starter_correto');
  });

  it('todo cenário tem id único, nos dois escopos', () => {
    for (const p of [CMJ, ZAPPIQ]) {
      const ids = resolveEvalSet(p).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('clientes diferentes são isolados entre si', () => {
  // Regra do fundador (14/07/2026): "A Iza deve ser enxergada como um agente
  // apenas da ZappIQ, como se a ZappIQ fosse um cliente isolado da plataforma.
  // Todos agentes de clientes diferentes devem ser tratados de forma isolados."
  //
  // Ou seja, o isolamento não é só ZappIQ contra cliente: é cada tenant contra
  // todos os outros. O gabarito de um cliente não pode carregar nada de outro.
  const ANTONELLA = perfil({
    organizationId: 'cmpe3153b002eohhtpqxmw733',
    agentName: 'Antonella',
    businessName: 'Antonella Italian Food',
    niche: 'restaurante',
    precos: 'Rodízio de massas R$ 89 por pessoa',
    temPrecos: true,
  });

  function textoTodo(p: TenantAgentProfile): string {
    return resolveEvalSet(p).map(textoDoCenario).join('\n');
  }

  it('o teste da Vera não menciona a Antonella nem o negócio dela', () => {
    const daVera = textoTodo(CMJ);
    expect(daVera).not.toContain('Antonella');
    expect(daVera).not.toContain('Antonella Italian Food');
    expect(daVera).not.toContain('Rodízio');
    expect(daVera).not.toMatch(/R\$\s*89/);
  });

  it('o teste da Antonella não menciona o CMJ nem a Vera', () => {
    const daAntonella = textoTodo(ANTONELLA);
    expect(daAntonella).not.toMatch(/\bVera\b/);
    expect(daAntonella).not.toMatch(/\bCMJ\b/);
  });

  it('cada agente só é avaliado contra a identidade do próprio negócio', () => {
    const vera = resolveEvalSet(CMJ).find((s) => s.id === 'cr3_no_consultora_virtual')!;
    const antonella = resolveEvalSet(ANTONELLA).find((s) => s.id === 'cr3_no_consultora_virtual')!;

    // A Vera é aprovada dizendo que é a Vera, e reprovada dizendo que é a Antonella.
    expect(vera.passPatterns![0].test('Sou a Vera, da CMJ')).toBe(true);
    expect(vera.passPatterns![0].test('Sou a Antonella, do Antonella Italian Food')).toBe(false);
    // E vice-versa.
    expect(antonella.passPatterns![0].test('Sou a Antonella, do Antonella Italian Food')).toBe(true);
    expect(antonella.passPatterns![0].test('Sou a Vera, da CMJ')).toBe(false);
  });

  it('o preço de um cliente nunca é cobrado de outro', () => {
    // A Antonella tem tabela de preços; o CMJ não. O cenário de preço da
    // Antonella cita o cardápio dela, e não pode existir no teste da Vera.
    const precoAntonella = resolveEvalSet(ANTONELLA).find((s) => s.id === 'cr7_preco_da_base_correto')!;
    expect(precoAntonella.expectedBehavior).toContain('R$ 89');
    expect(resolveEvalSet(CMJ).map((s) => s.id)).not.toContain('cr7_preco_da_base_correto');
  });

  it('a ZappIQ é só mais um tenant: o comercial dela não vaza pra nenhum cliente', () => {
    for (const cliente of [CMJ, ANTONELLA]) {
      const ids = resolveEvalSet(cliente).map((s) => s.id);
      expect(ids.filter((id) => id.startsWith('zappiq_'))).toEqual([]);
    }
  });
});

describe('versionamento', () => {
  it('a versão do gabarito subiu, pra separar as runs contaminadas', () => {
    expect(EVAL_SET_VERSION).toBe('v2');
  });
});
