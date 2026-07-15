# Alvo cru não sobe: persistir antes de desistir, barrar o que sobrar

Status vivo do loop (máx. 4 sessões). Worktree `~/dev/zappiq-mira`.

## O pedido do Rodrigo (15/07/2026)

> O plano de ação só deve ser feito e gerar uma tarefa se temos informações suficientes para ter um Alvo qualificado. Inclusive: se o mapeamento estiver bem raso e não trouxer nada além do nome da empresa, ele nem sobe como alvo da base. Isso compromete a qualidade do Mira e cria uma visão negativa do cliente. Só sobe alvo com ao menos 1 decisor e preferencialmente mais alguma informação (demandas, fornecedores, releases). Garantir que melhoraremos o fluxo de pesquisa e a persistência em trazer mais informações de qualificação.

Decisões dele: corte de score em **25**; etiquetas com catálogo; plano de ação só para qualificado.

## O diagnóstico (produção, 20 Alvos da org MACHIA)

**11 de 20 Alvos (55%) não têm decisor nenhum.** Todos com score 9 a 13, todos parados em `QUALIFYING`. É exatamente a "entrega crua" que o Rodrigo descreveu.

Fui atrás do porquê, e a resposta partiu a lista em dois grupos que não têm nada a ver um com o outro:

| natureza jurídica | quantos | sócios na Receita | recuperável? |
|---|---|---|---|
| **2135 Empresário (Individual)** | **8** | 0, e é **impossível ter** | **sim, de graça** |
| 2062 Sociedade Empresária Limitada | 3 | 0 (lacuna real da fonte) | só pela web |

### O grupo de 8: o decisor sempre esteve no nome

A definição legal de `2135`, do diretório oficial:

> "o empresário **pessoa física** que exerce profissionalmente atividade econômica (...) **sem se constituir pessoa jurídica e sem a participação de qualquer sócio**"

Ou seja: **o QSA desses 8 está vazio porque a lei proíbe que exista sócio.** O sistema está esperando um quadro societário que não pode existir, e desistindo. E o decisor está bem ali, no campo `nome`, porque na EI **a pessoa é a empresa**:

- GISLAINE RODRIGUES DOS SANTOS BERSAN ARARAS
- APARECIDO ANTONIO CABELO (fantasia: STILLUS MOVEIS)
- ROGERIO APARECIDO FRANCISCO (fantasia: ROGERTECH ELETROELETRONICA)
- PAULO DA GLORIA GERONIMO (fantasia: MOVEIS E DECORACOES SAO JOSE)
- LUIS CARLOS LOPES PINTO (fantasia: TUPA LUVAS INDUSTRIAIS)
- RICARDO ALEXANDRE M. CHIRIGATTI AGUAI, EDILSON RODRIGUES CORREIA, J.D.FREZE-MARCENARIA

Não é heurística nem chute: é **ler o registro corretamente**. Confiança de dado oficial, igual ao QSA.

Outras naturezas com a mesma propriedade (titular = a própria pessoa), do mesmo diretório: `2305` e `2313` (EIRELI) e `4014` (Empresa Individual Imobiliária).

### O grupo de 3: a fonte não tem

LTDA deve ter sócio, mas a Receita não registra nenhum para estes três (`socios_receita = 0`, conferido direto na tabela `br_me_cnpj.socios`, não é falha do nosso espelho). Para eles não há o que derivar: ou a busca web acha, ou não sobem. E isso é honesto.

## O terceiro defeito: a IA inventa o setor

Já provado nesta sessão: `descobertaPublica.ts:140` grava `cnaeDescricao: null`, e o prompt manda só `Atividade (CNAE 2451200)`. A IA adivinha o setor pelo número e erra: escreveu o dossiê da GISLAINE inteiro como **joalheria**, sendo `2451200` = **Fundição de ferro e aço** (conferido no diretório oficial). O plano de ação e a oportunidade nº 1 saíram dessa invenção.

É o mesmo comentário ("exigiriam dicionários e não pesam no gate") que causou o bug do município. **Terceira vítima da mesma linha.** O dicionário existe: `br_bd_diretorios_brasil.cnae_2`, campo `descricao_subclasse`.

## O plano

A ordem importa: **persistir primeiro, barrar depois**. Barrar sem enriquecer só transformaria "Alvo ruim" em "campanha vazia", que é o problema que resolvemos há dois dias.

1. **Titular do Empresário Individual vira decisor** (recupera 8 de 11).
2. **CNAE com descrição** (a IA para de inventar setor).
3. **Gate na origem**: sem decisor após todas as tentativas, o Alvo não sobe.
4. **Plano de ação e tarefa só para qualificado** (score ≥ 25 e ≥ 1 decisor).

## Registro de execução

### Sessão 1 (15/07/2026) — diagnóstico + os dois itens de PERSISTÊNCIA

Branch `feat/mira-alvo-nao-sobe-cru`, commit `6bde882`.

Feito:
- **Titular do EI vira decisor** (`titularDoRegistro` em `cnpj.ts`), ligado no
  adaptador do espelho. Cobre 2135/2305/2313/4014. Corta sufixo de município só
  quando bate exato. LTDA sem QSA não vira titular (é lacuna da fonte, não
  ausência legal de sócio).
- **CNAE com descrição**: JOIN do `br_bd_diretorios_brasil.cnae_2` na query de
  enriquecimento, `cnaeDescricao` deixa de ser `null`.
- 11 testes novos com nomes reais. Um pegou um bug meu (razão social igual ao
  município devolvia "ARARAS" como pessoa). Suíte: 158 arquivos / 1609 verdes.

**Expectativa a PROVAR na sessão 3** (não declarar antes): 8 dos 11 Alvos sem
decisor devem passar a ter 1. Efeito no score: +7 no fator de cobertura
(`min(20, count*7)`) e +25 na confiança. A GISLAINE deve ir de score 13 para
~20 e confiança 75 para 100.

Atenção honesta: **20 ainda é abaixo do corte de 25 que o Rodrigo aprovou.**
Então mesmo recuperada ela não sobe, e isso está certo: o Fit de ICP dela é 0
(fundição de ferro, CNAE fora do ICP declarado). O gate vai barrá-la por um
motivo verdadeiro, em vez de ela subir crua.

### Sessão 2 (15/07/2026) — o gate. Commit `eebd56c`.

Feito:
1. **O gate decide se o Alvo NASCE** (`passaGate` movido para antes do
   `create`, depois de toda a persistência). Some o meio-termo em QUALIFYING:
   o Alvo que nasce, nasce pronto.
2. **O "candidato" de só nome deixou de existir.** Era o pior ofensor e batia
   literalmente na frase do Rodrigo: nascia do TÍTULO de um resultado de
   busca, `status: DISCOVERED`, sem CNPJ, sem decisor, confiança 40, resumo =
   snippet do buscador. Nada nunca o promovia.
3. **`planoBloqueadoPor`**: zero decisor barra sempre; score < 25 barra. O
   motivo do decisor vem primeiro de propósito (é o acionável). O score usado é
   o de DEPOIS da Fase 2, não a cópia velha em memória.
4. **Honestidade**: `descartadosCrus` e `descartadosSoNome` reportados, senão
   "criados: 3" esconderia que a busca achou 14.

19 testes novos, com os Alvos reais como fixture. Suíte: 160 arquivos / 1628.

### Sessão 3 (15/07/2026) — PR #304 mergeada, Fly v369, PROVADO em produção

Front feito (o dossiê diz o que falta, com o motivo vindo da API para não
duplicar a regra). PR #304 mergeada, deploy v369.

#### Backfill: 8 de 8 recuperados, exatamente como previsto na sessão 1

```
PAULO DA GLORIA GERONIMO      -> PAULO DA GLORIA GERONIMO      | score 13->20 conf 75->100
LUIS CARLOS LOPES PINTO       -> LUIS CARLOS LOPES PINTO       | score 13->20 conf 75->100
APARECIDO ANTONIO CABELO      -> APARECIDO ANTONIO CABELO      | score 13->20 conf 65->90
GISLAINE ... BERSAN ARARAS    -> GISLAINE ... BERSAN           | score 13->20 conf 75->100
J.D.FREZE-MARCENARIA          -> J.D.FREZE-MARCENARIA          | score 13->20 conf 65->90
RICARDO ... CHIRIGATTI AGUAI  -> RICARDO ... CHIRIGATTI        | score 13->20 conf 75->100
EDILSON RODRIGUES CORREIA     -> EDILSON RODRIGUES CORREIA     | score 13->20 conf 65->90
ROGERIO APARECIDO FRANCISCO   -> ROGERIO APARECIDO FRANCISCO   | score 13->20 conf 75->100
```
Base: 20 Alvos, sem decisor caiu de **11 para 3**. Os 3 LTDA ficaram
**intocados** (decisão do Rodrigo pendente, nada foi apagado).

#### O gate provado contra a base inteira

**7 de 20 Alvos geram plano de ação** (antes: todos). O corte de 25 em produção
separa exatamente onde deveria:
- 45/33/27 (4 a 2 decisores) → SIM
- 20 (1 decisor) → NÃO: "Mira Score 20 abaixo do mínimo de 25"
- 13/9 (0 decisores) → NÃO: "nenhum decisor mapeado"

A GISLAINE agora tem decisor (`GISLAINE RODRIGUES DOS SANTOS BERSAN`,
"Empresário Individual") e confiança **100**, mas segue sem plano por score 20.
É o resultado certo: o Fit de ICP dela é 0 porque fundição de ferro está fora
do ICP declarado. Barrada por um motivo verdadeiro, não por acidente.

### PONTA SOLTA achada na prova (decisão do Rodrigo)

O gate impede planos NOVOS, mas o plano ANTIGO continua gravado. São **2 casos**:

| Alvo | plano velho | tarefa |
|---|---|---|
| GISLAINE | o da alucinação de "joalheria" | **DONE** (já concluída) |
| EDUARDO RONDINA | "Localizar o canal de contato de Ronderley..." | **PENDING** |

O da GISLAINE está ativamente errado e ainda aparece na tela. Mas apagar mexe
em dado do cliente, e o do EDUARDO RONDINA tem **tarefa pendente** = trabalho
em aberto dele. **Não toquei.** Opções para o Rodrigo: (a) limpar os 2, (b)
limpar só o da GISLAINE (o errado), (c) deixar.

### Sessão 4 (última) — relatório + o que o Rodrigo decidir
Duas decisões dele, nenhuma tomada por mim:
1. Os 3 LTDA sem sócio na base: apagar, arquivar ou deixar?
2. Os 2 planos velhos que hoje não seriam gerados: limpar quais?
