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

### Sessão 3 (próxima) — PR, deploy, backfill e prova
1. PR + CI + merge + deploy.
2. **Backfill dos 11 crus existentes.** Os 8 EI ganham o titular e ficam
   legítimos (score ~20, abaixo do corte de 25 para plano, mas com decisor).
3. **DECISÃO DO RODRIGO, não minha**: o que fazer com os 3 LTDA sem sócio
   (KRAMEPY, A S F, FORT-LUX) que já estão na base? Apagar é irreversível e é
   dado dele. Opções: (a) apagar, (b) arquivar, (c) deixar e só não gerar
   trabalho. **Não vou apagar nada sem ele dizer.**
4. Front: o dossiê precisa dizer O QUE FALTA quando não gera plano ("Este Alvo
   não gerou plano de ação porque não tem decisor mapeado. Clique em Mapear
   decisores."), senão o silêncio vira outro mistério.
5. Prova em produção.

### Sessão 4 — relatório.
