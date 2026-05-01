# Governança — `apps/web/app/legal/`

> **STOP.** Antes de alterar qualquer arquivo nesta pasta, leia este documento. Não é burocracia — é o que evita reprovação Meta Tech Provider e processo administrativo ANPD.

---

## Regra única

**Nenhuma alteração em página legal pública é mergeada sem:**

1. Aprovação prévia por Rodrigo Ghetti (DPO ZappIQ).
2. Patch detalhado escrito em `~/Pessoal/ZappIQ/ZappIQ_V32_Actions/governanca/patches/<data>_<assunto>.md`.
3. Checklist de Consistência (seção C abaixo) executado e arquivado.
4. Smoke tests `grep` passando.
5. Entrada nova em `~/Pessoal/ZappIQ/ZappIQ_V32_Actions/governanca/MUDANCAS_HISTORICO.md`.

Nenhum atalho. Mesmo correção de typo passa pelo workflow.

---

## SOP completa

`~/Pessoal/ZappIQ/ZappIQ_V32_Actions/governanca/SOP_DOCUMENTACAO_LEGAL_PUBLICA.md`

Inclui matriz de gatilhos (que tipo de mudança no resto do produto força revisão de quais páginas), checklist de consistência cruzada, RACI, e workflow operacional.

---

## Páginas que esta governança cobre

- `privacidade/page.tsx` — LGPD, sub-processadores, retenção, DPO
- `termos/page.tsx` — Contrato, SLA, conformidade Meta
- `cookies/page.tsx` — Política de cookies
- `dpa/page.tsx` — Data Processing Agreement enterprise
- `enderecos-comerciais/page.tsx` — Identificação societária
- `fair-use/page.tsx` — Uso justo do Serviço
- `parceria-meta/page.tsx` — Cloud API direta, Tech Provider
- `deletar-dados/page.tsx` — Self-service LGPD Art. 18

Se você está adicionando uma nova página legal, atualize a SOP antes do merge.

---

## Smoke tests obrigatórios pré-merge

```bash
# Termos NÃO pode mencionar treinamento de modelos (conflita com Privacy)
curl -s https://zappiq.com.br/legal/termos | \
  grep -iE "treinamento|treinar|melhorias contínuas|agregados an" && \
  echo "ALERTA: Termos voltaram a ter cláusula de treinamento implícito" && exit 1

# Privacy precisa ter cláusula de não-treinamento
curl -s https://zappiq.com.br/legal/privacidade | \
  grep -q "não treina modelos" || \
  { echo "ALERTA: cláusula de não-treinamento sumiu da Privacy" && exit 1; }

# Termos precisam citar políticas Meta
for policy in \
  "WhatsApp Business Messaging Policy" \
  "WhatsApp Business Policy" \
  "Meta Commerce Policy"; do
  curl -s https://zappiq.com.br/legal/termos | grep -q "$policy" || \
    { echo "ALERTA: faltando '$policy' nos Termos" && exit 1; }
done

# Datas precisam estar separadas (publicação ≠ vigência) — anti-antedatação
curl -s https://zappiq.com.br/legal/privacidade | grep -q "Publicada em" || \
  { echo "ALERTA: Privacy voltou a ter data única (antedatação)" && exit 1; }
curl -s https://zappiq.com.br/legal/termos | grep -q "Publicado em" || \
  { echo "ALERTA: Termos voltaram a ter data única (antedatação)" && exit 1; }

echo "Smoke tests OK"
```

---

## Por que isto existe

Em 27/04/2026 detectamos que Privacy V3.2 (não-treinamento explícito) coexistia em produção com Termos V2 que dizia "uso de agregados anônimos para melhorias contínuas". Auditor Meta lê os dois lados e bate o olho na contradição. Reprovação por inconsistência documental degrada reputação 3 meses.

Resultado: criamos a SOP e este arquivo.

---

## Owner formal

- **DPO + Aprovador:** Rodrigo Ghetti (rodrigo.ghetti@zappiq.com.br)
- **Implementador:** dev lead da plataforma web
- **Auditor automático:** scheduled task `weekly-legal-docs-audit` (segunda 09:30)
- **Consultor de redação:** Claude (Cowork)

---

*Atualizado em 27/04/2026.*
