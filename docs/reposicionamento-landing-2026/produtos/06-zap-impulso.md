# Zap Impulso (Campanhas) e Templates

> Dossiê de produto, catálogo ZappIQ. Uma Platform MACHIA Company.
> Fonte: implementação real em `zappiq-main` (campaigns, templates, serviços Impulso, planConfig).

**Tagline:** Pare de esperar o cliente chamar. Diga o objetivo em uma frase e a Iza monta, dispara e acompanha a campanha inteira pela sua base.

**Categoria:** Vendas proativas (outbound) com IA. É o módulo que faz a Iza sair da defesa (atender quem chega) e entrar no ataque (ir buscar venda na base que você já tem).

**Status honesto:** Parcial. A base do produto está no ar e vende hoje (o pacote Start: Iza Estrategista, disparo omnichannel, templates, segmentação, Coach). O loop de receita completo com mídia paga (pacotes Pro e Scale: atribuição fim a fim, Meta/TikTok, auto-otimização e autopiloto) está em evolução. Este dossiê marca item por item o que dispara hoje e o que está por vir.

---

## 1. O problema concreto do dono de PME

O dono de PME investe pesado para o cliente chegar (anúncio, tráfego, indicação), atende bem quando ele chama, e aí para. A base de contatos que ele levou anos para juntar fica parada num CRM, virando número morto. Três dores que se repetem:

1. **A base não trabalha.** Milhares de contatos com quem ele já conversou, e nenhum jeito prático de voltar a falar com eles sem contratar uma agência ou passar a tarde no copia e cola.
2. **Campanha dá trabalho e assusta.** Montar um disparo pede segmentar público, escrever a mensagem, aprovar template na Meta, escolher horário, medir resultado. A maioria trava no primeiro passo e desiste, ou dispara na mão para a lista inteira e toma bloqueio do WhatsApp.
3. **Ninguém sabe se deu dinheiro.** Quando a campanha sai, some. O dono não liga a venda ao disparo que a gerou, não sabe qual oferta funcionou, e no mês seguinte repete no escuro.

O resultado é o pior dos mundos: paga tráfego caro para atrair cliente novo enquanto o cliente antigo, que já custou dinheiro, esfria de graça. No varejo brasileiro o abandono de carrinho gira em torno de 72% `[confirmar]`: cada ponto recuperado é receita que a mídia já pagou e ninguém foi buscar.

---

## 2. O que é o Zap Impulso

O Zap Impulso é o módulo de vendas proativas da ZappIQ. Em vez de só esperar o cliente chamar, a Iza (a IA da plataforma) cria, dispara e acompanha campanhas de ponta a ponta pelos seus canais: WhatsApp, e-mail, SMS e, quando a conta tem Instagram conectado, também o Instagram Direct.

Você descreve o objetivo em uma frase, por exemplo "reativar quem não volta há 60 dias com 15% no primeiro horário", e a Iza monta a campanha inteira: público segmentado a partir da sua base, mensagem na voz da sua marca, melhor horário, verba sugerida e estimativa de resultado. Você revisa, edita o texto se quiser e aprova. Nada sai sem o seu ok, e nada sai para quem não deu consentimento de marketing.

O **Templates** é o parceiro obrigatório do Impulso: é onde você cadastra e mantém os modelos de mensagem aprovados pela Meta. É o template aprovado que permite falar com o cliente **fora da janela de 24h** (a regra da Meta que trava mensagem livre depois de um dia sem resposta). Sem template aprovado, você só alcança quem falou com você nas últimas 24 horas. Com ele, você alcança a base inteira dentro das regras.

Em uma frase: **o Impulso transforma a sua lista de contatos parada em campanha pronta para aprovar, e os Templates são a chave que abre a porta da Meta para essa campanha chegar.**

---

## 3. Como funciona (o mecanismo, traduzido em benefício)

### 3.1 Iza Estrategista: objetivo em linguagem natural vira campanha completa `[disponível]`

Você escreve o que quer em português comum. A Iza (via o roteador de modelos da ZappIQ, com auditoria por conta) devolve uma campanha estruturada: nome, descrição do público, canais recomendados, a copy pronta para WhatsApp, e-mail e SMS, o melhor horário com justificativa, o plano de verba e uma estimativa de alcance, respostas e vendas. Ela sempre inclui pelo menos o WhatsApp e nunca inventa precisão falsa nas estimativas. O custo de disparo de marketing no WhatsApp entra na conta de forma transparente (referência de ~R$ 0,34 por mensagem).

**Benefício:** a parte que trava o dono (montar a campanha) some. De ideia para rascunho aprovável em segundos, não em uma tarde.

### 3.2 Studio: você edita e aprova `[disponível]`

O rascunho da Iza abre num editor. Você ajusta o texto, troca o horário, mexe no público, e aprova. É assistência, não substituição: a decisão final é sua, sempre.

### 3.3 Disparo omnichannel com piso de LGPD `[disponível]`

Aprovada, a campanha vai para a fila de disparo (BullMQ), que enfileira **uma mensagem por contato**. Antes de qualquer envio, o sistema aplica dois pisos que o front não consegue burlar:

- **Isolamento de conta e consentimento:** o público é sempre filtrado por `consentMarketing = true` e pela sua organização. Um segmento não consegue desligar esse piso. Quem não deu opt-in não recebe, ponto.
- **Canal Instagram gated:** o canal Instagram só entra se a conta tiver o Instagram conectado de fato; caso contrário, a campanha cai para WhatsApp. Regra da Meta respeitada no servidor.

**Benefício:** você dispara em escala sem virar spammer nem correr risco com a LGPD. O piso de consentimento é código, não promessa.

### 3.4 Templates aprovados pela Meta: a chave da janela de 24h `[disponível]`

O motor de envio decide sozinho como mandar cada campanha no WhatsApp:

- Se há um template **aprovado** vinculado, ele envia como template (válido também fora da janela de 24h, para reengajar quem sumiu).
- As variáveis do template (`{{1}}`, `{{2}}`) são resolvidas **por contato** no momento do envio: primeiro nome, nome completo, empresa ou um texto fixo, sempre com um valor de reserva para nunca deixar variável vazia (a Meta rejeita variável vazia).
- Sem template aprovado, cai em texto livre, válido só dentro da janela de 24h.

Na tela de Templates você cria, edita, exclui e **submete o modelo à Meta para aprovação** com um clique, acompanha o status (Aprovado, Em análise, Pendente, Rejeitado), classifica por categoria (Marketing, Utilidade, Autenticação) e marca templates de reengajamento (os que reabrem a janela de 24h).

**Benefício:** o dono para de depender do "só posso responder em 24h". A base inteira vira alcançável, com personalização por contato, dentro das regras da Meta.

### 3.5 Segmentação da base pelo CRM nativo `[disponível]`

O público sai do seu próprio CRM ZappIQ, com uma allowlist de critérios combináveis: tags (tem alguma, tem todas, exclui), status do lead (novo, contatado, qualificado, convertido), estágio no funil, pontuação do lead (faixa mínima e máxima), recência (não interagiu há X dias, ou interagiu nos últimos X dias), tem e-mail, e a campanha de origem do contato. Tudo com um limite opcional de tamanho. Chaves desconhecidas são ignoradas, então um segmento nunca vira um comando arbitrário no banco.

**Benefício:** "quem comprou e sumiu", "VIP que não volta há 2 meses", "lead qualificado que não fechou" viram públicos reais em segundos, sem exportar planilha.

### 3.6 Copiloto e Coach: a IA acompanha os números `[disponível]`

Depois do disparo, a Iza lê os contadores reais da campanha (enviados, entregues, lidos, respostas, falhas) e gera sugestões objetivas, de forma **determinística** (regras explícitas, sem custo de IA por visualização, auditável):

- Taxa de falha alta (10%+): alerta para checar números e a qualidade do WhatsApp Business.
- Taxa de resposta acima de 15%: sinaliza que valeu, sugere repetir horário e oferta.
- Taxa de resposta abaixo de 3% (com volume mínimo de 20 envios): sugere testar outro horário ou ajustar a oferta.
- Alcance abaixo do planejado: orienta ampliar a base com consentimento.

**Benefício:** o dono não precisa interpretar um dashboard. A Iza diz, em linguagem de dono de negócio, o que fazer a seguir.

### 3.7 Loop de Receita: anúncio, conversa, venda, verba `[em evolução, Pro/Scale]`

Aqui está a tese do módulo, e a parte honesta: **a fundação técnica existe e o loop completo está em construção.**

- O código que devolve a **compra** para a Meta (Conversions API, evento `Purchase` de Click-to-WhatsApp, telefone e e-mail com hash SHA-256 como a Meta exige, dedup por id do negócio) já está escrito e testado. Ele fica inerte até a conta configurar o dataset e o token do app Meta, e capturar o `ctwa_clid` do clique do anúncio.
- A cobrança por Pix dentro da conversa (Asaas) também já existe como serviço.
- O que ainda está em evolução é o loop fim a fim rodando sozinho: captura do clique, atribuição automática de cada venda ao anúncio e à conversa, e a mídia passando a mirar quem **compra**, não quem só clica. Na tela, a métrica "Receita atribuída" hoje mostra R$ 0 com a nota "conecte anúncios para medir", e os pilares "Loop de Performance" e "Auto-otimização" estão marcados como "Em breve".

**Benefício (quando fechar):** o dono para de otimizar anúncio no palpite. Cada real de mídia é medido pela venda que gerou, e a Iza reforça o que vende.

### 3.8 Autopiloto e mídia avançada `[em evolução, Pro/Scale]`

Descritos e vendidos por perfil de plano, em construção: audiências preditivas por IA (propensão a comprar, churn, LTV) `[confirmar]`, auto-otimização por teste de variações (a Iza concentra a verba na copy que mais vende), TikTok Instant Messaging Ads levando o lead ao WhatsApp, Google Ads com conversões offline (venda na loja física otimizando a mídia), Iza Autopiloto com governança (a IA opera dentro de metas, orçamento e limites que você define) e conector com o CRM do cliente (HubSpot, RD Station, Pipedrive, Salesforce).

---

## 4. O que o cliente faz na prática (casos de uso reais)

- **Salão de beleza reativando clientes (Start).** A dona diz à Iza "reativar quem não volta há 2 meses com 15% no primeiro horário". A Iza monta o segmento pela base, escreve a mensagem, sugere disparar na terça de manhã e envia pelo WhatsApp. No Coach ela vê quantas remarcaram e recebe o próximo passo.
- **E-commerce recuperando carrinho e base fria.** Segmento "comprou uma vez e sumiu há 30 dias", template de reengajamento aprovado para furar a janela de 24h, oferta com Pix estruturado no chat. O que antes exigia remarketing caro vira mensagem certa na hora certa.
- **Pós-venda e aniversário no automático.** Playbooks de 1 clique (reativação, pós-venda, aniversário) para quem não quer nem escrever o objetivo. `[3 playbooks básicos no Start, todos no Pro/Scale]`
- **Infoproduto fechando o loop de anúncio (Pro, em evolução).** Anúncio com botão "Enviar mensagem", lead cai no WhatsApp, a Iza qualifica e conduz a venda; quando a venda entra no CRM, a Conversions API a devolve à Meta, que passa a mirar quem compra. Em paralelo, a Iza testa variações de copy e concentra a verba na melhor.
- **Rede com várias unidades (Scale, em evolução).** Cada loja com seu número, a Iza roda em autopiloto dentro das regras, sobe vendas de loja física (offline) para Meta e Google otimizarem, e consolida a atribuição por canal e por unidade num painel só.

---

## 5. Diferenciais (contra os concorrentes brasileiros)

Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas, GPT Maker e Zaia já dizem "campanhas" e "agentes de IA". A cunha do Zap Impulso é específica:

1. **Objetivo em uma frase, não construtor de campanha.** Nos concorrentes, campanha é um formulário de segmento, template, horário e mídia que o dono monta na mão. No Impulso, a Iza monta o rascunho inteiro e o dono aprova. O construtor manual (Studio) existe, mas é o coadjuvante, não o protagonista.
2. **Custo do WhatsApp transparente, sem markup escondido.** O grande truque do mercado é cobrar "por crédito de campanha" ou "por mensagem" com uma margem embutida que o cliente não enxerga. Aqui o preço do módulo é software; a mensagem de marketing da Meta é repasse transparente (referência ~R$ 0,34/msg, franquia inclusa por tier). O dono vê o que é plataforma e o que é Meta.
3. **Piso de LGPD e da Meta em código.** Consentimento de marketing e isolamento de conta são aplicados no servidor, por último, e um segmento não os desliga. Instagram só dispara com a conta conectada. Não é uma caixinha de "declaro que tenho opt-in": é gate real.
4. **Coach determinístico e auditável.** As recomendações pós-campanha seguem regras explícitas sobre os números reais, não "a IA achou". Barato, instantâneo, testável, e o dono entende o porquê.
5. **Dados processados e armazenados no Brasil, em São Paulo, e Meta Business Partner.** A base e os disparos ficam no Brasil, sob a MACHIA. Relevante para quem vende para cliente que cobra LGPD.
6. **A tese do loop fechado.** Nenhum concorrente de atendimento fecha anúncio → conversa → venda → verba com a mesma IA que atende. Essa é a aposta do Pro/Scale (em evolução): quando entregue, é o fosso.

---

## 6. Valor de alto impacto (prova antes de promessa)

Números para a landing, com origem marcada e `[confirmar]` onde falta validação de campo:

- **Alcance do canal:** mensagem no WhatsApp é lida por cerca de 90%+ dos destinatários, contra ~20% de e-mail marketing. O Impulso põe a campanha no canal que o cliente de fato abre. `[confirmar taxa exata por benchmark do cliente]`
- **Carrinho e base fria:** o varejo brasileiro convive com ~72% de abandono de carrinho. Em case interno da ZappIQ, recuperação de carrinho chegou a 38% com cupom personalizado por perfil (+250% vs. o processo manual anterior). `[confirmar, case ilustrativo do produto Vendedor Digital]`
- **Tempo de montagem:** de ideia a campanha aprovável em segundos com a Iza Estrategista, contra horas para segmentar, escrever e aprovar template na mão. `[confirmar com cronometragem de onboarding]`
- **Régua de qualidade embutida:** o Coach trata taxa de resposta acima de 15% como excelente e abaixo de 3% como sinal de ajuste, então o dono opera com um padrão de mercado sem precisar sabê-lo de cor.

Sugestão de bloco "antes/depois" para a landing (três números cada):

| Antes do Impulso | Depois do Impulso |
| --- | --- |
| Base parada, 0 campanhas/mês | Campanha em 1 frase, quantas quiser |
| ~20% de abertura (e-mail) | ~90%+ de leitura (WhatsApp) `[confirmar]` |
| Venda que some, R$ 0 atribuído | Cada venda amarrada à conversa que a gerou `[Pro/Scale, em evolução]` |

---

## 7. Integração com os outros produtos (a plataforma completa e autônoma)

O Impulso não é uma ilha de disparo. Ele puxa e devolve valor para o resto da ZappIQ, e é aí que ele se separa de qualquer ferramenta de campanha avulsa:

- **CRM e Contatos:** o público sai do CRM nativo (tags, status do lead, funil, pontuação, recência, campanha de origem). A campanha marca a origem do contato, então o CRM sabe de onde veio cada lead.
- **Conversas (Inbox):** o disparo vira conversa. Quem responde entra na caixa, e a mesma Iza que disparou continua a venda no diálogo, com todo o contexto.
- **Templates:** módulo irmão. É o repositório de modelos aprovados que dá ao Impulso o direito de falar fora da janela de 24h e de personalizar por contato.
- **Maestro (fluxos):** a campanha reusa o modelo de Campanha com `isImpulso = true`, e a jornada roda no motor do Maestro. Regras, gatilhos e ramificações do disparo vivem no mesmo construtor visual dos fluxos de atendimento.
- **Treinar IA (RAG):** a copy sai na voz da marca porque a Iza conhece o negócio pela base de conhecimento. Campanha não fala "genérico de IA", fala como a empresa fala.
- **Qualidade da IA:** o mesmo loop de auto-correção auditada que zela pelo atendimento cobre a Iza das campanhas.
- **Analytics e Requisições LGPD:** os números da campanha alimentam o Analytics, e o consentimento de marketing conversa com o módulo de LGPD, com o piso aplicado no disparo.
- **Agenda e Tarefas:** a venda ou o interesse gerado pela campanha vira agendamento (a IA marca a visita, a consulta, a ligação) ou tarefa para o time.

A tese: uma campanha do Impulso é atendida pela Iza (Conversas), qualificada contra o CRM, respondida na voz da marca (Treinar IA), medida no Analytics, e a venda agendada (Agenda). Um sistema, não sete ferramentas coladas com fita.

---

## 8. Disponibilidade por plano, add-on e preço

O Zap Impulso é um **add-on** (assinatura de software separada, sobre o plano base). Ele é vendido em três tiers, cada um casando com um perfil de cliente e com os planos base que podem contratá-lo:

| Tier | Preço/mês | Anual (-20%) | Planos base que podem contratar | Para quem |
| --- | --- | --- | --- | --- |
| **Start** | R$ 197 | ~R$ 158/mês | Lite, Growth, Scale | Vender pela base própria, sem mídia paga |
| **Pro** | R$ 597 | ~R$ 478/mês | Growth, Scale | Quem investe em mídia e quer o loop de receita `[em evolução]` |
| **Scale** | R$ 1.297 | ~R$ 1.038/mês | Scale | Rede/operação em autopiloto de performance `[em evolução]` |

O que cada tier inclui:

- **Start:** Iza Estrategista, Studio, Copiloto e Coach, disparo por WhatsApp, e-mail e SMS (Instagram se conectado), CRM nativo e segmentação, 3 playbooks básicos. Até 5.000 contatos ativos, 1.000 disparos/mês inclusos.
- **Pro:** tudo do Start com todos os playbooks, mais o Loop de Receita (Click-to-WhatsApp, Lead Ads, Conversions API), atribuição de receita, audiências preditivas, auto-otimização, TikTok e conector com 1 CRM do cliente. Até 25.000 contatos, 5.000 disparos/mês. `[recursos de mídia paga em evolução]`
- **Scale:** tudo do Pro, mais Iza Autopiloto com governança, múltiplos CRMs, Google Ads e conversões offline, múltiplos números e painel de ROI consolidado. Contatos ilimitados, 20.000 disparos/mês. `[em evolução]`
- **Enterprise:** sob consulta (redes e franquias com volume dedicado, SLA, onboarding assistido e gestor de conta).

Bandeiras invioláveis da ZappIQ, que valem também aqui:

- **Zero taxa de setup.** Você contrata e usa.
- **Mensalidade de software fixa.** O preço do tier é software. A mensagem de marketing da Meta é repasse transparente por uso (franquia por tier + excedente por disparo), nunca cobrança escondida por conversa.
- **Teste do add-on por 7 dias**, ativável por qualquer conta que ainda não usou, independente do trial de 14 dias sem cartão da plataforma. Terminado o teste sem contratação, o serviço é bloqueado (fail-closed, add-on pago não vaza por erro).
- **Templates** acompanham o Impulso e o próprio uso de WhatsApp da plataforma; a gestão e a submissão à Meta estão no painel, sem taxa da plataforma.

Nota de precificação: a tela de "Saiba mais" e o `impulsoPlansContent.ts` referem os tiers pelos nomes comerciais Start/Pro/Scale. Os planos base da plataforma (Lite R$ 247, Growth R$ 497, Scale R$ 1.497, Enterprise sob consulta) são coisa distinta do add-on. Deixar isso claro na landing evita confundir "plano Scale" com "Impulso Scale".

---

## 9. Sugestão de prova / mini-demo para a landing

**Demo interativa "Uma frase vira campanha".** Um campo de texto único, com sugestões clicáveis: "reativar quem sumiu há 30 dias com 10% off", "avisar a base do lançamento de sexta", "recuperar carrinho abandonado ontem". Ao enviar, a tela monta em animação o cartão da campanha: público estimado (ex.: "1.240 contatos com opt-in"), a copy pronta na voz da marca, o melhor horário com a justificativa, e a estimativa de respostas e vendas. Um selo discreto "consentimento de marketing verificado" e a linha de custo transparente do WhatsApp. Botão final "Aprovar e disparar" (desabilitado na demo, com tooltip "no seu painel, isso dispara de verdade").

Reforço de prova: um mini-widget do Coach mostrando, num disparo fictício, "38% responderam, ótimo, repita esse horário", para materializar o "a IA acompanha e te diz o que fazer". Rodapé com os três selos: dados no Brasil (São Paulo), Meta Business Partner, zero setup.

Microcopy de honestidade (aumenta confiança): "Disparo, templates e Coach já rodam hoje. O loop de receita com mídia paga (Pro e Scale) está em evolução, e a gente te avisa quando ligar na sua conta."

---

## 10. CTA

**Ative o teste de 7 dias do Zap Impulso e transforme sua primeira campanha em uma frase. Sem cartão, sem setup, com o custo do WhatsApp na mesa.**

Alternativas por contexto:
- Topo: "Comece a vender pela sua base hoje. Teste o Zap Impulso grátis por 7 dias."
- Meio: "Diga o objetivo. A Iza monta a campanha. Você aprova."
- Rodapé/planos: "Start a R$ 197/mês. Cresça para o loop de receita quando quiser."

---

## Business case

O Impulso não se paga com promessa, se paga com a base que você já tem parada. O modelo abaixo parte de uma operação típica de PME com 10.000 contatos que deram opt-in de marketing e mostra a operação antes e depois de ligar o módulo. Os números de conversão são `[ilustrativos]`, ancorados na calculadora de ROI da plataforma (a Iza resolve cerca de 65% dos atendimentos sozinha, +30% de conversão sobre o processo manual, payback em torno de 90 dias) e nas réguas reais do Coach (resposta acima de 15% é excelente, abaixo de 3% pede ajuste).

**A operação antes do Impulso (três números):**
- 0 campanhas de reativação por mês: a base fica no CRM, ninguém volta a falar com ela.
- ~20% de abertura no único canal que se usa quando alguém dispara (e-mail marketing).
- R$ 0 de receita rastreada vinda da base: o que vende, vende no boca a boca, sem medição.

**A operação depois do Impulso (três números):**
- 4 campanhas por mês montadas em uma frase cada (reativação, carrinho, pós-venda, aniversário), sem contratar agência.
- ~90% de leitura, porque a campanha vai no WhatsApp, o canal que o cliente de fato abre.
- Receita amarrada à conversa que a gerou, com o Coach dizendo, a cada disparo, o que repetir.

**A conta de uma campanha de reativação (mecanismo, não adjetivo):**
Segmento "comprou e sumiu há 60 dias" tirado da própria base = 1.200 contatos com opt-in. A Iza monta o disparo com template aprovado (fura a janela de 24h), personaliza por primeiro nome e envia. Custo da mensagem de marketing da Meta: 1.200 x ~R$ 0,34 = ~R$ 408, repasse transparente, sem markup escondido. Some a assinatura do tier Start (R$ 197/mês) e o investimento total da campanha é ~R$ 605.

Do outro lado da conta: a uma taxa de resposta de 15% (o piso que o Coach chama de excelente), 180 contatos respondem e caem nas Conversas, onde a mesma Iza que disparou conduz a venda no diálogo. Convertendo 20% desses em compra, já com o ganho de +30% que a IA traz sobre o copia e cola manual `[ilustrativo]`, são ~36 vendas. A um ticket de R$ 180, isso é ~R$ 6.480 de receita reativada em um único disparo.

**Resultado:** ~R$ 6.480 de receita contra ~R$ 605 de custo, um retorno de cerca de 10x já na primeira campanha do mês, sobre uma base que a mídia de aquisição já tinha pago. As outras três campanhas do mês (carrinho, pós-venda, aniversário) rodam sobre o mesmo custo fixo de software, então cada disparo adicional melhora o retorno. Nesse modelo o add-on se paga dentro do primeiro disparo; os ~90 dias de payback são a régua conservadora da plataforma inteira `[ilustrativo]`, não de uma campanha isolada.

---

## Exemplo de aplicabilidade: varejo de moda (reativação de base e carrinho abandonado)

**O negócio.** A Amora Modas é uma boutique feminina do interior de São Paulo: duas lojas físicas e um e-commerce, faturamento em torno de R$ 380 mil por mês, ticket médio de R$ 190. A dona, Camila, juntou em quatro anos uma base de 8.000 contatos entre clientes de loja e do site. A cada estação chega coleção nova e a coleção anterior encalha.

**A dor.** Os 8.000 contatos ficam parados no CRM. Quando Camila lembra de avisar de uma promoção, dispara um e-mail que ~20% abrem. O e-commerce gera cerca de 250 carrinhos abandonados por mês, e o e-mail automático de recuperação traz de volta uns 8%. Enquanto isso, ela paga tráfego para atrair cliente novo e assiste a cliente antiga esfriar de graça. É o pior dos mundos que o Impulso ataca: mídia cara para o novo, base paga esfriando sozinha.

**O passo a passo do Impulso na operação:**

1. **Ativação sem atrito.** Camila liga o teste de 7 dias do Impulso Start (grátis, sem cartão, independente do trial da plataforma) e conecta o CRM nativo, que já tem os contatos de loja e site. O piso de consentimento filtra no servidor quem não deu opt-in de marketing: quem não autorizou não entra em nenhum segmento.
2. **Campanha de reativação em uma frase.** Ela escreve "reativar quem comprou há mais de 90 dias e não voltou, com 20% na coleção nova". A Iza segmenta a base (1.150 contatas), escreve a copy na voz da Amora (porque o Treinar IA leu o tom da marca, então não sai "genérico de IA"), sugere disparar na terça às 10h e usa um template aprovado no módulo Templates para falar fora da janela de 24h, personalizando por primeiro nome.
3. **Campanha de carrinho abandonado.** Segundo objetivo: "recuperar quem abandonou o carrinho nas últimas 48h". A Iza monta o segmento, usa um template de reengajamento e estrutura a oferta com Pix dentro da conversa (Asaas), para fechar sem tirar a cliente do WhatsApp.
4. **Revisão e aprovação.** Camila abre os dois rascunhos no Studio, ajusta uma ou outra palavra e aprova. Nada sai sem o ok dela, nada sai para quem não deu opt-in.
5. **Disparo e venda no diálogo.** As mensagens saem omnichannel. Quem responde cai nas Conversas, e a mesma Iza conduz: tira dúvida de tamanho, sugere peça que combina, fecha com Pix ou marca a visita à loja.
6. **Da conversa para a operação.** A cliente que prefere provar na loja vira agendamento na Agenda, e o time recebe a Tarefa de separar as peças antes da visita.
7. **O Coach fecha o ciclo.** Depois do disparo, o Coach lê os contadores reais e devolve, em linguagem de dona de negócio: reativação com 17% de resposta ("excelente, repita esse horário"), carrinho recuperado subindo de 8% para ~28% `[ilustrativo]`.

**O desfecho mensurável (primeiro mês):**
- **Reativação:** 1.150 disparos a ~R$ 0,34 = ~R$ 391 em mensagens. A 17% de resposta são ~195 conversas; convertendo ~22%, ~43 vendas a R$ 190 = ~R$ 8.170.
- **Carrinho:** dos ~250 carrinhos do mês, a recuperação sobe de 8% (~20 vendas) para ~28% (~70 vendas), ou seja ~50 vendas a mais a R$ 190 = ~R$ 9.500, com ~R$ 85 em mensagens.
- **A conta do mês:** custo de ~R$ 673 (R$ 197 do Start + ~R$ 476 de mensagens da Meta) contra ~R$ 17.670 de receita incremental estimada `[ilustrativo]`. O add-on se paga no primeiro dia de disparo, e a Amora deixa de reativar no palpite: passa a operar com a régua do Coach.

**Como isso vira plataforma, não ferramenta avulsa.** O público das duas campanhas saiu do CRM e Contatos; cada resposta virou Conversa atendida pela mesma Iza; a copy soou como a Amora porque o Treinar IA carrega a voz da marca; o Templates deu o direito de falar fora das 24h; a visita à loja virou Agenda e Tarefa; e os números alimentaram o Analytics com o consentimento tratado nas Requisições LGPD. Quando a Amora decidir investir em Meta Ads para a próxima coleção, o upgrade para o tier Pro liga o Loop de Receita `[em evolução]`: cada venda fechada no WhatsApp volta para a Meta pela Conversions API, e a mídia passa a mirar quem compra, não quem só clica. Um sistema que reativa, atende, agenda e mede a mesma cliente, não sete ferramentas coladas com fita.
