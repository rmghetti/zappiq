# Releases desta conta: de "lista de links" para inteligência acionável

Status vivo do loop (máx. 4 sessões). Worktree: `~/dev/zappiq-mira`.

## O pedido do Rodrigo (15/07/2026)

> Trazer as últimas matérias, anúncios ou fatos relevantes da empresa publicados na internet (Google ou Instagram), com o link da matéria/fonte. Melhor ainda se analisar o que essa publicação teria de sinergia com os produtos e serviços do nosso cliente e isso gerar uma demanda recente e/ou Oportunidade no portfólio. Consecutivamente melhorar o score e a confiança. Garantir que funciona no mapeamento semanal, como atualiza o Alvo, e uma forma de sinalizar/alertar o cliente.

## O que já existia (levantamento antes de mexer)

- `releasesPublico.ts` → `pesquisarPegadaPublica()`: 3 buscas fixas (LinkedIn posts, novidades, fornecedor), 1 chamada de LLM que serve releases + incumbentes + demandas + janela. Verificador exige `fonteIndice` apontando para resultado real.
- `releasesCron.ts`: segunda 06:00 UTC, LIGADO. Diff oficial da Receita (confiança 90) + pegada pública (confiança 60). Tetos: 8 alvos/org, 60 buscas/ciclo.
- Front: `mira/alvos/[id]/page.tsx:345` mostra só `titulo` + ícone de link + `relevancia`. Página `/mira/releases` mostra mais (resumo, ângulo, botão "Lida").

## Os buracos reais achados (a causa de o recurso não entregar o que promete)

1. **O cron nunca reavalia o Alvo.** Grava a linha e loga. O score só se move quando alguém clica em "Aprofundar com IA". Ou seja: o mapeamento semanal roda, acha coisa, e a nota do Alvo não muda.
2. **O cron joga as demandas no lixo.** `buscarReleasesPublicos` é uma fachada que devolve SÓ `drafts` (releases) e descarta `demandas`/`incumbentes`/`janela` que o mesmo LLM já produziu e já foram pagos. A Fase 2 (botão) persiste; o cron não.
3. **Release não tem vínculo com demanda/oportunidade.** Só `produtoRelacionado` (string solta) casando com `MiraOportunidade.produto` por convenção. Sem FK, o dossiê não consegue dizer "esta demanda nasceu desta matéria".
4. **Release nunca gera oportunidade.** E se gerasse, a Fase 1 do "Aprofundar" apagaria (`deleteMany({alvoId})` sem filtro de origem).
5. **`dataPublicacao` nunca é escrito por ninguém.** Campo existe no schema, sempre `null`. Sem data, não dá para dizer "matéria da semana passada" vs "de 2019", e o front não consegue ordenar por recência de fato.
6. **`MiraDemanda.dataFonte = new Date()`** (`agentes.ts:563`) grava a data em que ACHAMOS, não a data em que foi publicado. É uma pequena mentira no dossiê.
7. **`reavaliar.ts:86` não tem `orderBy` nos releases.** O comentário diz "a janela mora no release mais recente", mas o `.find()` pega o primeiro que o Postgres devolver. A janela pode vir de um release velho.
8. **Dedup divergente:** cron usa título/30 dias, `persistirReleaseDrafts` usa URL/45 dias. A mesma novidade com URL diferente entra duas vezes.
9. **Sem Instagram.** O Rodrigo pediu explicitamente; hoje só LinkedIn.
10. **Sem alerta.** Não existe model `Notification` na plataforma. O único sinal é `lida:false` + badge, que ninguém vê se não abrir a página.

## Decisões de desenho

### Score: sobe pelo caminho que já existe, sem inflar número

O release já alimenta o score por dois caminhos legítimos: `anguloAbordagem` → `janela` (+8 do fator "Janela e incumbente", peso 15) e demanda evidenciada → fator "Demanda e sinais" (peso 25). **O problema nunca foi a fórmula, foi o cron não chamar `reavaliarAlvo` e não persistir a demanda.** Consertar isso faz o score subir de verdade, sem mexer em peso.

### Confiança do Alvo: NÃO muda de fórmula (decisão deliberada)

`score.ts:286-295` — a confiança do Alvo mede **completude firmográfica** (razão social 20 + CNAE 15 + porte 10 + situação 10 + município/UF 10 + decisores 25 + telefone 10 = exatamente 100). Um release não acrescenta dado firmográfico. Fazer release somar aí:
- inflaria um número que significa outra coisa (e o COFEL já está em 90/100: só faltava telefone; qualquer soma seria clampada e não faria nada);
- rebalancear os pesos mudaria a confiança de TODO Alvo já entregue, sem que nenhum dado tenha mudado.

**O que melhora de verdade é a confiança DA INFORMAÇÃO (por release)**, que é o que a frase do Rodrigo pede. Hoje é fixa em 60 (web) / 90 (Receita). Passa a graduar pela qualidade da fonte:
- **90** — registro oficial (Receita/BrasilAPI), inalterado
- **75** — matéria de imprensa/site com data de publicação verificada
- **65** — matéria/site sem data verificável
- **60** — post da própria conta (LinkedIn/Instagram): é a empresa falando de si, vale menos que imprensa

A demanda nascida do release **herda** essa confiança em vez do 70 fixo.

### Sinergia: o LLM já lê tudo numa passada, só não era perguntado

A busca e a chamada de LLM já acontecem. Adicionar `demandaGerada` e `oportunidade` por release ao JSON de resposta **não custa busca nem chamada nova** — é o mesmo prompt pedindo mais um campo do material que já está na frente dele. O verificador continua o mesmo: sem `fonteIndice` real, não passa; `produto` precisa ser nome EXATO do catálogo.

### Oportunidade nascida de release precisa sobreviver ao "Aprofundar"

`MiraOportunidade.origem` (`ANALISE` | `RELEASE`, default `ANALISE`) + a Fase 1 passa a apagar só `origem: 'ANALISE'`. Sem isso, o próximo clique em "Aprofundar" apagaria a oportunidade que a matéria gerou.

### Alerta: Task com `origem: 'MIRA'` (não existe notificação in-app na plataforma)

Reusa `planoAcao.ts:45`, que já é idempotente, já aparece em `/tasks` e já vincula ao Alvo por `miraAlvoId`. **Uma Task por Alvo por ciclo, e só quando o release for acionável** (gerou demanda/oportunidade ou moveu o score) — release informativo não vira tarefa, senão vira spam de 50 tarefas/semana e o cliente para de olhar.

## Plano por sessão

- **Sessão 1** — migração (`demandaId`, `MiraOportunidade.origem`/`fonte`, `alertadoEm`), busca com Instagram + notícias, LLM devolve data/demanda/oportunidade por release, verificador de data, confiança graduada, `persistirReleaseDrafts` cria demanda+oportunidade ligadas e grava lineage em `alvo.fontes`. Testes.
- **Sessão 2** — cron: persiste o dossiê inteiro (não só releases), chama `reavaliarAlvo`, cria a Task de alerta; unifica dedup; conserta `orderBy` do `reavaliar`. Testes.
- **Sessão 3** — front: "Releases desta conta" mostra data, fonte, o que gerou e a confiança; PR, CI, merge, deploy.
- **Sessão 4** — prova em produção com Alvo real e relatório.

## Registro de execução

### Sessão 1 (15/07/2026) — CONCLUÍDA, backend inteiro pronto

Branch `feat/mira-releases-inteligencia`. Adiantou o escopo da sessão 2.

Commits:
- `f5243d5` — release traz data, fonte e vira demanda + oportunidade ligadas
  (migração aditiva, Instagram + imprensa nas buscas, sinergia por matéria,
  verificador de data, confiança graduada por fonte, FK `demandaId`,
  `origem: RELEASE` sobrevivendo ao Aprofundar). 20 testes novos.
- `47908aa` — o ciclo semanal fecha (`persistirPegadaPublica` unificada,
  cron chama `reavaliarAlvo`, `releasesAlerta.ts` com trava de spam,
  `orderBy` do reavaliar consertado). 17 testes novos.

Verificado: tsc limpo; suíte da API 155 arquivos / 1567 testes verdes (era
152/1530 antes do loop, +37 testes).

**Buracos 1 a 8 da lista acima: fechados.** Falta o 9 (front) e a prova real.

### Sessão 2 (15/07/2026) — CONCLUÍDA: front + PR #301 + deploy + PROVA REAL

Feito: front do dossiê (data, domínio da fonte, confiança, "Gerou demanda"),
Saiba mais reescrito, PR #301 mergeada (commit `43e7c4e`), Fly v364 no ar,
migração `20260715000003` aplicada em produção às 14:18 (5 colunas + FK
conferidas por `information_schema`).

**A prova real derrubou a comemoração, e é por isso que ela existe.**

Rodei a pegada pública contra o COFEL em produção: `buscas: 4`, `erro: nenhum`,
**`releases achados: 0`**. O alerta funcionou (Task `cmrm64ddh0005qzjjdppj0a9h`,
2 releases sinalizados) e a reavaliação rodou (45 → 45). Mas o caminho da
sinergia não foi exercitado com dado real. Fui ver por quê.

#### ACHADO 1 (crítico): a busca devolve lixo, o recurso está passando fome

A query `"COFEL COMERCIAL E INDUSTRIAL DE FERRO LIGAS LTDA"` devolveu 6 hits,
**nenhum da COFEL de ferro ligas**:
- `instagram.com/cofelsaj` → "COFEL Loja de Departamentos" (outra empresa)
- `instagram.com/cofellaminados` → "Cofel Laminados" (outra empresa)
- `instagram.com/cofelma` → "Metalúrgica Cofelma" (outra empresa)
- `instagram.com/cofeltudoparavoce` → "COFEL Móveis/Eletros" (outra empresa)

E com o nome curto (`"COFEL"`) é pior: volta Copel, Cofen, Passos Coelho,
Ronaldinho, "Contrato de investimento". **A Brave não honra as aspas como
frase exata.**

O LLM devolveu 0 releases — o anti-alucinação ("use SOMENTE o que aparece")
funcionou e nos salvou. Mas 20 testes unitários verdes não pegariam isto:
**eles provam que o código faz o que eu mandei, não que a busca traz a empresa
certa.**

**O perigo é maior que "achar pouco":** `releasesPublico.ts` NÃO filtra os
resultados por menção à empresa antes de mandar pro LLM (o
`decisoresPublico.ts` filtra, por nome da pessoa — o padrão existe e não foi
aplicado aqui). Então o LLM recebe 12 resultados de empresas homônimas e pode
montar "Cofel Laminados anunciou X" e atribuir ao Alvo COFEL FERRO LIGAS.
Atribuir fato de outra empresa à conta é o erro que queima a reunião.

**Suspeita de dado sujo JÁ em produção:** dos 2 releases do COFEL no banco
(criados pelo código antigo), um aponta para `cofellaminados.com.br`. Pode ser
a mesma empresa ou não — não dá para afirmar, e é exatamente esse o problema.

#### ACHADO 2 (crítico, e explica o teto do score): `municipio` é null em 100% dos Alvos

```
{"total":20,"comSite":0,"comMunicipio":0,"comFantasia":8}
```
`site` e `municipio` estão **null em TODOS os 20 Alvos** da plataforma.

Consequências, em ordem de gravidade:
1. **Toda confiança de Alvo está capada em 90.** A fórmula é razaoSocial 20 +
   cnae 15 + porte 10 + situacaoCadastral 10 + **municipio&uf 10** + decisores
   25 + telefone 10 = 100. O COFEL está em 90 e falta exatamente o
   `municipio && uf`. Não é o telefone (ele tem: 1144117333). **Todo Alvo da
   plataforma perde 10 pontos de confiança que deveria ter**, e isso vinha
   sendo lido como "o dado é incompleto" quando o dado existe na Receita.
   → Isto responde de verdade o "melhorar a confiança" que o Rodrigo pediu, e
   por um caminho honesto: preencher o campo, não mexer no peso.
2. **Perdemos o melhor sinal de desambiguação** de homônimo (Cofel de SP vs
   Cofel de outra cidade).

Sinais que o Alvo TEM: CNPJ (01382565000143), CNAE (2412100 = metalurgia de
ferroligas), UF (SP), telefone, e 4 decisores nominais do QSA.

O Alvo nasce do espelho de CNPJ (BigQuery), que tem município. Ou o motor não
mapeia o campo, ou o espelho não o materializou. **Investigar na sessão 3.**

### Sessão 3 (15/07/2026) — CONCLUÍDA. Município PROVADO; releases: o filtro protege, mas o ICP não tem imprensa

PR #302 mergeada, Fly v365 no ar.

#### Município: PROVADO em produção (20/20)

Antes de escrever qualquer tradução, verifiquei a ressalva certa (se
`id_municipio` não fosse IBGE, o dicionário mapearia cidade errada = pior que
null): **é IBGE de 7 dígitos** (28.012.246 linhas), o diretório
`br_bd_diretorios_brasil.municipio` existe, o JOIN casa, COFEL 3504107 =
Atibaia/SP com a UF do diretório batendo com a do espelho.

Backfill rodado: **20 de 20 Alvos ganharam município e +10 de confiança.**
COFEL 90 → 100. Média da plataforma 72,3 → **82,3**. `sem_municipio = 0`.
É o "melhorar a confiança" do pedido, pelo caminho honesto.

#### Releases: o filtro funciona, e o que ele revela é desconfortável

O filtro de menção + confirmação está em produção e provado. Mas a busca real
contra 5 Alvos deu **0 releases confirmados** em todos:

| Alvo | descartados por homônimo | confirmados |
|---|---|---|
| COFEL (Atibaia) | 2 | 0 |
| YADOYA (Bom Jesus dos Perdões) | 6 | 0 |
| ALUMIGON BRASILEIRA (Barueri) | 1 | 0 |
| ORNATTO MÓVEIS (Adamantina) | 2 | 0 |
| PERFILADOS ATIBAIA | 4 | 0 |

**Uma ideia minha foi reprovada pela prova:** eu tinha posto município na
query. `"cofel ferro ligas" Atibaia SP (...)` → **0 hits**; sem o município →
6 hits. A Brave faz AND e matéria de PME não escreve a cidade junto do nome.
Revertido (commit na main).

#### A pergunta honesta que fica: o filtro está certo ou estrito demais?

Os dois lados são reais:
- **A favor do filtro:** ele barrou "COFEL Loja de Departamentos", "Cofel
  Laminados", "Metalúrgica Cofelma" — empresas DIFERENTES. Sem ele, o dossiê
  do Alvo de ferro ligas receberia o anúncio de uma loja de móveis.
- **Contra:** um snippet tem ~150 caracteres. CNPJ, telefone e município
  raramente aparecem ali. O filtro pode estar recusando a matéria legítima
  junto com a homônima.

**Não dá para decidir isso com mais engenharia de filtro.** O que resolve é o
dado que falta: **o site oficial do Alvo**. `site` é null em 100% dos Alvos
B2B porque NENHUMA fonte B2B tem (Receita/espelho/BrasilAPI não guardam
website — isto não é bug, é ausência de fonte). Com `alvo.site`, o domínio
vira a confirmação de identidade mais forte que existe e destrava tudo:
`cofel.ind.br` deixa de ser indistinguível de `cofellaminados.com.br`.

**Suspeita a confirmar:** dos 2 releases antigos do COFEL, um aponta para
`cofellaminados.com.br`. Provavelmente é dado sujo de outra empresa, gravado
pelo código velho sem filtro. Vale limpar.

### Sessão 4 (última) — descobrir o site oficial do Alvo

1. Serviço de descoberta de site: busca dirigida pelo núcleo + CNPJ, confirma
   pelo CNPJ no rodapé (padrão universal em site brasileiro) ou pelo nome do
   decisor, grava em `alvo.site`. Uma vez por Alvo, não a cada ciclo.
2. `confirmaAConta` passa a aceitar domínio == `alvo.site` como sinal forte.
3. Nova prova real. Se ainda vier 0, a resposta honesta ao Rodrigo é que este
   ICP (metalúrgicas PME do interior de SP) tem pouquíssima pegada de imprensa,
   e o valor do recurso mora no diff da Receita + Instagram, não em matéria.
4. Limpar o release suspeito de homônimo do COFEL.

### Sessão 3 (planejada originalmente)

1. **Descobrir por que `municipio`/`site` não são preenchidos** (motorA/espelho
   BigQuery) e corrigir. Ganho imediato: +10 de confiança em todo Alvo e o
   sinal de desambiguação de volta.
2. **Filtro de menção em `releasesPublico.ts`** (o padrão que o
   `decisoresPublico.ts` já usa): só chega ao analista o resultado que cita o
   NÚCLEO do nome da empresa (removendo LTDA/COMERCIAL/INDUSTRIAL/DE/E...).
   Mata Copel/Cofen/Ronaldinho de graça.
3. **Desambiguação de homônimo**: exigir ao menos um sinal de confirmação
   (CNPJ no texto, nome de decisor do QSA, município, ou termo do setor via
   CNAE + UF). Sem sinal → não entra. Release errado no dossiê é pior que
   nenhum release, e o produto já tem esse princípio.
4. **Query melhor**: razão social inteira não é frase de busca. Usar o núcleo +
   município/setor.
5. Testes + nova prova real. Só então declarar pronto.

### Sessão 2 (planejada originalmente) — front + PR + deploy [FEITO ACIMA]
1. `mira/alvos/[id]/page.tsx:345` — "Releases desta conta" mostra hoje só
   título + ícone de link. Precisa mostrar: data de publicação, a fonte
   clicável, a confiança, e o que a matéria GEROU (demanda/oportunidade
   ligadas). É o que o Rodrigo vai olhar para dizer se resolveu.
2. Saiba mais de `mira.releases`: atualizar a copy (hoje descreve o recurso
   antigo, sem sinergia nem alerta).
3. PR, CI, merge, deploy do Fly com a migração.

### Sessão 3 — prova em produção
Rodar `runMiraReleasesCycle` (ou a pegada pública de um Alvo real) contra o
COFEL/org MACHIA e provar: matéria real com link, demanda ligada, score
movido, Task de alerta criada. Sem isso não está pronto.

### Débito conhecido (não bloqueia, registrar para não esquecer)
- A mesma notícia coberta por dois veículos (URLs diferentes) entra duas
  vezes. O dedup por URL não pega e dedup por título não cola porque cada
  veículo escreve um título. Só incomoda se acontecer de verdade.
- Confiança do ALVO segue sem contar releases (decisão deliberada, ver acima).
  Se o Rodrigo insistir, a conversa é sobre rebalancear os 7 pesos, e isso
  muda a confiança de todo Alvo já entregue.
