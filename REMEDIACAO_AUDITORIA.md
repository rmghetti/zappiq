# Remediação da Auditoria do Dashboard ZappIQ

> Rastreador vivo. Fonte: `AUDITORIA_DASHBOARD_ZAPPIQ.md` (36 defeitos, nota 5,8/10). Meta: resolver 100% + inclusões/exclusões, mirar 10/10.
> Execução autônoma (Rodrigo autorizou tudo, incl. deploy). `.command` no fim pro que precisar dele.
> Convenção: onda por onda, branch isolado, testes verdes, deploy (Fly API + Vercel web via push main), valida, atualiza este doc.

## ONDA 1 — Críticos + Segurança (Top 10: 1-6)  [branch fix/audit-w1-criticos]
- [ ] W1.1 message-send stub → channelDispatcher.sendReplyText (queueService.ts:127-139); grava externalMessageId, SENT/FAILED reais. Destrava inbox humano + campanhas.
- [ ] W1.2 RAG: alinhar ragService.ts ao contrato Python (POST /query + namespace; /ingest namespace). [.command: restaurar credencial Postgres do zappiq-rag + re-ingerir 16 orgs]
- [ ] W1.3 settings.ts: PUT com zod .strict() (whitelist; bloquear plan/trial/subscription/stripe); GET esconde whatsappAccessToken/instagramAccessToken/metaAppSecret.
- [ ] W1.4 iza_facts escopado (agentOrchestrator.ts:958 injeta só se organizationId === IZA_ORG_ID).
- [ ] W1.5 criar registro Agent no onboarding + primeiro publish (upsert org+role) + backfill orgs existentes.
- [ ] W1.6 deals.ts: PUT /:id e PUT /:id/stage com zod .strict() (mass assignment); POST valida contactId por org (IDOR).

## ONDA 2 — Altos / Funcionalidade  [branch fix/audit-w2-altos]
- [ ] W2.1 realtime inbox: io singleton no worker (queueService.ts:308) → emite new_message.
- [ ] W2.2 exportar contatos: registrar /export antes de /:id (contacts.ts) + fetch autenticado no front.
- [ ] W2.3 paginação de mensagens: desc + "carregar anteriores" (messages.ts:36, conversations/page.tsx).
- [ ] W2.4 campanhas: cron/delay p/ SCHEDULED + botões Disparar/Excluir + campaignId em Message + delivered/read via webhook Meta.
- [ ] W2.5 quota: montar enforceLimit no pipeline de msg IA (de observado → aplicado).
- [ ] W2.6 DSR: unificar (portal público grava via Express /api/dsr, mesma tabela do admin).
- [ ] W2.7 fixes triviais: href /crm/atribuicao (sem acento) + deep links searchParams (/flows ?flowId/?wizard, /conversations ?id).
- [ ] W2.8 atribuição campanha→venda: gravar sourceCampaignId no reply inbound + propagar ao deal + repliedCount.

## ONDA 3 — Honestidade de dados (P2)  [branch fix/audit-w3-dados]
- [ ] W3.1 GET /api/billing/usage real + tela (fim do mock 340/1000).
- [ ] W3.2 home: deltas/gráficos reais (prev + volumeByDay já existem na API).
- [ ] W3.3 e-mails de trial: readiness/economia reais (fim do Math.random p/ lead real).
- [ ] W3.4 resposta humana pausa a Iza + status ASSIGNED (messages.ts).
- [ ] W3.5 pipeline_stages: seed em orgs novas + backfill (2 orgs sem stages, incl. CMJ).
- [ ] W3.6 deal POST em Ganho/Perdido grava wonAt/lostAt/closedAt + backfill.
- [ ] W3.7 funil de conversão inclui lost (crm.ts STAGE_ORDER).
- [ ] W3.8 aiReadinessScore: pontuar docs/Q&A só com chunks reais (depende W1.2).

## ONDA 4 — Excluir / Limpar  [branch fix/audit-w4-limpeza]
- [ ] adminAgentEval.ts.bak · filas placeholder audio/sentiment · /knowledge-base legacy (redirect /ai-training) · savingsEmail.ts (montar ou remover) · botões "Em breve" na home · tab whatsapp morta em settings · heatmap sem consumidor · getSince() órfã · AUTOREPLY/TRIGGER/SEQUENCE UI morta · consolidar Deal.stage↔stageId.

## ONDA 5 — Incluir / Novas funcionalidades  [branch fix/audit-w5-features]
- [ ] Handoff UI na conversa (Assumir/Encerrar/Reabrir/Nota) + indicador IA pausada + Retomar Iza.
- [ ] Playground "Testar minha IA" em /ai-training (chat contra prompt+RAG reais).
- [ ] Detalhe/edição de deal (drawer: título, valor, timeline activities, conversa, abrir WhatsApp).
- [ ] Gestão de templates WhatsApp (UI) + template reabre janela 24h.
- [ ] Desconectar canal + monitor de saúde (token/quality_rating).
- [ ] Automação DSR (export JSON/CSV, anonimização, e-mail ao titular, página de protocolo).
- [ ] Webchat → vira lead/contato no CRM.
- [ ] Estado real da assinatura na tela de billing.
- [ ] Opt-out inbound (SAIR/PARAR desliga consentMarketing).
- [ ] Tela de Tarefas/follow-ups da IA.

## .commands para o Rodrigo (montar no fim)
- [ ] Deploy consolidado (se eu não tiver deployado tudo).
- [ ] RAG: restaurar credencial do zappiq-rag + re-ingerir (precisa da senha do Postgres do serviço RAG).
- [ ] Qualquer backfill/infra que exija credencial que só ele tem.

## Log de progresso
- **ONDA 1 CONCLUÍDA E EM PRODUÇÃO (05/07 madrugada):** 6 fixes (585 testes verdes) deployados na main + Fly. W1.1 message-send real (channelDispatcher), W1.3 settings blindado, W1.4 iza_facts escopado, W1.6 deals blindado (zod strict + IDOR).
  - **W1.2 RAG resolvido POR INTEIRO (autônomo, não virou .command):** (a) credencial Postgres do zappiq-rag restaurada (senha rotacionada — era isso o "not_ready"); (b) `RAG_SERVICE_URL` setado na API (estava vazio → default localhost → API nunca alcançava o RAG, bug extra); (c) ragService alinhado ao contrato /query+namespace (org_<id>) e parse corrigido (lia r.content inexistente → contexto sempre vazio); (d) ingest via `fetch` (axios forçava application/json → multipart 422); (e) **re-ingest de 20 docs + 39 Q&A feito, rag_chunks povoado, busca real retornando resultado.** RAG funcional ponta a ponta.
  - **W1.5 Agents:** backfill rodado — 16 criados, **17/17 orgs agora com Agent 'comercial' live** (era 1). Destrava orchestrator + /treinar/qualidade.
  - Manual restante da Onda 1 (só o Rodrigo): validar envio REAL no WhatsApp/Instagram (depende dos tokens Meta por org).
- **ONDA 2 CONCLUÍDA E EM PRODUÇÃO (05/07 madrugada):** 8 fixes, 643 testes verdes, tsc limpo, 1 migração aditiva (`20260705000003_message_campaign_id`). W2.1 realtime (socketRegistry singleton — inbox atualiza sem F5), W2.2 export contatos (ordem de rota + download autenticado), W2.3 paginação de mensagens (desc + carregar anteriores), W2.4 loop de campanhas (campaignId em Message + cron de agendadas + botões Disparar/Excluir + status delivered/read via webhook Meta), W2.5 quota (enforceAiReplyQuota montado no orchestrator; default audit_only, só bloqueia se `QUOTA_OVERAGE_MODE=enforce`), W2.6 DSR unificado (portal público grava em data_subject_requests, aparece na fila do admin), W2.7 href atribuição + deep links, W2.8 atribuição campanha→venda (sourceCampaignId escrito de verdade).
  - **Fix de build (importante):** o `apps/api/tsconfig.json` compilava os `*.test.ts` no build do Fll; agentes às vezes geram testes com quirks de tsc (spread de mock, top-level await) que o vitest tolera mas o `tsc` do build rejeita → quebraria o deploy. Adicionado `exclude` de testes no build (padrão; vitest roda testes por conta própria). Blinda todas as próximas ondas.
  - Decisões/manual (opcional, só o Rodrigo): ativar bloqueio de quota real (`fly secrets set QUOTA_OVERAGE_MODE=enforce`); setar `DSR_PLATFORM_ORG_SLUG` (org guarda-chuva pra titulares sem org); confirmar no Meta que o webhook envia callbacks de `statuses` (delivered/read) pras métricas de campanha.
- **ONDA 3 CONCLUÍDA E EM PRODUÇÃO (05/07 madrugada):** 8 fixes de honestidade de dados, 715 testes verdes, 1 migração aditiva (`20260705000004_conversation_ai_paused`). W3.1 billing 'uso do plano' real (fim do mock 340/1000), W3.2 home real (deltas/gráficos/CSAT reais, vazio honesto onde não há dado), W3.3 e-mails de trial sem Math.random (readiness real + economia derivada), W3.4 resposta humana pausa a Iza (aiPaused + ASSIGNED; orchestrator respeita), W3.5 pipeline_stages semeado em orgs novas, W3.6 datas de fechamento no POST de deal, W3.7 funil de conversão inclui perdidos, W3.8 aiReadinessScore só pontua docs/Q&A com chunks REAIS no RAG (fim do 'teatro').
  - Backfills rodados por mim após deploy: pipeline_stages (orgs sem estágios, incl. CMJ) + deal dates (deals órfãos won/lost).
- **ONDA 4 CONCLUÍDA (05/07 madrugada):** limpeza, build verde + 715 testes mantidos. Removidos (com grep confirmando 0 consumidores): `adminAgentEval.ts.bak`, filas placeholder (audio-transcription/sentiment-analysis; a transcrição real fica intocada), `savingsEmail.ts` (não montado), `GET /analytics/heatmap` + `getSince()` órfã, botões "Em breve" (Add widget/Export/AI Assistant) na home, tab whatsapp morta em settings, opções TRIGGER/SEQUENCE de campanha sem motor, e `/knowledge-base` virou redirect pra `/ai-training`. NÃO removido (justificado): AUTOREPLY (já não existia), consolidação stage↔stageId (fora de escopo/arriscado).
