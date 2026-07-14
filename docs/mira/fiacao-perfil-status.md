# Fiação do Perfil de Prospecção nos motores (status do loop)

**Missão:** garantir que todo campo preenchido no Perfil de Prospecção é consumido em pelo menos um destes pontos, com teste provando a influência: mapeamento (queries de descoberta), qualificação (score/corte), dossiê/roteiro (aprofundar), decisores, releases. Limite duro: **4 sessões**. PR #277, branch `feat/mira-perfil-b2b-b2c`, worktree `~/dev/zappiq-mira`.

**Estado: sessões 1 e 2 CONCLUÍDAS em 14/07/2026. Próxima: sessão 3 (descoberta + releases).**

## Auditoria (sessão 1): o que os motores consomem hoje

Consumidos (11 de 41):

| Campo | Onde | Mecanismo |
|---|---|---|
| tipoCliente | routes/mira.ts:105 | roteia motor B (Places) vs descoberta pública |
| prontidao | motorA:45, motorB:117, descobertaPublica:124 | gate 60 (412) |
| segmento | agentes.ts:93 | prompt do aprofundar |
| catalogo | agentes.ts:62-67,94; score.ts:182,293; releasesPublico:101,131,141 | gate + score + prompt + filtro |
| diferenciais | agentes.ts:95 | prompt do aprofundar |
| concorrentes | agentes.ts:96 | prompt do aprofundar |
| alvoB2B.cnaesAlvo | descobertaBigQuery:44, descobertaPublica:50, score:55 | query + score |
| alvoB2B.regioes | descobertaBigQuery:48, descobertaPublica:57, score:72,250 | query (UFs) + score |
| alvoB2B.portes | score.ts:83 | score |
| alvoB2B.decisor | decisoresPublico:104-110,162 | queries + prompt |
| alvoB2C.regiaoCidade | score.ts:250 | score B2C |

Órfãos (27): subsegmentos, doresResolvidas, resultadosEsperados, casosDeUso, ticketMedio; B2B: faturamentoAnual, numFuncionarios, technographics, sinaisIntencao, influenciadores, usuarioFinal, objecoes, cicloVenda, redFlagsB2B, mustHavesB2B, clientesReferencia; B2C: faixaEtaria, genero, faixaRenda, ocupacao, composicaoFamiliar, tipoRegiao, interesses, canais, habitosConsumo, momentoDeVida, doresDesejos, capacidadePagamento, redFlagsB2C, influenciadoresB2C.

Dados disponíveis em cada ponto (fiar só no que existe):

- Score B2B recebe CnpjData completo: cnae + descrição, porte, capitalSocial, dataInicioAtividade, situação, município/UF, QSA, telefone.
- O Alvo PERSISTIDO guarda o código do CNAE sem a descrição; aprofundar relê o Alvo, então não tem a descrição.
- B2C (Places): nome, telefone, site, rating, totalAvaliacoes, endereço. SEM priceLevel.
- Queries do motor B hoje: só consulta+regiao digitadas pelo usuário. Zero perfil.
- Não existe fonte dura para faturamentoAnual/numFuncionarios (capital social é proxy fraco): esses campos entram como contexto de analista no prompt, e isso conta como consumo legítimo (qualificação via dossiê), documentado aqui.

## Plano das sessões

**Sessão 2 (dossiê/roteiro + decisores):**
- agentes.ts (aprofundar): injetar no prompt os blocos completos do perfil. Comum: subsegmentos, doresResolvidas, resultadosEsperados, casosDeUso, ticketMedio. B2B (quando o alvo é B2B): technographics, sinaisIntencao, objecoes, cicloVenda, faturamentoAnual, numFuncionarios, clientesReferencia, influenciadores, usuarioFinal. B2C (quando o alvo é B2C): faixaEtaria, genero, faixaRenda, ocupacao, composicaoFamiliar, tipoRegiao, interesses, canais, habitosConsumo, momentoDeVida, doresDesejos, capacidadePagamento, influenciadoresB2C.
- Verificador do aprofundar: aplicar redFlagsB2B/mustHavesB2B/redFlagsB2C com descarte motivado (o fluxo descartadosPeloVerificador já existe).
- decisoresPublico: papeisAlvo passa a compor decisor + influenciadores + usuarioFinal (nessa ordem), nas queries e no prompt.
- Testes de captura de prompt (mock do llmRouter): cada campo aparece; red flag casada gera descarte.

**Sessão 3 (descoberta + releases):**
- motorB: quando o usuário não passa regiao, usar alvoB2C.regiaoCidade[0] como default na query do Places (e registrar na resposta que a região veio do perfil).
- descobertaPublica/BigQuery: quando regiaoLivre vem vazia, já caem em alvoB2B.regioes para UFs; conferir e cobrir com teste (query web fallback também).
- releasesPublico: injetar sinaisIntencao + doresResolvidas no prompt de relevância/ângulo.
- Testes por campo + suíte da API completa verde.

**Sessão 4 (prova de ponta a ponta + relatório):**
- Matriz final sem órfão sem justificativa: cada um dos 41 campos com evidência (teste ou file:line).
- Suíte completa + tsc api/web verdes.
- Relatório de evidências comentado no PR #277.
- Encerrar o loop (ScheduleWakeup stop) + PushNotification com o desfecho.

**Regras de toda sessão:** tsc (apps/api e apps/web) e vitest verdes; commit + push na branch; atualizar este arquivo (estado + log). Nunca inventar consumo que o dado não sustenta: campo sem fonte dura vira contexto de prompt documentado, não heurística falsa.

## Delta da sessão 2 (o que deixou de ser órfão)

Fiados no aprofundar (agentes.ts, `montarContextoPerfil` + `criteriosDeCorte`, mecanismo LLM-prompt no dossiê/roteiro): subsegmentos, doresResolvidas, resultadosEsperados, casosDeUso, ticketMedio, faturamentoAnual, numFuncionarios, technographics, sinaisIntencao, objecoes, cicloVenda, clientesReferencia; B2C inteiro: faixaEtaria, genero, faixaRenda, ocupacao, composicaoFamiliar, tipoRegiao, interesses, canais, habitosConsumo, momentoDeVida, doresDesejos, capacidadePagamento, influenciadoresB2C. O bloco entra pelo caminho do ALVO (alvo.kind), não pelo tipoCliente: um Alvo B2C cruza com o público consumidor, não com firmografia.

Fiados como corte com âncora (filter): redFlagsB2B, mustHavesB2B, redFlagsB2C. O modelo só pode citar item copiado literalmente da lista declarada (validação por norm no verificador); confirmado vira `alertasCorte` no resultado e "Atenção do verificador" no resumo persistido do dossiê. Citação fora da lista cai em descartadosPeloVerificador.

Fiados nos decisores (decisoresPublico.ts, `montarPapeisAlvo`, mecanismo query-building + LLM-prompt): influenciadores, usuarioFinal (ordem decisor > influenciador > usuário final, dedupe por caixa/acento, fallback só quando nada declarado).

Órfãos restantes para a sessão 3: NENHUM campo sem consumo, mas duas fiações de DESCOBERTA prometidas: regiaoCidade/regioes como default de região nas queries quando o usuário não informa (motorB + descobertaPublica), e sinaisIntencao+doresResolvidas no prompt de relevância dos releases. Nota: faixaEtaria/regiaoCidade/doresDesejos são obrigatórios da prontidão E agora consumidos (prompt/score); faturamentoAnual/numFuncionarios não têm fonte dura (capital social é proxy fraco), consumo legítimo é contexto de analista no prompt, documentado.

## Log

- 14/07 sessão 1: auditoria via agente (leitura integral dos serviços). 11 de 41 campos consumidos; 27 órfãos. Achado extra: nenhuma referência funcional aos caminhos antigos sobrou (só a featureKey cosmética `mira.perfil.modo`, que fica). Plano acima definido.
- 14/07 sessão 2: aprofundar recebe o Perfil inteiro do caminho do Alvo + critérios de corte com âncora; decisores usam o comitê completo. 15 testes novos (montarContextoPerfil campo a campo, corte ancorado x inventado, persistência do alerta no resumo, papéis compostos). tsc api/web 0; suíte completa 116 arquivos / 1148 testes verdes.
