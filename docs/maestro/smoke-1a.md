# Smoke 1A — Fluxos Ricos (validação manual ponta a ponta)

> Roteiro de verificação para a Spec 1A do Maestro (motor/backend). Os testes unitários
> cobrem a lógica pura (motor, predicados, interpolação, horário, ask). Este roteiro cobre
> o que só dá pra validar com o WhatsApp real: envio de botões/lista/mídia e o inbound.

## Pré-requisitos
- Org com `settings.maestro.enabled = true`.
- Número WhatsApp sandbox conectado (token da org ou global).
- 1 fluxo de teste publicado (autorado via JSON/canvas — a geração por IA desses
  recursos entra na 1B; aqui montamos o grafo manualmente).
- (Opcional p/ horário) `settings.businessHoursConfig = { timezone: "America/Sao_Paulo", days: { "1": {"open":"09:00","close":"18:00"}, ... } }`.

## Casos

1. **Captura + interpolação** — `start → ask("Qual seu nome?") → message("Oi {{vars.nome}}")`.
   - Enviar "João" → bot responde **"Oi João"**. ✓
   - Confirmar `vars.nome` persistido (próxima mensagem ainda interpola).

2. **Captura grava no CRM** — `ask` com `crmField: "name"`.
   - Responder "Maria" → o Contact tem `name = "Maria"` (efeito `update_lead`). ✓

3. **Validação + re-pergunta** — `ask` email com `validation.maxRetries = 2`.
   - Enviar "abc" → recebe `errorMessage` (1ª inválida). ✓
   - Enviar "a@b.com" → segue o fluxo. ✓
   - (Esgotar) enviar inválido 3× → cai no ramo `else` se houver; sem `else`, o fluxo
     **encerra** (não segue o caminho feliz com a var vazia). ✓

4. **Botões** — `message` com `interactive: { type: "button", options: [{id:"planos",title:"Planos"},{id:"sup",title:"Suporte"}] }`.
   - Botões aparecem no WhatsApp (máx 3). Tocar "Planos" → o fluxo ramifica como se o
     usuário tivesse digitado "Planos" (o título vira o texto inbound). ✓

5. **Lista** — `message` com `interactive: { type: "list", options: [...] }` (até 10 itens).
   - Lista aparece sem header em branco. Selecionar item → ramifica pelo título. ✓

6. **Condição por atributo (CRM)** — `condition` com aresta
   `predicates: [{ kind:"contact_attr", field:"tags", op:"contains", value:"vip" }]` + aresta `else`.
   - Contato COM tag `vip` → ramo VIP. Contato SEM → ramo `else`. ✓

7. **Condição por horário** — aresta `predicates: [{ kind:"business_hours", expect:"open" }]`.
   - Dentro do horário configurado → ramo "aberto"; fora → `else`/"fechado".
   - Sem `businessHoursConfig` definido → sempre "fechado" (fail-closed). ✓

8. **Condição composta (E)** — aresta com 2 predicados:
   `[{contact_attr tags contains vip}, {business_hours expect open}]`.
   - Só segue quando **ambos** verdadeiros. ✓

9. **Mídia** — `message` com `media: { type:"image", url:"https://.../catalogo.png", caption:"Catálogo {{vars.nome}}" }`.
   - Imagem chega com a caption interpolada. ✓ (documento idem; áudio por link fica fora da 1A.)

10. **Retomada por timer avalia contexto** — fluxo com `wait` cujo ramo de timeout cai num
    `condition` por `contact_attr`/`business_hours`.
    - Quando o timer dispara, os predicados avaliam o contato/horário reais (o
      `flowScheduler` monta o `EvalContext` via `buildEvalContext`). ✓

## Observações
- Fora da janela 24h da Meta, envios livres (texto/botão/lista/mídia) são bloqueados pela
  regra `meta_24h_window` existente — comportamento esperado.
- Todos os efeitos ricos são **fail-soft**: falha de envio loga `[Maestro] ... falhou` e não
  derruba os demais efeitos do passo.
