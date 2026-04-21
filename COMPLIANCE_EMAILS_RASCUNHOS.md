# Rascunhos de Compliance — Fase 3 (pós-deploy)

> Depois que produção estiver verde, estes 3 contatos destravam o compliance do D-Day 30/04.
> Revise, ajuste o que sua memória pedir, e envie.

---

## 1 · Clínica Vida Plena — piloto anchor (B-01)

**Para:** contato direto (diretor clínico / gerente operacional)
**Assunto:** ZappIQ · confirmação de piloto · semana de 28/04

```
Olá [nome],

Segue um alinhamento rápido sobre o piloto do ZappIQ que acordamos
para a semana do lançamento (30/04).

Do nosso lado, confirmamos:
  · Ambiente dedicado com dados reais da operação de vocês
  · Integração com o canal WhatsApp Business já provisionada
  · Inteligência (RAG) treinada sobre o material que vocês compartilharam
  · SLA inicial: resposta < 5s, disponibilidade 99%, suporte direto comigo

Pedido do seu lado:
  1. Confirmação da pessoa ponto-focal para a semana do piloto
  2. Lista final de fluxos que vamos cobrir (agendamento, triagem, pós-consulta?)
  3. Janela de homologação no dia 28/04 (sugestão: 14h-17h)

Podemos fechar esses 3 pontos ainda esta semana? Proponho uma call
de 30 min amanhã ou quarta pra destravar.

Abraço,
Rodrigo
```

---

## 2 · DPO externo — LGPD checklist (B-03)

**Para:** DPO contratado (ou candidato se ainda não fechado)
**Assunto:** ZappIQ · LGPD · validação para go-live 30/04

```
Olá [nome do DPO],

Como combinado, precisamos do parecer formal de conformidade
LGPD antes do nosso go-live em 30/04.

Anexos (envio via [Drive/e-mail]):
  · Política de Privacidade — versão final (/privacidade)
  · Termos de Uso — versão final (/termos)
  · Registro de Operações de Tratamento (ROPA) preliminar
  · Fluxo de dados · cliente final → ZappIQ → LLM → resposta
  · DPIA — Avaliação de Impacto (mensagens de WhatsApp são dado pessoal
    e podem conter dado sensível em contexto clínico)

Pontos onde preciso da sua leitura crítica:
  1. Base legal: estamos usando "execução de contrato" para o
     piloto com Vida Plena. Você concorda com o enquadramento?
  2. Subcontratantes: OpenAI/Anthropic (LLM) + Fly.io (infra) +
     Meta (WhatsApp). Precisamos de DPA assinado com quais deles
     até o go-live?
  3. Retenção: mensagens em 30d, embeddings anonimizados em 90d.
     Suficiente?
  4. Titular: fluxo de request de exclusão (art. 18) já tá mapeado
     no endpoint /api/dsr. Quer revisar?

Prazo que preciso: parecer inicial em 48h, parecer definitivo até 27/04.
Aceita? Se houver gap, quero mapear antes do fim da semana.

Abraço,
Rodrigo
```

---

## 3 · Meta · Tech Provider / BSP Partner (B-08)

**Para:** representante Meta ou BSP (Twilio / 360dialog / Infobip / Gupshup)
**Assunto:** ZappIQ · ativação do número WhatsApp Business API · 30/04

```
Olá [nome],

Precisamos concluir a ativação do nosso número WhatsApp Business
API para o go-live em 30/04 com nosso primeiro cliente (Vida Plena).

Status atual:
  · Business Manager verificado: [sim/não · ID: xxxx]
  · Número provisionado: [sim/não · número]
  · Display name aprovado: [sim/pendente]
  · Templates submetidos: [n total · n aprovados]
  · Webhook production URL: https://zappiq-api.fly.dev/webhook/whatsapp

Pendências que preciso destravar essa semana:
  1. Green tick (Official Business Account): qual o prazo real
     se submetermos hoje?
  2. Limite inicial de envio (Tier 1 = 1K conversations/day) —
     o ramp-up automático pra Tier 2 a gente ativa depois do primeiro
     mês ou precisa solicitar?
  3. Template de agendamento (clínica) — o que foi negado precisa
     de ajuste em qual campo?
  4. On-call de suporte pra D-Day 30/04 · 08h-20h: você consegue
     priorizar fila caso apareça algo?

Posso te mandar os artefatos que faltam ainda hoje. Qual o melhor
caminho — e-mail, Slack compartilhado, ou portal do BSP?

Abraço,
Rodrigo
```

---

## Checklist · Fase 3 — ordem sugerida

1. **Depois do deploy v55 OK**: testar WhatsApp webhook em prod (basta mandar uma msg pro número piloto). Se não responder, volta pra Fase 1.
2. **Enviar e-mail 3 (Meta/BSP)** primeiro — é quem tem ciclo mais longo e pode ser bloqueante pro D-Day.
3. **Call com Vida Plena (e-mail 1)** agendar pra amanhã ou quarta — confirma o que vai ser o piloto real.
4. **DPO (e-mail 2)** em paralelo — parecer pode demorar 48h, não dá pra esperar sexta.

## Gaps que preciso que você preencha antes de enviar

- [ ] Nome do contato na Vida Plena (diretor clínico ou op)
- [ ] Nome do DPO (contratado? candidato? interno?)
- [ ] Qual BSP/Tech Provider vocês estão usando (Twilio, 360dialog, Infobip, Gupshup, direto com Meta?)
- [ ] Business Manager ID e status do Green Tick atual
- [ ] Lista de subcontratantes reais (qual LLM provider está ativo? Apenas OpenAI? Anthropic? Ambos?)
