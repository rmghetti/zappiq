# Treinar IA

### Base de conhecimento (RAG) que ensina a sua IA a responder como a sua empresa responderia

> Selo: A Platform MACHIA Company · Meta Business Partner · Dados no Brasil (São Paulo)
> Agente padrão: Iza (você renomeia)

---

## Tagline

**Sua IA aprende o seu negócio em uma tarde. Sem consultor, sem taxa de setup, sem esperar duas semanas por um projeto.**

Você sobe seus PDFs, cola os links do seu site, responde um questionário guiado e testa a IA na hora. Um medidor de 0 a 100 mostra exatamente quanto falta pra ela ficar pronta pra atender no seu lugar.

---

## Categoria

Fundação de conhecimento da plataforma agêntica. Não é um "editor de chatbot". É o cérebro que a Iza consulta em toda conversa, em todo canal, em todo produto da ZappIQ. Treinou uma vez, treinou pra tudo: atendimento, vendas, campanhas e agendamento passam a falar com a mesma verdade.

---

## Status honesto

**Disponível e no ar (núcleo 100% funcional):**

- Onboarding self-service: Qualificação (survey guiado), Documentos (upload + URL + colar texto), Perguntas & Respostas, Identidade do agente.
- AI Readiness Score de 0 a 100, com breakdown por fonte e checklist de próximas ações.
- Playground "Testar minha IA": conversa real com o mesmo motor do atendimento, antes de conectar o WhatsApp.
- RAG com dados processados e armazenados no Brasil, em São Paulo (infraestrutura no Brasil), embeddings Voyage AI `voyage-3` multilíngue, busca vetorial `pgvector` com isolamento por organização.
- Badge honesto de indexação (verde "indexado" / âmbar "não indexado") e histórico de treinamento auditável.
- Agendamento pela IA disponível dentro do Treinar IA (add-on no Lite, incluído do Growth pra cima).

**Adjacentes, marcados com honestidade (não confundir com o núcleo, que está pronto):**

- Vision inbound (ler imagens que chegam no WhatsApp/Instagram): plano Scale. Hoje a IA acusa o recebimento da imagem; leitura de conteúdo da imagem está em construção. [confirmar rollout]
- Memory Layer (memória de longo prazo por contato, Mem0): em rollout.
- Echo Copilot (sugestão de resposta em tempo real pro atendente humano): flag ligada no Growth+, backend parcial, em beta.

Quando um recurso é "em breve", a gente diz "em breve". O cliente confia mais no produto que assume o próprio "ainda não".

---

## O problema (dono de PME)

Você já viveu isso:

- Testou um "agente de IA" e ele respondeu qualquer coisa. Inventou preço, inventou prazo, mandou o cliente pra um lugar que não existe. Você desligou com medo de queimar a marca.
- Pra "treinar de verdade", te empurraram um projeto de implementação: reunião de escopo, planilha de perguntas, consultor cobrando por hora, duas a quatro semanas até a IA dizer a primeira frase certa.
- Quando enfim funcionou, você não fazia ideia se a IA estava "boa o suficiente" pra soltar no WhatsApp. Não tinha termômetro. Era fé.
- E mudou o preço na semana seguinte. Ou a política de troca. E aí? Abre chamado, espera o consultor, paga de novo.

O conhecimento do seu negócio está espalhado: um PDF de tabela de preço, o FAQ do site, a política de troca na cabeça da sua atendente, o script de vendas num Google Docs. Nenhuma IA responde bem sem isso organizado. E organizar isso, hoje, virou um serviço caro e lento que te deixa refém de terceiro.

---

## O que é

**Treinar IA é a base de conhecimento da sua Iza.** É onde você despeja tudo o que a sua empresa sabe e a IA passa a responder com base nisso, não em suposição.

Quatro fontes alimentam o cérebro, todas self-service, todas com salvamento automático:

1. **Qualificação.** Um questionário guiado sobre o seu negócio: mercado, ofertas, diferenciais, público, objeções comuns, regras de atendimento. É a base mais importante, porque contextualiza tudo.
2. **Documentos e conteúdos.** Suba PDF, TXT, DOCX, planilhas (CSV/XLSX) até 20MB cada; cole uma ou várias URLs do seu site (o crawler lê e vetoriza cada página); ou cole texto direto, pra informação que não está em arquivo nem em link.
3. **Perguntas & Respostas.** Pares de pergunta e resposta que você escreve. É a forma mais direta de garantir a resposta exata nas dúvidas que mais se repetem: horário, pagamento, prazo, garantia.
4. **Identidade do agente.** Nome, tom de voz (amigável, formal, técnico), saudação, mensagem de transbordo e horário de atendimento. Isso é o que faz a IA soar como a sua marca.

E, no topo, o **AI Readiness Score**: um número de 0 a 100 que diz, em tempo real, quão pronta a sua IA está. Cada ação que você faz sobe o medidor na hora. Chegou em 60, a IA está no nível "Pronta". Chegou em 85, "Expert".

Zero taxa de setup. A implementação assistida existe (é consultoria MACHIA, quando você quer mão na massa), mas nunca é uma taxa obrigatória da plataforma. Dá pra fazer sozinho numa tarde.

---

## Como funciona (o mecanismo, traduzido em benefício)

Por baixo, cada coisa que você sobe passa por um pipeline de RAG (busca aumentada por recuperação). Em português de dono de negócio:

- **A IA quebra o seu material em trechos e "entende" o significado de cada um.** Cada documento é fatiado em pedaços de mais ou menos meia página e convertido em vetor semântico pelo Voyage AI (`voyage-3`, multilíngue, forte em português). Tradução: a IA não decora palavra por palavra, ela entende a ideia. Se o cliente pergunta "vocês trocam?" e o seu PDF diz "aceitamos devolução em 7 dias", ela conecta as duas coisas.
- **Na hora da conversa, a IA busca só os trechos certos e responde com base neles.** Quando chega uma pergunta, o sistema faz uma busca por similaridade (`pgvector`, índice HNSW, distância de cosseno) e puxa os pedaços mais relevantes da SUA base. A resposta sai fundamentada no seu conteúdo, com as fontes rastreáveis.
- **O seu conteúdo é seu, e fica isolado.** Cada empresa tem um espaço próprio (namespace `org_<id>`). A busca nunca cruza a base de um cliente com a de outro. E os dados são processados e armazenados no Brasil, em São Paulo, com autenticação por segredo de serviço entre a plataforma e o motor de busca.
- **A sua palavra vale mais que um site aleatório.** O motor faz um re-rank: Perguntas & Respostas que você escreveu pesam 20% mais, e o questionário de qualificação pesa 15% mais, do que um trecho genérico raspado de site. Ou seja, a resposta oficial que você fixou ganha da informação solta. Isso mata alucinação onde mais dói.
- **Reprocessou, substituiu. Sem lixo acumulado.** Ao reenviar um documento, a versão antiga é apagada e a nova entra na mesma transação. A IA nunca fica respondendo com um preço velho porque "sobrou" um pedaço antigo. (Esse era um bug real de acúmulo de versões; hoje é substituição limpa por design.)
- **Você vê o que a IA realmente usa, não o que você só cadastrou.** Cada item tem um selo: verde "indexado" quando existem trechos reais no motor de busca, âmbar "não indexado" quando o conteúdo ainda não chegou à IA. O Readiness Score só conta pontos de documento e Q&A se houver trecho REAL indexado. Nada de medidor de teatro: se está verde, a IA usa; se está âmbar, você sabe que precisa reprocessar.

O resultado prático: a IA para de "achar" e passa a "saber". E você tem prova disso na tela.

---

## O que o cliente faz na prática (casos de uso reais)

- **Loja / e-commerce:** sobe a tabela de preço em PDF, cola a página de trocas e devoluções do site, cadastra Q&A de "vocês entregam no sábado?" e "qual o prazo do Sudeste?". A Iza passa a responder frete, prazo e política com o número certo, 24 horas, sem a dona precisar parar o caixa pra responder no WhatsApp.
- **Clínica / consultório:** questionário de qualificação com convênios aceitos e especialidades, documento com preparos de exame, identidade formal e acolhedora. Some o Agendamento pela IA e a Iza marca a consulta dentro da conversa, conferindo horário livre de verdade.
- **Prestador de serviço (advogado, contador, arquiteto):** cola o conteúdo do site, sobe a proposta padrão, escreve Q&A sobre honorários e forma de trabalho. A IA qualifica o lead, explica o serviço e passa pro humano só o que vale a pena.
- **Franquia / rede com várias unidades:** cada unidade tem sua base isolada, com o mesmo padrão de identidade. Preço mudou numa cidade? Ajusta só ali, entra na hora, sem chamado.
- **Antes de ir ao ar, todo mundo testa:** o dono abre "Testar minha IA", pergunta como um cliente perguntaria ("quanto custa o plano básico?"), lê a resposta e vê quais fontes a IA usou, com o percentual de similaridade. Ajustou o que estava fraco, testou de novo, aí sim conectou o WhatsApp. Ensaio antes da estreia, sem risco de queimar a marca com cliente real.

---

## Diferenciais (contra os concorrentes brasileiros, com nome)

O mercado inteiro (Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas, GPT Maker, Zaia) já diz "temos agentes de IA". A diferença não está no slogan, está em três custos que quase todos escondem e num quarto elemento que ninguém tem:

1. **Zero taxa de setup, treinar você mesmo.** Boa parte do mercado embute onboarding pago ou projeto de implementação pra "treinar o agente". Na ZappIQ, treinar é self-service e grátis: survey, upload, Q&A, teste. Consultoria MACHIA existe quando VOCÊ quer, nunca como pedágio da plataforma.
2. **Mensalidade fixa, sem cobrança por conversa nem por crédito.** Treinar, testar e atender dentro da franquia do seu plano não infla a fatura (acima da franquia há excedente de mensagens e passthroughput de disparo da Meta, sempre publicado). Plataformas que cobram por sessão/conversa/token punem exatamente o uso que você quer estimular. Aqui, o preço é o preço.
3. **Dados no Brasil e conformidade de verdade.** Os dados são processados e armazenados no Brasil, em São Paulo. Seu conteúdo fica isolado por empresa e é apagável na hora (a exclusão de dados da LGPD remove os trechos do índice de busca, não só esconde da tela). Isolamento multi-tenant real, não promessa de marketing.
4. **A cunha que ninguém tem: o loop de auto-correção auditada.** A base de conhecimento não fica parada. Ela conversa com o produto **Qualidade da IA**: quando a Iza erra ou não sabe, isso vira uma lacuna sinalizada pra você preencher com uma nova Q&A ou documento, com registro auditável de tudo que treina a IA. A IA melhora sozinha, sob supervisão, com trilha de auditoria. Chatbot não faz isso. Agente que se corrige, faz.

E um detalhe que os concorrentes não mostram: a **honestidade de indexação**. A gente te fala, na cara, quando um documento NÃO chegou à IA. A maioria das ferramentas deixa você achar que "cadastrou = treinou" e a IA segue burra. Aqui o medidor não mente.

---

## Valor de alto impacto (prova antes de promessa)

**Três números do "antes" (a dor de hoje):**

- Taxa de setup de treinamento no mercado: de centenas a alguns milhares de reais por projeto de implementação. [confirmar faixa por concorrente]
- Tempo até a primeira resposta treinada e correta: de 2 a 4 semanas no modelo de projeto com consultor. [confirmar]
- Perguntas repetitivas que hoje consomem a sua equipe (horário, preço, prazo, troca): boa parte do volume de atendimento é dúvida que já tem resposta pronta. [confirmar % com dado do cliente]

**Três números do "depois" (com a ZappIQ):**

- Taxa de setup: **R$ 0**. Fixo, sem asterisco.
- Tempo até a IA "Pronta": **uma tarde** de self-service leva o Readiness a 60+ (nível Pronta); 85+ é Expert. Cada ação sobe o medidor em tempo real.
- Fidelidade das respostas: Q&A e qualificação entram com prioridade de 15% a 20% sobre conteúdo genérico, então a resposta oficial que você fixou **ganha da alucinação** onde importa. Percentual de conversas resolvidas com fonte própria: [confirmar com métrica do Analytics].

Régua honesta de composição do score (o cliente enxerga isso na tela): Qualificação até 30 pontos, Identidade até 20, Documentos até 25, Q&A até 20, Canal conectado 5. Nada de número mágico: o valor é medido, visível e auditável.

---

## Integração com os outros produtos (a tese da plataforma completa)

Treinar IA é a fundação. Tudo bebe dessa fonte:

- **Conversas + Iza:** o mesmo cérebro que você testa no Playground é o que atende no WhatsApp e no Instagram Direct. Treinou aqui, respondeu lá. Sem "publicar" nem exportar nada.
- **Qualidade da IA:** o loop de auto-correção auditada lê os erros e lacunas do atendimento e devolve pra você, no Treinar IA, o que precisa virar Q&A ou documento novo. A base melhora com o uso.
- **CRM + Contatos:** a qualificação do seu negócio afina como a Iza lê e classifica cada lead. O que a IA aprende do cliente enriquece a ficha no CRM.
- **Agenda (Agendamento pela IA):** as regras de agendamento que você define no Treinar IA viram ações que a Iza executa na conversa, e o compromisso cai direto na Agenda dentro do CRM. O sync com o Google Calendar está em breve (Fase 2).
- **Maestro:** os fluxos visuais podem apoiar em cima da base de conhecimento em vez de exigir que você escreva árvore de decisão pra cada pergunta.
- **Zap Impulso (campanhas):** disparou uma campanha em massa e o cliente respondeu? A mesma IA treinada assume a conversa de volta, com o seu conhecimento, e transforma resposta de campanha em atendimento e venda.
- **Auditoria + Requisições LGPD:** todo treino gera registro no histórico auditável; e um pedido de exclusão de dados apaga os trechos do índice, de ponta a ponta.

A tese: você treina uma vez, e a plataforma inteira passa a operar a sua operação, de forma autônoma, com a mesma verdade em todos os pontos de contato.

---

## Disponibilidade por plano, add-on e preço

Base de conhecimento RAG e todo o Treinar IA (Qualificação, Q&A, Identidade, Playground, Readiness Score, histórico auditável) estão **inclusos em todos os planos**. O que escala por plano é a **capacidade de documentos**:

| Plano | Preço/mês | Documentos na base | Observações |
|---|---|---|---|
| **Lite** | R$ 247 | 10 documentos | Trial 14 dias sem cartão. Agendamento pela IA como add-on (R$ 49). |
| **Growth** (mais popular) | R$ 497 | 50 documentos | Agendamento pela IA incluído. Echo Copilot (beta) ligado. |
| **Scale** | R$ 1.497 | Ilimitado | Vision inbound (em construção). Memory Layer Mem0 (em rollout). |
| **Enterprise** | Sob consulta | Ilimitado | Infra dedicada, SLA contratual, DPO direto. |

Planos anuais Lite, Growth e Scale com 20% de desconto (o Enterprise tem condição própria, negociada à parte). Bandeiras invioláveis: **zero taxa de setup** e **mensalidade fixa sem cobrança por conversa** (dentro da franquia do plano) em todos os planos; **trial de 14 dias sem cartão** no Lite e no Growth (Scale e Enterprise entram por "falar com especialista"). Implementação assistida, quando desejada, é consultoria MACHIA, nunca taxa da plataforma.

Add-on relacionado: **Agendamento pela IA (R$ 49/mês)**, incluído do Growth pra cima; no Lite é opcional.

Planos Starter e Business foram descontinuados e não entram na oferta vigente.

---

## Sugestão de prova / mini-demo pra landing

**Demo interativa "Treine em 60 segundos, veja o medidor subir":**

1. Campo pra colar uma URL (ex.: a página "Sobre" ou "Preços" de um site fictício) ou subir um PDF de exemplo com um clique.
2. Uma animação curta mostra o conteúdo sendo fatiado em trechos e virando pontinhos num "mapa semântico".
3. O **AI Readiness Score** anima de 0 até ~60, com o breakdown preenchendo (Qualificação, Documentos, Q&A, Identidade, Canal).
4. Abre um mini-chat "Testar minha IA": o visitante digita "quanto custa?" e a IA responde com base no conteúdo que "aprendeu", exibindo o chip verde **"Usou seus documentos"** e a fonte com o percentual de similaridade.
5. Microcopy de fechamento: **"Isso levou 60 segundos e R$ 0 de setup. No mercado, isso é um projeto de duas semanas."**

Prova complementar: um antes/depois lado a lado. À esquerda, uma IA genérica inventando preço. À direita, a Iza treinada citando a fonte certa, com o selo de indexação verde. Uma frase: **"A diferença não é a IA. É o que ela sabe do seu negócio."**

---

## CTA

**Comece a treinar sua IA agora, de graça por 14 dias, sem cartão.** Suba o primeiro PDF, veja o medidor subir e converse com a sua Iza antes de conectar o WhatsApp. Setup: R$ 0. Consultor: só se você quiser.

> **Treine uma tarde. Atenda pra sempre.**

---

## Business case

Uma operação de serviço típica, com o WhatsApp como canal principal e uma equipe pequena respondendo dúvida repetida entre uma entrega e outra. O ganho do Treinar IA não é abstrato: é hora de gente devolvida ao trabalho que fatura, mais resposta certa e menos lead perdido por demora. Os números marcados [ilustrativo] vêm da calculadora de ROI da ZappIQ (metas beta, não garantia contratual); os mecanismos são o que produz o resultado.

**Antes (a operação sem base de conhecimento):**

- Tempo médio de primeira resposta no WhatsApp: cerca de 3 horas. A dúvida entra na fila e o cliente espera alguém ter um tempo livre.
- Volume repetitivo: por volta de 70% das mensagens recebidas são as mesmas 15 a 20 perguntas (prazo, valor, quais documentos enviar, onde baixar a guia). Já têm resposta pronta, mas ninguém automatizou.
- Custo escondido: cada pessoa da equipe gasta em torno de 2 horas por dia respondendo o óbvio no WhatsApp. Numa equipe de 4, são aproximadamente 120 horas por mês consumidas em pergunta que se repete.

**Depois (com Treinar IA + Iza atendendo):**

- Resolução na hora: a Iza responde por volta de 65% [ilustrativo] das dúvidas recorrentes sozinha, 24 horas, com a fonte certa (Q&A e qualificação entram com 15% a 20% de prioridade no re-rank, então a resposta oficial ganha do chute). Mecanismo: RAG na sua base, não no achismo.
- Tempo de primeira resposta cai de cerca de 3 horas para segundos nas dúvidas cobertas pela base. Mecanismo: a IA não depende de alguém estar livre.
- Folha recuperada: com 65% das 120 horas/mês devolvidas, são aproximadamente 78 horas/mês de equipe de volta ao serviço que fatura. A um custo cheio conservador de R$ 35 a hora, isso é perto de R$ 2.700 por mês recuperados, contra R$ 497/mês do plano Growth. Some a captação: leads que chegam pelo site respondidos na hora convertem por volta de 30% [ilustrativo] a mais em reunião marcada.

Payback de referência da calculadora: em torno de 90 dias [ilustrativo]. No perfil acima, com horas de equipe recuperadas mais leads que deixam de esfriar, o retorno costuma aparecer já no primeiro ciclo. Nada de número mágico: setup R$ 0, mensalidade fixa, e o AI Readiness Score na tela provando o quanto a IA já sabe antes de você soltar no cliente.

---

## Exemplo de aplicabilidade: escritório de contabilidade

**O negócio.** Prata & Nunes Contabilidade, escritório de médio porte em Campinas, 180 clientes PJ (comércio e serviços), 4 analistas e 2 sócias. O WhatsApp do escritório é o coração da operação e também o gargalo.

**A dor.** Todo começo de mês vira enxurrada: "cadê a guia do Simples?", "qual o prazo pra enviar as notas?", "quanto ficou a folha?", "quais documentos pra admitir funcionário?", "como abro filial?". Os analistas param o fechamento pra responder o básico no celular. Pior: prazo e valor mudam (tabela do Simples, eSocial, obrigação nova), e uma resposta errada no automático vira multa pro cliente e risco pro escritório. Contratar mais gente só pra WhatsApp não escala, e a captação sofre porque quem chega pela página "Troque de contador" espera horas por retorno e desiste.

**O produto agindo na operação, passo a passo:**

1. Uma das sócias abre a aba **Documentos** e sobe o que o escritório já tem escrito: manual de obrigações (PDF), tabela de honorários, calendário fiscal do ano, checklist de documentos por regime. Cola as URLs do site (páginas "Serviços", "Abra sua empresa", "Troque de contador"), e o crawler lê e vetoriza cada página.
2. Preenche a **Qualificação**: regimes atendidos (Simples, Presumido, Real), perfis de cliente, diferenciais e as objeções reais ("meu contador atual cobra menos").
3. Escreve **Perguntas & Respostas** para as 20 dúvidas que mais se repetem: onde baixar a guia, prazo do DAS, documentos de admissão, prazo de envio de notas. Como Q&A pesa mais no re-rank, a Iza dá a resposta oficial do escritório, atualizada, não um trecho solto da internet.
4. Ajusta a **Identidade do agente**: tom técnico e cordial, saudação com o nome do escritório, transbordo pro analista responsável quando a dúvida é específica de um cliente (o valor da folha dele, por exemplo).
5. Abre **Testar minha IA** e pergunta como o cliente perguntaria: "qual o prazo do DAS de janeiro?" e "quais documentos pra admitir funcionário?". Confere que a Iza cita a fonte certa, com o chip verde "usou seus documentos". O Readiness Score bate 72 (nível Expert). Só então conecta o WhatsApp. Ensaio antes da estreia, sem arriscar a marca com cliente real.

**O desfecho mensurável.** A Iza passa a resolver por volta de 65% [ilustrativo] das dúvidas recorrentes na hora, inclusive fora do horário e no fim de semana (prazo fiscal não espera segunda-feira). O tempo de primeira resposta cai de horas para segundos nas dúvidas cobertas, e cerca de 78 horas/mês de analista voltam pro serviço que fatura: fechamento e consultoria tributária. Dúvida específica de um cliente a Iza não chuta: transborda pro analista certo, já com o contexto da conversa.

**Como isso vira plataforma completa dentro do escritório:**

- **Qualidade da IA:** quando entra uma obrigação nova que ninguém cadastrou e a Iza erra ou não sabe, o loop de auto-correção auditada sinaliza a lacuna e devolve pra sócia virar uma Q&A nova. A base acompanha a legislação mudando, com trilha de auditoria.
- **CRM + Contatos:** o lead que chega pela página "Troque de contador" cai no CRM já qualificado pela Iza (porte, regime, dor), e a sócia recebe só o que vale reunião.
- **Agenda (Agendamento pela IA):** a reunião de diagnóstico tributário é marcada dentro da própria conversa, conferindo horário livre da sócia (o sync com o Google Calendar está em breve, Fase 2).
- **Zap Impulso:** a campanha de virada de ano ("planeje 2027, avalie trocar de regime") dispara em massa; quem responde volta pra Iza treinada, que já explica o serviço e agenda a conversa.
- **Auditoria + Requisições LGPD:** cada treino fica registrado, e o dado de cliente (CPF, CNPJ, folha) é apagável de ponta a ponta do índice de busca, não só escondido da tela. Para um escritório que vive de dado sensível, isso é conformidade que se prova.

A leitura pro dono do escritório é direta: atende mais cliente sem contratar mais gente pra WhatsApp, devolve o analista pro serviço técnico e capta com a mesma equipe. Treinou a base uma vez, e atendimento, captação e agenda passaram a falar com a mesma verdade fiscal.
