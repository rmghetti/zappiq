# Go/No-Go Launch Checklist — ZappIQ 15D

**Status:** PRÉ-LAUNCH (15 dias até 30 de abril de 2026)
**Dono:** Equipe de Produto + GTM
**Última atualização:** 15 de abril de 2026

---

## 1. Pré-voo Técnico

### 1.1 Migração & Infraestrutura
- [ ] Database migration rodada sem erros em staging
- [ ] Backup diário do Postgres habilitado e testado
- [ ] WAF (Web Application Firewall) configurado e ativo
- [ ] DDoS protection (Cloudflare) validado
- [ ] Certificado SSL válido e renovação automática ativa
- [ ] CDN configurado para assets estáticos (imagens, CSS, JS)

### 1.2 Monitoramento & Observabilidade
- [ ] OpenTelemetry exporters validados (OTLP endpoint respondendo)
- [ ] Sentry DSN configurado e capturando erros em staging
- [ ] Dashboards essenciais criados (latência, error rate, QPS)
- [ ] Alertas para error rate >5% acionados com sucesso
- [ ] PagerDuty/escalation policy validada
- [ ] Logs centralizados (CloudWatch/Datadog) acessíveis

### 1.3 Testes Críticos
- [ ] Smoke test suite 100% verde em staging (`scripts/smoke-staging.sh`)
- [ ] Load test com 1.000 usuários simultâneos (<3s latência p95)
- [ ] Failover database testado (Supabase replication OK)
- [ ] Cache (Redis/Upstash) eviction policy configurada
- [ ] Rate limiting validado (100 req/min por IP)
- [ ] CORS headers configurados apenas para domínios legítimos

### 1.4 Integrações Críticas
- [ ] WhatsApp Business API webhook testado (inbound/outbound)
- [ ] Anthropic API quota aumentada (20K tokens/min confirmado)
- [ ] Stripe webhooks validados (3 tentativas de retry configuradas)
- [ ] Resend email delivery testado (inbox não spam)
- [ ] Redis connection pooling otimizada (máx 50 conexões)

### 1.5 Segurança
- [ ] Secrets rotacionados (JWT_SECRET, ANTHROPIC_API_KEY, WHATSAPP_WEBHOOK_VERIFY_TOKEN)
- [ ] .env files não commitados no Git (verifica histórico com `git log --all`)
- [ ] API authentication obrigatória (nenhum endpoint público sem _health/_ready)
- [ ] GDPR/LGPD compliance validado por legal (DPA, Privacy Policy, ToS assinados)
- [ ] Pen test realizado em staging (relatório sem críticos)

### 1.6 Rollback & Disaster Recovery
- [ ] Rollback plan documentado (fly deploy previous)
- [ ] Backup Postgres testado 5x com recovery bem-sucedido
- [ ] Runbook de observabilidade em `/docs/ops/RUNBOOK-OBSERVABILIDADE.md` atualizado
- [ ] Contatos de escalação (Anthropic, Stripe, Meta) atualizados no PagerDuty

---

## 2. Pré-voo Comercial

### 2.1 Landing Page & Marketing Assets
- [ ] Landing page em ar com certificado SSL válido
- [ ] Hero section + 3 feature cards carregam <2s
- [ ] CTA buttons (trial, comparativo, contato) funcionam
- [ ] Mobile responsiveness testada (iPhone 12, Android Samsung S21)
- [ ] SEO tags (title, meta description, OG) preenchidas
- [ ] Google Search Console indexação solicitada

### 2.2 Conteúdo Indexado
- [ ] Página de pricing indexada (`/preco`)
- [ ] Página de comparativo indexada (`/vs-competidores`)
- [ ] Blog post de launch publicado (mínimo 1 artigo >1.500 palavras)
- [ ] Breadcrumbs estruturados (JSON-LD) em todas as páginas
- [ ] XML sitemap.xml submetido ao Google Search Console

### 2.3 Legal & Compliance
- [ ] Termos de Uso publicados (`/legal/termos`)
- [ ] Política de Privacidade publicada (`/legal/privacidade`)
- [ ] Data Processing Agreement (DPA) publicado (`/legal/dpa`)
- [ ] Aviso de cookies aceito por usuário (banner configurado)
- [ ] Contato legal (email) validado (legal@zappiq.com.br)

### 2.4 Email & Automação
- [ ] Email de boas-vindas configurado (Resend template testada)
- [ ] Email de trial expirando (reminder 2 dias antes)
- [ ] Email de confirmação de pagamento (Stripe webhook)
- [ ] Unsubscribe link em todos os emails (LGPD compliance)

### 2.5 Analytics & Attribution
- [ ] Google Analytics 4 instalado e tracking eventos críticos
- [ ] Conversion pixel (trial signup) acionando
- [ ] UTM parameters strategy documentada
- [ ] Mixpanel/Amplitude (opcional) configurado para product analytics

---

## 3. Critérios de SOFT-LAUNCH PASS

### 3.1 User Acquisition & Conversion
- [ ] Mínimo 30 convites beta enviados a prospects/founders
- [ ] Conversão trial → paid: **≥15%** (4+ clientes pagando)
- [ ] Onboarding completion rate: **≥70%** (21+ de 30 usuários completam setup)

### 3.2 Product Quality
- [ ] Bugs S1/S2 (critical/major): **≤5** em D+7
- [ ] Error rate <2% em production (validar via Sentry)
- [ ] Latência p95 (API): **<2.5s** em operação normal

### 3.3 User Readiness & Satisfaction
- [ ] Readiness score médio (D+3): **≥25** (escala 0-50, survey simples)
  - Pergunta: "Quão preparado você se sente para usar ZappIQ em negócio?" (0-50)
  - Capturado via NPS-style popup ou email
- [ ] NPS score (D+7): **≥30** (promoters - detractors)
- [ ] Support ticket response time: **<24h**

### 3.4 Performance & Cost
- [ ] AWS spend tracking: **<R$ 5.000/mês** em staging (valida custo unitário)
- [ ] API latency p99: **<5s** (5º percentil aceitável)
- [ ] Database query time: **<500ms** (95º percentil)

---

## 4. Critérios de ABORT / ROLLBACK

**Se qualquer condição abaixo ocorrer, PAUSAR launch imediatamente:**

### 4.1 Críticos Imediatos
- [ ] **BREACH LGPD/GDPR:** Vazamento de dados pessoais de qualquer natureza → Parar, notificar ANPD, revoke trial access
- [ ] **Latência p95 >3s por >1h consecutiva** → Rollback deploy anterior
- [ ] **Error rate >10% por >30 min** → Rollback
- [ ] **Database unavailable (>5 min)** → Trigger failover; se falhar, rollback
- [ ] **WhatsApp API connectivity <50%** (Meta outage que não controlamos é OK) → Holdback

### 4.2 Sinais de Produto Falho
- [ ] **Churn D+7 ≥40%** (4+ de 10 trial users deletam conta ou cancelam) → Pausa marketing, diagnostica problemas
- [ ] **Readiness score médio (D+3) <25** (indicador forte de product-market fit baixo) → Pausa soft-launch, pivot required
- [ ] **Conversion trial→paid <8%** (2 de 25+ convites) → Investiga onboarding, value prop
- [ ] **Suporte overload** (>20 tickets backlog) → Aumenta staffing ou pausa growth

### 4.3 Sinais Comerciais
- [ ] **Não conseguir 30 convites iniciais** → Produto não tem demanda comprovada
- [ ] **Landing page bounce rate >60%** → Copy/design não ressoa; revise messaging
- [ ] **Zero qualified leads em D+3** → Channels ou positioning problema

### 4.4 Riscos Externos
- [ ] **Meta (WhatsApp) API downtime >4h** → Pausa growth campaigns até resolução
- [ ] **Anthropic rate-limit atingido** → Increase quota ou trottle load; pausa feature IA

---

## 5. Processo de Go/No-Go Decision

### Reunião de Go/No-Go (D-1, 29 de abril, 14:00 SP)

**Participantes:**
- Rodrigo (Founder/CEO)
- [Lead Técnico]
- [Lead de Produto]
- [Lead de GTM]

**Agenda (30 min):**
1. Review de cada seção (pré-voo técnico, comercial, soft-launch)
2. Verificação de critérios ABORT
3. Votação: Go / No-Go / Go com mitigação
4. Se Go: confirmar timeline exact (30 de abril, 09:00 SP ou horário alternativo)
5. Se No-Go: identificar blocker principal e reagendar

**Saída:**
- Email de confirmação com assinatura de todos
- Runbook atualizado com horário de launch
- Canais de escalação validados

---

## 6. Go-Live Checklist (D-Day, 30 de abril)

### 6.1 Morning (06:00-08:00 SP)
- [ ] Equipe técnica online (ao menos 2 pessoas)
- [ ] Monitoring dashboard aberta (Datadog/CloudWatch live)
- [ ] Slack channel `#launch-war-room` criado + pinned runbook
- [ ] PagerDuty alerting testado (fire fake alert)

### 6.2 Launch (08:00-09:00 SP)
- [ ] Deploy final realizadof
- [ ] Smoke tests 100% verde em production
- [ ] Landing page carrega e conversão pixel tracking
- [ ] Email de launch enviado para early access list
- [ ] PR de soft-launch publicado em GitHub
- [ ] Tweet/LinkedIn post publicado

### 6.3 Monitoramento Pós-Launch (09:00-17:00 SP)
- [ ] Refresh Sentry/Datadog a cada 15 min
- [ ] Verificar trial signups (expectativa: 5-10 D+1)
- [ ] Check customer emails/support (responder <2h)
- [ ] Documentar anomalias em `/docs/launch-incidents-2026-04-30.md`

---

## 7. Checkboxes para Automação

Este checklist pode ser transformado em GitHub issues automaticamente via:
```bash
# Comando sugerido (não executar sem aprovação)
gh issue create --title "Go/No-Go Checklist — Launch D-1" --body "$(cat docs/gtm/GO-NO-GO-CHECKLIST.md)"
```

---

## Contato & Ownership

- **Dono:** Rodrigo Ghetti (CEO)
- **Review:** Equipe técnica + GTM (semanal até launch)
- **Escalação:** [PagerDuty escalation policy link]
- **Última verificação:** 15 de abril de 2026

---

**GO-NO-GO STATUS: PENDING (awaiting D-1 review)**
