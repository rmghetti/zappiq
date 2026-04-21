# Incident Response Playbook — ZappIQ

**Versão:** 1.0  
**Data:** 2026-04-15  
**Autor:** Rodrigo Ghetti  
**Público:** Ops, Dev Lead, CEO  
**Objetivo:** Resposta padronizada a incidentes de produção

---

## 1. Classificação de Severidade

| Nível | Definição | Exemplo | SLA Resposta | SLA Resolução |
|-------|-----------|---------|--------------|---------------|
| **S1** | Produção quebrada, clientes não conseguem usar | API down, WhatsApp integração offline, perda de dados | **≤15 min** | **≤60 min** |
| **S2** | Degradação de performance, funcionalidade reduzida | IA respondendo 50% mais lento, upload de docs falhando 30% | **≤60 min** | **≤4h** |
| **S3** | Bug menor, feature parcialmente quebrada | Botão de logout não funciona, relatório com número errado | **≤4h** | **≤24h** |
| **S4** | Cosmético, typo, UI glitch | Texto desalinhado, tooltip incorreto | Próximo sprint | Próximo sprint |

---

## 2. Fluxo de Resposta (Incidente S1)

```
┌─────────────────┐
│  Detectar (5m)  │ Sentry/PagerDuty alert → CEO + Dev Lead notificados
└────────┬────────┘
         │
┌────────▼────────────┐
│  Mitigar (10m)      │ Rollback? Failover? Desabilitar feature? Scale up?
└────────┬────────────┘
         │
┌────────▼─────────────────┐
│  Comunicar (5m)          │ Status page + E-mail clientes + Slack #incidentes
└────────┬─────────────────┘
         │
┌────────▼───────────┐
│  Investigar (30m)  │ RCA: logs, traces, métricas. Qual é a causa raiz?
└────────┬───────────┘
         │
┌────────▼──────────┐
│  Resolver (15m)   │ Deploy fix + teste + validar com cliente
└────────┬──────────┘
         │
┌────────▼────────────────┐
│  Pós-mortem (24-48h)    │ Blameless, 3 ações, próximas 2 semanas
└─────────────────────────┘
```

**Tempo total S1:** 15 min (resposta) + 45 min (investigação+resolução) = **≤60 min**

---

## 3. SLAs por Severidade

| Métrica | S1 | S2 | S3 | S4 |
|---------|----|----|----|----|
| **Tempo de resposta (primeiro dev na call)** | 15 min | 60 min | 4h | Próximo sprint |
| **Tempo de mitigação** | 30 min | 2h | 8h | — |
| **Tempo de resolução** | 60 min | 4h | 24h | Próximo sprint |
| **Comunicação ao cliente** | 10 min + updates a cada 15min | 30 min + updates 1x/h | Após resolução | Nenhuma |

---

## 4. Escalation Matrix

**Quem aciona quem:**

| Condição | Ação | Lead | Tempo |
|----------|------|------|-------|
| S1 detectado (Sentry auto-alerta) | CEO + Dev Lead chamam war room | Dev Lead | ≤5 min |
| S1 + >100 clientes afetados | Aciona Advogado (ver seção 5.5) | CEO | ≤15 min |
| S1 + possível vazamento de dados | Aciona ANPD (Autoridade LGPD) | Advogado | ≤2h |
| S2 não resolvido em 2h | Escala para CEO | Dev Lead | 120 min |
| S3 não resolvido em 12h | Escala para product backlog prioritário | Tech Lead | 720 min |

---

## 5. Templates de Comunicação

### 5.1 — Status Page Update (downtime em andamento)

```
INCIDENT #2401: API Degradação
─────────────────────────────────

SEVERIDADE: S2
STATUS: 🔴 INVESTIGANDO

O que está acontecendo?
Respostas de IA estão demorando 5-10 segundos (normal: <1s).
Aproximadamente 30% das requisições estão sendo afetadas.

O que você precisa fazer?
Por enquanto: nada. Estamos resolvendo.
Acompanhe atualizações aqui.

Última atualização: 2026-04-15 14:23 BRT
Próxima atualização: 14:38 BRT
```

**Publicar em:** `/status` (interna por enquanto, futura publicação)  
**Frequência:** a cada 15 min durante S1, a cada 30 min durante S2

### 5.2 — E-mail Incidente Crítico Resolvido

```
Assunto: RESOLVIDO: Incidente de indisponibilidade ZappIQ (14:10-14:53 BRT)

Oi [Nome do Cliente],

Um incidente afetou a plataforma ZappIQ entre 14:10 e 14:53 BRT (43 minutos).

O QUE ACONTECEU?
Um erro em nossa fila de processamento de mensagens causou timeout em requisições 
de IA por aproximadamente 40 minutos. 43 clientes foram afetados.

O QUE FIZEMOS?
- 14:15: Detectamos via Sentry
- 14:25: Identificamos causa raiz (memory leak em handler de cache)
- 14:40: Deploy de hotfix
- 14:53: Validado — sistema 100% operacional

IMPACTO EM VOCÊ?
Você perdeu aproximadamente 8 mensagens automatizadas durante a janela.
Nós criamos crédito de 2 dias no seu plano para compensar.

O QUE MUDOU?
A partir de hoje, temos 1-segundo health checks no lugar de 5-second checks.
Isso reduz o tempo de detecção de falhas de 5 min para 30 segundos.

Desculpe pelo incômodo. Seu negócio é crítico pra gente.

Rodrigo
Rodrigo Ghetti — Founder, ZappIQ
```

**Enviar:** Todos os clientes pagantes afetados  
**Tempo:** <2h após resolução  
**Cc:** Advogado (para rastreamento)

### 5.3 — WhatsApp Notificação Durante Incidente (clientes pagantes)

```
⚠️ Aviso: ZappIQ em manutenção emergencial até ~14h50 BRT.

Sua IA responde automaticamente quando volta.
Acompanhe: status.zappiq.com

Obrigado!
```

**Público:** Clientes com >R$1000/mês de MRR (Scale+)  
**Timing:** 5 min após S1 declarado

### 5.4 — Carta de Desculpas + Crédito (pós-resolução)

```
Assunto: Crédito de 2 dias — Nossa responsabilidade

Oi [Nome],

Incidente de 43 min ontem. Isso não deveria ter acontecido.

Sua conta recebeu crédito automático:
- Plano: Scale R$1.697/mês
- Crédito: 2 dias = ~R$113
- Próxima cobrança: reduzida em R$113

Não precisa fazer nada. Já aplicamos.

Continuamos melhorando. Obrigado por confiar em ZappIQ.

Rodrigo
```

**Automático:** Depois de pós-mortem aprovado  
**Política de crédito:** 
- S1 ≤30 min: 1 dia de crédito
- S1 31-60 min: 2 dias
- S1 >60 min: 3 dias
- S2 não resolvido em 4h: 1 dia

### 5.5 — Notificação LGPD (possível vazamento de dados)

```
Assunto: NOTIFICAÇÃO DE INCIDENTE DE SEGURANÇA — ZAPPIQ

[Cliente],

Este é um aviso formal sobre um incidente de segurança que pode ter exposto 
seus dados pessoais, conforme Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).

DATA DO INCIDENTE: 2026-04-15 14:10-14:53 BRT
TIPO: Possível vazamento de documentos em cache compartilhado
DADOS AFETADOS: Metadados de documentos (nomes de arquivo, timestamps)
DADOS NÃO AFETADOS: Conteúdo dos documentos, chaves de API

AÇÕES QUE TOMAMOS:
1. Incidente mitigado em <1h
2. Logs revisados — nenhuma evidência de acesso malicioso
3. Cache limpo e resets de chaves de acesso
4. Investigação técnica concluída
5. Sistema reforçado

AÇÕES RECOMENDADAS A VOCÊ:
- Monitore sua conta em zappiq.com/security
- Se suspeitar atividade anômala, reporte em security@zappiq.com

MAIS INFORMAÇÕES:
Relatório técnico completo: [link privado]
Termos LGPD: [link]

Contato de Privacidade: privacy@zappiq.com
Autoridade: ANPD (Autoridade Nacional de Proteção de Dados)

ZappIQ — Privacidade é direito. Segurança é responsabilidade.

Data: 2026-04-15
Responsável: Rodrigo Ghetti, Founder
```

**Enviar para:** Todos os clientes cujos dados foram potencialmente expostos  
**Prazo legal:** 48h após confirmação de vazamento  
**Cópia para:** Advogado + ANPD (se vazamento confirmado)

---

## 6. Checklist War Room (primeiros 15 min de S1)

- [ ] **T+0 min:** Sentry alert chega, CEO/Dev Lead notificados via PagerDuty
- [ ] **T+2 min:** Founder + Dev Lead entram em call Slack (audio/video)
- [ ] **T+5 min:** Status page marcada como 🔴 "INVESTIGATING"
- [ ] **T+5 min:** Decision: Rollback vs. Hotfix vs. Failover?
- [ ] **T+10 min:** Ação mitigadora iniciada (qual for decidida)
- [ ] **T+10 min:** E-mail de notificação enviado a clientes pagantes Scale+
- [ ] **T+15 min:** Mitigação completa OU hotfix em review/testes
- [ ] **T+30 min:** Sistema validado (health checks green, amostra de requisições OK)
- [ ] **T+35 min:** Status page atualizada para 🟢 "RESOLVED"
- [ ] **T+40 min:** E-mail de resolução enviado a clientes afetados

---

## 7. Pós-mortem (formato blameless)

**Template de documento:**

```
PÓS-MORTEM #2401: API Degradação 43 min
─────────────────────────────────────────
Data: 2026-04-15
Facilitador: [Dev Lead]
Participantes: [Dev Lead], [Backend Engineer], [Ops], [CEO]

IMPACTO
- Duração: 43 minutos (14:10-14:53 BRT)
- Clientes afetados: 43 (Scale+)
- Mensagens perdidas: ~320
- Revenue impactado: R$89 (1 dia de Scale × 43 clientes)

CRONOGRAMA
14:10 — Primeiro erro em logs (memory spike em Node v1.8.2)
14:15 — Sentry alerta (após 5-min health check window)
14:20 — Dev Lead analisa: "Cache está vazando memória"
14:25 — Root cause: Redis key TTL não foi renovado em deploy anterior
14:40 — Hotfix mergido (reset TTL policy)
14:53 — Validação completa, sistema verde

CAUSA RAIZ (5 Por quês)
1. Por que API degradou? → Memory leak no cache
2. Por que memory leak? → TTL policy quebrada em v1.8.2
3. Por que v1.8.2 foi pra prod? → Deploy automático, teste não cobriu TTL edge case
4. Por que teste não cobriu? → Cobertura de testes em cache=72%, faltava renovação
5. Por que cobertura é baixa? → Cache testing é "low priority" vs. features

AÇÕES (próximas 2 semanas)
1. [ ] **Imediato (hoje):** Code review de todos os Redis.set() calls — ensure TTL
2. [ ] **48h:** Adicionar testes de TTL em Suite de Cache (coverage 72% → 95%)
3. [ ] **1 semana:** Implementar "Cache Health Check" endpoint que valida TTL expirations
4. [ ] **2 semanas:** OKR de Q2: "Zero cache incidents" — monitoramento proativo

APRENDIZADOS
✓ Health checks de 5-segundo interval são suficientes, mas poderiam ser 2-segundo
✓ Logs indicavam problema 5 min antes do alert — temos sinal, faltava automação
✓ Hotfix foi correto; não foi rollback — confiança na fix foi bem-colocada

O QUE DEU CERTO
- Resposta rápida (<5 min após detectar)
- Causa raiz identificada em <15 min
- Comunicação clara ao cliente
- Crédito automático sem discussão

O QUE ERROU
- 5 min de delay entre erro e alert (deveria ser <1 min)
- Nenhum teste proativo de TTL renewal em prod (pré-deploy)
- Deploy automático sem humano double-checking (era 22h, fora do horário)

PRÓXIMO REVIEW: 2026-05-15
```

**Distribuição:**
- Slack #incidentes (público interno)
- E-mail ao CEO + Dev Lead
- Arquivo em `/docs/ops/incidents/` para histórico

---

## 8. Checklist Pós-mortem (blameless, estruturado)

- [ ] Facilitador designado (não precisa ser quem causou)
- [ ] 5 "Por quês" respondidos objetivamente (sem culpa)
- [ ] Impacto quantificado (duração, clientes, revenue)
- [ ] Cronograma detalhado (timestamps + ações)
- [ ] Mínimo 3 ações concretas listadas com owner
- [ ] Próximo review agendado
- [ ] Documento compartilhado interno + GitHub issue criada pra cada ação
- [ ] Não há conclusão tipo "ser mais cuidadoso" — sempre técnico

---

## 9. Política de Comunicação

### Durante incidente
- **T+5 min:** Status page + Slack #incidentes (interno)
- **T+10 min:** E-mail para clientes Scale+ (se S1)
- **T+15 min:** WhatsApp para clientes Business/Enterprise (se S1 + >60 min projetado)
- **A cada 15 min:** Atualizar status page com ETA

### Após resolução
- **<2h:** E-mail de resolução + crédito automático
- **<24h:** Pós-mortem draft
- **<48h:** Pós-mortem aprovado + ações públicas (internamente)

### Linguagem
- Clara, sem jargão técnico em comunicação ao cliente
- Reconhecer problema ("desculpe")
- Explicar causa em termos simples ("cache memory overflow")
- Ação compensatória sempre (crédito, não desculpa vazia)

---

## 10. Definições Operacionais

**Downtime vs. Degradação:**
- **Downtime (S1):** ≥20% de requisições falhando OU ≥10 clientes sem acesso por >5 min
- **Degradação (S2):** 5-20% de requisições lentas (>5s) OU funcionalidade reduzida

**Quem declara incidente:**
- Sentry auto-alerta → S1
- Observação manual por dev → pode ser S1, S2 ou S3
- Customer report → Dev Lead avalia

**Quem resolve:**
- S1: CEO + Dev Lead tomam decisão de mitigation
- S2: Dev Lead + Back-end Lead
- S3: Eng assignment normal (backlog)

---

**Fim do playbook.** Próximo review: 2026-05-15.
