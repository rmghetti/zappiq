# Campanha usa o Perfil de Prospecção (status do loop)

**Missão (pedido do Rodrigo, 14/07, testando o trial):** ao clicar em Nova campanha, os campos "o que procurar" e "onde" nascem em branco, mesmo com o Perfil preenchido. Precisa trazer o que está no Perfil, deixar excluir/adicionar, e **nunca ficar em branco**. E garantir que a campanha use de fato esses dados. Limite: **3 sessões**.

**Estado: sessões 1 e 2 CONCLUÍDAS (14/07). Próxima: sessão 3 (PR + E2E em produção + encerrar).**

## Diagnóstico (sessão 1)

Dois defeitos reais, encadeados:

1. **O texto digitado é ignorado no caminho principal do B2B.** `runDescobertaPublica` monta candidatos por `buscarCnpjsBigQuery(perfil,...)` / `buscarCandidatosIndiceLocal(perfil,...)`, que leem `perfil.alvoB2B.cnaesAlvo`. A `consulta` digitada só entra no fallback web (`if (!usandoCnpjsDiretos)`, descobertaPublica.ts:158). Quando há CNAE numérico no Perfil, o que o cliente digita não muda nada e ele não tem como saber.

2. **CNAE em texto é descartado em silêncio.** Os dois caminhos fazem `String(c).replace(/\D/g,'')` + `filter(length >= 2)` (descobertaBigQuery.ts:44-45, descobertaPublica.ts:51-52). O placeholder do Perfil convida texto (`Ex.: 4651-6 ou 'distribuidoras de TI'`), então "serviços" vira "" e some. O Perfil da MACHIA tem os 5 alvos em texto → BigQuery devolve 0 → cai no fallback web → que usa o campo em branco.

Resultado prático para a MACHIA: a base de 28M CNPJs nunca é usada, e a campanha depende de um texto que o cliente digita do zero.

3. **Lacuna honesta do B2C (RESOLVIDA na sessão 2, com decisão pendente do fundador):** o bloco B2C do Perfil descreve o CONSUMIDOR (faixa etária, renda, interesses), não o tipo de negócio local a procurar no Places. Só `regiaoCidade` tem paralelo direto com "onde". A sessão 1 semeou os alvos de `ocupacao`, e isso estava ERRADO: o placeholder do campo é "Autônomos, CLT, empreendedores" (vínculo de trabalho do consumidor), então a busca viraria "Autônomos em Moema" e devolveria lixo com cara de resultado. Corrigido: no B2C semeamos só a região e a tela explica que o tipo de negócio é da campanha, dizendo por quê. **Decisão do fundador em aberto:** o bloco B2C do Perfil deve ganhar um campo "tipo de negócio local a procurar"? Enquanto não ganha, o B2C não tem como nascer 100% preenchido sem inventar.

## Plano

**Sessão 1:** contrato da campanha vira lista (`alvos[]` + `regioes[]`, 1..N), os motores passam a receber os valores DA CAMPANHA em vez de reler o Perfil, e o wizard semeia os chips do Perfil (editáveis, nunca em branco). Testes provando: seed vem do Perfil, chip removido não vai para a busca, chip adicionado vai.

**Sessão 2 (feita):** alvo numérico e alvo em texto passam a conviver (base oficial para código + busca pública para texto, somando no mesmo conjunto de candidatos, deduplicado). Lacuna do B2C decidida.

**Sessão 3:** E2E em produção com a conta da MACHIA + relatório no PR + encerrar o loop.

**Regras:** tsc api/web e vitest verdes por sessão; commit + push; este arquivo atualizado.

## Log

- 14/07 sessão 1: diagnóstico acima (2 defeitos + 1 lacuna). Branch feat/mira-campanha-usa-perfil criada a partir da main.
- 14/07 sessão 2: as duas fontes SOMAM em vez de ou/ou (antes, bastando um código render candidatos, os alvos em texto do cliente não rodavam, calados; quem declarava "4651-6" e "distribuidoras de TI" perdia metade do que pediu). Sem provedor de busca, o código ainda salva a campanha em vez de 501; só texto e sem provedor continua 501 honesto; código que não rende nada e sem texto vira 422 em vez de campanha vazia sem explicação. Corrigida a semente ERRADA do B2C que eu mesmo fiz na sessão 1 (`ocupacao` significa vínculo de trabalho, não tipo de negócio). 9 testes novos + 2 do B2C reescritos. Suíte 143 arquivos / 1429 testes verdes; tsc api/web 0.
- 14/07 sessão 1 (entrega): contrato virou lista (`alvos[]`/`regioes[]`); `alvosDaBusca.ts` novo com `sementeDaBusca()` (o que o wizard mostra preenchido) e `separarAlvos()` (código de CNAE x atividade em texto); os 3 motores recebem os valores DA CAMPANHA (`buscarCnpjsBigQuery(codigos, regioes)`, `buscarCandidatosIndiceLocal(codigos, regioes)`, `runDescobertaPublica(org, busca, campanha)`, `runMotorB(org, busca, campanha)`); `regiaoBusca.ts` removido (a região deixou de ser default escondido no motor e virou valor da campanha); wizard com chips semeados do Perfil, selo de origem, remover/adicionar, e recusa de disparo sem alvo; 422 `alvos_sem_fonte` quando nenhum alvo tem fonte; nome automático lida com N alvos. 12 testes novos + 3 reescritos para o contrato novo. Suíte 142 arquivos / 1419 testes verdes; tsc api/web 0; registro Saiba mais íntegro. Prova em preview com o Perfil REAL da MACHIA: chips ["serviços","comércio varejista","industria","todos as verticais de serviços","empresas PME"] + "Brasil" chegaram sozinhos; removi "industria", adicionei "6201-5" e o servidor recebeu exatamente os 5 alvos da tela (sem "industria") + ["Brasil"].
