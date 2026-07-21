# Mira Prospects: revisão de arquitetura e assertividade (21/07/2026)

Motivada por reclamação de cliente em trial: (1) pediu empresas com faturamento
acima de R$ 10 milhões e a campanha trouxe empresas menores; (2) ao mapear
decisores, um profissional foi mapeado pelo nome completo, mas era outra pessoa,
que trabalha em outra empresa (homônimo).

Auditoria conduzida por 4 subagentes de engenharia (targeting, decisores, score,
integrações) mais um deep research de ferramentas globais de lead intelligence.
Todas as afirmações abaixo têm referência a arquivo e linha no repositório.

---

## 1. Bug do decisor errado (homônimo) — CORRIGIDO e verificado

### Causa raiz
`decisoresPublico.ts` verificava que o NOME de um candidato aparecia
literalmente em alguma fonte (anti-alucinação), mas nunca que a MESMA fonte
citava a EMPRESA-alvo. Como a Brave não honra aspas, a busca
`"Fulano" "Empresa X" site:linkedin.com/in` devolvia o perfil de um xará em
outra empresa, e nada no pipeline barrava. O módulo irmão `releasesPublico.ts`
já resolvia exatamente isso para empresas homônimas (`mencionaAConta` +
`confirmaAConta`, provado em produção nos PRs #302/#303), mas o padrão nunca
tinha sido portado para decisores. O cenário do cliente estava, inclusive,
reproduzido dentro de um teste que passava (`decisoresPublico.enriquecer.test.ts`:
contato da "Metalúrgica Rondello" era gravado no decisor da "ACME Metalúrgica" e
o teste afirmava isso como correto).

### Correção
Portado o padrão anti-homônimo para `decisoresPublico.ts`, reusando
`nucleoDoNome`/`mencionaAConta`/`confirmaAConta` de `releasesPublico.ts`
(agora exportados) e os dados do Alvo que já estavam carregados em memória
(`cnpj`, `site`, `municipio`, `uf`, `telefone`, sócios do QSA):

- Camada 1 (descoberta de decisores novos): só entra no corpus do LLM o
  resultado que FALA da conta-alvo (cita o núcleo do nome dela ou traz sinal
  forte que a liga a este CNPJ). O xará de outra empresa é descartado antes de
  o LLM sequer o ver.
- Camada 4 (enriquecimento de contato dos já mapeados, tipicamente sócios do
  QSA): o LinkedIn/e-mail/telefone só é gravado se o resultado confirmar a
  empresa. Cuidado importante: o nome do próprio decisor NÃO conta como
  confirmação (a busca é pelo nome dele; ele sempre aparece), então só outros
  sócios e os sinais firmográficos confirmam.
- Município sozinho não confirma (dois homônimos na mesma cidade), por isso sai
  dos sinais fortes.
- Telemetria nova: `homonimosFiltrados` no log, para medir quantos resultados
  de empresa errada estão sendo barrados em produção.

### Prova
TDD completo (teste que reprovava o bug escrito primeiro, visto falhar, depois
corrigido). Suíte inteira do Mira: 306/306 testes passando. `tsc --noEmit`
limpo. Arquivos: `decisoresPublico.ts`, `releasesPublico.ts` (export),
`decisoresPublico.enriquecer.test.ts`.

### O que ainda não foi feito (recomendado a seguir, sem integração paga)
- Buscar decisores também no domínio do site oficial do Alvo
  (`site:<dominio> equipe OR lideranca OR sobre`), sinal de confiança maior que
  LinkedIn genérico.
- UX no card do comitê: mostrar o motivo da confirmação ("confirmado por menção
  da empresa no LinkedIn") e o link do LinkedIn clicável ali mesmo (hoje só no
  rodapé "Fontes verificadas").
- `isChampion` nunca é gravado pelo backend (a coroa da UI nunca aparece);
  ligar a `arquetipo` (EXEC_SPONSOR/CHAMPION) resolve.

---

## 2. Bug do filtro de faturamento — honestidade corrigida; filtro real depende de decisão

### Causa raiz (estrutural, não é regressão pontual)
1. A seleção de empresas (`descobertaBigQuery.ts`) filtra SÓ por CNAE + UF. Não
   há filtro nem ordenação por porte, capital ou faturamento. Como a maioria
   esmagadora dos CNPJs ativos é ME/EPP, a amostra vem dominada por empresas
   pequenas.
2. O funil enriquece só os 10 primeiros CNPJs por execução
   (`descobertaPublica.ts`, `MAX_CNPJS = 10`), na mesma ordem não ordenada.
3. O único gate de exclusão (`passaGate`) exige razão social + ATIVA + 1
   decisor. Nada de porte/capital/faturamento.
4. `faturamentoAnual` do Perfil é texto livre e só é lido como contexto do
   prompt do LLM no "Aprofundar", nunca como filtro.
5. A Receita não publica faturamento de ninguém (só empresa de capital aberto,
   via CVM). Porte é faixa grossa (EPP vai de R$ 360 mil a R$ 4,8 milhões;
   "DEMAIS" é tudo acima de R$ 4,8 milhões, sem teto). Capital social não é
   faturamento.
6. A copy do produto prometia o que o código não faz: "lá o porte filtra os
   Alvos depois que a busca acha". Falso: porte só somava pontos no score.

### O que foi corrigido nesta rodada
Copy de `mira-campanha.ts` corrigida (2 pontos) para dizer a verdade do motor:
porte entra no Mira Score e ajuda a priorizar, e a Receita não publica
faturamento, então porte/capital são aproximação de tamanho, não recorte exato
de "acima de R$ X".

### Achado adicional que trava o filtro por porte
A representação de `porte` é inconsistente no próprio código: as fixtures usam
`'ME'`, `'3'`, `'5'`, `'MICRO EMPRESA'`, `'03'`, `'MEDIO'`. O `matchPorte`
(`score.ts`) só reconhece as formas descritivas ("micro", "pequeno"), então
falha silenciosamente para os CÓDIGOS que o espelho do BigQuery provavelmente
armazena. Ou seja, o score por porte está parcialmente quebrado para o caminho
principal de dados, e um filtro por porte só é confiável depois de normalizar
essa representação.

### Caminho recomendado (precisa de 1 verificação + decisão comercial)
- Passo A (grátis, sem integração): `normalizarPorte()` canônico
  (MICRO/PEQUENO/DEMAIS a partir de todas as formas), usado no `matchPorte`
  (conserta o score) e como filtro pós-enriquecimento; parse do
  `faturamentoAnual` para um piso implícito de porte (pediu acima de R$ 4,8
  milhões, exclui ME/EPP); `ORDER BY capital_social DESC` na query de
  candidatos para as maiores subirem primeiro; subir `MAX_CNPJS` para o filtro
  ter candidatos suficientes. Precede uma verificação de 1 linha no BigQuery
  (que tipo/valores a coluna `porte` e `capital_social` têm no espelho), que
  não dá para fazer de fora do ambiente. Sem ela, um filtro em SQL arrisca
  zerar campanhas (incidente que o time já teve).
- Passo B (integração paga, decisão comercial): faturamento presumido de
  verdade e contato de decisor validado por provedor brasileiro
  (BigDataCorp/BigBoost, Speedio, Serasa, Neoway, Econodata). Ver seção 4.

Verdade honesta ao cliente: "garantir 100% acima de R$ 10 milhões de
faturamento" é impossível com dado público (nem as ferramentas globais fazem:
todas MODELAM faturamento). O máximo honesto sem provedor pago é porte + capital
como aproximação; o exato exige faturamento presumido de bureau.

---

## 3. Por que a ferramenta ainda não é "assertiva" (além dos 2 bugs)

Da auditoria de score/qualificação (`score.ts`, `reavaliar.ts`,
`releasesPublico.ts`, `pousarCrm.ts`):

- O status "Pronto" IGNORA o Mira Score. `alvoPassaGate` (`reavaliar.ts`) exige
  só nome + ATIVA + 1 decisor. Um Alvo de nota 7/100 (CNAE fora do ICP, zero
  sinergia, zero demanda) vira Pronto, consome cota e vai ao CRM como
  qualificado. Isto quebra a promessa central da fila priorizada.
- Red flags e must-haves que o cliente declara ("não quero empresa sem TI
  própria") não bloqueiam nada: viram só uma frase no fim do resumo. A copy
  promete que "deixam de consumir cota"; o código não faz.
- A sinergia real (produto do cliente x demanda do Alvo) é gerada por LLM com
  qualidade, mas nunca vira número nem entra no score. `valorEstimado` da
  oportunidade é lido pelo CRM e nunca escrito: todo Deal nasce sem valor.
- Cobertura de decisores é contagem, não cobertura de papel: 3 pessoas do mesmo
  cargo valem o mesmo que EXEC_SPONSOR + ECONOMIC_BUYER + TECHNICAL_BUYER.
- O score máximo real é 93/100 no B2B e 79/100 no B2C (o fator "Encaixe de
  portfólio" está capado em 8 de 15 por um `v = 8` fixo).
- Três implementações independentes do mesmo gate (motorA, descobertaPublica,
  reavaliar); coincidem hoje, mas é a família de bug mais cara do módulo.

Recomendações (ranqueadas, a maioria barata):
1. Amarrar o gate READY a um piso de score (ex.: 25, alinhado ao
   `SCORE_MINIMO_PLANO`). Maior impacto em assertividade.
2. Red flags/must-haves confirmados bloqueiam de verdade (gravar
   `corteConfirmado` e checar no gate).
3. Alimentar "Encaixe de portfólio" com as oportunidades reais do LLM (incluir
   `oportunidades` no `include` de `reavaliar`) e corrigir o teto de 8.
4. Popular `valorEstimado` (heurística ticket médio x porte/capital, ou pedir
   faixa ao LLM).
5. Gravar `isChampion` a partir do arquétipo.
6. Pesar cobertura de decisores por diversidade de papel.
7. Consolidar os 3 gates numa função só.

Todas essas mudam comportamento/cota, então são decisão de produto do Rodrigo.

---

## 4. Como o mercado global faz, e o que integrar (deep research)

Fatos que orientam a estratégia:
- Faturamento e headcount são MODELADOS em todo o setor (a própria Apollo e
  ZoomInfo admitem). Faturamento real de empresa fechada não é público em lugar
  nenhum. Logo: usar faturamento presumido para segmentar/priorizar, nunca para
  afirmar a receita de um CNPJ.
- O anti-homônimo do estado da arte é resolução de entidade + corroboração
  multi-fonte, ancorada numa chave forte. No Brasil essa chave é o CNPJ, uma
  vantagem que os EUA não têm. (É exatamente a lógica do fix do decisor.)
- Não existe API oficial do LinkedIn para extrair contato. Scraping é fatal: o
  Proxycurl foi processado e fechou em 2025; a KASPR foi multada na Europa. O
  desenho anti-scraping da Mira (só snippet público, nunca login) está CERTO.
  LinkedIn é sinal de corroboração, nunca sistema de registro.
- Score do estado da arte = Fit x Intent, virando faixa/quadrante (alto Fit +
  alto Intent = abordar agora; alto Fit + baixo Intent = nutrir). Regra:
  priorizar por Fit, cronometrar por Intent. Intent global (Bombora, 6sense)
  não cobre o Brasil; aqui o intent tem que vir de sinais próprios (releases,
  vagas, mudança de liderança), que a Mira já colhe.
- No Brasil o gargalo é o CONTATO do decisor, não o dado da empresa (a Econodata
  mapeia decisor em menos de 2% da base).

Fontes brasileiras (o código NÃO integra nenhum provedor pago hoje; a
afirmação do deep research de que a Mira "já usa BigDataCorp" não bate com o
código):
- Já em uso: espelho de CNPJ da Receita no BigQuery (via BD Pro), CAGED
  setorial, Brave Search, BrasilAPI (com 403 fora do Brasil), Google Places.
- Disponível na assinatura BD Pro atual, NÃO construído: Quadros Societários
  espelhados (decisores em massa, sem chamada por empresa), CAGED por empresa
  (headcount real + sinal de "acabou de contratar"), Comex, Licitações + CNO
  (motor B2G). Ver doc 11 do mach-radar.
- Provedores pagos a avaliar: BigDataCorp/BigBoost (faturamento presumido +
  contatos + societário, cobertura alta), Speedio (contato de decisor validado
  em tempo real, API), Econodata (score de assertividade, por token), Serasa
  (faturamento presumido de bureau), Neoway (enterprise).

Roadmap ranqueado (do maior retorno ao menor):
- P0. Waterfall com corroboração multi-fonte ancorado no CNPJ (o padrão Clay
  adaptado ao Brasil). Já está em embrião.
- P1. Fechar o contato de decisor com Speedio/Econodata (comprar o que é caro
  construir, com validação de e-mail/telefone na hora).
- P2. Verificação de e-mail própria (SMTP/catch-all) e selo "verificado em" por
  dado. Ser honesto sobre a idade do dado é onde a Mira supera os incumbentes.
- P3. Detecção de troca de emprego (job-change) sobre a base já mapeada.
- P4. Score composto Fit x Intent com quadrante de priorização.
- P5. Faturamento presumido (BigBoost padrão; Serasa para contas premium),
  sempre como faixa + fonte + data, nunca valor pontual.
- P6. Postura explícita de LinkedIn/LGPD no produto (legítimo interesse, PJ e
  QSA públicos, opt-out, aproveitando "Fontes verificadas" como diferencial de
  confiança).

---

## 5. Decisões pendentes do Rodrigo

1. Direção do filtro de faturamento: aproximação por porte/capital (grátis, esta
   semana, com verificação no BigQuery) e/ou provedor pago de faturamento
   presumido (BigBoost/Speedio/Serasa).
2. Assertividade: implemento agora as mudanças de comportamento (piso de score
   no gate, red flags bloqueando cota, isChampion, valorEstimado) ou seguram
   para sua revisão? Elas mudam quantos Alvos viram "Pronto" e consomem cota.
3. Provedor de contato de decisor validado (Speedio/Econodata): avaliar
   integração? É o gargalo brasileiro real.
4. Fecho a rodada atual (fix do decisor + copy) em PR e faço um preview, ou
   quer revisar o diff antes?
