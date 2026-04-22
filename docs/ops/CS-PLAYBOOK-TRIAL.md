# CS Playbook Trial — ZappIQ

**Versão:** 1.0  
**Data:** 2026-04-15  
**Autor:** Rodrigo Ghetti  
**Público:** Founder/CS nos primeiros 60 dias  
**Objetivo:** Maximizar conversão de trial (14 dias) sem força de venda

---

## 1. Filosofia Base

- **Help first, convert as consequence** — sua função é resolver o problema do cliente, não vender o plano
- Intervenção apenas quando há sinal objetivo — não seja chato, seja útil
- Respeite o silêncio; 3 mensagens sem resposta = cliente abandona, não insista
- Métrica que importa: não CAC, mas **conversão trial → pago** e **churn em 90 dias**

---

## 2. Triggers Automáticos Já Implementados

| Dia | Gatilho | Canal | Conteúdo |
|-----|---------|-------|----------|
| D+0 | Novo trial criado | E-mail | Welcome + link docs onboarding |
| D+3 | Automático | E-mail | "Como treinar sua IA em 5 min" |
| D+10 | Automático | E-mail | Case study de cliente similar |
| D-1 | 1 dia antes do expiro | E-mail | "Trial expira amanhã, aproveite" |

---

## 3. Intervenções Manuais do Founder

### 3.1 Trial D+1 sem login → Nudge WhatsApp

**Critério:** Cliente criou trial mas nunca entrou  
**Ação:** Envie mensagem WhatsApp pessoal  
**SLA:** Envie em até 24h do sign-up  
**Template:**
```
Oi [Nome]! 👋 
Tudo bem? Criei um trial ZappIQ pra você.
Se bater dúvida no setup, é só chamar. 
Link: [trial_url]
```

**Resposta esperada:** Cliente entra na plataforma  
**Se não responder em 48h:** Ignore, cliente não estava pronto

---

### 3.2 D+3 com Readiness < 10 → Ofereça call 15min

**Critério:** Cliente entrou, mas IA está sem treino (Readiness < 10)  
**Ação:** E-mail pessoal + link Calendly (slot 15min)  
**SLA:** Envie em D+3  
**Template:**
```
Oi [Nome],

Vi que você criou um trial ZappIQ. Readiness da sua IA ainda está em 0%.

Tranquilo — treinamento de IA leva tempo. Mas posso ajudar em 15 min?

Tenho 2 slots hoje: [14h] ou [16h30] (BRT)

Calendly: [link]

Abraço,
Rodrigo
```

**Se cliente marcar call:** Vá para script de call (seção 3.8)  
**Se não marcar:** Envie (D+5) e-mail com screenshot de "como subir docs"

---

### 3.3 D+5 sem doc subido → E-mail pessoal + screenshot

**Critério:** Cliente não subiu nenhum documento para treinar IA  
**Ação:** E-mail com screenshot step-by-step  
**SLA:** Envie em D+5  
**Template:**
```
Oi [Nome],

Notei que você não subiu documentos ainda na plataforma.

Segue um print com exatamente aonde clicar. Leva 3 min:
[screenshot anexo: nav para Documents > Upload]

Dúvida? Manda msg direto.

Rodrigo
```

**Anexo:** Screenshot annotado com setas/números  
**Se cliente subir doc:** Monitore Readiness (ir para 3.4)

---

### 3.4 D+7 com Readiness 30-60 → Nudge com sugestão específica

**Critério:** Readiness entre 30-60% — IA foi treinada, mas tem espaço de melhora  
**Ação:** WhatsApp com sugestão objetiva baseada em qual dimensão está baixa  
**SLA:** Envie em D+7  
**Template (exemplo se "Coverage" está baixa):**
```
Oi [Nome]! 

Sua IA está em 45% — bora levantar?

Vi que "cobertura" está baixa. Isso significa: 
você subiu 10 docs, mas IA conhece só 5 categorias de pergunta.

Dica: quando subir mais 5 docs, já sobe pra 70%.

Quer tentar?
```

**Dimensões possíveis:** Coverage (variedade de docs), Accuracy (qualidade de treino), Relevance (ajuste fino)  
**Próximo passo:** D+10, monitore se Readiness cresceu

---

### 3.5 D+10 com Readiness ≥60 mas sem conexão WhatsApp → Call de ativação

**Critério:** IA bem treinada (Readiness ≥60%), mas cliente não conectou WhatsApp Business  
**Ação:** Call de 20min para ativar conexão  
**SLA:** Agende em D+10, execute D+10 ou D+11  
**Template (WhatsApp):**
```
[Nome], tudo certo?

Sua IA está pronta (62% Readiness). 

Só falta conectar no WhatsApp pra começar a usar de verdade.

Posso fazer isso em 20 min com você — sexta-feira 14h?

Calendly: [link]
```

**Se cliente aceitar:** Vá para script de call (seção 3.8 — cenário "cliente confuso")  
**Se não responder em 48h:** Pule para D+14

---

### 3.6 D+14 ainda no trial → E-mail pessoal com case study + cupom

**Critério:** Cliente está ativo mas não converteu ainda  
**Ação:** E-mail pessoal com case study + cupom LASTDAY14 (10% off primeiros 3 meses)  
**SLA:** Envie em D+14  
**Template:**
```
Oi [Nome],

Faltam 7 dias pro trial expirar.

Antes de você decidir, queria mostrar um case similar ao seu:
[case_study.pdf]

Um hotel em São Paulo usava IA pra resposta de WhatsApp manual (3h/dia em atendimento).
Depois de ZappIQ: 90% das perguntas resolvidas automaticamente.
Economizou R$3k/mês em operacional.

Você quer chegar lá também?

Cupom LASTDAY14 — 10% off primeiros 3 meses.
```

**Próximo passo:** D+20, último empurrão

---

### 3.7 D+20 último empurrão → Mensagem humana direta

**Critério:** Cliente ainda não converteu — última chance  
**Ação:** Mensagem WhatsApp curta, humana, sem copy  
**SLA:** Envie em D+20  
**Template:**
```
[Nome], só faltam 24h.

Sei que talvez não tenha dado certo, e tudo bem.
Mas se quiser conversar antes de decidir, fico feliz.

Rodrigo
```

**Tom:** Humano, sem urgência artificial  
**Se não responder:** Trial expira, marque como `abandoned`

---

## 4. Templates WhatsApp (5 curtos, ≤200 chars)

### W1 — Welcome (D+1 sem login)
```
Oi [Nome]! 👋 
Criei um trial ZappIQ pra você.
Se bater dúvida, é só chamar.
Link: [trial_url]
```
**Caracteres:** 98

### W2 — Readiness nudge (D+7, 30-60%)
```
[Nome], sua IA tá em 45%. 
Subir 5 docs deixa em 70%.
Quer tentar?
```
**Caracteres:** 68

### W3 — Ativação WhatsApp (D+10, Readiness ≥60)
```
[Nome], IA pronta (62%)!
Falta conectar no WhatsApp.
Agende 20 min: [calendly_link]
```
**Caracteres:** 87

### W4 — Última chance (D+20)
```
[Nome], amanhã trial expira.
Se quiser conversar, fico por aqui.
Rodrigo
```
**Caracteres:** 81

### W5 — Reativação pós-trial (cancela antes de expirar)
```
[Nome], entendi que não deu certo.
Mas posso oferecer uma pausa em vez de cancelamento — 30 dias sem cobrar.
Chama no direto?
```
**Caracteres:** 145

---

## 5. Templates E-mail Pessoal do Founder (3, ≤300 palavras)

### E1 — Onboarding call (D+3, Readiness <10)
```
Assunto: Vamos subir sua IA em 15 min?

Oi [Nome],

Vi que você criou um trial ZappIQ. Readiness da sua IA ainda está em 0%.

Tranquilo — treinamento de IA leva tempo. Mas posso ajudar em 15 min?

Tenho 2 slots hoje: 14h ou 16h30 (BRT).

Calendly: [link]

Abraço,
Rodrigo
```
**Palavras:** 74

### E2 — Case study + cupom (D+14)
```
Assunto: Um case similar ao seu (e cupom)

Oi [Nome],

Faltam 7 dias pro trial expirar.

Queria mostrar um case que acho relevante:

Um hotel em São Paulo respondia perguntas de WhatsApp manualmente (3h/dia).
Depois de ZappIQ: 90% das respostas automáticas.
Resultado: economizou R$3k/mês em operacional.

Você quer chegar lá também?

Tenho um cupom especial: LASTDAY14 — 10% off primeiros 3 meses.

Rodrigo
```
**Palavras:** 96

### E3 — Screenshot onboarding (D+5, sem doc)
```
Assunto: Como subir seu primeiro documento

Oi [Nome],

Notei que você não subiu documentos ainda.

Segue um print com exatamente aonde clicar — leva 3 min:
[SCREENSHOT: Documents > Upload > Select Files]

Dúvida? Manda mensagem direto.

Rodrigo
```
**Palavras:** 56

---

## 6. Scripts de Call de Ativação (3 cenários)

### Cenário A — Cliente confuso (sem docs, Readiness <10)

**Objetivo:** Descomplicar o primeiro passo  
**Duração:** 15-20 min

1. **Aquecimento (1 min):** "E aí? Tudo bem? Viu a plataforma?"
2. **Diagnóstico (3 min):** "Qual foi a maior dúvida que você teve?"
   - Se: "Não sabia por onde começar" → vá para passo 4
   - Se: "Achei técnico demais" → vá para passo 5
3. **Valor (2 min):** "ZappIQ não é pra programador. É pra empresário economizar tempo."
4. **Ação — Subir documento (10 min):**
   - "Vou compartilhar minha tela. Você tem um doc aí que responda 90% das perguntas que seus clientes fazem?"
   - Se sim: Peça documento, faça upload ao vivo, mostre Readiness subindo
   - Se não: "Posso recomendar um template genérico do seu ramo?"
5. **Fechamento (2 min):** "Você topa treinar mais 2-3 docs essa semana?" → agend check-in D+10

### Cenário B — Cliente com objeção de preço (Readiness ≥60)

**Objetivo:** Justificar valor sem descontar  
**Duração:** 20 min

1. **Aquecimento (1 min):** "Vimos que sua IA tá bem treinada. Como foi?"
2. **Objeção (2 min):** Deixe cliente falar. Não interrompa.
3. **Empathia (1 min):** "Entendo. Preço é decisão importante."
4. **Valor (5 min):** "Mas deixa eu colocar na realidade do seu negócio.
   - Quanto tempo você investe respondendo WhatsApp por semana? [AGUARDE]
   - A quanto sai isso em custo de operacional?
   - Se ZappIQ responde 70% automaticamente, qual é o ROI em 3 meses?"
5. **Alternativa (5 min):** 
   - "Se mensal fica apertado, tenho Growth [R$497] — metade do preço, menos features. Começa ali?"
   - Ou: "Posso fazer 3 meses de Scale [R$997] com cupom LAUNCH25 — fica R$748/mês."
6. **Fechamento (2 min):** "Qual faz mais sentido? Growth ou Scale com cupom?"

### Cenário C — Cliente com objeção técnica (integração, dados)

**Objetivo:** Tirar o medo de risco técnico  
**Duração:** 20 min

1. **Aquecimento (1 min):** "Qual era a preocupação técnica?"
2. **Objeção (2 min):** Deixe falar. Anote.
3. **Segurança (5 min):** "Segurança é sério pra gente também.
   - Dados seus ficam em Supabase (mesma infra que Stripe).
   - Integração WhatsApp é read-only — ZappIQ nunca manda mensagem sem seu comando.
   - LGPD compliant — você controla quem acessa dados."
4. **Técnico (5 min):** Compartilhe tela, mostre logs de integração, health checks
5. **Garantia (3 min):** "Você tem 14 dias pra testar de graça. Se não gostar, cancela e fim. Sem penalidade."
6. **Fechamento (2 min):** "Topa converter pra Scale e a gente testa junto?"

---

## 7. Métricas Diárias (15 min de manhã)

**Queries SQL para rodar todo dia, 8h BRT:**

```sql
-- Trials ativos
SELECT COUNT(*) as trials_ativos, 
  ROUND(AVG(readiness_score), 0) as readiness_medio
FROM trials 
WHERE created_at > NOW() - INTERVAL '21 days'
  AND status = 'active';

-- Sem login em 24h
SELECT id, email, created_at FROM trials 
WHERE created_at > NOW() - INTERVAL '1 day'
  AND last_login IS NULL;

-- Readiness <10 com D+3
SELECT id, email, readiness_score, created_at FROM trials 
WHERE created_at = CURRENT_DATE - INTERVAL '3 days'
  AND readiness_score < 10;

-- Sem document upload com D+5
SELECT id, email, created_at FROM trials 
WHERE created_at = CURRENT_DATE - INTERVAL '5 days'
  AND documents_count = 0;

-- Readiness 30-60 em D+7
SELECT id, email, readiness_score FROM trials 
WHERE created_at = CURRENT_DATE - INTERVAL '7 days'
  AND readiness_score BETWEEN 30 AND 60;

-- Readiness ≥60 sem WhatsApp com D+10
SELECT id, email, readiness_score FROM trials 
WHERE created_at = CURRENT_DATE - INTERVAL '10 days'
  AND readiness_score >= 60
  AND whatsapp_connected = false;

-- Conversão por dia (paid trials)
SELECT DATE(converted_at) as data, COUNT(*) as conversoes 
FROM trials 
WHERE converted_at IS NOT NULL 
GROUP BY DATE(converted_at) 
ORDER BY data DESC LIMIT 7;
```

**Check-in de 15 min:**
- [ ] Trials ativos? Readiness médio aumentou?
- [ ] Alguém sem login 24h? (envie D+1 WhatsApp)
- [ ] Alguém em D+3 com Readiness <10? (ofereça call)
- [ ] Alguém em D+5 sem doc? (envie screenshot)
- [ ] Alguém em D+7 com Readiness 30-60? (nudge específico)
- [ ] Alguém em D+10 com Readiness ≥60 sem WhatsApp? (agende call)
- [ ] Conversões de ontem? Trending up ou down?

---

## 8. Critério de "Desistir" (quando não insistir)

| Sinal | Ação | Status |
|-------|------|--------|
| 3 mensagens sem resposta | Parar de enviar | `abandoned` |
| Readiness 0 em D+10 | Ofereça call 1x, depois parar | `abandoned` |
| Cliente explicitamente pede parar | Respeite, cancele trial | `requested_cancellation` |
| Conversation abandonment >48h no D+5-D+10 | Marque abandoned, próxima tentativa D+20 só | `sleeping` |

**Flag no banco:** `trials.status IN (abandoned, sleeping, requested_cancellation)`  
**Review semanal:** Toda sexta, quantos trials entram em abandonment vs conversão

---

## 9. Pós-conversão Trial → Pago (primeiras 72h críticas)

Se cliente converter:

1. **Imediato (0-5 min):** E-mail com invoice + link do plano ativo
2. **D+1:** Envie WhatsApp: "Bem-vindo! Sua IA tá rodando. Dúvida?"
3. **D+3:** Peça feedback: "Como foi sua experiência no trial?"
4. **D+7:** Envie métrica: "Sua IA respondeu 47 perguntas automaticamente essa semana"

**Métrica de sucesso:** 90% de clientes que convertem conseguem 1ª interação automatizada no WhatsApp em D+3

---

**Fim do playbook.** Próximo review: 2026-05-15.
