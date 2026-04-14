# Upstash Redis — Cache e Pub/Sub para ZappIQ

Documentação de setup e operação do Upstash Redis como cache distribuído e message broker.

## Criação da Instância

1. Acesse [upstash.com](https://upstash.com)
2. Faça login ou crie conta
3. Clique em **Create Database** (Redis)
4. Configure:
   - **Type**: Redis
   - **Database name**: `zappiq-redis` ou similar
   - **Region**: 
     - Escolha a mesma região do Fly.io (ex: `us-east-1` se Fly em iad, `sa-east-1` se em gru)
     - Latência mínima se co-located
   - **Plano**:
     - **Free**: 10k commands/dia, 256MB, bom para staging
     - **Pro**: Pay-as-you-go, $0.2 por 100k commands, recomendado para produção (sem throttling)

Aguarde ~1-2 minutos até a instância estar pronta.

## Credenciais

No dashboard Upstash, abra a instância e copie a **REDIS_URL**:

```
rediss://default:[PASSWORD]@[ENDPOINT]:[PORT]
```

**Características**:
- Protocolo `rediss://` (TLS obrigatório)
- Autenticação via `default` (username) + password
- Port 443 (HTTPS) ou custom port 

**Nunca armazene em código** — use secrets do Fly.io / GitHub.

## Configuração em Secrets

### Fly.io

```bash
flyctl secrets set REDIS_URL='rediss://default:...'
```

### GitHub Actions (se necessário)

```bash
gh secret set REDIS_URL
```

## Integração com BullMQ

ZappIQ usa BullMQ para filas de jobs (ex: envio de mensagens WhatsApp, processamento em background).

### Configuração Recomendada

```typescript
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  // Reconnect strategy: exponential backoff
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

const queue = new Queue('whatsapp-send', { connection: redis });

// Worker (consumer)
const worker = new Worker('whatsapp-send', async (job) => {
  // Process job...
}, { connection: redis });

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job.id} failed:`, err));
```

### Connection Pooling

BullMQ cria automaticamente pools. Para otimizar:
- Mantenha **1 connection por queue** (reuso via singleton)
- Use `enableReadyCheck: false` (Upstash não suporta)
- Configure `maxRetriesPerRequest: null` (BullMQ requirement)

## Monitoramento

### Dashboard Upstash

Vá para **Monitoring** na instância:
- **Requests/sec**: Taxa de comandos
- **Latency (avg/p99)**: Latência de roundtrip
- **Memory**: Uso atual vs limite
- **Connected Clients**: Número de conexões ativas

### Alertas

Configure alertas em **Settings**:
- CPU > 80%
- Memory > 90%
- Commands/day > plano (Free = 10k/dia)

## Rate Limiting

**Plano Free**: 10,000 commands/dia (throttled após limite).

Se ZappIQ atingir limite:
1. Upgrade para Pro (pay-as-you-go)
2. Otimize queries Redis:
   - Use pipelining em vez de roundtrips individuais
   - Reduz TTL de caches em memória
   - Considera in-memory cache local (LRU) para hits quentes

Exemplo de pipelining:

```typescript
const pipeline = redis.pipeline();
pipeline.get('key1');
pipeline.get('key2');
pipeline.get('key3');
const results = await pipeline.exec();
```

## TLS e Segurança

Upstash **força TLS** (rediss://).

Certifique-se de:
- Usar `rediss://` (duplo 's'), não `redis://`
- Certificado é auto-assinado (Upstash gerencia)
- Firewall: apenas autorize conexões de Fly.io e GitHub (Upstash faz isso automaticamente)

## Troubleshooting

### Connection Refused

**Sintoma**: `ECONNREFUSED` ou `timeout`

**Causa**: Endpoint/porta errados ou TLS não ativado.

**Solução**:
1. Copie URL exata do dashboard Upstash
2. Confirme `rediss://`, não `redis://`
3. Teste com `redis-cli -u REDIS_URL ping`

### Commands Exceeded (Free Plan)

**Sintoma**: Requests retornam erro após 10k commands/dia.

**Solução**: Upgrade para Pro ou reduz frequência de queries.

### High Latency (>100ms avg)

**Causa**: Região diferente de Fly.io ou congestionamento.

**Solução**:
1. Confirme região Redis = região Fly.io
2. Mude para região mais próxima
3. Monitore CPU/Memory no dashboard

## Backup (Pro Only)

No plano Pro, Upstash oferece snapshots diários.

Para restore manual:
1. Dashboard → **Backups**
2. Escolha snapshot e clique "Restore"
3. Cria nova instância (antiga permanece ativa)

## Próximos Passos

- [ ] Criar instância Upstash (region = Fly region)
- [ ] Copiar REDIS_URL e configurar secrets (Fly/GitHub)
- [ ] Integrar com BullMQ em apps/api
- [ ] Testar jobs em staging (redis-cli)
- [ ] Monitorar latência nas primeiras 48h
