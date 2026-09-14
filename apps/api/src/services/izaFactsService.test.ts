/* ══════════════════════════════════════════════════════════════════════
 * izaFactsService: a seção de preços da Iza sai do catálogo, não do banco.
 * --------------------------------------------------------------------
 * Achado A229: o prompt da Iza oferecia o Scale a R$ 997 (preço de antes do
 * Pricing V4, de 27/05) e planos que já estavam descontinuados, enquanto a
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
  VOICE_ADDON_META,
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

const { prisma } = await import('@zappiq/database');
const queryRaw = prisma.$queryRawUnsafe as unknown as ReturnType<typeof vi.fn>;

const {
  renderSecaoPrecosDoPlanConfig,
  ehFatoDePrecoDePlano,
  renderBlockParaTeste,
  getIzaFactsBlock,
  invalidateIzaFactsCache,
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
  // O overage por minuto de voz também é catálogo: mora em VOICE_ADDON_META,
  // que é o mesmo planConfig.ts. Sem ele a Iza sabe o preço do pacote e não
  // sabe o que acontece quando o cliente estoura os minutos.
  for (const m of Object.values(VOICE_ADDON_META)) set.add(m.overagePerMinBrl);
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

/*
 * RODADA 2. A seção gerada só dizia "Voz nativa (outbound): a partir de
 * R$ 79,90/mês". Com a tabela de voz saindo do prompt gravado (a rodada 1
 * apagava todo valor em reais), a Iza ficava sem NENHUMA forma de cotar
 * Voice 400 a 4000, às vésperas do treinamento em que ela é a vitrine.
 * Agora o catálogo inteiro de voz sai na seção: pacote, minutos, preço
 * mensal e overage por minuto.
 */
describe('renderSecaoPrecosDoPlanConfig: catálogo de voz completo', () => {
  it('lista os seis pacotes de voz com preço e overage por minuto', () => {
    const texto = renderSecaoPrecosDoPlanConfig();

    for (const chave of Object.keys(VOICE_ADDON_META)) {
      const meta = VOICE_ADDON_META[chave];
      const preco = ADDONS[chave]?.priceMonthly;
      expect(preco, `faixa ${chave} sem preço no catálogo`).toBeTypeOf('number');

      const linha = texto
        .split('\n')
        .find((l) => l.includes(`${meta.minutesIncluded.toLocaleString('pt-BR')} min`));
      expect(linha, `faixa ${chave} não apareceu na seção`).toBeDefined();
      expect(extrairValoresEmReais(linha!)).toContain(preco);
      expect(extrairValoresEmReais(linha!)).toContain(meta.overagePerMinBrl);
    }
  });

  it('não vende mais a voz como "a partir de"', () => {
    const texto = renderSecaoPrecosDoPlanConfig();
    const linhasDeVoz = texto.split('\n').filter((l) => /voz|voice/i.test(l));

    expect(linhasDeVoz.length).toBeGreaterThanOrEqual(6);
    expect(linhasDeVoz.join(' ')).not.toContain('a partir de');
  });

  it('diz onde acaba o catálogo de voz, com o teto do próprio catálogo', () => {
    const texto = renderSecaoPrecosDoPlanConfig();
    const maiorFaixa = Math.max(
      ...Object.values(VOICE_ADDON_META).map((m) => m.minutesIncluded),
    );

    expect(texto).toContain(`${maiorFaixa.toLocaleString('pt-BR')} minutos`);
    expect(texto.toLowerCase()).toContain('enterprise');
  });
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

  /*
   * O Radar 360 Pro já vem dentro de alguns planos. Dizer só "contrata no
   * Growth, Scale, Enterprise" faria a Iza oferecer a venda de algo que o
   * cliente do Enterprise já tem. O dado está no `planConfig` em duas formas
   * (`ADDONS.RADAR_360.includedIn` e `features.radar360`), e elas divergem,
   * então o código usa a união: nunca vender o que já está incluído.
   */
  it('diz que o Radar já vem incluído nos planos que o trazem, em vez de mandar contratar', () => {
    const texto = renderSecaoPrecosDoPlanConfig();
    const linha = texto.split('\n').find((l) => l.includes('Radar'));

    expect(linha).toBeDefined();
    const inclusos = listActivePlans().filter(
      (p) => p.features.radar360 || ADDONS.RADAR_360.includedIn.includes(p.id),
    );
    expect(inclusos.length).toBeGreaterThan(0);

    expect(linha).toContain('já incluído');
    for (const p of inclusos) {
      expect(linha).toContain(p.name);
      // O plano que já tem o add-on não pode aparecer como "contrata no".
      expect(linha!.split('já incluído')[0]).not.toContain(p.name);
    }
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

/*
 * O aviso "estes são os ÚNICOS preços que você pode dizer" brigava com a
 * subseção "Outros fatos de preço (banco)", logo abaixo dele, onde a tarifa da
 * Meta de 01/10 vai entrar. A Iza receberia a ordem de não dizer o preço que a
 * seção seguinte manda dizer.
 */
describe('o aviso de exclusividade não briga com "Outros fatos de preço"', () => {
  it('a exclusividade é de preço de PLANO e de ADD-ON, não de todo preço', () => {
    const texto = renderSecaoPrecosDoPlanConfig();

    expect(texto).toContain('ÚNICOS preços de PLANO e de ADD-ON');
    expect(texto).not.toContain('ÚNICOS preços que você pode dizer');
  });

  it('aponta explicitamente para a subseção onde a tarifa da Meta aparece', () => {
    const texto = renderSecaoPrecosDoPlanConfig();

    expect(texto).toContain('Outros fatos de preço');
    expect(texto.toLowerCase()).toContain('tarifa do whatsapp');
  });

  it('a subseção citada é a mesma que o renderBlock cria para o fato do banco', () => {
    const bloco = renderBlockParaTeste([
      fato({ section: 'pricing', fact_key: 'meta_tarifa_outubro', label: 'Tarifa da Meta',
        description: 'A Meta cobra por resposta a partir de 01/10, a custo. Referência R$ 0,035.' }),
    ]);

    expect(bloco).toContain('### Outros fatos de preço (banco)');
    expect(bloco).toContain('Tarifa da Meta');
    expect(bloco).toContain('Outros preços');
    expect(bloco.indexOf('Outros preços')).toBeLessThan(bloco.indexOf('### Outros fatos de preço'));
  });
});

/*
 * A heurística antiga derrubava o fato assim que ele tivesse um "R$" em
 * qualquer lugar E um nome de plano em qualquer outro lugar, por mais longe
 * que estivessem. Fato legítimo que só ENCOSTA num nome de plano caía junto.
 */
describe('ehFatoDePrecoDePlano exige o plano PERTO do valor', () => {
  it('não derruba o fair use, onde o plano está longe do valor', () => {
    expect(
      ehFatoDePrecoDePlano(
        fato({
          section: 'pricing',
          fact_key: 'fair_use',
          label: 'Fair use por atendimento',
          description:
            'No Growth o fair use é de 12 respostas de IA por atendimento; acima disso a tarifa da Meta entra a custo, hoje R$ 0,035 por resposta.',
        }),
      ),
    ).toBe(false);
  });

  it('não derruba a garantia, onde o plano está longe do valor', () => {
    expect(
      ehFatoDePrecoDePlano(
        fato({
          section: 'pricing',
          fact_key: 'garantia_60_dias',
          label: 'Garantia de 60 dias',
          description:
            'O Lite tem garantia: se o cliente cancelar em até 60 dias por qualquer motivo, devolvemos a mensalidade paga, R$ 247.',
        }),
      ),
    ).toBe(false);
  });

  it('continua derrubando a tabela de planos, onde o valor encosta no plano', () => {
    expect(
      ehFatoDePrecoDePlano(
        fato({ section: 'pricing', fact_key: 'planos_tabela', label: 'Planos',
          description: 'Starter R$ 197, Growth R$ 497.' }),
      ),
    ).toBe(true);

    // Sem a chave reservada, a proximidade sozinha tem de derrubar.
    expect(
      ehFatoDePrecoDePlano(
        fato({ section: 'pricing', fact_key: 'tabela_2026', label: 'Tabela',
          description: 'Starter R$ 197, Growth R$ 497.' }),
      ),
    ).toBe(true);
  });
});

/*
 * Achado da revisão: no `catch`, o serviço devolvia string vazia quando o
 * cache estava frio. Banco fora do ar e a Iza ficava SEM a seção de preços,
 * que não depende do banco para nada: ela é gerada do catálogo.
 */
describe('getIzaFactsBlock com o banco fora do ar', () => {
  beforeEach(() => {
    invalidateIzaFactsCache();
    queryRaw.mockReset();
  });

  it('devolve o bloco do catálogo mesmo com o cache frio', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const bloco = await getIzaFactsBlock();

    expect(bloco).toContain('### Planos ativos');
    expect(bloco).toContain(PLAN_CONFIG.SCALE.name);
    expect(extrairValoresEmReais(bloco)).toContain(PLAN_CONFIG.SCALE.priceMonthly);
    expect(warn).toHaveBeenCalled();
  });

  it('prefere o último bloco bom quando o cache está quente', async () => {
    queryRaw.mockResolvedValueOnce([
      fato({ section: 'canais', fact_key: 'instagram', label: 'Instagram Direct' }),
    ]);
    const bom = await getIzaFactsBlock();
    expect(bom).toContain('Instagram Direct');

    // O TTL é de 60s. Adiantando o relógio, o cache vence e o serviço volta
    // ao banco, que agora falha: o último bloco bom tem de sobreviver.
    const relogio = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const depois = await getIzaFactsBlock();
    relogio.mockRestore();

    expect(depois).toBe(bom);
  });
});
