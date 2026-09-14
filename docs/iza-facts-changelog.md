# Iza Facts Changelog (Camada 3 anti-drift)

> Este arquivo é a **interface humana** da Camada 2 (`iza_facts` table).
> Toda vez que você muda algo que afeta o que a Iza fala, registra aqui.
> O CI gate (`scripts/check-iza-drift.sh`) bloqueia merge em PRs que tocam
> paths sensíveis sem atualizar este arquivo (ou ter label `no-iza-impact`).

## Como usar

1. **Antes do merge** do PR que toca landing/planConfig/coreAgentRules/etc:
   - Adicione uma entrada nova abaixo descrevendo o impacto
   - Indique se precisa criar, atualizar ou desativar facts no DB
2. **Depois do merge**, abra `/admin/iza-knowledge` e execute a ação descrita
   - UPDATE em fact existente → reflete em ≤60s na Iza
   - INSERT novo fact → idem
   - DELETE soft → idem
3. **Smoke test** no chat da Iza pra confirmar que ela fala certo

## Paths que disparam o gate

- `apps/web/components/landing/**` — copy do site
- `apps/web/app/(marketing)/**` — páginas marketing
- `packages/shared/src/planConfig.ts` — tiers + preços
- `apps/api/src/agents/coreAgentRules.ts` — regras imutáveis
- `apps/api/src/agents/promptEngine.ts` — prompt fallback
- `apps/api/src/agents/nichePrompts.ts` — prompts por niche
- `fly.toml` — env vars de prod

Pra contornar (PRs cosméticos): adicione label `no-iza-impact` no PR.

---

## Formato de entrada

```
### YYYY-MM-DD · PR #NNN · Título curto

**O que mudou:** descrição executiva.

**Impacto na Iza:** o que a Iza precisa passar a falar / parar de falar.

**Ação no /admin/iza-knowledge** (após merge):
- [ ] CREATE fact `xxx` em `section` (label: ..., status: live)
- [ ] UPDATE fact `yyy` mudando `status: live → sunset`
- [ ] DELETE soft `zzz`
- [ ] Nenhuma (mudança técnica sem impacto narrativo)

**Smoke esperado:** "pergunta de teste no chat" → "resposta esperada"
```

---

## Entradas

### 2026-09-14 · Raio-X do prompt · `getToneInstructions` exportada (sem mudança de texto)

**O que mudou:** `apps/api/src/agents/promptEngine.ts` ganhou a palavra `export` na
função `getToneInstructions`. Nenhum texto de prompt, nenhuma regra e nenhum
comportamento mudaram: o diff é a palavra `export` e o comentário que explica por
quê. A nova tela `/admin/ai-xray` (Raio-X do prompt) precisa procurar dentro do
prompt montado exatamente o mesmo texto de tom que a produção injeta. Copiar o
mapa de tons para o Raio-X criaria uma segunda fonte de verdade, que é justamente
o tipo de defeito que o Raio-X existe para encontrar.

**Impacto na Iza:** nenhum. A Iza não passa a falar nada novo nem deixa de falar
nada. O prompt gerado é byte a byte o mesmo de antes.

**Ação no /admin/iza-knowledge** (após merge):
- [ ] Nenhuma (mudança técnica sem impacto narrativo)

**Smoke esperado:** nenhum. O teste `promptXray.test.ts` monta o prompt pelo
montador real de produção e confere as fatias, o que cobre a regressão.

---

### 2026-09-14 · Tarefa A4, rodada 2 · O que a primeira varredura deixou passar

**O que mudou:** a revisão do PR #353 achou três páginas públicas que continuavam
prometendo dados no Brasil, com uma redação que as regras da varredura não pegavam, e uma
regressão que o próprio PR tinha introduzido nos dossiês de reposicionamento.

- **Residência de dados, três páginas que escaparam.** `/sobre` dizia "operando em
  infraestrutura brasileira com dados residentes no Brasil"; a prova social da home dizia
  "seus dados processados no Brasil"; o card 06 da home dizia "Seus dados, no Brasil.
  Ponto." e "tudo processado e armazenado em servidor brasileiro", com a promessa de que
  dado só sairia do país com autorização expressa. As três agora dizem o fato: os dados
  ficam em servidores nos Estados Unidos (banco de dados e processamento de IA), com
  salvaguardas contratuais para transferência internacional. O selo do card virou
  "06 · LGPD".
- **Regressão nos dossiês.** `docs/reposicionamento-landing-2026/README.md` e os dossiês
  09 e 10 afirmavam, no aviso escrito por este mesmo PR, que "o banco fica no Brasil".
  Corrigido, e a varredura passou a ler esses três arquivos.
- **Duas regras novas na varredura**, escritas antes da correção e vistas falhando: uma
  pega a IDEIA de dado que fica no Brasil em qualquer redação, outra pega o adjetivo
  ("infraestrutura brasileira", "servidor brasileiro").
- **Lembrete que não existe.** O questionário de cadastro ainda dizia "A IA pode enviar
  lembretes de retorno" (duas telas) e "A IA pode listar no lembrete". Viraram o que a IA
  faz: usar a informação dentro da conversa. Em `/segmentos/servicos-b2b`, o follow-up de
  proposta deixou de ser um prazo automático e virou o fluxo que a equipe monta no
  Maestro. A regra de lembrete passou a pegar "de retorno" e "enviar lembrete".

**Impacto na Iza:** reforça a entrada anterior, sem fato novo. A Iza não pode dizer
"infraestrutura brasileira" nem "servidor brasileiro", que eram as redações que faltavam
na proibição, e não pode dizer que a IA envia lembrete de retorno. Disparo por prazo só
existe como nó do Maestro, dentro de um fluxo que alguém da equipe monta e liga.

**Ação no /admin/iza-knowledge (após merge):**
- [ ] Nenhuma além das já listadas na entrada da rodada 1. Conferir, ao executá-las, que
      nenhum fact usa as palavras "infraestrutura brasileira" ou "servidor brasileiro".

**Smoke esperado:** "onde ficam meus dados?" → "em servidores nos Estados Unidos, banco de
dados e processamento de IA, com salvaguardas contratuais para transferência
internacional". "A IA lembra meu cliente da consulta?" → "não; ela consulta o horário
livre e cria o compromisso, o aviso continua com a equipe".

---

### 2026-09-14 · Tarefa A4 · Retirada das promessas que o código não cumpre

**O que mudou:** varredura de honestidade na copy do site, no painel e nos e-mails,
tirando frase por frase o que a auditoria provou falso. Na landing:

- **Residência de dados (ERRO DE FATO, corrigido na revisão).** O site dizia que os dados
  não saem do território nacional e, numa primeira correção, que o banco ficava no Brasil.
  As duas coisas são falsas. O banco de produção é o projeto Supabase
  `hwdeezdxyphvxikvgjyf`, região **us-east-1, Estados Unidos**, verificado na API de
  gerenciamento do Supabase em 14/09/2026, e o processamento de IA também roda nos Estados
  Unidos, em todas as conversas. A frase padrão passa a ser: os dados ficam em servidores
  nos Estados Unidos (banco de dados e processamento de IA), com salvaguardas contratuais
  para transferência internacional. Corrigidos: Hero, aviso rotativo da home, selo de
  confiança, rodapé da landing, faixa do pré-lançamento, comparação de pré-lançamento,
  FAQ da home, FAQ de conexão, wizard do diagnóstico, /lgpd, /legal/privacidade,
  /legal/enderecos-comerciais e
  /legal/subprocessadores (inclusive as linhas de AWS e Supabase na tabela, que diziam
  sa-east-1). Onde a ressalva não cabia num item de benefício (Hero, aviso rotativo, selo,
  pré-lançamento), o item virou "LGPD com DPA e encarregado de dados" e a íntegra ficou nas
  páginas legais.
- **Links de e-mail em produção.** `APP_URL` no `fly.toml` apontava para
  `https://zappiq-api.fly.dev`, a API. Todo botão da régua de trial e o link do digest de
  superadmin levavam o cliente para um host sem página. Passa a ser
  `https://zappiq.com.br`. OAuth, Stripe e CORS não usam essa variável.
- **Autocorreção.** Saem "se corrige sozinha", "aprende com os próprios erros", "detecta
  as alucinações do seu agente" e "cada correção aprovada vira conhecimento". O que
  existe é uma bateria semanal de cenários simulados que aponta o desvio e escreve a
  correção; nada entra no agente sem o clique de aprovar.
- **Formatos da base de conhecimento.** Saem "planilhas" e DOCX. A ingestão lê PDF, TXT,
  MD e CSV; Word e Excel voltavam 415. Sai também "sem limite de uploads".
- **Agenda.** Saem lembrete, confirmação automática, remarcação pela IA e os números de
  no-show, dos cartões de segmento, de /segmentos/saude, /cases, /vendedor-digital e
  /diagnostico. A IA consulta o horário livre e cria o compromisso, só isso.
- **Páginas despublicadas.** /roadmap, /observabilidade e /como-funciona-survey passam a
  redirecionar permanentemente para a home e saem do menu, do rodapé, do bloco de planos
  e do sitemap.
- **Voz.** O gabarito da Iza (`evalSetZappIQ.ts`) deixa de mandar afirmar voz "treinada
  nativamente": todo áudio sai pelo fallback, com voz adaptada do inglês. Deixa também de
  mandar creditar "tecnologia proprietária ZappIQ", porque a síntese é de terceiro. Em
  /voz, no card de voz da home e no FAQ da home saem os nomes de fornecedor da copy
  visível (o próprio gabarito proíbe citá-los), e sai a promessa de áudio 24h antes do
  evento: não existe disparo programado. O nome da EMPRESA continua nas páginas legais,
  que é obrigação de LGPD; o que sai é o nome do modelo, que só entrega o fornecedor.
- **Lembretes automáticos.** Saem de /cases, /segmentos/educacao, dos cartões de segmento e
  da lista do CRM as promessas de lembrete de vencimento, de aula, de vacina e de
  documento, com os números de falta apoiados nelas. O que existe é campanha disparada pela
  equipe e tarefa com prazo no quadro.
- **Depoimento inventado.** /segmentos/saude tinha uma cena entre aspas que ninguém disse.
  Vira descrição de capacidade, sem aspas, sem nome e sem estrelas.

**Impacto na Iza:** a Iza NÃO pode mais dizer que os dados ficam no Brasil, nem que o banco
fica no Brasil, nem que nada sai do território nacional. Passa a dizer: os dados ficam em
servidores nos Estados Unidos, banco de dados e processamento de IA, com salvaguardas
contratuais para transferência internacional, DPA padrão e encarregado de dados, e a lista
completa em /legal/subprocessadores. NÃO pode prometer lembrete automático de nenhum tipo
(vencimento, aula, consulta, vacina, documento) nem áudio disparado antes do evento: a
agenda consulta o horário livre e cria o compromisso, avisar o cliente continua com a
equipe. NÃO pode citar fornecedor de voz nem afirmar tecnologia própria de voz: fala só
"voz em português brasileiro". NÃO pode prometer Word, Excel nem "planilhas" na base de
conhecimento. NÃO pode dizer que a plataforma se corrige sozinha. E não deve mandar o
cliente para /roadmap, /observabilidade ou /como-funciona-survey, que agora redirecionam.

**Ação no /admin/iza-knowledge (obrigatória, os facts contradizem o site agora):**

- [ ] UPDATE `kb_upload`: tirar DOCX e site da lista. Formatos aceitos hoje: PDF, TXT, MD
      e CSV, mais link de página e texto colado.
- [ ] UPDATE `self_healing`: tirar "plataforma aprende", "loop fechado" e "única no
      mundo". Redação factual: a bateria semanal aponta o desvio e sugere a correção,
      que só vale depois de aprovada por uma pessoa.
- [ ] UPDATE `instagram_direct`: sair de "em operação real" enquanto não houver nenhuma
      conversa de Instagram na base.
- [ ] UPDATE `chat_site`: tirar "mesma cascade LLM do WhatsApp".
- [ ] UPDATE `como_funciona`: o link para /como-funciona-survey agora redireciona;
      apontar para /#precos ou para o cadastro.
- [ ] UPDATE `feat_voz_outbound`: tirar "treinada nativamente em português brasileiro",
      tirar o nome do fornecedor de voz e tirar "tecnologia proprietária". Redação
      factual: voz em português brasileiro.
- [ ] UPDATE de qualquer fact que afirme dados no Brasil, banco no Brasil ou residência em
      território nacional. Redação factual: os dados ficam em servidores nos Estados Unidos
      (banco de dados e processamento de IA), com salvaguardas contratuais para
      transferência internacional.
- [ ] UPDATE de qualquer fact que prometa lembrete automático (vencimento, aula, consulta,
      vacina, documento) ou áudio antes do evento. A agenda consulta o horário e cria o
      compromisso; o aviso ao cliente continua com a equipe.
- [ ] LIMPAR o prompt gravado dos agentes (`agents.system_prompt`), não só os facts. A
      migração `20260427_agent_model` semeou a instrução "para questões sobre Voz
      Padrão/Premium, comunicar status 'em desenvolvimento, disponível em julho/2026' e
      linkar /roadmap". A rota /roadmap agora redireciona, e a data já passou, então essa
      instrução tem de sair do `agents.system_prompt` de cada organização. A limpeza é
      feita pelo script da tarefa A9, não por UPDATE manual no /admin.

**Smoke esperado no chat da Iza:**

- "Posso subir um Word ou uma planilha?" -> "Hoje leio PDF, TXT, MD e CSV", sem prometer
  Word nem Excel.
- "A IA se corrige sozinha?" -> "Eu aponto o desvio e escrevo a correção, quem aprova é
  você", sem "aprende" e sem "única no mundo".
- "Meus dados ficam no Brasil?" -> "Os dados ficam em servidores nos Estados Unidos, banco
  de dados e processamento de IA, com salvaguardas contratuais para a transferência
  internacional", sem afirmar Brasil em lugar nenhum.
- "A IA lembra meu cliente do vencimento?" -> "Não mando lembrete sozinha; a campanha quem
  dispara é a sua equipe."
- "Qual a tecnologia da voz de vocês?" -> "Voz em português brasileiro", sem citar
  fornecedor e sem dizer que é tecnologia própria.
- "Quando sai a Voz Premium?" -> resposta sem prometer data e sem mandar para /roadmap.
- "A IA confirma e lembra a consulta?" -> "Eu marco o horário na agenda; confirmar e
  lembrar continua com a sua equipe."

### 2026-08-20 · PR #343 · Bandeira nova "por atendimento" + kit Outubro sem Susto

**O que mudou:** toda a copy do site trocou a bandeira "mensalidade fixa sem cobrança por conversa" pela nova: "Mensalidade fixa por atendimento: cada conversa que a Iza cuida conta um, com mensagens à vontade dentro dela. A tarifa do WhatsApp vai a custo, na sua conta, com medidor e teto. Zero markup, zero setup, zero surpresa." Fair use de 12 respostas por atendimento aparece em linha visível. A página /novidades-meta virou o kit "Outubro sem susto" (calculadora da tarifa Meta de 01/10, referência R$ 0,035 por resposta, tabela final até 01/09) e nasceu /legal/subprocessadores. Decisões D1/D2 do plano Resposta Meta, aprovadas pelo fundador em 20/08.

**Impacto na Iza:** a Iza NÃO pode mais afirmar "sem cobrança por conversa" nem "mensagens ilimitadas" secas. Passa a falar: mensalidade fixa por atendimento (conversa que se encerra após 72h de silêncio), mensagens à vontade dentro do atendimento com fair use de 12 respostas de IA, tarifa do WhatsApp é da Meta e vai a custo na conta do cliente (zero markup), com medidor (Conta Clara) e teto (Cost Guard) dentro da plataforma, e a partir de 01/10 a Meta cobra cada resposta (referência R$ 0,035; tabela final até 01/09). Para dúvida de custo, apontar zappiq.com.br/novidades-meta.

**Ação no /admin/iza-knowledge** (após merge):
- [ ] UPDATE fact de pricing/bandeira: remover "sem cobrança por conversa", inserir a bandeira nova com o fair use (status: live)
- [ ] CREATE fact `meta_tarifa_outubro` em pricing (cobrança da Meta a partir de 01/10, a custo, medidor e teto; link /novidades-meta; status: live)
- [ ] Smoke test no chat da Iza: perguntar "vocês cobram por conversa?" e "quanto vou pagar de WhatsApp em outubro?"

### 2026-07-16 · PR #308 · Mira no catálogo comercial + cupom em todo produto pago

**O que mudou:** As 3 faixas do Mira Prospects (Essencial R$ 297/mês, Pro
R$ 597/mês, Scale R$ 1.197/mês; anual −20%) e o pacote avulso passaram a ser
registrados em `ADDONS_V4_LIST` (planConfig.ts) — antes só existiam no registry
do Stripe, então eram invisíveis para o catálogo de cupons. Todo produto pago
agora aceita cupom no checkout (o pacote avulso ganhou o campo). Corrigido um
bug: cliente em teste grátis do Mira não compra pacote avulso (precisa assinar
uma faixa antes).

**Impacto na Iza:** Se um cliente perguntar, ela pode confirmar que o Mira tem
faixas com preço (Essencial/Pro/Scale) e que **existe cupom de desconto para o
Mira** (antes era impossível emitir). E que o **teste grátis do Mira é um teto
de 10 Alvos vitalício** (não por dias, não renova no mês) — para continuar,
assina uma faixa; o pacote avulso só serve para quem já tem faixa. Nada disso a
Iza afirmava antes; o risco é ela dizer "o Mira não tem cupom" ou "seu teste
renova mês que vem", ambos falsos agora.

**Ação no /admin/iza-knowledge** (após merge):
- [ ] UPDATE/CREATE fact do add-on Mira: faixas + preços + que aceita cupom
- [ ] CREATE fact do teste grátis do Mira: teto de 10 Alvos vitalício, vira
      faixa para continuar (não confundir com o trial de 14 dias do plano)

**Smoke esperado:** "O Mira tem desconto?" → Iza confirma que há cupom para as
faixas do Mira. "Meu teste do Mira renova mês que vem?" → Iza explica que é um
teto único de 10 Alvos e que para continuar assina uma faixa.

---

### 2026-05-17 · PR #155 · Camada 2 iza_facts + Markdown links

**O que mudou:** Criada tabela `iza_facts` (single source-of-truth pra fatos da plataforma), injetada em runtime no system prompt da Iza em todos os canais (WA + IG + chat web). Chat web ganha renderização de links Markdown.

**Impacto na Iza:** Agora ela tem bloco "FATOS ATUAIS DA PLATAFORMA" overlayado por cima do prompt seedado v7.6. Conflitos são resolvidos pelo overlay (fatos atuais ganham).

**Ação no /admin/iza-knowledge:** N/A — seed inicial feito via migration (15 facts: 3 canais, 5 features, 5 URLs, 2 compliance).

**Smoke esperado:** "Vocês têm Instagram?" → Iza confirma LIVE com piloto (não mais "não está no roadmap").

---

### 2026-05-17 · PR #157 · Camada 3 anti-drift gate

**O que mudou:** Adicionado GitHub Action que bloqueia PRs sensíveis sem atualizar este arquivo OU ter label `no-iza-impact`.

**Impacto na Iza:** Nenhum direto. Indireto: previne futuros drifts ao forçar autor a registrar impacto.

**Ação no /admin/iza-knowledge:** Nenhuma.

**Smoke esperado:** N/A.

---

<!-- Próximas entradas aqui. Não delete entradas antigas (histórico). -->

### 2026-06-11 · PR #249 · Navbar sempre clara (cosmetico)

**O que mudou:** Navbar com fundo glass claro permanente. Antes era transparente ate scrollY > 12px, o que sumia com logo e itens de menu (escuros) sobre heroes escuros como o do /blog V2. Borda + sombra continuam condicionadas ao scroll.

**Impacto na Iza:** Nenhum — mudanca puramente visual de UI. Label `no-iza-impact` tambem aplicado no PR.

**Acao no /admin/iza-knowledge:** Nenhuma.

**Smoke esperado:** N/A.

---

### 2026-07-13 · PR #259 · Reposicionamento V6 + decisoes do fundador

**O que mudou:** Landing reposicionada para a categoria "Operacao Autonoma de Atendimento e Vendas" (a Iza atende, vende e faz campanha; voce aprova, ela executa). Decisoes comerciais aplicadas: (1) plano Scale virou self-serve com trial de 14 dias (era sales-led "falar com especialista"); (2) SLA contratual 99,9% removido de TODA a comunicacao publica ate reformalizar a faixa; (3) Programa Fundadores (Cohort Founders 2026, 30% vitalicio) descontinuado; (4) Meta Business Partner: designacao obtida, formalizacao documental em andamento; (5) Mira Prospects passa a ter pricing publico; (6) Pricing ganhou seletor de add-ons. Planos ativos continuam Lite R$247 / Growth R$497 / Scale R$1.497 / Enterprise sob consulta (Starter e Business seguem descontinuados).

**Impacto na Iza — ela precisa passar a falar:**
- Categoria: "operacao autonoma de atendimento e vendas", nao "chatbot" nem "IA conversacional".
- Scale (R$ 1.497/mes): self-serve, com 14 dias gratis como os demais. PARAR de dizer que Scale e so "falar com especialista".
- Mira Prospects: add-on de inteligencia de oportunidades. Faixas Essencial R$ 297, Pro R$ 597, Scale R$ 1.197. Elegivel a partir do Growth, incluida no Enterprise, indisponivel no Lite.
- Add-ons do site: Radar 360 Pro R$ 397, Zap Impulso a partir de R$ 197, Agendamento pela IA R$ 49 (incluso do Growth pra cima), Voz Nativa a partir de R$ 79,90, Numero WhatsApp extra R$ 137.
- Meta Business Partner: podemos nos apresentar como Meta Business Partner (designacao obtida; certificado/ID em formalizacao). Conexao oficial via Cloud API direto Meta.

**Impacto na Iza — ela precisa PARAR de falar:**
- SLA / uptime 99,9% contratual (removido da comunicacao publica ate reformalizar).
- Programa Fundadores / Cohort Founders / 30% vitalicio (campanha descontinuada).
- Qualquer plano Starter ou Business (descontinuados).
- "BSP homologado via 360Dialog" como infra propria (usamos Cloud API direto Meta).

**Acao no /admin/iza-knowledge** (apos merge):
- [ ] UPDATE facts de pricing: Scale self-serve/trial; adicionar faixas Mira; adicionar add-ons do Pricing.
- [ ] UPDATE fact de posicionamento: categoria "operacao autonoma de atendimento e vendas".
- [ ] SUNSET/DELETE facts: SLA 99,9% contratual; Programa Fundadores; Starter/Business.
- [ ] UPDATE fact de parceria Meta: "Meta Business Partner (em formalizacao)".

**Smoke esperado:**
- "O plano Scale tem trial?" -> "Sim, 14 dias gratis, self-serve." (nao mais "fale com um especialista")
- "Voces tem Programa Fundadores?" -> Iza NAO oferece mais a campanha.
- "Qual o SLA de voces?" -> Iza fala de infraestrutura/monitoramento, sem cravar 99,9% contratual.
- "Quanto custa a Mira Prospects?" -> "A partir de R$ 297/mes (Essencial), disponivel do Growth pra cima."

---

### 2026-07-14 · PR #274 · Tira marca da ZappIQ do prompt do CLIENTE (não da Iza)

**O que mudou:** `coreAgentRules.ts` foi de v1 para v2 e `promptEngine.ts` removeu o
bloco `### URLs canônicas ZappIQ`. Objetivo: o prompt do agente de CADA CLIENTE (Vera do
CMJ, Bia da Loja X etc.) parou de levar marca/link/oferta da ZappIQ, porque a Vera
mandava lead do CMJ pro nosso cadastro. `CORE_AGENT_RULES_V1` é prependado ao prompt de
TODA org, inclusive a da Iza, então o path sensível dispara o gate.

**Impacto na Iza:** Nenhum nos FATOS que ela fala. Conferido linha a linha:
- O que saiu de `coreAgentRules.ts` são EXEMPLOS ilustrativos dentro de templates de
  formato de resposta — `[1 friction-reducer: sem cartão / 14 dias grátis / etc]` e
  `"Os planos disponíveis são: Starter, Growth, Scale..."` — não fatos. Viraram genéricos
  (`[benefício do SEU negócio]`, `"A, B, C..."`).
- Os fatos reais que a Iza fala (trial, planos, preços, Mira, add-ons — ver entrada
  13/07 acima) vêm da tabela `iza_facts` via `getIzaFactsBlock()`, que é um mecanismo
  completamente separado de `coreAgentRules.ts` e não foi tocado aqui.
- O bloco `### URLs canônicas ZappIQ` removido do `promptEngine.ts` só afeta o FALLBACK
  (org sem `Agent` seedado). A Iza tem `Agent.systemPrompt` próprio com ~27k chars de
  patch acumulado — nunca passa por esse fallback em produção.
- `CORE_RULES_VERSION` (v1→v2) só alimenta label de auditoria de eval run
  (`adminAgentEval.ts`, `agentQuality.ts`, `agentEvalCronService.ts`), não é lida em
  nenhuma branch de comportamento.

**Ação no /admin/iza-knowledge:** Nenhuma. Não há fact novo, atualizado ou removido.

**Smoke esperado:** Nenhuma mudança no que a Iza responde. "Quais os planos?",
"tem trial?" e "qual o link de cadastro?" continuam saindo do `factsBlock`, idênticos a
antes do PR.

---

### 2026-09-14 · Perfil vivo (A8) · promptEngine e nichePrompts param de congelar dado vivo

**O que mudou:** `promptEngine.ts` deixou de gravar no prompt seedado a data do
cadastro, a seção de tom, o bloco `Fluxo de Agendamento` (com a promessa de lembrete
24 h e 1 h antes, que o produto não envia) e o bloco `<buttons>`. `buildHoursSection`
passou a ler os três formatos de horário que existem no banco e a dizer "não informado"
quando não há dado, no lugar do `• Domingo: Fechado` que era inventado. `nichePrompts.ts`
perdeu as afirmações de oferta de cada segmento (aula grátis, "poucas vagas", convênios
nominais, pacotes, delivery, status de pedido, valor de deslocamento, mensalidade) e
ganhou chaves sem acento com mapa de compatibilidade.

**Impacto na Iza:** Nenhum no que ela fala. Conferido:
- A Iza tem `Agent.systemPrompt` próprio, escrito à mão (cerca de 27 mil caracteres).
  Ela NUNCA passa pelo fallback do `promptEngine`, que é o único consumidor destas
  funções em produção. O seed também não a alcança: o prompt dela não foi semeado.
- Os fatos que a Iza fala (planos, preço, trial, add-ons) vêm da tabela `iza_facts` via
  `getIzaFactsBlock()`, mecanismo separado que este PR não toca.
- `nichePrompts.ts` é o catálogo de segmentos do CLIENTE. A organização da ZappIQ não
  usa nenhum desses modelos.
- O bloco vivo novo (`agents/tenantLiveProfile.ts`) entra SÓ com o interruptor
  `perfilVivo` ligado por organização, e nasce desligado para todas, inclusive a Iza.

**Ação no /admin/iza-knowledge:** Nenhuma. Não há fato novo, atualizado ou removido.

**Smoke esperado:** Nenhuma mudança no que a Iza responde enquanto o interruptor estiver
desligado. Depois de ligar para a organização da Iza, ela passa a receber o horário e o
tom que estiverem nas settings dela, e "Agora: aberto" ou "Agora: fechado" calculado por
código.
