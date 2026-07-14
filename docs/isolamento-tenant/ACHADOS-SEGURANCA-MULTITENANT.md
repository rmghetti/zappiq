# Achados de segurança multi-tenant (isolamento cliente-vs-cliente)

**Data:** 14/07/2026
**Origem:** ao implementar a regra "todos agentes de clientes diferentes devem ser tratados de forma isolados", uma auditoria dedicada varreu a plataforma inteira em busca de vazamento cruzado entre organizações.
**Agravante:** a Row Level Security do Postgres está DESLIGADA em ~31 tabelas. O isolamento hoje depende 100% do código da API. Todo comentário do tipo "a RLS filtra" é falso hoje.

Todos os achados abaixo foram **verificados no código** (não só no relatório do subagente).

## Todos corrigidos nesta sessão (14/07/2026)

Nenhum destes foi explorado (verificado: só 2 SUPERADMINs, ambos o fundador na org da ZappIQ; zero duplicatas de identificador de canal em produção).

| # | Gravidade | Falha | Correção aplicada | Verificação |
|---|---|---|---|---|
| C1 | CRÍTICA | **Escalada a SUPERADMIN.** `POST/PUT /api/settings/team` gravavam `role` cru. Todo signup é ADMIN; o SUPERADMIN lê qualquer org via `X-Organization-Override`. Qualquer dono de conta se auto-promovia. | Whitelist `.strict()` de papéis de tenant (ADMIN/SUPERVISOR/AGENT/AUDITOR); SUPERADMIN nunca por request. | teste (22) |
| C2 | CRÍTICA | `PUT /api/campaigns/:id` fazia `data: req.body` cru: gravava `organizationId` e movia a campanha pra outra org; o cron dispara a copy do atacante pra base da vítima, pelo número dela. | Schema Zod `.strict()` com whitelist dos campos editáveis. | teste |
| C3 | CRÍTICA | `PUT /api/impulso/:id`: mesmo mass-assignment, com a copy (`message`) no modelo. | Idem C2. | teste |
| C4 | CRÍTICA | `DELETE /api/kb/:id/documents/:docId` apagava por id sem escopo: apagava documento de qualquer cliente. | Valida posse via `knowledgeBase.organizationId` antes de apagar; 404. | código |
| C5 | CRÍTICA | `POST /api/kb/:id/documents` gravava sem validar dono da base: injetava documento na base de outro cliente. | Valida posse da base antes de criar; 404. | código |
| C6 | CRÍTICA | `POST /api/conversations/:id/notes` gravava nota sem validar dono: plantava conteúdo no painel de outro cliente. | Carrega a conversa com escopo de org antes de gravar; 404. | código |
| C7 | CRÍTICA | `whatsappPhoneNumberId`/`instagramAccountId` sem `@unique`, graváveis pelo cliente: o webhook roteava o lead pra org errada. | `@unique` nos dois (migration `20260714000001_channel_ids_unique`) + 409 amigável na gravação duplicada. **Migration aplicada no deploy (zero duplicatas hoje).** | schema válido |
| A1 | ALTA | `PUT /api/conversations/:id/assign` não validava o `agentId` do body: usuário de outra org aparecia no painel. | Valida que o responsável é da org; desatribuir segue livre. | código |
| A2 | ALTA | `POST /api/appointments` gravava FKs do body sem validar org (só o PATCH validava). | Valida `appointmentTypeId`/`contactId` por org, espelhando o PATCH. | teste (4) |
| A3 | ALTA | Cache de intent com chave sem `organizationId` e texto truncado em 24 bytes: rótulo da org A reusado na org B, afetando o handoff. | Chave `intent:${orgId}:${sha256(texto)}`. | código |

## Verificado e SEGURO (não é vazamento)

- Caches de prompt (`izaFactsService`, `webChatService`): exclusivos da org da ZappIQ, com gate correto.
- RAG: sempre por namespace `org_<id>`; todos os callers passam o organizationId do request.
- Jobs/filas/crons: derivam a org do payload; nenhuma variável reusada entre iterações.
- Contexto do LLM: montado por org a cada turno; sem estado de tenant em módulo.

## Padrão de correção (já usado nesta sessão)

- Mass-assignment → schema Zod `.strict()` com whitelist (padrão W1.3, `settings.schema.ts`).
- IDOR → carregar o recurso com `findFirst({ where: { id, organizationId } })` e 404 se não achar (padrão `loadAgentScoped`/`loadRunScoped` em `agentQuality.ts`).

## Pergunta em aberto para o fundador

Investigar se a escalada a SUPERADMIN (C1) foi explorada: auditar a tabela `users` por SUPERADMIN inesperado e os `audit_logs` por `X-Organization-Override` de origem suspeita.
