# ZappIQ: Plano de Resposta à Reprecificação da Meta e aos Temas Críticos da Caixa de Entrada

Versão 1.1 de 20/08/2026. **APROVADO EM BLOCO PELO FUNDADOR EM 20/08 (via chat): D1 a D8 e D10 a D13 aprovadas conforme recomendação; D9 eliminada. P0.1 e P0.2 (WABA do CMJ e cartão Meta) delegados por ele ao próprio CMJ, que executará por lá. Implementação autônoma autorizada, incluindo Chrome MCP; pendências do fundador saem em .command ao final; loop de garantia de até 4 sessões na sequência.** Base: relatório de inteligência da caixa de entrada (20/08), pesquisa multiagente com fontes primárias (9 agentes, anexos em `pesquisa/`), auditoria do repositório vivo (`~/dev/zappiq`) e consulta somente leitura ao banco de produção. Status: VALIDADO pelo loop de 4 sessões e 13 agentes (`VALIDACAO.md`): veredito GO COM CONDIÇÕES, nota 8,5/10, 30 inconsistências da consolidação corrigidas nesta versão (Adendos S1 a S4). Decisão do fundador já registrada: D9 (pacote Founders) ELIMINADA em 20/08. Demais decisões (seção 2) aguardam aprovação, idealmente em sessão única de 90 minutos com folha de 1 página por decisão (recomendação S4).

---

## 1. Sumário executivo

**O fato.** Confirmado em fonte primária da Meta: a partir de 01/10/2026, toda mensagem de serviço (resposta livre dentro da janela de 24 horas) passa a ser cobrada por mensagem entregue, na tarifa de utility do mercado. Referência Brasil hoje: R$ 0,0350 (US$ 0,0068) por mensagem. A tabela final, com a coluna "Service", sai até 01/09/2026. Template utility dentro da janela também passa a ser cobrado. A janela de 72h de anúncios Click-to-WhatsApp continua gratuita. Respostas do Meta Business Agent ficam isentas da tarifa de serviço (pagam por token: US$ 2,00 por milhão, 4 a 5 centavos de dólar por mensagem).

**A correção de rota na leitura.** O relatório da caixa assumiu que a tarifa destrói a margem da ZappIQ. A auditoria do código e a documentação oficial da Meta mostram outra coisa: a ZappIQ opera como **Tech Provider**, cada cliente conecta a própria WABA e **a Meta fatura o cliente diretamente**. Não existe linha de crédito compartilhada no código. O custo Meta no COGS da ZappIQ é **R$ 0,00 por desenho**. A margem só seria destruída se a ZappIQ decidisse subsidiar a tarifa para manter ao pé da letra a bandeira "mensalidade fixa sem cobrança por conversa". A decisão real, portanto, não é "como absorver", e sim como **reposicionar a promessa** sem trair o espírito dela (previsibilidade, zero pegadinha).

**Os dois riscos reais.**
1. **Emudecimento operacional**: por documentação oficial de Tech Provider, WABA de cliente sem método de pagamento NÃO envia mensagem já hoje (erro 131042); o caso CMJ (bloqueada desde 22/07) é a prova operacional, e é provável que o único cliente pagante esteja com o canal WhatsApp morto por isso. O que 01/10 muda é o tamanho da conta, não a regra. Campanha de billing readiness concluída até 19/09.
2. **Custo de LLM, não tarifa Meta**: a sensibilidade da margem é o custo de modelo por conversa (hoje uma faixa não medida de R$ 0,5 a 5; o único dado real é R$ 0,0726 por chamada; meta R$ 0,12 com roteamento por complexidade). A tarifa Meta é do cliente; o LLM é nosso.

**O contexto que muda tudo.** Dados reais de produção: 362 mensagens de WhatsApp na história inteira da plataforma, 1 cliente pagante (Growth anual, usa só webchat), 11 das 15 organizações são seed com receita fictícia. Não há crise de margem hoje; há a **última janela para trocar o motor com o avião vazio**: nenhum dos 11 grandes reposicionou preço até 20/08 (BSPs menores como Zavu e Chat2Desk já ocuparam a bandeira zero markup; o primeiro GRANDE a se posicionar define o enquadramento).

**A resposta recomendada: ZappIQ Conta Clara.** Nova bandeira: *"Mensalidade fixa por atendimento: cada conversa que a Iza cuida conta um, com mensagens à vontade dentro dela. A tarifa do WhatsApp vai a custo, na sua conta, com medidor e teto. Zero markup, zero setup, zero surpresa."* Unidade de franquia passa de "mensagens de IA" para **atendimentos de IA** (1 atendimento = conversa que se encerra após 72h sem interação ou por resolução; fair use de 12 respostas no lançamento, 25 quando o custo por resposta provado for <= R$ 0,03). Novo plano de flanco **Essencial R$ 147** contra o Blip Go/Claro (R$ 179,90; o TCO com tarifa é paridade, R$ 180,42 contra 179,90: vence por medidor, teto e profundidade, nunca só por preço de tabela). Cost Guard e medidor Conta Clara viram produto vendável que nenhum concorrente entrega. Margem projetada de ~73% (franquia cheia) a ~80% (uso típico), idêntica nos 3 cenários de tarifa Meta, condicionada ao gate D4: custo por resposta <= R$ 0,03 (P90) em benchmark sintético por vertical, com corpus híbrido e gate declarado provisório até 30 dias de sombra real. Validação: 4 sessões, 13 agentes, veredito final GO COM CONDIÇÕES, nota 8,5/10 (Adendo S4).

**Prioridade desta semana** (independe de tudo): destravar a WABA do CMJ, cadastrar pagamento na conta Meta, publicar a declaração de Limited Use, anotar tarifas no Billing Hub, 2SV, higiene Stripe, política do Meet, cadastro de razão social. O arquivo `1-ZappIQ-Acoes-Criticas-Meta-Google-Stripe.command` na Área de Trabalho guia os passos do fundador.

---

## 2. Decisões que só o fundador toma (com recomendação)

| # | Decisão | Recomendação da banca | Prazo |
|---|---|---|---|
| D1 | Aposentar a bandeira "mensalidade fixa sem cobrança por conversa" e aprovar o texto novo | Aprovar já. Depois de 01/10 a copy atual vira risco de propaganda enganosa | antes de 01/09 |
| D2 | Trocar a unidade de franquia para ATENDIMENTOS de IA (1 atendimento = conversa encerrada após 72h sem interação ou por resolução; fair use 12 no lançamento, 25 pós-gate; novos contratos; base grandfathered) | Aprovar. Única unidade que o dono entende em 30 segundos e não gera disputa de atribuição; a versão "1 cliente atendido no mês" foi refutada pela S1/S3 para cliente recorrente | até 01/09 |
| D3 | Lançar o plano Essencial R$ 147 (flanco Blip Go/Claro) | Aprovar COM o kill-switch escrito na própria decisão (S4): se o Essencial passar de 40% das novas assinaturas em 60 dias com downgrade líquido do Lite acima de 10%, a franquia de contas NOVAS cai para 100 e o plano sai da vitrine (contas existentes intocadas). Gates duros: 1 atendente, 500 contatos, sem API, só self-service. Ancorar a venda em TCO e capacidade, nunca só preço (existe Blip Go direto de R$ 0 a 349) | até 01/09 |
| D4 | Gate de custo LLM para ligar a grade nova | Aprovar REFORMULADO pela S1: gate por RESPOSTA (<= R$ 0,03) medido em benchmark sintético por vertical (replay de 1.000 conversas no roteador) + P90 além da média + teto de chamadas de verificação + fator de segurança 2x; critério de no-go escrito com página alternativa pronta e diagramada até 15/09 (régua atual recalibrada); degrau intermediário: entre R$ 0,03 e 0,05 por resposta, franquias 20% menores para contas novas. Corpus do benchmark é HÍBRIDO (transcripts reais CMJ + Iza institucional + históricos importados + casos adversariais; S4: não existem 1.000 conversas reais para replay) e o gate é PROVISÓRIO até 30 dias de sombra real, com o circuit breaker por org valendo desde o dia 1 independente do resultado. Motivo: a sombra de produção tem 1 org ativa (não mede nada) e o fair use expõe a cauda, não a média. Roteamento de modelo segue obrigatório | setembro |
| D5 | Tetos default do Cost Guard ligados desde o dia 1 | Aprovar REFORMULADO pela S1 e refinado pela S3: teto DERIVADO do desenho declarado no onboarding cobrindo TODAS as mensagens tarifadas (atendimentos + fluxos Maestro + disparos) × tarifa vigente × 1,3, recalculado quando a tabela de 01/09 sair, incluindo o Essencial; escolha explícita no onboarding, soft-stop por padrão (alerta + 1 clique + 48h de carência) com hard-stop opt-in, modo pico agendável e packs antecipáveis ("pacote melhor mês"), nunca cortar conversa aberta. Motivos: os tetos fixos originais ficavam abaixo da fatura da franquia cheia (a Iza emudeceria no melhor mês), e a fórmula só de franquia ignorava disparos e fluxos (clínica e distribuidora estourariam no 1º mês) | até 01/10 |
| D6 | Data da virada da base mensal para a régua nova | 01/12, na renovação, nunca antes de 30 dias de extrato em sombra; anuais só na renovação | decidir em set |
| D7 | Turbo Resultado (fee por agendamento comparecido) | Adiar para piloto Q1 2027 (5 a 10 clientes Growth) | Q1 2027 |
| D8 | Programa Partner e "modo fatura única": nova estrutura de conta vs Solution Partner (linha de crédito + rebilling) | ANTECIPADO pela S3: iniciar a análise logo após os termos de 23/09, porque o caminho Solution Partner habilitaria um modo fatura única opcional e pago que neutraliza a única objeção que o Blip Go/Claro resolve e a ZappIQ hoje só ameniza (o cartão na Meta). A decisão formal segue em novembro; nada do modelo de 2026 depende dela | análise pós-23/09; decisão em novembro |
| D9 | Pacote Founders | **DECIDIDO PELO FUNDADOR EM 20/08: ELIMINADO do projeto.** Não haverá pacote de compensação Founders (sem régua antiga estendida, sem sessão 1:1, sem relatório de economia, sem carta). A base migra pelas regras padrão de grandfathering da seção 9, iguais para todos. Higiene remanescente: auditar no Stripe quais assinaturas existentes carregam desconto concedido em contrato; o que já foi concedido segue o contrato (qualquer alteração nisso é ação contratual separada, fora deste plano) | decidido |
| D10 | Kit "Outubro sem susto" (comunicado + webinar + CALCULADORA ESTÁTICA; simulador vivo depois) | Publicar na semana de 01/09, no dia em que a Meta soltar a tabela. Resolução da tensão S2 x S4: o que sai em 01/09 é a calculadora ESTÁTICA de marketing (página sem backend, tarifas hardcoded atualizadas no dia, 1 a 2 dias de esforço) + tabelas de simulação nas 3 variantes; o simulador vivo ligado ao ledger vira feature da Conta Clara beta (o corte da S2 vale só para ele). Nenhum dos 11 grandes reposicionou preço até 20/08; o primeiro grande define o enquadramento | semana 01/09 |
| D11 | Razão social única nos cadastros (Google emite fatura para ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA; base de marca diz MACHIA Tecnologia Disruptiva Ltda; mesmo CNPJ 46.788.145/0001-08) | Definir qual é a razão social corrente com o contador e alinhar Google, Meta e Stripe; condição para faturamento em BRL (Sold-To Brasil) e diligência enterprise | esta semana |
| D12 | Destino da conta Stripe "Mach Health Coach" (inacabada) e confirmação da chave de 11/07 | Concluir ou encerrar; inventário de chaves documentado | esta semana |
| D13 | Política de transcrição do Google Meet (liga automático em 21/09) | Desligar ativação automática na organização; ligar caso a caso com aviso | antes de 21/09 |

---

## 3. Prioridade 0: esta semana (o custo de não agir já corre)

| # | Ação | Quem | Tempo | Por quê agora |
|---|---|---|---|---|
| P0.1 | Destravar a WABA do CMJ (Conselho Mudando o Jogo) no Billing Hub + mensagem de teste | Rodrigo (.command) | 5 min | Cliente estratégico sem entrega desde 22/07; provavelmente é o canal WhatsApp do único pagante; risco de churn e reputação |
| P0.2 | Cadastrar método de pagamento na conta Meta da ZappIQ | Rodrigo (.command) | 10 min | Sem billing, não há disparo, marketing, utility nem template rico; as cotas de disparo vendidas em todos os planos não funcionam |
| P0.3 | Publicar declaração de Limited Use na política de privacidade + responder o e-mail do Google com o link | Engenharia (chip de tarefa criado) | 1 a 2 h | Metade da exigência OAuth resolvida sem custo; destrava a promessa de agendamento |
| P0.4 | Anotar no Billing Hub as tarifas vigentes e a elegibilidade de faturamento em BRL | Rodrigo (.command) | 10 min | Número real para calibrar o modelo (cenários viram tabela oficial em 01/09) |
| P0.5 | 2SV no usuário pendente do Workspace e no Google Cloud | Rodrigo (.command) | 15 min | Perda de acesso ao console em 20/10 |
| P0.6 | Chave Stripe de 11/07: confirmar intencionalidade; inventário de chaves; decidir conta MHC | Rodrigo (.command) | 15 min | Incidente descartado ou tratado; higiene antes de escalar cobrança |
| P0.7 | Política do Meet (D13) | Rodrigo (.command) | 10 min | Prazo 21/09 |
| P0.8 | Razão social e endereço únicos em Google, Meta e Stripe (D11) | Rodrigo + contador | semana | Contrato, NF, diligência, BRL da Meta |

---

## 4. O que a Meta muda: fatos confirmados (fontes primárias, consultadas em 20/08/2026)

### 4.1 Tarifas Brasil (rate card oficial vigente desde 01/07/2026)

| Categoria | Hoje | A partir de 01/10/2026 |
|---|---|---|
| Marketing (template) | R$ 0,3217 (US$ 0,0625), sempre cobrada | Sem mudança |
| Utility fora da janela | R$ 0,0350 (US$ 0,0068) | Sem mudança |
| Utility DENTRO da janela 24h | Grátis desde 07/2025 | **Cobrada** (tarifa utility) |
| Autenticação | R$ 0,0350 | Sem mudança |
| **Serviço (resposta livre na janela 24h)** | **Grátis** desde 11/2024 | **Cobrada por mensagem entregue, tarifa de utility/auth do mercado (referência US$ 0,0068); sem tiers de volume** |
| Meta Business Agent | US$ 2,00/milhão de tokens (~4 a 5 centavos de dólar/msg, IA + entrega), desde 01/08 | Sem mudança; **isento da tarifa de serviço** |
| Janela 72h de Click-to-WhatsApp (FEP) | Entrega grátis (todas as categorias) | Sem mudança (MBA paga token mesmo na FEP) |

Tiers de volume (só utility e autenticação, por portfólio): de -5% acima de 250 mil msgs/mês a -25% acima de 70 milhões. Mensagem recebida nunca é cobrada. Cada mensagem tem UMA cobrança (serviço OU MBA, nunca as duas).

### 4.2 Calendário confirmado

| Data | Evento | Status da fonte |
|---|---|---|
| 01/09 | Meta publica a tabela final por país (coluna Service) | Confirmado (docs oficiais) |
| 21/09 | Transcrição automática do Meet liga por padrão | Confirmado (comunicado Google) |
| 23/09 | Novos termos WhatsApp Business em vigor; nova estrutura de conta (WAAC + Messaging Account, vários parceiros por número, cobrança por integração) | Confirmado; a janela "migração 23/09 a 15/10" citada no e-mail não consta nas docs públicas (Fase 1 no 2º semestre) |
| 01/10 | Cobrança de serviço e de utility na janela | Confirmado |
| 15/10 | Embedded signup v2 depreciado; v3 "até outubro" sem dia exato; migrar para v4 | Confirmado |
| 20/10 | 2SV obrigatório no Google Cloud | Confirmado |
| 31/12 | `paid_messaging_account_id` depreciado (migrar para `messaging_account_id`) | Confirmado |
| 30/06/2027 | Prazo final de migração de TODAS as WABAs elegíveis para faturamento em BRL; depois disso a Meta para de entregar | Confirmado |

### 4.3 Quem paga a Meta (o fato que reorganiza o plano)

Documentação oficial de Solution Providers: no modelo **Tech Provider** (o da ZappIQ), "clientes integrados por Tech Providers devem fornecer a própria forma de pagamento após o onboarding". A Meta fatura o cliente diretamente. Linha de crédito compartilhada (parceiro paga e refatura) existe apenas para **Solution Partner**. O código confirma: token e WABA por organização, zero referência a extendedCredits/credit_line/on_behalf (`embeddedSignup.ts:14-15, 122-167`).

Atenção ao aperto estratégico: a Meta publica comparativo oficial posicionando o MBA (~US$ 0,04 a 0,05/msg com entrega) contra "IA de terceiros" (US$ 0,02 a 0,10), e isenta o MBA da tarifa de serviço. Fornecedor e concorrente no mesmo movimento. Além disso, a política separada de "AI Providers" (assistentes de IA de uso geral, pós-CADE) segue cobrando no Brasil; não atinge o caso de uso da ZappIQ hoje, mas é item de vigilância.

---

## 5. Exposição real da ZappIQ (código + banco de produção)

### 5.1 O que o código diz (auditoria com arquivo:linha nos anexos)

- Embedded signup roda na **v2** (corrigido pela S2: `sessionInfoVersion: '3'` nos extras é a versão do PAYLOAD de sessão, assinatura típica da v2; a v3 usaria `version: 'v3'`). A v2 tem **corte duro em 15/10/2026**: a migração para v4 é manual (nova configuração de Facebook Login for Business no painel + troca do config_id + extras `{ setup: {} }` + tratar eventos FINISH_ONLY_WABA/CANCEL), esforço P (1 a 3 dias), sem downtime, e sobe de prioridade: fazer na 1ª quinzena de setembro, não em 30/09.
- "Mensagem de IA" = 1 resposta da Iza a um inbound, debitada em Redis ANTES da chamada LLM. **1 resposta = 1 balão** (não existe divisão; média real medida: 1,12). A tese "responder em 3 balões triplica o custo" não se aplica ao pipeline atual; vale como guarda para fluxos Maestro com envios encadeados.
- Enforcement de cota nasce em `audit_only` e **nunca bloqueia**; `enforceLimit` não tem nenhum caller; disparos não têm enforcement nem contador no envio.
- **Webhooks de status descartam `pricing/billable/category`**: hoje não existe nenhum rastro de custo Meta por conversa ou org. É o furo número 1 para 01/10 (sem isso não há Conta Clara, Cost Guard nem extrato).
- Identidade de contato: `whatsappId` + `phone` NOT NULL únicos por org, mas PK é cuid e o Instagram já usa o padrão `ig:<igsid>`: desacoplar para BSUID é esforço M (37 arquivos tocam phone).
- Stripe LIVE completo, com **meter de excedente a R$ 0,03/msg já criado e dormente** e packs one-shot; upgrade com proration e downgrade agendado funcionando.
- Custo LLM por org e conversa **já é rastreado** (`llm_call_logs` + TenantUsageMonthly + admin unit-economics). Teto de custo do trial (US$ 15) é código morto.
- Cost Guard está ~70% pronto (alertas 70 a 100% por e-mail e WhatsApp, reconciliação diária audit-only, página admin quota-watch). Monitor de saúde de WABA tem base pronta (`channelCredentialCheck.ts`), falta cron + histórico + webhooks `account_update`/`quality_update`.
- Bloqueio estrutural para multi-integração/rebilling: `Organization` tem UM `whatsappPhoneNumberId` único e não existe tabela de canais (o Growth vende 2 números sem modelagem correspondente).

### 5.2 O que o banco de produção diz (consulta somente leitura, 20/08)

| Recorte | Número |
|---|---|
| Mensagens WhatsApp na história toda | 362 (desde 16/04/2026) |
| Últimos 90 dias | 37 outbound (25 da IA), 33 inbound, 5 conversas, 1 org ativa no canal |
| Cliente pagante | 1 (Growth anual, R$ 497), **zero mensagens de WhatsApp, usa webchat** |
| Templates/disparos na história | 0 (única campanha criada tem 0 enviados) |
| Orgs seed com receita fictícia | 11 de 15 (MRR fantasma em preços antigos) |
| Exposição da plataforma inteira à tarifa, no ritmo de agosto | R$ 0,54 a R$ 2,16 por mês |

Leitura honesta: o choque de outubro não ameaça a operação atual; ameaça o **desenho** que seria vendido daqui em diante. A cota de 80.000 mensagens do Scale, precificada contra custo marginal zero, viraria um passivo de até R$ 2.800/mês por cliente (na tarifa de referência) se a ZappIQ a subsidiasse. E o funil (pergunta 3 do relatório da caixa) é a verdadeira crise: 42 dias antes da mudança, a plataforma tem 1 pagante.

Inferência provável (validar na sessão 2 do loop): o pagante Growth é o CMJ, cuja WABA está bloqueada desde 22/07 por falta de billing; o canal WhatsApp dele nunca subiu por isso. Destravar P0.1 é literalmente ligar o produto vendido.

---

## 6. Como o mercado vai reagir (pesquisa de 20/08)

- **Ninguém reposicionou preço até 20/08.** Zenvia (28/07), GPT Maker (04/08) e Wati (13/08) publicaram guias editoriais de eficiência sem tocar no próprio pricing. Blip não publicou nada sobre outubro; o movimento dela foi distribuição: **Blip Go na fatura da Claro** (10/08; R$ 179,90 / 239,90 / 399,90 com 50/100/300 disparos, IA treinável, CRM Light, ~800 clientes). Produto raso, sem CRM completo nem integrações profundas: compete com o Business AI grátis da Meta, não com uma plataforma de operação.
- **Repasse da tarifa Meta hoje**: RD Conversas via Carteira de Créditos (mínimo R$ 300); Zenvia em pacotes de canal (R$ 100 a 2.000); Blip embutida em pacote negociado; SleekFlow deixa a Meta cobrar direto na WABA do cliente; BSPs: 360dialog zero markup (49 euros/mês), Twilio ~US$ 0,005/msg, Gupshup ~US$ 0,001/msg, BSPs locais 0 a 30%.
- **BSPs menores já transformaram o repasse em bandeira**: Zavu ("não vamos faturar as mensagens de serviço em outubro"), Chat2Desk, EvoTalks. A janela de posicionamento "zero markup + controle" fecha quando os grandes acordarem, provavelmente na semana de 01/09.
- Implicação direta: quem chegar em 01/09 com simulador público, medidor e teto no produto define o enquadramento da categoria no Brasil. Hoje esse espaço está vazio.

---

## 7. O novo modelo: ZappIQ Conta Clara

### 7.1 As três propostas e o julgamento

Três desenhos independentes foram produzidos e julgados por banca (CFO SaaS + VP de produto + dono de PME cético; notas 1 a 5 em 7 critérios; detalhes em `pesquisa/6-desenho-*.md` e `7-julgamento.md`):

| Critério | P1 Resolve (por resolução) | P2 Conta Clara (assinatura + repasse) | P3 MACH 3 (eficiência + resultado) |
|---|---|---|---|
| Margem >= 70% nos 3 cenários | 4 | 3 | 4 |
| Competitividade (Blip Go, Zenvia, MBA) | 5 | 3 | 4 |
| Simplicidade de venda | 3 | 3 | **5** |
| Aderência à marca (sem pegadinha) | 4 | **5** | 4 |
| Viabilidade até 01/10 | 3 | **5** | 4 |
| Risco de churn da base/Founders | 3 | **5** | 4 |
| Escalabilidade Partner/white-label | **5** | 3 | 4 |
| **Total** | 27 | 27 | **29** |

Veredito: híbrido com espinha dorsal da P3 (unidade "conversa de IA"), disciplina da P2 (nada muda para a base, repasse a custo, Conta Clara e Cost Guard como produto) e flanco comercial da P1 (Essencial R$ 147, sombra antes de cobrar, lógica de atacado no Partner). Cobrança por "resolução" foi rejeitada como unidade de contrato: "resolvido" é opinião e gera disputa (doença documentada do Intercom Fin). (Nota S1/S3: a formulação original da banca, "1 cliente atendido no mês é fato contável", também caiu na validação: é falsa para cliente recorrente; a unidade final é o atendimento de IA com fechamento por 72h, e a bandeira da 7.2 foi corrigida.)

### 7.2 Bandeira e narrativa

Bandeira nova do site (substitui "mensalidade fixa sem cobrança por conversa" antes de 01/09):

> **"Mensalidade fixa por atendimento: cada conversa que a Iza cuida conta um, com mensagens à vontade dentro dela. A tarifa do WhatsApp vai a custo, na sua conta, com medidor e teto. Zero markup, zero setup, zero surpresa."**

(Bandeira corrigida pela S3: a versão anterior dizia "clientes atendidos" e induzia o cliente recorrente a errar a conta em até 4x; o simulador acompanha a tradução por vertical: paciente de aparelho ≈ 3 atendimentos/mês, pedido de e-commerce ≈ 0,6 a 0,8, cliente semanal de distribuidora ≈ 4,3.)

Narrativa de vendas em 3 frases:
1. "Em outubro a Meta muda o preço DELA. A ZappIQ não muda o SEU."
2. "Você paga uma mensalidade fixa por atendimentos da Iza, com mensagens à vontade dentro de cada conversa; a tarifa da Meta vai a custo, direto na sua conta, com medidor, projeção e teto que você controla, zero markup."
3. "E como agora cada mensagem tem preço, eficiência virou dinheiro: a Iza resolve em menos mensagens que qualquer bot tagarela, custa menos que o token cru do agente da própria Meta, e ainda entrega CRM, agenda, campanhas e dados no Brasil sob LGPD."

### 7.3 Tabela de planos (novos contratos a partir de 01/10; base atual grandfathered)

| Item | Essencial (novo) | Lite | Growth (carro-chefe) | Scale | Enterprise/Partner |
|---|---|---|---|---|---|
| Mensal | **R$ 147** | R$ 247 | R$ 497 | R$ 1.497 | sob consulta |
| Anual (-20%) | R$ 117,60 | R$ 197,60 | R$ 397,60 | R$ 1.197,60 | contrato |
| **Atendimentos de IA/mês** (1 atendimento = conversa que se encerra após 72h sem interação ou por resolução) | 150 | 300 | 1.000 | 3.500 | por integração |
| Fair use | 12 respostas de IA por atendimento no lançamento (sobe a 25 quando o roteamento provar custo por resposta <= R$ 0,03); acima, conta novo atendimento | idem | idem | idem | contratual |
| Mensagens dentro da conversa | ilimitadas | idem | idem | idem | idem |
| Disparos (templates)/mês | 100 | 500 | 5.000 | 30.000 | custom |
| Fluxos Maestro (determinísticos, não consomem franquia) | 1 | 3 | 15 | ilimitado | ilimitado |
| Atendentes | 1 | 2 | 10 | 50 | custom |
| Contatos (CRM) | 500 | 1.000 | 10.000 | 200.000 | custom |
| Canais | WhatsApp + webchat | + Instagram | todos + 2º número | todos + até 15 números | multi-integração |
| **Conta Clara** (medidor Meta em tempo real, extrato por conversa, projeção de fatura) | incluído | incluído | incluído | incluído | por subconta |
| **Cost Guard** (teto em R$, alertas 70/90/100%, modo econômico) | incluído | incluído | incluído | incluído | incluído |
| Tarifa Meta | a custo, na WABA do cliente, **zero markup** | idem | idem | idem | repasse a custo; parceiro remunerado na mensalidade, sem markup sobre a tarifa (ou remove a marca ZappIQ) |
| Trial | 14 dias sem cartão | idem | idem | POC guiada | POC |
| Setup | R$ 0 | R$ 0 | R$ 0 | R$ 0 | R$ 0 |

Packs de atendimentos (opt-in, nunca cobrança automática por padrão), REPRECIFICADOS pela S1 para respeitar a regra escrita "varejo > atacado > custo" e não canibalizar upgrades: +100 por R$ 69, +250 por R$ 149, +1.000 por R$ 449; máximo 2 packs por mês (Essencial: máximo 1 pack de +100), acima disso o caminho é upgrade de plano. Motivo: os preços originais (49/99/299) deixavam Essencial + pack dominando o Lite e Growth + packs R$ 204 mais barato que o Scale pelas mesmas 3.500 unidades, além de furar o piso do futuro atacado Partner. Degraus ao esgotar a franquia: 100% avisa; 120% Modo Econômico (respostas mais curtas, menos follow-up); 150% pausa apenas NOVOS atendimentos de IA; humano e Maestro seguem sempre; contas novas a partir de 01/10 têm hard cap de 2x a franquia. Regras anti-abuso da unidade (S1): atendimento só conta com interação bidirecional mínima; anti-spam por velocidade e blocklist; CAPTCHA e rate limit no webchat; grupos de WhatsApp fora do contrato até serem precificados; botão "não era cliente" com crédito de até 10% da franquia/mês; cota de minutos de áudio por plano com degradação elegante e teto de tokens de contexto por conversa. O meter dormente de R$ 0,03/msg deve ser aposentado antes de qualquer enforcement. Webchat e Instagram consomem franquia (a cota dimensiona custo de LLM, não tarifa de canal) e a persistência de mensagens do webchat é pré-requisito de lançamento (hoje conversas web não gravam mensagem). Mensagem recebida nunca paga nada. Descontos já concedidos em contrato a clientes existentes seguem o contrato (auditar no Stripe quais assinaturas carregam desconto); o pacote Founders foi eliminado do projeto pelo fundador em 20/08 (D9) e não há tratamento especial de cohort neste modelo.

### 7.4 Conta de margem aberta (premissas auditáveis)

Premissas: custo LLM otimizado R$ 0,12/conversa (roteamento 70% para modelo leve + cache de prompt + verificação seletiva; hoje: faixa não medida de R$ 0,5 a 5, ver nota S1 abaixo); infra por org R$ 12/15/18/25; taxas de pagamento 3% (supõe mix Pix/boleto); uso típico 60% da franquia. **Custo de tarifa Meta no COGS: R$ 0,00 (paga pelo cliente). A margem é idêntica nos cenários de tarifa R$ 0,035 / 0,05 / 0,08.**

| Plano | Receita | Custo na franquia cheia | Margem cheia | Custo no uso típico | Margem típica |
|---|---|---|---|---|---|
| Essencial (150) | 147,00 | 34,41 | 76,6% | 27,21 | 81,5% |
| Lite (300) | 247,00 | 58,41 | 76,4% | 44,01 | 82,2% |
| Growth (1.000) | 497,00 | 152,91 | 69,2% | 104,91 | 78,9% |
| Scale (3.500) | 1.497,00 | 489,91 | 67,3% | 321,91 | 78,5% |

(Linha "Growth Founders" removida em 20/08: o pacote Founders foi eliminado do projeto (D9). Se alguma assinatura existente carregar desconto contratual de 30%, a margem dela é a do plano menos o desconto; tratar caso a caso na auditoria do Stripe, não como linha de desenho do modelo.)

Blend projetado: ~73 a 80% (verificado pela S1 em mix de 50 clientes: 72,8% cheio / 80,4% típico a R$ 0,12). Notas da S1 sobre esta tabela: a meta de margem vale para preço MENSAL cheio (no anual de -20%, Growth e Scale cheios ficam em 62,3% e 59,8%; declarar ao usar em material); a premissa de taxas de 3% supõe mix Pix/boleto (cartão Stripe BR ≈ 4,26% tira ~1,3 p.p.); e o LLM institucional não atribuído a tenant (~R$ 351/mês) entra no blend como overhead declarado. A sensibilidade real é o LLM: a R$ 0,45/conversa o Growth cheio cai a ~3% (vira prejuízo acima de R$ 0,4641), e o custo ATUAL não é o "~R$ 0,75" estimado e sim uma faixa não medida de R$ 0,5 a 5 por conversa (o dado real é R$ 0,0726 por CHAMADA; chamadas por conversa nunca foram medidas). Por isso o **gate de custo (D4 reformulado)**: benchmark sintético por vertical com custo por RESPOSTA <= R$ 0,03 (P90, não só média), teto de chamadas de verificação e fator de segurança 2x; entre R$ 0,03 e 0,05 por resposta, franquias 20% menores para contas novas; acima disso, adiar a grade e manter a régua atual recalibrada (Scale 25.000 msgs). Roteamento de modelo por complexidade é mudança obrigatória, não otimização opcional, e um circuit breaker por organização (custo > 2x a premissa entra em Modo Econômico automático, declarado em contrato) protege a cauda que a média não enxerga.

O que o CLIENTE paga à Meta (visível na Conta Clara; premissa 5,4 mensagens de serviço por atendimento, medida na base; a janela de 90 dias mostra 7,4 e subiria as faturas ~37%, recalibrar na sombra): Lite ~R$ 34 (tarifa atual) a R$ 78 (cenário alto); Growth ~R$ 113 a 259; Scale ~R$ 397 a 907. Tetos default do Cost Guard desde o dia 1: DERIVADOS pelo desenho declarado no onboarding, cobrindo TODAS as mensagens que geram tarifa (atendimentos previstos + mensagens de fluxo Maestro + disparos de utility e marketing) × tarifa vigente × 1,3, recalculados quando a tabela de 01/09 sair. Correção da S3: a fórmula anterior (só franquia de atendimentos) ignorava disparos e fluxos, e uma clínica que confirmasse a agenda ou uma distribuidora com fluxo de pedidos estouraria o teto no primeiro mês, virando exatamente a surpresa que a marca jura não existir. Escolha explícita no onboarding, soft-stop com 1 clique e carência de 48h, modo pico agendável, packs compráveis antecipadamente para datas fortes ("pacote melhor mês"), e nunca cortando conversa aberta (D5). Complemento operacional do rito de billing (S3): kit do contador (o que é a tarifa, quem fatura, como aparece no extrato do cartão como FACEBK/META, como conciliar pela Conta Clara), e-mail com a projeção da fatura ANTES do primeiro débito, e o kit vira canal de indicação no perfil que decide pelo contador. Disparo de marketing (R$ 0,3217/msg, do cliente) ganha estimador de custo ANTES do envio. A janela grátis de 72h do Click-to-WhatsApp e a migração de recorrência para webchat viram a feature "Economia Guiada" (a Iza mostra quanto o cliente economizou). Balão único consolidado é o PADRÃO no WhatsApp desde o dia 1 (multi-balão gastaria o dinheiro do cliente e a própria Conta Clara exporia isso); follow-ups proativos são opt-in com custo exibido.

### 7.5 Por que esse modelo vence

- **Contra Blip Go/Claro**: Essencial R$ 147 tira o argumento de preço; o resto da conversa é o que a fatura da operadora não entrega (auto-correção auditada, RAG do cliente, CRM/agenda, LGPD com DPA, medidor e teto de gasto).
- **Contra Zenvia/RD/Blip (cobram por conversa/pacote)**: a ZappIQ passa a ser a única com custo de canal a custo, medidor em tempo real e teto controlado pelo cliente. O Cost Guard vira argumento ofensivo, não defesa.
- **Contra o Meta Business Agent**: pela própria tabela da Meta, o MBA custa US$ 40 a 50 por mil mensagens (token + entrega). A Iza otimizada custa menos por atendimento DO GROWTH PARA CIMA (no Lite típico o MBA sai mais barato: promessa proibida abaixo do Growth), com contexto setorial, CRM, agenda e auditabilidade que o MBA não tem. E o orquestrador (R11) pode ainda usar o MBA como nó barato de topo de funil, transformando o concorrente em fornecedor.
- **Para o Partner/white-label (Q1 2027)**: atendimentos no atacado precificados por RESPOSTA (R$ 0,08 a 0,10) ou piso de R$ 0,50 por atendimento com fair use 15, mínimo mensal por subconta e preço mínimo anunciado (MAP); SEM markup do parceiro sobre a tarifa Meta (ou remove a marca ZappIQ), sobre a nova estrutura multi-integração da Meta (cada parceiro com Messaging Account e cobrança separadas).

---

## 8. Mudanças de produto e arquitetura (priorizadas)

### 8.1 Pacote inadiável (no ar até 01/10)

| # | Entrega | Esforço | Base no código |
|---|---|---|---|
| 1 | **Ledger de custo Meta**: capturar `pricing/billable/category` dos webhooks (hoje descartados); passado é projeção por contagem × tarifa de referência (backfill de webhooks é inviável e serviço só é cobrado a partir de 01/10) | M (até 05/09) | `campaignStatus.util.ts:24-61`, `whatsappService.ts:293-302` |
| 2 | **Metering por atendimento em SOMBRA** (desde 08/09): chave Redis + TenantUsageMonthly, sem cobrar, calibrando franquias, tetos e faturas simuladas (o gate D4 corre por benchmark sintético) | P/M | contadores e agregados prontos |
| 3 | **Conta Clara** (medidor + extrato + projeção): beta 15/09; beta estendida em 01/10 (corte S2); GA quando a conciliação via pricing_analytics fechar | M | depende do item 1 |
| 4 | **Cost Guard ativo em 01/10** com tetos default; franquia segue audit-only | M (~70% pronto) | quotaAlerts + reconciliação diária + quota-watch |
| 5 | **Roteamento de modelo por complexidade + cache de prompt** (gate D4) e consolidador de balões como guarda | M | LLMRouter + llm_call_logs prontos |
| 6 | **Onboarding "WABA saudável"**: passo obrigatório de billing Meta + BRL + monitor de qualidade; campanha de billing readiness da base | P/M | `channelCredentialCheck.ts` pronto; falta cron/alertas |
| 7 | **Embedded signup v4** na 1ª quinzena de setembro (urgência revista pela S2: o fluxo atual é v2, corte duro 15/10, sem a folga "v3 até outubro") | P código + painel Meta | `ConectarCanais.tsx:394-397` |
| 8 | **Site**: bandeira nova + CALCULADORA ESTÁTICA "Outubro sem susto" na semana de 01/09 (página sem backend, tarifas hardcoded atualizadas no dia da tabela; o simulador vivo ligado ao ledger vira feature da Conta Clara, resolução D10/S4) | P/M | conteúdo deste plano |
| 9 | **Higiene**: limpar MRR fantasma (11 seeds), enum BUSINESS, aposentar `PRICING-STRATEGY.md` antigo, meter R$ 0,03 dormente | P | achados da auditoria |
| 10 | **Persistência de mensagens do webchat** (pré-requisito da unidade e do extrato: hoje conversas web não gravam nenhuma mensagem, e o único pagante é webchat) + dedup de sessão para contato | P/M · antes de 08/09 | achado S1 (anexo 5) |
| 11 | **Funil dia-0 sem WABA** (achado S1, o furo que mata o funil): demo imediata no webchat + número de teste da Meta, trial por ATIVAÇÃO (o relógio começa na primeira conversa real no WhatsApp), go-live da WABA como passo concierge de 15 minutos, monitor `channelCredentialCheck` virando bloqueio visível no dash ("seu canal NÃO está no ar"), crédito único de aquisição "primeira fatura Meta até R$ 50 por nossa conta" | M | funil atual: 1 pagante; caso CMJ |
| 12 | **Cadeados de custo**: hard cap 2x franquia para contas novas, cap de custo do trial ressuscitado (`assertTrialCostCap` é código morto), modelo leve obrigatório em trial, rate limit por org, CAPTCHA no webchat, circuit breaker por org (custo > 2x premissa entra em Modo Econômico automático) | P/M | planLimits.ts:531-570 |

### 8.2 Depois de 01/10

- 01/10: grade nova no site para clientes novos (condicionada ao gate D4), incluindo Essencial R$ 147.
- 01/11: enforcement sai de audit-only (após 30+ dias de extrato conferível) + packs no ar. 01/12: virada da base mensal na renovação (D6).
- Q4: identidade BSUID/usernames (phone nullable + roteador de identidade, padrão `ig:` já provado); webhooks `account_update` e `quality_update`; nó Phone Number Request no Maestro (R8) e reserva de username no onboarding (R9); métrica mensagens-por-resolução no painel (R5, esforço P).
- Q1 2027: Partner white-label sobre multi-integração (R12, esforço G: exige modelo Channel/Integration, hoje 1 número por org); rastreamento de execução do agente (R7) integrado ao loop de auto-correção; max price em campanhas (R10); piloto Turbo Resultado (D7); avaliação do orquestrador com MBA como nó (R11) no contrato do flowEngine.
- Contínuo: rotação e varredura de segredos (R14, P); Radar conversacional no WhatsApp (R16, M) e desenho do Radar self-driving (R15, G) com a própria operação como primeiro cliente (dogfooding: o monitor de WABA que faltou no caso CMJ é exatamente o Radar aplicado a nós mesmos).

### 8.3 Correções de registro no roadmap do relatório

- R1 (BSUID): impacto confirmado, mas o PK cuid + padrão `ig:` reduzem o esforço a M; janela de teste via sandbox da Meta já disponível.
- R5 (mensagens por resolução): o pipeline já manda 1 balão por resposta (1,12 medido); a métrica vale como painel e guarda de fluxos Maestro, não como corte de custo dramático.
- Disparos sem enforcement e `enforceLimit` sem caller: decidir se é dívida ou intenção antes do Cost Guard (registrado como pergunta ao fundador na auditoria).

---

## 9. Migração da base e comunicação

Fotografia real: 1 pagante, 11 seeds. Princípios inegociáveis: ninguém paga mais, ninguém perde franquia que usa, preços nominais congelados, zero setup segue. O pacote Founders foi ELIMINADO do projeto pelo fundador em 20/08 (D9): a base inteira migra pelas MESMAS regras abaixo, sem tratamento especial de cohort; descontos já concedidos em contrato seguem o contrato.

- Grandfathering da régua antiga por 12 meses ou até a renovação; conversão pelo MAIOR entre a régua nova e o P90 do uso real + 20%.
- Garantia de não surpresa por 90 dias: se o boleto no modelo novo der maior, cobra-se o menor.
- Founders: 30% vitalício intocado sobre a tabela nova, direito à régua antiga até 30/06/2027, Conta Clara e Cost Guard sem custo, sessão 1:1 de otimização de tarifa, relatório de economia por 3 meses, carta pessoal do fundador.
- Cliente pagante único: contato pessoal ANTES de qualquer comunicado público (usa webchat; tarifa Meta não o atinge; impacto zero até a renovação).
- Contrato: aditivo de transparência (não de preço) com aceite eletrônico no dash, declarando que a tarifa Meta é do cliente junto à Meta, sem markup, com teto controlado por ele.

Calendário de comunicação: e-mail 1 até 31/08 (o que a Meta muda, o que a ZappIQ não muda); e-mail 2 individual em setembro, rotulado como SIMULAÇÃO por perfil de plano (a base tem 362 mensagens de histórico, não existe projeção por histórico honesta); webinar "Outubro sem susto" entre 15 e 30/09; retrospectiva pública com dados de economia em 15/10. Comunicado público NUNCA antes do contato pessoal com o cliente pagante. Todo texto externo passa pelo padrão voz-humana.

---

## 10. Governança e cadastro (achados que travam venda enterprise)

1. **Razão social divergente** (D11): fatura Google sai para ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA; base de marca diz MACHIA Tecnologia Disruptiva Ltda; mesmo CNPJ. Alinhar com contador, corrigir Google/Meta/Stripe, atualizar base de marca e skill MACHIA. Condição para BRL da Meta e diligência.
2. **Stripe**: decidir conta MHC (D12); inventário de chaves; adotar secret scanning (parceria GitHub, padrão Resend) e política de rotação documentada (R14).
3. **Subprocessadores**: página pública com histórico e canal de notificação (gatilho: Resend incluiu PlanetScale em 16/07). Obrigação viva de quem vende DPA em 2 cliques.
4. **Google Meet** (D13): desligar transcrição automática antes de 21/09; posição escrita sobre recursos de IA ligados por padrão (avatares, Google Pics).
5. **OAuth Google**: Limited Use publicado (P0.3) + novo vídeo de demonstração (staging no app de produção, tela de consentimento com escopos legíveis) até 30/09.
6. **Cloud Organization**: estruturar IAM central e faturamento consolidado (base do isolamento Enterprise e do multi-tenant do Partner).
7. **Base de marca e skill MACHIA**: após D1/D2 aprovadas, re-empacotar a skill com a bandeira nova, planos novos e tarifas Meta (a skill atual afirma a bandeira antiga como inviolável e o custo Meta desatualizado).

---

## 11. Calendário executivo consolidado

| Semana | Marcos |
|---|---|
| 20 a 31/08 | P0 completo; decisões D1 a D5 e D9 a D13; e-mail 1 à base; ledger de custo Meta em dev; copy nova aprovada |
| 01 a 07/09 | Meta publica tabela oficial: recalibrar números; publicar site novo + simulador (D10); ledger em produção (05/09) |
| 08 a 14/09 | Metering sombra ligado; SIGNUP V4 NO AR (08 a 12/09, stop-the-line: sem v4 funcional em 12/09, congela o resto do pacote); campanha billing readiness da base; vídeo OAuth gravado; início das 5 demos concierge/semana |
| 15 a 21/09 | Conta Clara beta; webinar marcado; política Meet aplicada (21/09) |
| 22 a 30/09 | Novos termos em vigor (23/09); início da análise D8 (modo fatura única); e-mails individuais de simulação; gate D4 medido em benchmark; campanha de billing readiness da base CONCLUÍDA até 19/09 |
| 01/10 | Cobrança da Meta começa; Conta Clara em beta estendida; Cost Guard ativo; grade nova para clientes novos (se gate D4 passar) |
| 15/10 | Corte signup v2/v3; retrospectiva pública |
| 20/10 | 2SV obrigatório (já resolvido em P0) |
| 01/11 a 01/12 | Enforcement real com packs; virada da base mensal na renovação (D6) |
| Q4/Q1 | BSUID, R7/R8/R9/R10, decisão Partner (D8, novembro), piloto Turbo Resultado (D7) |
| Até 30/06/2027 | Migração de todas as WABAs elegíveis para BRL |

---

## 12. Riscos e contingências

| Risco | Probabilidade | Contingência |
|---|---|---|
| Tabela de 01/09 vier acima da referência (> R$ 0,05/msg) | média | Modelo não muda (custo é do cliente); recalibrar tetos default, simulador e e-mails de projeção; acelerar táticas de janela 72h e Flows |
| Custo por resposta não bater o gate D4 (<= R$ 0,03, P90, benchmark sintético) | média | Entre R$ 0,03 e 0,05: franquias 20% menores para contas novas; acima de 0,05: adiar a grade e manter a régua atual recalibrada (página alternativa pronta desde 15/09); cache de prompt + teto de chamadas de verificação viram prioridade máxima |
| Cliente recusar cadastrar billing na Meta (fricção de cartão) | média | Go-live concierge de 15 min + kit do contador + crédito de até R$ 50 na mensalidade; análise do caminho Solution Partner/fatura única iniciada logo após os termos de 23/09 (D8 antecipada); decisão em novembro |
| Blip/Zenvia absorverem a tarifa como marketing | baixa | Nenhum sinal até 20/08; se ocorrer, responder com TCO por atendimento e teto controlado, nunca com desconto |
| Meta mudar regra de novo (histórico: 3 mudanças em 24 meses) | alta | O modelo desacopla a margem da tarifa por desenho; monitor mensal de changelog da Meta vira rotina (loop de vigilância) |
| Adoção acelerada de usernames (contatos sem telefone) | média | R1 na frente do Q4; sandbox de teste da Meta já disponível |
| Engenharia não entregar o pacote de 01/10 | média | Os 3 cortes da S2 já foram exercidos (simulador vivo, Conta Clara GA, pareamento multi-tenant); próxima linha de defesa: empurrar packs, garantia e flip de enforcement (atraso na sombra empurra o enforcement, não a grade); ledger + billing readiness + copy nova NUNCA cortam; modo degradado pré-definido se a capacidade cair pela metade (S4) |
| Churn do CMJ pelo bloqueio de 30 dias | em curso | P0.1 hoje + contato pessoal + 1 mês de cortesia se houve indisponibilidade real |
| Política "AI Providers" da Meta (pós-CADE) se estender ao nosso caso de uso | baixa | Vigilância no changelog; arquitetura multicanal (webchat, Instagram) e serviço continuam imunes |

---

## 13. Validação: loop de 4 sessões (armado)

O plano será validado por 4 sessões autônomas com agentes especialistas, registradas em `VALIDACAO.md` nesta pasta: S1 Economia (stress test com dados reais), S2 Técnica (cada mudança contra o repo, com plano de PRs), S3 Mercado e comunicação (objeções, narrativa, comunicados em voz humana, rechecagem de concorrentes), S4 Red team final e consolidação (veredito e versão 1.1 deste documento). Critérios de aprovação por sessão estão no arquivo.

---

## Adendo S1 (20/08): correções da validação econômica aplicadas nesta versão

A Sessão 1 do loop (3 agentes: modelador financeiro, auditor de premissas, advogado do diabo; achados completos em `VALIDACAO.md`) confirmou a aritmética da margem ao décimo e a invariância estrutural aos cenários de tarifa Meta, e exigiu as correções abaixo, já refletidas no corpo deste documento:

1. **Unidade renomeada e redefinida**: de "conversa = 1 cliente atendido no mês" (falso para cliente recorrente; o extrato da própria Conta Clara desmentiria o marketing) para **atendimento de IA** (conversa que se encerra após 72h sem interação ou por resolução). O simulador traduz por vertical (ex.: "pizzaria com freguês diário: 1 freguês ≈ 4 atendimentos/mês"). Fair use inicial de 12 respostas por atendimento; 25 só quando o custo por resposta provado for <= R$ 0,03.
2. **Gate D4 reformulado**: por RESPOSTA e por benchmark sintético (a sombra de produção tem 1 org ativa e não mede nada), com P90, teto de chamadas de verificação, fator de segurança 2x, no-go escrito e degrau intermediário (entre R$ 0,03 e 0,05 por resposta, franquias 20% menores para contas novas). O custo LLM atual é faixa não medida (R$ 0,5 a 5/conversa), não os "R$ 0,75" da v1.0.
3. **Packs reprecificados** (69/149/449, máximo 2/mês) pela regra "varejo > atacado > custo": os preços originais faziam Essencial + pack dominar o Lite e Growth + packs bater o Scale.
4. **Tetos do Cost Guard derivados** (fórmula depois ampliada pela S3 para o desenho declarado no onboarding, incluindo fluxos Maestro e disparos; ver D5 e 7.4): os fixos originais silenciariam a Iza no melhor mês do cliente (Black Friday).
5. **Funil dia-0 sem WABA** adicionado ao pacote inadiável: o trial "sem cartão" morre no cartão da Meta a partir de 01/10 (caso base: CMJ travada há 30 dias nesse passo); demo no webchat + número de teste + trial por ativação + go-live concierge + crédito CAC de 1ª fatura.
6. **Changelog da grade** (mudanças agora declaradas como decisão, não silêncio): Lite disparos 200 -> 500 (upgrade deliberado de proposta de valor); Scale disparos 60.000 -> 30.000 (corte deliberado de shelf-ware); Lite atendentes 1 -> 2 (deliberado); Scale atendentes 75 -> 50 (deliberado); **Growth mantém o 2º número WhatsApp** (a v1.0 o removia por engano) e **Scale mantém até 15 números** (a v1.0 dizia "2º número" por engano); trial de 14 dias passa a valer em Essencial/Lite/Growth (hoje o código dá trial a Lite e Scale; decisão nova: Scale vira POC guiada).
7. **Founders** (SUPERADO em 20/08: o fundador ELIMINOU o pacote Founders do projeto, D9; registro histórico da S1 mantido): taxa recalculada sobre a receita real (57,3% / 71,1%); as regras especiais de migração do cohort deixaram de existir e a base migra pelas regras padrão da seção 9. Segue válido: margens ANUAIS declaradas (Growth 62,3% / Scale 59,8% cheios): a meta de 70% vale para o mensal cheio e uso típico; quem não aceitar o aditivo fica na régua antiga até a renovação.
8. **Copy corrigida**: "custa menos que o token do MBA" vale do Growth para cima (no Lite típico o MBA é mais barato: ~R$ 210 a 262 contra ~R$ 281 a 325 de TCO, recalculado com a premissa fixada em 5,4); "nenhum concorrente se posicionou" vira "nenhum dos 11 grandes reposicionou preço; BSPs menores (Zavu, Chat2Desk, EvoTalks) já ocuparam a bandeira zero markup"; o Essencial enfrenta também o Blip Go direto (R$ 0 a 349) e o Business AI grátis, então o argumento é TCO e capacidade, nunca só preço de tabela; TCO vs Blip Go/Claro no cenário atual é PARIDADE (R$ 180,42 vs R$ 179,90), o que vence é medidor + teto + profundidade.
9. **Afirmação requalificada pela S2 (mais dura que a v1.0)**: a documentação oficial do Embedded Signup confirma que cliente de Tech Provider "deve anexar uma forma de pagamento à WABA antes de PODER COMEÇAR a enviar mensagens", já HOJE, com falha pelo erro 131042 ("Business eligibility payment issue"); o caso CMJ é a prova operacional. O que segue não publicado é apenas o comportamento exato em 01/10 (graça? bloqueio?). Billing readiness deixa de ser precaução e vira pré-requisito de go-live de QUALQUER cliente; o aviso crítico do guia: país e moeda TRAVAM no primeiro cartão salvo (escolher Brasil + BRL antes de salvar, senão a conta nasce em USD e só sai por migração que CLONA a WABA e muda o whatsappBusinessAccountId salvo).
10. **Simulador comparativo e garantia de fatura** (resposta ao "transparência perde a fase da planilha"): o simulador mostra a linha de tarifa Meta TAMBÉM nos concorrentes ("lá você paga a mesma tarifa, sem medidor e sem teto") e cria a garantia que só quem tem metering pode dar: se mensalidade + tarifa Meta do 1º mês passar da projeção, a diferença vira crédito (exposição limitada pelo próprio teto). E-mails de setembro à base são rotulados como SIMULAÇÃO por perfil de plano (não "projeção pelo seu histórico": a base tem 362 mensagens de histórico).
11. **Contingência de regra nova da Meta**: 3 variantes do kit "Outubro sem susto" pré-escritas (status quo / isenção para PME / cobrança por conversa), 50% do esforço de marketing segurado até a tabela de 01/09, espinha da copy nos diferenciais independentes de tarifa (auto-correção, CRM, agenda, LGPD), e o comparativo público de TCO contra o MBA antecipado para Q4 junto do desenho do MBA como nó do orquestrador (R11): a defesa contra o fornecedor-concorrente é integrá-lo antes que ele substitua.
12. **Partner (Q1 2027)**: atacado repensado por RESPOSTA (R$ 0,08 a 0,10) ou piso de R$ 0,50/atendimento com fair use 15, mínimo mensal por subconta e preço mínimo anunciado (MAP); o white-label não pratica markup sobre a tarifa Meta (ou some a marca ZappIQ), para não sujar a bandeira "zero markup" dentro do ecossistema.
13. **Blend com overhead declarado**: LLM institucional não atribuído (~R$ 351/mês) e premissa de mix de pagamento (3% = Pix/boleto; cartão ≈ 4,26%) entram na conta aberta.

## Adendo S2 (20/08): validação técnica aplicada

A Sessão 2 (arquiteto backend + especialista Stripe + especialista Meta Cloud API; pareceres completos referenciados em `VALIDACAO.md`) aprovou o pacote de 01/10 com três cortes e correções:

1. **Três cortes para caber com folga**: simulador público adia (PR cortável); Conta Clara GA vira beta estendida; e SAI o pareamento multi-tenant no número global (a demo dia-0 fica no webchat/playground, que já é genuinamente a Iza do cliente, mais a demo institucional no WhatsApp da Iza). Núcleo: ~28 a 32 dias-pessoa em 16 PRs de núcleo (+1 cortável, o simulador vivo) paralelizáveis, com marcos 05/09 (ledger em produção), 08/09 (sombra ligada), 15/09 (Conta Clara beta), 08 a 12/09 (signup v4, ANTECIPADO pela dependência do painel Meta e pelo fato novo de estarmos na v2 com corte duro em 15/10), 01/10 (Cost Guard ativo).
2. **Fatos novos do código**: o roteamento de modelo por tier JÁ existe (gemini-flash para tiers baixos, Sonnet para Scale, escalada por intenção); o que falta para o gate é prompt caching, benchmark sintético e teto de chamadas de verificação. O pipeline principal já envia 1 balão por turno; o consolidador vale para o MAESTRO (send_text consecutivos). A reabertura pós-CLOSED já cria conversa nova, então a unidade "atendimento com fechamento por 72h" precisa apenas do job de expiração + closeReason. A persistência do webchat é cirúrgica (o serviço já cria contato e conversa e descarta o retorno).
3. **Bloqueador incorporado à higiene**: o enum de plano do banco não contém IZA_LITE (nem Essencial); migrar o enum (ou plan vira String validada) ANTES de publicar a grade nova.
4. **Billing readiness requalificado**: por doc oficial, cliente de Tech Provider precisa de forma de pagamento na WABA para conseguir enviar mensagens JÁ HOJE (erro 131042); o guia grita "país e moeda travam no primeiro cartão: escolha Brasil + BRL antes de salvar"; a migração de moeda clona a WABA (atualizar o ID salvo). O monitor de saúde NÃO detecta falta de billing (limitação da Graph API): é campanha + passo de onboarding, não detecção.
5. **Conta Clara ganha conferência oficial**: além do ledger próprio (tabela `meta_billing_events`, dedup por wamid, `rawPricing` cru, preço por rate card local versionado), a API `pricing_analytics` da WABA é legível com o token da org e permite conciliar o extrato com o número da própria Meta. Teste de aceitação natural na virada: o campo `pricing.type` muda de `free_customer_service` para `regular`.
6. **Billing Stripe**: prices v5 novos sob os MESMOS Products (o cupom Founders "forever" é escopado por Product: recriar assinatura ou trocar de Product destruiria o desconto vitalício); entitlement por priceId com mapa legado; trial por ativação gerenciado pela aplicação (mover o início do trial para o 1º inbound real; ativação forçada em D+30; cap de custo de trial ressuscitado como cadeado); packs no molde provado do Mira com teto de 2/mês imposto pela aplicação em 2 pontos; aposentadoria do meter R$ 0,03 na ordem segura (neutralizar o código ANTES); aditivo em tabela append-only com hash do texto; garantia de 1º mês como Customer Balance credit, SÓ mensal, capada e dependente do ledger. Furos colaterais a fechar: webhook Stripe sem handler de estorno/disputa; checkout só aceita cartão (a premissa de 3% de taxas exige Pix/boleto ou correção da margem declarada).
7. **Ajuste de promessa no crédito CAC**: a ZappIQ não paga a fatura Meta do cliente (é faturada direto pela Meta); o crédito vira desconto equivalente na MENSALIDADE ("descontamos até R$ 50 da sua mensalidade, o equivalente à sua primeira fatura Meta").
8. **Nomenclaturas corrigidas**: webhook de troca de identidade é `user_id_update`; o teste de BSUID usa o simulador de payloads do App Dashboard; envio para BSUID usa o campo `recipient`. `paid_messaging_account_id` não existe no repo (pendência de 31/12 já atendida). Multi-integração da nova estrutura (WAAC + Messaging Account) fica para a Fase 2 (Q1 2027) e vira argumento de aquisição: o cliente testa a ZappIQ no número que já usa com outro provedor.

## Adendo S3 (20/08): mercado e comunicação aplicados

A Sessão 3 (comprador cético em 3 personas + red team comercial + copy chief; entregáveis em `comunicacao/`) aprovou a narrativa com 3 ressalvas, todas aplicadas:

1. **Bandeira corrigida** (a de "clientes atendidos" induzia erro de até 4x no cliente recorrente): agora "mensalidade fixa por atendimento", com tradução por vertical no simulador. As personas validaram: a dona de clínica compra o Lite (não o Essencial), o e-commerce compra o Growth ancorado contra o GPT Maker Professional R$ 397 (nunca contra o Starter R$ 87), o distribuidor compra Growth só com indicação + demo + desenho do fluxo na frente dele.
2. **Teto do Cost Guard rederivado** para cobrir disparos e mensagens de fluxo (a fórmula só de franquia estourava no primeiro mês de clínica e distribuidora) e "pacote melhor mês" nomeado (modo pico + pack antecipado + conversa aberta nunca cai).
3. **Cartão na Meta virou rito com nome**: go-live assistido de 15 minutos (Brasil + BRL antes do primeiro cartão), kit do contador (que dobra como canal de indicação), e-mail de projeção antes do primeiro débito, aviso de como o débito aparece no cartão (FACEBK/META). Antídotos diretos aos 2 gatilhos de churn do mês 1 mapeados (débito não reconhecido no cartão; atendimento dobrado por fair use sem legenda no extrato: o extrato marca "conversa longa: contou 2" na linha).
4. **Promessas proibidas no pitch até existir prova**: atender grupos de WhatsApp (fora do contrato), integração nativa com e-commerce (não consta do plano) e "mais barato que o agente da Meta" abaixo do Growth.
5. **Entregáveis prontos**: kit "Outubro sem susto" v1 (e-mail à base, hero em 2 versões, FAQ, script de 30s; a carta Founders foi REMOVIDA do kit em 20/08 com a eliminação do pacote, D9) com claims condicionados a decisões e marcos; battle-cards dos 5 confrontos com regras de campo. Rechecagem de mercado de 14 a 20/08: nenhum movimento novo; a janela de enquadramento segue aberta até a semana de 01/09.
6. **Defesas fracas reconhecidas por escrito** (não maquiar): fricção do cartão contra fatura única da Claro (mitigada pelo rito; solução estrutural é a D8 antecipada: avaliar modo fatura única logo após os termos de 23/09) e porte/prova social (mitigada pela cláusula "Garantia de Reversibilidade" + 3 cases de clientes com número até dezembro, começando pelo CMJ destravado).

## Adendo S4 (20/08): veredito final, checkpoint de 01/09 e fechamento da v1.1

**Veredito do red team estratégico: GO COM CONDIÇÕES nos 4 blocos; nota 8,5/10 como instrumento de decisão executiva.** Condições por bloco: (a) modelo: gate D4 executado como escrito ANTES da grade, página no-go pronta até 15/09, kill-switch do Essencial dentro da D3 (aplicado); (b) engenharia: marcos de dados provados (migração aditiva até 31/08, ledger 05/09, webchat antes de 08/09) e signup v4 como stop-the-line em 12/09; (c) comunicação: trava de claims auditada em 01/09, fair use na primeira dobra (nunca asterisco), comunicado público só depois do contato pessoal com o pagante; (d) governança: P0.1/P0.2 em 48h com prova ponta a ponta e a inferência "pagante = CMJ" validada por query ANTES do contato.

**Decisão do fundador registrada em 20/08 (via chat): D9 ELIMINADA.** O pacote Founders sai do projeto por inteiro: sem régua antiga estendida, sem sessão 1:1, sem relatório de economia, sem carta; a base migra pelas regras padrão da seção 9; a carta Founders saiu do kit; a linha Founders saiu da conta de margem (o que, de quebra, remove a linha mais frágil do modelo: break-even LLM de R$ 0,32). Higiene remanescente: auditar no Stripe quais assinaturas carregam desconto contratual concedido; o que já foi concedido segue o contrato.

**Motor de demanda com dono e número** (a crise real é o funil, e o plano não pode resolver só pricing): 5 demos concierge por semana no webchat dia-0 a partir de 08/09 (do fundador); kit do contador promovido a canal primário com meta de 20 contadores apresentados até 15/10; case CMJ com número publicado até 15/10. Dogfooding do Radar (R15/R16) transferido por escrito para pós-01/10; o único dogfooding de setembro é o monitor de WABA (item 6 do pacote). Revisão semanal do número de demanda com a mesma seriedade dos marcos de engenharia.

**Validação com humanos no circuito antes de 01/09** (antídoto à monocultura de modelo apontada pela S4): o contador (D11 + kit do contador), 1 cliente da base lendo o e-mail 1, e um advogado com OAB revisando o aditivo, a garantia do 1º mês e a bandeira nova (o plano invoca CDC; ninguém com OAB leu ainda).

**Capacidade e fadiga de decisão**: orçamento por escrito de no mínimo 60% do tempo em ZappIQ até 01/10, congelando lançamentos das outras frentes em setembro; modo degradado pré-definido (se só metade dos dias existirem, entrega-se ledger + billing readiness + copy nova e nada mais); decisões D1 a D13 aprovadas em UMA sessão de 90 minutos com folha de 1 página por decisão; D1, D2 e D5 tornam-se irreversíveis após 01/09 (copy pública).

**Checkpoint de 01/09 (checklist fechado; qualquer gatilho dispara replanejamento, não improviso):**
1. D1 aprovada e bandeira antiga REMOVIDA do site; 2. D2 e D3 aprovadas (kill-switch incluso); 3. D5 aprovada; 4. D10 e D13 aprovadas; D12 resolvida (chave confirmada ou ROTACIONADA); 5. D4: desenho do gate + página no-go aprovados; 6. D11: razão social definida com o contador (até 29/08); 7. WABA do CMJ entregando (status delivered em teste) + inferência "pagante = CMJ" validada por query; 8. Billing Meta da ZappIQ em Brasil + BRL; 9. Limited Use publicado + Google respondido; 2SV feito; política Meet aplicada; 10. Migração aditiva única em produção; 11. Ledger code-complete com deploy marcado para 05/09; 12. Persistência do webchat mergeada ou com data firme antes de 08/09; 13. Disciplina de worktree em vigor (zero edição órfã na main); 14. Tabela da Meta capturada NO DIA; tetos, calculadora e e-mails recalibrados em até 72h; 15. Variante do kit selecionada + auditoria 1 a 1 dos claims; 16. E-mail 1 enviado até 31/08, DEPOIS do contato pessoal com o pagante; 17. Calculadora estática pronta para publicar no dia da tabela.
Gatilhos: tabela não sair até 05/09 = publicar em 08/09 com tarifa de referência rotulada; tabela vier com estrutura diferente (por conversa, isenção por faixa) = parar 72h e ativar a variante correspondente do kit; faltando os itens 1, 7, 10 ou 15 = adiar o lançamento público 1 semana; 12/09 sem signup v4 funcional = congelar o resto do pacote; 22/09 com gate sem medição ou reprovado = grade nova não sobe em 01/10, sobe a página alternativa.

## Anexos (pesquisa completa, com fontes e datas)

- `pesquisa/1-meta-fatos.md`: tarifas, regras, calendário, quem paga, MBA, nova estrutura de conta, BRL.
- `pesquisa/2-concorrentes-br.md`: 11 players, tabela comparativa, markups de BSP, reações até 20/08.
- `pesquisa/3-padroes-globais.md`: catálogo de padrões de pricing (resolução, créditos, pass-through, híbridos, outcome, white-label).
- `pesquisa/4-repo-audit.md`: auditoria técnica com arquivo:linha e estimativas de esforço.
- `pesquisa/5-dados-reais.md`: volumes reais de produção e exposição calculada.
- `pesquisa/6-desenho-1/2/3.md`: as três propostas completas de modelo.
- `pesquisa/7-julgamento.md`: notas da banca e modelo final consolidado.
