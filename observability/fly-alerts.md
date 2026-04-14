# Fly.io — Alertas de infraestrutura

Alertas nativos do Fly cobrem a camada de máquina/plataforma. Complementam os alertas de negócio/aplicação que ficam no Grafana (ver `README.md` nesta pasta).

## Filosofia

- **Fly alerts** = "a caixa tá de pé?" (CPU, memory, process crash, deploy failure)
- **Grafana alerts** = "a aplicação tá fazendo o que deveria?" (error rate, latência p95, queue backlog, LLM rate limit)

Se Fly avisar e Grafana não, provavelmente é um problema de capacity. Se Grafana avisar e Fly não, é bug de código ou dependência externa.

## Configuração via dashboard Fly

https://fly.io/apps/zappiq-api/monitoring → Alerts

### 1. Machine CPU alto — SEV3

- **Condição:** `avg(cpu_percent) > 80` por 5min
- **Canal:** Slack `#zappiq-alerts`
- **Racional:** 80% sustentado = risco de saturar no próximo spike. Não é urgente (ainda responde), mas precisa escalar ou otimizar.
- **Ação automática:** nenhuma. Investigar se é tráfego orgânico (scale up) ou query pesada (otimizar).

### 2. Machine memory alto — SEV2

- **Condição:** `memory_used_pct > 90` por 3min
- **Canal:** PagerDuty `zappiq-oncall`
- **Racional:** Fly mata OOM a 100%. 90% + 3min = iminente. Memory leak em Node geralmente escala linear.
- **Ação automática:** `fly machines restart` se ocorrer 2x em 1h (configurar via Fly machines auto-restart se disponível na sua plan).

### 3. Machine crash / restart loop — SEV1

- **Condição:** >2 restarts em 10min OU `status=failed`
- **Canal:** PagerDuty `zappiq-oncall` (nível urgent)
- **Racional:** Loop de crash = serviço indisponível mesmo que health check individual passe. Pode ser bug na inicialização.
- **Primeiro passo:** `fly logs -a zappiq-api | tail -200` e verificar stack trace na startup.

### 4. Deploy failed — SEV2

- **Condição:** deploy termina com `status != succeeded`
- **Canal:** Slack `#zappiq-deploys`
- **Racional:** Deploy falhou = release ficou pela metade. Com rolling deploy (`min_machines_running=2`) máquina velha continua servindo, mas nova release está bloqueada.
- **Ação:** `fly releases -a zappiq-api` + `fly status` para ver qual máquina está em qual versão.

### 5. Health check `/ready` falhando — SEV2

- **Condição:** `[checks.ready]` 503 por >2min em alguma máquina
- **Canal:** Slack `#zappiq-alerts`
- **Racional:** Healthcheck /ready verifica Postgres+Redis. Se falha, dependência externa caiu ou connection pool exaurido.
- **Próximo passo:** seção 2 ou 3 do `RUNBOOK-INCIDENT.md`.

### 6. HTTPS service 5xx rate — SEV2

- **Condição:** `http_responses{status=~"5.."} / http_responses > 0.01` por 5min
- **Canal:** PagerDuty `zappiq-oncall`
- **Racional:** Fly proxy conta 5xx por app, então pega erros que nem chegam a ser instrumentados pelo OTel.
- **Próximo passo:** seção 1 do `RUNBOOK-INCIDENT.md`.

### 7. Machine stopped quando deveria estar rodando — SEV2

- **Condição:** `machines_running < 2` por 3min (min_machines_running=2 violado)
- **Canal:** Slack `#zappiq-alerts`
- **Racional:** Rolling deploy depende de 2 máquinas. Se cair pra 1, próxima restart derruba o serviço.
- **Ação:** `fly machines list -a zappiq-api` + `fly machines start <id>`.

## Configuração via CLI

Para quem prefere gerenciar no git:

```bash
# Criar alert via API (placeholders — checar docs Fly atuais)
fly doctor
# Fly ainda não tem `fly alerts create` CLI formal. Usar UI ou Terraform provider:
# https://registry.terraform.io/providers/fly-apps/fly
```

Alternativa: `fly_alert` resource do Terraform provider da Fly permite versionar no git.

## Integração com escalation

| Severidade | Canal primário          | Secundário (15min sem ACK) | Terciário (30min) |
|------------|-------------------------|----------------------------|-------------------|
| SEV1       | PagerDuty urgent         | SMS + ligar                | Acionar diretoria |
| SEV2       | PagerDuty normal         | Slack `#zappiq-alerts`     | PagerDuty urgent  |
| SEV3       | Slack `#zappiq-alerts`   | —                          | —                 |

Rotação PagerDuty `zappiq-oncall` definida no plantão. Documentada em `docs/RUNBOOK-INCIDENT.md` apêndice.

## Healthcheck — o que `/ready` cobre

Referência rápida do que o endpoint `/ready` verifica (em `apps/api/src/routes/health.ts`):

1. `SELECT 1` no Postgres via Prisma (timeout 2s)
2. `PING` no Redis (timeout 1s)
3. Retorna `{postgres: true, redis: true}` + 200 se OK, 503 se qualquer falha

Alertas Fly devem usar `/ready` (não `/health`) para ter sinal de dependência externa. `/health` só prova que o processo Node está respondendo.

## Custo

Fly alerts são gratuitos na plan atual. Incluídos até 20 alertas por org (ver pricing atual).

PagerDuty free tier: 5 users, rotações ilimitadas. Plan Pro (~US$ 21/user/mes) libera SMS/ligação.
