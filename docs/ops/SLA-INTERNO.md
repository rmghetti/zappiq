# SLA Interno — ZappIQ

**Versão:** 1.0  
**Data:** 2026-04-15  
**Autor:** Rodrigo Ghetti  
**Público:** Ops, Dev, CEO, Billing  
**Objetivo:** Compromissos operacionais internos por tier

---

## 1. Uptime Target por Tier

Janela de medição: 30 dias calendário, a partir do 1º dia de cobrança.

| Tier | Uptime Target | Downtime Permitido/Mês | Crédito se Breach | SLA Público |
|------|---------------|------------------------|--------------------|-------------|
| **Starter** | 99.5% | ≤3h 36min | Não publicado | Nenhum |
| **Growth** | 99.7% | ≤2h 9min | Nenhum | 99.5% (conservador) |
| **Scale** | 99.9% | ≤26 min | Automático (ver 3.3) | 99.8% (conservador) |
| **Business** | 99.95% | ≤13 min | Automático (ver 3.3) | 99.9% (conservador) |
| **Enterprise** | 99.99% | ≤2.6 min | Automático + call | 99.95% (conservador) |

**Definição de uptime:** ≥80% de requisições de API respondendo com status <500 em janela de 5 minutos.  
**Medição:** Aggregação de Sentry + OpenTelemetry sobre infraestrutura Fly.io.

---

## 2. Tempo de Resposta a Ticket por Tier

**Definição:** Primeiro response do time de suporte, não resolução.

| Tier | Primeiro Response | Resolução Esperada | Horário |
|------|-------------------|--------------------|---------|
| **Starter** | 48h | 5 dias úteis | Business hours BRT |
| **Growth** | 24h | 2 dias úteis | Business hours BRT |
| **Scale** | 8h | 24h | Business hours BRT |
| **Business** | 2h | 8h | Business hours + evenings |
| **Enterprise** | 1h | 4h | 24/7 (SLA crítico) |

**Canais:**
- Starter/Growth: E-mail + chat in-app (assíncrono)
- Scale+: Prioridade em queue, chat + e-mail
- Business/Enterprise: Slack dedicado + phone

**Fora de horário:** Starter-Scale não garantem resposta. Business/Enterprise escalável à noite.

---

## 3. Janelas de Manutenção Agendada

**Janela padrão:** Domingos 02h00-04h00 BRT (UTC-3)

**Critério:**
- Máximo 1 janela por semana
- Aviso mínimo de 7 dias em `/status`
- Duração: 2h, não extender para 4h exceto em caso de problema

**O que pode:**
- Deploy de features
- Upgrade de dependências
- Rebalancing de carga
- Backup/snapshot

**O que NÃO pode durante janela:**
- Rollback sem notificação extra
- Mudança de schemas críticos sem migration path

**Comunicação:**
- D-7: Aviso em dashboard + e-mail
- D-0 02h: Status page "🟡 MAINTENANCE IN PROGRESS"
- D-0 04h: Status page "🟢 MAINTENANCE COMPLETE"

---

## 4. Política de Créditos em Breach de SLA

### 4.1 — Breach de Uptime

**Cálculo:** (Downtime efetivo - limite permitido) / 30 dias = % de crédito

| Downtime Excedido | Crédito |
|-------------------|---------|
| 0-30 min | 1% do mês (~R$16 Growth, ~R$170 Business) |
| 31-60 min | 5% |
| 61-120 min | 10% |
| 121-240 min | 25% |
| >240 min | 50% |

**Exemplo:** Scale R$1.697/mês cai para 99.8% (downtime 45 min):
- Limite Scale: 26 min
- Excesso: 45 - 26 = 19 min
- Crédito: 1% = R$16,97

**Automação:** Cálculo rodado D+1 do mês, crédito aplicado na próxima cobrança.

### 4.2 — Breach de Response Time

**Critério:** Se primeiro response atrasa >50% do SLA (ex.: Growth prometeu 24h, atendido em >36h)

| Atraso | Crédito |
|--------|---------|
| 50-100% | 3% do mês |
| 100-200% | 7% |
| >200% | 15% + análise |

**Aplicação:** Manual, revisado por CS Lead na semana do breach.

### 4.3 — Acumulação de Créditos

- Créditos de uptime E response time acumulam
- Máximo 50% de desconto em um mês
- Créditos não expiram, acumulam para próximos meses

---

## 5. Canal de Comunicação de Status

**Status Page:** `/status` (interna agora, pública em Q2)

**Componentes monitorados:**
- API (GraphQL + REST)
- WhatsApp Integration
- Document Processing (IA Readiness)
- Database (Supabase)
- Redis (cache)
- Webhook Delivery

**Atualização:** Real-time via Statuspage.io (cron de health checks a cada 30s)

**Acesso:**
- Público: Qualquer visitante vê status (resumido, sem TLDs)
- Clientes: Dashboard privado com histórico 90 dias
- Interno: Slack #status com alerts automáticos

---

## 6. Escaladas de Uptime Crítico

| Evento | SLA | Ação |
|--------|-----|------|
| S1 incidente declarado | <15 min resposta | CEO + Dev Lead call |
| Downtime >30 min | <30 min comunicação ao cliente | E-mail de status + crédito automático |
| Downtime >60 min + >50 clientes | <1h | Call pessoal de Rodrigo aos clientes Enterprise |
| Downtime >120 min | <24h pós-mortem | Pós-mortem público + ações obrigatórias |

---

## 7. Métricas Semanais de Monitoramento

**Relatório:** Toda segunda-feira 9h, enviado para #ops-report

```
SEMANA DE [DATA]
─────────────────

✅ UPTIME: 99.95% (meta: 99.9%)
   └─ Downtime: 3min 12s
   └─ Clientes afetados: 0 (fallback ativo)

📊 TICKETS:
   └─ Volume: 47 tickets
   └─ Starter avg response: 18h (SLA 48h) ✅
   └─ Growth avg response: 6h (SLA 24h) ✅
   └─ Scale avg response: 3h (SLA 8h) ✅
   └─ Business avg response: 48min (SLA 2h) ✅
   └─ Enterprise avg response: 22min (SLA 1h) ✅
   └─ Breaches: 0

🚨 INCIDENTS:
   └─ S1: 0
   └─ S2: 1 (cache spike, resolvido 35min)
   └─ S3: 3 (bugs leves, em backlog)

📈 MRR + CHURN:
   └─ MRR nova: R$8.340 (5 clientes Scale)
   └─ Churn: 0 (100% retention semana)
   └─ Conversão trial: 35% (12/34 trials)

💰 CRÉDITOS:
   └─ Uptime credits: R$0
   └─ Response time credits: R$0
   └─ Total credits (mês): R$0
```

---

## 8. Definições Operacionais

**Uptime:**
- Medido por requisição, não por node
- Failover automático conta como uptime (cliente não ve downtime)
- Manutenção agendada = excluída da métrica de uptime

**Request counting:**
- Health checks internos: excluídos
- Requests rejeitadas por rate limit: contam como downtime
- 5xx errors: downtime (cliente não conseguiu)
- Timeouts (>30s): downtime

**Response time:**
- Contato inicial (reconhecimento da mensagem) em <SLA
- Resolução esperada é estimativa, não SLA duro
- Weekends/feriados: não contam para SLA (Starter-Growth); contam para Business+

---

## 9. Política de Feriados

Feriados Brasileiros (não contam para SLA Starter-Growth):

```
Ano-novo (1º jan)
Sexta-feira Santa (variável)
Tiradentes (21 abr)
Dia do Trabalho (1º mai)
Corpus Christi (variável)
Independência (7 set)
Nossa Senhora Aparecida (12 out)
Finados (2 nov)
Proclamação da República (15 nov)
Consciência Negra (20 nov)
Natal (25 dez)
```

**Business/Enterprise:** SLA continua valendo, resposta mesmo em feriado.

---

## 10. Revisão e Ajuste de SLA

**Trim Quarterly:**
- Analisar aderência real vs. SLA prometido
- Se consistentemente acima (ex.: 99.98% quando prometido 99.5%), rever upward
- Se falhando, investigar e aumentar target de infra

**Próxima revisão:** 2026-07-01 (Q2 → Q3)

---

## 11. Público Externo (Diferenças)

**SLA Público (será publicado em `/sla`):**
- Starter: 99.5% uptime (mantém mesmo)
- Growth: 99.5% uptime (reduzido de 99.7%)
- Scale: 99.8% uptime (reduzido de 99.9%)
- Business: 99.9% uptime (reduzido de 99.95%)
- Enterprise: 99.95% uptime (reduzido de 99.99%)

**Motivo:** Conservadorismo. Público é "no mínimo isso", interno é target real.

**Response times públicos:**
- Starter: "48h comercial"
- Growth: "24h comercial"
- Scale: "8h comercial"
- Business: "2h comercial"
- Enterprise: "1h 24/7"

---

**Fim do SLA.** Próximo review: 2026-07-01.
