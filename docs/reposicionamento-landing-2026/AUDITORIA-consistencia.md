# Auditoria de consistencia, material de reposicionamento ZappIQ

Relatorio consolidado do lead de auditoria. Seis auditores cruzaram os 16 arquivos de marketing contra a folha de fatos canonicos (`_fatos-canonicos.md`) e o codigo em `/Users/rodrigoghetti/zappiq-main` (`planConfig.ts`, `LLMRouter.ts`, `googleCalendar.ts`, `appointments.ts`, `ARCHITECTURE.md`, `CHANGELOG.md`, `Sidebar.tsx`).

Data: 2026-07-10. Regra de copy aplicada: pt-BR com acentuacao completa, sem travessao.

Total de correcoes aplicadas: 78. Pendencias distintas para o fundador: 15 (consolidadas de 27 sinalizacoes brutas). Nenhuma correcao alterou preco, nome ou status para pior: todas aproximam o material da verdade do codigo.

---

## 1. Placar (correcoes aplicadas por tipo)

| Tipo | Correcoes | O que era |
|---|---|---|
| claim-nao-marcado | 48 | Afirmacao de fato com risco juridico exposta como verdade, sem `[confirmar]` (Meta Business Partner, dados no Brasil, SLA 99,9%, incidente 72h, SOC 2, comparativos nominais de concorrentes, Fortune 500/AWS/Cloudflare) |
| preco/plano | 13 | Bandeira de trial ou desconto anual aplicada a planos que nao a tem (trial em Scale/Enterprise, -20% no Enterprise que usa -10%), inclusos incorretos, Radar 360 so no Enterprise |
| status | 10 | Recurso Fase 2 vendido como capacidade atual (sync Google Calendar, Central de Ajuda, payback <30 dias, trial proprio do Radar 360) |
| travessao | 3 | Em-dash em prosa (07-maestro) e em celula de tabela (11-voz-nativa, 09-treinar-ia) |
| hype | 3 | Claim absoluto sem lastro ("a unica", "ninguem no mercado"), sugestao de custo marginal zero |
| nome-antigo | 1 | Codinome "Radar Insights" usado como recurso do plano Lite (correto: Analytics) |
| **Total** | **78** | |

Distribuicao por auditor: A1 (arquivos 00, 01) = 4; A2 (02) = 8; A3 (03) = 5; A4 (produtos 01 a 04) = 25; A5 (produtos 05 a 08) = 20; A6 (produtos 09 a 12) = 16.

---

## 2. Correcoes aplicadas, por arquivo

### 00-pesquisa-melhores-praticas.md (1)
- **preco/plano.** A secao 4.3 listava "Echo Copilot" e "Agendamento pela IA" como "incluido em todos os planos". O codigo prova o contrario (`echoCopilot: false` no IZA_LITE; `SCHEDULING_AGENT` incluido so do Growth pra cima, add-on de R$ 49 no Lite). Reescrito: inclusos em todos os planos apenas Iza, CRM, Maestro, Analytics operacional e o loop de auto-correcao (Qualidade da IA); Echo Copilot e Agendamento entram do Growth para cima.

### 01-estrategia-reposicionamento.md (3)
- **claim-nao-marcado.** "Dados processados em Sao Paulo (regiao gru confirmada nos fly.toml)" virou "regiao gru nos fly.toml da API; residencia completa dos dados, incluindo banco e cache, ainda `[confirmar]`".
- **status.** Pilar 5 dizia "Google e agenda interna em producao". Marcado `[confirmar]` por conflito real (conector OAuth existe no codigo, mas gabarito e MEMORY tratam como Fase 2). Item tambem em pendencias.
- **claim-nao-marcado.** "SLA 99,9% com creditos no Scale" virou "SLA contratual 99,9 por cento com creditos no Scale `[confirmar]`".

### 02-blueprint-paginas-e-copy.md (8)
- **status x2.** Sync Google Calendar deixou de ser "em producao" e passou a "em breve, Fase 2", em /produtos (modulo Agendamento) e na pagina /agendamento (removido o passo "Conecta o Google Calendar", agenda interna como fonte da verdade).
- **status.** "Central de Ajuda" retirada da lista de inclusos em todos os planos (Fase 2 pendente).
- **status.** Checklist de guardrails passou a listar Google Calendar (OAuth), Microsoft 365 e Central de Ajuda / Iza Ajuda entre os itens a marcar "em breve".
- **preco/plano.** CTA "Comecar 14 dias gratis" removido do card Scale (`trialDays: 0`); vira "Falar com especialista" em Scale e Enterprise. "Falar com vendas" trocado pelo CTA do codigo, "Falar com especialista".
- **claim-nao-marcado x3.** `[confirmar]` em "dados no Brasil" (faixa /produtos), SLA 99,9% (tabela /precos) e a moldura "Fortune 500" com logos AWS/Cloudflare (Secao 3), com pedido de confirmacao da engenharia sobre provedores reais.

### 03-seo-e-implementacao.md (5)
- **claim-nao-marcado x3.** `[confirmar]` em "Meta Business Partner" (nota citando "BSP homologado Meta via 360Dialog"), residencia de dados em SP, e "dados no Brasil" na lista de fatos do /llms.txt (publico).
- **preco/plano x2.** Desconto anual corrigido para "-20% em Lite, Growth e Scale; -10% no Enterprise" (D5). Meta description de /precos reescrita para restringir trial a "Lite e Growth" e "-20%" a "ate 20%", com contagem de caracteres ajustada.

### produtos/01-iza.md (7)
- **nome-antigo.** "Radar Insights" no plano Lite trocado por "Analytics operacional" (seed D11 confirmado).
- **status x2.** Iza gravando "sincronizando com o Google Calendar" virou "grava na agenda interna (sync com Google Calendar em breve, Fase 2)", em 2 pontos (caso de uso e integracoes).
- **claim-nao-marcado x2.** `[confirmar]` em Meta Business Partner + Infra em Sao Paulo; `[confirmar comparativo nominal]` na lista de concorrentes.
- **hype x2.** "o diferencial que ninguem no mercado BR expoe" e "E a unica que..." suavizados; metrica "~65%" rotulada "numero ilustrativo".

### produtos/02-conversas.md (9)
- **claim-nao-marcado x6.** `[confirmar]` na barra de marca (Meta BP + dados no Brasil), em "dados hospedados no Brasil", no diferencial 6 (LGPD), na microcopy "Seus dados no Brasil"; `[confirmar comparativo nominal]` nos 3 blocos comparativos (Blip/Zenvia/Huggy/Poli/Letalk, Kommo/RD, GPT Maker/Zaia).
- **preco/plano x2.** Trial de 14 dias restrito a Lite e Growth (Scale/Enterprise sao venda assistida, D4); desconto anual -20% escopado a Lite/Growth/Scale (Enterprise -10%, D5).

### produtos/03-echo-copilot.md (4)
- **claim-nao-marcado x3.** `[confirmar]` no cabecalho (Meta BP + dados no Brasil), no comparativo nominal e no diferencial LGPD.
- **preco/plano.** "Plano anual: -20%" escopado a Lite/Growth/Scale, com nota de que Enterprise usa 10%.

### produtos/04-crm.md (5)
- **claim-nao-marcado x3.** `[confirmar]` na barra de marca, no comparativo nominal e no diferencial 3 (dado no Brasil).
- **preco/plano x2.** Anual -20% escopado (Enterprise 10%) e trial so em Lite/Growth (D4/D5); Radar 360 corrigido de "incluido no Enterprise" para "Scale e Enterprise", com BI preditivo marcado beta.

### produtos/05-agenda.md (2, + 1 varredura limpa)
- **claim-nao-marcado x2.** `[confirmar comparativo nominal]` no bloco de concorrentes; `[confirmar]` em "dados no Brasil (Sao Paulo)".
- Varredura de travessao: arquivo ja estava limpo, nada a mudar.

### produtos/06-zap-impulso.md (4)
- **claim-nao-marcado x4.** `[confirmar]` no "72% de abandono de carrinho" (consistencia com as demais ocorrencias), no comparativo nominal, no diferencial (dados no Brasil + Meta BP) e nos selos de rodape.

### produtos/07-maestro.md (6)
- **travessao.** 3 em-dashes das legendas da mini-demo trocados por dois-pontos.
- **claim-nao-marcado x4.** `[confirmar comparativo nominal]` em 3 blocos de concorrentes; `[confirmar]` em dados no Brasil + Meta BP.
- **preco/plano.** "Plano anual: 20%" qualificado para Lite/Growth/Scale (Enterprise sob consulta, condicao propria).

### produtos/08-analytics-radar.md (8)
- **claim-nao-marcado x5.** `[confirmar]` no cabecalho e em "dados no Brasil"; `[confirmar comparativo nominal]` em 4 blocos comparativos.
- **status x3.** "payback tipico em menos de 30 dias" corrigido para "cerca de 90 dias (piso do ROICalculator)" com "7% a 22%" rotulado ilustrativo; disponibilidade do Radar 360 no Lite ajustada para "add-on para Growth (Lite depende do catalogo) `[confirmar]`"; CTA "Teste o Radar 360 por 14 dias" marcado `[confirmar]` (o add-on nao tem `trialDays` no codigo).

### produtos/09-treinar-ia.md (5)
- **travessao.** 4 em-dashes da lista de fontes do RAG convertidos para o padrao "**Termo.** Descricao".
- **claim-nao-marcado x2.** `[confirmar]` no selo (Meta BP + Dados no Brasil) e no diferencial 3.
- **hype.** "Treinar mais, atender mais e testar a vontade nao infla a fatura" reescrito para "dentro da franquia do seu plano", com nota de excedente (overage ~R$ 0,03/msg + passthrough Meta).
- **preco/plano.** Trial escopado a Lite/Growth e anual -20% a Lite/Growth/Scale (D4/D5).

### produtos/10-qualidade-ia.md (3)
- **claim-nao-marcado x2.** `[confirmar]` no selo do topo e no diferencial 6 (dados no Brasil).
- **preco/plano.** Anual 20% escopado a Lite/Growth/Scale (Enterprise condicao propria, D5).

### produtos/11-voz-nativa.md (2)
- **travessao.** 4 celulas da coluna "Trial 14d" (em-dash como vazio) trocadas por "n/d".
- **claim-nao-marcado.** `[confirmar]` em "infra de dados em Sao Paulo" e "Meta Business Partner".

### produtos/12-governanca.md (6)
- **claim-nao-marcado x5.** `[confirmar]` em: residencia de dados em 3 pontos (AWS sa-east-1/Supabase); SOC 2 Type II; SLA 99,9% em 5 pontos; incidente em 72h em 2 pontos; "Parceria Meta (Tech Provider)".
- **preco/plano.** Anual -20% escopado a Lite/Growth/Scale e trial a Lite/Growth; CTA ajustado.

---

## 3. Pendencias que precisam de decisao do fundador

As 27 sinalizacoes brutas dos auditores colapsam em 15 decisoes distintas. Todas ja estao marcadas `[confirmar]` no material; nenhuma delas pode ir ao ar sem o sign-off indicado. Ordenadas por bloqueio.

**Bloco A, claims de risco juridico (nao publicar sem juridico + engenharia):**

1. **Selo "Meta Business Partner".** Aparece em quase todos os arquivos. O codigo (CHANGELOG V2-013/V2-014) so evidencia "BSP homologado Meta via 360Dialog", nao parceria oficial nomeada. Inclui tambem o claim de primazia regional "entre as primeiras da America Latina" (Version B do 02). *Porque:* afirmar parceria oficial e primazia exige comprovacao de adesao ao programa Meta; risco CONAR/publicidade enganosa. Decidir: manter o selo (com prova) ou trocar pela formula sancionada no codigo.

2. **Residencia de dados no Brasil (Sao Paulo).** Presente na maioria dos arquivos. A stack verificada cita Fly.io (regiao gru), Supabase e Upstash, sem afirmacao de residencia BR completa. Ha ainda inconsistencia interna a reconciliar: o 09 descreve o motor RAG em "Fly gru"; o 12 descreve os dados primarios em "AWS sa-east-1 via Supabase". *Porque:* residencia de dados e claim de fato com risco juridico; exige confirmacao da topologia real (banco + cache) e alinhamento das duas descricoes antes de virar selo publico.

3. **Comparativos nominais de concorrentes.** Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas, GPT Maker e Zaia, com afirmacoes sobre cobranca e comportamento. Aparecem em 01, 02, 04, 05, 06, 07, 08 e nas faixas "setup R$ 1.000 a R$ 8.000" e "fidelidade 6 a 12 meses" do 02. *Porque:* publicidade comparativa com concorrente nomeado exige evidencia documental (CDC/CONAR) para nao virar risco de difamacao.

4. **SLA contratual 99,9% + creditos automaticos + RPO 1h/RTO 4h.** Em 01, 02 e 12. A flag `slaContractual` existe no codigo (Scale/Enterprise), mas a pagina publica /sla ainda mostra a tabela antiga (99,5% alvo, planos Starter/Business). *Porque:* percentual, creditos e RPO/RTO dependem de contrato/SLA real, nao decidivel pelo codigo.

5. **Notificacao de incidente em ate 72h.** No 12 (2 pontos). *Porque:* claim de processo/juridico, depende do runbook e contrato reais.

6. **Certificacao SOC 2 Type II.** Atribuida a stack de dados no 12. *Porque:* precisa confirmar se a certificacao de fato existe antes de exibir.

7. **Sancao ANPD (Art. 52 LGPD, ate 2% do faturamento, teto R$ 50 milhoes) e clausula de nao-treinamento.** No 12. Nao foi alterada. *Porque:* o valor de sancao esta correto em lei, mas a clausula de nao-treinamento e a extensao a subprocessadores dependem do contrato real; recomenda-se revisao juridica.

8. **Infra "Fortune 500" com logos AWS/Cloudflare.** Secao 3 do 02. A stack verificada cita Fly.io/Supabase/Upstash. *Porque:* exibir logo de terceiro exige base factual e autorizacao; a moldura Fortune 500 precisa da lista real de provedores.

**Bloco B, status de rollout (decisao de produto/deploy):**

9. **Status do sync Google Calendar.** Conflito real: o codigo (`googleCalendar.ts` com OAuth, freebusy, insert/delete/disconnect, uso em `appointments.ts`, ARCHITECTURE) mostra o conector implementado e ligado; o gabarito (`_fatos-canonicos.md` L138) e a MEMORY do fundador dizem "Fase 2 pendente". Marcado `[confirmar]` em 01, 02, 03. *Porque:* decidir "implementado no repo" vs "liberado em producao para clientes" exige conhecer o estado de deploy/feature-flag. Se estiver liberado, o gabarito precisa ser atualizado; se nao, as mencoes remanescentes tambem devem cair para "em breve".

10. **Radar 360: trial proprio e elegibilidade no Lite novo.** No 08. O add-on nao tem `trialDays` no codigo (diferente de Voz Nativa e Zap Impulso), mas o CTA prometia "Teste o Radar 360 por 14 dias". E `RADAR_360.availableFor` lista STARTER (deprecated), nao IZA_LITE. *Porque:* decisao de produto/comercial (dar trial ao add-on ou so referenciar o trial da plataforma) e corrigir o `availableFor` defasado no codigo.

11. **Metas de desempenho do Echo Copilot.** -60% tempo de resposta, ~90% precisao das sugestoes, +35% oportunidades de upsell (03-echo). Ja vinham com `[confirmar]`. *Porque:* dependem de piloto com cliente real para virar numero de landing; hoje sao metas, nao capacidade medida.

12. **Chaves STARTER/BUSINESS no `availableFor` dos pacotes de voz.** No 11 e no proprio `planConfig.ts` (VOICE_200/400 inclui STARTER; 600+ inclui BUSINESS). *Porque:* limpeza de codigo (remapear chaves depreciadas); decisao de produto/engenharia, nao erro de copy.

**Bloco C, decisoes comerciais de precificacao:**

13. **Catalogo de add-ons canonico: legado `ADDONS` vs `ADDONS_V4_LIST` (D1/D2).** No 00. Precos divergentes para o mesmo add-on (numero WhatsApp R$ 147 legado vs R$ 137 V4; seat R$ 89 vs R$ 79; pacote 10k msgs R$ 197 vs R$ 179). O /billing hoje mostra o legado; o V4 e mais recente e aprovado (2026-05-27). *Porque:* definir qual conjunto e canonico antes de publicar qualquer tabela de add-ons e decisao comercial, nao auditavel por codigo.

14. **Baseline Enterprise "a partir de R$ 9.900/mes" (D6).** No 00 (3 pontos). Existe so em comentario de codigo (`priceMonthly: null`). *Porque:* expor o valor de ancora do Enterprise e decisao comercial do fundador; nao ha numero canonico no codigo.

15. **Referencia de custo de disparo WhatsApp (~R$ 0,34/msg).** No 06 (2 pontos). Mantido por estar hedgeado como "referencia ~", mas nao ha numero canonico no codigo. *Porque:* o passthrough Meta varia por categoria/tempo; confirmar a referencia atual antes de publicar.

---

## 4. O que foi verificado e esta correto

Confirmado no codigo (`planConfig.ts`, `LLMRouter.ts`, Sidebar) em todos os arquivos:

**Planos e precos:** Lite R$ 247, Growth R$ 497 (mais popular), Scale R$ 1.497, Enterprise sob consulta, batem em todos os 16 arquivos. Growth anual R$ 397,60/mes, economia R$ 1.192,80/ano, conferidos. Descontos anuais -20% (Lite/Growth/Scale) e -10% (Enterprise) corretos apos as correcoes. Nenhum plano deprecated (Starter R$ 197, Business R$ 1.997) citado como vigente: aparecem so como legado a remover ou como nome de concorrente (Zenvia Starter, Notion Business).

**Limites:** atendentes 1/10/75, mensagens de IA 1.500/8.000/80.000, disparos 200/5.000/60.000, contatos 1.000/10.000/200.000, fluxos 3/15/ilimitado, numeros WhatsApp/Instagram, retencao de logs 90/180/730/1825 dias, todos conferem.

**Add-ons (faixa V4 canonica):** WhatsApp extra R$ 137, Instagram Direct R$ 97, seat R$ 79, pacotes de mensagens R$ 99 a R$ 749, contatos +5k R$ 59 / +25k R$ 199, Agendamento pela IA R$ 49, Radar 360 R$ 397, Voz Nativa R$ 79,90 a R$ 929,90 (6 tiers + overages), Impulso Start R$ 197 / Pro R$ 597 / Scale R$ 1.297. Trial de 7 dias do add-on Impulso (independente do trial de 14 dias da plataforma) confirmado. Legado v1 OpenAI da voz nao citado em copy nova.

**Regras de plano:** `echoCopilot` false no Lite, true no Growth+; `SCHEDULING_AGENT` incluido do Growth pra cima, add-on no Lite; Radar 360 incluido no Scale (flag `radar360`) e Enterprise; flag interna `radarInsights` = Analytics operacional (nome cliente-facing Analytics).

**Claims verificados verdadeiros:** "200x mais barato" confirmado em `LLMRouter.ts` (Gemini 2.5 Flash vs Sonnet); audio de entrada (Voz Nativa) incluido em todos os planos (outbound e add-on pago).

**Higiene de copy:** zero travessao apos as correcoes em todos os arquivos (inclusive tabelas); zero hype proibido em copy ("transformacao digital", "solucao inovadora", "ferramenta poderosa", "revolucao da IA" so nas listas de guardrail que os proibem); "unico/exclusivo" so no sentido de "um unico/destaque unico"; zero codinome antigo como produto vigente (Radar Insights, Pulse AI, Spark Campaigns, Nexus CRM, ZappIQ Core, ForgeStudio, ShieldCompliance ausentes; unica ocorrencia "pulse ai" descreve divida a corrigir no repo da landing, nao uso como marca).

**Nomes cliente-facing corretos** (batem com a Sidebar do Dash): Conversas, Contatos, CRM, Agenda, Tarefas, Zap Impulso, Templates, Maestro, Analytics, Radar 360, Treinar IA, Qualidade da IA, Auditoria, Requisicoes LGPD, Voz Nativa; agente = Iza; Echo Copilot so como copiloto do atendente, nunca marca-mae.

**Status honesto preservado nos parciais:** Echo Copilot runtime (beta), Loop de Receita/Meta/TikTok do Impulso (em breve), Maestro auto-otimizacao (beta), Radar 360 BI preditivo (parcial), Vision inbound (em construcao), Memory Layer Mem0 (em rollout), Microsoft 365 (pendente), Central de Ajuda / Iza Ajuda (Fase 2). Metricas beta (Iza ~65%, +30% conversao, payback 90 dias, 71% do Pulso) rotuladas como ilustrativas.

**Onda 0 do roadmap** (03-seo) captura corretamente as dividas de codigo: highlight duplo Lite+Growth (D3), trialDays undefined no Growth, remover Starter/R$ 197 e tier Business, corrigir AggregateOffer e o `aggregateRating` fabricado.

---

## 5. Nota de confianca final

**Camada de autoatendimento (planos, precos, limites, add-ons, nomes de produto, status de modulo): confianca alta, 9/10.** Tudo o que e verificavel no codigo foi conferido e bate. As unicas divergencias estruturais restantes (highlight duplo, add-ons legado vs V4, chaves de plano depreciadas no `availableFor`) sao dividas do proprio codigo, ja documentadas como Onda 0 e nas pendencias, nao erros do material.

**Prontidao para publicacao: bloqueada ate limpar o bloco de `[confirmar]`.** O material esta internamente consistente e honesto sobre a plataforma, mas oito claims de fato com risco juridico (Meta Business Partner, residencia de dados, SLA 99,9%, incidente 72h, SOC 2, comparativos nominais, Fortune 500, sancao ANPD) exigem sign-off de juridico e engenharia antes de ir ao ar. Todos ja estao marcados; nenhum foi removido, para o fundador decidir substanciar ou reformular.

**Ponto de atencao unico e prioritario: o status do Google Calendar.** E o unico conflito onde o codigo contradiz o gabarito e a MEMORY. O material foi para o lado conservador ("em breve, Fase 2"), o que e seguro para publicar, mas o gabarito precisa ser reconciliado com o estado real de deploy. Se o sync ja estiver liberado a clientes, o material esta subvendendo uma capacidade que existe.

**Resumo:** material apto a virar copy final assim que (1) o fundador decidir os 15 itens do bloco de pendencias e (2) juridico assinar o bloco A. A base factual do produto (o que a plataforma faz, quanto custa, como se chama) esta solida e verificada contra o codigo.
