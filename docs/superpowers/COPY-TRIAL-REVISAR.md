# Copy do Trial Enforcement — para aprovação do CEO

Tudo em pt-BR, sem travessão, tom honesto (padrão da casa, sem dark pattern). Está
marcado como provisório no código; ao aprovar (com qualquer ajuste seu), eu sincronizo
a versão final. Passe /voz-humana se quiser um último polimento.

---

## 1. E-mails de contagem regressiva (cliente) — `trialReminder.ts`

Um template só, muda por dias restantes.

**T-3 (faltam 3 dias)**
- Assunto: `Faltam 3 dias de teste, veja o plano ideal pra você`
- Corpo: "Oi, {nome}. Faltam 3 dias para o fim do seu teste de 14 dias. Depois disso, o acesso fica pausado até você escolher um plano. É rápido garantir a continuidade."

**T-2 (faltam 2 dias)**
- Assunto: `Faltam 2 dias de teste, veja o plano ideal pra você`
- Corpo: mesma linha com "2 dias".

**T-1 (falta 1 dia)**
- Assunto: `Falta 1 dia de teste, garanta seu plano com 20% off no anual`
- Corpo: mesma linha com "1 dia".

**T-0 (o teste terminou)**
- Assunto: `Seu teste terminou, escolha um plano para continuar na ZappIQ`
- Corpo: "Oi, {nome}. Seus 14 dias de teste terminaram. Seu acesso à plataforma fica pausado até você escolher um plano. Tudo que você configurou (documentos, processos, tom de voz da sua IA) continua salvo, esperando você voltar."

**Blocos comuns a todos:**
- Empurra anual: "No plano anual você economiza 20%. Mesmo produto, dois meses de graça no ano. É a opção que mais vale a pena."
- Quando há plano recomendado: "Recomendado pra você: {Plano}, R$ {X}/mês no plano anual (20% de desconto), escolhido pelo seu padrão de uso no teste."
- CTA: "Garantir meu plano" (T-3/2/1) / "Escolher meu plano" (T-0)
- Rodapé: "Sem contratação automática. Sem surpresa no boleto. Cancela quando quiser." + "Qualquer dúvida sobre plano, integração ou preço, responda este e-mail. Eu leio." + assinatura "Rodrigo Ghetti, Founder, ZappIQ".

---

## 2. E-mail de carência (as 8 orgs já vencidas) — `seedPaywallGrace.ts`

- Assunto: `Seu teste gratuito terminou, você ainda tem acesso por alguns dias`
- Corpo: "Oi, {nome}. Passando para avisar que o teste gratuito de 14 dias da {Org} chegou ao fim. Para você não parar do nada, liberamos acesso para a sua conta até {dd/mm/aaaa}. Depois dessa data, o acesso fica reservado a quem já escolheu um plano. Se a ZappIQ está ajudando o seu time, escolha o plano ideal e siga sem interrupção." + CTA "Escolher meu plano".

---

## 3. Paywall no dashboard — `RecommendationHero.tsx` + `PaywallGate.tsx`

- Título (trial vencido / bloqueio): "Seu teste terminou. Escolha um plano para continuar."
- Título (trial acabando, via link): "Seu teste está acabando. Garanta seu plano sem interrupção."
- Selo do card recomendado: "Recomendado pra você" + "Plano {X}" + "R$ {Y}/mês no anual" + "Você economiza R$ {Z} no primeiro ano."
- Faixa de carência (soft): "Seu teste terminou. Você mantém acesso por mais {N} dias, escolha um plano agora para continuar sem interrupção."
- Faixa de pagamento pendente (past_due): "Pagamento pendente. Atualize seu método de pagamento para não perder o acesso."
- Addons: "Adicione serviços extras ao pacote" + "Os addons marcados entram junto na sua assinatura."

---

## 4. Banner de contagem regressiva (durante o trial) — `TrialSavingsBanner.tsx`

- Linha de status: "Dia {X} de 14 · faltam {Y} dias" (ou "termina hoje").
- Cor: neutro > amarelo (≤3 dias) > vermelho (≤1 dia).
- CTA: "Escolher plano" (≤3 dias) / "Converter trial".

---

## 5. Digest ao superadmin (interno, founders@ + Slack)

Interno, não precisa de voz-humana. Assunto: `Digest trials {data}: {N} orgs precisam de ação`.
Slack: "⏳ Trials precisando de ação · {data}" + lista com org, dias, contato e plano sugerido.
