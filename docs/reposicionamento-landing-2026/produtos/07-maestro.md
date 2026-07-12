# Maestro

**Nome no Dashboard:** Maestro (construtor visual de fluxos)
**Categoria:** Orquestração agentica. É a régua onde você desenha, testa e melhora como a Iza conduz cada conversa de ponta a ponta.
**Status:** Disponível e no ar (motor de produção). Alguns recursos avançados marcados abaixo como beta.

> **Tagline:** Você desenha a jornada, a Iza executa. E o que você testa é exatamente o que o cliente recebe.

---

## O problema concreto do dono de PME

Você já sabe o que a sua melhor atendente faz: recebe o cliente, entende se é orçamento ou suporte, qualifica, agenda, cobra quem sumiu, passa pro vendedor na hora certa. O problema é que isso mora na cabeça dela. Quando ela folga, adoece ou pede demissão, o padrão vai junto.

As duas saídas do mercado são ruins:

1. **Bot de arvorezinha rígida** (o "digite 1 para vendas"). Trava no primeiro cliente que fala fora do script e passa vergonha.
2. **"IA solta"** que responde tudo, mas você não controla nada: ela promete desconto que não existe, esquece de pedir o telefone, não sabe a hora de chamar um humano.

E quando você vai montar isso nas plataformas de sempre, aparece a conta escondida: taxa de setup pra "configurar seu bot", cobrança por conversa que estoura no fim do mês, e contrato de fidelidade. Você paga pra construir e paga de novo cada vez que usa.

O Maestro resolve os três de uma vez: híbrido de controle e IA no mesmo desenho, incluído no plano sem taxa por fluxo, e um botão de testar que roda o motor real, não uma simulação de mentira.

---

## O que é

O Maestro é um construtor visual de fluxos. Um canvas onde você arrasta blocos e liga um no outro pra montar a jornada de atendimento, qualificação, venda, agendamento e pós-venda. Cada bloco é um passo da conversa.

A diferença que sustenta tudo: **o Maestro é híbrido**. Cada passo do fluxo é, por escolha sua, um de dois tipos:

- **Trilho fixo (determinístico):** texto exato, sempre igual, que não passa pela IA. Boas-vindas, confirmação, política, aviso. A IA nunca muda, nunca inventa.
- **Nó-IA (a Iza decide):** onde a conversa é aberta e imprevisível (dúvida, negociação, objeção), você entrega o passo pra Iza. Ela responde com o conhecimento do seu negócio, o mesmo que você treinou em Treinar IA.

No canvas isso fica óbvio pela cor: trilho fixo em azul, nó-IA em violeta, ações de CRM em verde, transbordo humano em âmbar. Você bate o olho e entende onde a máquina tem rédea curta e onde a Iza tem liberdade.

Não é um chatbot com aparência de fluxograma. É a partitura da sua operação, e a Iza é a orquestra que toca ela.

---

## Como funciona (o mecanismo, traduzido em benefício)

**O que você testa é o que a Iza faz.** O botão Testar (e a publicação) rodam o mesmo motor da produção, o `flowEngine`. Não existe um "modo preview" que se comporta diferente do runtime real. Na maioria das plataformas o preview é um mock e você só descobre o bug com o cliente na frente. Aqui, o que passou no teste é literalmente o que vai ao ar.

**O nó-IA não recria conhecimento, ele reaproveita o seu.** Quando o fluxo entrega a conversa pra Iza, ela combina a instrução daquele passo com a base que você já treinou (regras, fatos da empresa e RAG dos seus documentos). Você personaliza a intenção e a voz do passo, não redigita a base inteira. Uma fonte de verdade, muitos fluxos.

**Aditivo e à prova de falha.** Se você não tem fluxo publicado, a Iza roda normalmente como sempre rodou. O Maestro só entra quando você quer. E se qualquer passo der erro, o motor é fail-soft: não derruba a conversa, degrada com elegância.

**Onze tipos de bloco cobrem a operação inteira:**

- **Mensagem** (trilho fixo, texto, imagem, áudio, documento, botões e listas interativas)
- **Perguntar e capturar** (faz a pergunta, valida o formato de e-mail/telefone/número, salva numa variável e grava no CRM)
- **Condição** (bifurca por palavra-chave, sem IA)
- **Nó-IA** (entrega pra Iza com uma instrução do passo)
- **Marcar tag** e **Atualizar lead** (ações que gravam no cadastro, sem enviar nada ao cliente)
- **Humano** (transbordo: entra na fila do time e pausa a IA naquele contato)
- **Aguardar** e **Agendar retomada** (o fluxo dorme e acorda sozinho, em X minutos ou numa data/hora exata, com um ramo "sem resposta" pra follow-up automático)
- **Enviar para outro fluxo** (o especialista passa o bastão pro próximo, sem o cliente perceber a troca)

**Roteamento multi-fluxo, ao vivo.** Você pode ter várias automações ativas ao mesmo tempo. Um roteador determinístico decide qual fluxo começa (palavra-chave exata ganha de aproximada, que ganha de primeiro-contato). E o bloco "enviar para outro fluxo" faz o handoff entre especialistas no mesmo turno, com trava anti-loop. O fluxo de atendimento detecta intenção de compra e passa pro fluxo de vendas, sem fricção.

**Agendamento durável de verdade.** Os blocos de espera e de agendar retomada não seguram a conversa na memória: eles gravam um timer que acorda o fluxo no momento certo, mesmo dias depois. É o que faz o follow-up automático do cliente que sumiu funcionar sozinho.

---

## O que o cliente faz na prática (casos de uso reais)

**1. Pede pra Iza montar o primeiro fluxo (o assistente "monta pra você").** Você escolhe um objetivo (atendimento, qualificação, vendas, agendamento, FAQ ou pós-venda) e a Iza gera um rascunho completo lendo o contexto do seu negócio: seu segmento, nome, tom de voz, horário de funcionamento. A estrutura vem de um blueprint testado; a Iza só preenche o conteúdo e escreve o racional de por que montou daquele jeito. Você revisa e salva. Sai do zero em minutos, não em dias.

**2. Copia um template pronto da sua vertical.** A biblioteca detecta seu segmento pelo cadastro e já mostra as jornadas certas: são 16 verticais mapeadas (dentista, salão, academia, petshop, moda, psicólogo, advogado, nutricionista, imobiliária, restaurante, escola, serviços técnicos, clínica, contabilidade, oficina, agência) em 3 categorias de jornada (boas-vindas e qualificação, agendamento e recuperação, NPS e pós-venda). Cada card mostra a complexidade, o tempo de setup e as métricas esperadas. Um clique copia o template pro seu Maestro como rascunho editável.

**3. Testa antes de publicar, de dois jeitos.** O Testar roda o motor de produção passo a passo. E o Simular joga personas sintéticas contra o fluxo (cliente apressado, cliente desconfiado, cliente decidido), com um juiz de IA avaliando cada resposta e devolvendo um placar do tipo "3 de 3 personas atendidas bem". Você acha o furo no laboratório, não no cliente real.

**4. Coleta e grava dados sozinho.** O bloco de perguntar captura nome, e-mail, telefone, interesse e já grava no cadastro do contato. As tags classificam o lead ("lead-quente", "quer-agendar") e aparecem no CRM. O funil se enriquece sem ninguém digitar.

**5. Recupera quem sumiu.** Enviou a proposta, o cliente não respondeu em 60 minutos? O ramo "sem resposta" dispara o follow-up sozinho. Agendou uma demonstração? O bloco de agendar retomada manda o lembrete na véspera, no horário certo.

**6. Roda experimento A/B de fluxo.** Publica duas versões, define o percentual de divisão e o passo que conta como conversão. O Maestro distribui os contatos de forma estável e determinística e só declara um vencedor com amostra suficiente por variante. Você decide com número, não com achismo.

**7. Deixa a Iza melhorar sozinha (em beta).** O auto-otimizador lê as estatísticas reais de cada passo (quantos entram, quantos abandonam ali), rankeia os nós que mais perdem gente e sugere uma reescrita do texto. Você aplica com um clique. O fluxo fica melhor com o uso.

**8. Enxerga a operação inteira num mapa só.** O Mapa da Operação mostra todos os seus fluxos e como eles se interligam, cada conexão rotulada com a intenção que dispara o salto. Cada fluxo é um card expansível tipo mapa mental: clica e vê a cadeia de passos ali mesmo.

---

## Diferenciais únicos (contra o que existe no Brasil)

- **Híbrido de verdade num canvas só.** Blip, Huggy, Poli, Letalk e Kommo te fazem escolher entre a árvore rígida e a "IA que responde tudo". No Maestro, trilho fixo e nó-IA convivem no mesmo desenho, passo a passo, com o controle visível pela cor. Você tem rédea onde precisa e liberdade onde vale a pena.

- **Testar roda o motor de produção.** Não é um preview decorativo. O `flowEngine` que você testa é o mesmo que atende o cliente. Some a categoria inteira de "funcionou no teste, quebrou ao vivo".

- **Simulação com personas sintéticas antes de publicar.** Um juiz de IA estressa o fluxo com clientes fictícios e te dá um placar. Ninguém no mercado BR de bots oferece um QA automatizado desse tipo dentro do construtor.

- **A/B nativo de fluxos, com corte estatístico.** Comparar duas jornadas e deixar o número decidir não é feature comum nas ferramentas de atendimento por aqui.

- **Auto-otimizador que fecha o loop com o Analytics (em beta).** O Maestro lê o abandono real por passo e sugere a correção. O fluxo não fica parado no dia que você publicou; ele evolui com o uso.

- **A Iza monta pra você a partir do seu contexto.** GPT Maker e Zaia te dão um builder e te deixam sozinho na frente da tela em branco. Aqui a IA lê seu cadastro e sua base treinada e entrega um rascunho pronto pra revisar.

- **Sem a conta escondida.** Zero taxa de setup. Mensalidade fixa, sem cobrança por conversa. O Maestro vem incluído em todos os planos; você sobe de plano só quando quiser rodar mais fluxos ao mesmo tempo. Blip, Zenvia e a maioria cobram setup, crédito por mensagem, ou os dois.

- **Dados processados e armazenados no Brasil, em São Paulo, LGPD e Meta Business Partner.** O que a Iza coleta nos fluxos fica sob a régua de compliance da plataforma, com Requisições LGPD e Auditoria no mesmo Dashboard.

---

## Valor de alto impacto

- **Sai do zero ao primeiro fluxo no ar em minutos**, com a Iza montando a partir do seu contexto e 16 verticais de template prontas. O tempo de "colocar a IA pra trabalhar" cai de semanas de configuração para uma tarde. [confirmar tempo médio real de setup com clientes]
- **Recuperação automática de conversas paradas** (follow-up por timer + ramo "sem resposta") que devolve ao funil leads que hoje se perdem no silêncio. Estime a receita recuperada por [confirmar % de leads reengajados].
- **Menos abandono a cada ciclo**, porque o auto-otimizador lê o dropoff real por passo e sugere a reescrita do nó que mais perde gente. Ganho de conversão por fluxo otimizado: [confirmar com A/B dos clientes].
- **Zero taxa de setup e zero cobrança por conversa**, contra os R$ [confirmar] de setup e o custo por crédito que os concorrentes cobram. A conta do fim do mês é fixa e previsível.

> Números de resultado devem ser preenchidos com dados reais de clientes antes de irem pra landing. Os fatos de produto (motor de produção no teste, 16 verticais, 11 tipos de bloco, simulação com personas, A/B nativo, auto-otimizador) são verificáveis no código hoje.

---

## Como se conecta ao resto da plataforma (a tese da plataforma completa)

O Maestro é a régua de regência; ele só entrega valor porque puxa e alimenta todos os outros produtos:

- **Treinar IA (RAG):** o nó-IA responde com a base de conhecimento que você treinou. Uma fonte de verdade para todos os fluxos e para a Iza livre.
- **Conversas (inbox):** o bloco Humano manda a conversa pra fila do time e pausa a IA. O transbordo é limpo e no ponto certo.
- **Contatos e CRM:** perguntar, marcar tag e atualizar lead gravam direto no cadastro. O fluxo enriquece o funil sem digitação.
- **Agenda (agendamento pela IA):** o objetivo "agendamento" e os blocos de retomada durável marcam horário e mandam o lembrete na hora certa.
- **Analytics:** as estatísticas por passo do fluxo alimentam o auto-otimizador. O que o Analytics mede, o Maestro corrige.
- **Zap Impulso:** as tags que o fluxo aplica viram os públicos das campanhas de disparo. O que a conversa qualifica, a campanha reengaja.
- **Qualidade da IA:** cada resposta de nó-IA passa pelo mesmo loop de auto-correção auditada da plataforma.

É a plataforma agentica completa em ação: uma conversa entra, é roteada, atendida, qualificada, agendada, gravada no CRM, medida e melhorada, sem trocar de ferramenta e sem operação manual no meio.

---

## Disponibilidade por plano, add-on e preço

O Maestro vem incluído em **todos os planos vigentes**, sem taxa de setup e sem cobrança por conversa. O que muda entre os planos é a quantidade de fluxos ativos:

| Plano | Preço | Fluxos no Maestro |
|---|---|---|
| **Lite** | R$ 247/mês | 3 fluxos |
| **Growth** (mais popular) | R$ 497/mês | 15 fluxos |
| **Scale** | R$ 1.497/mês | Fluxos ilimitados |
| **Enterprise** | sob consulta | Fluxos ilimitados |

- **Plano anual:** 20% de desconto nos planos Lite, Growth e Scale (o Enterprise, sob consulta, segue condição comercial própria).
- **Trial:** 14 dias grátis, sem cartão.
- **Mais fluxos ativos?** A capacidade acompanha o plano: o Growth roda 15 fluxos e o Scale libera fluxos ilimitados. Para passar do limite, você sobe de plano, sem taxa por fluxo e sem cobrança por conversa.
- **Add-on que complementa o Maestro:** Agendamento pela IA por **R$ 49/mês** (já incluído a partir do Growth), que liga a marcação de horário e os lembretes acionados pelos blocos de agendamento do fluxo. Os demais add-ons da plataforma seguem a tabela geral e não são necessários para usar o Maestro.
- **Implementação assistida** (quando o cliente quer que a MACHIA monte a operação junto) é consultoria MACHIA, nunca taxa da plataforma.

**Status honesto por recurso:**
- Construtor híbrido, testar no motor de produção, publicar, templates por vertical, "a Iza monta pra você", roteamento multi-fluxo, salto entre fluxos, agendamento durável e estatísticas por nó: **disponíveis e no ar hoje**.
- **Mapa da Operação:** a visualização e a edição do mapa estão no ar; o roteamento ao vivo que "corre pelas conexões desenhadas no mapa" é a próxima onda. Hoje o handoff ao vivo entre fluxos acontece pelo bloco "enviar para outro fluxo" e pelo roteador, que já são de produção.
- **Simulação com personas, experimento A/B e auto-otimização:** recém-chegados, sólidos, marcados como **beta** na comunicação para calibrar expectativa.

---

## Prova / mini-demo sugerida para a landing

Um GIF curto em três telas, com legenda de resultado em cada uma:

1. **"Peça e receba":** o usuário escolhe o objetivo "Agendamento", clica, e a Iza desenha o fluxo inteiro no canvas sozinha. Legenda: "Do zero ao fluxo pronto, montado pela Iza a partir do seu negócio."
2. **"Teste no motor real":** clica em Simular; três personas sintéticas conversam com o fluxo e aparece o placar "3/3 personas atendidas bem". Legenda: "O que você testa é o que o cliente recebe. Sem surpresa ao vivo."
3. **"Melhore sozinho":** o painel de otimização aponta o passo que mais perde gente e sugere a reescrita; um clique aplica. Legenda: "O Maestro lê onde os clientes desistem e corrige."

Microcopy de apoio na seção: **"Trilho fixo onde você precisa de controle. Iza onde vale a liberdade. No mesmo desenho."**

---

## CTA

**Monte seu primeiro fluxo em 14 dias grátis, sem cartão. Escolha um objetivo e deixe a Iza desenhar a jornada por você.**

---

## Business case

O valor do Maestro não é abstrato: ele aparece em três lugares que dão pra medir na sua operação. Primeira resposta que deixa de demorar horas, conversa que a Iza resolve sem tirar gente do time e lead parado que volta pro funil sozinho. Veja uma operação típica de PME, com cerca de 300 leads por mês entrando pelo WhatsApp e pelo Instagram, antes e depois de publicar um fluxo.

**Antes do Maestro (300 leads/mês):**
- Primeira resposta média de 3 horas, e nada fora do horário comercial. O lead que chega às 21h espera até o dia seguinte.
- Conversão de lead em venda ou reunião de 8%, ou seja, 24 fechamentos no mês.
- 45% dos leads ficam sem nenhum follow-up depois do primeiro contato. Quem some, some pra sempre.

**Depois do Maestro:**
- Primeira resposta em menos de 1 minuto, 24 horas por dia, 7 dias por semana. O nó de mensagem responde na hora e o nó-IA assume a dúvida.
- Conversão sobe cerca de 30% [ilustrativo], de 8% para 10,4%, o que leva os 24 fechamentos para aproximadamente 31 (7 vendas a mais por mês) só por responder na hora e qualificar antes de passar pro humano.
- A Iza resolve por volta de 65% das conversas sem acionar o time [ilustrativo], e o ramo "sem resposta" mais o timer de retomada reengajam boa parte dos 45% que antes evaporavam.

**A conta do ROI, sem adjetivo:** o mecanismo é simples. Cada venda extra vem de um lead que hoje você já paga para atrair e perde no silêncio ou na demora. Se o ticket médio for R$ 800, as 7 vendas a mais representam cerca de R$ 5.600 de receita nova por mês, contra R$ 497/mês do plano Growth, sem taxa de setup e sem cobrança por conversa. Nessa modelagem o payback fica em torno de 90 dias [ilustrativo], e ele encurta à medida que o auto-otimizador (em beta) corta o abandono no passo que mais perde gente. O número que importa não é "quanto o Maestro custa", é "quantos leads você já está perdendo antes dele".

---

## Exemplo de aplicabilidade: escola ou curso (educação, funil de matrícula)

**O negócio.** A Escola de Idiomas Travessia tem duas unidades e cerca de 450 alunos ativos. A receita depende de dois picos de matrícula por ano, em janeiro e em julho, quando o volume de interessados no WhatsApp e no Direct do Instagram explode. Uma secretaria de três pessoas dá conta da rotina, mas não da enxurrada da campanha.

**A dor.** No pico, entram 320 leads no mês perguntando as mesmas coisas: quais níveis existem, como é a metodologia, quanto custa, se dá pra fazer uma aula experimental. A secretaria responde quando consegue, em média 4 horas depois, e nada acontece à noite ou no fim de semana, justo quando o pai pesquisa escola. Muita gente marca a aula experimental e não aparece. E o lead que perguntou o valor e sumiu nunca recebe um retorno. O resultado é uma campanha que gasta em anúncio e vaza no meio do funil.

**O Maestro entrando na operação, passo a passo:**
1. A Iza monta o primeiro fluxo a partir do contexto da escola (segmento educação, nome, unidades, horários), sobre o template da vertical "escola", categoria boas-vindas e qualificação. A secretaria revisa e publica no mesmo dia.
2. O fluxo abre com uma mensagem de boas-vindas em trilho fixo (texto exato, sempre igual). Na sequência, o nó-IA responde as dúvidas de níveis, metodologia e valores com a base treinada em Treinar IA, então ninguém inventa preço nem promete desconto que não existe.
3. O bloco de perguntar e capturar coleta nome do interessado, idade do aluno, nível pretendido e melhor horário, valida e grava tudo no CRM, já com as tags "lead-matricula" e "quer-aula-experimental".
4. Quem quer a aula experimental cai num ramo que marca o horário na Agenda e usa o bloco de agendar retomada para mandar o lembrete na véspera, no horário certo. É esse lembrete que derruba o no-show.
5. O lead que recebeu o valor e ficou em silêncio entra no ramo "sem resposta": um timer dispara, 24 horas depois, um follow-up com gancho real (turma começando, vagas da unidade limitadas).
6. Dúvida de bolsa ou negociação especial aciona o bloco Humano: a conversa entra na fila da secretaria em Conversas, com todo o histórico já qualificado, e a IA pausa naquele contato.
7. Antes de publicar, a secretaria roda o Simular com três personas (pai apressado, pai que compara preço, pai decidido) e recebe um placar do tipo "3/3 atendidos bem". O furo aparece no laboratório, não na campanha.

**O desfecho, em número:**
- Primeira resposta cai de 4 horas para menos de 1 minuto, 24/7.
- No-show da aula experimental cai de 35% para cerca de 18%, por causa do lembrete na véspera.
- Conversão de lead em matrícula sobe de 12% para aproximadamente 15,6% (cerca de 30% a mais [ilustrativo]), o que transforma 38 matrículas no pico em torno de 50, ou seja, 12 alunos a mais por campanha. Com a Iza resolvendo perto de 65% das dúvidas sem a secretaria [ilustrativo], as três pessoas do time passam a cuidar só das negociações e das visitas, não do "qual o valor?" repetido. Considerando a mensalidade média e o tempo que o aluno fica na escola, esses 12 alunos extras pagam o plano muitas vezes, com payback em torno de 90 dias [ilustrativo].

**Como isso puxa o resto da plataforma (a tese completa).** O mesmo lead percorre a operação inteira sem trocar de ferramenta: Treinar IA guarda a fonte de verdade de valores e metodologia que o nó-IA usa; o CRM recebe cada matrícula com suas tags; a Agenda marca a aula experimental e o lembrete; Conversas recebe o transbordo pra secretaria; o Analytics mede onde os pais abandonam (quase sempre no passo do valor) e alimenta o auto-otimizador (em beta), que sugere reescrever aquele nó; a Qualidade da IA audita as respostas do nó-IA; e as tags "lead-matricula" que não fecharam viram, no Zap Impulso, o público da campanha de rematrícula do próximo semestre. Uma conversa entra, é atendida, qualificada, agendada, gravada, medida e reaproveitada. O Maestro é a partitura que rege tudo isso.
