# Agendamento pela IA — design

Data: 2026-07-08. Autor: Rodrigo Ghetti + Claude.

## Objetivo
O cliente final (do nosso cliente) agenda consultas, reuniões, ligações, visitas etc.
conversando com a Iza no WhatsApp/Instagram/webchat. O dono do negócio configura,
numa aba nova "Agendamento" do `/ai-training`, quais tipos de agendamento oferece.
A config alimenta o RAG (o agente SABE as regras) e o agente EXECUTA o agendamento
via tools (function calling), gravando numa agenda interna e, opcionalmente,
sincronizando com Google Calendar / Microsoft 365.

## Decisões travadas (Rodrigo, 08/07)
- Escopo inicial: Fase 0 + 1 + 2 (fundação + aba + execução + Google). Microsoft na sequência. Apple fora do MVP.
- Comercial: incluído a partir do **Growth**. No **Lite** é add-on de **R$ 49/mês** (anual -20% = R$ 39,20/mês).
- **Agenda interna é a fonte da verdade (hub).** Nova página `crm/agenda` para gestão interna.
  Todo agendamento da IA grava na agenda interna. Calendário externo é ESPELHO: sincroniza
  bidirecionalmente com a interna (evento da IA vai pro externo; bloqueio no externo vira
  "ocupado" na interna, pra IA nunca oferecer horário já tomado). A interna nunca depende do externo.
- Opt-out: opção "Não desejo oferecer agendamento" selecionável, que oculta o resto.

## Estado do código (pontos que o design endereça)
- Registry de function-calling existe (`apps/api/src/services/llm/tools.ts`), MAS o loop
  de execução NÃO está ligado no runtime (`getToolsForContext`/`executeToolCall` sem caller).
  Fase 0 liga isso. Sem ele, "agendar" seria a IA só falar que agendou.
- `LLMRouter` já suporta `tools` + blocos `tool_use`/`tool_result` (formato Anthropic).
- `agents/businessHours.ts` (`isOpen`) e `flowPredicates` reaproveitáveis pra disponibilidade.
- RAG: ingestão por `ragService.ingestDocument` (mesma via de doc/URL/Q&A/survey). A config
  de agendamento vira documento no RAG, source estável `agendamento-config.txt`.
- Sem tabelas de agenda — greenfield.

## Modelo de dados (migração aditiva)
- `AppointmentType`: id, organizationId, name, icon, durationMin, durationBookerChoice(bool),
  modality(enum in_person|online|phone|video), locationText, meetingLinkTemplate,
  availabilityJson (grade semanal + timezone), minNoticeMin, bufferBeforeMin, bufferAfterMin,
  maxPerDay, futureHorizonDays, requiresConfirmation(bool), bookingFields(json: campos que o
  cliente final preenche), reminders(json), cancelPolicyText, active(bool), createdAt/updatedAt.
- `Appointment`: id, organizationId, appointmentTypeId, contactId?, conversationId?, status
  (pending|confirmed|cancelled|no_show|completed), startAt, endAt, timezone, modality,
  customerName, customerPhone, customerEmail?, answersJson (respostas dos bookingFields),
  location?, meetingUrl?, source(enum ai|manual|external_sync), externalEventId?,
  calendarConnectionId?, createdAt/updatedAt. Índice (organizationId, startAt).
- `CalendarConnection`: id, organizationId, provider(google|microsoft), status(active|expired|revoked),
  externalAccountEmail, accessTokenEnc, refreshTokenEnc, scope, targetCalendarId,
  channelId?/resourceId?/watchExpiresAt? (Google watch), subscriptionId?/subExpiresAt? (Graph),
  syncToken?/deltaLink?, lastSyncAt, createdAt/updatedAt. Tokens cifrados em repouso.
- `organization.settings.scheduling`: { enabled(bool), optOut(bool) } — flag rápida pro opt-out.

## Fase 0 — fundação
1. Migração Prisma com os 3 models.
2. Ligar o tool-loop: no `routeIzaTurn`, quando `tier`/org tem tools, passar
   `getToolsForContext(...)` ao `LLMRouter.complete`; se a resposta traz `tool_use`,
   chamar `executeToolCall` e reinjetar `tool_result`, iterando até resposta final
   (cap de N iterações). Auditar cada tool call (futura `tool_call_logs`).
3. Testes do loop (tool_use → result → final) com mock de provider.

## Fase 1 — configuração + RAG + agenda interna
1. Rotas API: `GET/PUT /ai-training/scheduling` (config + opt-out),
   `CRUD /appointment-types`, e `GET/POST/PATCH /appointments` (agenda interna).
2. Aba "Agendamento" no `/ai-training` (entre Identidade e Testar minha IA):
   opt-out mestre + construtor de tipos (checklist abaixo) + FeatureGuide.
3. Ingestão no RAG: a config consolidada vira `agendamento-config.txt` (replace-on-ingest).
4. Página `crm/agenda`: visão de calendário/lista dos Appointments, criar/editar/cancelar
   manualmente, marcar no-show/concluído. É o hub.
5. Playground: a IA já consegue "agendar" gravando na agenda interna (sem externo ainda).

### Checklist de campos por tipo (consolidado de Cal.com + Calendly)
Nome+ícone · duração (fixa ou escolhível) · modalidade (presencial/online/telefone/vídeo) ·
janelas de disponibilidade (grade semanal)+fuso · antecedência mínima · buffer antes/depois ·
limite por dia · horizonte futuro · exige confirmação humana? · campos do cliente final
(nome/telefone/e-mail/custom) · lembretes (quando/canal) · política de cancelamento · (fase 4) pagamento/sinal.

## Fase 2 — execução + Google Calendar
1. Tools no registry: `check_availability(type, window)`, `create_appointment(...)`,
   `reschedule_appointment(id, newSlot)`, `cancel_appointment(id)`. Handlers gravam na
   agenda interna (hub) e refletem no calendário externo conectado.
2. Anti-alucinação (Chain-of-Verification): o agente NUNCA promete horário sem `check_availability`
   validar contra o free/busy real + regras. Slot confirmado antes do `create_appointment`.
3. Conector Google:
   - OAuth 2.0. Escopos mínimos: `calendar.freebusy` (disponibilidade) + `calendar.events`
     (criar/editar) — de preferência em um calendário próprio via `calendar.app.created`.
   - Disponibilidade: `POST /freeBusy` (até 50 agendas → roteamento por equipe futuro).
   - Criar evento: `events.insert`.
   - Sync de volta pra interna: watch channel (webhook HTTPS c/ cert válido) → header-only,
     buscar o delta via `events.list` com syncToken; renovar canal antes de expirar;
     reconciliar com sync periódico (Google avisa que perde ~fração das notificações).
   - Requer verificação do app no Google (multi-tenant, tira o aviso "app não verificado").
4. Sincronização com o hub: external→interna cria/atualiza Appointment com source=external_sync;
   interna→external cria/atualiza evento e guarda externalEventId. Idempotência por externalEventId.

## Fase 3 — Microsoft Graph
Mesma arquitetura. OAuth. `getSchedule`/free-busy. `events` create. Change notifications
(webhook) + delta query (`/calendarView/delta`, @removed p/ deleção). Assinaturas expiram
(basic ~7d, rich ~1d) → renovar. Máx 1000 subs/mailbox.

## Fase 4 — diferenciais
Roteamento por equipe (round-robin), pré-pagamento/sinal (Stripe já existe; PIX/Mercado Pago
como os BR), lembretes anti-no-show (reaproveita filas/cron; dado: no-show 23%→<8% com lembrete),
waitlist + realocação de cancelamento. Apple via CalDAV/agregador só se houver demanda.

## Comercial (entitlement)
- Incluído do Growth pra cima. Lite: add-on `zappiq_addon_scheduling` R$49/mês (anual -20%).
- Reaproveita o padrão do Impulso: preços Stripe (mensal+anual), `settings.addons.scheduling`,
  checkout + webhook de ativação. Gate: se plano < Growth e sem add-on ativo → paywall.

## Concorrência (benchmark BR, jul/2026)
Agendai (R$197–497, Google 2-vias, PIX, multi-prof, analytics), Responza (R$190–1.295, Google,
team routing), AgeuBot (R$9,90, Google, Mercado Pago), Beeia/Tipefy (Google). TODOS presos ao
Google. Nenhum faz Microsoft nem multi-provedor. Calendly/Cal.com são página (não conversacional).
Diferenciais ZappIQ: multi-provedor, RAG+booking unificado, anti-alucinação de slot, agenda interna hub.

## Fontes primárias
Google Calendar API (freeBusy, auth/scopes, push/watch), Microsoft Graph (change-notifications,
delta-query-events), Apple CalDAV (RFC 4791; sem OAuth/webhook), Cal.com/Calendly (config fields),
Azure appointment voice agent (Chain-of-Verification), LangGraph+Composio (tool-executed booking).
