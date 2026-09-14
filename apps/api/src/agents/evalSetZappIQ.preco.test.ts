/**
 * evalSetZappIQ.preco.test.ts
 * ============================================================================
 * Achado A229: a Qualidade da Iza dava 91% enquanto o prompt oferecia o Scale
 * a R$ 997 (preço morto desde 27/05) e planos descontinuados. A nota não via o
 * erro porque NENHUM cenário conferia preço de plano, e os que falavam de
 * preço traziam número congelado no texto ("Preço Starter deve ser R$ 197"),
 * de um plano que já não existe.
 *
 * Este arquivo trava as duas pontas:
 *   1. nenhum valor em reais escrito à mão nos cenários da Iza, tudo derivado
 *      do `planConfig` em runtime;
 *   2. plano descontinuado não aparece em cenário nenhum;
 *   3. existe cenário que cobra o preço de cada plano ativo com preço.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  PLAN_CONFIG,
  ADDONS,
  ADDONS_V4_LIST,
  listActivePlans,
  listLegacyPlans,
  planAnnualMonthlyEquivalent,
} from '@zappiq/shared';
import { ZAPPIQ_EVAL_SET } from './evalSetZappIQ.js';
import type { TenantAgentProfile } from './tenantAgentProfile.js';
import type { EvalScenario } from './evalScenarioTypes.js';

const IZA: TenantAgentProfile = {
  organizationId: 'org-zappiq-de-teste',
  isZappIQ: true,
  agentName: 'Iza',
  businessName: 'ZappIQ',
  niche: 'servicos_b2b',
  tone: 'friendly',
  siteUrl: 'zappiq.com.br',
  servicos: null,
  precos: null,
  descontoMaximo: null,
  regrasComerciais: null,
  temSiteUrl: true,
  temServicos: false,
  temPrecos: false,
  identityDrift: false,
  systemPrompt: 'Você é a Iza da ZappIQ.',
  agentId: 'agente-de-teste',
};

const CENARIOS: EvalScenario[] = ZAPPIQ_EVAL_SET.map((f) => f(IZA)).filter(
  (s): s is EvalScenario => s !== null,
);

/** Todo texto do cenário que o agente, o juiz ou a regex enxergam. */
function textoDoCenario(s: EvalScenario): string {
  return [
    s.description,
    s.userMessage,
    s.expectedBehavior,
    ...(s.history ?? []).map((h) => h.content),
    ...(s.passPatterns ?? []).map((p) => p.source),
    ...(s.failPatterns ?? []).map((p) => p.source),
  ].join('\n');
}

/**
 * Valores em reais que o catálogo autoriza a Iza a dizer. Plano
 * DESCONTINUADO fica de fora de propósito: R$ 1.997 do Business morto não
 * pode voltar a aparecer num cenário.
 */
function valoresAutorizados(): Set<number> {
  const set = new Set<number>();
  for (const p of listActivePlans()) {
    if (p.priceMonthly !== null) set.add(p.priceMonthly);
    const anual = planAnnualMonthlyEquivalent(p);
    if (anual !== null) set.add(anual);
  }
  for (const a of Object.values(ADDONS)) if (a.priceMonthly !== null) set.add(a.priceMonthly);
  for (const a of ADDONS_V4_LIST) set.add(a.amountBrl);
  return set;
}

/**
 * Valores em reais do texto do cenário, inclusive os que estão escritos
 * dentro de uma RegExp (`R\$\s*(?!1\.?497\b)[0-9]` conta como 1.497).
 * Por isso a fonte da regex é normalizada antes de procurar o número.
 */
function valoresEmReais(texto: string): number[] {
  const limpo = texto
    .replace(/\(\?[!:=]/g, '')
    .replace(/\\b/g, '')
    .replace(/\[,\.\]/g, ',')
    .replace(/\\s\*/g, ' ')
    .replace(/\\/g, '')
    .replace(/\?/g, '');

  const achados: number[] = [];
  const re = /R\$\s*([0-9][0-9.]*(?:,[0-9]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(limpo)) !== null) {
    const n = Number(m[1].replace(/\.(?=\d{3})/g, '').replace(',', '.'));
    if (Number.isFinite(n)) achados.push(n);
  }
  return achados;
}

describe('cenários de preço da Iza', () => {
  it('nenhum valor em reais escrito à mão: todo número vem do planConfig', () => {
    const autorizados = valoresAutorizados();
    const forasteiros: string[] = [];

    for (const s of CENARIOS) {
      for (const v of valoresEmReais(textoDoCenario(s))) {
        if (!autorizados.has(v)) forasteiros.push(`${s.id}: R$ ${v}`);
      }
    }

    expect(forasteiros).toEqual([]);
  });

  it('plano descontinuado não aparece em cenário nenhum', () => {
    const mortos = listLegacyPlans().map((p) => p.name.split(' ')[0]);
    expect(mortos.length).toBeGreaterThan(0);

    const vazamentos: string[] = [];
    for (const s of CENARIOS) {
      const texto = textoDoCenario(s);
      for (const nome of mortos) {
        if (new RegExp(`\\b${nome}\\b`, 'i').test(texto)) {
          vazamentos.push(`${s.id} cita "${nome}"`);
        }
      }
    }

    expect(vazamentos).toEqual([]);
  });

  it('existe cenário que cobra o preço de cada plano ativo com preço', () => {
    const comPreco = listActivePlans().filter((p) => p.priceMonthly !== null);
    expect(comPreco.length).toBeGreaterThan(1);

    for (const p of comPreco) {
      const cenario = CENARIOS.find(
        (s) => s.category === 'cr7_integrity' && s.id.includes('preco') && s.userMessage.toLowerCase().includes(p.name.toLowerCase()),
      );
      expect(cenario, `faltou cenário de preço para o plano ${p.name}`).toBeDefined();
      expect(cenario!.passPatterns ?? []).not.toHaveLength(0);
      expect(valoresEmReais(textoDoCenario(cenario!))).toContain(p.priceMonthly);
    }
  });

  it('o cenário de preço reprova quando a Iza responde o preço velho', () => {
    const scale = CENARIOS.find((s) => s.id === 'zappiq_preco_SCALE_correto');
    expect(scale).toBeDefined();

    const respostaCerta = 'O Scale sai por R$ 1.497/mês com 80.000 mensagens.';
    const respostaVelha = 'O Scale sai por R$ 997/mês.';

    expect(scale!.passPatterns!.some((p) => p.test(respostaCerta))).toBe(true);
    expect(scale!.passPatterns!.some((p) => p.test(respostaVelha))).toBe(false);
    expect(scale!.failPatterns!.some((p) => p.test(respostaVelha))).toBe(true);
  });

  it('o cenário de desconto anual usa o percentual do catálogo', () => {
    const s = CENARIOS.find((c) => c.id === 'zappiq_desconto_plano_anual');
    expect(s).toBeDefined();
    expect(s!.expectedBehavior).toContain(`${PLAN_CONFIG.GROWTH.annualDiscountPercent}%`);
  });

  it('o cenário do pacote de voz usa o preço de entrada do catálogo', () => {
    const s = CENARIOS.find((c) => c.id === 'zappiq_voice_preco_correto');
    expect(s).toBeDefined();
    expect(valoresEmReais(textoDoCenario(s!))).toContain(ADDONS.VOICE_200.priceMonthly);
  });
});
