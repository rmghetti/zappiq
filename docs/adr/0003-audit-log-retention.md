# ADR 0003 — Retention e lifecycle do Audit Log

- **Status:** Aceita (implementação pendente)
- **Data:** 2026-04-14
- **Contexto:** FASE 1 (P1 LGPD) — follow-up pós-launch
- **Autores:** Time de Plataforma (ZappIQ)

## 1. Contexto

A tabela `AuditLog` foi criada em P1 e hoje recebe um evento por:
- Login / logout / falha de autenticação
- Mudança de papel de usuário
- CRUD em dados sensíveis (Contact, Conversation, KnowledgeBase)
- DSR criada / atualizada / completada
- Soft delete / restore
- Acesso a dados de DSR pelo admin

**Ritmo estimado:** 50–200 eventos por tenant/dia em uso moderado. Com 1k tenants
projetados em 12 meses, são 50k–200k linhas/dia, ~70M/ano.

Sem política de retention, essa tabela vira o maior consumidor de storage e
degrada performance de qualquer query em 6–12 meses.

### 1.1 Requisitos legais

- **LGPD Art. 16:** dados pessoais devem ser eliminados após "término do
  tratamento" — mas há exceção para "cumprimento de obrigação legal ou
  regulatória pelo controlador". Audit log se encaixa parcialmente.
- **LGPD Art. 37:** controlador deve manter registro das operações de
  tratamento — isso é explicitamente o papel do AuditLog.
- **CVM 44 / Receita Federal:** 5 anos para dados financeiros.
- **Marco Civil da Internet Art. 15:** provedores de aplicação mantêm
  registros de acesso por 6 meses (obrigatório).

**Síntese:** mínimo legal = 6 meses. Razoável LGPD + práticas de SOC 2 = 12
meses online + 5 anos em cold storage (deletado depois).

## 2. Decisão

Política em 3 tiers:

| Tier | Idade | Localização | Performance | Custo |
|---|---|---|---|---|
| **Hot** | 0–90 dias | Postgres `AuditLog` | Query direto em < 100ms | Supabase (alto) |
| **Warm** | 91–365 dias | Postgres `AuditLogArchive` | Query em 1–5s | Supabase (médio) |
| **Cold** | 1–5 anos | S3 parquet comprimido | Download + análise batch | S3 Glacier (mínimo) |
| **Delete** | > 5 anos | (removido) | — | zero |

### 2.1 Implementação — job diário

Criar novo worker BullMQ `audit-log-lifecycle` com 3 steps que rodam em cascata
uma vez por dia (cron `0 3 * * *` — 3h da manhã UTC):

1. **Move hot → warm** (> 90 dias)
   ```ts
   INSERT INTO "AuditLogArchive" SELECT * FROM "AuditLog"
     WHERE "createdAt" < NOW() - INTERVAL '90 days';
   DELETE FROM "AuditLog" WHERE "createdAt" < NOW() - INTERVAL '90 days';
   ```

2. **Move warm → cold** (> 365 dias)
   - Query `AuditLogArchive` onde `createdAt < NOW() - INTERVAL '365 days'`
   - Serializa em parquet (PyArrow via service RAG, ou duckdb-wasm)
   - Upload para `s3://zappiq-audit-cold/{year}/{month}/{tenant_id}.parquet`
   - `DELETE FROM "AuditLogArchive" WHERE createdAt < NOW() - INTERVAL '365 days';`

3. **Purge cold** (> 5 anos)
   - Lifecycle rule S3: delete objetos > 1825 dias. Sem ação aplicativa.

### 2.2 Schema — `AuditLogArchive`

Mesmo schema do `AuditLog`, mas com:
- Índice só em `organizationId` + `createdAt` (não precisa dos outros)
- `FILLFACTOR = 100` (append-only, sem updates)
- Particionamento por mês (`createdAt`) — PG native partitioning

### 2.3 Query unificada

Expor no endpoint `/api/audit-logs` um parâmetro `?archived=true` que faz
`UNION ALL` entre as duas tabelas. Sem esse flag, só hot.

Para queries de dados em cold (> 1 ano), criar endpoint separado `/api/audit-logs/export`
que faz request assíncrono — job BullMQ baixa os parquets relevantes, filtra,
retorna link S3 pré-assinado por 24h. User recebe email quando pronto.

### 2.4 DSR — direito à exclusão no contexto de audit

Quando DSR tipo DELETE é aprovada, o registro do **titular** no Contact/User
é deletado. **Mas os logs em AuditLog NÃO são deletados** — são substituídos:

```sql
UPDATE "AuditLog"
  SET "actorEmail" = '[REDACTED:DSR-' || "dsrId" || ']',
      "metadata" = "metadata" - 'contactEmail' - 'contactPhone' - 'contactName'
WHERE "actorId" = <deleted_user_id> OR metadata @> '{"contactId": "<deleted_id>"}';
```

Isso preserva a trilha de auditoria (imutável por design) mas anonimiza o
titular. Documentar na política de privacidade.

## 3. Alternativas consideradas

### 3.1 Sem arquivamento (apenas hot)
- ✅ Simplicidade operacional
- ❌ Tabela cresce indefinidamente; index bloat após ~6 meses
- ❌ LGPD Art. 16 reclama (retenção além do necessário)

### 3.2 Delete puro após 90 dias
- ✅ Mínimo storage, simples
- ❌ Não cobre 5 anos para forensics fiscal
- ❌ Quebra conformidade SOC 2 / ISO 27001 futura

### 3.3 Logs em serviço externo (Datadog, Logflare)
- ✅ Zero manutenção, full-text search
- ❌ Custo 5-10x o tier S3
- ❌ Vendor lock-in agressivo (exportar 5 anos de logs sai caro)
- ❌ LGPD: dados transitam por provedor estrangeiro → DPA adicional

## 4. Consequências

### Positivas
- Query de audit em < 100ms para janela de 90 dias (hot)
- Conformidade LGPD + Marco Civil + requisitos fiscais cobertos
- Custo de storage previsível (S3 Glacier ~U$ 0.004/GB/mês)

### Negativas
- Complexidade operacional: 1 job daily + 2 tabelas + integração S3
- Query histórica fica lenta (cold tier) — user precisa esperar email
- DSR tipo DELETE não é 100% "apagar tudo" (audit anonimizado fica)

### Mitigações
- Alerta se job `audit-log-lifecycle` falhar por 2 dias consecutivos
- Runbook para popular S3 manualmente em caso de job indisponível
- Transparência no termo de uso: "manteremos logs anonimizados por 5 anos
  para fins legais/forensics"

## 5. Métricas

| Métrica | Meta |
|---|---|
| Linhas em `AuditLog` (hot) | < 5M por tenant |
| Linhas em `AuditLogArchive` | < 50M por tenant |
| Duração job `audit-log-lifecycle` | < 30min |
| Falhas do job nos últimos 30 dias | < 2 |

## 6. Cronograma

| Sprint | Entrega |
|---|---|
| Próximo | Schema `AuditLogArchive` + migration |
| +1 | Job BullMQ com step hot→warm |
| +2 | Integração S3 + step warm→cold |
| +3 | Endpoint `/export` assíncrono |
| +4 | Anonimização DSR DELETE |

## 7. Referências

- LGPD Art. 16, 37: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Marco Civil Art. 15: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- Postgres table partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- S3 Glacier pricing: https://aws.amazon.com/s3/storage-classes/glacier/
