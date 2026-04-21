# ZappIQ — Go/No-Go Status (D-14)

**Data:** 16 de abril de 2026
**D-Day:** 30 de abril de 2026
**Go/No-Go Meeting:** 29 de abril, 14:00 SP
**Responsavel:** Rodrigo Ghetti

---

## CONCLUIDO HOJE (Sessao Claude)

| # | Item | Status | Detalhes |
|---|------|--------|----------|
| 1 | Sentry (monitoramento de erros) | DONE | Projeto criado, DSN configurado no Fly.io |
| 2 | Resend (email transacional) | DONE | API Key `zappiq-api-production` criada, dominio `zappiq.com.br` verificado |
| 3 | PostHog (analytics) | DONE | Env vars configuradas no `.env.local` (Vercel precisa config manual no dashboard) |
| 4 | LGPD Cookie Banner | DONE | `CookieBanner.tsx` criado, integrado no layout, gating de analytics |
| 5 | PostHog consent gating | DONE | `track.ts` e `identify()` respeitam consent do cookie banner |
| 6 | fly.toml corrigido | DONE | `prisma migrate deploy` em vez de `prisma db push` |
| 7 | Sentry config | DONE | HTTP sender sem SDK (`sentry.ts`) |
| 8 | Fly.io secrets | DONE | SENTRY_DSN + RESEND_API_KEY + EMAIL_FROM + EMAIL_REPLY_TO |
| 9 | Git push + Deploy | DONE | Commit bd9905d pushed, API deployed no Fly.io, Vercel auto-deploy triggered |
| 10 | GitHub collaborator | DONE | `rodrigoghetti` adicionado como collaborator em `rmghetti/zappiq` |

### Credenciais Configuradas

- **Sentry DSN:** Configurado no Fly.io (projeto `zappiq-api` em sentry.io)
- **Resend API Key:** `re_gyy3XkHs_...` configurada no Fly.io
- **Email From:** `ZappIQ <hello@zappiq.com.br>`
- **Email Reply-To:** `founders@zappiq.com.br`
- **PostHog:** `phc_kgDvBBcdwZusHHGSMakek9J8bzLxWGcyA2gzmoFqqzpP` (local, falta Vercel prod)

---

## PENDENTE — Acoes Manuais Restantes

### CRITICO (bloqueia launch)

**1. Meta / WhatsApp Business API** (1-3 dias)
- Criar Meta Business Portfolio (business.facebook.com)
- Verificar negocio com CNPJ/documentos
- Criar app no Meta for Developers (tipo Business)
- Configurar numero de producao (chip novo, sem WhatsApp vinculado)
- Gerar Access Token permanente (usuario de sistema Admin)
- Configurar webhook: `https://zappiq-api.fly.dev/api/webhook/whatsapp`
- Token de verificacao: `9652013b8657cee11a9d5d0593216d5ec2cbb16dea721d458651f18d7cbe1528`
- Setar secrets no Fly: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_ACCESS_TOKEN
- **Requisitos:** CNPJ ativo + numero novo + documentos da empresa

**2. Cloudflare DNS** (30 min)
- Criar conta Cloudflare, adicionar `zappiq.com.br`
- Mudar nameservers no Registro.br
- Configurar CNAMEs: `api` → fly.dev, `@` e `www` → vercel
- Adicionar registros SPF/DKIM do Resend
- Configurar dominio customizado no Fly (`fly certs create api.zappiq.com.br`)
- Configurar dominio no Vercel

### ALTO (precisa pro D-Day)

**3. PostHog env vars no Vercel** (5 min)
- Vercel dashboard → Settings → Environment Variables → Production
- `NEXT_PUBLIC_POSTHOG_API_KEY=phc_kgDvBBcdwZusHHGSMakek9J8bzLxWGcyA2gzmoFqqzpP`
- `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`
- `POSTHOG_API_KEY=phc_kgDvBBcdwZusHHGSMakek9J8bzLxWGcyA2gzmoFqqzpP`
- Redeploy apos configurar

**4. Stripe identity docs** (Rodrigo handling)

### VALIDACAO (D-4)

**5. Dry-run completo** (1h)
- Landing page → cookie banner → CTA → onboarding → email → dashboard → AI training → WhatsApp → PostHog → Sentry

---

## Ordem Otima de Execucao

| Quando | O que | Tempo |
|--------|-------|-------|
| Hoje (D-14) | Iniciar verificacao Meta Business | 30 min setup + 1-3 dias review |
| Amanha (D-13) | Cloudflare DNS (comecar propagacao) | 30 min |
| D-13 | PostHog env vars no Vercel | 5 min |
| D-12 | Stripe identity docs | Rodrigo |
| D-11 | WhatsApp webhook test (se Meta aprovado) | 30 min |
| D-4 | Dry-run completo | 1h |
| D-1 | Go/No-Go meeting | 14:00 SP |

---

## Riscos

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Meta demorar na verificacao | SEM WhatsApp no launch | Iniciar HOJE, ter plano B (launch sem WhatsApp, adicionar D+7) |
| DNS propagacao lenta | Dominio customizado indisponivel | Usar subdominio fly.dev e vercel.app como fallback |
| Stripe docs rejeitados | Sem cobranca | Launch como free trial only, resolver docs em paralelo |
