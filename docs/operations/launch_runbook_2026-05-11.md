# Launch Runbook — 11/05/2026 (Go-Live ZappIQ V2.0)

**Versão:** Sprint 0 final
**Última atualização:** 2026-04-28
**Owner:** Rodrigo Ghetti (incident commander)

## 1. Cronograma do dia

| Horário | Ação | Quem |
|---|---|---|
| **Sábado 10/05 18h** | War room ativo. Soak overnight inicia em staging. | Plantão |
| **Sábado 10/05 23h** | Soak intermediário check. | DevOps |
| **Domingo 11/05 09h** | Soak completo verde. Go/no-go meeting. | Todos |
| **Domingo 11/05 10h** | Se GO: atualizar Vercel `LAUNCH_MODE=live`, redeploy. | DevOps |
| **Domingo 11/05 10h05** | Smoke test pós-flip. | DevOps + CSM |
| **Domingo 11/05 10h30** | Anúncio público (LinkedIn + e-mail base) | Marketing |
| **Domingo 11/05 11h–23h59** | Plantão ativo. Alertas vigiados. | Rotativo |
| **Segunda 12/05 09h** | Retro launch + decisão sobre desativação war room. | Todos |

## 2. Critérios de Go-Live (sábado 10/05 18h — gate final)

Cada item deve estar verde. Se falhar QUALQUER um → escalation pra (a) adiar pra 18/05 OU (b) launch reduzido com feature flag.

- [ ] **Apêndice D do Plano V2.0**: 100% dos itens críticos ✅ (`docs/sprint0/checklist_apendice_D.md`)
- [ ] **CI verde em main**: último commit com testes + build + Prisma validate passando
- [ ] **Fly api saudável**: `fly status -a zappiq-api` mostra 2+ machines healthy, latência p95 do `/health` <500ms
- [ ] **Vercel web saudável**: status no Vercel dashboard verde
- [ ] **QA full pass**: 5 conversas E2E em 5 segmentos diferentes (saúde, educação, varejo, imobiliária, serviço recorrente) sem erro crítico
- [ ] **Load test k6**: 100 msg/s × 60s sem queda; queue depth p95 < 20
- [ ] **Soak overnight**: zero exceptions críticas em Grafana/Sentry; latência p95 estável (sem drift)
- [ ] **Descope de Voz**: Voz Padrão e Premium 100% removidos (`/precos` em prod confirma)
- [ ] **Página `/roadmap`**: pública e acessível
- [ ] **War room montado**: plantão confirmado por escrito no Slack `#zappiq-launch`
- [ ] **Runbook acessível**: este documento + observability_day1.md disponíveis offline

## 3. Plantão war room (sábado 18h → segunda 12h)

### Equipe mínima

| Papel | Pessoa | Contato | Escopo |
|---|---|---|---|
| **Incident Commander** | Rodrigo | WhatsApp pessoal | Decisão final de rollback, comunicação externa |
| **Backend on-call** | Rodrigo (auto) | WhatsApp | Diagnóstico Fly/api/queue/LLM |
| **DevOps** | Rodrigo (auto) | WhatsApp | Deploy/rollback Fly + Vercel |
| **CSM 1ª linha** | Rodrigo (auto) | WhatsApp | Atendimento Iza dos primeiros clientes |

**Atenção:** estado atual da equipe = solo (Rodrigo). Cowork pode auxiliar em diagnóstico mas decisões de rollback/comunicação são humanas. Plano original previa equipe distribuída — adaptado pra realidade ZappIQ Sprint 0.

### Setup operacional

- **Tela 1**: Grafana dashboard "ZappIQ Production Day 1" (8 painéis)
- **Tela 2**: Slack `#zappiq-alerts` + `#zappiq-launch`
- **Tela 3**: Fly.io dashboard (`fly logs -f -a zappiq-api`)
- **Backup**: Anthropic console (https://console.anthropic.com/dashboard) pra checar quotas

### Comunicação

- **Slack interno**: `#zappiq-launch` (canal dedicado durante o war room)
- **Cliente final**: somente via Iza ou e-mail oficial. Sem comentário improvisado.
- **Externo (LinkedIn/imprensa)**: SOMENTE Rodrigo aprova posts no dia.

## 4. Critérios de rollback

Se QUALQUER um abaixo ocorrer sustained, executar rollback:

| Sintoma | Threshold | Ação imediata |
|---|---|---|
| Error rate > 5% | 10 min consecutivos | Rollback (LAUNCH_MODE=prelaunch) |
| Latency p95 > 15s | 5 min consecutivos | Rollback |
| Queue depth crescente sem decrescer | 30 min | Investigar A3 → se não resolver: rollback |
| Iza não responde NENHUMA mensagem | qualquer | Rollback imediato |
| Vazamento de PII em log | qualquer | Rollback + comunicação ANPD <72h |
| Cliente reportando dado de OUTRO tenant | qualquer | Rollback + audit forense |

**Procedimento de rollback (Plano §2.5):**

1. Vercel: env `LAUNCH_MODE=prelaunch` + redeploy → site volta pra teaser.
2. Fly api: `fly deploy --image registry.fly.io/zappiq-api:deployment-<SHA-anterior>` (último estável).
3. Comunicação Slack `#zappiq-launch`: "Rollback acionado. Causa: [X]. ETA pra reabrir: [Y]."
4. Pós-rollback: post-mortem em ≤24h em `docs/incidents/YYYY-MM-DD-launch.md`.

## 5. Lista de SHAs estáveis (atualizar sábado 18h)

| SHA | Descrição | Quando reverter |
|---|---|---|
| `<TBD-sábado>` | Estado pré-launch validado em soak | Caso A: rollback funcional |
| `0f3f499` | Onda 1 mergeada (Blockers 5/6/Agent) | Caso B: voltar 1 onda |
| `25b133a` | Pré-Sprint 0 (V5.3 + LAUNCH_MODE=prelaunch) | Caso C: voltar Sprint 0 inteiro |

Atualizar na sexta 09/05 com SHA do último commit que passou soak.

## 6. Alertas configurados (ver `observability_day1.md`)

| ID | Trigger | Severity |
|---|---|---|
| A1 | LLM error rate >1% por 10min | warning |
| A2 | Pipeline p95 >7s por 5min | warning |
| A3 | Queue depth crescente 30min | critical |
| A4 | Fallback rate >50% por 5min | critical |

Cada alerta tem section dedicada no runbook on-call.

## 7. Checklist 30min antes do flip (10h domingo)

- [ ] Grafana dashboard aberto no monitor principal
- [ ] Slack `#zappiq-alerts` aberto e testado (notification policy ativa)
- [ ] `fly logs -f -a zappiq-api` rodando em terminal dedicado
- [ ] Anthropic console aberto pra ver quota/rate limit
- [ ] WhatsApp de teste com Iza ativo (mandar 1 mensagem antes do flip pra confirmar baseline)
- [ ] SQL client conectado ao Supabase (Postgres) pra queries ad-hoc
- [ ] Backup de SHA anterior anotado (rollback)
- [ ] LinkedIn post agendado mas NÃO publicado (publica após smoke test pós-flip)

## 8. Smoke test pós-flip (10h05 domingo)

Imediatamente após `LAUNCH_MODE=live` redeploy:

1. **Frontend**: acessa `https://zappiq.com.br` (Cmd+Shift+R) — deve mostrar Home V5 (não pré-launch).
2. **Roadmap**: `/roadmap` carrega.
3. **Iza WhatsApp**: manda "Olá" pra +5511 92616-0159 — responde em <5s.
4. **/api/admin/llm-status** respondendo: confirma cascade saudável e tráfego.
5. **Grafana**: depth `ai-process` em 0 ou baixo, latency p95 LLM <3s.

Se TODOS verdes: liberar publicação LinkedIn. Comunicar `#zappiq-launch`: "Live e estável. Posto público autorizado."

Se algum vermelho: SEGURAR comunicação pública. Investigar via runbook on-call.

## 9. Pós-launch — primeiras 24h

| Marco | Hora | Ação |
|---|---|---|
| H+1 | 11h dom | Primeiro check formal: latência, error rate, queue depth |
| H+3 | 13h dom | Check + revisão de logs Anthropic |
| H+6 | 16h dom | Check + se 50+ mensagens processadas: análise inicial de fallback rate |
| H+12 | 22h dom | Check overnight stability |
| H+24 | 10h seg | Retro launch — `docs/incidents/2026-05-11-launch-retro.md` |

## 10. Pendências manuais antes do flip

- [ ] **Blocker 6.3 (CSM):** lista clientes que compraram Voz no trial → e-mail 1:1 com extensão 90d ou refund (até sexta 09/05).
- [ ] **Soak SHA estável:** atualizar seção 5 com SHA validado.
- [ ] **Grafana dashboard:** importar JSON ou criar manualmente os 8 painéis (queries em `observability_day1.md`).
- [ ] **Alertas Slack:** criar 4 alertas A1–A4 no Grafana Alerting + webhook `#zappiq-alerts`.
- [ ] **Anthropic Tier:** confirmar Tier 4 (Plano §15.2) — sem rate limit relevante.
- [ ] **OpenAI Tier:** subir pra Tier 3 (Plano §15.2) — necessário pra fallback de produção.

## 11. Refs

- `docs/sprint0/checklist_apendice_D.md` — gate final
- `docs/operations/observability_day1.md` — métricas, queries, alertas, runbook on-call
- `docs/architecture/llm_router.md` — cascade Anthropic → OpenAI
- `docs/audit/rls_handlers.md` — escopo de RLS hardening
- Plano V2.0 §2.5 — war room original (adaptado neste documento)
