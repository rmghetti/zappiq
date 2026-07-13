# CRM (com Contatos e Tarefas)

> **Tagline:** O CRM que se preenche sozinho. Cada conversa da Iza vira perfil atualizado, negócio no funil e follow-up na sua mesa, sem ninguém digitar nada.

**Categoria:** Núcleo da plataforma (CRM agêntico de vendas) · **Nome no Dash:** CRM · Contatos · Tarefas · Agenda (sob CRM)
**Marca:** ZappIQ, A Platform MACHIA Company · Meta Business Partner · dados processados e armazenados no Brasil, em São Paulo
**Agente padrão:** Iza (o cliente renomeia)

---

## O problema concreto do dono de PME

Todo dono de PME já ouviu que "precisa de um CRM". Comprou um. E aí veio a parte que ninguém conta: o CRM só funciona se alguém alimentar. Alguém tem que abrir o card, digitar o nome do lead, lembrar em que estágio ele parou, anotar o que foi conversado, agendar o retorno. Na correria de uma equipe de 3, 5, 10 pessoas, isso não acontece. O resultado é sempre o mesmo:

- O CRM vira um cemitério de leads desatualizados. O vendedor não confia no que está lá, então trabalha por WhatsApp e caderninho.
- O lead quente que respondeu "quero fechar" às 21h de sexta some no domingo, porque ninguém criou a tarefa de retorno.
- No fim do mês, o dono não sabe responder três perguntas básicas: quantos negócios estão abertos, quanto vale o pipeline, e por que a gente perdeu os que perdeu.

O problema nº1 do mercado de CRM não é falta de recurso. É **CRM sujo**: dado que entra errado, entra tarde, ou não entra. A ZappIQ ataca exatamente essa raiz.

---

## O que é

O CRM da ZappIQ é o cérebro comercial da plataforma. Ele tem três partes que trabalham juntas e uma característica que muda o jogo: **ele se abastece sozinho a partir das conversas que a Iza já está tendo com seus clientes.**

- **Contatos** é a base de gente. Cada pessoa que fala com você no WhatsApp ou Instagram vira um contato com telefone, e-mail, empresa, tags, status de lead (Novo, Contactado, Qualificado, Não qualificado, Convertido), um **lead score de 0 a 100** e a data da última interação. Busca por nome, telefone ou e-mail, filtro por status, exportação em CSV.
- **CRM (Pipeline de Vendas)** é o funil visual. Um kanban com seis colunas (Novo, Qualificado, Proposta, Negociação, Ganho, Perdido) onde você arrasta o negócio de uma coluna pra outra com o mouse. No topo, seis indicadores executivos. No rodapé, três painéis analíticos.
- **Tarefas** é a sua lista de ação do dia. Follow-ups que a IA cria quando detecta que vale a pena voltar, cada um amarrado ao contato e ao negócio, com prazo e alerta de atraso. Um clique conclui.
- **Agenda** (sob o CRM) é onde consultas, reuniões, ligações e visitas marcadas viram compromissos gerenciáveis (confirmar, cancelar, no-show, concluir).

A diferença de tudo que existe no mercado brasileiro: você não precisa alimentar nada disso. A conversa alimenta.

---

## Como funciona (o mecanismo, traduzido)

O segredo está num serviço que roda depois de cada resposta da Iza (`crmAutomationService`, disparado pelo orquestrador de agentes). A cada turno de conversa, a plataforma classifica a intenção do cliente e sincroniza o CRM. Em português claro:

**1. Cliente manda a primeira mensagem.**
A IA cria o contato na hora, registra "Contato criado a partir da conversa" na linha do tempo, move de Novo para Contactado e soma pontos no lead score. Você não abriu formulário nenhum. O dado entrou limpo, na origem, no segundo em que a conversa começou.

**2. A cada mensagem, o perfil evolui.**
A plataforma lê a intenção do turno (engajamento normal, objeção, pedido de humano, perfil enterprise, intenção de compra) e ajusta o lead score e o estágio do funil. Uma objeção soma pontos e mantém o lead vivo. Um "quero contratar" muda tudo.

**3. Detectou intenção de compra: a IA monta a venda sozinha.**
Quando o cliente sinaliza que quer fechar, a plataforma faz três coisas em sequência, sem pedir licença:
- promove o lead para Qualificado e o move para o estágio **Proposta** do funil;
- garante um **negócio (deal) aberto** para aquele contato, criando se não existir, herdando a campanha de origem para a atribuição de receita ver o ROI depois;
- cria uma **tarefa de follow-up** ("Follow-up: fechar a venda") com prazo de 24h, amarrada ao contato e ao negócio, sem duplicar se já existir uma pendente.

**4. Tudo vira histórico auditável.**
Cada evento (contato criado, mudança de estágio, salto de score, negócio criado, tarefa criada) entra na linha do tempo do contato e do negócio, marcado com o autor "IA". Quando você abre um card no pipeline, vê a história inteira: de onde veio, o que a Iza fez, qual conversa originou. Dá pra pular direto pro WhatsApp do contato ou pra conversa que gerou o negócio.

O benefício em uma frase: **o vendedor chega de manhã e o dia já está montado.** Os leads certos, no estágio certo, com a próxima ação definida. Ninguém digitou nada.

---

## O que o cliente faz na prática

- **Clínica de estética:** a recepção não existe mais como digitadora. A Iza atende no WhatsApp, o CRM vai enchendo, e quando alguém pergunta preço de um procedimento, a tarefa "voltar com a paciente" aparece na lista da gerente com o contexto pronto.
- **Imobiliária:** cada lead de portal que cai no WhatsApp vira contato com score. O corretor abre o pipeline de manhã e trabalha de cima pra baixo pelos negócios em Negociação, não pelos que gritam mais alto.
- **Curso/infoproduto:** o dono arrasta o card de "Proposta" pra "Ganho" e o win rate no topo se atualiza. No fim da semana ele olha os três motivos de perda e descobre que 60% caiu por Preço, não por Concorrente. Muda a oferta com base em dado, não em achismo.
- **Assistência técnica:** a Agenda embaixo do CRM recebe as visitas que a Iza marcou. O dono confirma, remarca, dá baixa. A conversa e o compromisso vivem no mesmo lugar.
- **Qualquer PME no fim do mês:** olha a barra de KPIs e responde na hora quanto vale o pipeline (forecast ponderado por estágio), qual o ticket médio, e em quantos dias um lead vira venda.

---

## Diferenciais únicos (contra o mercado brasileiro)

**1. Preenchimento automático de verdade, na origem da conversa.**
Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas: todos oferecem um CRM ou integração com CRM, mas quase todos assumem que **alguém** vai organizar o funil. A ZappIQ inverte: a IA que já está conversando é a mesma que qualifica, pontua, move o negócio e agenda o retorno. O CRM entra limpo porque o dado nasce na conversa, não numa digitação posterior.

**2. Sem a pegadinha dos três custos.**
O mercado esconde três coisas que o cliente odeia: taxa de setup, cobrança por conversa/crédito e fidelidade. Na ZappIQ: **zero setup, mensalidade fixa sem cobrança por conversa, trial de 14 dias sem cartão.** O CRM, os Contatos e as Tarefas fazem parte do plano, não são um módulo caro à parte.

**3. Dado no Brasil, com governança LGPD nativa.**
Consentimento de marketing por contato, requisições LGPD tratadas na própria plataforma, dados processados e armazenados no Brasil, em São Paulo. Não é um selo na apresentação, é campo no banco.

**4. Nasce integrado, não integrado depois.**
Concorrentes vendem "conecte seu CRM". Aqui o CRM já é o mesmo sistema que atende, dispara campanha e mede resultado. Não há sincronização pra dar errado no meio.

---

## Valor de alto impacto

**Três números do "antes" (a dor que o dono vive hoje):**
- Vendedor de PME gasta em média boa parte da semana só organizando e atualizando informação de venda em vez de vender. [confirmar]
- A maioria dos leads que pedem retorno nunca recebem um segundo contato, porque a tarefa não foi criada. [confirmar]
- No fim do mês, o dono não consegue dizer o valor do pipeline aberto nem o principal motivo de perda sem abrir planilha e contar na mão.

**Três números do "depois" (com o CRM que se preenche sozinho):**
- **100% dos contatos criados automaticamente** a partir da conversa, com telefone, status e score, sem digitação manual.
- **Follow-up de intenção de compra criado em segundos** e com prazo de 24h, deduplicado, para nenhum lead quente esfriar no fim de semana.
- **Seis KPIs executivos prontos no topo do funil** (win rate, ticket médio, forecast ponderado, sales velocity, ciclo médio, perdas) mais os **três principais motivos de perda**, atualizados a cada movimento de card.
- Redução estimada de X horas/semana de trabalho administrativo de vendas por vendedor. [confirmar]
- Aumento estimado de Y% na taxa de retorno a leads quentes com o follow-up automático. [confirmar]

> Prova antes de promessa: os números do "depois" que não têm colchete são o que o produto **faz hoje**, verificável na tela. Os de percentual de ganho estão marcados [confirmar] porque dependem de um piloto com cliente real, e a gente não vende número que não mediu.

---

## Como se conecta aos outros produtos (a tese da plataforma completa)

O CRM é o lugar onde o trabalho de toda a plataforma se materializa em dinheiro. Ele não é uma ilha, é o destino de tudo:

- **Conversas (inbox) e Iza:** cada turno de atendimento alimenta o CRM. O contato, o score, o estágio e a tarefa nascem da conversa. É o motor do preenchimento automático.
- **Zap Impulso (campanhas):** o disparo que traz o lead marca a **campanha de origem** no contato, que é herdada pelo negócio. A página de **Atribuição** dentro do CRM fecha o ciclo: mostra o funil de cada campanha (enviados, respostas, contatos, negócios, ganhos) e a receita atribuída. Você vê qual campanha virou venda de verdade.
- **Agenda:** a Iza marca a reunião ou a visita pela conversa e o compromisso aparece na Agenda embaixo do CRM, ligado ao contato.
- **Analytics e Qualidade da IA:** o pipeline vira base para os indicadores de negócio e para o loop de auto-correção medir se a IA está de fato convertendo.
- **Maestro e Treinar IA:** os fluxos e a base de conhecimento definem como a Iza qualifica; o resultado dessa qualificação é o score e o estágio no CRM.

A promessa da plataforma agêntica se prova aqui: **uma operação que atende, qualifica, agenda, faz campanha e mede receita como um sistema só, operando sozinha de ponta a ponta.**

---

## Disponibilidade por plano, add-on e preço

**O CRM, os Contatos e as Tarefas fazem parte de todos os planos.** O que muda é a capacidade:

| Plano | Preço/mês | Contatos no CRM |
|---|---|---|
| **Lite** | R$ 247 | 1.000 |
| **Growth** (mais popular) | R$ 497 | 10.000 |
| **Scale** | R$ 1.497 | 200.000 |
| **Enterprise** | sob consulta | ilimitado |

Anual: **-20%** no Lite, Growth e Scale (no Enterprise o desconto anual é 10%). Sem setup. Sem cobrança por conversa. Trial de 14 dias sem cartão nos planos de autoatendimento (Lite e Growth); Scale e Enterprise são vendas assistidas. (Os planos Starter de R$ 197 e Business de R$ 1.997 foram descontinuados.)

**Add-ons de capacidade do CRM:**
- **Contatos +5.000/mês:** R$ 59
- **Contatos +25.000/mês:** R$ 199 (Growth e Scale)

**Agenda (Agendamento pela IA):**
- **Add-on de R$ 49/mês no Lite; incluído a partir do Growth.**

**Atribuição de receita e observabilidade avançada:**
- A tela de Atribuição campanha para venda já existe no CRM. O **Radar 360** (add-on de R$ 397/mês, incluído no Scale e no Enterprise) adiciona a camada avançada de análise de pipeline e cohort (parte do BI preditivo em beta).

**Integração com CRMs externos** (HubSpot, RD Station, Pipedrive, Salesforce): a partir do **Growth** (API aberta + conjunto de integrações nativas).

**Status honesto do que ainda está amadurecendo:**
- **Atribuição de receita:** o funil e a receita por campanha estão no ar. O custo de aquisição (CAC) hoje usa uma estimativa por mensagem enviada como proxy; a leitura de orçamento real de campanha entra numa próxima onda. Em refinamento.
- **Sincronização com Google Calendar:** a Agenda interna (hub) está no ar. O espelhamento com o Google Calendar está em construção.
- **Ajuste das probabilidades de forecast por estágio:** hoje usa valores padrão de mercado (Novo 10%, Qualificado 25%, Proposta 50%, Negociação 70%); a edição pelo próprio cliente entra em versão futura.
- **Memory Layer (perfil enriquecido do contato):** em rollout.

---

## Sugestão de prova/mini-demo para a landing

**Demo "o CRM se preenche na sua frente" (a mais forte):**
Um GIF/vídeo de tela dividida. À esquerda, uma conversa de WhatsApp rodando: o cliente pergunta preço, a Iza responde, o cliente diz "fechou". À direita, em tempo real, o painel do CRM reagindo: o contato aparece, o score sobe de 5 para 35, o card salta de "Novo" para "Proposta", e uma tarefa "Follow-up: fechar a venda" pisca na lista de Tarefas. Legenda única: **"Ninguém digitou nada. A conversa fez tudo."**

**Prova numérica ao lado:** a barra dos seis KPIs do pipeline (win rate, ticket médio, forecast, sales velocity, ciclo médio, perdas) com o microcopy "Estes números se atualizam sozinhos a cada card que você move."

**Microcopy de reforço:** "Seu vendedor chega de manhã e o dia já está montado: os leads certos, no estágio certo, com a próxima ação definida."

---

## CTA

**Deixe a conversa preencher seu CRM. Comece o trial de 14 dias sem cartão e veja o primeiro lead virar negócio sozinho.**

---

## Business case

Pegue uma operação comum: PME no plano **Growth (R$ 497/mês)**, quatro vendedores, cerca de 400 leads novos por mês entrando pelo WhatsApp e pelo Instagram. O gargalo não é gerar lead, é o que acontece depois que ele chega. Veja a mesma operação antes e depois do CRM que se preenche sozinho.

**Antes (três números que doem):**
- **~8 h por vendedor por semana** gastas abrindo card, digitando nome, lembrando estágio e anotando o que foi conversado. Quatro vendedores: cerca de **128 h/mês** que saíram da venda e foram para a digitação. [ilustrativo, baseado em referência de mercado]
- **De cada 10 leads quentes, cerca de 4 nunca recebem o segundo contato**, porque a tarefa de retorno nunca foi criada. Sobre 400 leads/mês, isso é uma pilha de negócio quente esfriando no fim de semana. [ilustrativo]
- **Fechamento do mês no escuro:** o dono não diz o valor do pipeline aberto nem o principal motivo de perda sem montar planilha na mão. Forecast por achismo.

**Depois (três números que o produto entrega):**
- **100% dos contatos criados automaticamente**, com telefone, status e lead score, zero minuto de digitação. As ~128 h/mês voltam para o único trabalho que fecha venda: falar com cliente.
- **Follow-up de intenção de compra criado em segundos, prazo de 24 h e deduplicado.** Os ~4 em 10 leads que esfriavam agora entram na fila de retorno no automático. Com a Iza resolvendo cerca de **65% do atendimento sozinha** [ilustrativo] e um funil bem trabalhado rendendo **+30% de conversão** [ilustrativo], o mesmo volume de leads passa a produzir mais fechamento sem contratar mais gente.
- **Seis KPIs executivos prontos no topo do funil** (win rate, ticket médio, forecast ponderado, sales velocity, ciclo médio, perdas) mais os três principais motivos de perda, atualizados a cada card movido. O fechamento do mês vira uma olhada na barra, não um serão de planilha.

**A conta do payback, sem inflar:** a mensalidade é **R$ 497**. Basta o time recuperar os leads que antes esfriavam e fechar **um a dois negócios extras por mês** para o plano se pagar folgado. Uma operação com ticket médio de R$ 800 cobre a mensalidade com o primeiro negócio recuperado; o resto do mês é margem. Somando a capacidade devolvida (as ~128 h/mês que saíram da digitação) com os negócios recuperados, o **payback fica em torno de 90 dias** [ilustrativo, modelado na calculadora de ROI]. Nada aqui depende de crédito por conversa nem de taxa de setup: o CRM, os Contatos e as Tarefas já estão no plano.

> Os números sem colchete (100% de preenchimento automático, follow-up em segundos, seis KPIs) são o que o produto faz hoje, verificável na tela. Os marcados [ilustrativo] são modelados a partir da calculadora de ROI e de referências de mercado, e só viram promessa depois de medidos no piloto do cliente.

---

## Exemplo de aplicabilidade: distribuidora / atacado B2B (pipeline de pedidos recorrentes)

**O negócio:** a **Distribuidora Vale Verde**, atacado de produtos de limpeza, descartáveis e higiene, atende cerca de **800 pontos de venda ativos** (mercadinhos, padarias, bares, lanchonetes e restaurantes) numa região metropolitana. Seis representantes na rua e no WhatsApp, faturamento na casa dos R$ 2 milhões/mês. O negócio vive de recompra: o mesmo cliente que pede detergente e copo descartável toda semana é o que sustenta a receita.

**A dor:** os pedidos entram todos por WhatsApp, cada representante com seu caderninho e sua memória. O cliente que comprava toda terça-feira some, e ninguém percebe até a receita do mês cair. Não existe visão de quem parou de comprar, o follow-up de reposição depende de o representante lembrar, e quando um representante sai da empresa, a carteira dele vai junto na cabeça dele. O dono sente que perde recompra, mas não consegue apontar onde.

**O produto agindo na operação, passo a passo:**
1. **Contato limpo na origem.** Todo pedido e toda dúvida que chega no WhatsApp vira contato no CRM automaticamente, com telefone, o ponto de venda, tags (segmento, rota) e a data da última interação. A Iza atende, confirma preço e disponibilidade e registra tudo na linha do tempo. Nenhum representante digita cadastro.
2. **Pedido de reposição vira negócio no funil.** Quando o cliente sinaliza "quero repor o de sempre", a plataforma qualifica, garante um negócio aberto para aquele PDV no estágio **Proposta** e cria uma **tarefa de follow-up de 24 h** amarrada ao contato e ao pedido, deduplicada. O representante abre o pipeline de manhã e trabalha de cima para baixo pelos pedidos em Negociação.
3. **Cliente que ficou quieto reaparece.** Em **Contatos**, o representante filtra a carteira pela **data da última interação** e enxerga na hora quais PDVs que compravam toda semana estão em silêncio há dez, quinze dias. A **Agenda** embaixo do CRM recebe as visitas que a Iza marcou, e o representante confirma, remarca ou dá baixa no mesmo lugar.
4. **Campanha de reposição que se mede.** Pelo **Zap Impulso**, a Vale Verde dispara para a carteira uma campanha de recompra da semana. A **campanha de origem** fica marcada no contato e é herdada pelo negócio; a tela de **Atribuição** dentro do CRM mostra quantos PDVs responderam, quantos viraram pedido e a receita gerada por aquela campanha. O dono vê qual disparo virou faturamento de verdade.
5. **Fechamento do mês na barra de KPIs.** Valor de pipeline aberto, ticket médio por rota, sales velocity e os três motivos de perda ficam no topo do funil, atualizados a cada card movido. Se o motivo de perda número um for "ruptura de estoque", o dono ataca a compra, não o discurso do vendedor.

**O desfecho mensurável (ilustrativo, a confirmar no piloto):** com a carteira inteira visível e o follow-up de reposição rodando sozinho, a Vale Verde recupera os PDVs silenciosos que antes vazavam sem aviso. Modelando os números do produto: **+30% de conversão** [ilustrativo] nos pedidos de recompra bem trabalhados, a Iza absorvendo cerca de **65% do atendimento de rotina** [ilustrativo] para os seis representantes visitarem mais e digitarem menos, e o **payback em torno de 90 dias** [ilustrativo] só com a recompra retida. E a carteira deixa de morar na cabeça do representante: quando alguém sai, o histórico, o funil e a próxima ação continuam no CRM.

**Por que isso é a plataforma, não um CRM avulso:** neste cenário, **Conversas e Iza** enchem o CRM a cada pedido; **Tarefas** garante que nenhuma reposição fique sem retorno; a **Agenda** organiza as visitas de rota; o **Zap Impulso** traz a recompra e a **Atribuição** prova qual campanha faturou; **Analytics** e o **Radar 360** leem o pipeline por rota e por cohort de PDV. É a mesma operação atendendo, qualificando, agendando, disparando campanha e medindo receita como um sistema só, no lugar onde o distribuidor mais sangra dinheiro: a recompra que ninguém acompanhava.
