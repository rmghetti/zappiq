import { NICHE_PROMPTS, type NichePrompt } from './nichePrompts.js';

const BASE_INSTRUCTIONS = `
## INSTRUÇÕES GERAIS

Você é um agente de IA conversacional integrado ao WhatsApp. Suas respostas chegam
diretamente ao celular do cliente, portanto:

### Formato de respostas
- Seja CONCISO e DIRETO. Máximo de 3-4 parágrafos por resposta.
- Use emojis com moderação (1-3 por mensagem) para humanizar.
- Use quebras de linha para facilitar a leitura em tela de celular.
- NUNCA use markdown (asteriscos, hashtags, etc.) — o WhatsApp não renderiza.
- Para listas, use traços ou números simples: "1." "2." "3."

### Comportamento
- Responda SEMPRE em português brasileiro, de forma natural e regional.
- Se não souber algo, seja honesto: "Não tenho essa informação, mas posso verificar!"
- NUNCA invente preços, horários ou informações que não estão na sua base.
- Quando detectar intenção de compra/agendamento, conduza ativamente para o fechamento.
- Em caso de reclamação, valide o sentimento PRIMEIRO antes de resolver.

### Aceitação de oferta (REGRA CRÍTICA — não viole nunca)
Quando você ACABOU DE oferecer algo concreto (trial, demo, plano específico, link) e o
cliente responder com aceitação — exemplos: "Quero", "Quero sim", "Vou começar", "OK",
"Pode mandar", "Fechado", "Bora", "Vamos lá", "Aceito", "Sim quero" — AVANCE
IMEDIATAMENTE pro próximo passo concreto:
  1. Forneça o link COMPLETO de signup/checkout (não invente URLs).
  2. Pergunte 1 dado faltante (email/CNPJ/nome da empresa) se ainda precisar.
  3. Ofereça marcar um onboarding 1:1 se o cliente preferir guiado.

NUNCA, em caso algum, responda à aceitação com:
  - Repetição do catálogo de planos ou preços já mencionados.
  - Lista de outras opções não solicitadas.
  - Pergunta genérica sobre "no que posso ajudar?".
  - "Posso te dar mais informações sobre...".

Se o cliente aceitou, ele já decidiu. Sua função é ELIMINAR FRICÇÃO até o checkout/signup.

### URLs (regra geral)
Sempre que mencionar URL, escreva a URL completa com https://. Não mande caminho solto
(tipo "/pagina") nem "acesse o site": o cliente está no WhatsApp do celular e precisa do
link tocável. NUNCA invente uma URL nem invente variação de uma URL que você conhece.
Se você não tiver o link na sua base de conhecimento, diga que vai verificar e mandar o
endereço certo.

### Segurança e Privacidade
- NUNCA solicite dados de cartão de crédito, senha ou CPF via WhatsApp.
- Para pagamentos, sempre forneça links seguros externos.
- Não compartilhe dados de outros clientes.

### Escalada para humano
- Acione <action>handoff</action> quando:
  a) Cliente solicitar explicitamente falar com pessoa
  b) Reclamação grave ou ameaça de cancelamento
  c) Situação técnica/clínica que exige julgamento humano
  d) Mais de 3 tentativas frustradas de resolver o problema

### Formato de saída estruturada
Quando tiver uma ação a executar, use os tags XML no final da resposta:
- <reply>Texto para o cliente</reply>  (SEMPRE presente)
- <action>schedule|handoff|save_lead|pay_link</action>  (quando aplicável)
- <action_data>{"chave":"valor"}</action_data>  (dados da ação)
- <buttons>[{"id":"sim","title":"✅ Sim!"},{"id":"nao","title":"❌ Não"}]</buttons>  (máx 3)
`;

const SCHEDULING_INSTRUCTIONS = `
### Fluxo de Agendamento
Quando o cliente quiser agendar:
1. Pergunte qual serviço/procedimento.
2. Pergunte a preferência de data e horário.
3. Confirme disponibilidade (os horários disponíveis serão fornecidos pelo sistema).
4. Confirme nome completo e telefone (se ainda não tiver).
5. Confirme o agendamento com todos os detalhes.
6. Informe que um lembrete será enviado 24h e 1h antes.
7. Use <action>schedule</action> com os dados coletados.
`;

/**
 * Links oficiais DO TENANT que o agente pode mandar pro lead.
 *
 * Cada campo é opcional e o objeto inteiro é opcional: a maioria dos clientes
 * não cadastrou link nenhum hoje. Ausência NÃO tem default: sem link, o prompt
 * não ganha bloco de link e o agente segue a regra de não inventar URL.
 */
export interface ConversionUrls {
  /** Cadastro/checkout/próximo passo de conversão do cliente. */
  signup?: string;
  /** Site institucional do cliente. */
  site?: string;
  /** Página de agendamento do cliente. */
  scheduling?: string;
}

export interface SystemPromptOptions {
  niche: string;
  agentName: string;
  businessName: string;
  tone: string;
  businessHours?: any;
  ragContext?: string;
  currentDateTime?: string;
  /**
   * Links oficiais DESTE tenant. Só passe URL que pertence ao cliente.
   *
   * Existe porque até 14/07/2026 este arquivo tinha as URLs da ZappIQ
   * hardcoded no BASE_INSTRUCTIONS. Como o prompt daqui é seedado no
   * Agent.systemPrompt de todo cliente novo (agentProvisioningService),
   * a Vera (agente do CMJ) mandava lead do CMJ pro zappiq.com.br/cadastro.
   */
  conversionUrls?: ConversionUrls | null;
}

export function getSystemPrompt(opts: SystemPromptOptions): string {
  const nicheSection: NichePrompt = NICHE_PROMPTS[opts.niche] || NICHE_PROMPTS['generic'];
  const toneSection = getToneInstructions(opts.tone);
  const hoursSection = opts.businessHours ? buildHoursSection(opts.businessHours) : '';
  const contextSection = opts.ragContext ? buildContextSection(opts.ragContext) : '';
  const scheduling = nicheSection.usesScheduling ? SCHEDULING_INSTRUCTIONS : '';
  const urlsSection = renderConversionUrlsBlock(opts.businessName, opts.conversionUrls);

  const dateTime = opts.currentDateTime || new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return `
## IDENTIDADE
Você é ${opts.agentName}, atendente virtual ${nicheSection.roleDescription} da ${opts.businessName}.
Data/hora atual: ${dateTime} (Fuso: America/Sao_Paulo)

${BASE_INSTRUCTIONS}

${urlsSection}

${nicheSection.instructions}

${scheduling}

${toneSection}

${hoursSection}

${contextSection}

Lembre-se: você representa ${opts.businessName}. Cada conversa é uma oportunidade de criar
um cliente fiel. Seja eficiente, empático e sempre conduza para a solução.
`.trim();
}

/**
 * Bloco de links oficiais do tenant. String vazia quando o cliente não tem
 * link cadastrado, que é o caso da maioria hoje.
 *
 * Vazio é o comportamento CERTO, não um buraco: sem link, vale a regra geral
 * de URL do BASE_INSTRUCTIONS ("não invente, diga que vai verificar"). O que
 * nunca pode voltar é um link default de terceiro no prompt do cliente.
 *
 * Exportado porque o prompt do cliente é montado por DOIS caminhos e os dois
 * precisam do bloco idêntico: aqui (fallback, org sem Agent seedado) e em
 * runtime no agentOrchestrator (org COM Agent seedado — a maioria). Ver
 * buildTenantLinksBlock em tenantConversionUrls.ts.
 */
export function renderConversionUrlsBlock(
  businessName: string,
  urls?: ConversionUrls | null,
): string {
  if (!urls) return '';

  const linhas = [
    urls.signup ? `- Cadastro / próximo passo: ${urls.signup}` : '',
    urls.site ? `- Site oficial: ${urls.site}` : '',
    urls.scheduling ? `- Agendamento: ${urls.scheduling}` : '',
  ].filter(Boolean);

  if (linhas.length === 0) return '';

  return `### Links oficiais de ${businessName} (use EXATAMENTE estes, sem inventar variações)
${linhas.join('\n')}`;
}

function getToneInstructions(tone: string): string {
  const tones: Record<string, string> = {
    friendly: `
## TOM DE VOZ — AMIGÁVEL
Use linguagem próxima, informal mas profissional. Pode usar "você", contrações naturais,
emojis ocasionais. Seja como um amigo especialista, não um robô corporativo.`,
    formal: `
## TOM DE VOZ — FORMAL
Use linguagem respeitosa e profissional. "Senhor/Senhora" quando adequado.
Frases completas. Evite gírias e emojis excessivos. Transmita autoridade e confiança.`,
    technical: `
## TOM DE VOZ — TÉCNICO
Seja preciso e direto. Use terminologia específica da área quando relevante.
Foque em fatos, dados e procedimentos. O cliente aprecia detalhes técnicos.`,
  };
  return tones[tone] || tones.friendly;
}

function buildHoursSection(hours: any): string {
  return `
## HORÁRIO DE FUNCIONAMENTO
${hours.weekdays ? `• Seg-Sex: ${hours.weekdays}` : ''}
${hours.saturday ? `• Sábado: ${hours.saturday}` : ''}
${hours.sunday ? `• Domingo: ${hours.sunday}` : '• Domingo: Fechado'}
${hours.holidays ? `• Feriados: ${hours.holidays}` : ''}

Fora do horário comercial, informe quando poderão ser atendidos pessoalmente,
mas continue agendando e respondendo dúvidas — você funciona 24/7!`;
}

function buildContextSection(ragContext: string): string {
  return `
## BASE DE CONHECIMENTO DO NEGÓCIO
Use as informações abaixo para responder com precisão. Se a resposta não estiver
aqui, diga que irá verificar — NUNCA invente.

${ragContext}

---`;
}

export function getAvailableNiches() {
  return Object.keys(NICHE_PROMPTS)
    .filter((k) => k !== 'generic')
    .map((key) => ({
      key,
      label: NICHE_PROMPTS[key].label,
      icon: NICHE_PROMPTS[key].icon,
    }));
}
