# ZappIQ, Folha de Fatos Canonicos (gabarito de auditoria de marketing)

Fonte de verdade: codigo em `/Users/rodrigoghetti/zappiq-main`, reextraido em 2026-07-10.
Arquivos de referencia:
- `packages/shared/src/planConfig.ts` (planos, precos, trialDays, highlight, deprecated, limites, add-ons)
- `apps/web/components/Sidebar.tsx` (nomes de produto cliente-facing)
- `apps/web/app/(dashboard)/*` (status por modulo)
- `ARCHITECTURE.md`, `CHANGELOG.md` (status de features de backend)

Regra de copy aplicada aqui: pt-BR com acentuacao completa, sem travessao (em-dash).
Marcador de celula vazia: "n/d".

---

## (a) Planos ATIVOS (preco, limites-chave, inclusos, trialDays)

Fonte unica: `PLAN_CONFIG` em `planConfig.ts`. Anual = mensal com o desconto do proprio plano.

### Lite (id IZA_LITE)
- Preco: R$ 247,00/mes. Anual: R$ 197,60/mes (desconto 20%).
- trialDays: 14 (unico plano com trial explicito no codigo; 14 dias gratis, sem cartao).
- highlight: true. premium: false. order 0.
- Limites: 1 atendente humano, 1.500 mensagens de IA/mes, 200 disparos/mes, 1.000 contatos, 3 fluxos (Maestro), 1 numero WhatsApp Business (+ 1 Instagram Direct citado no bullet), 10 docs na base RAG, 5 integracoes, retencao de logs 90 dias, 0h de integracao customizada.
- Inclusos (features): Analytics operacional (flag interna `radarInsights`), Qualidade da IA (Agent Quality/eval continuo). NAO inclui Echo Copilot, Radar 360, SSO, API aberta, white-label.
- Suporte: e-mail. CTA: "Comecar 14 dias gratis".

### Growth (id GROWTH) [mais popular]
- Preco: R$ 497,00/mes. Anual: R$ 397,60/mes (desconto 20%).
- trialDays: campo AUSENTE no codigo (undefined). O CTA diz "Comecar 14 dias gratis", mas o trial nao esta codificado como no Lite. Ver discrepancia D4.
- highlight: true (ver discrepancia D3). premium: false. order 2.
- Limites: 10 atendentes, 8.000 mensagens de IA/mes, 5.000 disparos/mes, 10.000 contatos, 15 fluxos, 2 numeros WhatsApp Business, 50 docs RAG, 15 integracoes nativas, retencao 180 dias.
- Inclusos: Echo Copilot (IA sugere para o humano), Analytics operacional, API aberta + Webhooks, 15 integracoes (HubSpot, RD, Pipedrive, Salesforce e outras). Agendamento pela IA incluido (add-on SCHEDULING_AGENT so aparece como pago no Lite).
- Suporte: chat (dias uteis). CTA: "Comecar 14 dias gratis".

### Scale (id SCALE)
- Preco: R$ 1.497,00/mes. Anual: R$ 1.197,60/mes (desconto 20%).
- trialDays: 0 (SEM trial de autoatendimento). CTA: "Falar com especialista".
- highlight: false. premium: false. order 3. Absorve o antigo Business V3.2.
- Limites: 75 atendentes, 80.000 mensagens de IA/mes, 60.000 disparos/mes, 200.000 contatos, fluxos ilimitados, 15 numeros WhatsApp, base RAG ilimitada, integracoes ilimitadas, retencao 730 dias (24 meses), 20h/mes de integracao customizada.
- Inclusos: Echo Copilot, Analytics, Radar 360 (BI avancado) incluido, SSO (SAML 2.0/OIDC) + auditoria LGPD completa, SLA contratual 99,9% com creditos automaticos, white-label, Customer Success Manager dedicado, DPO como contato direto + ROP customizado. Bullets tambem citam recursos em rollout: Memory Layer Mem0 (em rollout), Vision inbound (imagens WA/IG), Outcome Beta opt-in (Conversa Convertida).
- Suporte: prioritario.

### Enterprise (id ENTERPRISE)
- Preco: sob consulta (priceMonthly null). Baseline "a partir de R$ 9.900/mes" existe apenas em comentario de codigo, marcar [confirmar] antes de usar em copy.
- Anual: desconto 10% (NAO 20%, ver discrepancia D5).
- trialDays: sem trial. premium: true. order 5.
- Limites: tudo ilimitado, retencao de logs ate 5 anos (1825 dias), 40h/mes de integracao customizada.
- Inclusos: tudo do tier superior sem limites, infraestrutura isolada (pool dedicado), SOC/NOC dedicado 24/7, onboarding white-glove (30 dias), DPO contato direto + ROP totalmente customizado, suporte 24/7 multicanal (telefone, chat, e-mail, Slack Connect), QBR trimestral, contratos customizados (MSA, DPA).
- Suporte: multichannel-24x7. CTA: "Falar com especialista".

### Planos DEPRECATED (nunca citar como vigentes)
- Starter (id STARTER): R$ 197/mes. `deprecated: true`, descontinuado em 2026-05-27, substituido pelo Lite Trial.
- Business (id BUSINESS): R$ 1.997/mes. `deprecated: true`, descontinuado em 2026-05-27, funcionalidades absorvidas pelo Scale V4.
- Regra do codigo (`SELF_SIGNUP_PLAN_IDS`): self-signup so aceita planos nao-deprecated e com preco. Hoje resolve para [Lite, Growth, Scale].

Bandeiras de plano (verdadeiras dentro da franquia): zero setup fee; mensalidade fixa. Atencao: existe overage de ~R$ 0,03/msg de IA e passthrough Meta nos disparos, entao a copy nao pode sugerir custo marginal zero.

---

## (b) Add-ons com precos reais

ATENCAO: o codigo tem DOIS conjuntos de add-ons convivendo (ver discrepancia D1). Abaixo, os precos reais de cada um.

### b.1 Voz Nativa (nome cliente-facing) = Voice add-ons v4 (ATUAL, PR #72, 2026-05-04)
Provider Google Cloud TTS Neural2 (fallback OpenAI). 6 pacotes:
- Voice 200: R$ 79,90/mes, 200 min, overage R$ 0,35/min, trial 14 dias com 30 min gratis, teto 400 min.
- Voice 400: R$ 137,90/mes, 400 min, overage R$ 0,30/min, trial 14 dias com 30 min gratis, teto 800 min.
- Voice 600: R$ 184,90/mes, 600 min, overage R$ 0,28/min, sem trial, teto 1.200 min.
- Voice 800: R$ 224,90/mes, 800 min, overage R$ 0,25/min, sem trial, teto 1.600 min.
- Voice 1.500: R$ 379,90/mes, 1.500 min, overage R$ 0,22/min, sem trial, teto 3.000 min.
- Voice 4.000: R$ 929,90/mes, 4.000 min, overage R$ 0,20/min, sem trial, teto 8.000 min (acima vira Enterprise).
- Faixa para copy: "R$ 79,90 a R$ 929,90/mes". (Consistente com o catalogo do /billing.)
- Legado v1 (OpenAI, clientes pre 2026-05-04): R$ 89,90 a R$ 1.299,90. NAO usar em copy nova.

### b.2 Radar 360 (nome cliente-facing) = add-on RADAR_360
- R$ 397,00/mes. BI conversacional: cohort analysis, previsao de pipeline (ML), benchmarking de mercado, alertas proativos, exporta Power BI e Looker.
- Incluido em: Scale (via feature flag `radar360`), Business (legado) e Enterprise. Nos planos menores, add-on opcional.
- Parte do BI preditivo avancado deve ser marcada "beta/em breve" (ver honestidade).

### b.3 Add-ons legado (mapa `ADDONS`, os que ainda aparecem no /billing)
- Numero WhatsApp adicional: R$ 147/mes (fila independente).
- Pacote 10.000 mensagens IA extras: R$ 197/pacote.
- Pacote 10.000 disparos extras: R$ 247/pacote (custo Meta repassado a parte).
- Seat adicional de atendente: R$ 89/mes.
- Horas de integracao customizada: R$ 340/hora (pacote 10h: R$ 2.900).
- Infraestrutura isolada (pool dedicado): R$ 2.200/mes (incluido no Enterprise).
- SOC/NOC dedicado 24/7: R$ 3.800/mes (incluido no Enterprise).
- Retencao estendida de logs (5 anos): R$ 490/mes (incluido no Enterprise).

### b.4 Add-ons V4 Onda 1 (mapa `ADDONS_V4_LIST`, aprovados 2026-05-27, precos mais recentes)
Familia Mensagens IA: overage unitario R$ 0,03/msg; pacote 5k R$ 99; pacote 10k R$ 179; pacote 50k R$ 749.
Familia Comunicacao/Disparos: pacote 1k R$ 99; pacote 5k R$ 449; pacote 10k R$ 829.
Familia Canal: WhatsApp Business numero extra R$ 137/mes; Instagram Direct extra R$ 97/mes.
Familia Capacidade: contatos 5k R$ 59/mes; contatos 25k R$ 199/mes; fluxos Maestro pacote 5 R$ 47/mes; KB docs pacote 25 R$ 99/mes; KB docs pacote 100 R$ 297/mes; atendente seat extra R$ 79/mes; integracoes pacote 5 R$ 147/mes.
Familia Recurso: Agendamento pela IA R$ 49/mes (add-on so no Lite; incluido do Growth pra cima).
Familia Impulso (produto separado, ver secao c, item Zap Impulso):
- Impulso Start R$ 197/mes (ate 5.000 contatos, 1.000 disparos/mes).
- Impulso Pro R$ 597/mes (ate 25.000 contatos, 5.000 disparos/mes).
- Impulso Scale R$ 1.297/mes (contatos ilimitados, 20.000 disparos/mes).

Add-on visivel no /billing e citado como setup: "Integracao Meta gerenciada" (Embedded Signup + configuracao), R$ 297 setup.

Nota de conflito: para "Numero WA extra", "Mensagens IA extras", "Seat" e afins, o mapa legado e o V4 divergem no preco. Ver D1/D2 antes de publicar qualquer tabela de add-ons.

---

## (c) Produtos pelo NOME DO DASH, status e evidencia

Fonte de nomes: `Sidebar.tsx`. Agente = Iza. Status verificado nas pages em `apps/web/app/(dashboard)/*`.

| Produto (nome Dash) | Rota | Status | Evidencia |
|---|---|---|---|
| Dashboard | /dashboard | implementado | page.tsx com 486 linhas, painel operacional real |
| Conversas | /conversations | implementado | 649 linhas, inbox com Socket.IO tempo real, notas internas, envio |
| Contatos | /contacts | implementado | 250 linhas, busca por nome/telefone/email |
| CRM | /crm | implementado | 553 linhas, pipeline + subrota /crm/atribuicao |
| Agenda | /crm/agenda | implementado (sync externo parcial) | 175 linhas, agenda interna consome /api/appointments; a IA grava via tools; UI reconhece source "external_sync", mas Google Calendar (OAuth) e Microsoft 365 sao Fase 2 pendente |
| Tarefas | /tasks | implementado | 226 linhas; crmAutomationService cria Tasks ao detectar intencao de compra |
| Zap Impulso | /campaigns | parcial | 468 linhas; pilares "Iza Estrategista", "Disparo omnichannel", "Copiloto & Coach" com status 'ok' no codigo; "Loop de Performance" e "Auto-otimizacao" com status 'soon'. Impulso Start/Pro/Scale como tiers pagos; Loop de Receita, Meta/TikTok em breve |
| Templates | /templates | implementado | 206 linhas, gestao de templates WhatsApp aprovados pela Meta |
| Maestro | /flows | implementado (auto-otimizacao beta) | 2.448 linhas, canvas React Flow com CRUD real em /api/flows; GA 2026-05-22; auto-otimizacao (preview/apply) existe mas deve ser tratada como beta |
| Analytics | /analytics | implementado | 740 linhas; e o "analytics operacional" incluido em todos os planos (flag interna `radarInsights`) |
| Treinar IA | /ai-training | implementado | 1.346 linhas; inclui aba Agendamento (config), tom de voz, upload de base, status de readiness |
| Qualidade da IA | /treinar/qualidade | implementado | 900 linhas; auditoria de qualidade do agente + auto-fix (FASE 2.2b #244) |
| Auditoria | /audit-logs | implementado | 301 linhas; restrito a ADMIN/AUDITOR; hash chain SHA-256 (LGPD) |
| Requisicoes LGPD | /dsr | implementado | 321 linhas; DSR ACCESS/CORRECTION/DELETION/PORTABILITY |
| Configuracoes | /settings | implementado | 997 linhas; geral, IA, Cobranca & Limites, horario comercial, CAPI, Asaas |
| Plano & Fatura | /billing | implementado | 654 linhas; checkout Stripe real, troca de plano, catalogo de add-ons |

Add-ons cliente-facing (nomes corretos): Voz Nativa, Radar 360. Copiloto do atendente = Echo Copilot (pode permanecer como nome do copiloto, nunca como marca-mae).

### Recursos parciais/beta (marcar "em breve/beta", nunca como capacidade atual)
- Echo Copilot runtime: flag `echoCopilot` ligada no Growth+, mas execucao parcial.
- Vision inbound (imagens WA/IG): bullet do Scale, em rollout.
- Radar 360 BI preditivo avancado: parcial.
- Zap Impulso Pro/Scale (Loop de Receita, Meta/TikTok): status 'soon' no codigo das pilastras de /campaigns.
- Memory Layer Mem0: bullet do Scale marcado "em rollout".
- Microsoft 365 no Agendamento: nao implementado; Google Calendar em Fase 2 pendente.
- Maestro auto-otimizacao: presente, tratar como beta.
- Central de Ajuda / Iza Ajuda: Fase 2 pendente.
- Outcome (Conversa Convertida): so renderiza com flag `outcomeBetaEnabled`, beta opt-in.
- Tool/function calling do agente: PoC passivo, agentOrchestrator ainda nao usa tools (ARCHITECTURE.md V4-006).
- Quota Management/overage: fase AUDIT-ONLY, nao pausa agente nem cria Stripe usage record ainda (ARCHITECTURE.md, Onda 6).

### Numeros que sao metrica ilustrativa/beta (rotular como ilustrativo)
- Iza ~65%, +30% conversao, payback 90 dias: rotular como ilustrativos.
- ROICalculator ja tem cap de 300% e payback minimo 90 dias com disclaimer (CHANGELOG V2-003/V2-016).

### Claims de fato com risco juridico (marcar [confirmar])
- Meta Business Partner / "Parceiro Oficial Meta": o codigo usa "BSP homologado Meta (360Dialog)" (CHANGELOG V2-013/V2-014). Nao afirmar parceria oficial sem [confirmar].
- Dados no Brasil: [confirmar] (stack atual cita Fly.io gru, Supabase, Upstash; nao ha afirmacao de residencia BR verificada).
- SLA 99,9% + creditos: flag `slaContractual` real no Scale/Enterprise, mas marcar [confirmar] em copy publica.
- Incidente em 72h, comparativos nominais de concorrentes: [confirmar].

---

## (d) Discrepancias ja notadas (para corrigir no material e/ou alinhar no codigo)

D1. Dois sistemas de add-on convivem em `planConfig.ts`: o mapa legado `ADDONS` e o `ADDONS_V4_LIST` (Onda 1, 2026-05-27). Precos divergentes para o mesmo add-on (ex.: numero WA extra R$ 147 legado vs R$ 137 V4; seat R$ 89 vs R$ 79; pacote 10k msgs R$ 197 vs R$ 179). Definir qual e canonico antes de publicar tabela de add-ons. O V4 e mais recente.

D2. O catalogo de add-ons do `/billing` (page.tsx) mostra os precos do mapa LEGADO (R$ 197/pacote msgs, R$ 247/pacote disparos, R$ 89 seat, R$ 147 numero WA), nao os do V4. Drift entre a UI que o cliente ve e a tabela V4 aprovada.

D3. Dois planos com `highlight: true` ao mesmo tempo: Lite e Growth. A regra de posicionamento diz que Growth e o "mais popular". Marketing deve destacar so o Growth; codigo destaca os dois.

D4. Trial de 14 dias so esta codificado no Lite (`trialDays: 14`). Growth tem `trialDays` ausente (undefined) e depende so da copy do CTA; Scale tem `trialDays: 0` (sem trial); Enterprise sem trial. Logo, a bandeira "trial 14 dias sem cartao" e literal apenas para Lite (e, por copy, Growth). Nao aplicar a Scale/Enterprise.

D5. Desconto anual: Lite/Growth/Scale (e Business legado) usam 20%; Enterprise usa 10% (`annualDiscountPercent: 10`). A bandeira generica "anual -20%" nao vale para Enterprise.

D6. Preco Enterprise "a partir de R$ 9.900/mes" existe so em comentario de codigo (priceMonthly null). Marcar [confirmar] se for para copy.

D7. Codinomes antigos PROIBIDOS ainda vivos no proprio codigo da landing (apps/web/components/landing): `Products.tsx` lista "ZappIQ Core", "Pulse AI", "Spark Campaigns", "Radar Insights", "Nexus CRM", "ZappIQ Maestro", "Echo Copilot"; `ProblemSolution.tsx`, `Segments.tsx` e `FAQ.tsx` repetem "Pulse AI", "Spark Campaigns", "Radar Insights", "Nexus CRM". Footer canonico (CHANGELOG V2-024) lista 8 codinomes: ZappIQCore, PulseAI, SparkCampaigns, RadarInsights, NexusCRM, ForgeStudio, EchoCopilot, ShieldCompliance. Mapa de correcao:
   - ZappIQ Core -> Conversas
   - Pulse AI -> Iza (agente) / Treinar IA
   - Spark Campaigns -> Zap Impulso
   - Radar Insights -> Analytics (incluido nos planos)
   - Nexus CRM -> CRM
   - ForgeStudio / ZappIQ Maestro -> Maestro
   - Echo Copilot -> permanece como nome do copiloto do atendente, nunca como marca-mae
   - ShieldCompliance -> Auditoria + Requisicoes LGPD

D8. `FAQ.tsx` diz que Radar 360 "ja vem incluso em Business e Enterprise". "Business" esta deprecated. O correto pelos flags e Scale e Enterprise (feature `radar360` no Scale; `includedIn` Business legado/Enterprise). Corrigir para "Scale e Enterprise".

D9. Flag interna `radarInsights` (em `PlanFeatures`) ainda carrega o codinome antigo, embora o comentario diga "Analytics operacional nativo". Nao ressuscitar "Radar Insights" na copy; o nome cliente-facing e Analytics.

D10. Voice add-on: IDs Stripe v1 (OpenAI, R$ 89,90 a R$ 1.299,90) seguem ativos para clientes pre 2026-05-04. Copy nova deve citar apenas a faixa v4 (R$ 79,90 a R$ 929,90).

D11 (seed confirmado). `produtos/01-iza.md` usa "Radar Insights" para o plano Lite: trocar por "Analytics". Travessao (em-dash) a corrigir em `produtos/07-maestro.md` (prosa), `produtos/09-treinar-ia.md` (prosa) e `produtos/11-voz-nativa.md` (tabela). Estes arquivos ficam no material de marketing, nao no repo de codigo; confirmar no diretorio do material.

D12. Numero de WhatsApp: CHANGELOG registra +55 11 94563-3305 substituido por +55 11 92616-0159 em V5.1. Usar o numero atual e conferir [confirmar] qual esta vigente no material.
