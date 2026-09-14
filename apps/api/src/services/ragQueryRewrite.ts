/**
 * Consulta de continuação: o que a busca vetorial recebe quando a mensagem do
 * cliente depende do que veio antes.
 *
 * A026: a consulta era messageContent isolado. A mediana das mensagens de texto
 * recebidas em 90 dias é de 18 caracteres ("e quanto fica?", "e o prazo?",
 * "sim", "esse"), e uma pergunta dessas não carrega o assunto: a busca trazia
 * trecho genérico e o modelo completava de memória.
 *
 * A064: já rodam dois classificadores de intenção por turno, cada um com uma
 * chamada Haiku. Nenhuma chamada NOVA entra aqui: a reescrita vem de um campo
 * a mais na MESMA resposta do classificador que já existe. Quando ela não vem
 * (modelo devolveu só o rótulo, erro, cache antigo), vale a regra
 * determinística deste módulo, que não custa nada.
 *
 * Módulo puro de propósito: dá para testar a decisão inteira sem LLM, sem rede
 * e sem banco.
 */

/** Acima disso a mensagem já se explica sozinha. */
const MAX_CHARS_CONTINUACAO = 25;

/** Teto da consulta montada, para não inflar o embedding. */
const MAX_CHARS_CONSULTA = 600;

/** Teto da reescrita aceita do classificador. */
const MAX_CHARS_REESCRITA = 300;

/**
 * Radicais de substantivo do domínio, sem acento. A checagem é por prefixo de
 * palavra: "precos" casa com "preco", "valores" casa com "valor". A lista é
 * curta de propósito: ela só decide se uma mensagem CURTA já tem assunto
 * próprio. Errar para o lado de "tem assunto" é o lado conservador, porque
 * mantém o comportamento de hoje.
 */
const SUBSTANTIVOS_DO_DOMINIO = [
  'agenda',
  'agendamento',
  'aluguel',
  'assinatura',
  'aula',
  'boleto',
  'cancelamento',
  'cartao',
  'catalogo',
  'clinica',
  'consulta',
  'contrato',
  'cor',
  'curso',
  'desconto',
  'endereco',
  'entrega',
  'estacionamento',
  'estoque',
  'exame',
  'filial',
  'frete',
  'garantia',
  'hora',
  'horario',
  'imovel',
  'local',
  'matricula',
  'mensalidade',
  'modelo',
  'nota',
  'orcamento',
  'pacote',
  'pagamento',
  'parcela',
  'pix',
  'plano',
  'prazo',
  'preco',
  'procedimento',
  'produto',
  'promocao',
  'reembolso',
  'reserva',
  'seguro',
  'servico',
  'sessao',
  'site',
  'suporte',
  'tamanho',
  'taxa',
  'tratamento',
  'troca',
  'turma',
  'unidade',
  'vaga',
  'valor',
  'whatsapp',
];

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Categorias do classificador de intenção do turno (agentOrchestrator). */
export const INTENTS = [
  'scheduling',
  'pricing',
  'faq',
  'complaint',
  'purchase',
  'request_human',
  'greeting',
  'followup',
  'other',
] as const;

export type Intent = (typeof INTENTS)[number];

/**
 * Lê a saída do classificador que já roda por turno.
 *
 * O classificador passou a devolver JSON com a intenção E a consulta de busca
 * reescrita, na MESMA chamada (A064: já são duas chamadas Haiku por turno, não
 * cabe uma terceira). Tolerante de propósito: resposta em texto puro continua
 * valendo, porque é o que está gravado no cache de 5 minutos no momento do
 * deploy e é o que um modelo mais fraco devolve.
 */
export function parseClassifierOutput(raw: string | null | undefined): {
  intent: Intent;
  retrievalQuery: string | null;
} {
  const texto = (raw ?? '').trim();
  if (!texto) return { intent: 'other', retrievalQuery: null };

  const bloco = texto.match(/\{[\s\S]*\}/);
  if (bloco) {
    try {
      const json = JSON.parse(bloco[0]);
      const intent = normalizeIntent(String(json?.intent ?? ''));
      const consulta = sanitizeRewrittenQuery(
        typeof json?.consulta === 'string' ? json.consulta : null,
      );
      if (intent) return { intent, retrievalQuery: consulta };
    } catch {
      // cai no caminho de texto puro
    }
  }

  // JSON cortado no meio (teto de tokens da chamada). O bloco não fecha, então
  // JSON.parse nem é tentado, mas a categoria já veio inteira: ela é o PRIMEIRO
  // campo do formato que pedimos. Esta regex lê só ela e não depende do
  // fechamento. Sem isto, o texto cortado caía na leitura de texto puro e a
  // categoria vinha colada na chave seguinte, devolvendo 'other' e derrubando o
  // gate de handoff do "quero falar com um humano".
  const rotulo = texto.match(/"?intent"?\s*:\s*"?([a-z_]+)/);
  if (rotulo) {
    const intent = normalizeIntent(rotulo[1]);
    if (intent) return { intent, retrievalQuery: null };
  }

  return { intent: normalizeIntent(texto) ?? 'other', retrievalQuery: null };
}

function normalizeIntent(bruto: string): Intent | null {
  // A vírgula NÃO entra na remoção: ela é o separador entre a categoria e o
  // campo seguinte do JSON. Removê-la produzia 'request_humanconsulta', que não
  // casa com categoria nenhuma.
  const limpo = bruto.trim().toLowerCase().replace(/[.!"'`]/g, '');
  const exato = INTENTS.find((i) => i === limpo);
  if (exato) return exato;

  // O modelo devolveu uma frase: só aceitamos se UMA categoria aparecer nela.
  // Com duas ("não é request_human, é faq") preferimos 'other', que é o lado
  // conservador: 'other' não dispara handoff.
  const encontradas = INTENTS.filter((i) => new RegExp(`(^|[^a-z_])${i}([^a-z_]|$)`).test(limpo));
  return encontradas.length === 1 ? encontradas[0] : null;
}

export type QueryOrigin = 'mensagem' | 'classificador' | 'heuristica';

function semAcento(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function palavras(texto: string): string[] {
  return semAcento(texto)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function temSubstantivoDoDominio(texto: string): boolean {
  const tokens = palavras(texto);
  return tokens.some((token) =>
    SUBSTANTIVOS_DO_DOMINIO.some((radical) => token.startsWith(radical)),
  );
}

/**
 * Mensagem curta o bastante para PODER depender do contexto. É o portão da
 * reescrita do classificador: nada acima disso é tocado, então o caminho quente
 * das perguntas normais segue byte a byte igual ao de hoje.
 */
export function isShortMessage(message: string): boolean {
  const texto = (message ?? '').trim();
  return texto.length > 0 && texto.length < MAX_CHARS_CONTINUACAO;
}

/**
 * Regra determinística de fallback: mensagem curta E sem substantivo do
 * domínio. Vale quando o classificador não devolveu reescrita.
 *
 * Limite conhecido e aceito: "e o prazo?" tem substantivo do domínio e não
 * dispara a concatenação, mesmo dependendo do contexto. Quem resolve esse caso
 * é a reescrita do classificador (isShortMessage). Concatenar sem necessidade
 * é pior: sujaria uma consulta que já estava boa.
 */
export function isContinuationQuery(message: string): boolean {
  if (!isShortMessage(message)) return false;
  return !temSubstantivoDoDominio(message);
}

/** Últimas `n` mensagens DO CLIENTE, em ordem cronológica. */
export function lastCustomerMessages(history: HistoryTurn[], n: number): string[] {
  const doCliente = (history ?? [])
    .filter((t) => t && t.role === 'user' && typeof t.content === 'string' && t.content.trim())
    .map((t) => t.content.trim());
  return n > 0 ? doCliente.slice(-n) : [];
}

/**
 * Valida a reescrita que veio do classificador. Recusa vazio, resposta curta
 * demais (o modelo devolveu só "ok") e corta o que for longo demais.
 */
export function sanitizeRewrittenQuery(rewritten: string | null | undefined): string | null {
  const limpo = (rewritten ?? '').replace(/\s+/g, ' ').trim();
  if (limpo.length < 3) return null;
  return limpo.slice(0, MAX_CHARS_REESCRITA);
}

/**
 * Consulta final da busca vetorial.
 *
 * Ordem: mensagem que já se explica vai crua (o caminho quente de hoje não
 * muda); continuação usa a reescrita do classificador; sem reescrita, junta as
 * duas últimas mensagens do cliente.
 */
export function buildRetrievalQuery(input: {
  message: string;
  history: HistoryTurn[];
  rewritten?: string | null;
}): { query: string; origem: QueryOrigin } {
  const message = (input.message ?? '').trim();

  if (!isShortMessage(message)) {
    return { query: input.message, origem: 'mensagem' };
  }

  const reescrita = sanitizeRewrittenQuery(input.rewritten);
  if (reescrita) {
    return { query: reescrita, origem: 'classificador' };
  }

  if (!isContinuationQuery(message)) {
    return { query: input.message, origem: 'mensagem' };
  }

  const anteriores = lastCustomerMessages(input.history, 3)
    .filter((m) => m.trim() !== message)
    .slice(-2);

  if (anteriores.length === 0) {
    return { query: input.message, origem: 'mensagem' };
  }

  const consulta = [...anteriores, message].join(' ').replace(/\s+/g, ' ').trim();
  return { query: consulta.slice(0, MAX_CHARS_CONSULTA), origem: 'heuristica' };
}
