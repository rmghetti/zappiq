# Analytics e Radar 360 (observabilidade)

**Uma plataforma MACHIA. Selo "A Platform MACHIA Company". Meta Business Partner. Dados processados e armazenados no Brasil, em São Paulo.**

> Tagline: **Sua operação de WhatsApp já gera os dados. O Radar transforma em decisão antes de você perguntar.**

Categoria: observabilidade de negócio para atendimento e vendas por WhatsApp. Não é "relatório", é o painel que narra o que aconteceu, aponta o que saiu do normal e diz o que fazer a respeito.

---

## Status honesto por camada

A ZappIQ vende Analytics em duas camadas, e a gente é reto sobre onde cada uma está:

| Camada | O que é | Status | Disponibilidade |
| --- | --- | --- | --- |
| **Analytics operacional** | Painel de resultado, operação e campanhas, com Pulso narrado e Vendas atribuídas à IA | **Disponível em produção** (verificado no código: `apps/api/src/routes/analytics.ts`, `analyticsPulse.ts`, cron ligado) | Incluído em todos os planos (Lite, Growth, Scale, Enterprise) |
| **Radar 360 (observabilidade executiva)** | Previsão por ML, cohort, benchmarking setorial, export para BI, dashboards white-label, alertas multicanal | **Parcial: núcleo em produção, camada avançada em construção** (a página de vendas hoje descreve o alvo, o backend entrega o núcleo) | Add-on **R$ 397/mês**, **incluído no Scale** e no Enterprise |

Essa honestidade é vendedora: o cliente confia mais quando o "em breve" é assumido do que quando o concorrente promete nove módulos e entrega um PDF.

---

## O problema concreto do dono de PME

Quem toca uma PME com WhatsApp no centro da operação vive três cegueiras que custam dinheiro todo mês:

1. **Não sabe quanto a IA realmente resolve.** "A Iza está respondendo bem?" é respondida com achismo, não com número. Se a automação cai de 70% para 40% numa terça, o dono só descobre quando o time reclama de fila.
2. **Não sabe onde o lead cai.** O cliente pergunta, some, e ninguém sabe se foi na segunda mensagem, no horário errado ou no script fraco. Sem funil, todo lead perdido é anônimo.
3. **Não sabe o que a IA fechou.** A venda entrou no caixa, mas foi a Iza, foi o vendedor, foi o anúncio? Sem atribuição, o dono paga a plataforma no escuro e não sabe o ROI.

E o mercado piora isso: contratar um analista sênior de BI custa **R$ 8 mil a R$ 15 mil por mês** [confirmar faixa]. Nenhuma PME faz isso por um canal de WhatsApp. Então a decisão continua no "eu acho".

---

## O que é

O **Analytics** é o painel de observabilidade que já vem em todo plano ZappIQ. Ele lê a operação real da Iza (mensagens, conversas, contatos, campanhas, deals no CRM) e mostra, em três camadas de leitura, o que a operação entregou, como está o atendimento e o alcance das campanhas. No topo fica o **Pulso**: um resumo narrado, em português de negócio, do que aconteceu e do que merece atenção.

O **Radar 360** é a evolução executiva desse painel para quem trata o WhatsApp como canal crítico: previsão de pipeline, análise de coorte, comparativo contra o mercado, export para as ferramentas de BI que o time já usa (Power BI, Looker) e alertas que chegam antes de você abrir o painel. É o add-on que substitui o analista de BI por R$ 397/mês em vez de R$ 12 mil.

---

## Como funciona (o mecanismo, traduzido em benefício)

### Pulso: a IA narra a operação, sem inventar número

Todo dia às 03:20 UTC um cron roda por organização (`analyticsPulseCron.ts`, com kill-switch `ANALYTICS_PULSE_CRON` e reprocessamento idempotente do dia). Para cada empresa ele:

1. **Fecha o snapshot do dia** (`computeOrgDayMetrics`): automação, mensagens IA vs humano, novos contatos, conversas resolvidas, tempo de 1ª resposta, CSAT, sentimento, leads qualificados. Persistido em `analytics_metric_daily`.
2. **Detecta anomalia de forma determinística** (`detectAnomalies`): compara o dia contra a **baseline de 14 dias** por z-score. Desvio de **2 sigma** vira "atenção", **3 sigma** vira "crítico". Tem ainda limiar absoluto (1ª resposta acima de 5 min, CSAT abaixo de 3) que pega problema já no primeiro dia, sem esperar histórico.
3. **A IA só redige sobre os fatos** (`narrateWithLLM`): o modelo recebe os números já calculados e a regra rígida "use exclusivamente os números presentes, nunca invente". Se o LLM cair ou o parse falhar, entra o **fallback determinístico garantido** (`buildDeterministicNarrative`). A severidade vem sempre das anomalias, nunca do texto da IA.

Benefício para o dono: em vez de garimpar gráfico, ele lê três frases do tipo "Atenção: o tempo de 1ª resposta subiu para 8min, acima do normal de 40s. Pode haver fila acumulada" e já recebe o botão de ação ("Ver gargalo de resposta"). Quer o resumo na hora? O botão "Gerar com IA" chama o refresh sob demanda, sem esperar a madrugada.

### Vendas atribuídas à IA: quanto a Iza fechou, quanto ela assistiu

Para cada deal ganho no período (`sales-attribution`), uma regra de janela last-touch classifica em três baldes:

- **Fechada pela IA**: houve mensagem da Iza nos 7 dias antes do ganho E nenhum humano nas 24h finais.
- **Assistida pela IA**: houve Iza nos 7 dias E também humano nas 24h.
- **Sem IA**: nenhuma mensagem da Iza na janela.

O painel mostra a receita atribuída, separa fechado de assistido, calcula o **influence score** (proporção de mensagens da Iza vs humanas) e lista os **"momentos que a Iza destravou"** (as mensagens de maior confiança na janela do ganho). E quando há ambiguidade, a IA sugere o vínculo e o dono confirma com um clique ("Sim, foi a Iza" / "Não foi"). A régua é explícita na tela: "tendência, não prova causal". Isso é honestidade que vende.

### Drill-down: todo número abre a evidência

Clicou numa barra de volume, vê as mensagens daquela janela. Clicou numa fatia de sentimento, vê as conversas. O dado nunca é um número morto: é uma porta para a conversa real.

### Radar 360: a camada executiva

Sobre esse núcleo, o Radar 360 abre previsão de pipeline (hoje já existe o **forecast ponderado por probabilidade de estágio** no CRM: soma de valor × probabilidade dos deals abertos; a previsão por ML é a evolução em construção), cohort de retenção por mês de entrada, comparativo anônimo contra a média do seu segmento, export para Power BI e Looker, e alertas proativos por Slack, WhatsApp e e-mail. E o diferencial que ninguém no Brasil mostra: **o custo de IA por conversa**, transparente, para o dono saber exatamente quanto cada atendimento automatizado custou e qual a margem real da operação.

---

## O que o cliente faz na prática (casos de uso reais)

- **Descobre o gargalo antes do cliente reclamar.** O Pulso avisa "automação caiu para 42%, normal ~70%" numa quarta de manhã. O dono reforça um fluxo no Maestro e recupera a automação no mesmo dia.
- **Prova o ROI da IA para o sócio.** Fim do mês, abre "Vendas atribuídas à IA": "R$ 47 mil atribuídos, sendo R$ 31 mil fechados pela Iza sozinha". A conversa deixa de ser "será que vale?" e vira "quanto mais podemos automatizar?".
- **Corrige o horário da campanha.** O funil mostra que o melhor vendedor converte 3x mais às 10h do que às 16h [confirmar]. O disparo do Zap Impulso é remarcado e a taxa de resposta sobe.
- **Antecipa churn.** [em breve] O alerta de palavra emergente sinaliza pico de menções a "concorrente" ou "cancelar". O dono age antes de perder a conta.
- **Entrega relatório para o board sem esforço.** [em breve] O Radar exporta para Power BI ou manda o PDF agendado por e-mail. O time de BI usa a ferramenta que já conhece, sem ETL.

---

## Diferenciais únicos (contra os concorrentes BR, nominalmente)

1. **Observabilidade nativa, sem ETL e sem lag.** Blip, Zenvia e Huggy tratam analytics como módulo à parte ou exportação. Na ZappIQ o Analytics lê a mesma operação da Iza em tempo real, dentro do painel, sem conector externo.
2. **Pulso narrado com anti-alucinação.** A IA redige, mas nunca inventa número: os fatos são calculados de forma determinística e há fallback garantido. Os concorrentes que colam "IA" no dashboard não têm essa disciplina, e o número errado numa reunião de diretoria custa caro.
3. **Vendas atribuídas à IA com honestidade explícita.** Kommo e RD Conversas mostram pipeline. Nenhum separa "a IA fechou sozinha" de "a IA assistiu" com janela auditável e ainda escreve "tendência, não prova causal" na tela.
4. **Custo de IA transparente por conversa.** [Radar 360, em construção] Ninguém no mercado BR mostra ao dono quanto cada atendimento automatizado custou. É a métrica que transforma "a IA responde" em "a IA responde com margem X".
5. **A cunha comercial da casa.** Zero setup fee, mensalidade fixa **sem cobrança por conversa**, trial de 14 dias sem cartão, LGPD com dados processados e armazenados no Brasil, em São Paulo. Enquanto Blip, Zenvia, Poli, Letalk, GPT Maker e Zaia escondem setup, cobrança por crédito/conversa e fidelidade, aqui o Radar custa R$ 397 fixos e vira previsível na planilha do dono.

---

## Valor de alto impacto (três números antes, três depois)

**Antes do Radar (a PME cega):**
- **0 previsão:** o dono descobre a queda de automação quando o time reclama, dias depois.
- **R$ 8k a R$ 15k/mês:** o custo de um analista sênior de BI que a PME nunca vai contratar. [confirmar faixa de mercado]
- **100% no achismo:** toda venda que a IA fechou é atribuída "ao acaso", sem número para defender o investimento.

**Depois do Radar (a PME com visão):**
- **Anomalia detectada em D+1**, com desvio de 2 sigma sobre 14 dias de baseline, narrada em linguagem de negócio e com ação sugerida.
- **R$ 397/mês** substituem o equivalente a **20 a 30 horas/mês** de trabalho analítico. [confirmar equivalência]
- **7% a 22%** de aumento de conversão (número ilustrativo) observado em quem passa a ajustar script e horário com base no BI conversacional, com **payback típico em cerca de 90 dias** (piso do ROICalculator da plataforma). [confirmar os números com base de clientes]

Racional de venda: um único ajuste de horário ou de template, guiado por um insight do Radar, costuma cobrir o add-on do ano inteiro.

---

## Integração com os outros produtos (a tese da plataforma completa)

O Radar não é um painel isolado, é o sistema nervoso que enxerga a plataforma inteira operando:

- **Conversas e Iza:** cada mensagem da Iza vira dado de automação, sentimento e tempo de resposta. O Analytics é o espelho do que a IA fez no atendimento.
- **CRM e Agenda:** os deals ganhos alimentam "Vendas atribuídas à IA"; o forecast ponderado sai do pipeline do CRM. Marcou a venda como ganha, o Radar já te diz se foi a Iza.
- **Zap Impulso:** o funil de campanhas (enviadas, entregues, lidas, respondidas) lê os disparos em massa. O Radar mostra qual template rendeu e o Pulso sugere replicar o que converteu.
- **Maestro:** quando a automação cai, a ação sugerida pelo Pulso é literalmente "reforçar fluxos no Maestro". O Radar aponta o buraco, o Maestro tapa.
- **Qualidade da IA e Auditoria:** o Pulso audita cada chamada de LLM (provider, modelo, tokens, latência, custo) via `logLLMCall`, a mesma espinha que sustenta o custo de IA transparente do Radar 360.

Uma plataforma que atende, vende, dispara campanha e agenda sozinha precisa de um lugar que prove que tudo isso deu resultado. Esse lugar é o Radar.

---

## Disponibilidade, plano e preço

- **Analytics operacional (Pulso + Vendas atribuídas à IA + drill-down):** incluído em **todos os planos** (Lite R$ 247, Growth R$ 497, Scale R$ 1.497, Enterprise sob consulta). Sem custo adicional.
- **Radar 360 (observabilidade executiva):** add-on de **R$ 397/mês**, **incluído no Scale** e no Enterprise. Disponível como add-on para Growth (a oferta no Lite depende do catálogo do plano) [confirmar].
- **Bandeiras invioláveis:** zero setup fee, mensalidade fixa sem cobrança por conversa, trial de 14 dias sem cartão, contrato anual com 20% de desconto. Implementação assistida é consultoria MACHIA, nunca taxa da plataforma.
- **Nota de status:** a camada avançada do Radar 360 (previsão por ML, cohort, benchmarking setorial, export Power BI/Looker, dashboards white-label, alertas multicanal) está em construção. O núcleo (Pulso narrado, anomalias, vendas atribuídas, forecast ponderado no CRM) está em produção hoje.

---

## Sugestão de prova / mini-demo para a landing

**Widget "O Pulso do seu dia":** um cartão animado que reproduz o insight real do produto. Começa com o resumo verde ("No dia de ontem, a IA automatizou 71% do atendimento, 34 conversas resolvidas, 12 novos contatos, 1ª resposta média de 38s") e, ao passar o mouse, transiciona para o estado de atenção ("Atenção: 1ª resposta subiu para 8min, acima do normal") com o chip de ação "Ver gargalo de resposta". Abaixo, uma barra "Fechada pela Iza R$ 31.240 · Assistida R$ 15.900" com o rótulo honesto "tendência, não prova causal".

Microcopy de apoio para a seção: **"Um analista de BI custa R$ 12 mil por mês. O Radar custa R$ 397 e narra o seu dia às 3h da manhã."**

Alternativa de prova social: um comparativo de três colunas "Blip / Zenvia / ZappIQ" marcando com honestidade o que cada um cobra escondido (setup, por conversa, fidelidade) versus a mensalidade fixa da ZappIQ.

---

## CTA

**Teste o Radar 360 por 14 dias, sem cartão [confirmar: o add-on Radar 360 não tem trial próprio no código; o trial de 14 dias é da plataforma]. Se ele não te entregar um insight acionável na primeira semana, é só cancelar, sem pergunta nenhuma.**

Botão primário: *Ativar o Radar no meu plano* · Botão secundário: *Ver o Pulso em ação (demo)*

---

## Business case

Uma operação típica de PME com o WhatsApp no centro: 2.000 conversas por mês, 500 delas viram leads de venda, ticket médio de R$ 400. O dono toca no escuro porque não tem quem leia esse dado todo dia.

**Antes do Radar (a decisão no achismo):**
- **5 a 7 dias** para perceber que a automação caiu: o alerta é o time reclamando de fila, não um número.
- **18% de conversão** de lead em venda, sem saber qual horário, qual script ou qual template puxa o resultado. São 90 vendas por mês, R$ 36 mil.
- **0% de visibilidade de margem:** o custo de IA por conversa é invisível, então o dono paga a plataforma sem saber quanto sobra em cada atendimento automatizado.

**Depois do Radar (a decisão no número):**
- **Anomalia detectada em D+1**, com desvio de 2 sigma sobre a baseline de 14 dias, narrada em linguagem de negócio pelo Pulso e já com a ação sugerida ("Ver gargalo de resposta"). A queda de automação vira um recado de manhã, não um prejuízo de semana.
- **~23,4% de conversão** depois de ajustar horário e script pelo que o painel mostra (o +30% relativo é o piso do ROICalculator da plataforma) [ilustrativo]. São ~117 vendas por mês, R$ 46,8 mil. A diferença é de **R$ 10,8 mil por mês**.
- **Custo de IA por conversa transparente:** cada atendimento automatizado tem custo e margem visíveis (via `logLLMCall`), então o dono decide o que automatizar mais sabendo a margem real, não a margem imaginada.

Racional de ROI [ilustrativo]: o add-on custa **R$ 397/mês**. Sair de 18% para 23,4% de conversão nessa operação move a receita de R$ 36 mil para R$ 46,8 mil no mês. O ganho de um único dia bem ajustado cobre o Radar do mês inteiro, e o payback fica bem abaixo dos ~90 dias que a calculadora usa como referência. O mecanismo é concreto: o Radar não "aumenta vendas", ele mostra onde o lead cai e qual ajuste recupera, e o ajuste é seu.

---

## Exemplo de aplicabilidade: rede de franquias (comparar unidades)

**O negócio:** a Rede Borigem, franquia de clínicas de estética com 24 unidades em 6 estados. Cada unidade usa o WhatsApp com a Iza para tirar dúvida, agendar avaliação e fechar pacote. A franqueadora acompanha o consolidado, mas não enxerga por dentro de cada unidade.

**A dor:** no fechamento mensal, o faturamento da rede está estável, mas escondido nele há um abismo. A unidade campeã converte **38%** dos leads de WhatsApp em venda; a mais fraca, **12%**; a média fica em **22%**. A franqueadora só descobre a unidade problemática 30 a 45 dias depois, quando o mês já fechou, e ainda por cima não sabe se o buraco é preço, script, horário ou atendimento lento. Sem comparar unidade contra unidade, cada franquia fraca é um prejuízo anônimo.

**O produto agindo na operação, passo a passo:**
1. **Analytics operacional (incluído em todo plano)** já fecha o snapshot diário de cada unidade: automação da Iza, tempo de 1ª resposta, conversas resolvidas, vendas atribuídas à IA. Cada franquia passa a ter o próprio Pulso.
2. **O Pulso narra o desvio em D+1:** "Unidade Campinas: automação em 44%, normal ~68%. 1ª resposta subiu para 6min." A franqueadora recebe o recado no dia seguinte, não no fechamento.
3. **Vendas atribuídas à IA por unidade** expõem o gap real: a campeã fecha 38% com forte participação da Iza, a fraca fica em 12% e com a Iza mal aproveitada.
4. **O drill-down abre a evidência:** clicando nas conversas da unidade fraca, a franqueadora vê que o script trava na objeção de preço, enquanto a unidade campeã tem uma resposta que destrava.
5. **A correção usa o resto da plataforma:** o template vencedor da campeã é replicado via **Templates** e reforçado como fluxo no **Maestro** na unidade fraca; a **Agenda** garante que a avaliação marcada não vira no-show; o **Zap Impulso** reativa os leads parados daquela unidade com a mensagem que já provou converter.
6. **A camada executiva do Radar 360** (add-on, comparativo entre unidades e alertas multicanal por Slack/WhatsApp/e-mail) consolida a rede num só painel, com o **custo de IA por conversa por unidade** para a franqueadora ver qual franquia opera com margem e qual queima verba. O benchmarking setorial e o cohort automáticos estão em construção; o comparativo operacional entre as unidades e as vendas atribuídas já rodam hoje.

**O desfecho mensurável [ilustrativo]:** a franqueadora ativa o Radar 360 nas **6 unidades abaixo da média**. Replicando o script e o horário da campeã, a unidade fraca sobe de **12% para 19%** de conversão em 8 semanas (+7 pontos). Com ~300 leads de venda por mês por unidade e ticket de R$ 600, cada unidade corrigida gera **~21 vendas extras por mês, R$ 12,6 mil**. Nas 6 unidades, são **~R$ 75,6 mil por mês** que estavam escapando por atendimento, não por falta de lead. O custo do add-on nessas unidades (R$ 397 cada) se paga já na primeira venda extra de cada uma.

**A tese da plataforma completa, dentro do cenário:** o Radar sozinho não vende, ele aponta a unidade e o buraco. Quem tapa o buraco é a Iza atendendo (**Conversas**), o **Maestro** e os **Templates** replicando o fluxo campeão, a **Agenda** segurando o agendamento, o **Zap Impulso** reativando os leads e a **Auditoria** mostrando a margem por unidade. Uma rede que atende, agenda, dispara campanha e fecha venda em 24 unidades precisa de um lugar que prove qual unidade está deixando dinheiro na mesa. Esse lugar é o Radar.
