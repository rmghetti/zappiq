## scores

| Critério | Proposta 1 (Resolve) | Proposta 2 (Conta Clara) | Proposta 3 (MACH 3) |
|---|---|---|---|
| 1. Margem bruta >= 70% nos 3 cenários Meta | **4** · Pass-through imuniza; típica 78%, mas franquia cheia cai a 51% e Founders cheio a 12% | **3** · Pass-through idem, porém franquia cheia com LLM caro derruba Growth/Scale para 5 a 11% | **4** · Cheia 70 a 81% por desenho, mas depende de otimização LLM ainda não provada (R$ 0,75 para R$ 0,12) |
| 2. Competitividade vs Blip Go/Claro, Zenvia, MBA | **5** · Essencial R$ 147 ataca o piso de frente; TCO por atendimento menor que o token cru do MBA | **3** · Entrada em R$ 247 deixa o flanco de R$ 179,90 aberto; argumento forte só no meio da tabela | **4** · Lite anual R$ 197,60 responde, TCO bem armado, mas sem plano de flanco dedicado |
| 3. Simplicidade de venda (30 segundos) | **3** · "Atendimento resolvido" vende, mas as regras (silêncio 24h, carência 72h, contestação) exigem explicação e abrem disputa | **3** · "Mensagens de IA" é jargão de fornecedor; dono de PME não pensa em mensagens | **5** · "1 conversa = 1 cliente atendido no mês" se entende em 10 segundos e não gera briga de atribuição |
| 4. Aderência à marca (previsibilidade, sem pegadinha) | **4** · Teto + extrato + garantia 90 dias; porém cobrar "resolução" pode soar pegadinha se contestada | **5** · "A Meta muda o preço dela, não o seu" preserva a promessa original ao máximo | **4** · Medidor + teto + zero markup fortes; Turbo variável exige cuidado de percepção (é opcional e com teto) |
| 5. Viabilidade até 01/10 e depois | **3** · Motor de resolução + billing novo é o pacote mais pesado; o próprio autor desacopla a cobrança para nov/dez | **5** · Menor mudança estrutural: ledger + painel + enforcement sobre régua existente | **4** · Metering por conversa é leve (chave Redis), mas pipeline LLM é M e Turbo é G (adiável) |
| 6. Risco de churn da base e Founders | **3** · Troca a unidade de todos; 8.000 msgs virarem 500 atendimentos tem ótica de corte, mesmo mitigada | **5** · Grandfathering total, preço congelado, ninguém perde nada; base de 1 pagante torna indolor | **4** · Grandfathering 12 meses + P90+20%; boleto Founders não muda um centavo |
| 7. Escalabilidade Partner/white-label | **5** · Resolução é a unidade perfeita de atacado (compra a R$ 0,90-1,10, revende 2-3x, estilo Stammer/GHL) | **3** · Carteira + taxa de gestão 10% funciona, mas decisão empurrada para novembro | **4** · Conversas no atacado + convivência multi-integração no mesmo número (termos 23/09) |
| **Total** | **27** | **27** | **29** |

## recomendacao

Vence um híbrido com espinha dorsal da Proposta 3, executado com a disciplina da Proposta 2 e armado com o flanco comercial da Proposta 1. A unidade "conversa de IA" (1 conversa = 1 cliente atendido no mês, fair use de 25 respostas) é a única que o dono de PME entende em segundos e que não gera disputa de atribuição, a doença documentada do Intercom Fin que contamina a Proposta 1: "resolvido" é opinião, "cliente atendido no mês" é fato contável. A Proposta 2 acerta no que não mudar (preços nominais congelados, grandfathering total, calendário de comunicação, Conta Clara e Cost Guard como produto) e é a mais executável em 42 dias, mas erra na unidade (mensagem é jargão) e deixa o flanco Blip Go/Claro aberto. Da Proposta 1 entram o Essencial R$ 147, a sombra de 30 a 60 dias antes de qualquer cobrança nova e a lógica de atacado do Partner. Os três acertam no ponto estrutural: como Tech Provider, a tarifa Meta é do cliente, a custo, com medidor e teto; a margem da ZappIQ é imune por construção. O risco real é o custo de LLM, então a grade nova só liga com gate de custo medido em produção. Turbo Resultado vira piloto de 2027, não aposta de outubro.

## modelo_final

# Modelo final recomendado: ZappIQ Conta Clara (unidade: conversas de IA)

**Bandeira nova do site**: "Mensalidade fixa por clientes atendidos. Tarifa da Meta a custo, na sua conta, com medidor e teto. Zero markup, zero setup, zero surpresa." A copy atual "mensalidade fixa sem cobrança por conversa" sai do ar antes de 01/09 (vira passivo de propaganda enganosa em 01/10).

## 1. Tabela de planos definitiva (novos contratos a partir de 01/10/2026; base atual grandfathered)

| Item | Essencial (novo) | Lite | Growth (carro-chefe) | Scale | Enterprise/Partner |
|---|---|---|---|---|---|
| Mensal | R$ 147 | R$ 247 | R$ 497 | R$ 1.497 | sob consulta |
| Anual (-20%) | R$ 117,60 | R$ 197,60 | R$ 397,60 | R$ 1.197,60 | contrato |
| Founders (-30% vitalício) | R$ 102,90 | R$ 172,90 | R$ 347,90 | R$ 1.047,90 | n/a |
| **Conversas de IA/mês** (1 conversa = 1 cliente atendido pela Iza no mês) | 150 | 300 | 1.000 | 3.500 | por integração |
| Fair use | 25 respostas de IA por conversa; acima conta nova conversa | idem | idem | idem | contratual |
| Mensagens dentro da conversa | ilimitadas (dentro do fair use) | idem | idem | idem | idem |
| Disparos (templates)/mês | 100 | 500 | 5.000 | 30.000 | custom |
| Fluxos Maestro (determinísticos, NÃO consomem franquia) | 1 | 3 | 15 | ilimitado | ilimitado |
| Atendentes | 1 | 2 | 10 | 50 | custom |
| Contatos | 500 | 1.000 | 10.000 | 200.000 | custom |
| Canais | WhatsApp + webchat | + Instagram | todos | todos + 2º número | multi-integração |
| Conta Clara (medidor Meta em tempo real, extrato por conversa, projeção de fatura) | incluído | incluído | incluído | incluído | por subconta |
| Cost Guard (teto em R$ configurável, alertas 70/90/100%, modo econômico) | incluído | incluído | incluído | incluído | incluído |
| Tarifa Meta do WhatsApp | a custo, na WABA do cliente, ZERO markup | idem | idem | idem | repasse com markup do parceiro |
| Trial | 14 dias sem cartão | idem | idem | POC guiada | POC |
| Setup | R$ 0 | R$ 0 | R$ 0 | R$ 0 | R$ 0 |
| LGPD, dados no Brasil | sim | sim | sim | sim + SLA 99,9% | sim + DPA |

**Packs de conversas** (compra manual ou auto-pack opt-in com teto do cliente): +100 por R$ 49; +250 por R$ 99; +1.000 por R$ 299. Excedente NUNCA cobra automático por padrão. Degraus ao esgotar: 100% avisa, 120% Modo Econômico (1 balão, menos follow-ups), 150% pausa só NOVAS conversas de IA; humano e Maestro seguem sempre. Aposentar o meter Stripe de R$ 0,03/msg antes de ligar qualquer enforcement.

**Webchat e Instagram** contam na franquia (a cota dimensiona custo de LLM, não canal) e não têm tarifa Meta. Mensagem recebida nunca paga nada.

## 2. Conta de margem aberta (premissas auditáveis)

Premissas: LLM otimizado R$ 0,12/conversa (roteamento 70% modelo leve + cache + verificação seletiva; hoje ~R$ 0,75); infra/org R$ 12/15/18/25; taxas de pagamento 3%; uso típico 60% da franquia.

**Ponto estrutural**: como Tech Provider, a WABA, o billing e a fatura Meta são do cliente. Custo de tarifa Meta no COGS da ZappIQ: R$ 0,00. **A margem abaixo é IDÊNTICA nos cenários A (R$ 0,035), B (R$ 0,05) e C (R$ 0,08).** O que os cenários mudam é a conta do cliente, controlada pelo Cost Guard.

| Plano | Receita | Custo franquia CHEIA | Margem cheia | Custo uso típico (60%) | Margem típica |
|---|---|---|---|---|---|
| Essencial (150) | 147,00 | 34,41 | 76,6% | 27,21 | 81,5% |
| Lite (300) | 247,00 | 58,41 | 76,4% | 44,01 | 82,2% |
| Growth (1.000) | 497,00 | 152,91 | 69,2% | 104,91 | 78,9% |
| Scale (3.500) | 1.497,00 | 489,91 | 67,3% | 321,91 | 78,5% |
| Growth Founders | 347,90 | 152,91 | 56,0% | 104,91 | 69,8% |

Blend projetado da plataforma: 75 a 80%. Pior caso teórico (todas as franquias 100% usadas): ~67 a 77%, nunca negativo. Sensibilidade real é o LLM, não a Meta: a R$ 0,45/conversa (pipeline atual parcialmente otimizado) o Growth cheio cai a ~6%. Por isso o **gate de custo**: a grade nova só liga com custo medido <= R$ 0,15/conversa na sombra de setembro; entre R$ 0,15 e 0,25, franquias 20% menores só para contas novas; acima de R$ 0,25, não liga (mantém régua atual recalibrada, Scale 25.000 msgs). O roteamento de modelo é mudança de produto obrigatória, não opcional.

**Fatura Meta do cliente** (visível na Conta Clara; ~5,5 msgs de serviço/conversa, uso típico): Lite ~R$ 35 (B) a R$ 79 (C); Growth ~R$ 116 a 264; Scale ~R$ 404 a 924. Tetos default do Cost Guard ligados desde o dia 1: Lite R$ 50, Growth R$ 150, Scale R$ 500 (ajustáveis). Janela CTWA de 72h segue grátis e vira tática de economia guiada. Disparos de marketing (R$ 0,3217/msg do cliente) com estimador ANTES do envio.

## 3. Fases de rollout

**No ar até 01/10 (pacote inadiável)**
1. Ledger de custo Meta: capturar pricing/billable/category dos webhooks hoje descartados (campaignStatus.util.ts, whatsappService.ts). Pronto até 05/09. Fundação de tudo.
2. Metering por conversa em SOMBRA desde 08/09 (chave Redis + TenantUsageMonthly), sem cobrar, calibrando franquias e o gate de LLM com dado real (a premissa de 5,6 msgs/atendimento vem de 1 org; recalibrar).
3. Conta Clara beta 15/09; GA em 01/10 para toda a base com relatório semanal nas 4 primeiras semanas.
4. Cost Guard ativo em 01/10 com tetos default; enforcement de franquia continua em audit-only.
5. Consolidador de balões (1 resposta = 1 balão) e início do roteamento de modelo.
6. Onboarding "WABA saudável": passo obrigatório de billing Meta + BRL + monitor de qualidade (sem forma de pagamento, a Meta para de entregar em 01/10 e o churn parece defeito nosso).
7. Embedded Signup v4 publicado até 30/09 (corte 15/10).
8. Copy nova no site + simulador público "Outubro sem susto" na semana de 01/09, no dia em que a Meta publicar a tabela. Nenhum concorrente se posicionou até 20/08: ser o primeiro define o enquadramento.
9. Higiene: limpar MRR fantasma dos 11 seeds e o enum BUSINESS antes de qualquer material externo.

**Depois de 01/10**
- 01/10: grade nova (conversas) no site para clientes NOVOS, incluindo Essencial R$ 147, condicionada ao gate de LLM.
- 01/11 a 01/12: enforcement sai de audit-only após 30+ dias de sombra com extrato conferível; packs no ar; virada da base mensal na renovação (anuais só na renovação do contrato).
- Q4: identidade BSUID/usernames (phone nullable + roteador, padrão ig:igsid); webhooks account_update e quality_update.
- Q1 2027: Partner white-label (modelo Channel/Integration multi-número, atacado de conversas a R$ 0,30-0,40, parceiro revende com markup próprio, cada parceiro com Messaging Account e cobrança separadas na nova estrutura da Meta); decisão Solution Partner vs nova estrutura em novembro, após ler os termos de 23/09. Piloto Turbo Resultado (fee por agendamento comparecido, com teto) em 5 a 10 clientes Growth.

## 4. Migração da base e Founders

Fotografia real: 1 cliente pagante (Growth anual, só webchat), cohort Founders pequeno, 11 seeds. É a última janela para trocar o motor com o avião vazio.

Princípios inegociáveis: ninguém paga mais, ninguém perde franquia que usa, preços nominais congelados, zero setup segue, Founders intocados.
- Grandfathering da régua antiga por 12 meses ou até a renovação, com conversão pelo MAIOR entre a régua nova do plano e o P90 do uso real + 20% (o shelf-ware de 80.000 msgs que ninguém exerce não vira passivo).
- Garantia de não surpresa por 90 dias: se o boleto no modelo novo der maior que no antigo, cobramos o menor.
- Founders: 30% vitalício intocado sobre a tabela nova (boleto não muda um centavo), direito de manter a régua antiga até 30/06/2027, Conta Clara e Cost Guard sem custo, sessão 1:1 de otimização de tarifa + relatório de economia por 3 meses, carta pessoal do fundador.
- Único pagante real: contato pessoal antes do comunicado público; usa webchat, tarifa Meta não o atinge, impacto zero até a renovação.
- Contrato: aditivo de transparência (não de preço) com aceite eletrônico no dash, declarando que a tarifa Meta é do cliente junto à Meta, sem markup, com teto controlado por ele.

Calendário de comunicação: e-mail 1 até 31/08 (o que a Meta muda, o que a ZappIQ não muda); e-mail 2 individual em setembro com a projeção da fatura Meta de cada conta pelo histórico; webinar "Outubro sem susto" em 15-30/09; retrospectiva pública com dados de economia em 15/10.

## 5. Narrativa de vendas em 3 frases

1. "Em outubro a Meta muda o preço DELA. A ZappIQ não muda o SEU."
2. "Você paga uma mensalidade fixa por clientes atendidos pela Iza no mês, com mensagens ilimitadas na conversa; a tarifa da Meta vai a custo, direto na sua conta, com medidor, projeção e teto que você controla, zero markup."
3. "E como agora cada mensagem tem preço, eficiência virou dinheiro: a Iza resolve em menos mensagens que qualquer bot tagarela, custa menos que o token cru do agente da própria Meta, e ainda entrega CRM, agenda, campanhas e dados no Brasil sob LGPD."

## decisoes_fundador

- Trocar a unidade de franquia de mensagens para conversas de IA (1 conversa = 1 cliente atendido no mês, fair use 25 respostas) para contratos novos a partir de 01/10, base grandfathered. Recomendação: aprovar. É a única unidade que o dono entende em 30 segundos e não gera disputa de atribuição.
- Lançar o plano Essencial R$ 147 como flanco contra o Blip Go/Claro (R$ 179,90 na fatura). Recomendação: aprovar, no ar em 01/10 junto com a grade nova; medir canibalização do Lite e taxa de upgrade como KPI do funil.
- Gate de custo LLM: grade nova só liga com custo medido <= R$ 0,15/conversa na sombra de setembro; entre R$ 0,15 e 0,25, franquias 20% menores só para contas novas; acima disso, adiar a grade e manter a régua atual recalibrada (Scale 25.000 msgs). Recomendação: aprovar; o roteamento de modelo vira mudança de produto obrigatória e prioritária.
- Turbo Resultado (fee por agendamento comparecido): lançar agora ou adiar. Recomendação: adiar para piloto Q1 2027 com 5 a 10 clientes Growth. Não cabe nos 42 dias e concentra o risco de disputa que derrubou a nota da Proposta 1.
- Data da virada da base mensal para a régua nova. Recomendação: 01/12 na renovação, nunca antes de 30 dias de extrato em sombra conferível pelo cliente; anuais só na renovação do contrato. Não acoplar à virada da Meta de 01/10.
- Aposentar a bandeira 'mensalidade fixa sem cobrança por conversa' do site e materiais antes de 01/09. Recomendação: aprovar o novo texto imediatamente; depois de 01/10 a copy atual vira risco de propaganda enganosa.
- Tetos default do Cost Guard ligados desde o dia 1 (Lite R$ 50, Growth R$ 150, Scale R$ 500, ajustáveis pelo cliente). Recomendação: aprovar; teto ligado por padrão é o que sustenta a promessa de zero surpresa.
- Programa Partner: seguir pela nova estrutura de conta da Meta (Messaging Account por app, termos de 23/09) ou virar Solution Partner com linha de crédito. Recomendação: decidir em novembro, após ler os termos completos logado; nada do modelo de 2026 depende disso.
- Pacote de compensação Founders (30% vitalício intocado + régua antiga até 30/06/2027 + sessão 1:1 de otimização de tarifa + relatório de economia por 3 meses + carta pessoal). Recomendação: aprovar; custo marginal quase zero e a promessa vitalícia honrada em público vale mais que a margem do cohort.
- Data de publicação do kit 'Outubro sem susto' (simulador público + webinar + comunicado). Recomendação: semana de 01/09, no dia em que a Meta publicar a tabela oficial de Service; nenhum concorrente se posicionou até 20/08 e sair primeiro define o enquadramento do mercado.

