# Email Setup · Resend

Checklist operacional para configurar envio de e-mails via Resend na ZappIQ.

## 1. Criar conta Resend

- Acesse https://resend.com/signup
- Sign up com e-mail da ZappIQ (founders@zappiq.com.br)
- Copie a **API Key** (começa com `re_`)

## 2. Adicionar domínio

- No dashboard Resend, vá a **Domains**
- Clique **Add Domain**
- Digite: `zappiq.com.br`
- Resend vai gerar 4 registros DNS:
  - 3x **CNAME** (DKIM: `default._domainkey`, `selector1._domainkey`, `selector2._domainkey`)
  - 1x **TXT** (SPF)
  - 1x **TXT** (DMARC)

## 3. Configurar DNS

- Acesse o registrador de domínio (provavelmente Registro.br)
- Adicione todos os **4 registros** copiados de Resend
- Aguarde propagação (15-30 min, às vezes até 2h)

## 4. Validar registros

Abra terminal e execute:

```bash
# Validar SPF
dig TXT zappiq.com.br | grep -i spf

# Validar DKIM (selector default)
dig TXT default._domainkey.zappiq.com.br

# Validar DMARC (opcional, se configurado)
dig TXT _dmarc.zappiq.com.br
```

Todos devem retornar valores (não "NODATA", não erros).

## 5. Verificar em Resend

No dashboard Resend > Domains, clique no domínio e verifique:
- ✓ SPF verified
- ✓ DKIM verified
- ✓ DMARC configured (se aplicável)

Se não aparecer verde, aguarde mais propagação ou clique **Re-verify**.

## 6. Configurar variáveis de ambiente

### Localmente (`.env`)

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxx
EMAIL_FROM=ZappIQ <hello@zappiq.com.br>
EMAIL_REPLY_TO=founders@zappiq.com.br>
APP_URL=https://app.zappiq.com.br
```

### Em Produção (Fly.io)

```bash
fly secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxx
```

As outras variáveis já estão defaultadas em `env.ts`.

## 7. Teste smoke

```bash
# 1. Obter token de autenticação
export TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"..."}' | jq -r '.token')

# 2. Disparar e-mail de savings (vai chamar Resend real)
curl -X POST http://localhost:3001/api/savings-email/dispatch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"competitorSetupBrl":8000,"competitorMonthlyBrl":1500}'

# 3. Verificar resposta
# Deve retornar: { "delivered": "resend", "providerId": "...", ... }
```

Se em **development** (NODE_ENV !== production):
- Endpoint apenas loga e retorna `{ "delivered": "log", "providerId": "log:...", ... }`
- Nenhum e-mail é enviado — útil para testes locais sem gastar quota Resend

## 8. Monitorar envios

Dashboard Resend > Analytics:
- Visualiza e-mails enviados, entregues, bounce, spam
- Alertas automáticos se taxa de erro > threshold

## Troubleshooting

| Problema | Solução |
|---|---|
| "SPF record not found" | Aguarde propagação DNS ou clique Re-verify em Resend |
| "DKIM failed" | Copie exatamente o valor de DKIM, sem espaços ou quebras |
| E-mail vai para spam | Valide DMARC/DKIM no https://mxtoolbox.com/emailhealth |
| API Key inválida | Copie novamente da página de API Keys do Resend (não confunda com project tokens) |

## Links úteis

- Documentação Resend: https://resend.com/docs
- MXToolbox (validar DNS): https://mxtoolbox.com
- Postmaster (Google): https://postmaster.google.com
