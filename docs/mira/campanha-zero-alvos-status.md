# Campanha voltando com 0 alvos (status do loop)

**Missão:** a "campanha 1 de teste" do Rodrigo devolveu 0 alvos. Garantir que a campanha traga alvos de verdade. Limite: **4 sessões**.

**Estado: RESOLVIDO em 14/07/2026, nas 4 sessões. Campanha real em produção devolveu 10 alvos metalúrgicos em SP, 6 prontos, 17 decisores.**

## A prova (sessão 4, produção, conta da MACHIA)

Campanha "Metalúrgicas em SP (mira calibrada)", alvo `indústrias metalúrgicas`, região `SP`:

```
{"fonte":"bigquery","encontrados":300,"cnpjsVerificados":10,
 "criados":10,"prontos":6,"quota":{"used":8,"total":10}}
```

Os 10 alvos vieram todos com CNAE 24xx (metalurgia): ferro-ligas, perfilados, alumínio, fundição. 6 READY com decisores e telefone; 4 QUALIFYING (firma individual, sem quadro societário, então não passam no gate). 17 decisores criados. Isolamento conferido: **0 alvos em outras orgs**.

## Os quatro defeitos, empilhados

O "0 alvos" não tinha uma causa. Tinha quatro, e cada conserto revelava o próximo.

1. **A campanha mentia.** `status: CONCLUIDA`, `buscas: 0`, tudo zero — mas o log tinha 3 buscas com `resultado: erro`. Um `catch` com `logger.warn` transformava falha de fonte em "não achei ninguém". O cliente não tinha como distinguir mercado vazio de motor quebrado.

2. **A API de busca estava desligada no GCP.** `403 | "This project does not have the access to Custom Search JSON API."` As chaves existiam; a API nunca foi habilitada. **Deliberadamente NÃO habilitada:** com o cnaeMapa, a campanha vai para o BigQuery e não precisa da web. Habilitar mexe no projeto GCP do Rodrigo e tem cobrança acima de 100/dia. Decisão dele, com evidência na mão.

3. **O BigQuery pago nunca era chamado.** O espelho (28M empresas, BD Pro, R$37/mês) filtra por prefixo de CNAE, mas os alvos do Perfil são texto ("serviços", "comércio varejista"). `codigos = []` → BigQuery nem chamado. A fonte boa, paga, parada, enquanto tudo dependia da web quebrada. Consertado com `cnaeMapa.ts` (atividade escrita → divisão da CNAE 2.3, determinístico, sem LLM).

4. **A BrasilAPI bloqueia a produção.** Com o cnaeMapa, a campanha achou **300 candidatos** — e criou 0. Causa: `403` para a máquina de produção. Confirmado dos dois lados: **200 do Mac do Rodrigo (Brasil), 403 de iad (EUA)**, resposta com id `iad1::`. A API roda em iad porque gru não tinha capacidade, e a BrasilAPI só atende IP brasileiro. Isso quebrava **toda** verificação de CNPJ, o Mapear carteira junto. Decisão do Rodrigo: enriquecer da base BD Pro que ele já paga.

5. **O quinto, o pior: o schema perdeu um campo.** Com a verificação consertada (10 CNPJs verificados), ainda `criados: 0`. Os três motores gravam `telefone` no MiraAlvo; a migração `20260711000001_mira_prospects` **cria** a coluna no banco (linha 57); o `schema.prisma` **não a declara**. Todo `create` estourava `Unknown argument telefone`. Nunca apareceu porque a verificação falhava antes e o create nunca rodava. **`SELECT count(*) FROM mira_alvos` = 0: nenhum alvo foi criado por nenhum motor desde que o produto nasceu.**

## A lição que vale mais que os consertos

O defeito 5 ficou invisível para o tsc porque os motores chamavam `(prisma as any).miraAlvo.create`. O cast estava lá para calar um erro de Json (`interface` não satisfaz `InputJsonValue`) e desligou a checagem do **payload inteiro**. Um atalho de tipagem custou o produto.

Regra que fica: **`as any` no client do Prisma esconde drift entre schema e código.** Afrouxar só o valor Json (`as Prisma.InputJsonValue`), nunca o client. Melhor ainda: `type` em vez de `interface` no que vai para coluna Json, porque alias tem índice implícito.

## Entregue

- **PR #288** — honestidade da falha (502 `fonte_falhou`, campanha FALHOU com motivo) + `cnaeMapa.ts` + roteamento (código→base oficial; texto que traduz→**também** base oficial; só o intraduzível→web).
- **PR #289** — espelho estendido com razão social + QSA + firmografia (JOIN `empresas` + `socios`), `enriquecerCnpjsBigQuery()` (uma query em lote no lugar de N chamadas HTTP), BrasilAPI vira reserva, 502 `verificacao_falhou`.
- **PR #290** — `telefone` no schema, `as any` fora de todo caminho de escrita do Mira, 502 `gravacao_falhou`, rota para de mentir (cada motivo de 502 conta a verdade do seu estágio), teste de contrato schema↔motores.
- **PR #291** — 15 ramos da indústria com divisão própria. A campanha calibrada saiu de 2 para 6 prontos, e de "móveis e máquinas agrícolas" para metalurgia pura.

Fly v353. Espelho rematerializado: 28.088.858 empresas ativas, snapshot 2026-06-14, 14 segundos, 23,5 GiB (dentro do 1 TiB/mês grátis; teto de 120 GB folgado).

## Verdade a dizer ao Rodrigo

- **"empresas PME" é PORTE, não ramo.** Pertence ao campo Portes, não ao de atividades. Corretamente não traduz e vai para a web.
- **"serviços" + "Brasil" é o setor terciário inteiro do país.** Mesmo funcionando, traz empresa aleatória, não prospecção. O filtro que separa é sinal de intenção, que base de CNPJ nenhuma tem.
- **Estreitar o alvo funciona** (era o conselho; a PR #291 fez ele valer): "indústrias metalúrgicas" + SP devolveu metalurgia de verdade.

## Dívidas conhecidas (não bloqueiam)

- `municipio` vem `null`: o espelho tem `id_municipio` (código), e falta a tradução para nome.
- O resumo diz "atividade nao informada": falta a tabela de descrição de CNAE.
- Decisores exibem a qualificação crua ("49", "22") em vez do papel legível.
- Firma individual (sem QSA) não passa no gate e para em QUALIFYING. É correto hoje, mas vale decidir se MEI/EI deveria ter caminho próprio.

## Log

- 14/07 sessão 4: **RESOLVIDO com prova.** Espelho rematerializado (28M linhas), PR #289 + #290 + #291 mergeadas e deployadas (v351→v353), defeito 5 (telefone fora do schema) achado pela campanha real, `as any` varrido das escritas, campanha final com 10 alvos metalúrgicos / 6 prontos / 17 decisores.
- 14/07 sessão 3: campanha real provou o cnaeMapa (300 candidatos via bigquery) e revelou a BrasilAPI 403 em iad / 200 no Brasil. Espelho estendido, enriquecimento em lote, 502 `verificacao_falhou`.
- 14/07 sessão 2: espelho testado em prod (`STARTS_WITH(cnae,'47')` → **5.216.016** varejistas). A fonte boa respondia; ninguém traduzia "comércio varejista" para "47". PR #288 mergeada.
- 14/07 sessão 1: diagnóstico dos 3 primeiros defeitos + honestidade + cnaeMapa (8 testes) + roteamento.
