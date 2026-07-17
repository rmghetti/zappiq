/* ══════════════════════════════════════════════════════════════════════
 * TRAVA ANTI-ESQUECIMENTO — produto novo nasce com cupom.
 * --------------------------------------------------------------------
 * Pedido do Rodrigo (16/07/2026): "sempre que for criado um novo produto,
 * plano ou addon pago separadamente, já seja criado o campo de cupom de
 * desconto no checkout e também na página de cupom a opção deste produto".
 *
 * "Alguém lembra de N lugares" não é garantia — é uma aposta. E ela JÁ FOI
 * PERDIDA: o Mira tinha Product/Price LIVE no Stripe e checkout próprio
 * desde 13/07, mas nunca foi registrado em ADDONS_V4_LIST. O catálogo de
 * cupons cruza os dois registries, então o Mira sumia do dropdown do admin
 * EM SILÊNCIO — sem erro, sem log, sem ninguém perceber por 3 dias.
 *
 * Estes testes são a trava: quem registrar produto novo no Stripe e esquecer
 * o resto quebra o CI aqui, com a mensagem dizendo exatamente o que falta.
 * Mesmo padrão do gate `Validate iza_facts impact` que já existe no repo.
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import { ADDONS_V4_STRIPE } from './addonStripeIds';
import { ADDONS_V4_LIST } from './planConfig.js';
import { STRIPE_V4_PRICES } from './planStripeIds';
import { listCouponableProducts } from './couponCatalog';

describe('invariante: produto com Stripe está no catálogo comercial', () => {
  it('todo Product do Stripe é alcançável a partir de ADDONS_V4_LIST', () => {
    // ATENÇÃO — os dois registries usam DUAS convenções de chave, e é essa
    // ambiguidade que deixou o Mira passar:
    //   • por FAMÍLIA: AI_MSG / BROADCAST são UM Product com vários preços
    //     (os SKUs AI_MSG_PACK_5K etc. apontam pra ele via `family`);
    //   • por PRODUTO: IMPULSO_* / MIRA_* / AGENT_SEAT são 1:1 com a `key`.
    // Um Product é legítimo se alguma entrada do catálogo o alcança por
    // QUALQUER uma das duas. Órfão = ninguém no comercial sabe que ele existe.
    const porKey = new Set(ADDONS_V4_LIST.map((a) => a.key));
    const porFamilia = new Set(ADDONS_V4_LIST.map((a) => a.family));
    const orfaos = Object.entries(ADDONS_V4_STRIPE as Record<string, { productId?: string }>)
      .filter(([, cfg]) => typeof cfg.productId === 'string' && cfg.productId.startsWith('prod_'))
      .map(([key]) => key)
      .filter((key) => !porKey.has(key) && !porFamilia.has(key as never));

    expect(
      orfaos,
      `Product no Stripe que NINGUÉM alcança em ADDONS_V4_LIST (planConfig.ts): ${orfaos.join(', ')}.\n` +
        'Consequência: some do dropdown de cupons em silêncio — foi exatamente o que\n' +
        'aconteceu com o Mira (Product LIVE + checkout próprio, e cupom impossível).\n' +
        'Registre em ADDONS_V4_LIST (1:1 pela key, ou um SKU apontando pela family).',
    ).toEqual([]);
  });

  it('todo plano vendável no Stripe tem rótulo e vira produto cupomável', () => {
    const cupomaveis = new Set(listCouponableProducts().map((p) => p.key));
    const faltando = Object.keys(STRIPE_V4_PRICES).filter((k) => !cupomaveis.has(k));
    expect(
      faltando,
      `Plano com Price no Stripe que não aparece no catálogo de cupons: ${faltando.join(', ')}`,
    ).toEqual([]);
  });
});

describe('invariante: quem é vendável recebe cupom', () => {
  it('toda família de produto pago vendável aparece no catálogo de cupons', () => {
    // As 3 famílias que hoje têm checkout próprio ou entram no do plano.
    const cupomaveis = listCouponableProducts();
    const familias = new Set(cupomaveis.map((p) => p.family).filter(Boolean));

    expect(familias.has('IMPULSO'), 'Zap Impulso sumiu do catálogo de cupons').toBe(true);
    expect(familias.has('MIRA'), 'Mira Prospects sumiu do catálogo de cupons').toBe(true);
  });

  it('as 3 faixas do Mira E o pacote avulso recebem cupom', () => {
    const keys = new Set(listCouponableProducts().map((p) => p.key));
    for (const k of ['MIRA_ESSENCIAL', 'MIRA_PRO', 'MIRA_SCALE', 'MIRA_PACKS']) {
      expect(keys.has(k), `${k} deveria aceitar cupom (decisão: todo produto pago aceita)`).toBe(true);
    }
  });

  it('todo produto cupomável aponta pra um Product real do Stripe (prod_…)', () => {
    // Cupom é escopado por applies_to.products; productId torto = cupom que
    // não aplica em nada, e o admin só descobre com o cliente na linha.
    for (const p of listCouponableProducts()) {
      expect(p.productId, `${p.key} sem productId`).toBeTruthy();
      expect(p.productId.startsWith('prod_'), `${p.key}: productId "${p.productId}" não é um Product do Stripe`).toBe(true);
    }
  });

  it('não existe produto cupomável duplicado por productId', () => {
    // Dois produtos no mesmo Product do Stripe fariam o cupom de um valer no
    // outro sem ninguém pedir.
    const vistos = new Map<string, string>();
    for (const p of listCouponableProducts()) {
      const antes = vistos.get(p.productId);
      expect(antes, `${p.key} e ${antes} compartilham o productId ${p.productId}`).toBeUndefined();
      vistos.set(p.productId, p.key);
    }
  });
});

describe('invariante: o que NÃO tem carrinho fica fora', () => {
  it('overage unitário não entra (não há checkout onde aplicar)', () => {
    const keys = new Set(listCouponableProducts().map((p) => p.key));
    const overage = ADDONS_V4_LIST.filter((a) => a.pricingMode === 'overage_unit');
    for (const a of overage) {
      expect(keys.has(a.key), `${a.key} é overage_unit e não deveria aceitar cupom`).toBe(false);
    }
  });
});
