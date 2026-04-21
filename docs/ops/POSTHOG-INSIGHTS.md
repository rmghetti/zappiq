# PostHog Insights & Dashboards — ZappIQ 2026

## Setup Rápido

1. **Cria conta em [PostHog](https://posthog.com)** (free tier suficiente para MVP)
2. **Copia API key** da aba "Data Management" → "Project Settings"
3. **Adiciona ao `.env`**:
   ```bash
   NEXT_PUBLIC_POSTHOG_API_KEY=phc_xxx
   POSTHOG_API_KEY=phc_xxx  # server-side
   ```
4. **Deploy** — dados começam a fluir em segundos

---

## 5 Insights Essenciais

### 1. **Funnel: Hero → Trial → Onboarding → Readiness60 → Paid**

**Objetivo:** Track conversão completa do usuário

1. No PostHog, clica "+ New Insight" → Funnel
2. Adiciona etapas:
   - `hero_cta_clicked` (vê landing page)
   - `register_completed` (entra em trial)
   - `onboarding_completed` (termina wizard)
   - `readiness_milestone_60` (atinge 60% AI readiness)
   - `trial_savings_banner_cta_clicked` ou evento de pagamento (upgrade)

3. **Query SQL alternativa** (Insights → SQL):
   ```sql
   SELECT
     funnel_step,
     count(distinct distinct_id) as users,
     round(100.0 * count(distinct distinct_id) / 
       first_value(count(distinct distinct_id)) over (order by funnel_step), 2) as conversion_pct
   FROM events
   WHERE event IN ('hero_cta_clicked', 'register_completed', 'onboarding_completed', 
                   'readiness_milestone_60', 'trial_savings_banner_cta_clicked')
   GROUP BY funnel_step
   ORDER BY funnel_step
   ```

---

### 2. **Breakdown por Variante de A/B**

**Objetivo:** Comparar funnel por variant

1. Funnel → Add Breakdown → `variant` property
2. Vê qual variante tem melhor conversão Hero → Trial
3. **Insight:** Se variant=control tem 35% conversão e variant=experiment tem 42%, escala experiment

---

### 3. **Conversão Trial → Paid por Dia**

**Objetivo:** Trend diário de upgrade

1. "+ New Insight" → Trends
2. Event: `trial_savings_banner_cta_clicked` (ou evento customizado de upgrade)
3. Breakdown: daily
4. **Actionable:** Vê dias fracos → dispara email de re-engagement

---

### 4. **User Retention (Day 1, 7, 30)**

**Objetivo:** % de usuários que voltam

1. Retention insight → select cohort by "register_completed"
2. Measuring: any event (login, document upload, etc)
3. **Lê:** 70% dos usuários ativos no dia 1 voltam no dia 7 = sinal de product-market fit

---

### 5. **Onboarding Drop-off**

**Objetivo:** Qual etapa tem mais drop-off

1. Funnel → adiciona todos os `onboarding_step_completed` events com step property
2. Vê onde usuários desistem → prioritiza UX naquele step

---

## 2 Dashboards Recomendados

### **Dashboard 1: Launch Dashboard** (D+0 a D+7)

Tiles:
- Funnel hero→trial (deve crescer diariamente)
- Daily signups (trend)
- Onboarding completion rate (% de registered que completam)
- Trial-to-paid conversion
- Top referrer sources

**Refresh:** hourly para monitorar live

---

### **Dashboard 2: Funnel Health** (ongoing)

Tiles:
- Hero CTA clicks (top-of-funnel awareness)
- Registration completion (ativação)
- Readiness60 milestone (feature adoption)
- Trial → Paid (monetization)
- Cohort retention (D1, D7, D30)
- Breakdown by plan (starter vs enterprise behavior)

**Refresh:** daily

---

## Migration: A/B Cookie-based → PostHog Flags (D+15)

Quando o A/B está estável (≥500 usuários por variant), migra para feature flags nativas PostHog:

1. **No PostHog web**: "Feature Flags" → "+ New flag"
   - Name: `onboarding_ui_variant`
   - Rollout: 50% users (ou custom cohort)
   - Variant A: `control`
   - Variant B: `experiment`

2. **No frontend** (`apps/web/lib/track.ts`):
   ```typescript
   // Fetch flag via API (vira POST request background)
   const variant = await fetch('/api/posthog-flag?flag=onboarding_ui_variant')
     .then(r => r.json())
     .then(d => d.variant || 'control');
   ```

3. **Deprecate cookie** `ab_variant` após 1 semana de estabilidade

**Benefício:** Rollout A/A tests, cohort-based flags, server-side rendering support

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Eventos não aparecem | Verifica POSTHOG_API_KEY no `.env` e `typeof window !== 'undefined'` |
| Double counting (backend + frontend) | Desativa server-side se client-side funciona bem (menos custo) |
| Adblocker bloqueia PostHog | Backend forwarding (`POSTHOG_API_KEY` no server) captura mesmo assim |
| Dados antigos não atualizam | Usa "Recalculate" em Insights → pode levar 5min |
| High volume/custo | Reduz sampling em `.env`: `POSTHOG_CAPTURE_SAMPLING_RATE=0.1` (10% dos eventos) |

---

## Links Úteis

- [PostHog Docs](https://posthog.com/docs)
- [Funnel Analysis Best Practices](https://posthog.com/tutorials/funnels)
- [Feature Flags for A/B Testing](https://posthog.com/docs/feature-flags)
