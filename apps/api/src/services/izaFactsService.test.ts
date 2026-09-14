/* ══════════════════════════════════════════════════════════════════════
 * izaFactsService — a seção de preços da Iza sai do catálogo, não do banco.
 * --------------------------------------------------------------------
 * Achado A229: o prompt da Iza oferecia o Scale a R$ 997 (preço de antes do
 * Pricing V4, de 27/05) e planos que já estavam descontinhados, enquanto a
 * seção `pricing` de `iza_facts` tinha ZERO fatos. Duas fontes de verdade
 * para preço, e a errada era a que falava com o lead.
 *
 * A regra agora é uma só: preço da Iza vem do `planConfig`. Estes testes
 * cobram exatamente isso:
 *   1. todo valor em reais do texto renderizado existe no `planConfig`
 *      (nada digitado à mão, nada do Stripe, nada de memória);
 *   2. plano descontinuado não aparece;
 *   3. fato de preço de plano gravado no banco é IGNORADO com aviso no log,
 *      porque quem manda é o código.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PLAN_CONFIG,
  PLAN_IDS,
  ADDONS,
  ADDONS_V4_LIST,
  listActivePlans,
  listLegacyPlans,
  planAnnualMonthlyEquivalent,
} from '@zappiq/shared';

vi.mock('@zappiq/database', () => ({ prisma: { $queryRawUnsafe: vi.fn() } }));

const warn = vi.fn();
vi.mock('../utils/logger.js', () => ({
  logger: {
    warn: (...args: unknown[]) => warn(...args),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const {
  renderSecaoPrecosDoPlanConfig,
  ehFatoDePrecoDePlano,
  renderBlockParaTeste,
} = await import('./izaFactsService.js');

/** Todo valor em reais que o catálogo comercial autoriza a Iza a dizer. */
function valoresAutorizadosDoPlanConfig(): Set<number> {
  const set = new Set<number>();
  for (const id of PLAN_IDS) {
    const p = PLAN_CONFIG[id];
    if (p.priceMonthly !== null) set.add(p.priceMonthly);
    const anual = planAnnualMonthlyEquivalent(p);
    if (anual !== null) set.add(anual);
  }
  for (const a of Object.values(ADDONS)) {
    if (a.priceMonthly !== null) set.add(a.priceMonthly);
  }
  for (const a of ADDONS_V4_LIST) set.add(a.amountBrl);
  return set;
}

/** "R$ 1.497" -> 1497 · "R$ 197,60" -> 197.6 (formato pt-BR do texto). */
function extrairValoresEmReais(texto: string): number[] {
  const achados: number[] = [];
  const re = /R\$\s*([0-9][0-9.]*(?:,[0-9]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    achados.push(Number(m[1].replace(/\./g, '').replace(',', '.')));
  }
  return achados;
}

function fato(over: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    section: 'canais',
    fact_key: 'whatsapp',
    label: 'WhatsApp Business',
    status: 'live',
    description: null,
    url: null,
    order_idx: 1,
    ...over,
  } as any;
}

beforeEach(() => {
  warn.mockClear();
});

describe('renderSecaoPrecosDoPlanConfig', () => {
  it('todo valor em reais do texto existe no planConfig (zero preço digitado à mão)', () => {
    const texto = renderSecaoPrecosDoPlanConfig();
    const valores = extrairValoresEmReais(texto);
    const autorizados = valoresAutorizadosDoPlanConfig();

    expect(valores.length).toBeGreaterThan(3);
    const forasteiros = valores.filter((v) => !autorizados.has(v));
    expect(forasteiros).toEqual([]);
  });

  it('traz o preço mensal, o equivalente anual e a cota de mensagens de cada plano ativo com preço', () => {
    const texto = renderSecaoPrecosDoPlanConfig();

    for (const p of listActivePlans()) {
      expect(texto).toContain(p.name);
      if (p.priceMonthly === null) continue;
      expect(extrairValoresEmReais(texto)).toContain(p.priceMonthly);
      expect(extrairValoresEmReais(texto)).toContain(planAnnualMonthlyEquivalent(p));
      if (p.limits.aiMessagesPerMonth > 0) {
        expect(texto).toContain(p.limits.aiMessagesPerMonth.toLocaleString('pt-BR'));
      }
    }
  });

  it('plano descontinuado não aparece (nem nome, nem preço na lista de planos)', () => {
    const texto = renderSecaoPrecosDoPlanConfig();
    // Recorte da lista de planos: o preço de um add-on ativo pode coincidir
    // com o de um plano morto (Impulso Start custa os mesmos R$ 197 do
    // Starter), então o preço só é cobrado onde ele significaria "plano".
    const listaDePlanos = texto
      .split('### Planos ativos')[1]
      .split('### Add-ons públicos')[0];
    const legados = listLegacyPlans();

    expect(legados.length).toBeGreaterThan(0);
    for (const p of legados) {
      expect(texto).not.toContain(p.name);
      // 'Starter (legado)' e 'Business (legado)': o nome nu também não pode
      // sair onde significaria plano. Fora dali "Business" é o sobrenome do
      // WhatsApp Business, add-on ativo e legítimo.
      expect(listaDePlanos).not.toContain(p.name.split(' ')[0]);
      if (p.priceMonthly !== null) {
        expect(extrairValoresEmReais(listaDePlanos)).not.toContain(p.priceMonthly);
      }
    }
  });

  it('cita o desconto anual do catálogo e manda confirmar o que não estiver listado', () => {
    const texto = renderSecaoPrecosDoPlanConfig();
    const desconto = PLAN_CONFIG.GROWTH.annualDiscountPercent;

    expect(texto).toContain(`${desconto}%`);
    expect(texto.toLowerCase()).toContain('confirmar');
  });

  it('traz os add-ons públicos com o preço do catálogo', () => {
    const texto = renderSecaoPrecosDoPlanConfig();
    const valores = extrairValoresEmReais(texto);

    // Mira (menor faixa), Radar 360 Pro, Agendamento pela IA e número extra.
    expect(valores).toContain(ADDONS.RADAR_360.priceMonthly);
    expect(valores).toContain(
      ADDONS_V4_LIST.find((a) => a.key === 'SCHEDULING_AGENT')!.amountBrl,
    );
    expect(valores).toContain(
      ADDONS_V4_LIST.find((a) => a.key === 'MIRA_ESSENCIAL')!.amountBrl,
    );
    expect(valores).toContain(
      ADDONS_V4_LIST.find((a) => a.key === 'EXTRA_WA_NUMBER')!.amountBrl,
    );
  });
});

describe('ehFatoDePrecoDePlano', () => {
  it('reconhece fato da seção pricing que cita plano e valor em reais', () => {
    expect(
      ehFatoDePrecoDePlano(
        fato({ section: 'pricing', fact_key: 'scale', label: 'Scale R$ 997/mês' }),
      ),
    ).toBe(true);
  });

  it('reconhece pela descrição, não só pelo label', () => {
    expect(
      ehFatoDePrecoDePlano(
        fato({
          section: 'pricing',
          fact_key: 'planos',
          label: 'Tabela',
          description: 'O Growth sai por R$ 497 por mês.',
        }),
      ),
    ).toBe(true);
  });

  it('NÃO derruba fato de preço que não é de plano (tarifa da Meta)', () => {
    expect(
      ehFatoDePrecoDePlano(
        fato({
          section: 'pricing',
          fact_key: 'meta_tarifa_outubro',
          label: 'Tarifa da Meta a partir de 01/10',
          description: 'Referência R$ 0,035 por resposta, a custo, com medidor e teto.',
        }),
      ),
    ).toBe(false);
  });

  it('NÃO mexe em fato de outra seção', () => {
    expect(
      ehFatoDePrecoDePlano(
        fato({ section: 'features', label: 'Scale', description: 'R$ 997' }),
      ),
    ).toBe(false);
  });
});

describe('renderBlock com a seção de preços gerada', () => {
  it('ignora o fato de preço de plano do banco e avisa no log qual chave caiu', () => {
    const bloco = renderBlockParaTeste([
      fato(),
      fato({
        id: 'f2',
        section: 'pricing',
        fact_key: 'planos_tabela',
        label: 'Planos',
        description: 'Starter R$ 197, Growth R$ 497, Scale R$ 997.',
      }),
    ]);

    expect(bloco).not.toContain('R$ 997');
    expect(bloco).not.toContain('Starter');
    expect(warn).toHaveBeenCalled();
    const mensagens = warn.mock.calls.map((c) => JSON.stringify(c));
    expect(mensagens.some((m) => m.includes('planos_tabela'))).toBe(true);
  });

  it('renderiza a seção de preços mesmo sem nenhum fato ativo no banco', () => {
    const bloco = renderBlockParaTeste([]);

    expect(bloco).toContain('PRICING');
    expect(extrairValoresEmReais(bloco)).toContain(PLAN_CONFIG.SCALE.priceMonthly);
  });

  it('mantém os fatos das outras seções intactos', () => {
    const bloco = renderBlockParaTeste([
      fato({ section: 'canais', label: 'WhatsApp Business', status: 'live' }),
      fato({ id: 'f3', section: 'pricing', fact_key: 'meta_tarifa_outubro',
        label: 'Tarifa da Meta', description: 'Referência R$ 0,035 por resposta.' }),
    ]);

    expect(bloco).toContain('WhatsApp Business');
    expect(bloco).toContain('Tarifa da Meta');
  });
});
