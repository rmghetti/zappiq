# Churn Prevention Playbook — ZappIQ

**Versão:** 1.0  
**Data:** 2026-04-15  
**Autor:** Rodrigo Ghetti  
**Público:** CS Lead, Founder, Product  
**Objetivo:** Retenção e prevenção de churn pós-conversão

---

## 1. Sinais Early Warning (Churn Predictor)

| Sinal | Janela | Threshold | Ação |
|-------|--------|-----------|------|
| **Uso caindo** | 14 dias | Requisições -40% vs. média | Investigar |
| **Login raro** | 14 dias | <1 login/semana | Alerta baixo |
| **Readiness parado** | 30 dias | Sem progresso em Readiness | Alerta médio |
| **Suporte frustrado** | Contínuo | 3+ tickets com sentimento negativo | Alerta alto |
| **Via Stripe** | Automático | Failed payment × 2 | Bloqueio parcial |

**Scoring de churn:** 0-100 (0=safe, 100=cancel em 7 dias)

| Fator | Peso | Trigger Score |
|-------|------|-------|
| Uso -40% | 25pts | >0 = 25 |
| Readiness parado 30d | 20pts | >0 = 20 |
| Login <1x/semana | 20pts | >0 = 20 |
| Suporte tone negativo | 15pts | >0 = 15 |
| Failed payment | 20pts | >0 = 20 |

**Score ≥60:** Cliente em risco, intervenção manual  
**Score ≥80:** Cliente crítico, call imediata

---

## 2. Intervenção em 3 Níveis

### Nível 1 — Automático (score 60-70)

**Acionamento:** Sistema detecta, e-mail enviado automaticamente  
**Timing:** T+0 quando score cruza 60  
**Template:**

```
Assunto: Voltamos a notar algo aqui...

Oi [Nome],

Seu uso de ZappIQ caiu 40% nas últimas 2 semanas.

Pode ser que:
1. Vocês estejam no final de um projeto (normal)
2. A IA não esteja gerando ROI esperado (talvez a gente consiga resolver)
3. Falta uma feature que vocês precisam (feedback valioso)

Qual é?

Posso ter 10 min pra conversar? 

Calendly: [link]

Rodrigo
```

**Métrica de sucesso:** 30% de resposta com disponibilidade pra call

### Nível 2 — Manual Leve (score 70-85)

**Acionamento:** CS Lead ou Founder envia mensagem pessoal  
**Timing:** 24h após Nível 1, se sem resposta  
**Canal:** WhatsApp  
**Template:**

```
Oi [Nome]! 👋

Mandei um e-mail sobre o uso caindo.
Às vezes coisa importante fica perdida no meio do dia.

Posso tirar dúvida sobre ZappIQ em 15 min?
Sexta-feira 14h tá bom?

Apenas responde um "sim" aqui que agenda tudo.

Abraço
```

**Métrica de sucesso:** 50% de resposta positiva

### Nível 3 — Manual Pesada (score 85+)

**Acionamento:** Founder liga direto  
**Timing:** Imediato (mesmo dia)  
**Objetivo:** Salvar cliente ou fazer exit interview limpa  
**Duração:** 30-45 min  
**Script:** Ver seção 3

---

## 3. Exit Interview Script (5 perguntas)

**Contexto:** Cliente sinalizou churn, você liga pra tentar salvar OU confirmar saída.

### Estrutura

**Abertura (2 min):**
```
"Oi [Nome], tudo bem? Rodrigo aqui de ZappIQ.

Vi que as coisas não tão rodando como esperado aí.
Queria conversar antes de qualquer decisão.

Tá tudo bem?"
```

**P1 — Qual é o problema? (5 min)**
```
"Qual foi a maior dificuldade que você encontrou com ZappIQ?"

[Deixe falar. Anote tudo. NÃO INTERROMPA.]

Gatilhos de respostas:
- "Não funciona" → P2
- "Caro" → P3
- "Não usa" → P4
- "Melhorou, mas não tanto" → P5
```

**P2 — Se não funciona, qual é o erro específico? (3 min)**
```
"Quando você diz que não funciona, o que exatamente está acontecendo?
Ex.: IA respondendo errado? Lenta? Não entendendo perguntas?"

[Se erro técnico: anote ID da requisição, permita escalação imediata]
[Se falta de funcionalidade: vá para P5]
```

**P3 — Se caro, qual seria o preço justo? (3 min)**
```
"Entendo. Preço é restrição real pra muita gente.

Qual seria o valor mensal que faria sentido pro seu ROI?
Ex.: se economiza R$1k/mês, qual preço pagaria?"

[Se responde número realista: ofereça downgrade ou pausa]
[Se responde < 20% do current: cliente não é ideal, oferça pausa]
```

**P4 — Se não usa, por que? (5 min)**
```
"Por que ZappIQ não entrou na rotina de vocês?

Era falta de clareza de como usar? Tecnicamente complicado?
Ou o time mudou prioridades?"

[Se complicado: ofereça onboarding novo]
[Se prioridade mudou: ofereça pausa de 30 dias grátis]
[Se "não temos tempo": cliente pode voltar em 3 meses, pausa é solução]
```

**P5 — Se não vale o ROI esperado, qual era a expectativa? (5 min)**
```
"Quando você contratou ZappIQ, qual era a métrica que você queria melhorar?
Ex.: reduzir custo de suporte, responder mais rápido?"

[Anote a métrica esperada vs. o que realmente aconteceu]

"E agora, o que você vê como realista em 3 meses?"

[Se possível resolver com ajustes/mais treino: P6]
```

**P6 — Antes de desistir, posso tentar uma coisa? (3 min)**
```
"Ótimo, agradeço a sinceridade.

Antes de você cancelar, posso sugerir 3 coisas:

[OFERTA 1] Reduzir preço pra Growth [R$797] por 3 meses, testar em volume menor?
[OFERTA 2] Fazer uma pausa de 30 dias grátis — às vezes contexto muda?
[OFERTA 3] Chamar um especialista meu pra revisar seu setup em 30 min — pode estar
subotimizado?

Qual faz mais sentido pra vocês?"
```

**Fechamento (2 min):**
```
Se cliente aceitar OFERTA 1/2/3:
"Perfeito. Vou ativar isso agora e envio um e-mail confirmando."

Se cliente insistir em cancelar:
"Respeito a decisão. Mas deixa eu fazer uma última coisa:
quando contexto mudar (novo projeto, novo hire), vocês voltam?
Vou ativar uma oferta especial de retorno pra vocês — cupom COMEBACK25 (30% off 3 meses)."
```

---

## 4. Ofertas de Win-Back (3 templates)

### Oferta 1 — Pausa em vez de Cancelamento

**Para:** Cliente com uso caindo, mas não odeia a plataforma

```
Assunto: Pausa de 30 dias em ZappIQ — grátis, sem penalidade

Oi [Nome],

Cancelamento aprovado. Mas antes, uma sugestão:

E se a gente pausasse sua assinatura por 30 dias? Gratuitamente.

Objetivo: quando seu contexto mudar (novo projeto, demanda volta), você volta 
com 1 clique. Sem perder histórico, documentos, nada.

Benefício pra você:
✓ Pausa de verdade, sem cobrar nada
✓ Volta quando quiser, documentos e IA treinada esperando
✓ Sem assinatura ativa se não usar

Se em 30 dias não quiser volta, aí sim cancela de vez.

Ativa essa pausa pra você?

Rodrigo
```

**Automação:** Se cliente clicar "Pausar", subscription vai para status `paused`, sem cobrar.

### Oferta 2 — Cupom de Retorno (30% off 3 meses)

**Para:** Cliente que já cancelou ou deixou expirar

```
Assunto: Cupom exclusivo de retorno — 30% off em volta

Oi [Nome],

Entendi que ZappIQ não deu certo aí.

Às vezes é timing, às vezes é fit mesmo — ambos são OK.

Mas guarda esse cupom: COMEBACK25

Se sua situação mudar e quiser dar uma segunda chance:
- 30% de desconto nos primeiros 3 meses (volta em Growth = R$559/mês em vez de R$797)
- Sem compromisso — cancela quando quiser
- Seu histórico e IA treinada ainda estão aqui

Vale?

Rodrigo
```

**Validade:** Cupom ativo por 6 meses após cancelamento.

### Oferta 3 — Downgrade + Pausa Estratégica

**Para:** Cliente de Scale/Business que acha caro

```
Assunto: Downgrade + pausa — opção intermediária

Oi [Nome],

Vi que preço tá apertado aí.

Em vez de cancelar, posso oferecer:

OPÇÃO A: Downgrade Growth por 3 meses (R$797 em vez de R$1.697)
         Depois volta pra Scale se quiser — sem penalidade

OPÇÃO B: Pausa de 60 dias, depois volta em Growth
         Economiza 2 meses completos = R$3.394 de economia

OPÇÃO C: Cancelamento normal, mas ativa cupom COMEBACK25 (30% off quando volta)

Qual faz sentido?

Rodrigo
```

---

## 5. Reativação Pós-Churn

**Se cliente aceita pausa:**
- D+1: Envie e-mail Welcome Back "Tudo pronto pro retorno"
- D+15: Nudge WhatsApp leve "Contexto mudou? Chama quando quiser"
- D+25: E-mail com métrica "Nova feature saiu que você pediu"
- D+30: Pausa termina, voltar é 1 clique

**Se cliente cancela de verdade:**
- D+0: E-mail de confirmação + cupom COMEBACK25
- D+7: Envie case study de cliente que retornou (social proof)
- D+30: Primeira tentativa de reativação via e-mail
- D+90: Segunda tentativa via WhatsApp
- D+180: Terceira tentativa, depois lista de "ex-clientes"

---

## 6. Checklist de Prevenção Contínua

**Daily (5 min):**
- [ ] Scorecard de clientes em risco: score ≥60?
- [ ] Alerts em Slack: uso caiu 40%?
- [ ] Failed payments: alguém com 2+ failures?

**Weekly (30 min, toda segunda-feira):**
- [ ] Quantos clientes em risco (score 60-100)?
- [ ] Quantos chamados pra Level 2/3?
- [ ] Conversion rate de "risco" → "retido"?

**Monthly (60 min, último dia do mês):**
- [ ] Churn rate real vs. meta (target: <3% ao mês)
- [ ] Motivos de churn: ranking (preço, uso, fit, técnico)
- [ ] Win-back rate: % de pausados que retornam
- [ ] Ações executadas: quantas calls, ofertas, créditos

---

## 7. Métricas de Churn

| Métrica | Fórmula | Meta | Frequência |
|---------|---------|------|-----------|
| **Churn Rate** | (Cancelados + pausados) / MRR anterior × 100 | <3% | Mensal |
| **Win-back Rate** | (Reativados) / (Pausados + Cancelados) × 100 | >15% | Trimestral |
| **NRR (Net Revenue Retention)** | (MRR fim - MRR novo) / MRR início × 100 | >110% (crescimento líquido) | Mensal |
| **Intervention Success** | Clientes retidos / Clientes em risco | >50% | Mensal |

---

## 8. Integração com Producto

**Sinais que viram feature backlog:**

Se 3+ clientes em churn mencionam "falta X feature", sobe pra product:
- Readiness Score não sobe acima de 70 (problema de UX?)
- IA responde, mas com 40% accuracy (problema de modelo?)
- Integração WhatsApp é lenta (problema técnico?)

**Review semanal:** CS Lead + Product Lead analisam trends de churn.

---

## 9. Compensações Além de Crédito

| Situação | Ação |
|----------|------|
| Cliente em risco, Level 3 call bem-sucedida | +1 mês grátis (máximo R$5k crédito) |
| Cliente que pausa 30 dias e volta | +7 dias grátis |
| Cliente que foi afetado por S1 incidente | 2-3 dias crédito automático |
| Cliente com 90+ dias retido sem churn | Marketing material exclusivo |

---

## 10. SLA de Churn

- **Resposta:** Score ≥80 = call dentro de 4 horas (business hours)
- **Resolução:** Em até 7 dias, cliente em "retido" ou em "pausa" com data de revisão

---

**Fim do playbook.** Próximo review: 2026-05-15.
