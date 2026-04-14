# ADR 0002 — Backup, PITR e estratégia de Disaster Recovery

- **Status:** Aceita (parcial — partes operacionais ainda pendentes)
- **Data:** 2026-04-14
- **Contexto:** FASE 10 — Resiliência / LGPD Art. 46
- **Autores:** Time de Plataforma (ZappIQ)

## 1. Contexto

Em 14-abr-2026, o ZappIQ roda sobre:

- **Postgres**: Supabase (plano Pro) — backup diário automático + PITR
  habilitado no tier pago
- **Redis**: Upstash — sem persistência configurada (ephemeral)
- **Object storage** (uploads, mídia WhatsApp): S3-compatible — versionamento
  não configurado
- **Código + config**: GitHub (origem) + Fly deploy histories

O risco não é o backup existir (existe), é **não termos testado o restore**.
Sem um runbook exercitado, o backup vira teatro de segurança.

Nossa obrigação sob LGPD Art. 46 é garantir "medidas técnicas e administrativas
aptas a proteger os dados pessoais" — isso inclui plano de recuperação em caso
de incidente (ransomware, delete acidental, corrupção).

## 2. Decisão

Definir RTO e RPO explícitos, automatizar o que dá, e **rodar exercício de
restore mensal** documentado.

### 2.1 Objetivos por camada

| Camada | RPO | RTO | Mecanismo |
|---|---|---|---|
| Postgres (Supabase) | 5 min | 1h | PITR + backup diário do Pro plan |
| Redis (Upstash) | 0 (ephemeral) | N/A | Reconstruído do Postgres |
| Object storage | 24h | 30min | Versionamento S3 + lifecycle |
| Código/config | 0 | 15min | GitHub + `fly deploy` |

RPO = quanto dado podemos perder. RTO = quanto tempo até voltar.

### 2.2 Postgres (crítico)

**Supabase Pro oferece:**
- Backup full diário (retenção 7 dias)
- Point-in-Time Recovery até 7 dias (granularidade segundo)

**Gap atual:** não testamos restore desde que subimos em produção.

**Ação:**
1. Subir para **Supabase Team** (~U$ 599/mês) quando faturamento cobrir, elevando
   PITR retention para 28 dias e backup para 30 dias. Enquanto não, Pro basta.
2. **Runbook de restore** em `docs/runbooks/db-restore.md` (próximo commit).
3. **Dry-run mensal** — restaurar banco de produção num Supabase project
   separado (`zappiq-restore-test`), validar schema + counts, destruir. Agendar
   via `.github/workflows/db-restore-drill.yml` com cron e runner manual.
4. **Export externo semanal** — além do PITR do Supabase, fazer `pg_dump` do
   schema + dados críticos (LGPD data: DataSubjectRequest, AuditLog) para
   bucket S3 independente (Cloudflare R2 ou Backblaze). Evita lock-in de
   fornecedor único.

### 2.3 Redis (não-crítico)

Upstash sem persistência é uma escolha consciente: BullMQ queues são estado
derivado do banco. Em caso de perda:

- Jobs in-flight: BullMQ perde, mas mensagens importantes já estão persistidas
  como `Message` no Postgres e o worker reprocessa no próximo boot
- Rate limits: resetam (aceitável)
- Sessões: usamos JWT stateless, não dependemos de Redis

**Ação:** nenhuma. Documentar explicitamente no runbook que Redis é cache, não
source of truth.

### 2.4 Object storage

Uploads de mídia (imagens, PDFs, áudios de WhatsApp) hoje vão para S3.

**Gap:** bucket sem versionamento nem lifecycle.

**Ação:**
1. Habilitar S3 versioning no bucket de uploads
2. Lifecycle: versões não-current para Glacier em 30 dias, delete em 180 dias
3. Cross-region replication para bucket backup em região distinta (sa-east-1 → us-east-1)

### 2.5 Código + config

Redundância natural:
- Código: GitHub + cópia local em cada dev
- Secrets: Fly + 1Password (team vault)
- Docker images: Fly registry (registry.fly.io) — pode ser rebuildado do GitHub
- Infra-as-code: `infra/` + `fly.toml` versionados

Zero ação.

## 3. Alternativas consideradas

### 3.1 Backup próprio (pg_dump cronjob)
- ✅ Independente do Supabase
- ❌ Gerenciar retenção, criptografia, teste de restore manualmente
- ❌ RPO vira 24h (um dump por dia)
- **Decisão:** usar COMO COMPLEMENTO ao PITR do Supabase (§2.2 item 4), não substituto

### 3.2 Multi-cloud Postgres (AWS RDS standby)
- ✅ Zero lock-in
- ❌ Custo dobra (Supabase + RDS)
- ❌ Replicação cross-provider é frágil (network, latency, schema drift)
- **Decisão:** adiar. Reavaliar se ZappIQ escalar para > 10 tenants enterprise.

### 3.3 Snapshot Fly volumes
- Irrelevante — não usamos volumes Fly (stateless API)

## 4. Consequências

### Positivas
- Postura de DR tangível e mensurável (não só "temos backup")
- Exercício mensal expõe problemas de schema drift, migrations divergentes,
  seeds ausentes antes que um incidente real aconteça
- Dump externo semanal elimina lock-in do Supabase

### Negativas
- Custo: Supabase Team quando escalar (+U$ 599/mês), bucket S3 backup (+~U$ 10/mês)
- Tempo de time: 2h/mês para rodar drill + documentar resultado

### Mitigações
- Drill de mês par feito pelo SRE de plantão (rotaciona)
- Drill de mês ímpar automatizado (GitHub Actions cria o Supabase project,
  roda restore, valida, destrói — manager se 20min)

## 5. Métricas de sucesso

| Métrica | Meta |
|---|---|
| Drill de restore bem-sucedido | 100% (12/12 ao ano) |
| Tempo real de restore no último drill | < RTO (1h) |
| Dump externo semanal sem falha | 100% (52/52) |
| Dias desde último drill | < 35 |

Dashboard em Grafana ou planilha compartilhada.

## 6. Referências

- Supabase — Database Backups: https://supabase.com/docs/guides/platform/backups
- LGPD Art. 46 + 48 (medidas de segurança + comunicação de incidente)
- Runbook: `docs/runbooks/db-restore.md` (a ser criado)
