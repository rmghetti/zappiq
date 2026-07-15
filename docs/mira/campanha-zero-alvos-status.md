# Campanha voltando com 0 alvos (status do loop)

**Missão:** a "campanha 1 de teste" do Rodrigo devolveu 0 alvos. Garantir que a campanha traga alvos de verdade. Limite: **4 sessões**.

**Estado: sessões 1, 2 e 3 CONCLUÍDAS (14/07). Próxima: sessão 4 (rematerializar o espelho + deploy + campanha real).**

## Diagnóstico (sessão 1)

Três defeitos empilhados, do mais grave ao mais sutil:

1. **A campanha mentiu.** Registro: `status: CONCLUIDA`, `buscas: 0`, tudo zero. Log de enriquecimento: **3 buscas, todas `resultado: erro`**, `pegada_publica:google_cse`, latência 47ms. O `catch` engolia o erro com um `logger.warn` e seguia, então falha de fonte virava "não achei ninguém". O cliente não tem como distinguir mercado vazio de motor quebrado.

2. **A API de busca está desligada no Google Cloud.** Motivo exato, colhido da máquina de produção: `403 forbidden | "This project does not have the access to Custom Search JSON API."` As chaves (`GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX`) existem; a API é que nunca foi habilitada no projeto. **Ação de console, pendente na sessão 2.**

3. **O BigQuery pago nunca foi usado.** `BIGQUERY_PROJECT_ID` + credenciais configurados, espelho `cnpj_ativos` com 28M empresas ATIVAS (BD Pro, R$37/mês). Mas a tabela espelho só tem `cnpj, nome_fantasia, cnae_fiscal_principal, sigla_uf, id_municipio` — **sem descrição de atividade** — e filtra por prefixo numérico. Os 5 alvos do Perfil da MACHIA são texto ("serviços", "comércio varejista"...), então `codigos = []` e o BigQuery **nem foi chamado**. A fonte boa, paga, ficou parada enquanto tudo dependia da web quebrada.

## Entregue na sessão 1

- **Honestidade:** erro de fonte agora estoura 502 `fonte_falhou` com o motivo; a campanha fica **FALHOU** com `{motivo, detalhe}` gravado, e a rota devolve texto legível dizendo que nada foi criado e nada foi descontado da cota. Falha parcial (uma fonte quebra, a outra entrega) vira `avisos[]` no resultado, sem derrubar a campanha.
- **`cnaeMapa.ts`:** atividade escrita → prefixo de CNAE (estrutura oficial da CNAE 2.3, seções e divisões). Determinístico, sem LLM: código de atividade é fato, e palpite errado aqui manda a campanha inteira para o setor errado. Os 5 alvos da MACHIA agora viram ~40 divisões; "empresas PME" corretamente NÃO traduz (é porte, não ramo) e segue para a web.
- **Roteamento novo:** código → base oficial; texto que traduz → **também** base oficial (fonte melhor, sem cota de busca); só o intraduzível vai para a web.

## Plano

**Sessão 2 (feita):** PR #288, CI verde, merge (6492878), deploy pelo CI. **Decisão revista:** NÃO habilitei a Custom Search API. Com o cnaeMapa, a campanha da MACHIA vai para o BigQuery e não precisa da web; habilitar a API mexe no projeto GCP do Rodrigo e tem cota grátis de 100/dia com cobrança acima disso. Vira decisão dele, com evidência na mão, em vez de eu mexer por conta própria. A busca pública segue como fallback só para atividade que não traduz.
**Sessão 3 (feita):** campanha real rodada em produção. O cnaeMapa FUNCIONOU (`fonte: bigquery`, **300 candidatos encontrados**, contra 0 antes), mas os alvos continuaram 0. Causa final achada: **a BrasilAPI responde 403 para a máquina de produção**. Confirmado dos dois lados: 200 do Mac do Rodrigo (Brasil), 403 de iad (EUA). A API roda em iad porque gru não tinha capacidade, e a BrasilAPI só atende IP brasileiro. Isso quebra TODA verificação de CNPJ em produção, não só a campanha (o Mapear carteira também). Decisão do Rodrigo: **enriquecer da base BD Pro que ele já paga**, em vez de mover região ou trocar de provedor.
**Sessão 4:** rematerializar o espelho com as colunas novas (job mensal, ~120GB de teto), deployar, rodar a campanha real e provar alvos > 0. Relatório e encerrar.

## Verdade a dizer ao Rodrigo

O alvo "empresas PME" é PORTE, não ramo: pertence ao campo Portes, não ao de atividades. E "serviços" + "Brasil" é o setor terciário inteiro do país: mesmo com tudo funcionando, isso traz empresa aleatória, não prospecção. O filtro que separa é sinal de intenção, que base de CNPJ nenhuma tem. Vale ele estreitar o alvo (ex.: "clínicas", "indústrias metalúrgicas" + UF) para a campanha render.

## Log

- 14/07 sessão 3: campanha real em prod provou o cnaeMapa (300 candidatos via bigquery) e revelou a causa final: BrasilAPI 403 em iad / 200 no Brasil. Entregue: espelho estendido com razão social + QSA + firmografia (empresas + socios do BD Pro, a MESMA Receita, sem bloqueio de região), `enriquecerCnpjsBigQuery()` (uma query em lote no lugar de N chamadas HTTP), BrasilAPI vira reserva, e verificação que quebra agora estoura 502 `verificacao_falhou` em vez de 0 calado (mesma regra da busca). 3 testes novos. Suíte 144 arquivos / 1442 testes verdes. **PENDENTE: o espelho precisa ser rematerializado para ganhar as colunas novas; até lá o código degrada para a BrasilAPI (que 403).**
- 14/07 sessão 2: **espelho do BigQuery testado EM PRODUÇÃO**: `SELECT COUNT(*) FROM zappiq-prod.mira.cnpj_ativos WHERE STARTS_WITH(cnae_fiscal_principal,'47')` devolveu **5.216.016** varejistas ativos. A fonte boa responde e tem dado real; ela só estava inalcançável porque ninguém traduzia "comércio varejista" para "47". Também confirmado que `BIGQUERY_MIRROR_TABLE` vem undefined no ambiente mas o zod tem default (`mira.cnpj_ativos`), então não é problema. PR #288 mergeada e deployada.
- 14/07 sessão 1: diagnóstico dos 3 defeitos + honestidade da falha + cnaeMapa (8 testes) + roteamento novo (10 testes reescritos para a regra nova, incluindo a reprodução da campanha 1 de teste). Suíte 144 arquivos / 1439 testes verdes; tsc api/web 0.
