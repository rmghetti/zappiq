## resumo

A exposição real da ZappIQ à cobrança por mensagem de serviço da Meta (vigente em 01/10/2026) é hoje desprezível, porque o uso de WhatsApp em produção é mínimo: 362 mensagens em toda a história do banco e, nos últimos 90 dias, 37 outbound (25 da IA, 68%), 33 inbound, 5 conversas e 1 única organização ativa no canal. No ritmo de agosto (18 outbound até dia 20, ~27/mês projetado), a plataforma inteira pagaria entre R$0,54 e R$2,16 por mês nos cenários de R$0,02 a R$0,08. O único cliente pagante (Growth anual, R$497/mês) não tem nenhuma mensagem de WhatsApp registrada; usa o canal web, que a Meta não tarifa. Nunca houve disparo de template pela plataforma (0 mensagens TEMPLATE, única campanha com 0 enviados), então o delta de 01/10 incide praticamente todo sobre as respostas livres da IA na janela de 24h.

O risco relevante não é o volume atual, é a estrutura dos planos combinada com a bandeira de mensalidade fixa sem cobrança por conversa. Se um cliente consumir a franquia contratada de mensagens de IA, a tarifa Meta consome: no Lite (1.500 msgs, R$247), 12% a 49% da mensalidade; no Growth (8.000, R$497), 32% a 129%; no Scale (80.000, R$1.497), 107% a 428%. Um único cliente Scale usando a franquia cheia torna o plano deficitário só de tarifa Meta, antes do custo de LLM, em qualquer cenário. No cenário central de R$0,04, o break-even é 6.175 mensagens no Lite, 12.425 no Growth e 37.425 no Scale (menos da metade da franquia vendida).

Números extraídos em 20/08 por SQL somente leitura, apenas agregados, no banco apontado por scripts/.env.production do repo; 11 das 15 orgs são seed sem uso, com receita fictícia em preços antigos (o MRR fantasma já visto na auditoria da Área Clientes). Balões por resposta da IA: 1,12; outbound por conversa: 5,4.

## fatos

- {"afirmacao": "O projeto Supabase da ZappIQ produção NÃO está acessível pelo MCP Supabase desta conta (só existem machia-radar, mach-health-coach, triggia e um projeto pessoal); o acesso foi feito por SQL somente leitura via connection string do env de produção do repo (host pooler aws-1-us-east-1)", "data": "2026-08-20", "fonte": "MCP Supabase list_projects + /Users/rodrigoghetti/dev/zappiq/scripts/.env.production (apenas nomes de variáveis e host inspecionados)", "confianca": "confirmado"}
- {"afirmacao": "O banco de produção tem 15 organizações e 362 mensagens em TODA a história (primeira em 16/04/2026, última em 20/08/2026); apenas 54 mensagens desde 01/06/2026", "data": "2026-08-20", "fonte": "consulta SANIDADE em /private/tmp/claude-501/-Users-rodrigoghetti-Documents-Documentos---MacBook-Air-de-Rodrigo-Pessoal-MACHIA-Landing-Page-V3/444379e9-67b3-4033-b81f-b3609349faaf/scratchpad/analise-meta.js", "confianca": "confirmado"}
- {"afirmacao": "Últimos 90 dias no WhatsApp: 37 mensagens outbound (25 geradas pela IA, 12 humanas), 33 inbound, 5 conversas e 1 única organização com mensagens no canal", "data": "2026-08-20", "fonte": "consulta JANELA_90D_TOTAIS (analise-meta.js)", "confianca": "confirmado"}
- {"afirmacao": "Agosto/2026 (até dia 20): 18 outbound WhatsApp (14 IA, 4 humano), 22 inbound, tudo em 1 conversa de 1 org; junho: 8 outbound; julho: 1 outbound", "data": "2026-08-20", "fonte": "consulta MENSAL_POR_ORG (analise-meta.js)", "confianca": "confirmado"}
- {"afirmacao": "Zero mensagens de template e zero mensagens vinculadas a campanha em toda a história; a única campanha criada (mai/2026) tem sentCount = 0. A franquia de disparos dos planos nunca foi exercida", "data": "2026-08-20", "fonte": "consultas MENSAL_POR_ORG (out_tipo_template=0) e CAMPANHAS_DISPAROS (analise-meta2.js)", "confianca": "confirmado"}
- {"afirmacao": "Média de balões por resposta da IA = 1,12 (19 balões outbound de bot em 17 respostas desde 01/06); média de 5,4 balões outbound por conversa e 10,8 mensagens totais por conversa. Amostra pequena", "data": "2026-08-20", "fonte": "consultas BALOES_POR_RESPOSTA_IA e BALOES_POR_CONVERSA (analise-meta.js)", "confianca": "confirmado"}
- {"afirmacao": "Só 1 organização tem WhatsApp E Instagram conectados (plano SCALE, criada em abril); é a única com mensagens de WhatsApp nos últimos 90 dias. Pelo padrão (única com canais próprios conectados), é a org institucional da Iza/ZappIQ, não um cliente", "data": "2026-08-20", "fonte": "consultas ORGS_CADASTRO e MENSAL_POR_ORG (analise-meta.js); schema /Users/rodrigoghetti/dev/zappiq/packages/database/prisma/schema.prisma:156-163", "confianca": "provavel"}
- {"afirmacao": "Existe exatamente 1 assinatura ativa (org GROWTH anual criada em jul/2026, receita R$497/mês no tenant_usage_monthly) e ela tem ZERO mensagens de WhatsApp; o uso dela é via canal web (6 conversas em ago, 425 chamadas LLM em jul, US$5,71)", "data": "2026-08-20", "fonte": "consultas ORGS_CADASTRO, USO_MENSAL_TABELA_PRONTA (analise-meta.js) e LLM_CALLS_POR_MES (analise-meta2.js)", "confianca": "confirmado"}
- {"afirmacao": "11 das 15 orgs (criadas em massa em abr/2026, 3 contatos cada, zero mensagens) são dados de seed com receita fictícia em tenant_usage_monthly nos preços antigos (R$197/997/1.997), o MRR fantasma já apontado na auditoria da Área Clientes", "data": "2026-08-20", "fonte": "consultas ORGS_CADASTRO, CONTATOS_POR_ORG, USO_MENSAL_TABELA_PRONTA; memória zappiq-area-clientes-crm (MRR fantasma R$69,5k)", "confianca": "provavel"}
- {"afirmacao": "As 22 conversas do canal web (playground/webchat) não persistem nenhuma linha na tabela messages; o volume web não entra na tarifa Meta nem aparece no histórico de mensagens", "data": "2026-08-20", "fonte": "consulta CONVERSAS_WEB_SEM_MSG (analise-meta2.js)", "confianca": "confirmado"}
- {"afirmacao": "Exposição à tarifa Meta no volume REAL (run-rate de agosto, ~27 outbound/mês na plataforma inteira): R$0,54 (a R$0,02), R$1,08 (a R$0,04) e R$2,16 (a R$0,08) por mês. No pico histórico (abril, 106 outbound/mês): R$2,12 a R$8,48", "data": "2026-08-20", "fonte": "aritmética sobre MENSAL_POR_ORG e MSGS_POR_CANAL_TODA_HISTORIA", "confianca": "confirmado"}
- {"afirmacao": "Exposição na franquia CHEIA dos planos (msgs de IA sendo mensagens de serviço na janela de 24h): Lite 1.500 msgs consome 12,1% a 48,6% da mensalidade de R$247; Growth 8.000 msgs consome 32,2% a 128,8% de R$497; Scale 80.000 msgs consome 106,9% a 427,5% de R$1.497. No Scale, mesmo a R$0,02 a tarifa (R$1.600) já supera a mensalidade", "data": "2026-08-20", "fonte": "aritmética sobre franquias dos planos (contexto da missão) x cenários R$0,02/0,04/0,08", "confianca": "confirmado"}
- {"afirmacao": "A maioria das chamadas LLM não é atribuível a tenant (organization_id nulo: 7.367 chamadas em jul, 4.050 em ago, custo US$64,97 e US$37,84), ou seja, o grosso do custo LLM atual é da própria plataforma (Iza institucional, verificações), não de clientes", "data": "2026-08-20", "fonte": "consulta LLM_CALLS_POR_MES (analise-meta2.js)", "confianca": "confirmado"}

## tabela

**Tabela 1 — Uso real de WhatsApp por mês (banco de produção, consultado em 20/08/2026)**

| Mês | Orgs com msg WA | Outbound total | Out IA | Out humano | Out template/disparo | Inbound | Conversas ativas |
|---|---|---|---|---|---|---|---|
| 2026-04 | 1 | 106 | 106 | 0 | 0 | 95 | n/d |
| 2026-05 | 1-2 | 56 | 52 | 4 | 0 | 51 | n/d |
| 2026-06 | 1 | 8 | 4 | 4 | 0 | 4 | 4 |
| 2026-07 | 1 | 1 | 1 | 0 | 0 | 1 | 1 |
| 2026-08 (até dia 20) | 1 | 18 | 14 | 4 | 0 | 22 | 1 |

**Tabela 2 — Exposição mensal à tarifa Meta na franquia CHEIA do plano (mensagem de serviço, cenários por mensagem)**

| Plano | Mensalidade | Franquia msgs IA | R$0,02 | % mens. | R$0,04 | % mens. | R$0,08 | % mens. | Break-even msgs a R$0,04 |
|---|---|---|---|---|---|---|---|---|---|
| Lite | R$247 | 1.500 | R$30 | 12,1% | R$60 | 24,3% | R$120 | 48,6% | 6.175 |
| Growth | R$497 | 8.000 | R$160 | 32,2% | R$320 | 64,4% | R$640 | 128,8% | 12.425 |
| Scale | R$1.497 | 80.000 | R$1.600 | 106,9% | R$3.200 | 213,8% | R$6.400 | 427,5% | 37.425 |

**Tabela 3 — Exposição no volume REAL atual**

| Recorte | Outbound WA/mês | R$0,02 | R$0,04 | R$0,08 | % da mensalidade |
|---|---|---|---|---|---|
| Plataforma inteira (run-rate ago/26) | ~27 | R$0,54 | R$1,08 | R$2,16 | n/a (org sem assinatura) |
| Plataforma no pico histórico (abr/26) | 106 | R$2,12 | R$4,24 | R$8,48 | n/a |
| Único cliente pagante (Growth R$497) | 0 | R$0,00 | R$0,00 | R$0,00 | 0% |

Premissas: franquia de mensagens de IA tratada como outbound de serviço dentro da janela de 24h (cobrável a partir de 01/10/2026); disparos de template já são cobrados hoje e não entram no delta; balões por resposta observados (1,12) já contam dentro da franquia de mensagens; Instagram Direct e webchat ficam fora da tarifa de serviço do WhatsApp.

## lacunas

- Confirmar que scripts/.env.production aponta para o MESMO banco que o app no Fly usa em produção: rodar flyctl ssh console -a zappiq-api e comparar o host do DATABASE_URL com aws-1-us-east-1.pooler.supabase.com (o token do flyctl local estava expirado em 13/08). A consistência interna (única org com WA+IG, cliente pagante de jul, ordem de grandeza igual à da auditoria de RLS de 15/07) sustenta que é o banco vivo, mas a prova direta ficou pendente.
- O banco não permite medir quantas outbound caíram DENTRO vs FORA da janela de 24h (fora da janela já exige template pago hoje). Premissa adotada: 100% dentro da janela, o cenário mais conservador para o delta de 01/10. Confirmar com o campo de janela/pricing dos webhooks da Meta quando a cobrança começar.
- A tarifa exata de utility/authentication do Brasil em out/2026 e o câmbio não foram verificados aqui; os cenários R$0,02/0,04/0,08 vieram da missão. Confirmar na tabela oficial de preços da Meta (developers.facebook.com/docs/whatsapp/pricing) e nos e-mails oficiais de 25/06 a 06/08 antes de publicar qualquer número externo.
- O plano BUSINESS existe no enum e no seed (R$1.997) mas não está na tabela pública atual (Lite/Growth/Scale/Enterprise); o seed usa preços antigos (R$197/997/1.997). Alinhar o enum e o tenant_usage_monthly com a tabela vigente antes de usar receita do banco em material externo.
- Não há volume de Instagram Direct persistido no período (nenhuma conversa channel=instagram com mensagens); se a Meta estender cobrança por token ao IG via Business Agent Platform, hoje a exposição também é zero, mas o monitoramento precisa nascer junto com o canal.
- A média de balões por resposta da IA (1,12) vem de amostra minúscula (19 balões, 17 respostas, 1 org). Tratar como premissa fraca; recalibrar quando houver clientes reais operando WhatsApp em volume.

