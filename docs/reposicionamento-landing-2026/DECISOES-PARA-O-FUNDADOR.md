# Decisões que dependem de você antes de publicar

Este é o único bloqueio entre o material e o ar. A auditoria (78 correções aplicadas, ver `AUDITORIA-consistencia.md`) deixou a base factual da plataforma sólida e verificada contra o código (planos, preços, limites, nomes, status: confiança 9/10). O que sobra são 15 decisões que o código não resolve sozinho: claims de fato com risco jurídico, status de deploy e escolhas comerciais. Todos já estão marcados `[confirmar]` no texto, nenhum foi para o ar.

## Atualização 10/07: o que já foi decidido e aplicado

Você reviu esta lista e decidiu. O material foi atualizado de acordo:

- **Bloco A (jurídico): liberado.** Removi os `[confirmar]` dos claims jurídicos (Meta Business Partner, dados no Brasil, SLA 99,9%, comparativos nominais, SOC 2, não-treinamento). Eles agora afirmam direto na copy. Você fará a revisão jurídica própria depois, com o risco assumido.
- **360Dialog: eliminado.** Tirei toda menção a "360Dialog" e "BSP homologado" do material. Onde havia, ficou "Meta Business Partner" ou "parceira da Meta". Pendência de código: as páginas `/legal/parceria-meta` e `/migracao-zenvia` ainda citam 360Dialog e precisam de rewrite (decisão de conteúdo legal, não mexi sozinho).
- **Add-ons: V4 canônica.** O material usa só a lista V4. As inconsistências que sobraram (código e `/billing` ainda com preços legados) estão em `RELATORIO-ADDONS.md`.
- **Bloco B: mantido** como está (Google Calendar, trial do Radar 360, metas do Echo Copilot seguem marcados, você está resolvendo).
- **Onda 0 (código): 3 fixes aplicados** no working tree do `apps/web` (rating fabricado removido, metadata de `/precos` corrigida, destaque só no Growth). Deploy de preview pelo `.command` na sua Mesa.
- **Razão social "ONZE E ONZE":** ainda nas páginas legais (`/lgpd`, `/roadmap`, `/legal/enderecos-comerciais`, `PrelaunchFooter`). O correto é MACHIA Tecnologia Disruptiva Ltda (mesmo CNPJ). Não alterei página legal sozinho; me diga e eu troco.

O que ainda depende de você: a sua revisão jurídica do Bloco A (que já está no ar no material), as pendências de deploy do Bloco B e a decisão comercial dos add-ons. A lista original completa segue abaixo como referência.

---

Para cada item: o que decidir, por que trava, a opção segura sugerida e quem assina.

---

## Bloco A. Claims de risco jurídico (não publicar sem jurídico e engenharia)

**1. Selo "Meta Business Partner".**
Aparece em quase todos os arquivos. O código (CHANGELOG V2-013/V2-014) só evidencia "BSP homologado Meta via 360Dialog", não parceria oficial nomeada. Inclui também a primazia regional "entre as primeiras da América Latina" (variante B da barra de novidade).
Por que trava: afirmar parceria oficial e primazia exige prova de adesão ao programa Meta. Risco CONAR e publicidade enganosa.
Opção segura: usar a fórmula já sancionada no código ("parceria WhatsApp Business via BSP homologado Meta") até haver prova do selo oficial.
Assina: jurídico. Precisa: comprovante do programa Meta, se existir.

**2. Residência de dados no Brasil (São Paulo).**
Presente na maioria dos arquivos. A stack verificada cita Fly.io (região gru), Supabase e Upstash, sem afirmação de residência BR completa. Há inconsistência interna a reconciliar: o dossiê de Treinar IA descreve o motor RAG em "Fly gru"; o de Governança descreve os dados primários em "AWS sa-east-1 via Supabase".
Por que trava: residência de dados é claim de fato com risco jurídico e é argumento central da marca.
Opção segura: engenharia confirmar a topologia real (banco, cache, RAG, blobs) e alinhar as duas descrições numa só, antes de virar selo público.
Assina: engenharia (topologia) e jurídico (redação).

**3. Comparativos nominais de concorrentes.**
Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas, GPT Maker e Zaia, com afirmações sobre cobrança e comportamento. Também as faixas "setup de R$ 1.000 a R$ 8.000" e "fidelidade de 6 a 12 meses".
Por que trava: publicidade comparativa com concorrente nomeado exige evidência documental (CDC e CONAR) para não virar risco de difamação.
Opção segura: manter no ar apenas as bandeiras da ZappIQ (zero setup, mensalidade fixa) sem nomear o concorrente, OU publicar o comparativo com print datado e fonte por linha (já existe a página /legal/benchmarks-concorrentes como base).
Assina: jurídico. Precisa: evidência datada por afirmação.

**4. SLA contratual 99,9% com créditos automáticos, RPO 1h e RTO 4h.**
Em estratégia, blueprint e governança. A flag `slaContractual` existe no código (Scale e Enterprise), mas a página pública /sla ainda mostra a tabela antiga (99,5% alvo, planos Starter/Business).
Por que trava: percentual, créditos, RPO e RTO dependem de contrato e SLA real, não do código.
Opção segura: publicar só o que o contrato assinável garante hoje; atualizar a /sla junto.
Assina: engenharia (o número operável) e jurídico (o contrato).

**5. Notificação de incidente em até 72h.**
Na página de governança.
Por que trava: é claim de processo e jurídico, depende do runbook e do contrato reais.
Assina: jurídico e segurança.

**6. Certificação SOC 2 Type II.**
Atribuída à stack de dados na governança.
Por que trava: só exibir se a certificação de fato existe e está válida.
Opção segura: remover até haver o relatório; se estiver em processo, dizer "em processo".
Assina: você (existe ou não).

**7. Sanção ANPD e cláusula de não-treinamento.**
O valor de sanção (Art. 52 da LGPD, até 2% do faturamento por infração, teto R$ 50 milhões) está correto em lei. A cláusula de não-treinamento e a extensão aos subprocessadores de IA dependem do contrato real.
Assina: jurídico (a cláusula, não o valor legal).

**8. Moldura "infraestrutura Fortune 500" com logos AWS e Cloudflare.**
Na seção de prova do blueprint. A stack verificada cita Fly.io, Supabase e Upstash.
Por que trava: exibir logo de terceiro exige base factual e autorização, e a moldura precisa da lista real de provedores.
Opção segura: trocar por uma descrição fiel da stack real, sem logo de terceiro.
Assina: engenharia (a lista) e jurídico (o uso de marca).

---

## Bloco B. Status de rollout (decisão de produto e deploy)

**9. Status do sync com Google Calendar. PRIORIDADE.**
É o único ponto em que o código contradiz o gabarito e a sua memória. O código (`googleCalendar.ts` com OAuth, freebusy, insert, delete, disconnect, usado em `appointments.ts` e na ARCHITECTURE) mostra o conector implementado e ligado. O gabarito e a sua MEMORY dizem "Fase 2 pendente, falta Google Calendar". O material foi para o lado conservador ("em breve, Fase 2"), o que é seguro publicar.
Por que importa: se o sync já está liberado a clientes, o material está subvendendo uma capacidade que existe. Se não está, as menções remanescentes também devem cair para "em breve".
O que decidir: o conector está liberado em produção para clientes (feature flag ligada) ou só existe no repo?
Assina: você e engenharia.

**10. Radar 360: trial próprio e elegibilidade no plano Lite.**
O add-on não tem `trialDays` no código (diferente de Voz Nativa e Zap Impulso), mas um CTA prometia "Teste o Radar 360 por 14 dias". E `RADAR_360.availableFor` lista STARTER (descontinuado), não o Lite novo (IZA_LITE).
O que decidir: dar trial próprio ao Radar 360 ou só referenciar o trial da plataforma; e corrigir o `availableFor` defasado no código.
Assina: produto e comercial.

**11. Metas de desempenho do Echo Copilot.**
Reduzir 60% do tempo de resposta, cerca de 90% de precisão das sugestões, mais 35% de oportunidades de upsell. Já vêm marcadas `[confirmar]`.
Por que trava: dependem de piloto com cliente real para virar número de landing. Hoje são metas, não capacidade medida.
Opção segura: manter fora da landing até haver dado de cliente, ou rotular explicitamente como meta.
Assina: produto.

**12. Chaves STARTER e BUSINESS no `availableFor` dos pacotes de voz.**
Dívida de código: `VOICE_200/400` inclui STARTER, `600+` inclui BUSINESS, ambos descontinuados. Não é erro de copy, é limpeza de código.
O que decidir: remapear as chaves para Lite/Growth/Scale/Enterprise.
Assina: engenharia.

---

## Bloco C. Decisões comerciais de precificação

**13. Catálogo de add-ons canônico: legado `ADDONS` vs `ADDONS_V4_LIST`.**
Preços divergentes para o mesmo add-on: número WhatsApp R$ 147 (legado) vs R$ 137 (V4); seat R$ 89 vs R$ 79; pacote de 10 mil mensagens R$ 197 vs R$ 179. O /billing hoje mostra o legado; o V4 é mais recente e foi aprovado em 27/05/2026. O material usa a faixa V4 como canônica.
O que decidir: qual conjunto é o oficial, e alinhar /billing e material ao mesmo.
Assina: comercial (você).

**14. Baseline do Enterprise "a partir de R$ 9.900/mês".**
Existe só em comentário de código (`priceMonthly: null`). O material trata como âncora interna, não como preço público.
O que decidir: expor ou não o valor de âncora do Enterprise em algum material.
Assina: comercial (você).

**15. Referência de custo de disparo no WhatsApp (cerca de R$ 0,34 por mensagem).**
No dossiê de Zap Impulso, hedgeado como "referência". Não há número canônico no código, e o passthrough da Meta varia por categoria e período.
O que decidir: confirmar a referência atual antes de publicar, ou trocar por "passthrough da Meta, sob a tabela vigente".
Assina: comercial (você), com o número atual da Meta.

---

## Como despachar rápido

- **Bloco A** vai num pacote só para o jurídico (com a engenharia respondendo topologia de dados e stack real). É o que libera a publicação.
- **Bloco B** é uma conversa de 20 minutos com quem faz o deploy: o item 9 (Google Calendar) é o mais importante, porque pode estar subvendendo capacidade real.
- **Bloco C** são três números que só você define.

Enquanto os `[confirmar]` não caem, a recomendação é publicar a Onda 0 (higiene técnica, ver `03-seo-e-implementacao.md`) e a Onda 1 (reposicionamento da home) usando só os claims já verdadeiros (planos, preços, nomes, o que a plataforma faz), e segurar as páginas de confiança (/seguranca-lgpd, /sla) até o bloco A assinar.
