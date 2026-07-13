# Voz Nativa

**Add-on de voz da ZappIQ. Uma plataforma MACHIA.**

> A IA que ouve o áudio do seu cliente e, se você quiser, responde falando. Em português do Brasil de verdade, na mesma conversa do WhatsApp.

---

## Tagline

**Seu cliente manda áudio. A Iza entende e responde na hora. Do jeito que o brasileiro conversa.**

Variações para teste de landing:
- "Voz no WhatsApp, sem o sotaque de robô gringo."
- "Ouvir o áudio do cliente já vem de graça. Fazer a IA falar de volta é um clique."

---

## Categoria

Add-on de voz da plataforma agêntica ZappIQ. Duas metades: **inbound** (a Iza escuta o áudio que o cliente manda, incluso em todo plano, custo zero) e **outbound** (a Iza responde falando, em 6 pacotes de minutos). Não é um "recurso de chatbot". É a camada de fala do agente que já atende, vende e agenda pela sua operação.

---

## Status honesto (por recurso)

| Recurso | Status | Observação |
|---|---|---|
| Inbound: cliente manda áudio, Iza transcreve e entende (Whisper pt-BR) | **Disponível, em produção** | Roda no `agentOrchestrator`, entra no mesmo fluxo de texto (RAG, intenção, prompt). Incluso em todos os planos, R$ 0 adicional |
| Outbound: Iza responde em áudio (Google Neural2-C pt-BR) | **Disponível, em produção** | 6 pacotes com Stripe LIVE desde 04/05/2026. Fallback automático para OpenAI se o Google falhar |
| Gatilho "espelho" (cliente mandou áudio, Iza responde em áudio) | **Disponível** | Trigger padrão `mirror_input`. Também aceita modo "sempre falar" ou "nunca falar" |
| Escolha de voz (feminina jovem, feminina madura, masculina) | **Disponível** | 3 vozes Neural2 nativas pt-BR + variantes WaveNet; voz default: feminina jovem |
| Resposta longa cai para texto automaticamente | **Disponível** | Acima de 800 caracteres a Iza avisa e manda por texto, para não virar áudio interminável |
| Trial 14 dias com 30 min grátis (pacotes Voice 200 e 400) | **Disponível** | Pacotes maiores são para quem já sabe o volume |
| Teto de segurança (2x os minutos do pacote) | **Parcial / em construção** | O limite está definido no config; o **corte automático e o alerta de 80% e 100%** ainda estão sendo ligados no medidor por conta. Ver nota abaixo |
| Medidor de minutos em tempo real no painel + upgrade sugerido | **Em construção** ([confirmar]) | A síntese já calcula os minutos de cada resposta; a **contabilização mês a mês por cliente** com barra de consumo e alerta ainda não está no ar. Não vender como "pronto" até validar |
| Liga/desliga self-service num clique no painel | [confirmar] | A configuração existe (`voice_routing`), mas a validação da tela de settings self-service precisa ser confirmada antes de prometer "um clique" |

**Regra de ouro deste dossiê:** o inbound e o outbound funcionam e cobram de verdade hoje. O que ainda não é honesto chamar de pronto é o **painel de consumo em tempo real e o corte automático de quota**. Diga "em breve" onde for "em breve". O cliente confia mais na plataforma que assume o que ainda está chegando.

---

## O problema (dono de PME)

O brasileiro fala mais do que digita. Seu cliente abre o WhatsApp, aperta o microfone e manda 47 segundos de áudio: "oi, vocês fazem exame de sangue em jejum, tem horário amanhã cedo, porque meu médico pediu urgente...".

O que acontece hoje na maioria das PMEs:

- O atendente **para o que está fazendo e ouve o áudio inteiro**, às vezes duas vezes, para não perder detalhe.
- Se está ocupado, o áudio fica **acumulando** na fila. O cliente que gravou às 9h é respondido às 11h, ou no dia seguinte.
- Fora do horário comercial, o áudio simplesmente **não é respondido**. O cliente que decidiu comprar às 22h esfria até de manhã.
- Alguns atendentes respondem "pode digitar, por favor?". O cliente que já estava com preguiça de digitar some.

Do outro lado, quem quer humanizar o atendimento com voz esbarra em ferramenta que fala com **sotaque de robô americano** lendo português, ou em custo de voz que ninguém consegue prever na fatura.

Resultado: áudio de cliente virou gargalo, não canal. E voz de saída virou promessa que assusta na conta.

---

## O que é

**Voz Nativa** é a camada de fala do agente Iza. Ela resolve as duas pontas do áudio no WhatsApp:

1. **Inbound (escutar).** Todo áudio que o cliente manda é transcrito em português por Whisper e entra no mesmo motor que trata mensagem de texto. A Iza entende a intenção, consulta a base de conhecimento (Treinar IA), segue o fluxo (Maestro) e responde. Isso **já vem incluso em qualquer plano, sem custo adicional e sem configuração**. Não existe "voz premium" para o cliente ser ouvido: áudio é cidadão de primeira classe em Lite, Growth ou Scale.

2. **Outbound (falar).** Quando você ativa o add-on, a Iza responde **em áudio**, com voz natural pt-BR do Google (Neural2-C, feminina jovem por padrão, com opções masculina e feminina madura). Vem em 6 pacotes de minutos, de 200 a 4.000 por mês, com preço fixo e excedente transparente por minuto.

A tese é simples: a operação inteira já é conduzida pela Iza. Voz Nativa só decide, turno a turno, se ela usa texto ou fala. Nada muda no cérebro do agente, muda o canal de saída.

---

## Como funciona (o mecanismo, traduzido em benefício)

### Inbound, passo a passo
1. O cliente manda o áudio no seu WhatsApp oficial.
2. A ZappIQ baixa o arquivo direto do CDN da Meta (conexão oficial, sem atravessador) e envia para o **Whisper** com `language=pt`, calibrado para sotaques regionais brasileiros.
3. Em segundos, o áudio vira texto. **No exemplo real da landing, 47 segundos de áudio transcritos em ~1,6s.** O código dimensiona Whisper em torno de 1,5s a 3s para um áudio típico de 30s.
4. A transcrição entra no fluxo padrão: classificação de intenção, RAG da sua base, prompt de venda, ações. A Iza responde com o mesmo contexto que teria se o cliente tivesse digitado.
5. A transcrição fica salva na conversa (marcada como origem áudio), então seu histórico e sua auditoria continuam legíveis.

**Benefício:** ninguém para 3 minutos ouvindo áudio. O cliente das 22h é respondido às 22h. O áudio deixou de ser fila e virou conversa.

### Outbound, passo a passo
1. A Iza gera a resposta em texto, como sempre.
2. Se a voz está ligada e o gatilho bate (por padrão, "o cliente mandou áudio, então responda em áudio"), o texto vai para o **Google Cloud TTS Neural2-C pt-BR**, no formato nativo do WhatsApp (OGG/Opus).
3. A fala sai **8% mais devagar que o padrão** (ritmo 0.92), uma calibração feita a partir de feedback real de usuário: no ritmo cheio, a voz ficava rápida demais para o ouvido brasileiro. Agora soa natural.
4. Se o Google falhar por qualquer motivo, o sistema **cai automaticamente** para o TTS da OpenAI e, se ambos falharem, para texto. O cliente nunca recebe erro, sempre recebe resposta.
5. Respostas acima de 800 caracteres **não viram áudio**: a Iza foi ensinada a dizer "vou te mandar a tabela por texto" em vez de narrar uma planilha inteira. Voz para o que é conversa, texto para o que é lista.

**Benefício:** voz que soa gente, não robô. E um mecanismo à prova de queda: three provedores em cascata para que a conversa nunca trave.

### Por baixo do capô, o que sustenta a margem
- Provedor primário Google Neural2 custa cerca de **US$ 0,0024/min**, contra US$ 0,015/min da OpenAI. É por isso que os pacotes têm preço fixo estável e margem saudável ([confirmar] as margens exatas por pacote em `planConfig.ts`, hoje entre ~70% e ~80%).
- Cada síntese e cada transcrição gera uma linha de auditoria em `llm_call_logs`. Custo separado, não polui o orçamento de chat, e alimenta a Auditoria e o Analytics.

---

## O que o cliente faz na prática (casos de uso reais)

1. **Clínica / laboratório.** Paciente manda áudio perguntando sobre exame em jejum e horário. A Iza transcreve, confirma que faz o exame, oferece "7h30 ou 8h15 amanhã" e agenda. Áudio de reclamação também é entendido na hora, sem atendente parar para ouvir.
2. **Cliente que prefere ouvir, não ler.** Ele pede confirmação por áudio. A Iza responde falando, com voz pt-BR natural. Experiência humana, escala automática, 24 horas.
3. **Atendimento noturno / fora de horário.** Pedido de orçamento às 23h respondido em áudio com acolhimento, sem atendente de plantão. O lead não esfria até de manhã.
4. **Lembrete de consulta, aula ou evento.** A Iza manda um áudio 24h antes. O cliente ouve, reconhece a voz, responde. Lembrete falado tende a ter comparecimento maior que lembrete em texto [confirmar com dado do cliente].
5. **Loja pequena testando voz.** Ativa o Voice 200 no trial, usa 30 minutos grátis por 14 dias, mede o impacto real antes de pagar qualquer coisa.

---

## Diferenciais (contra o mercado brasileiro, nominalmente)

- **Ouvir o cliente é de graça, em qualquer plano.** Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas, GPT Maker e Zaia já dizem "agentes de IA". Quase todos escondem três custos que o dono de PME odeia: **taxa de setup, cobrança por conversa ou por crédito, e fidelidade**. Na ZappIQ, transcrição de áudio inbound é padrão incluso, sem cobrar por áudio ouvido, sem setup, sem contrato de fidelidade.
- **Voz pt-BR nativa, não texto lido com sotaque.** Neural2-C é voz brasileira treinada, com ritmo calibrado para o ouvido daqui (0.92). Não é a voz "gringa" default que lê português como quem lê inglês.
- **Preço fixo com excedente transparente.** Você sabe o teto antes: 200 a 4.000 minutos, R$ 79,90 a R$ 929,90. Passou do pacote, o excedente é publicado por minuto (R$ 0,20 a R$ 0,35, menor quanto maior o pacote). E existe um teto de segurança de 2x os minutos: **você não leva susto de fatura infinita**.
- **À prova de queda.** Cascata Google → OpenAI → texto. Concorrente com um único provedor de voz para de falar quando o provedor cai.
- **Dados no Brasil e uso responsável.** Dados processados e armazenados no Brasil, em São Paulo, com a ZappIQ como Meta Business Partner. A voz **não** pode ser usada para cobrança imitando terceiros, golpe ou deepfake. Violação suspende. Isso protege seu número e seu CNPJ.
- **A cunha da plataforma completa.** A voz não é um app à parte. Ela usa o mesmo cérebro que já vende, agenda e atende. Ninguém no Brasil entrega voz nativa acoplada a um agente que resolve a operação de ponta a ponta com CRM dentro.

---

## Valor de alto impacto (números)

**Três números da mecânica, que estão no código (sólidos):**
1. **~1,6s** para transcrever 47 segundos de áudio no exemplo de referência (Whisper, faixa de 1,5s a 3s para áudio de ~30s). O atendente deixa de gastar o tempo do áudio inteiro ouvindo.
2. **R$ 0,00** de custo adicional para ouvir o cliente: inbound incluso em Lite, Growth e Scale.
3. **~84% mais barato** por minuto no provedor primário de voz (Google Neural2 ~US$ 0,0024/min vs OpenAI ~US$ 0,015/min), o que sustenta preço fixo estável de R$ 79,90 a R$ 929,90 nos 6 pacotes.

**Três números de impacto no negócio (marcar e validar antes de publicar):**
1. **[confirmar] ~70% dos clientes** preferem mandar áudio no WhatsApp (número usado na copy atual, precisa de fonte antes de virar promessa).
2. **[confirmar]** aumento de comparecimento com lembrete em áudio vs lembrete em texto (medir com um cliente piloto).
3. **[confirmar]** minutos de atendente por dia recuperados ao não parar para ouvir áudio (medir na operação real do cliente).

Regra MACHIA: prova antes de promessa. Publique os três primeiros com confiança. Só publique os três de baixo depois de um piloto medido.

---

## Integração com os outros produtos (a tese da plataforma)

Voz Nativa não é ilha. É a camada de fala de um agente que já opera a operação:

- **Conversas (central).** Áudio inbound entra na mesma inbox das mensagens de texto; a resposta em áudio sai pela mesma conversa. Nada de fila separada de "áudios".
- **Treinar IA (base de conhecimento / RAG).** A transcrição consulta a mesma base. A Iza fala com o mesmo conhecimento com que escreve. Você treina uma vez, ela responde certo em texto e em voz.
- **Maestro (fluxos).** O áudio vira texto e segue o fluxo que você desenhou. Voz respeita as regras do fluxo, não fura o roteiro.
- **CRM e Contatos.** A transcrição fica registrada no contato, com histórico auditável. O que foi dito em áudio não se perde.
- **Agenda (agendamento pela IA).** Lembrete de consulta por áudio, confirmação por áudio. Voz e agendamento tocam a mesma agenda.
- **Qualidade da IA e Auditoria.** Cada transcrição e cada síntese vira linha auditável em `llm_call_logs`. A operação inteira é rastreável.
- **Analytics.** Custo e consumo de voz alimentam o painel de custo agregado (o **medidor por conta em tempo real ainda está sendo ligado**, ver status).
- **Zap Impulso (campanhas).** Broadcast por voz é possível, mas exige aprovação prévia da ZappIQ para não violar política da Meta. A plataforma protege seu número por padrão.

Uma assinatura, um cérebro, um histórico. A voz é só mais um canal desse mesmo agente.

---

## Disponibilidade, planos e preço

**Inbound (ouvir o cliente):** incluso em **todos os planos** (Lite R$ 247, Growth R$ 497, Scale R$ 1.497, Enterprise sob consulta). R$ 0 adicional. Sem setup. Sem cobrança por áudio.

**Outbound (a Iza fala):** add-on opcional, 6 pacotes mensais:

| Pacote | Minutos/mês | Preço | Excedente/min | Trial 14d | Ideal para |
|---|---|---|---|---|---|
| Voice 200 | 200 | R$ 79,90 | R$ 0,35 | 30 min grátis | Começar / validar voz |
| Voice 400 | 400 | R$ 137,90 | R$ 0,30 | 30 min grátis | Operação ativa (mais escolhido) |
| Voice 600 | 600 | R$ 184,90 | R$ 0,28 | n/d | Escala média |
| Voice 800 | 800 | R$ 224,90 | R$ 0,25 | n/d | Volume alto recorrente |
| Voice 1.500 | 1.500 | R$ 379,90 | R$ 0,22 | n/d | Multi-canais / multi-unidades |
| Voice 4.000 | 4.000 | R$ 929,90 | R$ 0,20 | n/d | Enterprise / franquias |

- Troca de pacote a qualquer momento, sem fidelidade.
- Minutos não acumulam para o mês seguinte (padrão de TTS, o custo do provedor é fixo por mês).
- Teto de segurança de 2x os minutos do pacote (acima disso vira conversa Enterprise, sem cobrança automática infinita). **Nota honesta: o corte e o alerta automáticos por conta ainda estão sendo ligados no medidor.**
- Plano Enterprise: voz outbound entra na negociação sob consulta.
- Os 6 pacotes ficam disponíveis a partir do plano Lite e acompanham o cliente conforme ele sobe para Growth, Scale ou Enterprise. Pacotes menores (200 e 400) tendem a servir quem está começando; pacotes maiores, quem já tem volume de áudio recorrente.

Bandeiras da casa que valem aqui também: **zero setup fee, mensalidade fixa, sem cobrança por conversa, trial de 14 dias sem cartão**. Implementação assistida, quando houver, é consultoria MACHIA, nunca taxa da plataforma.

---

## Sugestão de prova / mini-demo para a landing

- **Player "ouça a Iza"** com 3 botões de voz (feminina jovem, feminina madura, masculina), cada um tocando a mesma frase pt-BR. O visitante ouve a diferença entre "voz nativa" e "texto lido com sotaque". Este é o momento de conversão do outbound.
- **Simulação de transcrição** com o exemplo real: balão de áudio de 47s do cliente, e abaixo, aparecendo em ~1,6s, o texto transcrito e a resposta da Iza. Mostra o inbound sem custo.
- **Calculadora de pacote:** "quantos áudios por dia você responde?" retorna o pacote sugerido e o custo fixo. Ancorada na regra "1 minuto ≈ 1 áudio de ~30s respondido".
- **Selo de honestidade:** um quadro pequeno "sem setup, sem cobrança por conversa, sem fidelidade" ao lado do preço, batendo de frente com o padrão do mercado.

Microcopy sugerida para o herói: **"Seu cliente aperta o microfone. A Iza entende. E, se você quiser, responde falando."**

---

## CTA

**Ative Voz Nativa em menos de 24h.** Ouvir o cliente já está ligado no seu plano. Fazer a Iza falar é ligar o add-on no checkout ou no painel, com 14 dias grátis e 30 minutos para testar antes de pagar. Sem setup, sem fidelidade.

> **Comece o trial de 14 dias** ou **ouça a demo das vozes** agora.

---

## Business case

O valor da Voz Nativa aparece quando você olha uma operação que vive de áudio de cliente, antes e depois. O modelo abaixo usa um negócio que recebe cerca de **600 áudios de cliente por mês** (algo como 25 a 30 por dia útil), com uma pessoa no balcão que também cuida do WhatsApp. Os números marcados `[ilustrativo]` são modelados a partir do mecanismo do produto e da calculadora de ROI da plataforma (Iza resolve ~65% dos atendimentos, +30% de conversão, payback de ~90 dias); os ganhos marcados "garantia do mecanismo" saem do desenho do produto, não de estimativa.

**Três números antes (a dor):**
- **Tempo de resposta ao áudio: de 1h a 4h no horário de pico, e zero fora do expediente.** Quando o balcão está cheio, o áudio fica na fila e o cliente espera. `[ilustrativo]`
- **Cerca de 35 minutos por dia do atendente parados só ouvindo áudio.** Com ~30 áudios de ~50s por dia, muitos ouvidos duas vezes para não perder detalhe, isso soma perto de **12 horas por mês** que ninguém está atendendo o balcão. `[ilustrativo]`
- **~25% dos áudios chegam à noite ou no fim de semana e ficam sem resposta** até o próximo expediente. É a fatia mais quente, quem mandou áudio às 22h já decidiu resolver, e é justo a que esfria. `[ilustrativo]`

**Três números depois (com a Voz Nativa):**
- **Transcrição em ~1,6s e resposta na hora, 24/7.** O áudio das 22h é atendido às 22h. O atendente lê a transcrição em segundos em vez de ouvir 50s duas vezes (garantia do mecanismo: o inbound roda no `agentOrchestrator` sempre, incluso em qualquer plano).
- **~12 horas por mês do atendente devolvidas** ao balcão e ao que fecha venda, porque parar para ouvir áudio deixou de existir. `[ilustrativo]`
- **R$ 0 para ouvir o cliente.** Falar de volta, com voz pt-BR nativa, começa em **R$ 79,90 no Voice 200**, com 30 minutos grátis no trial de 14 dias para medir antes de pagar.

**A conta do ROI, sem adjetivo:**
- Recuperar ~12 horas/mês de atendente a um custo carregado de ~R$ 12/h dá cerca de **R$ 145/mês** só de tempo, já acima do Voice 200 (R$ 79,90). E tempo é o menor dos ganhos aqui. `[ilustrativo]`
- O ganho grande é o áudio noturno. Se ~25% dos 600 áudios (150 por mês) chegam fora do expediente e metade é intenção de compra, são cerca de **75 leads quentes por mês** que antes ficavam mudos até de manhã e agora recebem resposta no segundo em que gravam. Poucas conversões marginais já pagam o pacote, o que sustenta o +30% de conversão de referência. `[ilustrativo]`
- O preço é previsível de propósito: o provedor primário de voz custa ~84% menos por minuto (Google Neural2 ~US$ 0,0024/min contra ~US$ 0,015/min da OpenAI), e é isso que segura o pacote em preço fixo, de R$ 79,90 a R$ 929,90, sem susto de fatura infinita. Você sabe o teto antes de ligar.
- Com o áudio noturno virando entrada agendada, o payback fica **abaixo dos ~90 dias** que a calculadora usa como referência. `[ilustrativo]`

## Exemplo de aplicabilidade: oficina mecânica ou food/delivery (cliente manda áudio)

**O negócio.** O **Auto Center São Jorge** fica em Contagem, na Grande BH, tem 6 boxes, 4 mecânicos e uma pessoa no balcão, o Rodolfo, que atende quem chega e ainda toca o WhatsApp da oficina. Entra cerca de 500 áudios de cliente por mês, quase sempre gente descrevendo um barulho ou uma pane. O ticket médio de serviço fica em torno de R$ 380. O problema não é falta de cliente: é o áudio que trava o balcão de dia e o áudio que ninguém responde de noite.

**A dor, no detalhe.** O cliente aperta o microfone e manda 50 segundos: "meu Gol tá fazendo um 'tec tec' quando esterço pra esquerda, e ontem acendeu a luz do óleo". O Rodolfo para de atender quem está na frente dele, ouve o áudio, às vezes duas vezes, para entender o sintoma. No fim do dia, junta quase meia hora só ouvindo. Pior é a noite: quem teve pane às 22h manda áudio pedindo guincho e orçamento, não recebe resposta, e de manhã já rebocou pra oficina do concorrente que atendeu no WhatsApp.

**O produto agindo na operação, passo a passo:**
1. **Terça, 9h20, balcão cheio.** Uma cliente manda áudio de 50s descrevendo o "tec tec ao esterçar" e a luz do óleo. A ZappIQ baixa o arquivo direto do CDN da Meta e o Whisper transcreve em ~1,6s. O Rodolfo continua atendendo quem está na frente dele: quem ouviu o áudio foi a Iza.
2. **Diagnóstico preliminar na conversa.** A Iza, renomeada **"Léo"** na oficina, classifica a intenção (sintoma mais pedido de horário), consulta a base (Treinar IA) com os serviços e faixas de preço da casa, reconhece que "tec tec ao esterçar" costuma apontar junta homocinética e explica que precisa de avaliação no box.
3. **Horário real, na hora.** O Léo chama `check_availability` (Agenda) e oferece "amanhã 8h ou 14h, são os horários livres de verdade". A cliente escolhe 14h.
4. **Resposta falando, porque ela mandou áudio.** Como o gatilho é o "espelho" (cliente mandou áudio, então responda em áudio), o Léo confirma o horário em voz pt-BR nativa (Neural2-C, ritmo 0.92), no formato OGG/Opus nativo do WhatsApp. A cliente ouve, reconhece uma voz de gente e responde "fechou".
5. **22h40, pane na estrada.** Outro cliente manda áudio pedindo guincho e um orçamento de reboque. O Léo atende na hora, orienta o que fazer, registra o contato e já deixa a entrada do carro pré-agendada para a manhã. Ninguém ficou de plantão, e o cliente não ligou para o concorrente.
6. **O áudio vira histórico.** A transcrição fica presa ao contato e ao veículo no CRM. Quando o Gol voltar para revisão, o "tec tec" e a troca da junta estão lá, sem depender da memória do Rodolfo.

**O desfecho, em números (após 60 dias, `[ilustrativo]`):**
- Tempo de resposta ao áudio cai de **~2h para segundos**, inclusive fora do expediente.
- Cerca de **30% dos áudios de pane e orçamento que chegavam à noite** viram entrada agendada, em vez de esfriar.
- O Rodolfo devolve **~10 horas por mês** que gastava parando para ouvir áudio.
- De ~500 áudios/mês, recuperar 40 leads noturnos e converter metade em serviço de ~R$ 380 dá cerca de **R$ 7.600/mês**. O Voice 400 (R$ 137,90) mais o plano se pagam no primeiro dia útil.

**Como a Voz Nativa puxa o resto da plataforma nesse cenário (a tese da plataforma completa):**
- **Conversas + Iza.** O áudio entra na mesma inbox das mensagens de texto, e a resposta falada sai pela mesma conversa. Não existe uma fila separada de "áudios" nem passagem de bastão no meio do atendimento.
- **Treinar IA.** Serviços, faixas de preço e os sintomas mais comuns vivem na base de conhecimento. O Léo diagnostica preliminarmente com o mesmo conhecimento em texto e em voz: você ensina uma vez, ele acerta nos dois canais.
- **Maestro.** O áudio vira texto e segue o fluxo desenhado (sintoma, orçamento, agendamento). A voz respeita o roteiro, não fura a regra.
- **Agenda.** A entrada do veículo é marcada dentro da própria conversa, e a confirmação de véspera pode sair também em áudio.
- **CRM e Contatos.** Cada transcrição fica presa ao contato e ao veículo, com histórico auditável de sintomas e serviços. O que o cliente disse em áudio não se perde.
- **Zap Impulso.** Uma campanha de "revisão dos 10 mil km" cai em conversa onde o Léo remarca, e o disparo chega até o box ocupado, não só até a mensagem enviada.
- **Qualidade da IA e Auditoria.** Cada transcrição e cada síntese vira linha auditável em `llm_call_logs`. Se o Léo passou um preço torto ou entendeu o sintoma errado, a decisão aparece no loop de revisão.

É a diferença entre um chat que responde áudio e uma plataforma que opera a oficina: o mesmo agente ouve o barulho, faz o diagnóstico preliminar, agenda a entrada, responde falando e ainda alimenta o retorno, e cada produto deixa o próximo mais inteligente.
