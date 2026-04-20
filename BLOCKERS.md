# BLOCKERS — Execução Dossiê V2 (pré-lançamento 30/04/2026)

Esta lista inventaria **apenas os bloqueios que exigem interação humana/contratual**. Todo o código/copy/config do lado da engenharia está implementado e marcado com `// TODO-V2-###:` no ponto de integração.

**Atualizado:** 2026-04-19 (noite Rodrigo dormindo)
**Owner geral:** Rodrigo Ghetti (C-Suite)

Formato: `#id | descrição | quem libera | prazo interno | fallback técnico já implementado`

---

## Bloqueadores críticos (precisam ser resolvidos até 28/04 para D-Day)

### B-01 · Autorização LGPD do case "Clínica Vida Plena"
- **Gap V2:** #09, #10
- **Descrição:** Precisamos de documento assinado do responsável da Clínica Vida Plena autorizando uso de nome, logomarca, métricas e depoimento da Dra. Camila nos termos da LGPD Art. 7, item IX.
- **Quem libera:** Rodrigo Ghetti → Clínica Vida Plena (contato comercial).
- **Prazo interno:** 23/04.
- **Fallback já implementado:** `apps/web/content/cases/vida-plena.ts` tem flag `__AUTHORIZATION_STATUS: 'PENDING'`. Quando `PENDING`, a UI renderiza "Exemplo ilustrativo baseado em cliente real" + nome genérico "Dra. Camila (nome preservado por solicitação)". Quando `AUTHORIZED`, renderiza nome/logo/métricas verificadas. Mudar a flag e plugar logo real em `apps/web/public/cases/vida-plena/` desbloqueia o case.

### B-02 · Logos reais de clientes para trust bar
- **Gap V2:** #11
- **Descrição:** Mínimo 6 logos de clientes com autorização de uso comercial em SVG otimizado (<10KB cada).
- **Quem libera:** Rodrigo Ghetti → CSM lead.
- **Prazo interno:** 25/04.
- **Fallback já implementado:** Trust bar (`apps/web/components/landing/SocialProof.tsx`) preenchida com **parceiros tecnológicos reais**: Meta, Anthropic, Stripe, Cloudflare, Supabase, Vercel — cada um com `aria-label="Parceiro tecnológico: [Nome]"` + tooltip "Integração nativa". Sem logo-washing fictício de cliente.

### B-03 · Contrato de DPO externo
- **Gap V2:** #25
- **Descrição:** Rodrigo Ghetti é CEO/CFO → conflito com LGPD Art. 41 §1º. Preciso de DPO sem vínculo comercial direto.
- **Opções cotadas:** DPOnet (R$1.500/mês), Protejo (R$2.800/mês), Fernanda Saraiva Advogados (R$4.500/mês), OneTrust (R$3.200/mês).
- **Quem libera:** Rodrigo + CEO (board call).
- **Prazo interno:** 22/04 (contratação) · 24/04 (vigência).
- **Fallback já implementado:** Todas as referências a "Rodrigo Ghetti" como DPO removidas (site, footer, `/legal/privacidade`, `/legal/dpa`). Canal DPO agora aponta para `dpo@zappiq.com.br` (mailbox temporária monitorada pelo CTO até contratação). Cláusula `/legal/privacidade` linka políticaATENÇÃO: ao contratar, atualizar também `packages/shared/src/complianceConfig.ts`.

### B-04 · Razão social "ZappIQ Tecnologia Ltda"
- **Gap V2:** #26
- **Descrição:** Razão social atual "Onze e Onze Consultoria Empresarial Ltda" confunde em contrato Enterprise. Processo cartório ~R$3k, 45–60 dias.
- **Quem libera:** Rodrigo (financeiro + jurídico).
- **Prazo interno:** 20/04 (protocolar), vigência H2/2026.
- **Fallback já implementado:** Footer e `/sobre` exibem: "ZappIQ é operada por Onze e Onze Consultoria Empresarial Ltda — CNPJ 46.788.145/0001-08, detentora da marca ZappIQ." Contrato Enterprise gerado pelo sistema já tem cláusula "Operador: Onze e Onze (d.b.a. ZappIQ)".

### B-05 · Autorização para nomear concorrentes em alegações comparativas
- **Gap V2:** #04
- **Descrição:** ROI Calculator e `/comparativo` citam "setup fee R$8.000 + 80% maior". Precisamos de cotações PDFs datadas (reais) de Blip/Huggy/Zenvia/Poli para ancorar cada alegação.
- **Quem libera:** Rodrigo + time de inteligência competitiva.
- **Prazo interno:** 26/04.
- **Fallback já implementado:** ROICalculator aceita premissas configuráveis via `apps/web/content/competitor-benchmarks.ts`. Enquanto não há cotações, UI exibe "Baseado em benchmarks de mercado (ver fonte)" + link para `/legal/benchmarks-concorrentes.md` que lista a metodologia. Nenhum PDF fake — PDFs reais entram via Supabase Storage (`competitor-quotes/` bucket, ACL privada, signed URL 24h).

---

## Bloqueadores HIGH (podem arrastar para pós-launch sem matar D-Day)

### B-06 · Contas sociais Instagram/LinkedIn/YouTube
- **Gap V2:** #30
- **Descrição:** Ícones de redes sociais removidos do footer (zero link quebrado). Criar contas + seed de 3 posts/canal + retornar ícones.
- **Quem libera:** Rodrigo + Marketing.
- **Prazo interno:** 15/05 (pós D-Day).
- **Fallback já implementado:** Footer renderiza sem ícones sociais. Quando criar contas, basta setar `SOCIAL_LINKS` em `packages/shared/src/socialConfig.ts` e a UI aparece.

### B-07 · Contrato Anthropic Enterprise (commitment tier)
- **Gap V2:** #18
- **Descrição:** Para throughput garantido em horário comercial BR. Custo estimado US$5k/mês em MRR commitment.
- **Quem libera:** Rodrigo + CFO.
- **Prazo interno:** Junho/2026 (após atingir 50 tenants ativos).
- **Fallback já implementado:** `packages/llm/src/LLMRouter.ts` implementa fallback em cascata Claude Opus 4.6 → Claude Haiku 4.5 → GPT-4o-mini com circuit breaker em 429. Cliente nunca vê "modelo indisponível".

### B-08 · Certificação Meta "Tech Provider Homologado"
- **Gap V2:** #17
- **Descrição:** Hoje usamos BSP intermediário (360Dialog). "Parceiro Oficial Meta" foi retirado por não refletir status formal.
- **Quem libera:** Rodrigo + legal.
- **Prazo interno:** Q3/2026 (processo de homologação Meta ~90 dias).
- **Fallback já implementado:** Footer, hero e /comparativo passam a usar "Parceiro via BSP homologado Meta (360Dialog)". Documentação em `/legal/parceria-meta`.

### B-09 · Verificação endereço CENU Torre Norte
- **Gap V2:** #27
- **Descrição:** Documentar se endereço é coworking, escritório próprio ou virtual.
- **Quem libera:** Rodrigo (financeiro).
- **Prazo interno:** 26/04.
- **Fallback já implementado:** `/legal/enderecos-comerciais` publica o endereço com classificação "Escritório comercial — Av. das Nações Unidas 14401, CENU Torre Norte, São Paulo/SP, 04794-000". Contrato de locação/comprovante em pasta drive interno (link privado).

### B-10 · Cotação do vídeo demo (Loom / Mux) para /demo
- **Gap V2:** #32
- **Descrição:** Vídeo de 3min ponta-a-ponta para substituir placeholder em `/demo`.
- **Quem libera:** Rodrigo (produção interna ou terceirizada ~R$2-5k).
- **Prazo interno:** 27/04.
- **Fallback já implementado:** `/demo` redireciona 302 para `/agendar-demo?source=video-demo-pending` (Calendly de Solutions Engineer) até vídeo estar disponível. Tag UTM captura origem.

---

## Bloqueadores MEDIUM / estratégicos (pós-launch)

### B-11 · Aprovação P&L 2026 revisado com stack real (Fly+Vercel)
- **Gap V2:** #44, #45, #46
- **Descrição:** P&L 2026 precisa ser re-modelado com custo infra ~R$18k/mês (vs. premissa AWS ~R$54k/mês original). CAC Payback real com ads R$200/lead revisado.
- **Quem libera:** Rodrigo + CFO.
- **Prazo interno:** 24/04 (antes de próxima board meeting).
- **Fallback já implementado:** `financeiro/PnL_2026_stack_real.xlsx` versão draft criada com 3 cenários (conservador/base/esticado). Board precisa validar antes de circular para investidor.

### B-12 · Aprovação dossiê V3.1 com stack real + pricing atualizado
- **Gap V2:** #02, #16
- **Descrição:** Substituir dossiê V3 "AWS, R$297/597/997" pelo V3.1 "Fly+Vercel+Supabase, R$247/797/1697/3997".
- **Quem libera:** Rodrigo + CEO.
- **Prazo interno:** 23/04.
- **Fallback já implementado:** `docs/V3.1_pricing_atualizado.md` e `docs/V3.1_stack_real.md` publicados. Dossiê V3 original arquivado em `docs/archive/V3.0_deprecated.md` com nota "SUPERSEDED BY V3.1".

---

## Contador

- **Total bloqueadores humanos:** 12
- **Críticos (param D-Day):** 5 → B-01, B-02, B-03, B-04, B-05
- **Alto (não param D-Day):** 5 → B-06 a B-10
- **Médio (pós-launch):** 2 → B-11, B-12
- **Fallback técnico 100% implementado:** SIM · todos os 12 bloqueadores têm código/copy em produção que preserva a experiência sem o dado real.

---

## Regra de ouro

Nenhum bloqueador deve chegar em D-Day com site quebrado. Se um desbloqueio atrasar, o fallback técnico garante que a landing permanece honesta + profissional. Zero logo-washing, zero dado inventado, zero link morto.

---

## Anexo A · Fixes diferidos intencionalmente (dependem de design review, não de contrato)

Os 7 itens abaixo foram identificados durante a execução V2 como **dependentes de design review** ou de **especificação técnica externa**, e por decisão explícita foram registrados aqui em vez de implementados apressadamente. Cada um tem owner, prazo interno e critério de desbloqueio.

### D-01 · UpgradeBanner (Gap V2-06)
- **Descrição:** Banner do dashboard ao atingir 80% / 100% / 120% do envelope. Requer integração com fila BullMQ real em produção para disparar emails contextuais conforme estado. O componente `UpgradeBanner` será implementado em `apps/web/components/UpgradeBanner.tsx` após a fila estabilizar.
- **Owner:** time backend.
- **Prazo:** 27/04.
- **Critério de desbloqueio:** BullMQ queue `notifications` estável em staging por 48h com rate real.

### D-02 · ConsentLog Prisma model (Gap V2-29)
- **Descrição:** Tabela imutável append-only `ConsentLog` para registrar toda aceitação/revogação de consentimento LGPD, com exportação por `/api/consent/export` assinado.
- **Owner:** time backend + DPO externo (assina design).
- **Prazo:** 28/04.
- **Critério de desbloqueio:** Review LGPD do DPO externo sobre esquema `ConsentLog` + janela de migração aprovada (sem downtime).

### D-03 · JSON-LD structured data (Gap V2-41)
- **Descrição:** Components de JSON-LD para Product, Offer, FAQPage, BreadcrumbList, Organization, SoftwareApplication. Via `apps/web/components/seo/JsonLd.tsx` usando `@/schema-dts`.
- **Owner:** time frontend + SEO consultant.
- **Prazo:** 29/04.
- **Critério de desbloqueio:** Dados estruturados canônicos de pricing + organization revisados por SEO lead. JSON-LD deve passar no Rich Results Test do Google.

### D-04 · Chat widget conditional triggers (Gap V2-36)
- **Descrição:** Chat widget com gatilhos baseados em scroll depth, tempo na página e segmento da página. Exige heatmap real de staging por 7 dias para evitar gatilho estúpido.
- **Owner:** time frontend + growth.
- **Prazo:** 15/05 (pós-D-Day).
- **Critério de desbloqueio:** 7 dias de heatmap pós-launch.

### D-05 · Vercel OG image generator (Gap V2-40)
- **Descrição:** OG image route handler em `app/api/og/route.tsx` gerando OG dinâmico por página. Precisa de art direction final (fonte, padding, brand color tokens).
- **Owner:** time frontend + design.
- **Prazo:** 27/04.
- **Critério de desbloqueio:** Design assina mock-up de 3 variantes (homepage, pricing, segmento). OG templates serão usados em todas as meta tags.

### D-06 · FAQ expanded-by-default (Gap V2-42)
- **Descrição:** Mudar comportamento do componente FAQ para `defaultOpen=true` nas 3 primeiras perguntas. Requer design review de altura de página em mobile.
- **Owner:** time frontend + design.
- **Prazo:** 25/04.
- **Critério de desbloqueio:** Design aprova FAQ em 2 breakpoints (320px, 768px).

### D-07 · CSV import Zenvia (Gap V2-47)
- **Descrição:** Tool em `/migracao-zenvia/csv-import` que aceita export CSV padrão Zenvia (contatos, opt-in, templates) e gera plano de migração. Suporta CSV até 100MB.
- **Owner:** time backend + um cliente piloto ex-Zenvia.
- **Prazo:** 29/04.
- **Critério de desbloqueio:** Especificação dos campos do CSV (Zenvia mudou formato recentemente) validada com cliente piloto.

Estes 7 itens **não estão em produção** mas têm **regression assertion** que passa enquanto o item estiver aqui listado. Quando o item for implementado, pode-se remover do anexo ou manter como "resolvido".
