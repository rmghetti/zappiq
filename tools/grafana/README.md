# Grafana Setup — DAY 1 (Sprint 0 Onda 3)

Tooling pra subir o dashboard "ZappIQ Production Day 1" + 4 alertas A1-A4 no Grafana Cloud em ~10 minutos, sem clicar painel a painel.

## Arquivos

- `dashboard.json` — dashboard com 8 painéis prontos pra import (1 clique)
- `alerts_provisioning.yaml` — definições de alertas + Slack contact point (provisioning)

## Passo 1 — Criar canal Slack `#zappiq-alerts` (2min)

1. Slack → workspace ZappIQ → criar canal `#zappiq-alerts` (privado ou público, sua escolha)
2. Slack → Apps → Incoming Webhooks → Add to Workspace
3. Selecionar canal `#zappiq-alerts` → Add Incoming Webhooks integration
4. **Copiar a Webhook URL** (algo tipo `https://hooks.slack.com/services/T0.../B0.../xxxx`) — você vai precisar no passo 3

## Passo 2 — Importar dashboard (1min)

1. Acessar Grafana Cloud (mesma URL que recebe os traces OTel)
2. Menu lateral → **Dashboards** → **New** → **Import**
3. **Upload JSON file** → selecionar `tools/grafana/dashboard.json` deste repo
4. Quando perguntar pelo datasource: selecionar o Prometheus do Grafana Cloud (geralmente `grafanacloud-zappiq-prom`)
5. Clicar **Import**

**Resultado**: dashboard "ZappIQ Production Day 1" criado com 8 painéis. UID `zappiq-prod-day1`.

Os painéis vão começar populados conforme o api do Fly emite métricas (já está emitindo desde o Blocker 1). Se algum painel mostrar "No data" inicialmente, é porque a janela é 6h e ainda não acumulou tráfego suficiente — basta esperar uma manhã ou enviar mensagens reais pra Iza.

## Passo 3 — Configurar alertas (5min)

### Opção A — Manual via UI (mais didática, recomendada)

Pra cada alerta abaixo (A1, A2, A3, A4):

1. Grafana Cloud → **Alerting** → **Alert rules** → **New alert rule**
2. Copiar **PromQL** + **threshold** + **for** + **labels** + **annotations** do arquivo `alerts_provisioning.yaml` (cada alerta é um bloco `- uid:` no YAML)
3. **Datasource**: Prometheus do Grafana Cloud
4. **Folder**: criar/selecionar "ZappIQ"
5. **Save and exit**

Repete pra cada um dos 4 alertas (~1min cada).

### Opção B — Provisioning automático (Pro/Advanced tier)

Se seu plano Grafana Cloud tem provisioning de alertas:

1. Editar `alerts_provisioning.yaml`:
   - Substituir `<PROMETHEUS_DATASOURCE_UID>` pelo UID real (Grafana → Connections → Data sources → Prometheus → copiar UID na URL)
   - Substituir `<SLACK_WEBHOOK_URL_INCOMING>` pela URL copiada no Passo 1
2. Grafana Cloud → **Alerting** → **Settings** → **Provisioning** → **Upload YAML**
3. Subir o arquivo editado

### Configurar contact point Slack (necessário em ambas as opções)

1. Grafana Cloud → **Alerting** → **Contact points** → **Add contact point**
2. Nome: `zappiq-alerts-slack`
3. Integração: **Slack**
4. Webhook URL: cole a URL copiada no Passo 1
5. Save

### Configurar notification policy

1. Grafana Cloud → **Alerting** → **Notification policies** → **New nested policy**
2. Matcher: `team = zappiq-eng`
3. Contact point: `zappiq-alerts-slack`
4. Group by: `alertname`, `severity`
5. Group wait: 30s · Group interval: 5m · Repeat interval: 4h
6. Save

## Passo 4 — Validação (2min)

Teste rápido pra confirmar que o webhook tá entregando:

1. Grafana Cloud → **Alerting** → **Contact points** → `zappiq-alerts-slack` → botão **Test**
2. Mensagem de teste deve aparecer em `#zappiq-alerts` em segundos

Se chegou: alerts ativos. Se não chegou: webhook URL errada ou canal sem permissão.

## Resultado final

Após os 4 passos:

- ✅ Dashboard `zappiq-prod-day1` com 8 painéis ao vivo
- ✅ 4 alertas (A1–A4) ativos
- ✅ Slack `#zappiq-alerts` recebendo notificações
- ✅ Apêndice D Observability DAY 1 itens O.7 e O.8 = ✅
- ✅ Sprint 0 100% (gate sábado 18h satisfeito pra essa parte)

## Refs

- `docs/operations/observability_day1.md` — explicação completa de cada painel/alerta
- `docs/operations/launch_runbook_2026-05-11.md` — gate Go-Live
