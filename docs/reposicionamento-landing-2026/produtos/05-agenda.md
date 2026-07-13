# Agenda (agendamento pela IA)

> Dossiê de produto para reposicionamento. Fonte: implementação real em `apps/api` (scheduling) e `apps/web/app/(dashboard)/crm/agenda`. Status marcado honestamente por recurso.

---

## Nome no Dashboard

**Agenda** (dentro do menu **CRM**). O recurso que a alimenta chama-se **Agendamento pela IA**, configurado em **Treinar IA → Agendamento**. Agente padrão: **Iza** (o cliente renomeia).

## Tagline

**A sua IA marca o horário na conversa, no domingo às 22h, sem oferecer um slot que não existe.**

## Categoria

Recurso de agendamento autônomo da plataforma. Incluído do **Growth** para cima, add-on de **R$ 49/mês** no **Lite**. Não é um "calendário" a mais para você preencher: é a Iza fechando o compromisso dentro do atendimento e escrevendo na sua agenda.

## Status honesto (por recurso)

| Recurso | Status |
|---|---|
| Agenda interna (hub) em `/crm/agenda`: lista por dia, confirmar, remarcar, no-show, concluir | **Disponível** |
| Configuração de tipos de agendamento (regras, janelas, campos, política) | **Disponível** |
| Iza marca o horário na conversa (`check_availability` + `create_appointment`) | **Disponível** |
| Trava anti-alucinação: a IA só oferece horário real e livre, e revalida antes de gravar | **Disponível** |
| Sincronização com Google Calendar (free/busy + espelho do evento + remoção ao cancelar) | **Em breve (Fase 2).** `[confirmar]` Hoje a agenda interna é a fonte da verdade; o cruzamento com o Google chega na Fase 2, self-service por conta |
| A Iza **remarcar/cancelar** dentro da conversa | **Em breve.** Hoje a IA marca; remarcar e cancelar são um clique do dono no hub |
| Lembretes automáticos "X min antes" (disparo agendado) | **Em breve.** A regra já é configurável e a Iza comunica a política ao cliente; o disparo automático do lembrete ainda não roda |

---

## O problema concreto do dono de PME

Quem vive de agenda, clínica de estética, consultório, salão, oficina, imobiliária, contador, personal, perde dinheiro de três jeitos ao mesmo tempo, e nenhum deles aparece no extrato com o nome certo:

1. **O lead esfria no vai e volta.** O cliente pergunta "tem horário quinta?" às 21h. A recepção só responde de manhã. O cliente já marcou no concorrente que respondeu na hora.
2. **A recepção vira secretária de calendário.** Metade do dia da sua equipe é conferir agenda, propor três horários, esperar o "pode ser", conferir de novo, remarcar. É trabalho caro que não vende nada.
3. **O buraco do no-show e do horário fantasma.** Ou marcam em cima de outro compromisso, ou o cliente não aparece porque ninguém confirmou. Cada cadeira vazia é uma hora que não volta.

O chatbot comum piora isso: ele "conversa", entende que a pessoa quer marcar e então joga a pessoa para um humano, ou pior, inventa um horário que já estava ocupado. Responder não é resolver. Marcar é resolver.

## O que é

A **Agenda** é a peça que faz a Iza fechar o compromisso, não só falar sobre ele. São duas partes que trabalham juntas:

- **A agenda interna (o hub), fonte da verdade.** Uma tela única em `/crm/agenda` com tudo que está marcado nos próximos 60 dias, agrupado por dia. Cada linha traz horário, tipo, nome e telefone do cliente, e uma etiqueta de origem ("via IA" ou "calendário externo"). Da própria linha o dono confirma, marca como concluído, registra que o cliente não apareceu ou cancela, com um clique.
- **A Iza agendando na conversa.** No meio do atendimento no WhatsApp ou Instagram, a Iza consulta os horários realmente livres, oferece só o que existe, coleta o que o seu negócio pede (nome, e o que você definir) e grava o agendamento na agenda. Sem transferir para humano, sem formulário externo, sem link de "clique aqui para agendar".

## Como funciona (o mecanismo, traduzido em benefício)

Por baixo, o que garante que isso funcione de verdade é uma regra dura contra alucinação. Vale explicar, porque é o diferencial técnico que o cliente sente sem ver.

**1. Você ensina as regras uma vez.** Em Treinar IA → Agendamento, você cria os **tipos** (Consulta, Avaliação, Visita, Ligação) e define para cada um: duração, modalidade (presencial, online, telefone, vídeo), janelas de horário por dia da semana (até quatro faixas por dia), antecedência mínima, folga antes e depois, limite por dia, até quantos dias à frente aceita, se precisa de confirmação humana, e quais perguntas fazer ao cliente. Essas regras viram um documento que entra na base de conhecimento da Iza. Ela lê e obedece.

**2. Na conversa, a IA nunca chuta um horário.** Antes de oferecer qualquer coisa, a Iza chama a ferramenta `check_availability`, que devolve apenas os horários **realmente livres**, calculados na hora a partir das suas regras. O benefício: a Iza nunca oferece um horário que não existe, e nunca promete algo que o seu negócio não pode cumprir.

**3. Ocupado é ocupado.** Hoje o cálculo de "livre" usa a sua agenda interna, que é a fonte da verdade: tudo que a Iza marca e tudo que o dono lança no hub entra na conta. Na Fase 2 (em breve), esse cálculo passa a cruzar também o free/busy do seu Google Calendar, para que um compromisso lançado direto no Google já entre como horário tomado.

**4. Ao fechar, ela revalida.** Quando o cliente escolhe, a Iza chama `create_appointment`, que confere de novo se o horário continua livre (porque outro cliente pode ter pego no meio da conversa) e só então grava. O benefício: dois clientes não conseguem furar a fila para o mesmo slot.

**5. O compromisso vira registro imediato (e, em breve, espelho no Google).** Ao gravar, o agendamento entra na hora na agenda interna, a fonte da verdade, com nome e telefone do cliente e etiqueta de origem. Na Fase 2 (em breve), esse mesmo evento passa a ser espelhado no seu Google Calendar, e cancelar no hub remove o espelho lá também.

## O que o cliente faz na prática (casos reais)

- **Clínica de estética.** A Iza marca uma avaliação pelo WhatsApp às 22h de um sábado. Segunda de manhã a recepcionista abre a Agenda, vê o horário já com nome e telefone da cliente, e confirma com um clique. Ninguém ficou de plantão no fim de semana.
- **Consultório com regra de folga.** Cada consulta tem 40 minutos com 10 de intervalo. A Iza respeita a folga sozinha e nunca encaixa duas seguidas sem respiro, porque a regra de buffer está no tipo.
- **Imobiliária.** A Iza agenda visitas presenciais, pede o bairro de interesse como campo obrigatório, e respeita a antecedência mínima de duas horas para o corretor se deslocar.
- **Serviço que exige triagem.** No tipo "Avaliação", você liga "requer confirmação humana". A Iza marca como pendente, o dono dá o aval no hub, e só então o horário vale. Você mantém o controle onde faz diferença.
- **Dono no controle do que a IA não faz.** Cliente pediu para remarcar? Hoje a Iza registra a intenção na conversa e a remarcação é um clique seu no hub (a remarcação pela própria IA está no roteiro, veja o status acima). O dado nunca se perde: some do calendário só quando você manda.

## Diferenciais únicos

- **Marcar, não "encaminhar".** A maioria dos concorrentes brasileiros (Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas, GPT Maker, Zaia) trata agendamento como um fluxo que coleta dados e joga para um humano ou para um link externo tipo Calendly. Aqui a Iza fecha o compromisso dentro da conversa e escreve na agenda.
- **Trava anti-alucinação de verdade.** A Iza só oferece horário que a ferramenta de disponibilidade retornou, e revalida antes de gravar. Isso não é prompt pedindo "não invente"; é uma trava de código que só deixa passar horário real e livre. Chatbot genérico com IA aberta erra exatamente aqui.
- **Uma fonte da verdade só, e o Google a caminho.** Hoje o cálculo de disponibilidade sai da sua agenda interna, sem você manter planilha nem controle paralelo. Na Fase 2 (em breve), ele passa a cruzar também o free/busy do Google, para você não precisar sincronizar dois calendários na mão.
- **Sem link de terceiro, sem sair da conversa.** Não é a Iza mandando um link de "agende aqui". O cliente já está falando com você; ela resolve ali.
- **A cunha ZappIQ intacta.** Zero setup, mensalidade fixa **sem cobrança por conversa**, dados processados e armazenados no Brasil, em São Paulo, LGPD. O agendamento entra como R$ 49 no Lite ou de graça no Growth, nunca como taxa de implantação.

## Valor de alto impacto (com números para validar)

Três antes e três depois, ancorados no mecanismo. Onde o número precisa de base própria, está marcado.

**Antes (a dor):**
- Uma fatia relevante das perguntas de agendamento chega **fora do horário comercial**, à noite e no fim de semana, quando a recepção não responde. `[confirmar]`
- Cada agendamento manual custa vários minutos de ida e volta da equipe (propor horário, esperar, confirmar, remarcar). `[confirmar]`
- O no-show tira uma fatia direta da agenda cheia quando ninguém confirma. `[confirmar]`

**Depois (com a Agenda):**
- **Marcação em segundos, 24/7.** A Iza fecha o horário no instante da conversa, inclusive de madrugada e no domingo. Meta a medir: parcela dos agendamentos marcados fora do horário comercial. `[confirmar]`
- **Zero duplo-agendamento por desenho.** A revalidação no momento de gravar impede dois clientes no mesmo slot. Isso é uma garantia do mecanismo, não uma estimativa.
- **Menos no-show com confirmação a um clique.** O hub mostra tudo por dia e deixa confirmar/registrar comparecimento na hora. Meta a medir: queda de X pontos no no-show após 60 dias. `[confirmar]`
- **Horas de recepção devolvidas.** A equipe deixa de ser secretária de calendário. Meta a medir: X horas/semana liberadas por atendente. `[confirmar]`

## Integração com o resto da plataforma (a tese da plataforma completa)

A Agenda não é um app isolado; é onde a operação autônoma vira compromisso no seu dia. Ela puxa e empurra dado dos outros produtos:

- **Conversas + Iza.** O agendamento nasce dentro do atendimento. A mesma IA que responde, qualifica e vende é a que marca. Não há passagem de bastão.
- **Treinar IA (RAG).** As regras de cada tipo de agendamento entram na base de conhecimento da Iza como uma fonte própria. Mudou o horário de atendimento? Você edita o tipo e a IA já respeita na próxima conversa.
- **CRM e Contatos.** O agendamento fica preso ao contato e à conversa que o gerou. O compromisso vira histórico do cliente no CRM, não um evento solto.
- **Qualidade da IA.** As decisões de agendamento passam pelo mesmo loop de auditoria da plataforma. Se a Iza ofereceu ou marcou algo torto, isso aparece para revisão.
- **Analytics.** Volume de agendamentos, origem (via IA versus calendário externo) e status (confirmado, no-show, concluído) alimentam a leitura de resultado da operação.
- **Zap Impulso.** Uma campanha de reativação pode desaguar direto em conversas onde a Iza marca o retorno, fechando o ciclo de disparo até a cadeira ocupada.

Essa é a diferença entre uma ferramenta de chat e uma plataforma que opera o negócio de ponta a ponta: o mesmo agente atende, decide e agenda, e cada produto deixa o próximo mais inteligente.

## Disponibilidade, plano e preço

- **Incluído** nos planos **Growth (R$ 497, mais popular)**, **Scale (R$ 1.497)** e **Enterprise (sob consulta)**.
- **Add-on** no **Lite (R$ 247)** por **R$ 49/mês** (`SCHEDULING_AGENT`). Anual com 20% de desconto.
- Sem taxa de setup, sem cobrança por conversa. A implementação assistida, se você quiser que a MACHIA configure os tipos por você, é consultoria, nunca taxa da plataforma.
- **Sincronização com Google Calendar** é da Fase 2 (em breve) `[confirmar]`: cada conta vai autorizar a própria agenda pelo dashboard, self-service, com tokens cifrados. Enquanto isso, a Agenda interna e a marcação pela IA já funcionam por conta própria, sem depender do Google.

## Sugestão de prova / mini-demo para a landing

Um **GIF de conversa lado a lado com a agenda**, sem áudio, em três tempos:

1. **Esquerda, o WhatsApp:** cliente digita "tem horário pra avaliação amanhã à tarde?" às 22h47 (relógio visível). A Iza responde com **três horários reais** e uma linha: "esses são os que estão livres de verdade".
2. O cliente escolhe "15h". A Iza confirma e pede o campo obrigatório ("qual o seu nome completo?").
3. **Direita, a Agenda do dono:** o card aparece na hora, no dia certo, com etiqueta **"via IA"** e status "Aguardando". Um cursor clica em confirmar.

Microcopy embaixo: **"Ela não oferece horário que não existe. Ela confere, marca e escreve na sua agenda."** Botão de reforço: um selo pequeno "sem duplo-agendamento" com tooltip explicando a revalidação.

## CTA

**Deixe a Iza marcar por você. Ative o Agendamento pela IA e comece a lotar a agenda com os horários que ela fecha sozinha, 24 horas por dia.** Incluído no Growth, R$ 49/mês no Lite. Teste 14 dias, sem cartão.

## Business case

O valor da Agenda aparece quando você olha uma operação típica antes e depois. O modelo abaixo usa uma clínica com agenda de cerca de 500 horários por mês e ticket médio de R$ 250. Os números marcados `[ilustrativo]` são modelados a partir do mecanismo do produto e da calculadora de ROI da plataforma (Iza resolve ~65% dos atendimentos, +30% de conversão, payback de ~90 dias); os ganhos marcados "garantia do mecanismo" saem do desenho do produto, não de estimativa.

**Três números antes (a dor):**
- **Tempo de resposta a "tem horário?": de 3 a 12 horas**, e só em horário comercial. Cerca de 40% dos pedidos chegam à noite ou no fim de semana e esfriam antes de a recepção abrir. `[ilustrativo]`
- **No-show de 28%.** Ninguém confirma a véspera, e de vez em quando marcam dois no mesmo horário. `[ilustrativo]`
- **8 horas por semana da recepção** só propondo horário, conferindo agenda e remarcando na mão. `[ilustrativo]`

**Três números depois (com a Agenda):**
- **Marcação em segundos, 24/7.** A Iza fecha o horário dentro da conversa, inclusive às 22h e no domingo, e captura justamente a fatia que antes esfriava.
- **No-show de ~15%.** O hub mostra tudo por dia e confirma a véspera com um clique, e a revalidação no momento de gravar zera o duplo-agendamento (garantia do mecanismo, não estimativa). `[ilustrativo]`
- **2 horas por semana da recepção**, com cerca de 6 horas por atendente devolvidas ao que vende e ao que já está na cadeira. `[ilustrativo]`

**A conta do ROI, sem adjetivo:**
- Numa agenda de 500 horários, cair de 28% para 15% de no-show devolve cerca de **65 horários por mês**. A um ticket de R$ 250, mesmo que só metade vire receita mantida ou reencaixada, são cerca de **R$ 8.000/mês recuperados**. `[ilustrativo]`
- O add-on custa **R$ 49/mês no Lite** (ou já vem incluído do Growth, R$ 497, para cima). **Uma única consulta que deixou de furar paga o mês inteiro do recurso.**
- A marcação imediata 24/7 pega o lead que antes ia para o concorrente que respondeu primeiro. O mecanismo é direto: quem pede horário às 22h sai da conversa já marcado, o que sustenta o +30% de conversão de referência. `[ilustrativo]`
- Com uma cadeira a menos vazia por semana, o payback fica **bem abaixo dos ~90 dias** que a calculadora usa como referência. `[ilustrativo]`

## Exemplo de aplicabilidade: clínica odontológica ou estética (no-show alto)

**O negócio.** O **Studio Renova Estética** fica em Curitiba, tem quatro salas, duas esteticistas e uma biomédica, e roda cerca de 420 agendamentos por mês com ticket médio de R$ 320. A Marina, dona, investe em tráfego pago para protocolos como limpeza de pele, botox e preenchimento. Uma recepcionista dá conta do balcão e do WhatsApp. O problema não é falta de lead: é lead que chega à noite e some, e é a agenda que fura. O no-show histórico do Studio é de 30%, e cada sala vazia é R$ 320 que não voltam.

**A dor, no detalhe.** As DMs de "quanto custa e tem horário essa semana?" caem no Instagram depois das 20h, quando o anúncio roda melhor. A recepção só responde de manhã, e metade desses leads já marcou em outro lugar. Nos que ficam, ninguém confirma a véspera, e vez ou outra dois clientes acabam no mesmo horário. A Marina passou a ligar de véspera para reduzir falta, o que comeu ainda mais tempo do balcão.

**O produto agindo na operação, passo a passo:**
1. **Domingo, 21h40.** Uma lead vê o anúncio de "limpeza de pele profunda" e manda DM no Instagram. A Iza, renomeada **"Bel"** no Studio, responde na hora. Puxa preço e protocolo da base (Treinar IA), entende que a pessoa quer uma avaliação e chama `check_availability`.
2. **Três horários reais, na conversa.** A Bel oferece "terça 15h, quarta 10h ou quinta 17h, são os que estão livres de verdade". A lead escolhe quarta 10h.
3. **Coleta e trava.** A Bel pede nome e telefone e faz a pergunta obrigatória do tipo Avaliação ("é a primeira vez no Studio?"). Como o Studio ligou "requer confirmação humana" nesse tipo, ela grava o card como **"Aguardando"** e revalida o horário antes de fechar, então dois clientes não furam a fila para o mesmo slot.
4. **Segunda de manhã, um clique.** A Marina abre a Agenda, vê o card com etiqueta **"via IA"**, nome e telefone, e confirma. Ninguém ficou de plantão no domingo, e o lead que chegava às 22h não esfriou mais.
5. **Véspera e comparecimento.** A recepção usa a lista por dia do hub para confirmar presença e registrar quem apareceu (o lembrete automático "X min antes" está no roteiro, em breve).
6. **Depois do procedimento.** O compromisso vira histórico do contato no CRM. Seis semanas depois, uma campanha de retorno no Zap Impulso desagua em conversas onde a Bel remarca o retoque, e o ciclo recomeça.

**O desfecho, em números (após 60 dias, `[ilustrativo]`):**
- No-show cai de **30% para ~16%**.
- Cerca de **40% das marcações** passam a acontecer fora do horário comercial, exatamente a fatia que antes esfriava.
- A recepção devolve **~6 horas por semana** ao atendimento presencial.
- Numa agenda de 420 horários a R$ 320, recuperar 14 pontos de no-show devolve cerca de **59 horários por mês**. Mantendo metade, são cerca de **R$ 9.400/mês**. O add-on de R$ 49 (ou o Growth) se paga na primeira semana.

**Como a Agenda puxa o resto da plataforma nesse cenário (a tese da plataforma completa):**
- **Conversas + Iza.** A mesma Bel que responde preço e tira dúvida é a que fecha o horário. Não há passagem de bastão para humano no meio da venda.
- **Treinar IA.** Preços, protocolos e as regras de cada tipo de avaliação vivem na base de conhecimento. Mudou a tabela, a Marina edita o tipo e a Bel já respeita na próxima conversa.
- **CRM e Contatos.** Cada agendamento fica preso ao contato e à conversa que o gerou. O histórico de procedimentos é a base do pós e do retorno, não um evento solto.
- **Zap Impulso.** A campanha de reativação de quem fez botox há seis meses cai em conversa onde a Bel remarca. É disparo levado até a cadeira ocupada, não só até a mensagem enviada.
- **Analytics.** A Marina lê no-show, origem (via IA versus externo) e taxa de comparecimento sem montar planilha.
- **Qualidade da IA.** Se a Bel ofereceu um horário torto ou passou um preço errado, a decisão aparece no loop de auditoria para revisão.

É a diferença entre um chat que responde e uma plataforma que opera a clínica: o mesmo agente atende, informa o preço, agenda, e ainda alimenta o retorno, e cada produto deixa o próximo mais inteligente.
