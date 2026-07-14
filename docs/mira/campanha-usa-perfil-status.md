# Campanha usa o Perfil de Prospecção (status do loop)

**Missão (pedido do Rodrigo, 14/07, testando o trial):** ao clicar em Nova campanha, os campos "o que procurar" e "onde" nascem em branco, mesmo com o Perfil preenchido. Precisa trazer o que está no Perfil, deixar excluir/adicionar, e **nunca ficar em branco**. E garantir que a campanha use de fato esses dados. Limite: **3 sessões**.

**Estado: sessão 1 EM ANDAMENTO.**

## Diagnóstico (sessão 1)

Dois defeitos reais, encadeados:

1. **O texto digitado é ignorado no caminho principal do B2B.** `runDescobertaPublica` monta candidatos por `buscarCnpjsBigQuery(perfil,...)` / `buscarCandidatosIndiceLocal(perfil,...)`, que leem `perfil.alvoB2B.cnaesAlvo`. A `consulta` digitada só entra no fallback web (`if (!usandoCnpjsDiretos)`, descobertaPublica.ts:158). Quando há CNAE numérico no Perfil, o que o cliente digita não muda nada e ele não tem como saber.

2. **CNAE em texto é descartado em silêncio.** Os dois caminhos fazem `String(c).replace(/\D/g,'')` + `filter(length >= 2)` (descobertaBigQuery.ts:44-45, descobertaPublica.ts:51-52). O placeholder do Perfil convida texto (`Ex.: 4651-6 ou 'distribuidoras de TI'`), então "serviços" vira "" e some. O Perfil da MACHIA tem os 5 alvos em texto → BigQuery devolve 0 → cai no fallback web → que usa o campo em branco.

Resultado prático para a MACHIA: a base de 28M CNPJs nunca é usada, e a campanha depende de um texto que o cliente digita do zero.

3. **Lacuna honesta do B2C:** o bloco B2C do Perfil descreve o CONSUMIDOR (faixa etária, renda, interesses), não o tipo de negócio local a procurar no Places. Só `regiaoCidade` tem paralelo direto com "onde". Registrado; decidir na sessão 2 se vira campo novo ou se semeia de `ocupacao`.

## Plano

**Sessão 1:** contrato da campanha vira lista (`alvos[]` + `regioes[]`, 1..N), os motores passam a receber os valores DA CAMPANHA em vez de reler o Perfil, e o wizard semeia os chips do Perfil (editáveis, nunca em branco). Testes provando: seed vem do Perfil, chip removido não vai para a busca, chip adicionado vai.

**Sessão 2:** alvo numérico e alvo em texto passam a conviver (BigQuery para código + web para texto, não ou/ou), com a origem visível no resultado. Decidir a lacuna do B2C. Testes.

**Sessão 3:** E2E em produção com a conta da MACHIA + relatório no PR + encerrar o loop.

**Regras:** tsc api/web e vitest verdes por sessão; commit + push; este arquivo atualizado.

## Log

- 14/07 sessão 1: diagnóstico acima (2 defeitos + 1 lacuna). Branch feat/mira-campanha-usa-perfil criada a partir da main.
