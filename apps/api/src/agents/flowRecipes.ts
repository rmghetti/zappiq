/**
 * ZappIQ Maestro — Receitas e spec de blocos p/ prompt de geração de fluxo (1B)
 * =============================================================================
 * Módulo puramente de dados: exporta strings/records usados pelo promptEngine
 * para construir o prompt que pede ao LLM um "plano de blocos" (block plan).
 *
 * Nenhuma lógica, nenhum IO — apenas constantes.
 * =============================================================================
 */

import type { BlueprintGoal } from './flowBlueprints';

// ---------------------------------------------------------------------------
// BLOCK_SPEC
// Descrição compacta (pt-BR) de cada tipo de bloco e seus slots.
// O LLM usa isso como referência ao montar o block plan.
// ---------------------------------------------------------------------------

export const BLOCK_SPEC: string = `
TIPOS DE BLOCO DISPONÍVEIS
===========================

Regras gerais:
- Use APENAS os tipos listados abaixo. Não invente tipos.
- Textos são mensagens de WhatsApp: curtos, diretos, sem markdown pesado.
- ask_buttons aceita no máximo 3 opções; sempre inclua um caminho "Outro" ou elseNext.
- Todo bloco deve ter "id" único (ex.: b1, b2, b3...) e um "type".
- "next" aponta para o id do próximo bloco; se omitido, o fluxo encerra.

---

1. message
   Envia uma mensagem de texto ao contato.
   Slots: { text: string, next?: string }
   Exemplo: { "id":"b1", "type":"message", "text":"Olá! Como posso ajudar?", "next":"b2" }

2. ask
   Faz uma pergunta e captura a resposta do usuário em uma variável.
   Slots:
     question: string           — a pergunta exibida
     varName: string            — nome da variável para guardar a resposta (camelCase)
     validationType?: "text" | "number" | "email" | "phone"  — validação opcional
     errorMessage?: string      — mensagem se a resposta for inválida
     crmField?: "name" | "email" | "company" | "funnelStage" | "leadScore"  — salva no CRM
     next?: string              — bloco seguinte (depois de capturar)
   Exemplo: { "id":"b2", "type":"ask", "question":"Qual é o seu e-mail?", "varName":"email", "validationType":"email", "crmField":"email", "next":"b3" }

3. ask_buttons
   Apresenta uma pergunta com opções de botão (máx. 3). Cada opção tem seu próprio "next".
   Slots:
     question: string
     options: Array<{ title: string, next: string }>   — 2 a 3 opções
     elseNext?: string   — caminho alternativo se nenhum botão for clicado (boa prática)
   Exemplo: { "id":"b3", "type":"ask_buttons", "question":"O que você precisa?",
              "options":[{"title":"Planos","next":"b4"},{"title":"Suporte","next":"b5"},{"title":"Outro","next":"b6"}] }

4. branch_var
   Bifurca o fluxo com base no valor de uma variável capturada anteriormente.
   Slots:
     varName: string
     cases: Array<{ op: "eq"|"neq"|"contains"|"gt"|"lt"|"gte"|"lte"|"exists"|"not_exists", value: string, next: string }>
     elseNext?: string   — caminho padrão se nenhum case casar
   Exemplo: { "id":"b4", "type":"branch_var", "varName":"interesse",
              "cases":[{"op":"eq","value":"premium","next":"b7"}], "elseNext":"b8" }

5. branch_hours
   Bifurca dependendo se está dentro ou fora do horário de funcionamento.
   Slots:
     openNext: string    — bloco se dentro do horário
     closedNext: string  — bloco se fora do horário
   Exemplo: { "id":"b5", "type":"branch_hours", "openNext":"b6", "closedNext":"b9" }

6. tag
   Aplica uma tag ao contato no CRM (útil para segmentação e relatórios).
   Slots:
     tag: string    — nome em kebab-case curto (ex.: "lead-planos", "quer-agendar")
     next?: string
   Exemplo: { "id":"b6", "type":"tag", "tag":"lead-quente", "next":"b7" }

7. ai
   Entrega o controle a um nó de IA que responde usando o conhecimento do negócio.
   A conversa continua de forma livre a partir daqui (não precisa de "next").
   Slots:
     prompt: string   — instrução clara do que a IA deve fazer neste ponto
   Exemplo: { "id":"b7", "type":"ai", "prompt":"Apresente os planos e ajude o cliente a escolher." }

8. handoff
   Transfere a conversa para um atendente humano e encerra o fluxo automaticamente.
   Slots: { }  (nenhum campo obrigatório)
   Exemplo: { "id":"b8", "type":"handoff" }

---

LIMITES E BOAS PRÁTICAS:
- ask_buttons: máximo 3 opções; sempre ofereça saída "Outro" / elseNext.
- Textos de WhatsApp: máx. ~160 caracteres por mensagem; use linguagem natural e amigável.
- Variáveis (varName): camelCase, sem espaços (ex.: nomeCliente, emailContato).
- Tags: kebab-case, sem acentos (ex.: lead-qualificado, quer-agendar).
- Não crie tipos de bloco que não estão na lista acima.
- O campo "entry" do plano aponta para o id do primeiro bloco.
`;

// ---------------------------------------------------------------------------
// FEW_SHOT
// Exemplo completo de block plan (JSON pretty) para o LLM aprender o formato.
// ---------------------------------------------------------------------------

export const FEW_SHOT: string = `
EXEMPLO DE PLANO DE BLOCOS (use como referência de formato e qualidade):

\`\`\`json
{
  "flowName": "Qualificação de leads",
  "entry": "b1",
  "blocks": [
    {
      "id": "b1",
      "type": "message",
      "text": "Oi! Bem-vindo à {{businessName}} 👋 Como posso ajudar?",
      "next": "b2"
    },
    {
      "id": "b2",
      "type": "ask_buttons",
      "question": "O que você procura hoje?",
      "options": [
        { "title": "Planos e preços", "next": "b3" },
        { "title": "Suporte", "next": "b5" },
        { "title": "Outro assunto", "next": "b6" }
      ]
    },
    {
      "id": "b3",
      "type": "tag",
      "tag": "lead-planos",
      "next": "b4"
    },
    {
      "id": "b4",
      "type": "ai",
      "prompt": "Apresente os planos da empresa e ajude o cliente a escolher o ideal para o perfil dele."
    },
    {
      "id": "b5",
      "type": "ai",
      "prompt": "Atenda a dúvida de suporte usando a base de conhecimento do negócio. Se não resolver, ofereça transferir para humano."
    },
    {
      "id": "b6",
      "type": "ask",
      "question": "Pode me contar mais sobre o que você precisa?",
      "varName": "assunto",
      "next": "b4"
    }
  ],
  "rationale": [
    {
      "node": "b2",
      "why": "Separa os interesses logo no início com botões para agilizar o atendimento e segmentar corretamente."
    },
    {
      "node": "b3",
      "why": "Tag 'lead-planos' permite filtrar e acompanhar leads com interesse em planos no CRM."
    }
  ],
  "summary": "Montei um fluxo que entende o interesse do cliente com botões e direciona cada caso para a IA mais adequada, com tag de segmentação para quem tem interesse em planos."
}
\`\`\`
`;

// ---------------------------------------------------------------------------
// RECIPES
// Dica curta (pt-BR) por objetivo — seeds para o LLM montar a sequência certa.
// Record<BlueprintGoal, string> garante cobertura total via TypeScript.
// ---------------------------------------------------------------------------

export const RECIPES: Record<BlueprintGoal, string> = {
  atendimento:
    `Sequência recomendada para ATENDIMENTO GERAL:
boas-vindas (message) →
ask_buttons com os principais assuntos do negócio (2-3 opções + "Outro assunto") →
para cada assunto: nó ai que resolve usando o conhecimento do negócio →
"Outro assunto": ask livre (varName: assunto) → ai geral →
se necessário, ofereça handoff para humano ao final de qualquer ramo.
Dica: use tags por assunto para segmentar contatos no CRM.`,

  qualificacao:
    `Sequência recomendada para QUALIFICAÇÃO DE LEADS:
boas-vindas (message) →
ask_buttons para entender o interesse inicial (ex.: "Quero comprar", "Só pesquisando", "Outro") →
para "Quero comprar": ask para nome (varName: nome, crmField: name) → ask para email (varName: email, crmField: email) → tag "lead-qualificado" → ai que aprofunda qualificação →
para "Só pesquisando": ai que nutre com conteúdo e captura interesse →
para "Outro": ask livre (varName: assunto) → ai.
Dica: use crmField para salvar nome e e-mail direto no CRM durante a qualificação.`,

  agendamento:
    `Sequência recomendada para AGENDAMENTO:
boas-vindas (message) →
ask para saber qual serviço/consulta o cliente quer (varName: servico, question: "Qual serviço você gostaria de agendar?") →
branch_hours: se dentro do horário → ai que conduz o agendamento (pergunta melhor dia/horário, confirma disponibilidade e finaliza) →
se fora do horário → message avisando horário de funcionamento + ask para capturar contato (varName: contato, crmField: name) → message confirmando que vão retornar →
Dica: o nó ai de agendamento deve mencionar o serviço capturado em {{servico}} para personalizar.`,

  vendas:
    `Sequência recomendada para VENDAS:
boas-vindas com energia (message) →
ask_buttons para descobrir o que o cliente quer comprar (2-3 categorias principais + "Outro") →
para cada categoria: tag "lead-quente-[categoria]" → ai de vendas que apresenta o produto, trata objeções e leva ao próximo passo (fechar, contratar, pagar) →
"Outro": ask livre (varName: interesse) → tag "lead-quente" → ai de vendas geral →
Dica: o nó ai de vendas deve ser direto, consultivo e orientado a fechamento — não só informativo.`,

  faq:
    `Sequência recomendada para FAQ / TIRA-DÚVIDAS:
boas-vindas curta (message: "Pode mandar sua dúvida!") →
ask_buttons com as dúvidas mais comuns do negócio (2-3 perguntas frequentes + "Outra dúvida") →
para cada dúvida frequente: ai que responde de forma curta e direta usando a base de conhecimento →
"Outra dúvida": ai geral que responde qualquer pergunta com base no conhecimento do negócio →
se a IA não souber responder: ofereça handoff para humano.
Dica: mantenha as opções de botão curtas (máx. ~20 caracteres cada) para boa exibição no WhatsApp.`,

  posvenda:
    `Sequência recomendada para PÓS-VENDA & SUPORTE:
boas-vindas acolhedora (message: "Olá! Como posso ajudar com seu pedido ou produto?") →
ask_buttons para tipo de suporte (ex.: "Status do pedido", "Troca/devolução", "Dúvida de uso") →
"Status do pedido": ask para número do pedido (varName: numeroPedido) → ai que consulta e responde →
"Troca/devolução": ai que explica o processo com empatia; se caso sensível → handoff →
"Dúvida de uso": ai que resolve com base no conhecimento do produto →
Dica: use tom acolhedor e empático — o cliente já é cliente, não precisa ser convencido.`,
};
