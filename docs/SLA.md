# SLA — Service Level Agreement ZappIQ

**Versão:** 1.0 — abril/2026
**Aplicável a:** plano Enterprise (obrigações contratuais). Demais planos seguem "best effort" conforme especificado abaixo.

---

## 1. Objetivo

Este documento define os níveis de serviço (SLA) garantidos pela ZappIQ aos clientes que contratam o plano Enterprise. Estabelece compromissos de uptime, créditos em caso de descumprimento, metas de recuperação de desastre (RPO/RTO) e métricas auxiliares.

## 2. Metas de disponibilidade

### 2.1 Por plano

| Plano       | Uptime                  | Mensuração                              | Relatório                           |
|-------------|-------------------------|------------------------------------------|-------------------------------------|
| Starter     | Best effort (sem garantia contratual) | Monitoramento interno              | Sob solicitação                     |
| Growth      | Best effort             | Monitoramento interno                    | Sob solicitação                     |
| Scale       | 99,5% alvo (sem créditos automáticos) | Status page público                 | Público mensal                      |
| **Enterprise** | **99,9% contratual** | Healthcheck a cada 15s multi-região    | Público + e-mail cliente            |

### 2.2 Tradução prática

99,9% de uptime = no máximo **43 minutos e 12 segundos de indisponibilidade por mês** (base 30 dias).

## 3. Escopo do SLA

### 3.1 Serviços cobertos

- API principal (`api.zappiq.com.br` / `/api/*`)
- Dashboard web
- Webhooks outbound
- Portal de DSR
- RAG service (Pulse AI)
- Spark Campaigns (disparos em massa)

### 3.2 Exclusões

O SLA **não cobre** indisponibilidade causada por:

1. **Manutenção programada** — anunciada com 7 dias de antecedência via e-mail + banner no app. Janela padrão: domingo 02h-06h BRT (baixa utilização).
2. **Indisponibilidade de integrações de terceiros** fora do controle ZappIQ — WhatsApp Business API (Meta), Stripe, Google Calendar, etc. Registramos esses eventos no status page para transparência, mas não contam para SLA.
3. **Força maior** — desastres naturais, conflito armado, greves generalizadas, ataques em escala global de infraestrutura (AWS full-region outage, Cloudflare global outage).
4. **Uso em violação dos Termos de Uso** — spam, abuse de API, tentativa de burlar rate limit.
5. **Problemas causados pelo cliente** — configuração errada, dados corrompidos por scripts próprios, ataques originados do próprio ambiente do cliente.
6. **Ataques DDoS** em escala que exceda a proteção do provider de infraestrutura (Fly.io edge).

## 4. Créditos por descumprimento (Enterprise)

### 4.1 Tabela de créditos

| Uptime mensurado no mês          | Crédito aplicado              |
|----------------------------------|-------------------------------|
| ≥ 99,9%                          | Nenhum (SLA cumprido)         |
| < 99,9% e ≥ 99,0%                | 10% da mensalidade do plano   |
| < 99,0% e ≥ 95,0%                | 25% da mensalidade do plano   |
| < 95,0%                          | 50% da mensalidade do plano   |

### 4.2 Aplicação do crédito

- Aplicado automaticamente na fatura do mês seguinte
- Não requer abertura de ticket nem solicitação formal
- Se o cliente não tiver mensalidade pendente (ex: cancelou), crédito é convertido em devolução via mesmo meio de pagamento original
- Crédito máximo em um único mês: 50% da mensalidade
- Créditos não substituem: (a) resolução do incidente, (b) direito a rescisão contratual conforme cláusula contratual padrão, (c) indenização por danos indiretos ou lucro cessante — nenhum dos quais é reconhecido aqui sem previsão contratual específica

### 4.3 Limites

- Créditos SLA são a única forma de compensação por descumprimento deste SLA.
- Não aplicáveis cumulativamente com outros descontos promocionais ou créditos comerciais.
- Limitados a 50% da mensalidade do mês afetado.

## 5. Metas de recuperação de desastre

### 5.1 RPO (Recovery Point Objective)

Quanto de dado pode ser perdido em um disaster recovery:

| Plano       | RPO           | Estratégia técnica                                               |
|-------------|---------------|------------------------------------------------------------------|
| Starter     | 24h           | Backup diário incremental Supabase                               |
| Growth      | 24h           | Backup diário incremental Supabase                               |
| Scale       | 4h            | PITR (Point-in-Time Recovery) Supabase                            |
| Enterprise  | **1h**        | PITR Supabase + WAL shipping monitorado + backup semanal S3 cifrado |

### 5.2 RTO (Recovery Time Objective)

Tempo máximo para retomar o serviço:

| Plano       | RTO           |
|-------------|---------------|
| Starter     | 24h           |
| Growth      | 24h           |
| Scale       | 8h            |
| Enterprise  | **4h**        |

### 5.3 Validação

Validamos a viabilidade do RPO/RTO via:

- **Mensal:** execução de `scripts/validate-restore.sh` (restore em sandbox a partir do backup mais recente)
- **Trimestral:** chaos engineering — derrubar proposital uma máquina Fly em horário de baixa utilização e cronometrar recuperação
- **Anual:** DR drill completa (restore full em sandbox + smoke tests + comparação de delta de dados)

## 6. Mensuração de uptime

### 6.1 Como medimos

- **Healthcheck endpoint:** `/ready` (não apenas `/health`) — valida resposta do Postgres e Redis, não só do processo Node
- **Frequência:** a cada 15 segundos
- **Pontos de origem:** múltiplas regiões Fly.io (evita falso positivo por falha regional do monitoramento)
- **Threshold:** dois checks consecutivos com falha = evento de downtime iniciado; dois checks consecutivos com sucesso = evento encerrado
- **Granularidade:** downtime contabilizado em segundos

### 6.2 Cálculo mensal

```
uptime_% = (tempo_total_mês - tempo_downtime_não_excluído) / tempo_total_mês × 100
```

### 6.3 Relatório

Publicamos no **primeiro dia útil** do mês seguinte em `https://status.zappiq.com.br`:

- Uptime total do mês
- Lista de eventos de downtime (data, duração, causa raiz resumida)
- Postmortems dos eventos SEV1 e SEV2 ocorridos no mês
- Gráfico histórico dos últimos 12 meses

Clientes Enterprise recebem adicionalmente por e-mail um relatório mensal com:

- Uptime específico do serviço por endpoint
- Latência p50/p95/p99
- Volume de requisições
- Eventuais créditos aplicados

## 7. Canais de comunicação em incidente

### 7.1 Durante incidente SEV1/SEV2

- **Status page:** atualização em tempo real (`status.zappiq.com.br`)
- **E-mail:** clientes Enterprise recebem notificação automática em <15min após detecção
- **WhatsApp:** notificação ao contato de emergência cadastrado pelo cliente Enterprise
- **Postmortem público:** publicado em até 72h após resolução

### 7.2 Para o cliente reportar incidente

Enterprise tem canais dedicados:

- **WhatsApp emergencial:** número fornecido em contrato (SLA de primeira resposta: 15 minutos úteis)
- **E-mail:** enterprise-support@zappiq.com (SLA: 30 minutos úteis)
- **Telefone:** fornecido em contrato (24/7)

Demais planos: suporte via app (SLA: 2h business hours, 24h fora).

## 8. Severidade de incidentes

| Severidade | Definição                                                                         | Tempo de primeira resposta (Enterprise) | Tempo de resolução alvo |
|------------|-----------------------------------------------------------------------------------|------------------------------------------|--------------------------|
| SEV1       | Serviço totalmente indisponível ou perda/comprometimento de dados                  | 15 minutos                                | 4 horas                  |
| SEV2       | Funcionalidade crítica indisponível ou performance severamente degradada           | 30 minutos                                | 8 horas                  |
| SEV3       | Funcionalidade não-crítica afetada ou bug com workaround                            | 2 horas úteis                             | 3 dias úteis             |
| SEV4       | Solicitação de melhoria, dúvida, suporte geral                                      | 4 horas úteis                             | 5 dias úteis             |

## 9. Performance — metas não-SLA (transparência)

Embora não sejam obrigações contratuais, monitoramos e disponibilizamos:

| Métrica                                          | Meta interna           |
|--------------------------------------------------|------------------------|
| Latência p50 API                                 | < 100ms                |
| Latência p95 API                                 | < 400ms                |
| Latência p99 API                                 | < 1s                   |
| Latência primeira resposta Pulse AI              | < 3s (mediana)         |
| Tempo de entrega de disparo Spark (single)       | < 5s p95               |
| Throughput de disparos Spark                     | 1.000/min por conta    |
| Latência de busca RAG p95                        | < 800ms                |

Degradação sustentada dessas métricas dispara alertas internos e postmortem, mesmo sem impacto em uptime formal.

## 10. Revisão do SLA

- **Semestral:** revisão interna para ajustar metas conforme histórico real de operação
- **Ao cliente:** qualquer alteração de SLA contra o cliente exige 90 dias de notificação antes de entrar em vigor
- **Versionamento:** cada versão deste SLA fica arquivada em `docs/sla-history/` para referência de contratos existentes

## 11. Histórico de versões

| Versão | Data       | Alteração          | Responsável     |
|--------|------------|---------------------|-----------------|
| 1.0    | 2026-04-14 | Versão inicial     | Rodrigo Ghetti  |

---

**Contato para questões de SLA:**
- Comercial: sales@zappiq.com
- Operações: ops@zappiq.com
- DPO: dpo@zappiq.com
