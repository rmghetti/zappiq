# ZappIQ Impulso — Design do módulo de Campanhas (add-on premium)

*Data: 2026-07-06 · Autor: Rodrigo Ghetti + Claude · Branch: `feat/impulso-campanhas`*
*Status: design aprovado na direção; pendente revisão do spec antes do plano de implementação.*

---

## 1. Contexto e objetivo

A página `/campaigns` (rota `apps/web/app/(dashboard)/campaigns`) existe mas está crua: cria broadcast simples, enfileira o disparo em BullMQ sem worker real, sem segmentação, sem analytics de verdade. O objetivo é transformá-la num **produto de campanhas completo, vendido como add-on pago separado ("ZappIQ Impulso")**, posicionado entre as melhores ofertas do mercado.

A tese da ZappIQ é ser plataforma de **vendas** conversacional, não só atendimento. O Impulso é o motor que **impulsiona vendas de forma proativa, automática e inteligente** — a Iza como gerente de campanhas.

**Moat:** a ZappIQ é dona da conversa de venda. Klaviyo tem a compra, Meta tem o clique; só a ZappIQ tem o diálogo de intenção. É daí que nasce um produto de campanhas que não se copia de fora.

## 2. Nome e posicionamento

- **Nome comercial:** **ZappIQ Impulso** (add-on). A Iza é a inteligência que opera dentro dele.
- **Combina os três posicionamentos** (decisão do fundador): IA autônoma (estrela) + Studio de campanhas + Hub de performance/ROI.
- **Duplo público:** intuitivo para o leigo (Piloto Automático: a Iza dirige, humano aprova) e completo para o especialista (Studio: controle total, Iza como copiloto). O mesmo objeto de campanha, operado em duas altitudes.

## 3. Escopo do produto — 5 pilares

1. **Iza Estrategista (autônoma):** objetivo em linguagem natural vira campanha completa (segmento + canais + criativo na voz de marca + horário + fluxo + custo/resultado previstos). Humano aprova.
2. **Studio:** canvas de jornada (reusa **Maestro**), segmentos dinâmicos, estúdio de criativos (templates HSM, e-mail, SMS). Tudo que a Iza monta é editável.
3. **Copiloto & Coach:** sugestões proativas do que e do quanto fazer (planner meta→verba), simulador de cenário, e guardrails de saúde do número/compliance.
4. **Loop de Performance:** CTWA + Lead Ads + CAPI + conversões offline; atribuição de receita (ad→conversa→venda→reengajamento); audiências/lookalikes a partir do CRM.
5. **Auto-otimização:** multi-armed bandit (desloca volume para a variante vencedora), send-time por contato, score de propensão/churn a partir da conversa, holdout/incrementalidade.

**Controle de autonomia de 5 níveis** (0 assistivo → 4 autônomo). Padrão de entrada: **Nível 2 (Co-Piloto, a Iza propõe e o humano aprova)** — antídoto ao erro do 11x. Guardrails sempre ligados (voz de marca, opt-in, frequência, quality rating).

### 3.1 Sinergias obrigatórias com os movimentos recentes da Meta (2025-2026)

- **Handoff Business Agent → Iza:** a Meta lançou o Business Agent global (03/06/2026), grátis, que comoditiza o FAQ. O Impulso não compete nisso: o Business Agent responde FAQ, e a **Iza assume ao detectar intenção comercial** e fecha com Flows/Pix/click-to-call. Posicionamento: camada de vendas por cima do agente da Meta.
- **Motor de janela FEP 72h:** conversa aberta por anúncio Click-to-WhatsApp abre 72h onde toda mensagem é grátis (inclusive template). O Impulso detecta a janela, mostra cronômetro e a Iza corre para fechar dentro do grátis. Diferencial de custo pouco explorado.
- **Camada BSUID / WhatsApp Usernames:** a Meta migra para @usuário + Business-Scoped User IDs (mensagear/atribuir sem o número). Rollout iniciado 07/07/2026, deadline de adaptação jun/2026. O Impulso identifica contato por **BSUID** (atribuição/dedup cross-canal) e suporta @handle como canal de aquisição. **Prioridade alta por deadline.**
- **Governança de frequency cap:** a Meta limita ~2 msgs de marketing/dia por usuário somando todas as marcas (excedente falha) + opt-out obrigatório. O orquestrador prioriza a mensagem de maior valor e faz fallback para utility/CTWA.
- **CADE / custo BR:** desde 11/03/2026 a Meta cobra ~R$0,34/msg de chatbots de terceiros no BR. Entra no preço (margem vem de plataforma+IA, não da tarifa) e vira argumento de venda (independência garantida pelo regulador).
- **Flows (checkout nativo) + Calling API (click-to-call/IVR):** etapas de fechamento da Iza.
- **Discover Businesses (só BR hoje):** "WhatsApp SEO" para aquisição orgânica (Fase 2).

### 3.2 TikTok — veredito

- **V1:** TikTok **Instant Messaging Ads → WhatsApp** (leva o lead direto para a Iza usando o mesmo número WABA). Baixo esforço, fiel à tese, concorrente Kommo já faz no BR.
- **Fase 2:** TikTok **Events API** (equivalente ao CAPI) para atribuição/otimização; reaproveita a arquitetura do CAPI da Meta.
- **Fora do escopo:** automação de DM nativo (sem API pública) e TikTok Shop (produto à parte).
- **Ressalva:** homologação "Messaging Partner" do TikTok pode adicionar prazo ao V1; confirmar antes de cravar data.

## 4. Arquitetura — reusar antes de construir

O Impulso **orquestra e eleva módulos existentes**; não reinventa.

| Necessidade | Reusa | Caminho |
|---|---|---|
| Motor de jornada | **Maestro v2** (nodes/edges/timers duráveis/stats por nó) | `apps/api/src/agents/`, `apps/web/components/maestro/` |
| Envio multicanal | **channelDispatcher** (WhatsApp Cloud API, Instagram) | `apps/api/src/services/channelDispatcher.ts` |
| Templates HSM + status Meta | **templates** | `apps/api/src/routes/templates.ts`, `MessageTemplate` |
| Atribuição | `Contact.sourceCampaignId`, `Deal.sourceCampaignId`, `Activity` | `packages/database/prisma/schema.prisma` |
| Analytics/insights | **analyticsPulse** (Radar) | `apps/api/src/services/analyticsPulse.ts` |
| IA/geração/otimização | **LLMRouter** (Gemini→Sonnet→Haiku) | `apps/api/src/services/llm/LLMRouter.ts` |
| Fila/worker | **BullMQ** (`campaign-queue`) | `apps/api/src/services/queueService.ts` |
| Compliance/consentimento | **auditService** + `Contact.consentMarketing*` | `apps/api/src/services/auditService.ts` |
| Entitlement/billing | **ADDONS_V4 + Stripe Meters** (padrão do add-on Outcome) | `packages/shared/src/planConfig.ts`, `addonStripeIds.ts` |

**Decisão de arquitetura:** evoluir a rota `/campaigns` existente para o módulo Impulso (mantém a URL que o cliente já conhece) e **estender o model `Campaign`** em vez de criar um model paralelo, mais os models de suporte de jornada/otimização. "Impulso" é o entitlement + marca do módulo premium.

**Novos serviços (api):** `impulsoOrchestrator` (wrapper do executor Maestro), `impulsoDispatchWorker` (handler BullMQ com retry/DLQ), `impulsoSegmentation`, `impulsoAttribution` (ctwa_clid/BSUID → CRM), `fepWindow` (motor 72h), `capGovernor` (frequency cap + opt-in).

**Novas telas (web):** evolução de `app/(dashboard)/campaigns` com wizard "objetivo → campanha", canvas de jornada (Maestro embarcado), seletor de segmento, estúdio de criativo, dashboard de atribuição, e o painel de autonomia.

## 5. Modelo de dados (Prisma) — estender, não duplicar

- **Estender `Campaign`:** `objective` (texto NL), `channels` (json), `autonomyLevel` (0-4), `audienceSegment` (json), `journey` (json nodes/edges, à la Maestro), `budgetPlan` (json), `fepWindowState` (json), `optimizationMode` (bandit config), `status` ampliado (draft/scheduled/running/paused/completed).
- **Novos models de suporte:** `CampaignVariant` (braços do bandit + métricas), `CampaignNodeStat` (analytics por nó, à la `FlowNodeStat`), `CampaignAttribution` (ad→conversa→venda, com `ctwaClid`, `bsuid`, `metaCampaignId`, `revenue`), `CampaignConsent` (trilha LGPD por contato/campanha).
- **Migração Prisma:** GRANTs de RLS **condicionais** (produção não tem role `app_user`); RLS via middleware `tenantContext` (SET LOCAL). Validar migration aplicada no Supabase (drift histórico).

## 6. Entitlement e pricing

**Add-on `IMPULSO`** somado ao plano base (Lite/Growth/Scale), também vendável como bundle "produto separado".

| Tier | Add-on/mês (anual −20%) | Contatos ativos | Desbloqueia |
|---|---|---|---|
| Impulso Start | R$ 197 | 5.000 | Iza Estrategista + Studio + Copiloto; WhatsApp+e-mail+SMS; A/B + analytics |
| Impulso Pro ⭐ | R$ 497 | 25.000 | + Loop Meta (CTWA/Lead Ads/CAPI) + atribuição/ROAS + Pix no chat + auto-otimização (bandit) + send-time + TikTok→WhatsApp |
| Impulso Scale | R$ 997 | ilimitado | + Google Ads/offline + autopiloto nível 3 + multi-número + TikTok Events API |

- **O add-on é software** (módulo + IA + features). **Mensagens de marketing (custo Meta ~R$0,34) vão pela carteira de disparos com repasse + markup** (venda ~R$0,49; packs no padrão `BROADCAST` do `ADDONS_V4`), **não** empacotadas em franquias grandes que quebrariam a margem. Modelo idêntico ao que a ZappIQ já pratica.
- **IA de campanha inclusa** no fair use (custo de LLM ~R$0,001-0,01/geração é desprezível vs. disparo). Vira arma: WATI/AiSensy cobram créditos de IA; a ZappIQ não.
- **Opcional "Impulso Performance":** base menor + 1,5-3% sobre venda atribuída (DNA success fee da casa).
- **Margem:** assinatura ~85%, disparos ~15-35% (custo Meta/CADE), IA ~95% → blended saudável.
- **Wiring:** novo item em `ADDONS_V4_LIST` (família nova `IMPULSO` ou `recurring_monthly`), Stripe Product/Prices em `ADDONS_V4_STRIPE`, gerados por `.command` (padrão do repo: "GERADO pelo .command"). Middleware `requireAddon('IMPULSO')`. Feature flag `organization.settings.impulsoAlpha` para soft launch.

**Competitividade (all-in ZappIQ + Impulso):** Start R$444, Pro R$994, Scale R$2.494 — abaixo de Blip (R$2.499-5.990), Zenvia (R$600-3.900+setup) e RD Conversas (R$989-2.699), entregando muito mais (IA autônoma + omnichannel + loop de anúncios + Pix).

## 7. Fases

- **Fase 0 — Fundação (~2-3 sem):** models Prisma + migração; entitlement `IMPULSO` + `.command` Stripe; feature flag; worker de disparo real (fecha o gap atual); base de atribuição e telemetria.
- **Fase 1 — V1 premium (~6-9 sem):** Iza Estrategista (NL→campanha) + Studio (canvas Maestro + segmentos + criativos) + Copiloto & Coach; WhatsApp+e-mail+SMS+Instagram; Loop Meta (CTWA/Lead Ads/CAPI) + **motor FEP 72h** + **camada BSUID** + governança de cap; **TikTok→WhatsApp**; checkout Pix; dashboard de atribuição; A/B + bandit inicial + send-time. É o que lança como produto.
- **Fase 2 — Fronteira (contínuo):** Google Ads/offline; autopiloto nível 3; holdout/incrementalidade; propensão/churn; TikTok Events API; RCS; Discover Businesses; marketplace de playbooks por vertical.

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Meta comoditiza o agente (Business Agent grátis) | Subir a régua para IA de vendas + growth loop + atribuição; nunca competir no FAQ |
| Meta subir para a camada de campanha (atribuição/broadcast nativos) | Cravar diferenciação em atribuição/growth agora (janela curta) |
| Custo/dependência regulatória BR (CADE, ~R$0,34/msg terceiros) | Margem via plataforma+IA; usar CADE como argumento de independência |
| Queimar o número do cliente (disparo sem opt-in/cap) | Copiloto de compliance: quality rating, frequency cap, opt-in, LGPD como padrão |
| Autonomia total sem controle (erro 11x) | Padrão Co-Piloto; autonomia sobe em degraus com prova de resultado |
| Repo é produção (zappiq.com.br) | Branch `feat/impulso-campanhas`; nunca deploy automático; deploy é `.command` do Rodrigo |

## 9. Ações manuais do Rodrigo (viram `.command` ao final)

1. **Stripe:** criar Products/Prices do add-on Impulso (Start/Pro/Scale) + meter de disparo → gerar `addonStripeIds` (padrão existente).
2. **Meta:** configurar/permissões do app para CTWA, Lead Ads, Conversions API (CAPI), e habilitar recepção de BSUID nos webhooks; Meta Verified se aplicável.
3. **TikTok:** iniciar homologação "Messaging Partner" + app na Marketing API (Instant Messaging Ads → WhatsApp).
4. **Deploy:** `fly deploy` (API) + push `main` (web/Vercel) — commit+push obrigatório antes, conforme runbook do repo.

## 10. Métricas de sucesso

Receita atribuída à campanha (ad→conversa→venda), ROAS por campanha, taxa de fechamento dentro da janela FEP 72h, adoção do add-on (conversão para pago), quality rating preservado (sem bans), e margem blended por tier.
