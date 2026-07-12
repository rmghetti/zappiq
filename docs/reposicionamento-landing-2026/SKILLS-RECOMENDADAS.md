# Skills para manter a landing bem informada e marketeira

Duas perguntas diferentes: como manter a landing sempre com a informação atualizada da plataforma (bem informada), e como manter a copy afiada e no tom certo (marketeira). Cada uma tem a sua skill.

## A recomendação principal: criar a skill `zappiq-landing` (fonte de verdade)

O problema real que a sua pergunta ataca: hoje cada sessão que mexe na landing precisa redescobrir os nomes, os planos, os status e as bandeiras da plataforma, e é aí que entra nome antigo, preço defasado e claim sem lastro (foi exatamente o que a auditoria pegou). A cura estrutural é a mesma lógica da skill `machia`: uma skill dedicada que serve de fonte única de verdade da landing da ZappIQ.

O que ela carregaria (o material desta entrega já é a semente pronta):
- Nomes de produto canônicos (do Sidebar do Dash) e os codinomes proibidos.
- Planos, limites, add-ons e bandeiras invioláveis, com o `_fatos-canonicos.md` como base (extraído do `planConfig.ts`).
- Status honesto por módulo (em produção, parcial, em breve).
- Os guardrails de copy (pt-BR, sem travessão, prova antes de promessa, lista de claims que precisam de `[confirmar]`).
- A arquitetura de mensagem e os blocos de copy aprovados.

Como criar: usar a skill `skill-creator`, empacotando `_fatos-canonicos.md`, o catálogo de produtos e os guardrails. Regra de manutenção: quando o `planConfig.ts` ou o Sidebar mudarem, a skill é reempacotada (mesma disciplina da `machia`). Assim, toda sessão futura escreve landing certa por padrão, sem reauditar.

Posso montar essa skill na sequência, se você aprovar.

## Skills que já existem e valem usar agora

**`voz-humana` (a mais marketeira).** É a camada de limpeza e humanização da MACHIA: deixa a copy natural, sem cara de IA, e aplica a regra sem travessão. Deve ser o último passe em toda copy antes de ir para o ar (home e páginas de produto). É a que mais entrega o "marketeira" que você pediu, sem cair em hype.

**`machia` (a que mantém informada e na marca).** Base oficial de posicionamento, ofertas, preços e tom de voz. Já foi usada nesta entrega para ancorar a categoria e as bandeiras. Continua sendo a régua de marca de qualquer peça.

**`machia-app-privacy` (para as páginas de confiança).** Gera política de privacidade, consentimento, exclusão e material de LGPD a partir de um manifesto. É a skill certa para construir a página /seguranca-lgpd e sustentar os claims do bloco A com base real, não com texto solto.

**`dataviz` (para os blocos visuais que vendem).** Padrão de gráficos e tabelas. Útil no comparativo (ZappIQ vs concorrentes), na calculadora de ROI e nos números de prova, para que fiquem legíveis e consistentes em claro e escuro.

**`machia-command` (para o deploy).** Quando a landing for para produção, os passos que só você pode rodar (env vars na Vercel, redeploy) viram um `.command` clicável, sem falhar na primeira execução.

**`artifact-design`.** Se quisermos um preview visual navegável da nova home antes de codar, é a skill que calibra o quanto investir no design do artefato.

## Ordem de uso sugerida

1. Agora: aprovar a criação da skill `zappiq-landing` (fonte de verdade) a partir desta entrega.
2. Ao escrever a copy final de cada página: passar por `voz-humana`, com a `machia` como régua de marca.
3. Na página de confiança: `machia-app-privacy`.
4. Nos visuais de comparativo e ROI: `dataviz`.
5. No deploy: `machia-command`.

O ganho: a landing deixa de depender de quem está na sessão para estar certa e afiada. A informação vem da fonte de verdade, a voz vem da `voz-humana`, e o risco jurídico fica contido pelos `[confirmar]` até o sign-off.
