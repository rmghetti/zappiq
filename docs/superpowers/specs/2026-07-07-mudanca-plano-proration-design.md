# Mudança de plano com proration (upgrade/downgrade, mensal/anual)

Data: 2026-07-07
Autor: Rodrigo Ghetti + Claude
Status: aprovado (brainstorming), pronto para plano de implementação

## Problema

Hoje `/billing` cria um **novo Checkout** para qualquer plano escolhido. Para um cliente
que já tem assinatura ativa, isso criaria uma **segunda assinatura Stripe em paralelo**
(achado #1 da rodada de trial). Não existe fluxo de troca de plano: nem upgrade com
cobrança da diferença, nem downgrade controlado, nem trava de downgrade no anual.

## Objetivo

Permitir que um cliente pagante troque de plano por self-service, seguindo as melhores
práticas de mercado (Notion/Slack/Linear/HubSpot):

- **Upgrade** (mensal ou anual): vale imediato, cobra a diferença proporcional, mantém a
  data de renovação (no mesmo ciclo).
- **Downgrade mensal**: vale na virada do ciclo, sem reembolso.
- **Downgrade anual**: bloqueado no meio do contrato; só pode ser **agendado para a
  data de renovação**.
- Sempre mostrar a conta antes de confirmar (prévia da proration).

Clientes em **trial / sem assinatura** (ex.: MACHIA hoje) NÃO são afetados: continuam no
fluxo de checkout existente, intocado.

## Decisões de política (travadas com o Rodrigo)

1. Downgrade mensal → **na virada do ciclo** (sem reembolso, sem crédito residual).
2. Downgrade anual → **bloquear no meio do contrato; permitir agendar para a renovação**.
3. Upgrade → cobrar **diferença proporcional** e **manter o ciclo/renovação atual**.

## Regra central: `classifyPlanChange`

Função pura em `apps/api/src/services/planChange.util.ts` (espelhada no shared se o front
precisar). Entrada: `atual = {plan, cycle}`, `alvo = {plan, cycle}`. Ranking de tier:
`IZA_LITE(1) < GROWTH(2) < SCALE(3) < ENTERPRISE(4)`.

Saída: `{ kind, effectiveTiming }` onde `kind ∈`:

| De → Para | kind | timing |
|---|---|---|
| Mesmo plano + mesmo ciclo | `noop` | — |
| Alvo Enterprise (tier 4) | `contact_sales` | — |
| Tier alvo > tier atual | `upgrade` | `immediate` |
| Mesmo tier, mensal → anual | `upgrade` | `immediate` |
| Tier alvo < tier atual, cliente **mensal** | `downgrade` | `period_end` |
| Tier alvo < tier atual **OU** anual→mensal, cliente **anual** | `downgrade_annual_locked` | `renewal` |

Regras de desempate:
- O **tier** é o eixo dominante. Subir de tier é sempre `upgrade`, mesmo trocando de ciclo.
- Para o cliente **anual**, qualquer redução (tier menor OU trocar para mensal) é
  `downgrade_annual_locked` (só agenda para `renewal`). Cliente anual só troca na hora se
  for upgrade de tier permanecendo anual.
- Mensal→anual é sempre `upgrade` (a renovação inevitavelmente passa a ser +1 ano; isso é
  inerente e esperado).

`downgrade` e `downgrade_annual_locked` têm o mesmo efeito técnico (agendar troca), mudam só
a data-alvo (`period_end` vs `renewal` — que para o anual é a mesma coisa: o fim do período
atual) e a mensagem ao usuário.

## Backend

Guardrail comum a todos: exige org com `stripeSubscriptionId` real e status ativo. Sem isso
→ **409** com `{ error: 'no_active_subscription', action: 'checkout' }` (o front manda pro
checkout). Todos escopados pela org autenticada (`req.organizationId`).

### `POST /api/billing/change/preview`
Body `{ plan, cycle }`. Roda `classifyPlanChange`. Para `upgrade`, chama
`stripe.invoices.createPreview` com o item trocado para o novo price (proration) e extrai os
valores reais. Resposta:
```
{
  kind, effectiveTiming,
  effectiveDate: ISO,        // hoje (upgrade) | fim do período/renovação (downgrade)
  chargeNowBrlCents: number, // 0 em downgrade
  nextRenewalBrlCents: number,
  newRenewalDate: ISO,
  currentPlanLabel, targetPlanLabel,
}
```
Não cobra nada — só monta o modal.

### `POST /api/billing/change`
Body `{ plan, cycle }`. Idempotente. Reclassifica no servidor (nunca confia no front):
- `upgrade` → `stripe.subscriptions.update(subId, { items:[{ id: itemId, price }], proration_behavior:'always_invoice', payment_behavior:'error_if_incomplete' })`. O webhook
  `customer.subscription.updated` (já existente) sincroniza plano/ciclo/MRR na org.
- `downgrade` / `downgrade_annual_locked` → cria/atualiza um **Subscription Schedule** a
  partir da assinatura com 2 fases: preço atual até `current_period_end`, depois o preço
  novo. Grava `pendingPlanChange` na org. Nenhuma cobrança agora.
- `contact_sales` → 422 `{ error:'contact_sales' }` (o front usa mailto).

### `DELETE /api/billing/change/scheduled`
`stripe.subscriptionSchedules.release(scheduleId)` e limpa `pendingPlanChange`. Idempotente
(sem agendamento → 200 no-op).

### Persistência nova
Coluna aditiva nullable `organizations.pendingPlanChange Json?` = `{ plan, cycle, effectiveAt }`.
Escrita ao agendar; **limpa** quando (a) o webhook aplica a fase 2 (o `subscription.updated`
com o novo price bate com o pending → limpa) ou (b) o cliente cancela. Migração aditiva
hand-authored (o `.env` do worktree aponta pra prod — nunca `migrate dev`).

O `pendingPlanChange` é exposto no `GET /api/auth/me` (mesmo lugar do `paywall`) para a faixa
do dash.

## Frontend (`/billing` + dashboard)

### Cards de plano (org pagante)
Cada card calcula `classifyPlanChange(atual, { plan, cycle: cicloDoToggle })` e o CTA vira:
- `noop` → "Plano atual" (desabilitado)
- `upgrade` → **"Fazer upgrade"** → abre modal
- `downgrade` → **"Agendar downgrade"** → modal
- `downgrade_annual_locked` → **"Agendar para a renovação"** → modal (deixa claro DD/MM)
- `contact_sales` → "Falar com vendas" (mailto founders@)

Trial/sem-assinatura mantém "Assinar {plano} agora" → checkout (comportamento atual).

### Modal de confirmação (`PlanChangeModal`)
Chama `/preview` e mostra a conta:
- upgrade: "Você paga **R$ X hoje** (proporcional aos N dias restantes) e depois
  **R$ Y** em DD/MM."
- downgrade: "Seu plano muda para **{alvo}** em **DD/MM** (sua renovação). Até lá nada muda e
  nada é cobrado." Botão confirma → `/change`. Em erro, mensagem clara (sem redirecionar pra
  tela morta).

### Faixa de agendamento (dashboard)
No `PaywallGate` (ou componente irmão), quando `org.pendingPlanChange` existir: "Troca para
**{plano}** agendada para **DD/MM**. [Cancelar troca]" → `DELETE /change/scheduled`.

## Testes
- `classifyPlanChange`: matriz completa (todos os pares plano×ciclo nos dois sentidos +
  Enterprise + noop). É onde mora a regra de negócio.
- Mapeamento preview→resposta (proration mockada → `chargeNowBrlCents/effectiveDate`).
- Guardrails: org sem `stripeSubscriptionId` → 409 `checkout`; idempotência de `/change` e do
  release.
- Regressão: fluxo de trial (MACHIA) não entra no caminho novo.

## Fora de escopo (YAGNI)
- Reembolso em dinheiro (nunca — sempre crédito ou virada).
- Downgrade anual imediato com crédito.
- Mudança de add-ons no mesmo fluxo (add-ons já têm caminho próprio).
- Autoatendimento de Enterprise (segue mailto/vendas).

## Relacionado
- `zappiq-trial-assinar-antecipado` (achado #1 = origem disto)
- `zappiq-checkout-404-fix`, `zappiq-trial-enforcement` (lifecycle/webhook)
- `zappiq-producao-quirks` (deploy main→Vercel; Fly da raiz)
