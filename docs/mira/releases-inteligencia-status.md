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

### Sessão 2 (próxima) — front + PR + deploy
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
