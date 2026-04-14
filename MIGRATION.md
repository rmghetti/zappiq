# MIGRATION.md — Roadmap AWS e GCP

## Quando Migrar

**Triggers para considerar migração:**

| Métrica | Threshold | Ação |
|---|---|---|
| Usuários ativos/mês | > 5k | Avaliar ECS Fargate (AWS) ou Cloud Run (GCP) |
| Mensagens/dia | > 100k | Considerar auto-scaling + CDN regional |
| Latência p95 | > 500ms | Avaliar multi-region, regional caching |
| Custo mensal | > $500 | Potencial ROI em commitment discounts |
| Compliance | SOC2, HIPAA, LGPD strict | AWS GovCloud ou GCP com contract de DPA |
| Time size | > 3 eng | Investimento em CI/CD, infra-as-code justificado |

**Janela recomendada:** T + 6–12 meses após lançamento free tier (quando crescimento é validado).

---

## Mapeamento Componente-a-Componente

| Componente | Atual | AWS | GCP | Obs |
|---|---|---|---|---|
| **Next.js Web** | Vercel | S3 + CloudFront | Firebase Hosting ou Cloud Run | Vercel continua viável; GCP oferece CDN global |
| **API Express** | Fly.io shared | ECS Fargate (recommended) / App Runner | Cloud Run (min-instances=1) | Fargate: scaling fino; App Runner: simpler |
| **Python RAG** | Fly.io shared | ECS Fargate | Cloud Run | Colocalizar com API ou region dedicada |
| **PostgreSQL** | Supabase Free | RDS Postgres (standard) com pgvector | Cloud SQL Postgres ou AlloyDB | AlloyDB: mais rápido, caro |
| **Replicação DB** | - | RDS read replicas (multi-AZ) | Cloud SQL read replicas (multi-region) | DR + latência leitura |
| **Redis** | Upstash | ElastiCache standalone | Memorystore Redis | AWS: encryption at rest; GCP: nativo |
| **Object Storage** | - | S3 (documents, logos) | GCS (Cloud Storage) | Integração com CDN nativa |
| **CDN/TLS** | Cloudflare | CloudFront | Cloud CDN | AWS: integra com ACM (cert grátis) |
| **DNS** | Cloudflare | Route53 | Cloud DNS | AWS: health checks nativos; GCP: mais simples |
| **Observabilidade** | Axiom Free | CloudWatch + X-Ray | Cloud Logging + Cloud Trace | AWS: mais integrações; GCP: mais barato |
| **Secrets** | Fly + Vercel | Secrets Manager | Secret Manager | Ambos: audit logs, rotation automática |
| **CI/CD** | GitHub Actions | GitHub Actions → ECR/ECS | GitHub Actions → Artifact Registry/Cloud Run | Configs adicionais, mesma base |
| **VPC/Networking** | - | VPC privadas, security groups | VPC nativa, firewall rules | AWS: mais controle fino |
| **Load Balancer** | Fly nativa | ALB (Application Load Balancer) | Cloud Load Balancing | Ambos: SSL termination, health checks |
| **Auto-scaling** | Manual (min_machines) | Target Tracking / Step Scaling | Autoscaler nativo | AWS: baseado em CPU/custom metrics |
| **Message Queue** | BullMQ + Redis | SQS | Pub/Sub | AWS: mais simples; GCP: mais poderoso |

---

## Estimativa de Custo Mensal (USD)

### Cenário 1: 1k Usuários Ativos/Mês (~5k msgs/dia)

#### AWS
```
EC2 (ECS Fargate):
  - API: 0.5 vCPU, 1 GB RAM, 730h/mês @ $0.01582/vCPU/h, $0.00346/GB/h
    = (0.5 × $0.01582 × 730) + (1 × $0.00346 × 730) = $5.77 + $2.53 = $8.30
  - RAG: 1 vCPU, 2 GB, 100h/mês (spare time) = $1.15 + $0.71 = $1.86
  = Subtotal: $10.16

RDS PostgreSQL (Standard, db.t3.small):
  = $0.053/h × 730h = $38.69 + backup storage $5 = $43.69

ElastiCache Redis (cache.t3.small):
  = $0.034/h × 730h = $24.82

S3 (documents, backups):
  = 10 GB stored @ $0.023/GB + 1 GB transfer @ $0.09/GB = $0.23 + $0.09 = $0.32

CloudFront (100 GB delivered):
  = $0.085/GB × 100 = $8.50

ALB:
  = $16.20/month + $0.006/LCU = ~$16.50

Total AWS 1k: ~$103 + data transfer overhead = ~$110/month
```

#### GCP
```
Cloud Run (API):
  - 0.5 vCPU, 512 MB RAM, 600k invocations/month (avg 10/sec × 730h × 0.7 util)
  - Compute: (600k × 0.001 × 0.5 + 600k × 0.0000050) = $0.30 + $3.00 = $3.30
  - Memory: (600k × 0.001 × 0.5 GB + 600k × 0.0000025) = $0.30 + $1.50 = $1.80
  = Subtotal: $5.10

Cloud SQL (Postgres, db-standard-1):
  = $0.025/h × 730h = $18.25 + backup $1.50 = $19.75

Memorystore Redis (basic-tier 1GB):
  = $0.06/GB/day × 30.44 = $1.82

Cloud Storage (10 GB):
  = $0.020/GB = $0.20

Cloud CDN (100 GB):
  = $0.12/GB = $12.00

Cloud Load Balancer (forwarding rules + LB data):
  = $0.25/month + $0.006/GB = $0.85

Total GCP 1k: ~$39/month + data transfer ($5-10) = ~$50/month
```

**Vencedor 1k:** GCP (2.2x mais barato). Trade-off: AWS oferece mais IPs, monitoring, suporte corporativo.

---

### Cenário 2: 10k Usuários Ativos (~50k msgs/dia)

#### AWS
```
ECS Fargate (API + RAG, 2 replicas cada):
  = $8.30 × 2 (API) + $1.86 × 2 (RAG) = $20.32

RDS PostgreSQL (db.t3.medium, multi-AZ backup):
  = $0.112/h × 730h = $81.76 + $15 (backup) = $96.76

ElastiCache Redis (cache.t3.medium, replicated):
  = $0.067/h × 730h = $48.91 + $5 backup = $53.91

S3 + transfer:
  = 50 GB @ $0.023/GB + 10 GB transfer @ $0.09 = $1.15 + $0.90 = $2.05

CloudFront (1 TB):
  = $0.085/GB × 1000 = $85.00

ALB (2x):
  = $16.20 × 2 = $32.40

Total AWS 10k: ~$291/month + overhead = ~$320/month
```

#### GCP
```
Cloud Run (2 min-instances):
  - 1 vCPU, 1 GB RAM, 6M invocations/month
  - Compute: (6M × 0.0001 × 1 + 6M × 0.000025) = $0.60 + $0.15 = $0.75
  - Memory: (6M × 0.0001 × 1 + 6M × 0.0000025) = $0.60 + $0.015 = $0.615
  - Min instances: 2 × $0.00720/h × 730h = $10.51
  = Subtotal: $11.87

Cloud SQL (db-standard-4, multi-region backup):
  = $0.125/h × 730h = $91.25 + $20 (backup + replica) = $111.25

Memorystore Redis (standard 4GB):
  = $0.24/GB/day × 30.44 × 4 = $29.22

Cloud Storage:
  = 50 GB @ $0.020/GB = $1.00

Cloud CDN (1 TB):
  = $0.12/GB × 1000 = $120.00

Cloud Load Balancer:
  = $0.25 × 2 + $0.006 × 1000 GB = $0.50 + $6.00 = $6.50

Total GCP 10k: ~$166/month + overhead = ~$180/month
```

**Vencedor 10k:** GCP (1.78x mais barato). AWS oferece melhor RLS compliance para clientes enterprise.

---

### Cenário 3: 100k Usuários Ativos (~500k msgs/dia)

#### AWS
```
ECS Fargate (API + RAG, 5 replicas cada, auto-scaling):
  = $8.30 × 5 + $1.86 × 5 + auto-scaling overhead = ~$80

RDS PostgreSQL (db.r6i.2xlarge, multi-AZ + read replicas):
  = $0.936/h × 730h = $683.28 + $50 (replicas, backup) = $733.28

ElastiCache Redis (cache.r6g.xlarge, cluster):
  = $0.219/h × 730h = $159.87 + $20 (replication) = $179.87

S3 (500 GB storage) + Glacier archiving:
  = 500 × $0.023 = $11.50 + $5 (archive) = $16.50

CloudFront (10 TB):
  = $0.085/GB × 10,000 = $850.00

ALB (3-tier):
  = $16.20 × 3 = $48.60

Route53 (1M queries/month):
  = $0.40 + $0.10 = $0.50

CloudWatch + X-Ray:
  = $50 (metrics) + $15 (traces) = $65

Total AWS 100k: ~$1,970/month (+ data transfer egress $200-300)
```

#### GCP
```
Cloud Run (5 min-instances):
  = $0.00720 × 5 × 730h = $26.28 + compute overhead $50 = $76.28

Cloud SQL (db-standard-32, multi-region + automated failover):
  = $1.20/h × 730h = $876.00 + $60 (failover, replicas) = $936.00

Memorystore Redis (premium 16GB, HA):
  = $0.72/GB/day × 30.44 × 16 = $349.76

Cloud Storage (500 GB):
  = 500 × $0.020 = $10.00

Cloud CDN (10 TB):
  = $0.12/GB × 10,000 = $1,200.00

Cloud Load Balancing (regional + global):
  = $0.25 × 2 + $0.006 × 10,000 = $60.50

Cloud Logging + Cloud Trace:
  = $50 (logs) + $20 (traces) = $70

Total GCP 100k: ~$2,573/month (+ some egress)
```

**Vencedor 100k:** AWS (~23% mais barato em compute, mas GCP CDN mais caro). Diferença diminui com volume (negotiated rates).

---

## Decisão AWS vs GCP

### AWS é melhor se:

- ✓ Clientes exigem **SOC2 Type II, HIPAA, FedRAMP** (GCP oferece mas menos maduro)
- ✓ Stack corporativo já usa **EC2, RDS, S3** (learning curve menor)
- ✓ Volume **> 1M msg/dia** (commitment discounts significativos)
- ✓ Múltiplas regiões críticas (AWS: 30 regiões, GCP: 40+ zones)
- ✓ Budget > $500/mês (economies of scale AWS)

### GCP é melhor se:

- ✓ **Custo é prioridade** (30-40% mais barato até 100k users)
- ✓ Stack moderno: **Kubernetes, Cloud Native** (GCP nativo)
- ✓ **BigQuery + IA/ML** analytics (Vertex AI), não needed here
- ✓ Team familiar com **Google Cloud** (Firebase, Cloud Functions)
- ✓ Compliance **LGPD simples** (ISO 27001, DPA padrão)

### Recomendação ZappIQ:

**AWS ECS Fargate** como primeira migração:
- Transição suave de Fly.io (similar container approach)
- RDS + pgvector estabelecido, suporte vendor
- CloudFront + ALB robustos
- **Custo total aceitável** se clientes B2B premium couberem no orçamento

---

## Plano de Migração Detalhado (10 Fases)

### Fase 0: Avaliação (1 semana)

**Tarefas:**
1. Audit código para AWS/GCP incompatibilities (ex: hardcoded localhost, Fly-specific configs)
2. Load test atual (k6, Apache JMeter) para baseline
3. Capturar dados atuais: tamanho DB, número de contacts, redis memory
4. Documentar SLA alvo (RTO, RPO, uptime %)
5. **Saída:** relatório "Go/No-Go" com riscos arquiteturais

### Fase 1: Provisioning Cloud (2 semanas)

**AWS:**
1. Criar conta AWS (com MFA, billing alerts)
2. VPC setup: subnets privadas (API), públicas (ALB)
3. RDS PostgreSQL provisionado (db.t3.small, multi-AZ standy)
4. ElastiCache Redis (cache.t3.small, cluster mode disabled)
5. S3 bucket (versioning, encryption at rest)
6. CloudFront distribution (S3 origin, compress, cache headers)
7. ALB + Target Groups
8. Secrets Manager (todos os 15+ secrets)
9. CloudWatch + CloudWatch Logs enabled

**GCP equivalente:** Cloud Run project, Cloud SQL, Memorystore, Cloud Storage, Cloud CDN.

**Saída:** Infraestrutura em código (Terraform ou CDK), testado mas vazio.

### Fase 2: Containerização & ECR (1 semana)

**AWS:**
1. Reescrever Dockerfiles para ECR (Fargate compatible)
2. Multi-arch builds (arm64 + amd64, Fargate uses graviton2)
3. Push images a ECR (private registry)
4. Test local com `docker-compose` usando ECR images

**Saída:** ECR repositories para api, web (if containerized), rag.

### Fase 3: Data Migration (1–2 semanas, **downtime planeado**)

**Pre-migration:**
1. Backup completo Supabase (via `pg_dump`)
2. Export Redis data (via `bgsave`)
3. Export contact/conversation assets (logos, documents)

**Migração:**
1. RDS: `pg_restore` do dump (com zero advisory lock flag)
2. Run `prisma db push --skip-generate` em release machine
3. S3: upload assets (documents, templates)
4. ElastiCache: carregue Redis snapshot

**Validação:**
1. Row count match (contacts, conversations, audit logs)
2. Constraint integrity (foreign keys, unique indexes)
3. Hash sample AuditLog entries (SHA-256 chain deve estar íntegro)

**Saída:** DB + Storage sincronizados, nenhuma mutação em live (Read-only).

### Fase 4: ECS Task Definition & Deployment (2 semanas)

**AWS:**
1. Criar ECS cluster (Fargate launch type)
2. Define task for API (0.5-1 vCPU, 1-2 GB RAM)
3. Define task para RAG (se migrado; senão manter em Fly)
4. Setup ALB + target group, health checks (`/health`)
5. Deploy inicial (v0 = Canary, 1 replica)
6. Verify health check passes

**Smoke test:**
```bash
curl http://<ALB-DNS>/health
# Expected: { status: ok }
```

**Saída:** API rodando em ECS, health OK, pronta para tráfego.

### Fase 5: DNS Switchover (Canary + Shadow) (~1 semana)

**Canary (10% traffic):**
1. Cloudflare: 10% das requisições para novo ALB, 90% para Fly.io
2. Monitorar error rate, latency, logs
3. Se tudo OK, ir para 50%

**Shadow (read-only mirror):**
1. Mesmo log Postgres para análise comparativa
2. Parallel requests (opcional, custo 2x)

**Saída:** Tráfego gradualmente shifted para AWS, ambos logs comparáveis.

### Fase 6: Rollback Plan (Antes de 100%) — 1 dia

**Critério rollback:**
- Error rate > 1% (vs < 0.1% atual)
- Latency p95 > 1s (vs 300ms atual)
- DB constraint violations detected

**Executar rollback:**
```bash
# Cloudflare: instant 100% → Fly.io
cloudflare_set_routing("zappiq.com.br", "fly.io", 100)
```

**Saída:** Rollback < 5 min, zero data loss.

### Fase 7: Full Cutover (100%) — 1 dia

**Quando:** Após 48h de canary sem incident.

1. Cloudflare: 100% → ALB
2. Monitorar 24h contínuas
3. Fly.io: parar máquinas (manter app para fallback)

**Saída:** 100% traffic em AWS, Fly.io standby.

### Fase 8: Decommission Supabase/Upstash (~1 semana)

1. Backup final Supabase (snapshot)
2. Aguardar 30d antes de deletar (compliance, audit)
3. Supabase: downgrade para Hobby ou delete
4. Upstash: downgrade para free

**Saída:** Redução mensal $50-100, menos provedores gerenciar.

### Fase 9: Observabilidade Full-Stack (2 semanas)

1. CloudWatch + X-Ray tracing (end-to-end)
2. Alertas de uptime, error rate, latency
3. Dashboard Grafana (opcional, integra CloudWatch)
4. Log aggregation (CloudWatch Logs, Athena queries)

**Saída:** Full observability, alertas proactivos.

### Fase 10: Validação & Knowledge Transfer (1 semana)

1. Runbook "Deploy em AWS" (similar a DEPLOY.md)
2. Runbook "Scale up/down RDS, Fargate"
3. Disaster recovery test (RTO/RPO validation)
4. Team training (AWS console, Fargate, RDS management)

**Saída:** Operação da infraestrutura documentada, time treinado.

---

## Checklist de Migração por Etapa

```markdown
### Fase 0: Avaliação
- [ ] Audit code para incompatibilidades cloud
- [ ] Load test baseline capturado
- [ ] SLA alvo documentado
- [ ] Riscos identificados
- [ ] Go/No-Go assinado

### Fase 1: Provisioning
- [ ] AWS account criada
- [ ] VPC + subnets + security groups
- [ ] RDS Postgres provisionado (multi-AZ)
- [ ] ElastiCache Redis provisionado
- [ ] S3 bucket + versioning
- [ ] CloudFront distribuição ativa
- [ ] ALB + target groups
- [ ] Secrets Manager populated

### Fase 2: Containerização
- [ ] Dockerfiles reescritos para Fargate
- [ ] Multi-arch builds testados
- [ ] ECR images pushed
- [ ] Local test com ECR images OK

### Fase 3: Data Migration
- [ ] Backup Supabase completo
- [ ] Backup Redis capturado
- [ ] pg_restore para RDS OK
- [ ] prisma db push OK
- [ ] Assets uploaded a S3
- [ ] Redis carregado em ElastiCache
- [ ] Row count match validado
- [ ] Audit log SHA-256 chain intacta

### Fase 4: ECS Deployment
- [ ] ECS cluster criado
- [ ] Task definition para API
- [ ] Task definition para RAG (se migrado)
- [ ] ALB health check verde
- [ ] API v0 canary running

### Fase 5: Canary DNS Switch
- [ ] Cloudflare routing 10% → ALB
- [ ] Error rate < 0.5%
- [ ] Latency p95 < 500ms
- [ ] Escalate para 50%
- [ ] 48h stable

### Fase 6: Rollback Tested
- [ ] Rollback < 5min time validated
- [ ] Runbook escrito
- [ ] Team trained

### Fase 7: Full Cutover
- [ ] Cloudflare 100% → ALB
- [ ] 24h stability confirmar
- [ ] Fly.io maquinas paradas (standby)

### Fase 8: Decommission
- [ ] Supabase backup final
- [ ] Upstash backup final
- [ ] 30d waiting period iniciado
- [ ] Provedores downgraded

### Fase 9: Observability
- [ ] CloudWatch + X-Ray setup
- [ ] Alertas configuradas
- [ ] Dashboard Grafana (opt)
- [ ] Team acesso validado

### Fase 10: Knowledge Transfer
- [ ] AWS runbooks escritos
- [ ] Team training completed
- [ ] DR test passed (RTO/RPO OK)
- [ ] Go-live approved
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Data corruption during migration | Média | Crítico | pg_dump + restore test prévio, checksum verify |
| DNS propagation delay (>1h) | Baixa | Alto | Cloudflare instant propagation, TTL=1m pre-cutover |
| ECS task crash loop | Média | Crítico | Health check timeout=60s, task stop->start, logs review |
| RLS policies quebradas pós-migration | Baixa | Alto | Test RLS queries em staging antes de cutover |
| CloudFront cache stale (old .js) | Média | Médio | Invalidate cache path `/` pós-deploy, version assets |
| Budget overrun (3x estimado) | Baixa-Média | Alto | Set CloudWatch budget alerts $200/day, auto-shutdown rules |
| SSL cert renewal forgotten | Muito Baixa | Médio | AWS ACM auto-renew nativo, monitoring alertas |
| DB connection pool exhausted | Baixa | Crítico | RDS proxy (database proxy layer), scale up db.t3.medium |

---

## Pós-Migração: Otimizações

1. **Database:** Analyze query plans, criar índices em `(organizationId, createdAt)` para filtros comuns
2. **Caching:** Implementar CloudFront behaviors (cache .js/css 1 ano, /api 1 min)
3. **Fargate:** Tune vCPU/memory ratio, test com reserved capacity discounts
4. **Multi-region:** Considerar RDS read replica em us-east-1 (reduzir latência pra clientes US)
5. **Backup:** Habilitar automated backup + cross-region snapshot copy

---

## Referências

- [AWS ECS Fargate Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
- [AWS RDS Postgres + pgvector](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html)
- [GCP Cloud Run Scaling](https://cloud.google.com/run/docs/configuring/min-instances)
- [Prisma on AWS RDS](https://www.prisma.io/docs/orm/prisma-client/deployment/edge#aws-lambda-and-rds-proxy)
