# Campanha voltando com 0 alvos (status do loop)

**Missão:** a "campanha 1 de teste" do Rodrigo devolveu 0 alvos. Garantir que a campanha traga alvos de verdade. Limite: **4 sessões**.

**Estado: sessão 1 CONCLUÍDA (14/07). Próxima: sessão 2 (habilitar a API no GCP + deploy).**

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

**Sessão 2:** habilitar a Custom Search JSON API no projeto GCP (Chrome, autorização permanente do Rodrigo), PR + merge + deploy.
**Sessão 3:** rodar campanha real em produção na conta da MACHIA e provar alvos > 0 com dossiê.
**Sessão 4:** folga para o que a sessão 3 revelar; relatório e encerrar.

## Verdade a dizer ao Rodrigo

O alvo "empresas PME" é PORTE, não ramo: pertence ao campo Portes, não ao de atividades. E "serviços" + "Brasil" é o setor terciário inteiro do país: mesmo com tudo funcionando, isso traz empresa aleatória, não prospecção. O filtro que separa é sinal de intenção, que base de CNPJ nenhuma tem. Vale ele estreitar o alvo (ex.: "clínicas", "indústrias metalúrgicas" + UF) para a campanha render.

## Log

- 14/07 sessão 1: diagnóstico dos 3 defeitos + honestidade da falha + cnaeMapa (8 testes) + roteamento novo (10 testes reescritos para a regra nova, incluindo a reprodução da campanha 1 de teste). Suíte 144 arquivos / 1439 testes verdes; tsc api/web 0.
