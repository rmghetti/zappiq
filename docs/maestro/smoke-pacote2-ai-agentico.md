# Smoke — AI Step Agêntico (Tools / Webhook) — Pacote 2.6

> O nó-IA do fluxo pode usar uma **ferramenta webhook**: o agente decide chamar o endpoint
> do cliente (consultar pedido, agendar, integrar), recebe o resultado e responde. Backend
> testado: content blocks no LLM (4), webhook SSRF-guarded (7), loop agêntico (4); integração
> revisada (sem regressão no caminho ao vivo, 420 testes verdes).

## Pré-requisitos
- Um endpoint HTTP de teste público (ex.: webhook.site, um Cloud Function, ou um endpoint do cliente) que receba POST JSON e devolva um JSON.
- Org com `maestro.enabled=true`, número WhatsApp sandbox, um fluxo com um nó-IA.

## Configurar (no editor)
1. Abrir o fluxo → selecionar o nó-IA → seção **"Ferramentas"** → ligar "Usar uma ferramenta (webhook)".
2. Preencher: **nome** (ex.: `consultar_pedido`), **descrição** ("Consulta o status de um pedido pelo número. Use quando o cliente perguntar do pedido."), **URL** (seu endpoint), **método** (POST), headers opcionais.
3. Salvar/publicar (a validação exige nome + URL http(s)).

## Casos
1. **Tool é chamada** — o cliente pergunta algo que casa com a descrição (ex.: "cadê meu pedido 123?").
   - O agente chama o webhook com os parâmetros que extraiu, recebe a resposta e responde ao cliente usando o resultado. ✓ (No webhook.site dá pra ver a requisição chegando.)
2. **Tool NÃO é chamada** — pergunta fora do escopo da tool → o agente responde normal, sem chamar o webhook. ✓
3. **Webhook fora do ar / erro** — o agente recebe o erro como resultado da ferramenta e **responde mesmo assim** (fail-soft, não trava). ✓
4. **Sem tools (retrocompat)** — nó-IA sem ferramenta configurada → caminho normal idêntico ao de hoje (zero mudança). ✓
5. **Segurança SSRF** — tentar configurar uma URL interna (localhost/IP privado/169.254.169.254) → a chamada é bloqueada (a ferramenta retorna erro, não acessa a rede interna). ✓

## Observações
- **Segurança:** a config (URL/headers) fica salva com o fluxo (visível ao admin). Use um **token de webhook dedicado**, não um segredo mestre. Secret-store criptografado = follow-up.
- Limites: timeout 8s, resposta ≤32KB, máx 3 iterações de ferramenta por turno (anti-loop + custo).
- v1 = webhook tool (a integração universal). Tools built-in (consultar CRM nativo), KB por nó e saída estruturada que escolhe o ramo = follow-ups.
- **Gated + fail-soft:** o caminho agêntico só roda quando o nó-IA tem tools; qualquer erro cai no caminho normal (o cliente sempre recebe resposta).
- Diferencial verificado: nenhum concorrente verificado tem webhook nativo no fluxo conversacional.
