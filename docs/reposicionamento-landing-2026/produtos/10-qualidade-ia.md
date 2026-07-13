# Qualidade da IA

**Loop de auto-correção auditada**

> Uma plataforma MACHIA · ZappIQ · Meta Business Partner · dados processados e armazenados no Brasil, em São Paulo

---

## Tagline

**A sua IA passa por auditoria toda semana, escreve a própria correção e só muda de comportamento quando você aprova. Você vê a prova antes de decidir.**

---

## Categoria

Qualidade e governança de agentes de IA: o loop de auto-correção auditada. Não é um chatbot, não é um painel de "satisfação". É o controle de qualidade que faz a Iza (o seu agente) melhorar sozinha, com você no comando.

**Status honesto:** disponível e em produção, incluído em todos os planos ativos (Lite, Growth, Scale, Enterprise), sem add-on e sem custo extra. O loop completo (detectar, dar nota, sugerir correção, você aprova/edita/recusa, grava no comportamento, re-testa, audita) roda hoje. A auditoria contínua de 100% das conversas reais do inbox (além da bateria de cenários) está no roadmap; hoje a auditoria roda sobre uma bateria de 25 cenários com dupla checagem, sem amostragem.

---

## O problema (dono de PME)

Você contratou uma IA pra atender e vender no WhatsApp. Ela responde bem na demo. Aí você solta ela com clientes de verdade e vem o medo que ninguém te tira: **e quando ela erra?**

E ela vai errar em algum momento. Vai prometer um desconto que não existe. Vai inventar um prazo. Vai deixar de passar um cliente irritado pra um humano. Vai usar uma gíria que não combina com a sua marca. Vai dar um preço errado. O pior: você só descobre **depois**, quando o cliente já foi embora ou já reclamou.

Hoje, quem quer garantir que a IA não sai da linha tem três saídas, todas ruins:

1. **Ler conversa por conversa.** Não escala. Você tem um negócio pra tocar.
2. **Contratar um consultor de prompt** cada vez que quer ajustar o comportamento. Caro, lento, e você fica refém dele.
3. **Rezar.** É o que a maioria faz.

Os concorrentes brasileiros (Blip, Zenvia, Huggy, Poli, Kommo, RD Conversas, GPT Maker, Zaia, Letalk) te vendem "agentes de IA" e te entregam uma caixa-preta. Você configura, publica e não tem como saber, de forma sistemática, se o agente continua respondendo do jeito certo na semana que vem. Quando a IA regride (porque você treinou algo novo, mudou um fluxo, ou o modelo foi atualizado), ninguém te avisa. O primeiro a descobrir é o cliente.

---

## O que é

**Qualidade da IA** é a área do painel ZappIQ que faz o controle de qualidade do seu agente de forma automática e contínua, e fecha o loop: quando encontra um desvio, a própria IA escreve a correção, você decide se aplica, e a versão aprovada passa a valer nas próximas conversas na hora. Sem retreinamento, sem consultor, sem código.

Pense num piloto de provas que roda a sua IA por 25 situações difíceis (cliente insatisfeito, intenção de compra, pedido de humano, pergunta de preço, tentativa de tirar desconto, pedido de dado sensível) e devolve um diagnóstico com nota, o que passou, o que falhou e a correção pronta pra cada falha. Você lê, aprova ou recusa, e o comportamento do agente muda.

Três níveis de saúde, em português de dono de negócio:

- **Bom** (90% ou mais dos cenários aprovados)
- **Atenção** (entre 70% e 89%)
- **Crítico** (menos de 70%)

O percentual exato fica ali do lado, como detalhe. Você não precisa entender nada técnico pra usar.

---

## Como funciona (o mecanismo, traduzido)

O loop tem seis passos. Todos existem e rodam hoje.

**1. Auditoria com dupla checagem, sem amostragem.**
Cada cenário da bateria é testado contra o seu agente e passa por **duas auditorias independentes**, não uma:

- Um **filtro determinístico** (padrões objetivos): o link certo apareceu? O preço bate com a tabela? A tag de encaminhamento pra humano foi emitida? Vazou o nome de algum fornecedor de tecnologia?
- Um **juiz de IA independente** (modelo separado do que responde), que lê a resposta e julga, com nota de confiança de 0 a 100, se o comportamento esperado aconteceu de verdade.

Só é "Aprovado" o cenário que passa nas duas. Se passa numa e falha na outra, vira "Parcial". Se falha nas duas, "Reprovado". Nada é amostrado: **todos os cenários passam pelas duas checagens, sempre.**

**2. Detecção de desvio e de risco.**
O sistema separa o que é erro leve do que é perigo. Um "Crítico" é o reprovado que pode custar caro de verdade: prometer o que não existe, dar preço errado, pedir CPF ou cartão pelo WhatsApp, não passar um cliente irritado pra um humano. A tela te manda tratar os Críticos primeiro.

**3. Nota clara.**
A saúde do agente vira Bom, Atenção ou Crítico, com quatro números por trás: Aprovados, Parciais, Reprovados e Críticos. É o "check-up" da sua IA numa olhada.

**4. Correção escrita pela própria IA.**
Aqui está o pulo do gato. Pra cada falha (e também pra cada acerto parcial), um segundo modelo, especialista em instrução de agente, escreve a correção: uma regra nova, numerada, com exemplo do certo e exemplo do errado, no formato que os modelos de IA de fato obedecem. Vem com um resumo em português simples ("adicionar regra pra sempre confirmar o CNPJ antes de informar dado sensível") e uma **porcentagem de confiança**. A correção nunca apaga o que já existe: ela **soma** uma regra, reforçando o ponto que falhou.

**5. Você decide (o humano no comando).**
Nada muda sozinho. Você lê o resumo e, se quiser, o texto exato. Então:

- **Aplica**: a correção é gravada direto nas instruções do agente e passa a valer nas próximas conversas na hora.
- **Edita antes de aplicar**: reescreve a regra do seu jeito (fortalecendo com "REGRA INVIOLÁVEL", "PROIBIDO", maiúsculas) quando quer ser mais firme.
- **Recusa**: se não faz sentido pro seu negócio, descarta. Volta na próxima execução.

O sistema ainda protege você de si mesmo: se a mesma correção já existe no prompt, ele **bloqueia a duplicação** e pede pra você fortalecer o texto, em vez de inchar as instruções com regras repetidas que o modelo acaba ignorando.

**6. Re-teste e reversão em um clique.**
Aplicou? Clique em "Re-testar agora" e o sistema roda **só aquele cenário** contra o comportamento já corrigido, na hora, pra confirmar que a correção pegou. Não gostou do resultado? "Reverter aplicação" devolve o agente exatamente ao estado anterior. Cada decisão (quem aplicou, quando, o texto antes e depois, a observação) fica registrada num histórico completo, com foto de antes e depois pra auditoria.

**Tempo real disso tudo:** a bateria completa leva de 3 a 5 minutos. Aplicar uma correção (ler o resumo, aplicar, re-testar) leva cerca de 3 minutos. Comparado a abrir um chamado com um consultor e esperar dias, a diferença é de outra ordem.

**E o que roda sozinho:** uma vez por semana, o sistema executa a bateria inteira no seu agente sem ninguém pedir e, se a nota cair abaixo de 90% ou aparecer um Crítico, dispara alerta. Você não precisa lembrar de checar. O agente do próprio ZappIQ (a Iza-mãe) roda essa auditoria **todos os dias**, é o mesmo motor.

---

## O que o cliente faz na prática (casos reais)

**Loja de eletrônicos, segunda de manhã.** O dono roda o teste e vê o agente em "Atenção" (78%). Dois cenários reprovaram: usou uma gíria proibida numa simulação de reclamação e esqueceu de chamar o cliente pelo nome. Aplica as duas correções sugeridas. Na execução automática da semana seguinte, a nota sobe pra 92%.

**Escritório de contabilidade.** Aparecem três comportamentos pra revisar: o agente não encaminhou um cliente irritado pra um humano, usou um termo técnico difícil e não confirmou o CNPJ antes de dar uma informação sensível. O dono trata os três em cinco minutos, sem tocar em nenhuma configuração.

**Clínica de estética.** O agente estava "Crítico" (62%) porque ainda não tinha informação suficiente sobre os procedimentos. A tela aponta que boa parte da nota vem do quanto o agente sabe do negócio e leva a dona a **completar o treinamento** (na área Treinar IA). Nota sobe pra "Bom" (94%) na execução seguinte.

**Clínica veterinária.** Uma correção aplicada antes não impediu o agente de prometer um prazo de exame errado. A dona usa "Editar antes de aplicar", troca por "PROIBIDO informar prazo de exame sem confirmar com a recepção" em maiúsculas, aplica de novo, e o cenário passa a aprovar no re-teste.

**Rede de farmácias.** A execução mostra 14 Aprovados, 3 Parciais, 2 Reprovados e 1 Crítico. O dono ataca primeiro o Crítico: o agente não confirmava a necessidade de receita médica antes de informar disponibilidade do remédio. Corrige e re-testa.

O padrão é sempre o mesmo: você vê o erro com os próprios olhos (a mensagem simulada e a resposta real do agente), entende o diagnóstico, decide, e confirma que pegou. Minutos, não dias.

---

## Diferenciais (contra o mercado, nominalmente)

**1. O loop fecha. Isso é raro.**
Blip, Zenvia, Huggy, Poli, Kommo, RD Conversas, GPT Maker, Zaia e Letalk vendem "agentes de IA". Nenhum te entrega, no mesmo lugar, o ciclo completo: **auditar, dar nota, escrever a correção, você aprovar, gravar no comportamento e re-testar.** No mercado, quem quer isso junta ferramenta de avaliação de um lado, consultor de prompt do outro, e reza pra dar certo. Aqui é um botão.

**2. A IA escreve a própria correção.**
Não é "a plataforma te avisa que tem um problema, agora vira você". A correção vem pronta, no formato que os modelos obedecem, com exemplo do certo e do errado, com nota de confiança. Você aprova, não redige.

**3. Dupla auditoria independente, sem amostragem.**
Todo cenário passa por um filtro objetivo E por um juiz de IA separado. Painéis de "sentimento" ou "CSAT" da concorrência olham o que o cliente sentiu; aqui o que se mede é se o agente **cumpriu a regra**, com dois avaliadores que não conversam entre si.

**4. Você no comando, com reversão e trilha de auditoria.**
Nada muda sozinho. Toda aplicação tem foto de antes e depois, autor, data e a possibilidade de reverter em um clique. Isso é governança de verdade, não uma caixa-preta.

**5. Sem retreinamento e sem consultor.**
A correção aprovada é gravada nas instruções do agente na hora. Não tem "ciclo de treinamento de 2 semanas", não tem fatura de consultoria. O conhecimento fica com você.

**6. As três cunhas da ZappIQ, também aqui.**
Zero setup fee. Mensalidade fixa, sem cobrança por conversa. Dados processados e armazenados no Brasil, em São Paulo, LGPD. Enquanto boa parte da concorrência esconde setup, cobrança por crédito/conversa e fidelidade, a Qualidade da IA já vem incluída no seu plano, sem letra miúda.

---

## Valor de alto impacto

**Números reais, verificáveis no produto hoje:**

- **25 cenários** na bateria (golden set v1.1), cobrindo as 8 regras-núcleo de comportamento (aceitação de oferta, encaminhamento pra humano, anti-padrões, formatação, uso do nome, integridade comercial, dados sensíveis) mais os cenários específicos do seu negócio.
- **2 auditorias independentes por cenário**, sem amostragem: filtro determinístico + juiz de IA.
- **3 a 5 minutos** por execução completa; **cerca de 3 minutos** pra aplicar uma correção e confirmar que pegou.
- **1 execução automática por semana**, com alerta disparado sempre que a nota cai abaixo de 90% ou aparece um cenário Crítico. Você não precisa lembrar de olhar.
- **Reversão em 1 clique** e histórico completo (quem, quando, texto antes e depois) de cada mudança de comportamento.

**Resultados de negócio (a validar com clientes reais):**

- Correção de comportamento que hoje leva **dias** (abrir chamado, esperar consultor) cai pra **minutos**. [confirmar magnitude com clientes]
- Redução de respostas fora de política (preço errado, promessa indevida, dado sensível pedido no lugar errado) medida execução a execução: exemplos de campo mostram notas subindo de 78% pra 92%, de 62% pra 94% e de 68% pra 91% em três semanas, à medida que o dono aplica as correções. [confirmar como média entre clientes, não só exemplos]
- Custo de governança de prompt: de uma fatura de consultoria recorrente pra **zero add-on** (incluído no plano). [confirmar economia média por cliente]

---

## Integração com a plataforma (a tese da plataforma completa)

A Qualidade da IA não é uma ilha. Ela é o sistema imunológico que deixa você confiar na Iza operando sozinha, ponta a ponta.

- **Maestro (construtor de fluxos):** a auditoria só liga quando o agente está publicado (no ar) no Maestro. Publicou, a qualidade passa a acompanhar. Não precisa esperar o treino estar 100%: ela avalia o agente como ele está hoje.
- **Treinar IA (base de conhecimento / RAG):** boa parte da nota vem do quanto o agente sabe do seu negócio. Quando a auditoria acha uma lacuna, a própria tela te empurra pra completar o treinamento, e a nota sobe na execução seguinte. O loop de qualidade e o loop de conhecimento se alimentam.
- **Conversas (inbox):** os cenários simulam exatamente as situações que aparecem no seu inbox real (insatisfeito, compra, handoff, preço). Garantir a qualidade aqui é garantir como a Iza se comporta lá, com clientes de verdade.
- **Auditoria e Requisições LGPD:** cada aplicação, recusa e reversão vira registro auditável, com foto de antes e depois do comportamento do agente. Isso conversa direto com a área de Auditoria e com a rastreabilidade que a LGPD exige. Comportamento de IA versionado, não improvisado.
- **Analytics e Radar 360 (observabilidade, add-on):** a nota ao longo do tempo mostra a evolução do agente; os alertas antecipam a queda. Com o Radar 360, essa saúde entra na mesma visão de observabilidade do resto da operação.

A tese é simples: os outros produtos fazem a Iza **operar** (atender, vender, agendar, disparar campanha, cuidar do CRM). A Qualidade da IA é o que faz você **confiar** que ela opera do jeito certo, e corrige quando não opera, sem tirar você do controle. É a diferença entre "colocar uma IA pra atender" e "ter uma operação de atendimento e vendas que se corrige sozinha, com auditoria".

---

## Disponibilidade, plano e preço

- **Incluído em todos os planos ativos**, sem add-on e sem custo extra:
  - **Lite** R$ 247/mês (a partir do trial de 14 dias sem cartão)
  - **Growth** R$ 497/mês (o mais popular)
  - **Scale** R$ 1.497/mês
  - **Enterprise** sob consulta
  - Anual com 20% de desconto no Lite, Growth e Scale (o Enterprise tem condição própria).
- **Zero setup fee. Mensalidade fixa, sem cobrança por conversa.** A implementação assistida, quando você quer, é consultoria MACHIA, nunca taxa da plataforma.
- **Trial de 14 dias sem cartão:** a Qualidade da IA já está lá pra você rodar no seu próprio agente desde o primeiro dia.
- **Limites operacionais:** execução automática semanal por agente, mais até uma execução manual a cada 24 horas por agente (a auditoria usa IA a cada rodada; o limite protege o seu custo e o seu resultado).

**Honestidade de roadmap:** o loop completo descrito aqui roda hoje. A auditoria contínua sobre 100% das conversas reais do inbox (além da bateria de cenários) e a personalização da bateria por vertical com poucos cliques estão no roadmap. Preferimos assumir o "em breve" a te vender fumaça.

---

## Sugestão de prova / mini-demo pra landing

Um bloco interativo de "antes e depois" em três telas, com dados reais do produto:

1. **A nota.** Um medidor mostrando "Atenção 78%" com os quatro números embaixo (Aprovados, Parciais, Reprovados, Críticos) e um cartão vermelho "1 Crítico: agente não passou cliente irritado pra humano".
2. **A correção pronta.** O cartão da sugestão da IA, com resumo em português ("adicionar regra pra sempre encaminhar cliente insatisfeito pra um humano"), confiança 88%, e o botão "Aplicar correção".
3. **O re-teste.** A tela verde "Re-teste passou, a correção pegou" e o medidor subindo pra 92%.

Microcopy de apoio: **"3 minutos. Sem consultor. Sem código. Você aprova, a IA corrige."** Um cronômetro discreto marcando o tempo entre o clique de "Aplicar" e o "Re-teste passou" ancora a promessa em número.

Alternativa em vídeo curto (20 a 30s): tela real do painel, do "Executar teste agora" ao "Re-testar agora" aprovando, com legenda dos passos. Prova de execução, não maquete.

---

## CTA

**Rode a primeira auditoria do seu agente hoje, no trial de 14 dias sem cartão. Em 5 minutos você vê a nota da sua IA, os cenários que ela erra e a correção pronta pra aprovar. Comece grátis.**

---

## Business case

O jeito honesto de mostrar o valor da Qualidade da IA num setor regulado é medir três coisas: quanto tempo você leva pra corrigir um desvio de comportamento, quanto isso custa, e quanto do risco você enxerga antes do cliente. Abaixo, uma operação típica no Growth (R$ 497/mês), com a Qualidade da IA já incluída, sem add-on. Os números marcados [ilustrativo] são modelados a partir do próprio produto e da calculadora de ROI da plataforma (payback ~90 dias); os reais variam com o volume e o segmento.

**Três números antes** (governança de prompt na mão):

- **Tempo pra corrigir um desvio de comportamento:** 3 a 5 dias úteis. Abre chamado, espera o consultor de prompt, testa, publica.
- **Custo por ajuste de política:** cerca de R$ 2.000 por revisão de consultor [ilustrativo]. Numa operação regulada, que muda tabela de taxa e texto obrigatório com frequência, isso vira fatura recorrente.
- **Cobertura de auditoria:** 0% sistemático. O desvio só aparece quando um cliente reclama ou quando o compliance lê uma amostra manual.

**Três números depois** [ilustrativo]:

- **Tempo pra corrigir:** cerca de 3 minutos. A IA escreve a correção, você lê o resumo, aplica e re-testa. A regra passa a valer nas próximas conversas na hora, sem retreinamento.
- **Custo por ajuste:** R$ 0 de add-on. A Qualidade da IA já vem no plano.
- **Cobertura:** bateria de 25 cenários com dupla checagem, sem amostragem, rodando automaticamente 1x/semana e sob demanda quando você quiser. Nenhuma conversa amostrada: todos os cenários passam pelas duas checagens, sempre.

**A conta do retorno** [ilustrativo]:

- **Consultor que some da folha:** se a operação fazia 3 ajustes de política por mês via consultor, a R$ 2.000 cada, são cerca de R$ 6.000/mês que deixam de existir [ilustrativo], contra R$ 497 do Growth (com o produto já incluído).
- **O risco que não se materializa:** em crédito, uma única resposta fora de política (prometer uma taxa que não existe, dizer "aprovado" antes da análise, deixar de informar o CET, pedir CPF ou dado bancário pelo canal errado) pode virar reclamação no Procon, apontamento no Bacen e ação de indenização. A auditoria semanal pega o desvio antes de ele chegar ao cliente. Aqui o retorno maior não é o custo do consultor economizado, é o incidente regulatório que não acontece.
- **A evolução medida:** as notas subindo de 78% pra 92%, de 62% pra 94% e de 68% pra 91% em três semanas [ilustrativo] são, na prática, menos resposta fora de política saindo a cada execução.
- **Payback:** modelado em ~90 dias [ilustrativo], já contando o tempo de montar a bateria com os cenários do setor e afinar as regras. Passado o ramp-up, o custo evitado somado ao risco evitado supera a mensalidade com folga.

O mecanismo por trás de cada número não é adjetivo: o tempo cai porque a correção vem escrita pela própria IA, no formato que o modelo obedece, e aplica na hora sem ciclo de retreinamento; o custo cai porque o produto já vem incluído, sem fatura de consultor; e o risco cai porque a dupla checagem (filtro determinístico mais juiz de IA independente) mede se o agente cumpriu a regra, não se o cliente ficou satisfeito. Num setor onde a IA não pode alucinar, medir o cumprimento da regra é o que importa.

## Exemplo de aplicabilidade: setor regulado (financeiro, crédito consignado e pessoal)

**O negócio.** A CrediPonte é um correspondente bancário e fintech de crédito, porte pequeno-médio, focada em consignado e crédito pessoal. Atende quase tudo pelo WhatsApp, cerca de 2.500 conversas por mês, 4 atendentes, e opera no Growth. A Iza faz a primeira triagem, simula e encaminha o cliente pra proposta.

**A dor.** Crédito é regulado, e a IA não pode alucinar. O agente não pode prometer uma taxa que não existe pra fechar mais rápido, não pode dizer "seu crédito já está aprovado" antes da análise, precisa informar o CET em toda simulação, e nunca pode pedir CPF, dado bancário ou foto de documento por um canal que não é o seguro. Um deslize não é só um cliente chateado: vira reclamação no Procon, apontamento no Bacen, ação de indenização. A sócia responsável vivia com o mesmo medo. Na demo a Iza responde certinho, mas e quando, no calor da conversa, ela inventa uma condição pra não perder o cliente? O compliance pedia pra "revisar as conversas", só que ninguém lê 2.500 por mês.

**O produto agindo na operação, passo a passo:**

1. **Bateria com os cenários do setor.** Além das 8 regras-núcleo, a operação adiciona os cenários que tiram o sono: "qual a menor taxa que vocês têm?", "então já tá aprovado?", cliente que manda foto do RG no chat, pedido de simulação sem o CET, cliente irritado exigindo humano.
2. **Dupla auditoria, sem amostragem.** O filtro determinístico confere o objetivo: o CET apareceu na simulação? A tag de encaminhamento pra humano foi emitida? O agente pediu algum dado sensível pelo canal errado? O juiz de IA independente lê a resposta e julga se o agente prometeu algo que não podia.
3. **Detecção de crítico.** Numa simulação, o agente respondeu "sua taxa fica em 1,2% ao mês" sem a ressalva de análise e sem o CET. Isso não é erro leve, é Crítico. A tela manda tratar primeiro.
4. **Correção escrita pela IA.** O sistema devolve a regra pronta, com exemplo do certo e do errado: sempre condicionar taxa e aprovação à análise de crédito e apresentar o CET em toda simulação. A sócia usa "Editar antes de aplicar", reforça pra "REGRA INVIOLÁVEL: PROIBIDO informar taxa ou aprovação sem a ressalva 'sujeito a análise de crédito' e sem o CET", e aplica.
5. **Re-teste na hora.** Clica em "Re-testar agora", o sistema roda só aquele cenário contra o comportamento já corrigido e confirma que pegou. O cenário do RG também: o agente passa a recusar a foto no chat e a orientar o canal seguro, em vez de processar o documento pelo WhatsApp.
6. **Trilha de auditoria.** Cada aplicação, recusa e reversão fica registrada com foto de antes e depois do comportamento, autor e data. O compliance e o DPO passam a ter evidência versionada, não uma amostragem manual.

**O desfecho** [ilustrativo]:

- A nota do agente subiu de "Atenção 76%" pra "Bom 93%" em três semanas, à medida que a sócia aplicou as correções.
- Zero resposta fora de política chegando ao cliente nas auditorias seguintes: os desvios passaram a ser pegos na execução semanal, antes de virarem conversa real.
- O compliance trocou "revisar conversas na mão" por uma trilha auditável, com a foto de antes e depois de cada mudança de comportamento.
- Nenhum incidente regulatório de resposta fora de política no período, o ganho que não aparece na planilha mas é o que mais pesa em crédito.

**A tese da plataforma completa neste cenário.** A Qualidade da IA não age sozinha. O Treinar IA guarda a tabela de produtos, as taxas e o texto obrigatório do CET; a Iza atende e simula no Conversas; o CRM registra a oportunidade e o estágio da proposta; a Auditoria e as Requisições LGPD guardam a trilha com hash encadeado que o Bacen e o DPO exigem; e a Qualidade da IA é o que garante que a Iza nunca sai da política, e corrige na hora quando sai, sem tirar a sócia do controle. Se a operação atende por áudio, o add-on Voz Nativa responde em pt-BR; o Radar 360 coloca a saúde do agente na mesma visão de observabilidade do resto da operação. Num negócio onde a IA não pode alucinar, é a diferença entre torcer pra dar certo e ter prova, toda semana, de que deu.
