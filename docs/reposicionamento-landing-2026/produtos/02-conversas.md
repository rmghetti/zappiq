# Conversas (central de atendimento)

**ZappIQ, A Platform MACHIA Company** · Meta Business Partner · dados processados e armazenados no Brasil, em São Paulo

> **Tagline:** Um só lugar para o WhatsApp e o Instagram da sua empresa. A Iza atende, sua equipe assume quando quer, e o cliente nunca percebe a troca.

**Categoria:** central de atendimento agêntica (inbox único multicanal com IA e humano operando lado a lado).
**Status:** disponível em produção. Alguns reforços marcados como beta/em breve ao longo do texto, com honestidade.

---

## O problema (o dia do dono de PME)

O atendimento da sua empresa está espalhado. WhatsApp Business num celular na gaveta, Instagram Direct no aparelho de outra pessoa, e ninguém sabe ao certo quem respondeu o quê. Três coisas acontecem toda semana:

1. **Mensagem perdida.** O cliente manda "vocês têm horário amanhã?" às 21h30 e ninguém vê até o dia seguinte de tarde. Ele já comprou no concorrente.
2. **Dois atendentes, uma bagunça.** Você e a recepcionista respondem o mesmo cliente ao mesmo tempo, com informações diferentes.
3. **A conversa some.** O vendedor que atendia sai, leva o número no celular dele, e todo o histórico do cliente vai junto.

E quando você olha as plataformas do mercado, o desconforto é outro: **taxa de setup**, **cobrança por conversa** que vira uma conta que ninguém consegue prever, e **fidelidade** de 12 meses. Você queria organizar o atendimento, não assinar um contrato de celular.

---

## O que é

**Conversas** é a caixa de entrada única da ZappIQ. Todo WhatsApp Business e todo Instagram Direct da sua empresa caem na mesma tela, na ordem em que chegaram, com a Iza (o agente de IA) respondendo na hora e a sua equipe podendo assumir qualquer conversa com um clique.

Não é um chatbot num canto do site. É o lugar onde o atendimento inteiro da empresa acontece: a IA resolve o volume, o humano entra nos momentos que importam, e o contexto de venda de cada contato fica visível ao lado da conversa, sem trocar de aba.

A tela tem três painéis lado a lado:

- **Esquerda:** a lista de todas as conversas, com busca, filtro por status (Abertas, Aguardando, Fechadas) e filtro por canal (WhatsApp ou Instagram). Cada linha mostra o ícone do canal, a última mensagem e o status do lead.
- **Centro:** o bate-papo, no mesmo visual do WhatsApp. Bolha do cliente, bolha da Iza (marcada "Agente IA"), bolha do humano (marcada com o nome de quem respondeu). Confirmação de entrega e leitura nos dois canais.
- **Direita:** o contexto de CRM do contato. Cartão com nome, empresa, status no funil, score de interesse (0 a 100) e etiquetas; a oportunidade de venda aberta; as tarefas pendentes; e a linha do tempo de tudo que já aconteceu com aquele cliente.

---

## Como funciona (o mecanismo, traduzido em benefício)

**Ingestão multicanal por webhook, canal-agnóstica.** Cada mensagem que chega no seu WhatsApp Business (via Meta Cloud API) ou no seu Instagram Direct entra por um webhook assinado (verificação HMAC SHA-256), vira um contato e uma conversa no banco, e é enfileirada para a IA processar. O mesmo motor de IA atende os dois canais, então a experiência é idêntica no WhatsApp e no Instagram. **Benefício:** você conecta os canais uma vez e nunca mais abre o celular da empresa para responder.

**A Iza responde primeiro, com base no seu negócio.** Antes de responder, a IA busca contexto na sua base de conhecimento (RAG) e monta a resposta com a persona certa (comercial para lead, suporte para cliente). Áudio que chega é transcrito automaticamente (Whisper) e respondido como texto. **Benefício:** o cliente é atendido em segundos, 24 horas por dia, com a informação real da sua empresa, não com resposta genérica.

**Transbordo com contexto, dos dois lados.** O handoff da IA para o humano é o coração da central:

- Quando o cliente **pede explicitamente** falar com uma pessoa ("quero falar com um atendente", "prefiro humano"), a IA reconhece a intenção, envia uma mensagem de espera ("vou te conectar com um especialista"), muda o status para **Aguardando** e dispara uma **notificação na hora para a equipe: "Transbordo solicitado"**. A IA pausa sozinha para não falar por cima do humano.
- Quando **você decide entrar**, clica em **Assumir**. A conversa passa a ter o seu nome, a Iza pausa **só naquela conversa**, e um aviso amarelo confirma "IA pausada, em atendimento humano". Se você simplesmente digitar e enviar uma mensagem, a plataforma já assume a conversa e pausa a Iza na mesma operação, de forma atômica: nunca acontece de a IA e você responderem juntos.
- Quando termina, clica em **Retomar Iza** e a IA volta a cuidar daquele cliente.

O estado de pausa tem fonte de verdade durável no banco (`aiPaused`) e um espelho em cache que o motor consulta antes de cada resposta. **Benefício:** a passagem de bastão entre robô e gente é limpa, instantânea e sem colisão. O cliente vê uma conversa só.

**Contexto de venda coladinho na conversa.** O painel da direita não é decoração. Ele puxa, em tempo real, o cartão do contato, a oportunidade aberta no pipeline, as tarefas pendentes e a linha do tempo de atividades (incluindo os resumos que a própria IA escreve da conversa). **Benefício:** quem assume a conversa já sabe quem é o cliente, quanto vale o negócio e o que ficou combinado, sem reler três dias de histórico nem abrir o CRM em outra tela.

**Corrigir e treinar, de onde o erro aconteceu.** Passou o mouse sobre uma resposta da Iza que saiu errada? Aparece o botão "Corrigir e treinar". Você reescreve a resposta certa e ela vira um par de pergunta e resposta permanente na base de conhecimento. Da próxima vez, a Iza acerta. **Benefício:** a IA melhora com o uso do dia a dia, sem você precisar abrir a área técnica de treinamento.

**Governança de origem, não de enfeite.** Toda ação sensível (assumir, encerrar, reabrir, retomar IA, excluir) gera registro de auditoria com base legal LGPD. Conversa nunca é apagada de verdade: vira exclusão reversível com log, e o expurgo real só acontece no prazo de retenção do plano. Notas internas ficam visíveis só para a equipe, nunca para o cliente. **Benefício:** você tem histórico defensável e privacidade de origem, com os dados processados e armazenados no Brasil, em São Paulo.

---

## O que o cliente faz na prática (casos de uso reais)

- **A clínica que abre o dia pela caixa de entrada.** Dono chega, abre Conversas, vê de relance as 25 conversas do dia: quais a Iza já resolveu, quais estão em "Aguardando" pedindo atenção humana. Responde as três que importam direto na tela, sem tocar no celular da recepção.
- **A loja que resolve a reclamação sem ruído.** Cliente reclama de defeito. A dona clica em Assumir, negocia a troca pessoalmente por mensagem, deixa uma nota interna ("aguardando aprovação do gerente para desconto") e depois clica em Retomar Iza para a IA voltar ao atendimento normal daquele contato.
- **A imobiliária que nunca perde o fio.** Um corretor sai da empresa. O histórico não vai embora com ele: fica na conversa, na linha do tempo e no CRM. O novo corretor abre a conversa e retoma exatamente de onde parou, com o resumo da IA "cliente esperando visita ao apartamento da zona sul".
- **O e-commerce que atende WhatsApp e Instagram na mesma fila.** Metade dos pedidos vem por DM do Instagram, metade por WhatsApp. A equipe trabalha numa lista só, com filtro de canal, sem pular de aplicativo.
- **A pizzaria que caça o cliente esquecido.** Fim de noite, o dono filtra por "Aguardando" e acha três pessoas que mandaram mensagem fora do horário. Recupera pedido que teria virado cliente do concorrente.

---

## Diferenciais únicos (e contra quem)

**1. Mensalidade fixa, sem cobrança por conversa.** Blip, Zenvia, Huggy, Poli e Letalk cobram por conversa, por crédito ou por sessão, e a conta do fim do mês é uma surpresa. Na ZappIQ o preço do plano é o preço. Você atende mais e o boleto não sobe. (O que a Meta cobra por conversa de template é repasse transparente, separado do software.)

**2. Zero taxa de setup e sem fidelidade que prende.** O padrão do mercado esconde três custos que o cliente odeia: setup, cobrança por uso e contrato de fidelidade. A ZappIQ tira os três da frente: sem setup fee, mensalidade previsível, e trial de 14 dias sem cartão. A implementação assistida existe, mas é consultoria da MACHIA, nunca taxa da plataforma.

**3. Handoff sem colisão, de verdade.** Em muita plataforma "IA + humano", os dois acabam respondendo o mesmo cliente ao mesmo tempo. Aqui, o envio manual pausa a IA na mesma transação do envio, com trava durável no banco. É engenharia, não promessa: a Iza não fala por cima de você.

**4. Contexto de CRM na própria conversa.** Kommo e RD Conversas têm CRM, mas normalmente em outra tela. Na ZappIQ a oportunidade, o score, as tarefas e a linha do tempo ficam ao lado do bate-papo, atualizando a cada turno da conversa.

**5. Correção que vira treino no mesmo clique.** GPT Maker e Zaia deixam você criar um bot, mas corrigir um erro é ir para a tela de configuração. Aqui você corrige de dentro da conversa e a IA aprende. É o loop de auto-correção auditada da ZappIQ chegando na ponta do atendente.

**6. LGPD e dados no Brasil, por padrão.** Auditoria com base legal em cada ação, exclusão reversível com log, retenção por plano, dados processados e armazenados no Brasil, em São Paulo. Não é um "módulo de compliance" vendido à parte: é como a central foi construída.

**Sobre a categoria:** os líderes globais de IA agêntica pararam de se chamar "chatbot" ou "plataforma conversacional". O verbo virou **resolver**, não **responder**. Conversas é a peça da ZappIQ onde isso vira operação de PME brasileira: a IA resolve o volume, o humano resolve a exceção, e a plataforma inteira (CRM, campanhas, fluxos) opera junto.

---

## Valor de alto impacto

Os números abaixo são metas de referência a validar com a base ativa. Marcados com [confirmar] onde precisam de medição real antes de ir para a landing.

**Antes (a dor, em números):**
- Cerca de **30% das mensagens fora do horário comercial ficam sem resposta** no primeiro contato [confirmar].
- Tempo médio de primeira resposta na PME com atendimento só humano: **de horas a mais de um dia** [confirmar].
- **1 em cada 4 leads** se perde por demora ou por falta de histórico quando um atendente sai [confirmar].

**Depois (com Conversas):**
- **Primeira resposta em segundos, 24 por 7**, com a Iza atendendo antes de qualquer humano acordar.
- **Até 8 em cada 10 dúvidas resolvidas sem intervenção humana** nas operações com base de conhecimento bem alimentada [confirmar].
- **Zero conversa perdida por troca de pessoa:** 100% do histórico e do contexto de venda fica na plataforma, não no celular de quem atendeu.

**Capacidade que já vem no plano (fatos do produto, sem asterisco):**
- **8.000 mensagens de IA por mês** no plano Growth (1.500 no Lite, 80.000 no Scale), com preço fixo.
- **10 atendentes humanos simultâneos** no Growth (1 no Lite, 75 no Scale, ilimitado no Enterprise).
- **Dois canais no mesmo painel** já no plano de entrada: 1 WhatsApp Business + 1 Instagram Direct no Lite.

---

## Como se conecta ao resto da plataforma (a tese da plataforma completa)

Conversas não é uma ilha. É a superfície onde a operação inteira da ZappIQ aparece para o cliente:

- **Contatos e CRM:** cada mensagem cria ou atualiza o contato; o painel lateral mostra o cartão, o score e a oportunidade sem sair da conversa. A conversa alimenta o CRM e o CRM devolve contexto para a conversa.
- **Agenda (agendamento pela IA):** quando o cliente quer marcar, a Iza agenda dentro da própria conversa, e a tarefa aparece no painel lateral.
- **Tarefas:** a IA cria "Follow-up: fechar a venda" sozinha quando percebe intenção de compra, e a tarefa aparece em Próximos passos ali na hora.
- **Treinar IA (base de conhecimento):** o botão "Corrigir e treinar" escreve direto na base RAG que abastece toda resposta da Iza, em qualquer conversa.
- **Qualidade da IA e Auditoria:** cada ação da central gera trilha auditável; o loop de auto-correção puxa dessas conversas para melhorar o agente.
- **Zap Impulso (campanhas):** o disparo em massa vira conversa aqui dentro; a primeira resposta do cliente a uma campanha é atribuída automaticamente, fechando o ciclo de campanha para atendimento para venda.
- **Analytics:** o que acontece em Conversas (volume, resolução por IA, transbordos) vira indicador nos painéis.

Uma central de atendimento sozinha organiza mensagens. Conversas dentro da ZappIQ opera venda: a IA atende, qualifica, agenda, cria a tarefa e passa o bastão para o humano com o negócio já mapeado.

---

## Disponibilidade por plano, add-on e preço

**Incluído em todos os planos ativos** (sem cobrança por conversa, sem setup; trial de 14 dias sem cartão nos planos de autoatendimento Lite e Growth; Scale e Enterprise são vendas assistidas):

| Recurso | Lite (R$ 247) | Growth (R$ 497) | Scale (R$ 1.497) | Enterprise (sob consulta) |
|---|---|---|---|---|
| Inbox multicanal WhatsApp + Instagram | Sim | Sim | Sim | Sim |
| Atendentes humanos simultâneos | 1 | 10 | 75 | Ilimitado |
| Mensagens de IA / mês | 1.500 | 8.000 | 80.000 | Ilimitado |
| Handoff humano ↔ IA (Assumir / Retomar / Nota) | Sim | Sim | Sim | Sim |
| Transbordo automático com notificação | Sim | Sim | Sim | Sim |
| Painel de contexto de CRM na conversa | Sim | Sim | Sim | Sim |
| Corrigir e treinar inline | Sim | Sim | Sim | Sim |
| Áudio inbound transcrito | Sim | Sim | Sim | Sim |
| Auditoria LGPD + exclusão reversível | Sim | Sim | Sim | Sim |

Planos anuais com 20% de desconto no Lite, Growth e Scale (no Enterprise o desconto anual é 10%). Growth é o mais popular. Os planos Starter (R$ 197) e Business (R$ 1.997) foram descontinuados e absorvidos por Lite e Scale.

**Recursos por tier superior:**
- **Echo Copilot (a IA sugere a resposta para o atendente humano em tempo real):** liberado do Growth para cima como recurso do plano. Status honesto: a sugestão em tempo real dentro do inbox ainda está em finalização (backend parcial), portanto tratar como **beta / em breve** na comunicação.
- **Vision inbound (o cliente manda uma foto e a IA entende a imagem):** plano Scale. Status honesto: **hoje a IA reconhece e acusa o recebimento da imagem** e pede o complemento em texto; a leitura completa do conteúdo da imagem está **em construção**.
- **Memory Layer (memória de longo prazo do contato entre conversas):** plano Scale, **em rollout**.

**Add-ons de canal e capacidade (sob o plano):**
- **WhatsApp Business número extra:** R$ 137/mês, com fila independente.
- **Instagram Direct extra:** R$ 97/mês, mesma central.
- **Atendente humano (seat extra):** R$ 79/mês além do limite do plano.
- **Pacotes de mensagens de IA:** de R$ 99 a R$ 749/mês para picos de volume.
- **Contatos adicionais:** +5.000 por R$ 59/mês ou +25.000 por R$ 199/mês.
- **Agendamento pela IA:** R$ 49/mês, incluído do Growth para cima, para a Iza marcar horário dentro da própria conversa.
- **Voz Nativa (a Iza atende e responde por áudio com voz própria):** seis pacotes de R$ 79,90 a R$ 929,90/mês, conforme o volume.

Também disponíveis como add-on da plataforma e integrados à central: **Zap Impulso** (campanhas e disparo em massa: Start R$ 197, Pro R$ 597, Scale R$ 1.297/mês, com trial próprio de 7 dias) e **Radar 360** (monitoramento de menções e reputação: R$ 397/mês).

Bandeiras invioláveis: zero setup, mensalidade fixa sem cobrança por conversa, trial de 14 dias sem cartão. Implementação assistida é consultoria MACHIA, nunca taxa da plataforma.

---

## Sugestão de prova / mini-demo para a landing

**Demo interativa "o bastão passa sem o cliente perceber" (3 painéis animados):**

Mostre a mesma conversa de WhatsApp rodando em loop curto:
1. Cliente pergunta o preço às 22h. Bolha "Agente IA" responde em 2 segundos com a informação real. (Legenda: "A Iza atende sozinha, 24 por 7.")
2. Cliente digita "quero falar com uma pessoa". Aparece o toast **"Transbordo solicitado"** e o status vira **Aguardando**. (Legenda: "A IA reconhece e chama o time, sem falar por cima.")
3. A atendente clica em **Assumir**, o aviso amarelo "IA pausada" aparece, e ela responde com o painel de CRM à direita mostrando score 82 e oportunidade aberta de R$ 4.500. (Legenda: "Quem entra já sabe quem é o cliente e quanto vale o negócio.")

**Microcopy de reforço embaixo da demo:**
> "Sem taxa de setup. Sem cobrança por conversa. Um preço, todas as mensagens. Seus dados processados e armazenados no Brasil, em São Paulo."

**Prova de contraste (tabela curta):** três colunas comparando "Plataforma tradicional" (setup + por conversa + fidelidade) contra "ZappIQ Conversas" (zero setup + mensalidade fixa + 14 dias grátis). O terceiro item de cada linha faz o trabalho de venda sozinho.

Sugestão de número-âncora para o herói da seção, a validar: **"Primeira resposta em segundos. Zero conversa perdida na troca de turno."** [confirmar métricas de base antes de publicar percentuais].

---

## CTA

**Conecte seu WhatsApp e seu Instagram numa tela só. 14 dias grátis, sem cartão, sem taxa de setup.**
Botão: *Começar agora* · Secundário: *Ver a central funcionando* (abre a mini-demo).

---

## Business case

O valor de Conversas não é abstrato: ele aparece na fila de mensagens, na folha e na taxa de conversão. Abaixo, uma operação típica de PME (cerca de 1.500 conversas por mês entre WhatsApp e Instagram, equipe de 2 atendentes) antes e depois de colocar a central para rodar. Os números modelados estão marcados como [ilustrativo]; os números de capacidade são fatos do plano.

**Antes (só atendimento humano):**
- **Primeira resposta de 3 a 20 horas.** Em horário comercial já demora, e fora dele a mensagem espera o dia seguinte.
- **Cerca de 30% das mensagens de fim de noite e de fim de semana ficam sem resposta no primeiro contato** [ilustrativo]. Boa parte desses contatos já comprou no concorrente antes de a equipe acordar.
- **2 atendentes dedicados a WhatsApp e Instagram**, folha aproximada de R$ 6.000 por mês só para não deixar mensagem parada.

**Depois (com Conversas no plano Growth, R$ 497 por mês):**
- **Primeira resposta em segundos, 24 por 7.** A Iza responde antes de qualquer humano, com a informação real da empresa.
- **Perto de zero mensagem sem resposta:** a Iza atende 100% no primeiro toque e só chama gente no que importa.
- **Até 65% do volume resolvido sem humano** [ilustrativo]: 1 atendente passa a cobrir o restante com folga, o que libera cerca de R$ 3.000 por mês de folha [ilustrativo], e a resposta imediata somada ao follow-up automático eleva a conversão em torno de 30% [ilustrativo].

**A conta do ROI, sem adjetivo.** O plano custa R$ 497 por mês. Só a folha liberada, uma posição que deixa de existir para apagar incêndio de mensagem, já paga o plano seis vezes. Some a isso o incremento de receita dos leads que antes se perdiam à noite. O payback modelado fica em torno de 90 dias [ilustrativo], contando a curva de alimentar a base de conhecimento nas primeiras semanas. O mecanismo é direto: a Iza tira o volume repetitivo da frente (mensagens de IA já inclusas no plano, sem cobrança por conversa), o humano vira exceção qualificada, e nenhuma conversa se perde na troca de turno porque o histórico mora na plataforma, não no celular de quem atendeu.

---

## Exemplo de aplicabilidade: clínica multiprofissional de saúde

**O negócio.** A Clínica Reviver Saúde Integrada, em Ribeirão Preto, reúne 8 profissionais em 6 especialidades (fisioterapia, nutrição, psicologia, dermatologia, ortopedia e odontologia). Três recepcionistas dividem o atendimento, e chegam cerca de 1.800 mensagens por mês: metade no WhatsApp Business da clínica, metade no Instagram Direct, que dispara toda vez que sobe um post ou um anúncio de check-up.

**A dor.** O WhatsApp fica num aparelho na recepção, o Instagram no celular de quem cuida do marketing, e ninguém enxerga a fila inteira. Paciente pergunta "vocês atendem meu convênio?" às 20h e só recebe resposta no dia seguinte, quando já ligou para outra clínica. Remarcações chegam por mensagem e se perdem. O no-show ronda 25%: cadeira de especialista vazia é dinheiro que não volta. E quando uma recepcionista sai de férias, o histórico das conversas dela vai junto.

**O produto agindo na operação:**
1. **Conexão única.** A clínica liga o WhatsApp Business e o Instagram Direct na mesma tela de Conversas. A fila passa a ser uma só, com filtro por canal e por status.
2. **A Iza atende primeiro.** Com a base de conhecimento alimentada (convênios aceitos, valores particulares, horários por especialidade, endereço, preparo de exame), a Iza responde em segundos, de madrugada e no fim de semana. Áudio de paciente é transcrito e respondido.
3. **Agendamento dentro da conversa.** Quando o paciente quer marcar, a Iza usa o Agendamento pela IA (incluído no Growth) e fecha o horário sem passar por ninguém. A tarefa aparece no painel lateral.
4. **Transbordo com contexto.** Caso clínico sensível ou negociação de pacote de sessões: o paciente pede uma pessoa, a recepcionista recebe a notificação "Transbordo solicitado", clica em Assumir e já vê, no painel de CRM ao lado, a ficha do paciente, o pacote de 10 sessões em aberto e as tarefas pendentes. Deixa uma nota interna ("aguardando autorização do convênio") que o paciente nunca vê.
5. **Menos no-show.** Uma tarefa de confirmação em D-1 dispara pela própria conversa; quem não confirma entra numa lista de reativação.
6. **Dado de saúde tratado com cuidado.** Cada ação sensível gera trilha de auditoria com base legal LGPD, a conversa não é apagada de verdade (exclusão reversível com log), e pedidos de titular caem em Requisições LGPD. Para uma clínica, isso não é enfeite: é a diferença entre ter e não ter defesa.
7. **Correção que treina.** Entrou um convênio novo? A recepcionista corrige a resposta da Iza de dentro da conversa e, do próximo paciente em diante, a IA já acerta.

**O desfecho, em números** (modelados, marcados [ilustrativo]):
- Primeira resposta de cerca de 4 horas para segundos, 24 por 7.
- No-show de 25% para perto de 12% [ilustrativo], com confirmação automática em D-1.
- Cerca de 65% das mensagens repetitivas (valores, convênio, horário) resolvidas sem recepcionista [ilustrativo]: a equipe volta a olhar o paciente que está na sala de espera.
- Leads de Instagram convertendo em consulta agendada com alta em torno de 30% [ilustrativo], porque a resposta chega na hora do interesse.

**A tese da plataforma completa, dentro da clínica.** Conversas é a porta, mas o ganho vem do conjunto: o **CRM** guarda a ficha e o pacote de sessões de cada paciente; a **Agenda** marca dentro da conversa; **Tarefas** cuida da confirmação em D-1 e do follow-up; o **Zap Impulso** dispara a campanha de check-up e a primeira resposta do paciente já volta como conversa atribuída; **Treinar IA** mantém a base de convênios e procedimentos afinada; **Auditoria** e **Requisições LGPD** dão a proteção que dado de saúde exige; a **Voz Nativa** deixa a Iza responder por áudio o paciente que mandou áudio; e o **Analytics** mostra, no fim do mês, quanto a IA resolveu, quantos transbordos houve e para onde foi o no-show. Uma central sozinha organiza mensagens. Dentro da ZappIQ, ela vira operação clínica: atende, agenda, confirma, reativa e protege o dado, com a recepção livre para o que só gente faz.
