# Relatório de inconsistências de add-ons (para estudarmos)

Você pediu para desconsiderar os add-ons que não fazem mais parte da plataforma e reportar o que sobrou inconsistente. Fiz isso: o material de marketing agora usa apenas a **lista V4 canônica** (aprovada em 27/05/2026). O que segue são as inconsistências que estão no CÓDIGO e na UI de cobrança, que dependem de decisão comercial e de uma limpeza de engenharia, não de copy.

## O que o material passou a usar (V4 canônica)

| Add-on | Preço V4 (usado no material) |
|---|---|
| WhatsApp Business, número extra | R$ 137/mês |
| Instagram Direct, extra | R$ 97/mês |
| Atendente (seat) extra | R$ 79/mês |
| Pacotes de mensagens de IA | R$ 99 a R$ 749 |
| Contatos +5k / +25k | R$ 59 / R$ 199 |
| Agendamento pela IA | R$ 49 (incluído do Growth pra cima) |
| Radar 360 | R$ 397 |
| Voz Nativa (6 pacotes) | R$ 79,90 a R$ 929,90 |
| Zap Impulso | Start R$ 197 / Pro R$ 597 / Scale R$ 1.297 (trial próprio 7 dias) |

## As inconsistências que sobraram (no código, não na copy)

**1. Dois sistemas de add-on convivem no `planConfig.ts`.** Existe o mapa legado `ADDONS` e o `ADDONS_V4_LIST`. Para o mesmo add-on, preços diferentes: número WhatsApp R$ 147 (legado) contra R$ 137 (V4); seat R$ 89 contra R$ 79; pacote de 10 mil mensagens R$ 197 contra R$ 179. O material adotou o V4. **Ação sugerida:** confirmar o V4 como oficial e remover o mapa legado do código, para não haver duas verdades.

**2. A tela de cobrança (`/billing`) mostra os preços LEGADOS.** O cliente que abre o `/billing` hoje vê R$ 197 (pacote de mensagens), R$ 247 (pacote de disparos), R$ 89 (seat) e R$ 147 (número WhatsApp), que são os preços antigos, não o V4. **Ação sugerida:** alinhar a UI do `/billing` à tabela V4, senão o preço no material e o preço na hora de comprar vão divergir.

**3. Voz Nativa tem duas gerações de preço.** Os IDs de Stripe v1 (base OpenAI, R$ 89,90 a R$ 1.299,90) seguem ativos para clientes anteriores a 04/05/2026. A copy nova cita só o V4 (R$ 79,90 a R$ 929,90), o que está correto. **Ação sugerida:** nenhuma na copy; só garantir que material novo nunca cite a faixa v1.

**4. Chaves de plano depreciadas no `availableFor`.** Os pacotes de Voz Nativa ainda listam disponibilidade em STARTER e BUSINESS (planos descontinuados) no código. **Ação sugerida:** remapear para Lite/Growth/Scale/Enterprise (limpeza de engenharia, sem impacto de copy).

**5. Radar 360, elegibilidade e trial.** No código, `RADAR_360.availableFor` inclui STARTER (descontinuado) e não o Lite novo, e o add-on não tem `trialDays` (diferente de Voz e Impulso). O material foi para o lado conservador (referencia o trial da plataforma, não promete trial próprio, marcado no Bloco B). **Ação sugerida:** decidir se o Radar 360 ganha trial próprio e corrigir o `availableFor`.

## Resumo da decisão comercial

Uma decisão resolve quase tudo: **cravar o V4 como a tabela única de add-ons**, alinhar o `/billing` a ela e aposentar o mapa legado no código. O material já está pronto para esse cenário. As chaves depreciadas (STARTER/BUSINESS) e o trial do Radar 360 são limpezas de engenharia que entram junto.
