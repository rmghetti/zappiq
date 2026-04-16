# ZappIQ — Guia de Execucao Pre-Launch

**D-Day: 30 de abril de 2026**
**Go/No-Go: 29 de abril, 14:00 SP**
**Responsavel: Rodrigo Ghetti**
**Gerado em: 16 de abril de 2026**

---

## Status Atual

Tudo que era automatizavel sem credenciais externas foi concluido. Este documento lista as 7 etapas manuais restantes, na ordem de execucao recomendada. Tempo estimado total: ~3 horas (distribuidas ao longo dos proximos dias).

---

## ETAPA 1 — Meta / WhatsApp Business API

**Tempo estimado:** 1-3 dias (inclui review da Meta)
**Prioridade:** CRITICA — sem isso nao ha produto

### O que voce precisa antes de comecar

1. Um numero de telefone que NAO esteja vinculado a nenhum WhatsApp pessoal ou WhatsApp Business App. Pode ser um chip novo ou numero virtual. O numero precisa receber SMS ou chamada para verificacao.
2. CNPJ ativo e documentos da empresa (contrato social, cartao CNPJ, ou comprovante de endereco comercial).
3. Conta no Meta Business Suite (business.facebook.com) — se nao tiver, crie com seu Facebook pessoal.

### Passo a passo

**1.1 Criar Meta Business Portfolio (se nao existir)**
- Acesse business.facebook.com
- Clique "Criar conta" → preencha com dados da ZappIQ (nome juridico, endereco, site)
- Isso gera seu Business Portfolio ID

**1.2 Verificar o negocio**
- Meta Business Suite → Configuracoes → Central de Seguranca → Verificacao do Negocio
- Faca upload de UM dos seguintes: cartao CNPJ, contrato social, conta de luz/telefone no nome da empresa
- A Meta analisa em 1-3 dias uteis (as vezes em horas)
- SEM verificacao: limite de 250 mensagens/24h e apenas 2 numeros
- COM verificacao: sem limite pratico de mensagens, multiplos numeros

**1.3 Criar App no Meta for Developers**
- Acesse developers.facebook.com → "Meus Apps" → "Criar App"
- Tipo: "Business" → associe ao seu Business Portfolio
- Na tela do app, clique "Adicionar Produto" → selecione "WhatsApp"
- Isso cria automaticamente uma WhatsApp Business Account (WABA) vinculada ao seu portfolio

**1.4 Configurar numero de producao**
- No painel do app → WhatsApp → Configuracao da API
- Voce vera um numero de teste da Meta (para dev). Clique "Adicionar numero de telefone"
- Insira o numero novo → receba codigo por SMS ou chamada → verifique
- Anote os valores gerados:
  - **Phone Number ID** (ex: 123456789012345)
  - **WhatsApp Business Account ID** (ex: 109876543210987)

**1.5 Gerar Access Token permanente**
- No Meta for Developers → seu app → Configuracoes → Basico → anote o App Secret
- Meta Business Suite → Configuracoes → Usuarios do sistema → "Adicionar"
- Crie um usuario de sistema com papel "Admin"
- Gere token com permissoes: `whatsapp_business_messaging`, `whatsapp_business_management`
- ANOTE O TOKEN — ele so aparece uma vez

**1.6 Configurar Webhook**
- No Meta for Developers → seu app → WhatsApp → Configuracao
- URL do webhook: `https://zappiq-api.fly.dev/api/webhook/whatsapp`
- Token de verificacao: `9652013b8657cee11a9d5d0593216d5ec2cbb16dea721d458651f18d7cbe1528` (ja configurado no .env)
- Campos para assinar: `messages`, `message_deliveries`, `message_reads`
- Clique "Verificar e salvar" — a Meta faz um GET com challenge, nosso codigo ja responde

**1.7 Setar secrets no Fly.io**
```bash
fly secrets set \
  WHATSAPP_PHONE_NUMBER_ID="SEU_PHONE_NUMBER_ID" \
  WHATSAPP_BUSINESS_ACCOUNT_ID="SEU_WABA_ID" \
  WHATSAPP_ACCESS_TOKEN="SEU_TOKEN_PERMANENTE" \
  -a zappiq-api
```

**1.8 Testar end-to-end**
- Envie uma mensagem do seu WhatsApp pessoal para o numero configurado
- Verifique nos logs do Fly: `fly logs -a zappiq-api | grep Webhook`
- Deve aparecer `[Webhook] WhatsApp webhook verified successfully` e o payload da mensagem

### Compliance Meta — Regras que voce precisa seguir

- **Opt-in obrigatorio:** Usuarios devem dar consentimento ANTES de receber mensagens. O onboarding do ZappIQ ja coleta isso.
- **Templates de mensagem:** Mensagens proativas (marketing, utility) precisam de templates aprovados pela Meta. Crie na Meta Business Suite → WhatsApp → Gerenciador de Templates.
- **Janela de 24h:** Apos uma mensagem do usuario, voce tem 24h para responder livremente (session messages). Fora da janela, so templates aprovados.
- **Categorias de preco:** Marketing (mais caro), Utility (medio), Authentication (medio), Service (gratis se dentro da janela). Para o Brasil, o custo por conversa marketing gira em torno de R$0,50.
- **Proibicoes:** Nao enviar spam, nao vender dados, nao usar para conteudo ilegal. Meta monitora e suspende contas que violam.

---

## ETAPA 2 — Sentry (Monitoramento de Erros)

**Tempo estimado:** 15 minutos
**Prioridade:** ALTA — precisa estar ativo antes de producao

### Passo a passo

**2.1 Criar conta/projeto**
- Acesse sentry.io → Sign Up (pode usar GitHub SSO)
- Crie organizacao "ZappIQ"
- Crie projeto: plataforma "Node.js", nome "zappiq-api"

**2.2 Copiar DSN**
- Apos criar o projeto, Sentry mostra o DSN no formato:
  `https://<key>@<org-id>.ingest.us.sentry.io/<project-id>`
- Copie esse valor

**2.3 Setar no Fly**
```bash
fly secrets set SENTRY_DSN="https://xxx@xxx.ingest.us.sentry.io/xxx" -a zappiq-api
```

**2.4 Validar**
- Apos o proximo deploy, force um erro de teste na API
- Verifique no painel do Sentry se o erro apareceu

---

## ETAPA 3 — Resend (Email Transacional)

**Tempo estimado:** 20 minutos
**Prioridade:** ALTA — emails de trial dependem disso

### Passo a passo

**3.1 Criar conta**
- Acesse resend.com → Sign Up

**3.2 Verificar dominio**
- Settings → Domains → Add Domain → `zappiq.com.br`
- Resend pede 3 registros DNS:
  - 1 TXT (SPF)
  - 1 TXT (DKIM)
  - 1 MX ou CNAME
- Adicione esses registros no seu provedor de DNS (Cloudflare, Registro.br, etc.)
- Aguarde propagacao (minutos a horas) → clique "Verify" no Resend

**3.3 Criar API Key**
- Settings → API Keys → Create API Key
- Nome: "zappiq-api-production"
- Dominio: zappiq.com.br
- Permissao: "Sending access"
- Copie a chave (formato: `re_xxxxx`)

**3.4 Setar no Fly**
```bash
fly secrets set \
  RESEND_API_KEY="re_xxxxx" \
  EMAIL_FROM="ZappIQ <hello@zappiq.com.br>" \
  EMAIL_REPLY_TO="founders@zappiq.com.br" \
  -a zappiq-api
```

**3.5 Testar**
- Crie um trial via onboarding em staging
- Verifique no Resend dashboard se o email de boas-vindas foi enviado
- Cheque inbox (e spam) do email destino

---

## ETAPA 4 — PostHog no Vercel

**Tempo estimado:** 5 minutos
**Prioridade:** MEDIA — analytics, nao bloqueia launch mas precisa pro D+3

### Passo a passo

**Opcao A: Via Vercel CLI**
```bash
cd apps/web
vercel env add NEXT_PUBLIC_POSTHOG_API_KEY production
# Cole: phc_kgDvBBcdwZusHHGSMakek9J8bzLxWGcyA2gzmoFqqzpP

vercel env add NEXT_PUBLIC_POSTHOG_HOST production
# Cole: https://us.i.posthog.com

vercel env add POSTHOG_API_KEY production
# Cole: phc_kgDvBBcdwZusHHGSMakek9J8bzLxWGcyA2gzmoFqqzpP
```

**Opcao B: Via Dashboard**
- Vercel → seu projeto → Settings → Environment Variables
- Adicione as 3 variaveis acima para o environment "Production"
- Faca um redeploy: `vercel --prod` ou push no branch de producao

---

## ETAPA 5 — Cloudflare DNS

**Tempo estimado:** 30 minutos
**Prioridade:** ALTA — dominio de producao

### Passo a passo

**5.1 Criar conta Cloudflare**
- Acesse cloudflare.com → Sign Up (gratuito)
- Adicione site: `zappiq.com.br`
- Cloudflare vai escanear seus registros DNS atuais

**5.2 Mudar nameservers**
- No seu registrador (Registro.br), altere os nameservers para os que o Cloudflare indicar
- Propagacao: ate 24h (geralmente 1-2h)

**5.3 Configurar registros DNS**

| Tipo | Nome | Destino | Proxy |
|------|------|---------|-------|
| CNAME | api | zappiq-api.fly.dev | DNS only (nuvem cinza) |
| CNAME | @ | cname.vercel-dns.com | DNS only (nuvem cinza) |
| CNAME | www | cname.vercel-dns.com | DNS only (nuvem cinza) |
| TXT | @ | SPF do Resend | - |
| TXT | resend._domainkey | DKIM do Resend | - |
| MX/CNAME | (conforme Resend) | Resend MX | - |

**Nota:** Comece com "DNS only" (nuvem cinza) para evitar conflitos com SSL do Fly e Vercel. Depois de tudo funcionando, pode ativar proxy (nuvem laranja) para CDN e DDoS protection.

**5.4 Configurar dominio no Vercel**
- Vercel → seu projeto → Settings → Domains → Add `zappiq.com.br` e `www.zappiq.com.br`
- Vercel emite SSL automaticamente (Let's Encrypt)

**5.5 Configurar dominio customizado no Fly**
- No terminal:
```bash
fly certs create api.zappiq.com.br -a zappiq-api
```
- Fly emite SSL automaticamente
- Atualize `APP_URL` e `CORS_ORIGINS` no Fly:
```bash
fly secrets set \
  APP_URL="https://api.zappiq.com.br" \
  -a zappiq-api
```
- Atualize `fly.toml` env CORS_ORIGINS para incluir o dominio final

---

## ETAPA 6 — Commit + Deploy

**Tempo estimado:** 10 minutos
**Prioridade:** CRITICA — entrega tudo que foi feito

### Passo a passo

**6.1 Commit das alteracoes**
```bash
cd ~/Documents/Documentos\ —\ MacBook\ Air\ de\ Rodrigo/Pessoal/ZappIQ/PROJETO\ ZAPPIQ\ 2026/zappiq

git add fly.toml \
  apps/web/components/shared/CookieBanner.tsx \
  apps/web/app/layout.tsx \
  apps/web/lib/track.ts \
  scripts/pre-launch-commands.sh \
  docs/gtm/PRE-LAUNCH-EXECUTION-GUIDE.md

git commit -m "fix: prisma migrate deploy + LGPD cookie banner + PostHog analytics consent"
```

**6.2 Deploy API no Fly**
```bash
fly deploy -a zappiq-api
```

**6.3 Deploy Web no Vercel**
```bash
git push origin main
```
(Vercel faz auto-deploy do push)

**6.4 Smoke test pos-deploy**
```bash
bash scripts/smoke-staging.sh
```

---

## ETAPA 7 — Dry-run Completo (D-4)

**Tempo estimado:** 1 hora
**Prioridade:** CRITICA — validacao final

### Fluxo a testar

1. Abrir landing page em aba anonima → cookie banner aparece
2. Clicar "Aceitar todos" → banner desaparece
3. Navegar ate CTA → clicar "Comece gratis"
4. Preencher onboarding completo (nome, email, senha, segmento, config do agente)
5. Verificar email de boas-vindas no inbox
6. Fazer login → dashboard carrega com dados do trial
7. Upload de documento para AI training
8. Verificar AI Readiness Score atualizando
9. Conectar WhatsApp (se credenciais Meta prontas)
10. Enviar mensagem teste → IA responde
11. Verificar PostHog: eventos aparecendo no dashboard
12. Verificar Sentry: nenhum erro novo

### Criterio de sucesso
Todos os 12 passos completam sem erro. Se qualquer passo falhar, documenta e corrige antes do D-Day.

---

## Checklist Resumo

| # | Etapa | Tempo | Depende de |
|---|-------|-------|------------|
| 1 | Meta/WhatsApp Business API | 1-3 dias | CNPJ + numero novo |
| 2 | Sentry | 15 min | Nada |
| 3 | Resend | 20 min | DNS (Cloudflare) |
| 4 | PostHog no Vercel | 5 min | Conta Vercel |
| 5 | Cloudflare DNS | 30 min | Registro.br |
| 6 | Commit + Deploy | 10 min | Etapas 2-5 |
| 7 | Dry-run | 1h | Tudo acima |

### Ordem otima de execucao

**Hoje (D-14):** Etapa 1 (Meta — iniciar verificacao), Etapa 2 (Sentry), Etapa 4 (PostHog)
**Amanha (D-13):** Etapa 5 (Cloudflare — comecar propagacao DNS)
**D-12:** Etapa 3 (Resend — precisa dos DNS do Cloudflare)
**D-11:** Etapa 6 (Commit + Deploy com tudo configurado)
**D-4:** Etapa 7 (Dry-run completo)
