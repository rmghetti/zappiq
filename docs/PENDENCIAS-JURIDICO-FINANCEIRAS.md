# Pendências Jurídico-Financeiras — destravadas pela formalização do CNPJ

**Controladora:** ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA
**CNPJ:** 46.788.145/0001-08
**Marca:** ZappIQ
**Status do doc:** backlog estratégico — implementar antes do fechamento do primeiro contrato Enterprise

---

## Contexto

Com o CNPJ formalizado (commit `dcd6171`), três frentes ficaram destravadas. Este documento serve de referência para priorização e implementação quando o momento for oportuno.

Ordem de prioridade sugerida: **1 → 2 → 3** (cada um é pré-requisito do próximo em termos de maturidade comercial).

---

## 1) e-CNPJ A1 — Certificado Digital para assinatura de DPAs

### O que é

Certificado digital ICP-Brasil, emitido em nome da pessoa jurídica, válido por 12 meses. Serve para assinar documentos eletrônicos com validade jurídica plena (MP 2.200-2/2001) — inclusive DPAs (Data Processing Agreements), contratos de prestação de serviço SaaS, NDAs, aditivos contratuais.

### Por que importa

- Assinatura em **ClickSign, D4Sign, DocuSign** com o padrão ICP-Brasil elimina qualquer questionamento jurídico posterior sobre autenticidade.
- Clientes Enterprise com áreas jurídicas maduras (Itaú, B3, grandes varejistas) **exigem** assinatura com e-CNPJ A1, não apenas DocuSign vanilla.
- Equivalente físico da "firma reconhecida" em cartório, com validade nacional.
- Economiza 5–10 dias de ciclo de fechamento em contratos B2B (sem malote, sem cartório, sem digitalização).

### Como implementar

- **Emissor:** Certisign, Serasa, Valid, Soluti — preço R$ 300–500 por ano.
- **Pré-requisitos:** Contrato Social, Cartão CNPJ, RG + CPF do sócio representante, comprovante de endereço da PJ.
- **Agendamento:** validação presencial ou videoconferência (~30 min).
- **Instalação:** arquivo `.pfx` instalado na máquina do administrador ou em cofre digital (recomendado: **AWS KMS ou Azure Key Vault** se tiver multi-administradores).

### Custo

- **R$ 300–500/ano** emissão + **R$ 0** uso na primeira plataforma de assinatura (ClickSign tem plano free até 50 docs/mês).

### Trigger de implementação

Implementar **antes do primeiro contrato Enterprise** fechar. Idealmente, uma semana antes da primeira reunião com jurídico do cliente, para evitar atraso no fluxo.

### Checklist operacional

- [ ] Escolher emissor (recomendado: Certisign pela base instalada)
- [ ] Separar documentação da PJ e do sócio
- [ ] Agendar validação
- [ ] Receber e instalar `.pfx` em máquina segura
- [ ] Cadastrar no ClickSign/D4Sign como modalidade de assinatura padrão
- [ ] Guardar senha em cofre (1Password / Bitwarden Business)
- [ ] Agendar lembrete de renovação 30 dias antes do vencimento

---

## 2) Carta de Designação do DPO (formal, em papel timbrado)

### O que é

Documento formal emitido pela controladora nomeando o Encarregado de Dados Pessoais (DPO) nos termos do **Art. 41 da LGPD**. É o equivalente jurídico do "ato de nomeação" em setor público, adaptado para empresa privada.

### Por que importa

- A LGPD exige a figura do Encarregado (Art. 41, §1º). A designação deve ser **comprovável documentalmente**.
- Em RFP corporativo, procuradores jurídicos dos clientes Enterprise pedem a carta como anexo obrigatório.
- Em caso de fiscalização da ANPD, é o primeiro documento solicitado (Art. 37 c/c Art. 41).
- Fortalece credibilidade em vendas Enterprise — sinaliza maturidade de compliance.

### O que a carta deve conter

1. Identificação completa da controladora (razão social, CNPJ, endereço)
2. Identificação do DPO designado (nome completo, CPF, e-mail institucional, telefone)
3. Base legal da designação (LGPD Art. 41)
4. Poderes e responsabilidades do DPO
5. Data de início da designação
6. Assinatura do representante legal da PJ (idealmente com e-CNPJ A1 — ver item 1)
7. Publicação em canal público (conforme Art. 41 §1º — "identidade e informações de contato do encarregado deverão ser divulgadas publicamente")

### Onde publicar

- Página `/lgpd` do site — **já publicado** (seção "Identificação da Controladora")
- Rodapé do site — **já publicado** (LandingFooter.tsx)
- Anexo em DPAs Enterprise
- Disponível sob solicitação em canal formal (e-mail dpo@zappiq.com)

### Como implementar

1. Redigir carta usando template jurídico-padrão (modelo anexo em `templates/carta-designacao-dpo.docx` — **a criar**)
2. Imprimir em papel timbrado oficial da ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA
3. Assinar fisicamente OU assinar eletronicamente com e-CNPJ A1 (item 1)
4. Digitalizar e arquivar em `docs/legal/designacao-dpo.pdf` (repositório privado)
5. Compartilhar sob NDA com clientes Enterprise quando solicitado

### Custo

- **R$ 0** (redação interna com template) ou **R$ 500–1.500** (se contratar escritório de advocacia para revisão — recomendado para a primeira versão).

### Trigger de implementação

Antes do primeiro RFP Enterprise que mencionar compliance LGPD. Estimativa: **primeiros 30 dias após abrir pipeline comercial**.

### Checklist operacional

- [ ] Criar template `templates/carta-designacao-dpo.docx` baseado em modelo ANPD
- [ ] Revisão por advogado especialista em LGPD (opcional mas recomendado)
- [ ] Imprimir em papel timbrado
- [ ] Assinar (físico ou e-CNPJ A1)
- [ ] Digitalizar e arquivar
- [ ] Atualizar `/lgpd` com link para PDF (se for público) ou menção "disponível sob solicitação"

---

## 3) Conta Stripe Business Brasil — faturamento recorrente em BRL

### O que é

Conta Stripe vinculada ao CNPJ da ONZE E ONZE, habilitada para cobrança em Reais (BRL) com suporte a **Pix, boleto, cartão de crédito recorrente**. Permite automatização total do billing dos planos Starter/Growth/Scale/Enterprise.

### Por que importa

- Elimina dependência de emissor de boleto terceirizado (Iugu, Asaas, PagSeguro Recorrente) — economia de **R$ 150–300/mês** em taxas fixas de plataforma.
- Suporte nativo a **subscriptions recorrentes** com upgrade/downgrade automático, prorata, trial, cupons — tudo via API.
- Integração direta com sistema de billing do ZappIQ (webhook → Prisma → banco de dados).
- **Fraud protection Stripe Radar** incluído (reduz chargeback em ~60%).
- Dashboards financeiros nativos: MRR, churn, LTV, CAC payback — sem precisar de ProfitWell/Baremetrics.
- Suporte a **dunning automation** (retry de pagamentos falhados em 3/5/7 dias com e-mail customizado).
- Expansão internacional trivial quando virar multi-region (Stripe já cobra em USD/EUR nas mesmas APIs).

### Por que agora é possível

- Stripe Brasil exige CNPJ ativo há mais de 6 meses para contas Business (ou CNPJ novo com comprovação de atividade via site + contrato social).
- Com CNPJ 46.788.145/0001-08 formalizado, aplicação pode ser feita **imediatamente**.

### Fluxo de ativação

1. Criar conta em `https://dashboard.stripe.com/register`
2. Selecionar país **Brasil**, tipo **Business / PJ**
3. Informar CNPJ, razão social, endereço da sede, telefone, CNAE principal
4. Vincular conta bancária PJ (Itaú/BB/BRB/Inter/NuBank Business)
5. Enviar docs: contrato social, cartão CNPJ, comprovante de endereço PJ, CPF + RG do representante legal
6. Aguardar aprovação (48–72h úteis)
7. Configurar produtos no dashboard: 4 subscriptions (Starter R$ X, Growth R$ X, Scale R$ X, Enterprise R$ 2.997)
8. Integrar webhook com `apps/api/routes/stripe-webhook.ts` — **a criar**
9. Testar com subscription teste (cartão 4242 4242 4242 4242)

### Custo

- **Taxa Stripe Brasil:** 3,99% + R$ 0,39 por transação cartão / 1,49% Pix (sem taxa fixa) / 3,49% + R$ 0,39 boleto
- **Setup:** R$ 0
- **Mensalidade fixa:** R$ 0

**Comparativo:**
- Iugu: 2,99% + R$ 0,40 + **R$ 49/mês fixo** (plano básico)
- Asaas: 1,99% + R$ 2,49 por boleto + **R$ 0** mas sem recorrência gratuita
- PagSeguro: 3,99% + R$ 0,40 + sem plataforma de recorrência nativa

**Stripe ganha em volume. Para ≥100 transações/mês, payback em ~2 meses.**

### Trigger de implementação

Antes do fim do programa piloto (aproximadamente **60–90 dias**). Clientes piloto podem rodar em faturamento manual (NF + transferência), mas o primeiro cliente pagante público deve cair direto no Stripe.

### Checklist operacional

- [ ] Abrir conta Stripe Business (CNPJ 46.788.145/0001-08)
- [ ] Enviar docs e aguardar aprovação
- [ ] Vincular conta bancária PJ (abrir se não existir — **dependência**)
- [ ] Configurar os 4 planos (Starter/Growth/Scale/Enterprise) com preços em BRL
- [ ] Configurar Radar 360° como add-on (price IDs separados por plano: R$ 197 / R$ 397 / incluso)
- [ ] Criar webhook endpoint em `apps/api/src/routes/stripe-webhook.ts`
- [ ] Configurar secrets no Fly: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Implementar Customer Portal (Stripe nativo — zero código) para cliente alterar cartão/cancelar
- [ ] Testar ciclo completo em staging com cartão de teste
- [ ] Atualizar `/precos` com CTA "Assinar agora" apontando para Stripe Checkout
- [ ] Documentar runbook de reconciliação financeira mensal

---

## Dependências cruzadas

```
[CNPJ formalizado ✓] ──┬──► [e-CNPJ A1] ──► [Carta DPO assinada digitalmente]
                       │
                       ├──► [Conta bancária PJ] ──► [Stripe Business]
                       │
                       └──► [DPA template juridicamente revisado]
```

**Gargalo crítico:** **conta bancária PJ**. Sem ela, Stripe não ativa. Sem Stripe, billing recorrente depende de terceiro com custo fixo mensal.

**Recomendação:** abrir conta PJ em paralelo com a emissão do e-CNPJ A1 — ambos dependem do mesmo conjunto de documentação.

---

## Resumo executivo — custo total de saída de campo

| Item | Custo único | Custo recorrente | Prazo |
|------|-------------|------------------|-------|
| e-CNPJ A1 | R$ 400 | R$ 400/ano | 1 semana |
| Carta DPO + template | R$ 0–1.500 (opcional revisão jurídica) | R$ 0 | 1–2 dias |
| Conta Stripe Business | R$ 0 | 3,99% + R$ 0,39 por transação | 3–5 dias |
| **Total setup inicial** | **R$ 400–1.900** | **Variável com volume** | **~2 semanas** |

**ROI esperado:** destrava fechamento de Enterprise (ticket mínimo R$ 2.997 × 12 = R$ 35.964/ano). **Payback em menos de 1 mês** com o primeiro contrato.

---

## Próxima revisão deste documento

- **Gatilho:** ativação de qualquer um dos 3 itens acima
- **Responsável:** Rodrigo Ghetti
- **Sugestão de mantenimento:** atualizar status ao final de cada implementação e mover item concluído para `docs/legal/` com link para artefatos finais (certificado, carta PDF, conta Stripe ID)

**Histórico:**
- v1.0 — abril/2026 — documento criado após formalização do CNPJ (commit `dcd6171`)
