# RUNBOOK — Trocar Número da Iza

> **Trigger:** Rodrigo diz "trocar número da Iza" ou equivalente.
> **Última atualização:** 2026-04-22
> **Status da operação:** Aguardando Rodrigo provisionar eSIM nova + cadastrar no Meta Dashboard.

---

## Contexto acumulado (histórico-chave)

**P0 original (22/04/2026):** Iza não responde mensagens em produção. D-Day público 28/04/2026.

**Diagnóstico concluído via Chrome MCP (Meta Dashboard + Graph API + Fly logs):**
- Toda configuração Meta estava correta: WABA aprovada, App subscribed, callback URL OK, HMAC valida, toggle `messages` v25.0 assinado, sem `override_callback_uri`.
- Test button do Dashboard Meta → webhook entrega HTTP 200 (HMAC bate).
- **Mas:** mensagens reais do celular do Rodrigo → ZERO webhook em `zappiq-api` no Fly.
- Phone +55 11 94563-3305: `status: CONNECTED`, `account_mode: LIVE`, `verified_name: ZappIQ`.
- Tentamos `deregister + register` via Graph API — deregister OK (200), **register falhou com `#133005 Two step verification PIN Mismatch`**. Rodrigo não lembra do PIN de 2FA configurado no App antigo.

**Causa-raiz mais provável (diagnóstico descartável):**
Split-brain residual / lag Meta pós-migração. Número foi usado no WhatsApp Business App, conta excluída formalmente há ~1 semana (dentro do cooldown 15 dias). Re-register forçado teria resolvido, mas bloqueado pelo PIN perdido (reset Meta via Business Manager leva 7 dias, incompatível com D-Day).

**Decisão executiva de Rodrigo:** abandonar +55 11 94563-3305 e provisionar eSIM nova.

---

## Dados do projeto (referência rápida)

| Dado | Valor |
|------|-------|
| App Meta ID | `1603310040738671` |
| Business Manager ID | `2771998979844891` |
| WABA ID atual | `2723969931308778` |
| Phone antigo (deregistered) | `+55 11 94563-3305` / phone_id `1121381984386813` |
| Fly app | `zappiq-api` |
| Callback URL | `https://zappiq-api.fly.dev/api/webhook/whatsapp` |
| Privacy Policy URL | `https://zappiq.com.br/legal/privacy` |
| App verify token | (Fly secret `META_VERIFY_TOKEN`) |
| App secret | (Fly secret `META_APP_SECRET`) |
| URL do Meta Dashboard API Setup | `https://developers.facebook.com/apps/1603310040738671/use_cases/customize/wa-dev-console/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING&product_route=whatsapp-business&business_id=2771998979844891&selected_tab=wa-dev-console` |

**Tasks do plano:**
- #77 (in_progress): Validar Iza end-to-end
- #82 (completed): Tentativa recuperar número antigo (falhou por PIN)
- #83 (pending): Provisionar eSIM + cadastrar novo número

---

## Ações quando Rodrigo disser "trocar número da Iza"

**Premissa de entrada:** Rodrigo retorna com eSIM ativada e número novo em mãos. Ele já deve ter:
- Contratado eSIM TIM Controle Express, Vivo Easy Controle, ou similar
- Ativado via QR code no celular como linha secundária
- **NÃO** aberto WhatsApp/WhatsApp Business com esse número (regra ouro: número dedicado Cloud API não pode estar em App)
- Número confirmado recebendo SMS (testar mandando um SMS de outro celular)

### Passo 1 — Coletar número novo

Perguntar: "Qual o número novo completo (+55 DDD XXXXX-XXXX) e a eSIM já está recebendo SMS?"

### Passo 2 — Cadastrar número no Meta Dashboard (via Chrome MCP)

Abrir tab Chrome em:
```
https://developers.facebook.com/apps/1603310040738671/use_cases/customize/wa-dev-console/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING&product_route=whatsapp-business&business_id=2771998979844891&selected_tab=wa-dev-console
```

Rolar até **Etapa 5: Adicionar telefone**. Clicar em "Adicionar telefone" → abre fluxo em nova página (provavelmente Gerenciador do WhatsApp Business).

Guiar Rodrigo:
1. Digitar número novo (+55 DDD XXXXX-XXXX)
2. Escolher método de verificação: **SMS** (mais rápido que ligação)
3. Receber código 6 dígitos no celular da eSIM
4. Digitar código no Dashboard → número verificado

Depois da verificação, o Meta gera um **phone_id novo**. Esse phone_id é visível na página "Configuração da API" no campo "Identificação do número de telefone".

### Passo 3 — Setar PIN 2FA do número novo IMEDIATAMENTE

**Crítico para não repetir o erro anterior.** Depois de verificar o número, IR em Gerenciador do WhatsApp Business > Conta > Verificação em duas etapas > Ativar.

**PIN sugerido:** gerar 6 dígitos aleatórios e **gravar no 1Password do Rodrigo** OU no arquivo secrets do projeto (criptografado). Nunca deixar PIN perdido de novo.

### Passo 4 — Atualizar META_PHONE_NUMBER_ID no Fly

Executar o script `UPDATE_IZA_PHONE_ID.command` (preparado neste projeto), ou diretamente:

```bash
fly secrets set META_PHONE_NUMBER_ID=<novo_phone_id> -a zappiq-api
```

Redeploy é automático após `fly secrets set`. Aguardar 30s.

### Passo 5 — Adicionar forma de pagamento (se ainda não adicionou)

No mesmo Dashboard Meta, **Etapa 6: Adicionar forma de pagamento**. Cartão corporativo.

Primeiras 1.000 conversas iniciadas por usuário/mês são grátis. Monitor pode esperar.

### Passo 6 — Teste end-to-end

Pedir Rodrigo mandar "oi" pro número novo do seu celular pessoal. Em paralelo, monitorar Fly logs via Chrome MCP tab em `https://fly.io/apps/zappiq-api/monitoring`.

**Esperado:**
```
[Webhook] WhatsApp signature verified
[WhatsApp] Processing message from 5511XXXXXXXXX
[Iza] Generating response...
```
E Iza responde no WhatsApp do Rodrigo em 3-8 segundos.

**Se NÃO funcionar:** o problema não era o número. Investigar backend (LLM timeout, DB write, outbound envio). Não é mais hipótese Meta.

### Passo 7 — Atualizar `NEXT_PUBLIC_IZA_WA_URL` no Vercel

Landing page aponta pra wa.me do número antigo. Precisa atualizar:
```
NEXT_PUBLIC_IZA_WA_URL=https://wa.me/55DDDXXXXXXXXX?text=Ol%C3%A1%2C%20Iza
```

No Vercel (projeto `zappiq`): Settings → Environment Variables → editar → redeploy.

### Passo 8 — Fechar tasks

- Marcar #83 `completed`
- Marcar #77 `completed` (Iza validada end-to-end)
- Comunicar ao Rodrigo: Iza funcional, pronto pro D-Day

---

## Pré-requisitos antes de executar

- Chrome MCP conectado
- Acesso ao Meta Developer Dashboard (user Rodrigo logado)
- Fly CLI (ou `UPDATE_IZA_PHONE_ID.command` pré-configurado)
- Vercel dashboard (ou Vercel MCP)

---

## Alertas e armadilhas

1. **NUNCA abrir WhatsApp pessoal nem Business App com o número novo.** Split-brain volta instantâneo.
2. **NUNCA perder o PIN 2FA do número novo.** Gravar no 1Password imediatamente.
3. **Se o teste end-to-end falhar mesmo com número novo:** olhar backend, não Meta. Foco em:
   - Supabase conexão (DB writes)
   - OpenAI LLM timeout
   - Outbound: API call pro Graph API retornando 200?
4. **Se eSIM demorar pra receber SMS da Meta:** aguardar 2-3 min, tentar de novo. Se 3 tentativas falharem, usar método "Ligação" ao invés de SMS.

---

## Arquivos relacionados

- `UPDATE_IZA_PHONE_ID.command` — script pronto pra atualizar phone_id no Fly (neste mesmo diretório)
- `TAIL_FLY_LOGS_IZA.command` — tail logs Fly em tempo real
- `FIX_IZA_LIVE_MODE.command` — script obsoleto (App já em Live mode)
