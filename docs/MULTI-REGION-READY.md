# Multi-Região — Arquitetura preparada, ativação sob demanda

## Status atual (abril/2026)

**Operação:** single-region, `gru` (São Paulo).
**Arquitetura:** preparada para multi-região — ativação é decisão comercial/operacional, não refatoração.

## Por que não ativar agora

- Toda operação e base de clientes no Brasil → latência `gru` é suficiente
- Dados de titulares brasileiros em território nacional (conformidade LGPD facilitada — sem transferência internacional Art. 33)
- Custo de multi-região sem demanda = capital empatado sem retorno
- Supabase read replicas + Redis global não fazem diferença até ter >100ms RTT percebido pelo usuário

## O que já está preparado

### 1. Fly.io — configuração suporta adição de regiões

`fly.toml` usa `primary_region = "gru"` e `http_service` genérico. Adicionar região é:

```bash
# Comando único, não requer mudança de código
fly machines clone <machine-id> --region <region-code> -a zappiq-api
```

Regiões Fly.io relevantes:
- `gru` — São Paulo (atual)
- `gig` — Rio de Janeiro (secundária BR, failover natural)
- `mia` — Miami (gateway latino-americano)
- `iad` — Virginia (EUA leste, expansão norte-americana)
- `cdg` — Paris (EU, expansão europeia)

### 2. Banco de dados — Supabase read replicas

Supabase Pro tier suporta read replicas geograficamente distribuídas. Para ativar:

1. Supabase Dashboard → Database → Read Replicas
2. Adicionar replica em região alvo
3. App detecta `DATABASE_URL_READ_REPLICA_<region>` e roteia leituras

Writes permanecem no `primary_region` para manter consistência (eventual consistency em leituras é aceitável para analytics/reports).

### 3. Redis — Upstash com Global Database

Upstash oferece Global Database com replicação automática. Migração single-region → global:

1. Upstash Console → Create Global Database
2. Trocar `REDIS_URL` no Fly secrets
3. Leitura local em cada região, writes propagados

### 4. CDN — Vercel Edge Network (frontend)

Next.js no Vercel já é multi-região nativo. Zero ajuste necessário no frontend quando expandir.

### 5. WhatsApp Business API

Meta API é global. Rate limits são por phone_number_id, não por região. Sem ajuste necessário.

### 6. OTel / Observabilidade

Grafana Cloud aceita telemetria de múltiplas regiões. Basta adicionar tag `region=<code>` nos resource attributes. Já preparado em `.env.example`:

```
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,region=gru
```

## Trigger de ativação

Revisar decisão de multi-região quando **qualquer** um dos gatilhos disparar:

| Gatilho                                              | Ação                                                     |
|------------------------------------------------------|----------------------------------------------------------|
| Cliente com usuários em >100ms de latência de `gru` | Adicionar região edge (`gig` para BR-norte/nordeste)     |
| Primeiro cliente fora do Brasil                      | Abrir região em país alvo (`mia` LatAm, `iad` EUA, etc.) |
| Contrato Enterprise exige disaster recovery geográfico | Ativar DR em `gig` (read replica + failover automation) |
| >10.000 requests/s sustentado                        | Geo-balance entre 2+ regiões                             |
| Compliance do cliente exige dados em região específica | Ativar isolamento regional                               |

## Custo estimado de ativação

### Opção 1: Apenas DR (disaster recovery passivo)

- Fly: 2 machines em `gig` (idle, standby) → ~US$ 4/mês
- Supabase: read replica → já incluído no Pro tier ZappIQ (US$ 25/mês)
- Total incremental: **~US$ 4/mês**

### Opção 2: Active-active 2 regiões BR

- Fly: 2 machines extras ativas em `gig` → ~US$ 8/mês
- Supabase read replica → incluído
- Upstash Global Database → +US$ 10/mês
- Total incremental: **~US$ 18/mês**

### Opção 3: Expansão internacional

- Fly: 2 machines por região alvo → US$ 8/mês por região
- Supabase: replica por região → US$ 25/mês por região adicional (Pro tier separado)
- Upstash Global → US$ 10/mês (uma vez)
- Total por região internacional: **~US$ 33–35/mês**

## Checklist de ativação quando decidir

- [ ] Confirmar trigger comercial/operacional documentado
- [ ] Adicionar região no `fly.toml` como `[[regions]]`
- [ ] `fly machines clone` nas regiões alvo
- [ ] Configurar Supabase read replica(s)
- [ ] Migrar Redis para Upstash Global (se necessário)
- [ ] Atualizar `OTEL_RESOURCE_ATTRIBUTES` por região
- [ ] Executar `scripts/smoke-test.sh` regional
- [ ] Ajustar alertas Fly para monitorar todas as regiões
- [ ] Documentar latência esperada por região para clientes
- [ ] Atualizar `docs/SLA.md` com compromissos regionais
- [ ] Testar failover (derrubar região primária intencionalmente em janela de manutenção)

## Observações LGPD para expansão internacional

Se adicionar região fora do Brasil, revisar:

- **Art. 33 da LGPD** — transferência internacional de dados só com garantias adequadas (país com nível de proteção equivalente, cláusulas contratuais, normas corporativas globais, consentimento específico do titular, etc.)
- Atualizar Política de Privacidade declarando países de destino
- Incluir cláusula em DPA Enterprise sobre localização de dados
- Avaliar certificação adequada (ex: GDPR para EU)

Enquanto a operação permanecer 100% no Brasil (situação atual e planejada para 2026), não há implicação de Art. 33.
