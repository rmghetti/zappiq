# Formulários de privacidade — ZappIQ (Apple + Google)

Respostas para o App Store Connect e o Google Play Console, derivadas da
política viva em `app/legal/privacidade/page.tsx`. Mantenha em sincronia com ela.

- **Política (pública):** https://zappiq.com.br/legal/privacidade
- **Termos:** https://zappiq.com.br/legal/termos
- **Exclusão de dados (pública):** https://zappiq.com.br/legal/deletar-dados
- **DPO:** Rodrigo Ghetti — rodrigo.ghetti@zappiq.com.br · privacidade@zappiq.com.br
- **Controladora:** Onze e Onze Consultoria Empresarial Ltda — CNPJ 46.788.145/0001-08

## Natureza do tratamento

A ZappIQ é **operadora** dos dados de usuários finais (contatos do WhatsApp do
Cliente) e **controladora** dos dados cadastrais do Cliente contratante. Declare
nas lojas o que o app efetivamente coleta do usuário do app (o Cliente/operador).

## Apple — App Privacy (Privacy Nutrition Labels)

| Categoria | Tipo Apple | Vinculado à identidade | Tracking | Finalidade |
|---|---|---|---|---|
| Cadastro do Cliente (nome, CNPJ, e-mail, telefone) | Contact Info | Sim | Não | App Functionality |
| Pagamento (tokenizado via Stripe) | Financial Info | Sim | Não | App Functionality |
| Conversas de WhatsApp (texto, áudio, imagem, localização) | User Content | Sim | Não | App Functionality |
| Contatos do Cliente | Contacts | Sim | Não | App Functionality |
| Uso e diagnóstico (IP, user-agent, sessão, logs) | Diagnostics / Identifiers | Sim | Não | App Functionality, Analytics |

- Dados de cartão **nunca** são armazenados pela ZappIQ (Stripe, PCI-DSS L1).
- Conteúdo de conversas **não** é usado para tracking/ads.
- Account deletion: declarar disponível (Guideline 5.1.1(v)) — ver gap abaixo.

## Google Play — Data safety

| Tipo de dado | Coletado | Compartilhado | Finalidade |
|---|---|---|---|
| Personal info (Name, Email, Phone, Tax ID) | Sim | Não | App functionality |
| Financial info (tokenizado) | Sim | Não | App functionality |
| Messages (WhatsApp) | Sim | Não | App functionality |
| Contacts | Sim | Não | App functionality |
| App activity / diagnostics | Sim | Não | App functionality, Analytics |

- Criptografia em trânsito: **Sim** (HTTPS/TLS).
- Exclusão solicitável pelo usuário: **Sim** — formulário público
  `/legal/deletar-dados` + e-mail DPO. (Apple exige iniciar a exclusão *dentro*
  do app — ver gap.)
- Política de privacidade: URL acima.

## Suboperadores declarados (da política)

Supabase (DB/auth), Upstash (cache/filas), Anthropic (IA), OpenAI (áudio, ret.
30 dias), Cloudflare (CDN/edge/webhooks Meta), Stripe (pagamentos), Resend
(e-mails transacionais), Meta Platforms (WhatsApp Business Cloud API).
Transferência internacional conforme LGPD art. 33.

## Gaps para 100% de prontidão de loja (decisão do Rodrigo)

1. **Exclusão de conta iniciada DENTRO do app** (Apple 5.1.1(v)). Hoje há
   formulário público + DSR admin; falta um ponto em
   `(dashboard)/settings` que dispare a exclusão da conta do usuário logado.
   Toca o backend Express + Prisma (semântica multi-tenant: dono vs membro da
   organização) — requer sua validação antes de implementar.
2. **Exportação de dados in-app** (portabilidade, art. 18, V) para o usuário logado.
3. **Banner/registro de consentimento** de cookies não essenciais (já há página
   `/legal/cookies`; falta o banner).
4. **Plugin `@tailwindcss/typography`** não instalado — as classes `prose` das
   páginas legais podem renderizar sem estilo. Instalar ou trocar por utilitários.
5. **Normalização do e-mail do DPO**: a política usa
   rodrigo.ghetti@zappiq.com.br / privacidade@zappiq.com.br; o `.env.example`
   tem `DPO_EMAIL=dpo@zappiq.com`. Padronizar para um único endereço.
