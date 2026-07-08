# Cupons de desconto por serviço (SUPERADMIN)

Data: 2026-07-08 · Status: aprovado (deep-research + decisões do CEO)

## Objetivo
Cupons de desconto gerados APENAS pelo SUPERADMIN, restritos a UM produto (plano
ou addon), de USO ÚNICO. O cliente digita o código no campo "Cupom de desconto"
do checkout e recebe o desconto só naquele produto — não vaza para outros.

## Fundamento (deep-research, docs Stripe — alta confiança)
- Modelo de 2 objetos: **Coupon** (regra) + **Promotion Code** (código digitável).
- Escopo por produto: `coupon.applies_to.products=[productId]`. A Stripe só aplica
  ao produto elegível e ignora/rejeita o código se ele não estiver no checkout —
  isolamento nativo, sem validação manual.
- Uso único: `max_redemptions=1` no coupon (teto global) + no promotion code.
- Código: `a-z A-Z 0-9 -`, único entre os ATIVOS → gerar aleatório longo + retry.
- Checkout: `allow_promotion_codes: true` (já existe) basta.
- VERIFICADO: cada plano/addon do ZappIQ já é um Product distinto (`productId`).

## Decisões (CEO)
- **Duração escolhida na geração**: dropdown once / 3m / 6m / 12m / forever
  (once→duration:'once'; N meses→duration:'repeating',duration_in_months:N;
  forever→duration:'forever').
- **Cupons legados** (ANTONELLA100 etc., sem escopo): ficam como estão por ora
  (só os NOVOS são escopados). Risco de vazamento dos legados aceito pelo CEO.

## Implementação
1. **shared/couponCatalog.ts**: `listCouponableProducts()` = planos
   (STRIPE_V4_PRICES) + addons (ADDONS_V4_STRIPE) com `{key,label,productId,type}`.
2. **api/routes/billingCoupons.util.ts** (puro, testado): `generateCouponCode`
   (charset sem ambíguos, prefixo do produto), `buildCouponCreateParams`
   (valida percent 10..100 step 10 + duração → params Stripe).
3. **api/routes/adminCoupons.ts** (`requireRole('SUPERADMIN')`):
   `GET /catalog`, `POST /` (cria coupon+promoCode, persiste, retorna code),
   `GET /` (lista com times_redeemed/status).
4. **Prisma** `DiscountCoupon` + migração aditiva.
5. **web/app/(dashboard)/admin/coupons/page.tsx** (SUPERADMIN): dropdowns
   produto+desconto+duração, código copiável, tabela de emitidos.
6. **Sidebar.tsx**: item "Cupons de Descontos" em platformItems → /admin/coupons.

## Fora de escopo
- Coupon no fluxo de troca de plano (subscriptions.update) — só checkout por ora.
- Reescopar/expirar os 5 cupons legados.
