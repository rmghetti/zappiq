# Iza (agente de IA)

> Dossiê de produto para a landing da ZappIQ. Fonte: implementação real no repo `zappiq-main` (agentOrchestrator, LLMRouter, izaTurnRouter, tools, ragService, agentEvalRunner, planConfig). Tom MACHIA. Status honesto por recurso.

---

## Nome oficial (Dash)
**Iza** (o agente de IA). No painel, o cliente renomeia o agente e escolhe a voz. Iza é o nome padrão de fábrica.

## Tagline
**A funcionária que atende, entende e resolve. 24 horas, sem fila, sem folha de pagamento.**

Alternativas para teste A/B:
- "Sua operação de atendimento e vendas, no piloto automático que você audita."
- "Ela não responde. Ela resolve, qualifica e agenda, no seu WhatsApp."

## Categoria
Agente de IA de atendimento e vendas (não "chatbot", não "plataforma conversacional"). A Iza é o motor de trabalho da plataforma agêntica da ZappIQ: opera a linha de frente de ponta a ponta e passa o bastão para um humano quando faz sentido.

## Status honesto
**Disponível e em produção.** O núcleo (atendimento 24/7 em texto, RAG, roteamento multi-modelo, qualificação, handoff, opt-out LGPD, CRM sync) roda hoje. Alguns módulos avançados são add-on, beta ou rollout, marcados abaixo recurso a recurso.

---

## O problema (dono de PME)
O WhatsApp virou o balcão principal do negócio, e ele nunca fecha. O cliente manda "ainda tem?" às 23h de domingo e a resposta sai na segunda às 10h, quando ele já comprou no concorrente. A dona do negócio responde as mesmas dez perguntas cinquenta vezes por dia (preço, horário, endereço, "vocês fazem tal coisa?"). Contratar mais gente custa caro e some no fim de semana. E os chatbots que ela testou eram uma árvore de "digite 1, digite 2" que irritava o cliente e não fechava nada.

O buraco real não é "falta de robô". É:
- **Tempo de resposta.** Lead que espera mais de 5 minutos esfria. A maioria das PMEs responde em horas.
- **Repetição.** 60% a 70% das mensagens são as mesmas perguntas, roubando a equipe do que dá dinheiro.
- **Perda no fora de expediente.** Noite, fim de semana e feriado é quando o cliente tem tempo de conversar, e é exatamente quando ninguém responde.
- **Fila sem qualificação.** Todo mundo cai na mesma caixa, o vendedor não sabe quem está quente e o lead bom se perde no meio dos curiosos.

## O que é
A Iza é um agente de IA que trabalha no WhatsApp, Instagram Direct e no chat do site do cliente. Ela lê a mensagem, entende a intenção, busca a resposta certa na base de conhecimento do próprio negócio e responde como uma atendente treinada, em português natural. Quando o cliente aceita uma oferta, ela qualifica o lead e avança no funil. Quando pede para agendar, ela marca. Quando o assunto exige gente, ela chama um humano e sai de cena. Tudo isso sem menu de "digite 1", sem script engessado e sem fila.

Ela responde em **texto e em voz** (áudio recebido é transcrito e áudio pode ser devolvido com voz natural em pt-BR, via add-on Voz Nativa), atende **24 horas por dia** e **resolve boa parte dos atendimentos sozinha** (número ilustrativo: a ZappIQ trabalha com a meta de resolução autônoma na casa dos ~65% dos atendimentos, [confirmar métrica média da base]).

## Como funciona (o cérebro, traduzido em benefício)
Por baixo, a Iza é um orquestrador que faz muito mais do que "chamar o ChatGPT". Cada mensagem que chega passa por uma linha de montagem desenhada para vender bem e não errar:

1. **Memória do negócio (RAG).** Antes de responder, a Iza consulta a base de conhecimento do cliente (documentos, site, perguntas e respostas, questionário de GTM) através de busca vetorial. Ela não inventa: responde com o que o dono ensinou. Na prática, é a diferença entre um atendente que decorou o catálogo e um que chuta.
   - *Benefício:* respostas fiéis ao negócio, com preço, política e detalhe corretos. Menos "vou verificar e te retorno".

2. **Roteamento multi-modelo com rede de segurança.** A Iza não depende de um único modelo de IA. Ela roteia cada conversa para o modelo certo e, se um provedor cair ou ficar lento, cai automaticamente no próximo (cascata Claude Sonnet, Claude Haiku, GPT e Gemini), com um disjuntor que isola provedor com falha (3 falhas em 60 segundos abrem o circuito por 120 segundos).
   - *Benefício:* a Iza não sai do ar porque a OpenAI teve soluço. E o custo é controlado: em conversa padrão, o roteamento usa um modelo cerca de **200x mais barato** que o topo de linha, e reserva o modelo premium para os momentos que valem dinheiro (objeção, negociação, aceite de compra, cliente enterprise). Isso é o que sustenta a mensalidade fixa sem cobrança por conversa.

3. **Classificação de intenção a cada turno.** Um classificador leve lê a última mensagem e diz o que ela é: saudação, dúvida, pergunta de preço, objeção, aceite de compra, pedido de humano, ou lead enterprise. Quando o turno vale receita (o cliente disse "quero", "fechado", "manda o link"), a Iza escala para o modelo mais consultivo para não desperdiçar a venda.
   - *Benefício:* a Iza sabe a diferença entre "oi" e "quero comprar", e trata cada um como merece. Ela não despeja catálogo em quem já falou sim.

4. **Trilhos de segurança embutidos e imutáveis.** Antes de qualquer resposta, um filtro local barra verticais proibidas (apostas, cripto, esquemas), com resposta pronta e custo zero de IA. Um núcleo de regras invioláveis (comportamento crítico de compra, handoff, anti-padrões, dados sensíveis) é aplicado em todo agente, mesmo os personalizados pelo cliente.
   - *Benefício:* o cliente customiza a Iza à vontade sem risco de quebrar o comportamento essencial ou colocar a conta em roubada.

5. **Ação, não só conversa.** Quando cabe, a Iza executa: qualifica o lead, atualiza o nome do contato, dispara agendamento e alimenta o CRM. Ela usa "ferramentas" de verdade (function calling), então marca uma consulta ou consulta um dado no meio da conversa.
   - *Benefício:* o atendimento vira pipeline preenchido e agenda cheia, sem digitação manual.

6. **Handoff limpo e opt-out automático.** Se o cliente pede gente ("quero falar com atendente"), a Iza chama um humano, pausa e a conversa fica atribuída, sem IA e pessoa falando por cima uma da outra. Se o cliente manda "SAIR" ou "PARAR", ela descadastra do marketing na hora, cumprindo LGPD e protegendo o número contra bloqueio da Meta.
   - *Benefício:* transição sem atrito para o humano e conformidade legal automática.

## O que o cliente faz na prática (casos de uso reais)
- **Vende no domingo à noite.** O lead pergunta preço e disponibilidade fora do expediente; a Iza responde na hora com o valor certo da base, contorna a primeira objeção e manda o link. Segunda de manhã, o pedido já está fechado.
- **Tira as perguntas repetidas da equipe.** Horário, endereço, formas de pagamento, "vocês atendem tal caso?": a Iza resolve o volume e deixa a equipe humana só para o que exige mão.
- **Qualifica e entrega o lead quente pronto.** Quando o cliente aceita a oferta, a Iza marca o lead como qualificado, sobe o score e cria a tarefa de follow-up para o vendedor, com o contexto todo.
- **Agenda sozinha.** "Quero marcar para quinta": a Iza confere disponibilidade e agenda, gravando na agenda interna (sincronização com o Google Calendar em breve, Fase 2). Add-on Agendamento pela IA, incluído no Growth para cima.
- **Atende por áudio.** O cliente prefere mandar áudio; a Iza transcreve, entende e pode responder também em voz natural pt-BR (add-on Voz Nativa).
- **Responde no Instagram e no site também.** O mesmo cérebro atende WhatsApp, Instagram Direct e o chat do site, com histórico unificado.
- **Chama o humano na hora certa.** Reclamação séria ou pedido explícito de atendente: a Iza passa o bastão e o atendente assume no inbox (Conversas), com a IA pausada.

## Diferenciais únicos (contra os concorrentes BR)
Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas, GPT Maker e Zaia hoje todos dizem "temos agentes de IA". A diferença não está no slogan, está na conta e na engenharia:

- **Zero taxa de setup.** Vários concorrentes cobram implementação para começar. Na ZappIQ, começar custa zero. A implementação assistida existe, mas é consultoria da MACHIA, nunca uma taxa da plataforma.
- **Mensalidade fixa, sem cobrança por conversa.** O modelo de "crédito por mensagem" ou "por conversa" pune justamente quem cresce: quanto mais a IA trabalha, mais você paga. Na ZappIQ a Iza pode dobrar o volume que a fatura não muda. O roteamento multi-modelo é o que torna isso sustentável para a ZappIQ (o modelo barato faz o grosso, o premium entra só no que vale).
- **Sem fidelidade amarrada e trial de 14 dias sem cartão.** Você testa a Iza no seu WhatsApp antes de pagar qualquer coisa.
- **Dados no Brasil e LGPD de fábrica.** Dados processados e armazenados no Brasil, em São Paulo, com opt-out automático, trilha de auditoria e requisições LGPD nativas no painel. Cláusula de não-treinamento: os dados do cliente não são usados para treinar modelos de terceiros. ZappIQ é Meta Business Partner e marca endossada da MACHIA (selo "A Platform MACHIA Company").
- **Loop de auto-correção auditada.** Este é um diferencial que poucos players no mercado BR expõem: a qualidade da Iza é medida continuamente contra uma bateria de cenários e, quando ela erra, o sistema propõe a correção do comportamento para você aprovar. Não só promete qualidade: audita e mostra a prova. (Detalhe no produto "Qualidade da IA".)
- **Não é uma árvore de decisão fantasiada.** A Iza entende linguagem natural e busca na base do seu negócio. Não é "digite 1 para vendas".

## Valor de alto impacto (números)
- **~65% dos atendimentos resolvidos sem humano** (número ilustrativo) [confirmar métrica média da base ZappIQ], o que devolve tempo da equipe para o que fecha venda.
- **Resposta em segundos, 24/7/365.** O lead que chega às 2h da manhã é atendido às 2h da manhã, não no próximo dia útil. Zero fila, zero horário comercial.
- **Roteamento que usa modelo ~200x mais barato** em conversa padrão (número real do código de roteamento), o que sustenta a promessa de mensalidade fixa sem cobrança por conversa enquanto preserva qualidade nos momentos de venda.
- **4 modelos de IA em cascata com disjuntor automático:** a Iza não fica fora do ar por causa de um provedor único. SLA de 99,9%, com créditos automáticos em caso de indisponibilidade, plano de continuidade com RPO de 1h e RTO de 4h, e notificação de incidente em até 72h. Infraestrutura no Brasil (São Paulo), com certificação SOC 2 Type II.
- **Custo marginal por mensagem previsível:** ao contrário do modelo por crédito, dobrar o volume de conversas não dobra a fatura. [confirmar economia média vs. concorrente por-conversa em um caso real]

> Sugestão de formato "3 antes / 3 depois" para a landing:
> **Antes:** responde em horas, perde a noite e o fim de semana, vendedor afogado em pergunta repetida.
> **Depois:** responde em segundos, atende 24/7, ~65% resolvido sozinho e o vendedor só pega lead quente. [confirmar os três números finais com dado de cliente]

## Integração com os outros produtos (a tese da plataforma completa)
A Iza não é um produto isolado. Ela é a mão que opera toda a plataforma. Cada outro módulo existe para deixá-la mais forte ou para colher o que ela produz:

- **Conversas (inbox):** onde a Iza atende e onde o humano assume quando ela faz handoff. IA e time humano no mesmo lugar, sem atropelo.
- **Treinar IA (base RAG):** o cérebro da Iza. O cliente ensina por documento, URL, texto, perguntas e respostas e um questionário de GTM. Um medidor de prontidão mostra a evolução da Iza (Começando, Aprendendo, Pronta, Expert). Quanto mais treinada, mais ela resolve sozinha.
- **Qualidade da IA:** o loop que audita e corrige a Iza continuamente contra uma bateria de cenários, sugerindo ajustes de comportamento para você aprovar.
- **Contatos e CRM:** cada conversa vira pipeline. A Iza qualifica o lead, sobe o score, avança o estágio e registra a linha do tempo, sem digitação.
- **Tarefas:** quando a Iza detecta intenção de compra, ela cria a tarefa de follow-up para o vendedor não deixar o lead esfriar.
- **Agenda:** a Iza marca consultas, reuniões e visitas direto na agenda interna (sincronização com o Google Calendar em breve, Fase 2).
- **Maestro (fluxos visuais):** para quem quer roteiro, o Maestro desenha o fluxo e injeta instruções pontuais no cérebro da Iza. É híbrido: passos determinísticos onde precisa de controle, inteligência da Iza onde precisa de conversa. O caminho agêntico com webhooks (a Iza consultando sistemas externos no meio do fluxo) já existe no motor.
- **Zap Impulso (campanhas):** o disparo traz o lead; a Iza atende a resposta inbound e converte. O opt-out automático protege a saúde do número.
- **Templates:** a Iza usa templates aprovados pela Meta para reengajar fora da janela de 24h.
- **Analytics e Radar 360:** cada turno da Iza é auditado (provedor, modelo, tokens, custo, latência), o que alimenta a observabilidade de desempenho e de custo por cliente.

A frase que resume: **você ensina uma vez (Treinar IA), a Iza atende e vende (Conversas), preenche o CRM e a agenda sozinha, as campanhas alimentam a boca do funil, e a Qualidade da IA garante que ela só melhora.** É uma operação inteira que trabalha enquanto você dorme.

## Disponibilidade por plano / add-on / preço
A Iza é o agente e está presente em **todos os planos**. O que muda é a capacidade (mensagens de IA por mês, atendentes humanos, tamanho da base de conhecimento) e alguns módulos avançados.

- **Lite, R$ 247/mês** (R$ 197,60/mês no anual, 20% off): 1 atendente humano, 1.500 mensagens de IA/mês, base RAG de 10 documentos, 1 número WhatsApp + 1 Instagram Direct, Qualidade da IA incluída, Analytics operacional. Agendamento pela IA entra como add-on de R$ 49.
- **Growth, R$ 497/mês** (mais popular): 10 atendentes, 8.000 mensagens de IA/mês, base RAG de 50 documentos, 2 números WhatsApp, API aberta e webhooks, 15 integrações nativas, Agendamento pela IA incluído. Echo Copilot (a Iza sugerindo a resposta para o atendente humano) disponível neste tier, hoje com backend parcial: **tratar como beta**.
- **Scale, R$ 1.497/mês:** 75 atendentes, 80.000 mensagens de IA/mês, base RAG ilimitada, Radar 360 incluído, Vision inbound (leitura de imagens, hoje a Iza **acusa** a imagem e pede o texto, leitura completa em evolução), Memory Layer Mem0 **em rollout**, Outcome Beta opt-in.
- **Enterprise, sob consulta** (anual com 10% off): sem limites, infra isolada, SOC/NOC 24/7, roteamento de modelo customizado.

**Bandeiras invioáveis:** zero taxa de setup; mensalidade fixa sem cobrança por conversa; trial de 14 dias sem cartão; implementação assistida é consultoria MACHIA, nunca taxa da plataforma.

**Add-ons que turbinam a Iza:**
- **Voz Nativa** (voz natural pt-BR, entrada e saída em áudio): 6 pacotes, de R$ 79,90 (200 min) a R$ 929,90 (4.000 min).
- **Agendamento pela IA:** R$ 49/mês, incluído do Growth para cima.
- **Radar 360 Observabilidade:** R$ 397/mês, para auditar desempenho e custo da Iza no detalhe.
- **Pacotes de mensagens de IA extras:** de R$ 99 a R$ 749, para quando o volume cresce sem trocar de plano.
- **Contatos extras:** +5 mil por R$ 59, +25 mil por R$ 199.
- **Número WhatsApp Business adicional:** R$ 137/mês. **Instagram Direct adicional:** R$ 97/mês.
- **Atendente (seat) adicional:** R$ 79/mês, para ampliar o time humano no inbox.
- **Zap Impulso (campanhas):** Start R$ 197, Pro R$ 597, Scale R$ 1.297, com trial próprio de 7 dias. Enche a boca do funil e a Iza atende a resposta inbound.

> Planos descontinuados (não citar como vigentes): Starter (R$ 197) e Business (R$ 1.997).

## Sugestão de prova / mini-demo para a landing
**"Fale com a Iza agora."** Um número de WhatsApp ao vivo na página, com QR code, onde o visitante conversa com a própria Iza (a instância dogfood da ZappIQ). Deixe a Iza fazer o pitch dela mesma: é a prova mais honesta possível, e mostra latência real e naturalidade de português.

Reforços para a seção:
- **Widget de "cérebro em ação":** uma animação curta mostrando a mensagem do cliente passando por Memória do negócio, Intenção detectada, Modelo escolhido e Resposta, para tornar o roteamento multi-modelo tangível sem jargão.
- **Antes/depois de um print:** conversa real de fim de semana fechando uma venda às 22h47 (com dados mascarados). Uma imagem vale a página inteira de copy.
- **Selo de honestidade:** um "o que já faz / o que está chegando" transparente (texto disponível, voz por add-on, Vision em evolução). Cliente de PME desconfia de promessa redonda demais; assumir o "em breve" aumenta a conversão.

Microcopy sugerida para o herói: *"Ela já está trabalhando para outro negócio agora. Manda um oi."*

## CTA
**Comece grátis por 14 dias, sem cartão. Coloque a Iza para atender seu WhatsApp hoje e veja quantas conversas ela fecha antes da sua próxima reunião.**

Secundário: *"Fale com a Iza agora"* (link direto para o WhatsApp da demo ao vivo).

---

## Business case
O jeito honesto de mostrar o valor da Iza é botar na conta. Abaixo, uma operação típica no plano Growth (R$ 497/mês): uma loja que recebe cerca de 3.000 conversas por mês entre WhatsApp e Instagram, com 2 atendentes humanos. Os números marcados [ilustrativo] são modelados a partir das metas do produto e da calculadora de ROI (Iza ~65% de resolução, +30% de conversão, payback ~90 dias); os reais variam com a base de conhecimento e o segmento.

**Três números antes:**
- **Tempo de primeira resposta:** cerca de 4 horas no horário comercial, e no fim de semana só na segunda de manhã.
- **Atendimentos que passam por um humano:** 100%, tudo cai na fila dos 2 atendentes.
- **Conversão de conversa em venda:** 8%.

**Três números depois** [ilustrativo]:
- **Tempo de primeira resposta:** segundos, 24 horas por dia, inclusive de madrugada e no fim de semana.
- **Atendimentos resolvidos sem humano:** ~65% [ilustrativo]. Sobram 35% para os 2 atendentes, que passam a cuidar de objeção, pós-venda e lead quente, em vez de repetir horário e prazo de entrega.
- **Conversão de conversa em venda:** ~10,4%, ou seja +30% [ilustrativo].

**A conta do retorno** (ticket ilustrativo de R$ 150):
- **Receita antes:** 3.000 conversas x 8% x R$ 150 = R$ 36.000/mês.
- **Receita depois:** 3.000 x 10,4% x R$ 150 = R$ 46.800/mês. Ganho bruto de ~R$ 10.800/mês [ilustrativo], só pela dúvida respondida na hora, antes de o cliente fechar no concorrente.
- **Folha que deixa de crescer:** os ~1.950 atendimentos/mês que a Iza resolve sozinha (65% de 3.000) seriam o trabalho de um terceiro atendente. Não contratar economiza cerca de R$ 2.500/mês.
- **Investimento:** R$ 497/mês do Growth (mais um pacote de mensagens de IA de R$ 99 a R$ 749 só se a operação estourar o teto do plano).
- **Payback:** modelado em ~90 dias [ilustrativo], já contando o tempo de ensinar a base no Treinar IA e afinar o comportamento até a Iza chegar ao patamar de ~65% de resolução. Passado esse ramp-up, o ganho mensal supera a mensalidade em várias vezes.

O mecanismo por trás de cada número não é mágica: o tempo de resposta cai porque a Iza atende 24/7 sem fila; a resolução sem humano sobe porque o RAG responde com o dado certo do próprio negócio; a conversão sobe porque a classificação de intenção escala para o modelo mais consultivo no momento do "quero comprar"; e a folha não cresce porque o roteamento multi-modelo mantém a mensalidade fixa mesmo quando o volume dobra.

## Exemplo de aplicabilidade: e-commerce / varejo online (loja com picos de mensagens)
**O negócio.** A "Bendito Verão" é um e-commerce de moda praia, porte pequeno-médio, cerca de R$ 400 mil/mês de faturamento. Vende pelo site, pelo WhatsApp e pelo Instagram, com 2 atendentes na operação.

**A dor.** No dia a dia dá conta. O problema é o pico: início do verão, Dia das Mães e Black Friday. Nesses dias a loja recebe mais de 5.000 mensagens, quase todas variações das mesmas perguntas: "tem no tamanho M?", "qual o prazo pro meu CEP?", "aceita Pix?", "cadê meu pedido?". Os 2 atendentes viram gargalo, a primeira resposta sai 3 horas depois, e o cliente que estava com o cartão na mão desiste ou compra em outra loja. De madrugada e no fim de semana, justo quando o público navega, não tem ninguém no balcão. Carrinho abandonado por dúvida não respondida virou o maior ralo de receita da loja.

**O produto agindo, passo a passo:**
1. **Treinar IA.** A loja sobe o catálogo, a tabela de tamanhos, a política de troca, os prazos por região e as formas de pagamento. O medidor de prontidão sai de "Aprendendo" para "Pronta" conforme a base fica completa.
2. **Iza atende nos três canais.** WhatsApp, Instagram Direct e chat do site com histórico unificado. Ela confere disponibilidade de tamanho na base, calcula o prazo pelo CEP e confirma se o pagamento caiu, tudo em segundos.
3. **Classificação de intenção.** Quando a cliente diz "quero o biquíni Marésia no M", a Iza reconhece o aceite de compra, escala para o modelo mais consultivo, contorna a objeção de frete e manda o link de pagamento. Ela não despeja catálogo em quem já falou sim.
4. **Vision inbound (beta).** A cliente manda a foto de um look e escreve "quero esse". Hoje a Iza acusa a imagem e pede a referência ou o nome do produto; a leitura completa da foto está em evolução.
5. **Handoff limpo.** Reclamação de pedido atrasado ou pedido explícito de atendente sai da IA e cai no Conversas, com a Iza pausada e o contexto todo na tela do atendente.
6. **CRM e Tarefas.** A cliente que perguntou preço mas não fechou vira contato qualificado no CRM, com score, e gera uma tarefa de follow-up para o vendedor recuperar o carrinho antes de esfriar.
7. **Zap Impulso e Templates.** No lançamento da coleção de verão, o Zap Impulso dispara a campanha e a Iza atende a enxurrada de respostas inbound sem o time afogar. O opt-out automático protege a saúde do número em pleno pico da Black Friday, e os Templates reengajam quem perguntou e sumiu, fora da janela de 24h.
8. **Qualidade da IA, Radar 360 e Analytics.** O loop de auto-correção audita a Iza contra os cenários da loja e sugere ajustes; o Radar 360 e o Analytics mostram, no pico, o custo por atendimento, o volume e a taxa de resolução, para o dono decidir com número na mão.

**O desfecho** [ilustrativo]:
- Tempo de primeira resposta no pico caiu de cerca de 3 horas para segundos.
- Cerca de 65% dos atendimentos foram resolvidos sem humano [ilustrativo]; os 2 atendentes deixaram de se afogar e passaram a cuidar de troca, reclamação e dos pedidos de ticket alto.
- A conversão de conversa em pedido subiu ~30% [ilustrativo], puxada pela dúvida respondida antes do checkout.
- A loja não precisou contratar temporários de Black Friday, economizando a folha extra do pico.
- As vendas de madrugada e de fim de semana, que antes evaporavam, passaram a fechar.

**A tese da plataforma completa neste cenário.** Nada disso é a Iza sozinha. A loja ensina uma vez no Treinar IA, a Iza atende e vende no Conversas, o CRM e as Tarefas transformam cada conversa em pipeline e carrinho recuperável, o Zap Impulso enche a boca do funil na coleção nova, os Templates reengajam fora da janela, a Qualidade da IA garante que ela só melhora e o Radar 360 mostra o custo e o desempenho no detalhe. Se a loja também trabalha com áudio, o add-on Voz Nativa deixa a Iza responder em voz natural pt-BR. É a operação inteira de atendimento e vendas trabalhando no pico, enquanto o dono cuida do estoque e da logística.
