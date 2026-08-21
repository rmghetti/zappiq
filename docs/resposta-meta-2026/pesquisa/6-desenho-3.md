## nome

MACH 3 (Base Fixa + Meta na Mão + Turbo Resultado)

## tese

A tarifa de outubro não ameaça a margem da ZappIQ: no modelo Tech Provider, quem paga a Meta é o cliente, na WABA dele. Ela ameaça a promessa comercial e o bolso do cliente. O MACH 3 responde em três camadas. Base Fixa: mensalidade âncora com franquia em conversas de IA, a unidade que o dono entende (1 conversa = 1 cliente atendido no mês). Meta na Mão: tarifa da Meta a custo, zero markup, com medidor em tempo real, teto e Modo Econômico. Turbo Resultado: opção de fixo menor mais fee por agendamento comparecido, com teto: a IA que se paga. A engenharia de custo (1 resposta = 1 balão, roteamento de modelo, cache de prompt, verificação seletiva) corta ~80% do custo de LLM e ~35% da conta Meta do cliente, sustentando margem de 70%+ e custo total menor que Blip Go, Zenvia e o agente da Meta.

## tabela_planos

| | Lite | Growth | Scale | Partner / Enterprise |
|---|---|---|---|---|
| Mensal | R$ 247 | R$ 497 | R$ 1.497 | sob consulta |
| Anual (20% off) | R$ 197,60/mês | R$ 397,60/mês | R$ 1.197,60/mês | contratual |
| Founders (30% vitalício) | R$ 172,90 | R$ 347,90 | R$ 1.047,90 | n/a |
| Conversas de IA/mês (clientes atendidos pela Iza) | 300 | 1.000 | 3.500 | por integração |
| Fair use anti-abuso | até 25 respostas de IA por conversa; acima conta nova conversa | idem | idem | contratual |
| Disparos (templates)/mês | 500 | 5.000 | 30.000 | custom |
| Fluxos Maestro (determinísticos, NÃO consomem franquia de IA) | 3 | 15 | ilimitado | ilimitado |
| Atendentes | 2 | 10 | 50 | custom |
| Contatos | 1.000 | 10.000 | 200.000 | custom |
| Canais | WhatsApp + Instagram + webchat | idem | idem + 2º número incluído | multi-integração no mesmo número (nova estrutura Meta) |
| Medidor Meta (custo da tarifa em tempo real, projeção, teto configurável, alertas 70/90/100%) | incluído | incluído | incluído | incluído por subconta |
| Modo Econômico (degradação elegante ao estourar franquia) | incluído | incluído | incluído | incluído |
| Tarifa Meta do WhatsApp | a custo, na WABA do cliente, ZERO markup | idem | idem | repasse com markup configurável do parceiro (rebilling) |
| Turbo Resultado (opcional, no lugar do fixo cheio) | v2 (após telemetria) | R$ 347 + R$ 3,50 por agendamento comparecido (teto variável R$ 450; máximo total R$ 797) | R$ 997 + R$ 2,90 por comparecimento (teto variável R$ 1.500; máximo R$ 2.497) | fee negociado |
| Pack de conversas extra (compra manual ou auto-pack opt-in com teto do cliente) | +100 por R$ 49 | +250 por R$ 99 | +1.000 por R$ 299 | rebilling do parceiro |
| Trial | 14 dias sem cartão | 14 dias sem cartão | POC guiada | POC |
| Setup | R$ 0 | R$ 0 | R$ 0 | R$ 0 |
| SLA / suporte | padrão | prioritário | 99,9% + CSM | contratual |
| LGPD e dados no Brasil | sim | sim | sim | sim + DPA do parceiro |

Regras de borda: excedente NUNCA cobra automático por padrão (auto-pack é opt-in com teto definido pelo cliente); ao atingir 100% da franquia avisa, em 120% entra o Modo Econômico, em 150% pausa apenas NOVAS conversas de IA (humano e fluxos seguem). Anual e Founders seguem as regras vigentes de acúmulo. Zero setup em tudo, inclusive Partner.

## unit_economics

### Premissas (declaradas e auditáveis)
- Câmbio R$ 5,15/US$ (implícito no rate card oficial: US$ 0,0068 = R$ 0,0350).
- Cenários da tarifa de mensagem de serviço (Meta publica a tabela final até 01/09): A = R$ 0,035 (referência oficial declarada: tarifa de utility do Brasil); B = R$ 0,05 (câmbio estressado ou reajuste); C = R$ 0,08 (stress).
- Custo LLM por conversa de IA: R$ 0,12 no pipeline otimizado (4,5 respostas/conversa a ~R$ 0,025 por resposta, com roteamento 70% modelo leve / 30% modelo forte, cache de prompt e verificação seletiva; a conta por tokens fecha em R$ 0,08, o R$ 0,12 carrega buffer de 50% para áudio, retries e embeddings). Hoje: ~R$ 0,75/conversa (5,4 respostas a ~R$ 0,14; base real de llm_call_logs: US$ 0,0134/chamada, ~2 chamadas por resposta com verificação em tudo).
- Infra marginal por org: R$ 12 (Lite), R$ 18 (Growth), R$ 25 (Scale). Uso típico: 60% da franquia. Balões por resposta: 1,0 com o consolidador (hoje 1,12).
- Regra estrutural (auditoria do repo): a tarifa Meta é paga pelo CLIENTE na WABA dele (Tech Provider, sem linha de crédito no código). Ela não entra no custo da ZappIQ; entra no custo total do cliente e no risco de churn.

### Tabela A: margem bruta da ZappIQ por plano (igual nos 3 cenários de tarifa, POR DESENHO)
| Plano | Receita | Custo franquia cheia (LLM+infra) | Margem cheia | Custo uso típico (60%) | Margem típica |
|---|---|---|---|---|---|
| Lite (300 conversas) | R$ 247,00 | R$ 48,00 | 80,6% | R$ 33,60 | 86,4% |
| Growth (1.000) | R$ 497,00 | R$ 138,00 | 72,2% | R$ 90,00 | 81,9% |
| Scale (3.500) | R$ 1.497,00 | R$ 445,00 | 70,3% | R$ 277,00 | 81,5% |
| Lite Founders | R$ 172,90 | R$ 48,00 | 72,2% | R$ 33,60 | 80,6% |
| Growth Founders | R$ 347,90 | R$ 138,00 | 60,3% | R$ 90,00 | 74,1% |
| Scale Founders | R$ 1.047,90 | R$ 445,00 | 57,5% | R$ 277,00 | 73,6% |

Mix projetado (50/40/10, uso típico): margem 83,0%. Founders só cai abaixo de 70% no caso extremo de 100% da franquia consumida; no uso típico todos ficam acima de 73%. Contraprova da engenharia de custo: com o pipeline ATUAL (R$ 0,75/conversa) as mesmas franquias dariam 4,0% (Lite), -54,5% (Growth) e -77,0% (Scale) na cheia. A otimização não é acessório; é o que compra franquias vendáveis.

### Tabela B: prova do desenho: se a ZappIQ ABSORVESSE a tarifa Meta (pacote fechado estilo Blip Go), margem na franquia cheia
| Plano | A (R$ 0,035) | B (R$ 0,05) | C (R$ 0,08) |
|---|---|---|---|
| Lite | 61,4% | 53,2% | 36,8% |
| Growth | 40,5% | 27,0% | -0,2% |
| Scale | 33,5% | 17,7% | -13,9% |

Absorver quebra a meta de 70% em todos os planos e cenários. Por isso a camada 2 mantém a tarifa na conta do cliente e transforma transparência em produto (Medidor, teto, zero markup).

### Tabela C: bolso do cliente (TCO mensal no uso típico = mensalidade + tarifa Meta das mensagens de IA + 15% de mensagens humanas)
| Plano | Msgs serviço/mês | TCO em A | TCO em B | TCO em C | Referências de mercado |
|---|---|---|---|---|---|
| Lite | ~930 | R$ 279,60 | R$ 293,57 | R$ 321,52 | Blip Go Claro R$ 239,90 (IA rasa, 100 disparos, custo Meta invisível); MBA no mesmo volume: R$ 167 a 209 SEM plataforma |
| Growth | ~3.105 | R$ 605,67 | R$ 652,25 | R$ 745,40 | MBA sozinho: R$ 556 a 695; RD Conversas R$ 989 para 500 clientes; Zenvia R$ 600 + setup R$ 649 + pacote de canal |
| Scale | ~10.870 | R$ 1.877 | R$ 2.040 | R$ 2.366 | MBA sozinho: R$ 1.947 a 2.433; Blip Plus (jun/26): R$ 2.499 + conversas |

### Tabela D: economics da expansão (excedente e Turbo)
| Item | Preço | Custo | Margem |
|---|---|---|---|
| Pack Lite +100 conversas | R$ 49 (R$ 0,49/conv) | R$ 12,00 | 75,5% |
| Pack Growth +250 | R$ 99 (R$ 0,40/conv) | R$ 30,00 | 69,7% |
| Pack Scale +1.000 | R$ 299 (R$ 0,30/conv) | R$ 120,00 | 59,9% |
| Growth Turbo com 80 comparecimentos (R$ 347 + 80 x R$ 3,50) | R$ 627,00 | ~R$ 90,00 | 85,6% |

Turbo: break-even do cliente vs fixo em 43 comparecimentos/mês (abaixo disso, o Turbo sai mais barato que os R$ 497 fixos). Com 80 comparecimentos a R$ 180 de ticket, o cliente paga R$ 627 e recebe ~R$ 14.400 de agenda: fee de 4,4% do valor gerado; a ZappIQ fatura 26% acima do fixo QUANDO entrega. Por que o cliente aceita: entra pagando 30% menos, o variável tem teto contratual conhecido, e o fee só dispara em comparecimento confirmado (nunca em "resolução presumida", a armadilha que gera disputa no Intercom Fin). Nota: o meter Stripe atual de overage (R$ 0,03/msg ≈ R$ 0,135/conversa) está ABAIXO do custo otimizado; aposentar antes de ligar enforcement.

## mudancas_produto

- [P] Consolidador de balões: merge de send_text consecutivos no runtime do Maestro + garantia contratual de 1 resposta da Iza = 1 balão (hoje 1,12); corta ~11% da conta Meta do cliente sem tocar em preço. Legenda de esforço: P = dias, M = 1 a 3 semanas, G = 4+ semanas.
- [M] Pipeline de custo LLM: roteamento por complexidade (modelo leve em ~70% das respostas, forte no resto), cache de prompt (system + RAG), verificação auditada seletiva por risco (números, promessas, agendamento); custo por resposta de ~R$ 0,14 para ~R$ 0,025 (queda de ~80%), com gate de rollout medido em llm_call_logs por org.
- [P] Metering por conversa de IA (contato distinto atendido no mês, fair use de 25 respostas): nova chave Redis + agregado em TenantUsageMonthly; é a régua da franquia nova. Métrica pública de mensagens-por-resolução no dash (meta <= 4,5), alinhando o incentivo: menos mensagens = menos tarifa Meta para o cliente.
- [M] Captura dos campos pricing/billable/category dos webhooks de status (hoje descartados) + ledger de custo Meta por org e conversa: fundação do Medidor Meta e do futuro Partner; inclui amostra de payload real em produção para dimensionar backfill.
- [M] Medidor Meta no dashboard: custo da tarifa em tempo real, projeção do mês, teto configurável pelo cliente, alertas 70/90/100% (Cost Guard já ~70% pronto segundo a auditoria) + Modo Econômico (respostas mais curtas, mais fluxo determinístico, prioriza agendamento) ao passar de 120% da franquia.
- [P] Flip do enforcement com soft-landing em degraus (100% avisa, 120% Modo Econômico, 150% pausa só NOVAS conversas de IA; humano e Maestro seguem) + ligar enforceLimit nos disparos, que hoje não têm nenhum caller.
- [P] Reprecificar o excedente: aposentar o meter Stripe de R$ 0,03/msg (abaixo do custo otimizado) e criar packs de conversas (R$ 49/99/299) + auto-pack opt-in com teto definido pelo cliente.
- [M/G] Turbo Resultado: evento auditável de agendamento comparecido (agenda própria Fase 0+1 já em prod + confirmação/no-show no CRM), novo meter Stripe de fee com teto variável e preview de fatura; G pelo risco comercial (contrato de valor), a mecânica Stripe de meter idempotente já está provada em quotaOverageService.
- [P] Migração do Embedded Signup v3 para v4 (deadline 15/10/2026): troca de extras/config em ConectarCanais.tsx:394-397 + nova configuração no painel Meta (risco externo: Advanced Access).
- [P/M] Saúde de WABA e billing do cliente: passo obrigatório de onboarding 'ative o pagamento da sua WABA' + monitor de qualidade e billing com alertas (sem forma de pagamento anexada, a Meta simplesmente para de entregar mensagens cobradas em 01/10 e o churn parece defeito da ZappIQ).
- [M] Identidade BSUID/usernames: phone nullable + coluna própria + roteador de identidade no webhook (37 arquivos tocam phone; padrão 'ig:igsid' já provou o caminho), preparando o rollout de usernames da Meta.
- [G] Fundação Partner/white-label (4 a 8 semanas): modelo Channel/Integration multi-número por org, ledger de custo Meta por integração e meter de repasse com markup configurável do parceiro (padrão GoHighLevel/Stammer); destravado pelos itens de metering e ledger acima e pela nova estrutura de conta da Meta de 23/09 (vários apps no mesmo número, cada um com Messaging Account e cobrança próprias: o parceiro ZappIQ entra como segundo app sem arrancar o BSP incumbente do cliente).
- [P] Site e materiais: substituir 'mensalidade fixa sem cobrança por conversa' por 'mensalidade fixa + tarifa Meta a custo, zero markup, com medidor e teto' antes de 01/10 + calculadora pública 'Outubro sem susto' na landing como lead magnet.

## migracao_base

Fotografia real (auditoria de 20/08): 1 único cliente pagante (Growth anual, opera só canal web, zero WhatsApp), cohort Founders pequeno, 11 orgs seed com MRR fantasma. Migrar agora custa quase zero; depois de escalar custaria caro. Princípios inegociáveis: ninguém paga mais, ninguém perde franquia que USA, Founders intocados, zero setup segue. Mecânica: os preços nominais não mudam (R$ 247/497/1.497); muda a régua, de mensagens para conversas de IA. Todo contrato vigente assinado até 30/09/2026 tem grandfathering da régua antiga por 12 meses ou até a renovação anual, com conversão assistida: franquia convertida = o MAIOR entre a régua nova do plano e o P90 do uso real + 20% (ninguém perde o que usa; o shelf-ware de 80.000 mensagens do Scale, que nenhum cliente jamais exerceu, não vira passivo). No Lite a régua nova já é maior na prática (300 conversas contra ~278 equivalentes das 1.500 mensagens): migra automático com ganho. Founders: o desconto de 30% vitalício fica intocado e incide sobre os preços novos, nominalmente iguais, então o boleto não muda um centavo; no Turbo, o desconto incide na parcela fixa (o fee é opcional e sem desconto, declarado em contrato). Compensações Founders: Medidor Meta desde o beta, prioridade de acesso ao Turbo e direito de manter a régua antiga até 30/06/2027 (mesmo prazo da migração BRL da Meta), quando convertem pela regra do P90+20%. O único pagante real recebe contato pessoal do fundador antes do comunicado público, preço inalterado, Medidor e 1 pack de cortesia. Higiene pré-anúncio: limpar o MRR fantasma dos seeds em tenant_usage_monthly (preços antigos R$ 197/997/1.997) e alinhar o enum BUSINESS com a tabela pública. Calendário: 01/09 comunicado 'Sua conta e a mudança da Meta' + calculadora pública no dia em que a Meta publicar a tarifa; 15/09 Medidor beta para toda a base; 23/09 aviso in-app dos novos termos Meta; até 30/09 campanha 'WABA saudável' (todo cliente conectado anexa forma de pagamento na WABA, senão a Meta para de entregar em 01/10); 01/10 régua nova para contas novas + copy nova no site; 15/10 Embedded Signup v4 no ar.

## narrativa_vendas

Reenquadramento: em outubro, TODO WhatsApp profissional passa a ter tarifa da Meta por mensagem, com humano ou com robô, em qualquer plataforma. A pergunta certa não é 'se' você vai pagar a Meta; é se a sua plataforma esconde essa conta de você (e cobra markup em cima) ou coloca ela na sua mão. Bandeira nova: 'Mensalidade fixa. Tarifa da Meta a custo, na sua conta, com medidor e teto. Zero markup, zero setup, zero surpresa.' E como agora cada mensagem tem preço, eficiência de IA virou dinheiro: a Iza resolve em menos mensagens (meta pública de 4,5 por atendimento, 1 resposta = 1 balão), então a MESMA conversa custa menos tarifa Meta na ZappIQ do que num bot tagarela. Contra Blip Go/Claro (R$ 179,90 a 399,90 na fatura do telefone): plano de entrada raso, IA treinável básica, 50 a 300 disparos, sem CRM completo nem agenda, e o custo Meta embutido onde você não vê; o Lite anual sai R$ 197,60, MENOS que o Blip Go intermediário (R$ 239,90), com IA auditada que corrige a si mesma, agenda, CRM, 300 clientes atendidos por mês e a tarifa Meta transparente no Medidor. Contra Zenvia: R$ 600 de plano + R$ 649 de setup + pacotes de canal de R$ 100 a 2.000 comprados no escuro; ZappIQ: R$ 0 de setup e tarifa a custo. Contra RD Conversas: R$ 989 por 500 clientes/mês + carteira de créditos mínima de R$ 300; Growth: 1.000 clientes por R$ 497. Contra GPT Maker e os modelos de crédito: crédito é ficha de fliperama que o dono não sabe converter; conversa é a unidade que ele entende (1 conversa = 1 cliente no mês). Contra o Meta Business Agent: o 'grátis' da Meta custa US$ 2 por milhão de tokens, R$ 0,21 a 0,26 por mensagem, faturado em dólar com câmbio diário, exige linha de crédito com a Meta (cartão só prometido para setembro), não tem CRM, agenda, campanhas nem auditoria, e os dados do seu funil ficam com a Meta; no volume do Growth, o MBA sozinho custa R$ 556 a 695/mês enquanto o ZappIQ INTEIRO, com a tarifa Meta somada, fica em ~R$ 606; no Scale o MBA custa MAIS que a plataforma toda; e com a nova estrutura de contas (23/09) dá até para conviver no mesmo número: quem orquestra, mede e guarda o funil é a ZappIQ. Quebra de objeção com o Turbo: 'se a Iza não encher sua agenda, você paga menos (R$ 347); quando encher, ela se paga' (80 comparecimentos = R$ 627 pagos por ~R$ 14.400 de agenda gerada, fee de 4,4%, com teto contratual). Timing como arma: nenhum concorrente publicou posição sobre outubro até 20/08; sair primeiro com o kit 'Outubro sem susto' (calculadora pública da tarifa, webinar, Medidor beta) na semana de 01/09 posiciona a ZappIQ como a autoridade que explica a mudança enquanto a Blip silencia, e LGPD + dados no Brasil + fatura em reais fecham a diferença contra qualquer players que deixe o cliente exposto a cobrança em dólar.

## riscos

- Tarifa de Service publicada em 01/09 acima da referência (US$ 0,0068): o desenho blinda a margem da ZappIQ (tarifa na conta do cliente) e o cenário C cobre até R$ 0,08; mitigação: materiais parametrizados e TCO refeito em 48h após a publicação, antes de qualquer número externo.
- Premissa de custo LLM (R$ 0,12/conversa) não se confirmar em produção: gate de rollout por telemetria (llm_call_logs por org), fallback de packs mais caros e franquia 20% menor APENAS em contas novas; contas vigentes nunca são tocadas.
- Turbo virar disputa de atribuição (lição do Intercom Fin, contas de US$ 119 a US$ 854): fee só em comparecimento CONFIRMADO (nunca resolução presumida), teto variável contratual, crédito automático em contestação e auditoria por amostragem.
- Recalibração do Scale (80.000 mensagens para 3.500 conversas) explorada como 'corte disfarçado' por concorrente: mitigação com unidade nova + grandfathering de 12 meses + regra P90+20% + fato de que zero clientes exercem a franquia atual; publicar FAQ de equivalência antes que perguntem.
- Guerra de piso (Blip Go Claro R$ 179,90 na fatura, Meta Business AI grátis no app): não descer ao piso; segurar com Lite anual R$ 197,60 + superioridade de produto (auditoria, agenda, CRM) e repetir a varredura competitiva nas semanas de 01/09 e 01/10.
- Execução concentrada de setembro/outubro (Signup v4 até 15/10, captura de pricing, Medidor, enforcement): sequenciar com v4 e captura primeiro, Medidor beta em 15/09, congelamento de features fora do pacote outubro; o v4 é o único deadline externo inadiável.
- Cliente conectado sem forma de pagamento na WABA: em 01/10 a Meta para de entregar as mensagens cobradas e a falha parece defeito da ZappIQ; mitigação: passo obrigatório no onboarding, monitor de saúde de WABA/billing e campanha proativa em setembro.
- Copy atual 'mensalidade fixa sem cobrança por conversa' vira passivo (propaganda enganosa quando a Meta começar a cobrar o cliente): trocar site, termos e materiais antes de 01/10 (grep em todo o conteúdo público) pela bandeira 'zero markup + medidor + teto'.
- Câmbio: tarifa Meta e MBA são dolarizados e inflam o TCO do cliente com dólar alto; mitigação: Medidor com câmbio diário e projeção + empurrar a migração da WABA do cliente para faturamento em BRL pela Facebook Brasil (prazo Meta: 30/06/2027).
- Soft-landing mal calibrado: sem enforcement sangra margem em abuso, com enforcement agressivo gera churn; mitigação: degraus (100% aviso, 120% Modo Econômico, 150% pausa só de novas conversas de IA) rodando em audit-only por 30 dias com relatório antes do flip definitivo.

