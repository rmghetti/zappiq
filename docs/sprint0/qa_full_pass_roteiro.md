# QA Full Pass — Roteiro de validação E2E (Sprint 0 Onda 3)

**Versão:** V2-026
**Quando executar:** sexta 09/05 ou sábado 10/05 (gate Go-Live segunda 11/05)
**Tempo estimado:** ~4h (5 segmentos × ~45min cada, contando setup + análise)
**Quem executa:** Rodrigo (manual via WhatsApp real pra Iza +5511 92616-0159)

## 1. Critério geral de aceitação

Cada conversa = 1 segmento. Cada conversa deve atingir:

- **Latency p95 ≤ 5s** (medido em `zappiq_agent_pipeline_duration_seconds`)
- **Intent classificado correto em ≥ 8 dos 10 turnos** (manual)
- **Resposta da Iza coerente com persona (`role`)** — comercial pra leads, suporte pra customers
- **Ações executadas quando esperado** — handoff, save_lead, schedule
- **PII redacted nos logs** — fly logs deve mostrar `<CPF_xxxxxxxx>` em vez do CPF
- **Audit por turn em `llm_call_logs`** — toda chamada gravada, fallback_triggered correto
- **RLS sem leak** — query SQL como outro tenant não retorna dados desta conversa

Falha em qualquer item crítico (latency >7s sustained, intent errado >2 vezes, resposta incoerente) → escalation pra adiamento OU fix antes do flip.

## 2. Setup pré-teste

```bash
# Confere status do prod
fly status -a zappiq-api
curl -H "X-Admin-Secret: $META_APP_SECRET" https://zappiq-api.fly.dev/api/admin/llm-status | jq

# Abre logs em terminal dedicado
fly logs -a zappiq-api -f | grep -E "Webhook|AIProcess|Agent|llmRouter" &

# Grafana dashboard aberto: latency p95 + queue depth + cost
```

**Cleanup pré-teste (Supabase SQL):**
```sql
-- Limpa conversas anteriores de teste
DELETE FROM messages WHERE "conversationId" IN (
  SELECT id FROM conversations c
  JOIN contacts ct ON c."contactId" = ct.id
  WHERE ct.phone IN ('5511999990001', '5511999990002', '5511999990003', '5511999990004', '5511999990005')
);
DELETE FROM conversations WHERE "contactId" IN (
  SELECT id FROM contacts WHERE phone IN ('5511999990001', '5511999990002', '5511999990003', '5511999990004', '5511999990005')
);
DELETE FROM contacts WHERE phone IN ('5511999990001', '5511999990002', '5511999990003', '5511999990004', '5511999990005');
```

(Os números 99999000X não existem; serão sintéticos via WhatsApp pessoal de teste.)

## 3. Segmentos × roteiros

### Segmento 1 — Saúde / Estética (clínica odonto)

**Persona simulada:** Daniela, dona de clínica odontológica em Curitiba, primeira interação

| # | Turno do cliente | Intent esperado | Ação esperada | Resposta esperada da Iza |
|---|---|---|---|---|
| 1 | "Oi, tudo bem? Achei vocês no Google" | `greeting` | (nenhuma) | Saudação curta + 1 pergunta de qualificação |
| 2 | "Tenho uma clínica odonto" | `faq` | (nenhuma) | Reconhecer o segmento, citar case Vida Plena ou genérico |
| 3 | "Atendo uns 200 pacientes/mês via WhatsApp" | `faq` | (nenhuma) | Espelhar volume + sondagem de dor (SPIN P→I) |
| 4 | "É difícil dar conta, perco pacientes" | `faq` | (nenhuma) | Validação empática + amplificação da dor |
| 5 | "Quanto custa?" | `pricing` | (nenhuma) | Plano Growth R$497 (ajusta pelo volume) |
| 6 | "Tem desconto?" | `pricing` | (nenhuma) | Desconto pré-aprovado ≤10% OR oferta anual |
| 7 | "Posso testar antes?" | `pricing` | (nenhuma) | Trial 14d sem cartão + CTA |
| 8 | "Bom, vou pensar" | `followup` | (nenhuma) | Reabrir conversa OR oferecer demo |
| 9 | "Pode marcar demo amanhã 15h?" | `scheduling` | `schedule` | Confirmar horário + payload com data |
| 10 | "Quero falar com humano" | `request_human` | `handoff` | Mensagem de hold + Redis pause 1h |

**Validação pós-conversa:**
- Conversa criada em `conversations` com status `WAITING` (após handoff)
- Contact `leadStatus` = `QUALIFIED` (após save_lead, se aplicável)
- 10 mensagens INBOUND + 10 OUTBOUND em `messages`
- 10 linhas em `llm_call_logs` (ou 11 se houver fallback)
- audit_logs SEM PII (não houve PII neste roteiro)

---

### Segmento 2 — Educação (escola de idiomas)

**Persona simulada:** Carlos, sócio de escola de inglês, contratante potencial

| # | Turno | Intent | Ação | Notas |
|---|---|---|---|---|
| 1 | "Boa tarde" | `greeting` | — | — |
| 2 | "Tenho uma escola de inglês com 8 professores" | `faq` | — | Valida segmento educação |
| 3 | "Recebo uns 500 leads de Meta Ads/mês" | `faq` | — | Volume alto → sugerir Scale |
| 4 | "Conversão hoje é uns 3%, quero mais" | `pricing` | — | ROI calc implicito; falar de uplift |
| 5 | **"Meu CPF é 529.982.247-25, manda proposta"** | `purchase` | `save_lead` | **PII REDACTOR validation** — log deve mostrar `<CPF_xxxxxxxx>` |
| 6 | "Aceitam cartão?" | `pricing` | — | Stripe disponível |
| 7 | **"Cartão 4532 0151 1283 0366"** | `purchase` | (recusar) | **PII REDACTOR + recusa explícita** — Iza não deve aceitar dado de cartão |
| 8 | "Vocês integram com Hubspot?" | `faq` | — | Roadmap honesto (Q3) |
| 9 | "Quanto leva pra ativar?" | `faq` | — | 14 dias de trial + onboarding CSM |
| 10 | "Top, vou contratar" | `purchase` | `save_lead` | Lead score >0.85 → SQL handoff |

**Validação pós-conversa:**
- `fly logs --since 5m | grep "529.982.247-25"` retorna **VAZIO** (PII redacted)
- `fly logs --since 5m | grep "4532 0151 1283"` retorna **VAZIO**
- `fly logs --since 5m | grep "<CPF_"` retorna pelo menos 1 linha
- `fly logs --since 5m | grep "<CARD_"` retorna pelo menos 1 linha

---

### Segmento 3 — Varejo especializado (pet shop)

**Persona simulada:** Fernanda, dona de pet shop em SP capital

| # | Turno | Intent | Ação |
|---|---|---|---|
| 1 | "Oi! Vi o anúncio de vocês" | `greeting` | — |
| 2 | "Pet shop com 3 lojas" | `faq` | — |
| 3 | "Faço broadcast manual no zap" | `faq` | — |
| 4 | "Quanto demora pra responder cliente?" | `faq` | — |
| 5 | "Vocês fazem agendamento de banho/tosa?" | `scheduling` | (info) |
| 6 | "Qual o ROI esperado?" | `pricing` | — |
| 7 | "Você tem caso de pet shop?" | `faq` | — |
| 8 | "Posso ver uma demo?" | `scheduling` | `schedule` |
| 9 | "**Email é fernanda@petlovers.com.br**" | (info) | `save_lead` |
| 10 | "Combinado, até segunda" | `followup` | — |

**Validação:**
- Email redacted nos logs (`<EMAIL_xxxxxxxx>`)
- save_lead executou (lead score atualizado)
- Schedule action gerou notification socket.io

---

### Segmento 4 — Imobiliária (corretor autônomo)

**Persona simulada:** Marcos, corretor de imóveis residencial Zona Sul SP

| # | Turno | Intent | Ação |
|---|---|---|---|
| 1 | "Olá" | `greeting` | — |
| 2 | "Sou corretor autônomo, trabalho com residencial" | `faq` | — |
| 3 | "Recebo poucos leads (~30/mês)" | `faq` | — |
| 4 | "Plano Starter atende?" | `pricing` | — |
| 5 | "Já tenho cliente fora do horário comercial" | `faq` | — |
| 6 | "ZappIQ resolve isso?" | `faq` | — |
| 7 | "**CEP 04571-010, posso fazer visita aí?**" | (info) | — |
| 8 | "Tem suporte 24/7?" | `faq` | — |
| 9 | "Mais barato que Take Blip mesmo?" | `pricing` | — |
| 10 | "**Tel +55 11 98765-4321 me chama depois**" | `followup` | `save_lead` |

**Validação:**
- CEP redacted
- Telefone redacted
- save_lead com phone armazenado normalmente em Contact (campo dedicado, não em log)

---

### Segmento 5 — Serviço recorrente (academia)

**Persona simulada:** José, gerente de academia, **CLIENTE EXISTENTE** (leadStatus=CONVERTED — testa persona dual `suporte`)

**Pré-setup SQL:**
```sql
-- Cria contact convertido pra ativar persona dual = suporte
INSERT INTO contacts (id, "whatsappId", phone, name, "organizationId", "leadStatus", ...)
VALUES (...);
```

| # | Turno | Intent | Persona esperada |
|---|---|---|---|
| 1 | "Oi Iza" | `greeting` | **Suporte** (não comercial!) |
| 2 | "Tô com problema na fatura" | `faq` | suporte — confirma identidade |
| 3 | "Sou José da Academia FitLife" | `faq` | suporte — confirma e busca org |
| 4 | "Aparece R$1.997 mas paguei só R$997" | `complaint` | suporte — pega `getInvoiceStatus()` (tool, não implementado mas documentar) |
| 5 | "Quero estornar a diferença" | `complaint` | suporte — escala humano (financeiro) |
| 6 | "É urgente" | `complaint` | suporte — handoff prioritário |
| 7 | "Quero falar com humano agora" | `request_human` | `handoff` (Redis pause 1h) |
| 8-10 | (após pause, mandar mais 3 mensagens) | qualquer | **NÃO RESPONDER** — pause ativo |

**Validação crítica de persona dual:**
- `agentOrchestrator` carregou Agent role=`suporte` (confirmar via SQL `agents` table)
- Tom da Iza foi profissional/empático (não consultivo/sondagem como em comercial)
- `ai_paused:{orgId}:5511999990005` no Redis com TTL ~3600s
- Mensagens 8-10 NÃO geraram processamento LLM (`llm_call_logs` sem entradas no período)

## 4. Folha de score (preencher durante o teste)

| Segmento | Latency p95 (s) | Intents corretos | Resposta coerente | PII redacted | Ação executada | Score (0-10) |
|---|---|---|---|---|---|---|
| 1 — Saúde | _ | _/10 | _ | n/a | _ | _ |
| 2 — Educação | _ | _/10 | _ | _ | _ | _ |
| 3 — Varejo | _ | _/10 | _ | _ | _ | _ |
| 4 — Imobiliária | _ | _/10 | _ | _ | _ | _ |
| 5 — Serviço (suporte) | _ | _/10 | _ | n/a | _ | _ |

**Score mínimo pra aprovar:** ≥ 8/10 em cada segmento. Latency ≤5s p95. Sem regressão de PII redaction.

## 5. SQL de inspeção pós-teste

```sql
-- Total de mensagens no teste (5 segmentos × 10 turnos × 2 direções = 100 mensagens)
SELECT direction, COUNT(*)
FROM messages
WHERE "createdAt" > NOW() - INTERVAL '4 hours'
  AND "conversationId" IN (
    SELECT id FROM conversations
    WHERE "contactId" IN (SELECT id FROM contacts WHERE name LIKE 'QA-%')
  )
GROUP BY direction;

-- LLM calls com latency e fallback
SELECT
  provider, operation,
  COUNT(*) as calls,
  AVG(latency_ms)::int as avg_ms,
  MAX(latency_ms) as max_ms,
  SUM(CASE WHEN fallback_triggered THEN 1 ELSE 0 END) as fallbacks,
  SUM(cost_usd_estimate)::numeric(10,4) as cost_usd
FROM llm_call_logs
WHERE created_at > NOW() - INTERVAL '4 hours'
GROUP BY provider, operation
ORDER BY calls DESC;

-- Audit logs sem leak de PII (deve retornar 0 linhas com CPF/cartão raw)
SELECT id, action, details::text
FROM audit_logs
WHERE "createdAt" > NOW() - INTERVAL '4 hours'
  AND (details::text ~ '\d{3}\.\d{3}\.\d{3}-\d{2}'
    OR details::text ~ '4532\s?0151\s?1283\s?0366');
```

## 6. Critérios de Go-No-Go pós QA

**GO** (todos):
- ✅ 5 segmentos com score ≥ 8/10
- ✅ Latency p95 ≤ 5s em todos
- ✅ PII redacted (zero leaks)
- ✅ Persona dual funcionou (segmento 5 usou suporte)
- ✅ Handoff Redis pause funcionou
- ✅ Fallback rate < 5% (Plano §8.3)

**NO-GO** (qualquer um):
- ❌ Latency p95 > 7s
- ❌ Intent errado em > 2 turnos consecutivos no mesmo segmento
- ❌ PII vazou pra logs/Sentry/audit
- ❌ Persona dual NÃO ativou (segmento 5 respondeu como comercial)
- ❌ Pause Redis não bloqueou mensagens 8-10 do segmento 5

Em caso de NO-GO: registrar em `docs/incidents/2026-MM-DD-qa-full-pass-fail.md` + escalation pra decidir entre fix-and-retry OU adiamento.

## 7. Refs

- `docs/operations/observability_day1.md` — métricas e queries
- `docs/operations/launch_runbook_2026-05-11.md` — gate Go-Live
- Plano V2.0 §8.3 — métricas obrigatórias
- Plano V2.0 §A.1 + A.2 — system prompts (comercial e suporte)
