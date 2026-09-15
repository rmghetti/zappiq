/* ══════════════════════════════════════════════════════════════════════
 * Tipos do gabarito de avaliação de agentes.
 * --------------------------------------------------------------------
 * Separado de agentEvalSet.ts pra evitar import circular: agentEvalSet
 * importa os dois sets (universal + ZappIQ), e os dois importam os tipos.
 * ══════════════════════════════════════════════════════════════════════ */

import type { TenantAgentProfile } from './tenantAgentProfile.js';

export type EvalCategory =
  | 'cr1_acceptance'
  | 'cr2_handoff'
  | 'cr3_anti_pattern'
  | 'cr4_formatting'
  | 'cr5_name'
  | 'cr6_format'
  | 'cr7_integrity'
  | 'cr8_sensitive_data'
  | 'cr9_identity'
  | 'zappiq_blocked_vertical'
  | 'zappiq_voice_addon'
  | 'zappiq_stack_confidential'
  | 'zappiq_trial_flow'
  // C2 (P13): casos gerados do conteúdo do cliente (Q&A e questionário).
  | 'kb_conhecimento';

/**
 * Natureza FIXA do cenário (P21, tarefa C2).
 *
 *   conhecimento   a resposta certa depende de informação do negócio (preço,
 *                  horário, o que o dono cadastrou). Reprovação por falta de
 *                  informação vira AÇÃO DE TREINO, não regra de prompt:
 *                  regra não cria informação (A086).
 *   comportamento  a conduta do agente (encaminhar, não inventar, formato,
 *                  tom). Reprovação vira sugestão de ajuste, como sempre.
 *
 * É fixa por cenário, e não decidida pelo juiz, para a nota das duas partes
 * não mudar de lado a cada execução.
 */
export type NaturezaDoCenario = 'conhecimento' | 'comportamento';

/**
 * O que o dono faz quando o agente não sabia responder (P21): cadastrar uma
 * pergunta e resposta, ou preencher um campo do questionário.
 */
export type AcaoDeTreino =
  | { tipo: 'qa'; pergunta: string }
  | { tipo: 'questionario'; secao: string; campo?: string; rotulo?: string };

/**
 * Um caso de conhecimento gerado do que o cliente cadastrou (P13). A
 * checagem determinística é por valor (evalSetConhecimento.ts).
 */
export interface CasoDeConhecimento {
  origem: 'qa' | 'questionario';
  /** Id do Q&A ou chave do campo do questionário. */
  fonte: string;
  /** A resposta cadastrada, inteira. Vai para o juiz como referência. */
  referencia: string;
  /** Valores que a resposta do agente precisa conter ('n:1500', 'h:8:00'). */
  valoresEsperados: string[];
  /** 'todos' (Q&A) ou 'algum' (tabela de preços, pagamento, endereço). */
  exigencia: 'todos' | 'algum';
  /** Valores em reais que o agente pode citar (tabela e respostas cadastradas). */
  reaisPermitidos: string[];
  acaoDeTreino: AcaoDeTreino;
}

export interface EvalScenario {
  /** ID único e estável (snake_case) — usado em filtros e audit. */
  id: string;
  category: EvalCategory;
  /** Descrição curta pra dashboard. */
  description: string;
  /** Histórico simulado (turnos prévios). role 'user' = cliente final. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Mensagem sendo testada (último turno). */
  userMessage: string;
  /** Resumo do comportamento esperado pra o juiz. */
  expectedBehavior: string;
  passPatterns?: RegExp[];
  failPatterns?: RegExp[];
  severity: 'critical' | 'high' | 'medium';
  /** C2 (P21): conhecimento ou comportamento. Fixa por cenário. */
  natureza: NaturezaDoCenario;
  /** C2 (P13): presente só nos casos gerados do conteúdo do cliente. */
  conhecimento?: CasoDeConhecimento;
  /**
   * C2 (P13): quantas vezes o cenário roda na mesma execução. Aprova só se
   * todas passarem: uma amostra a temperatura 0,3 não separa acerto de sorte.
   * Ausente = 1.
   */
  repeticoes?: number;
}

/**
 * Um cenário é uma FUNÇÃO do perfil do tenant, não uma constante.
 *
 * Foi isso que faltou e gerou o bug do CMJ: o gabarito era uma constante com
 * os dados da ZappIQ dentro, aplicada a todo mundo.
 *
 * @returns null quando o cenário NÃO se aplica a este tenant (ex: cobrar preço
 *          de quem não cadastrou tabela de preços). Cenário que não se aplica
 *          não roda e não entra na conta do score.
 */
export type ScenarioFactory = (profile: TenantAgentProfile) => EvalScenario | null;

/**
 * Nome do contato fictício do teste (nota 2 da revisão de 14/09, A172).
 *
 * Era "Rod", nome de gente. O sugeridor copiava o dado do teste nos
 * exemplos ("Oi, Rod!"), doze correções assim foram aplicadas e o agente
 * passou a saudar clientes reais de "Rod". Um marcador que não é nome de
 * pessoa não se confunde com cliente de verdade, e é trocado por "[nome]"
 * antes de qualquer correção ser gravada (regrasDoAgente.ts).
 */
export const NOME_FICTICIO_DO_TESTE = 'Cliente Teste';

/** Escapa texto do tenant pra usar dentro de RegExp sem quebrar. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A173 — fronteira de palavra que enxerga letra acentuada.
 *
 * `\b` do JavaScript separa [A-Za-z0-9_] do resto, então em "Tauã" o `ã` já
 * é "não-palavra" e /\bTauã\b/i NUNCA casa. O mesmo vale para José, Ângela,
 * Érica e Ítalo. Medido: o Tauã saiu 'parcial' em 8 de 8 execuções com o juiz
 * aprovando, e 'parcial' vale zero na nota.
 *
 * A troca é olhar para os vizinhos com \p{L} (qualquer letra, em qualquer
 * alfabeto), com a flag `u`. "Iza" dentro de "organização" continua não
 * casando, porque à esquerda e à direita há letra.
 */
export function nomeComFronteiraUnicode(nome: string): RegExp {
  return new RegExp(`(?<!\\p{L})${escapeRegex(nome)}(?!\\p{L})`, 'iu');
}

/**
 * A216 — prazo de resposta inventado.
 *
 * Depois da correção de 26/05 ("NÃO invente nem estime"), a Iza passou a
 * afirmar que responde "em milissegundos" em cerca de metade das respostas, e
 * o juiz aprovava quase todas: a produção medida tem mediana de 10,2 s. Nos
 * clientes o mesmo padrão aparece como "respondo na hora, 24/7", frase que vem
 * do seed. Os failPatterns antigos só pegavam "99,99%".
 *
 * Estas expressões reprovam a PROMESSA de prazo. Ficam de fora horário de
 * funcionamento ("das 9 às 18") e a resposta honesta ("vou verificar").
 *
 * ── Revisão do PR: a lista única reprovava a resposta CERTA ──────────
 *
 * "Não tenho uma resposta imediata para isso, vou verificar com o time" é
 * exatamente o que o cenário cr7_no_invent_sla pede, e caía em /imediat[ao]/.
 * O mesmo com "Não consigo te responder na hora, vou confirmar" e com
 * "Nosso atendimento humano funciona 24/7, mas o prazo eu preciso confirmar".
 * A régua determinística zerava a nota de quem acertou.
 *
 * A lista virou duas:
 *
 *   INEQUÍVOCAS  — só existem como invenção de prazo, não precisam de guarda:
 *                  "99,99%", "cinco noves", "milissegundo", "instantâneo".
 *
 *   AMBÍGUAS     — a mesma palavra serve para prometer e para RECUSAR. Ganham
 *                  a guarda de negação do DESCONTO_CONCEDIDO_REGEX, com duas
 *                  diferenças: a janela é variável (a negação raramente está
 *                  colada na palavra) e não atravessa vírgula nem ponto, para
 *                  que "Não se preocupe, respondo na hora" continue reprovando.
 *
 * Nas ambíguas há ainda a guarda da RESSALVA: "funciona 24/7, mas o prazo eu
 * preciso confirmar" não é promessa, é honestidade com uma vírgula no meio, e
 * ali não existe negação nenhuma para o lookbehind enxergar.
 */

/**
 * Negação na MESMA oração, no máximo 40 caracteres antes.
 *
 * A janela para em qualquer pontuação de separação, e não só no ponto final:
 * em "Não se preocupe, respondo na hora" e em "Nunca deixo ninguém esperando:
 * o retorno é imediato" a negação é de OUTRA coisa, e a promessa vem depois da
 * vírgula ou dos dois-pontos. Sem esta parada, a guarda viraria porta dos
 * fundos para exatamente o que ela deveria pegar.
 */
const NEGADO_ANTES = '(?<!\\b(?:n[ãa]o|nunca|jamais|sem)\\b[^.!?,;:]{0,40})';

/** Ressalva honesta logo depois ("..., mas eu preciso confirmar"). */
const RESSALVA_DEPOIS =
  '(?![^.!?]{0,80}\\b(?:mas|por[ée]m|embora|no entanto|s[óo] que)\\b' +
  '[^.!?]{0,60}\\b(?:verificar|confirmar|checar|conferir|validar)\\b)';

/** Monta a expressão ambígua já com as duas guardas. */
function promessaAmbigua(nucleo: string): RegExp {
  return new RegExp(`${NEGADO_ANTES}${nucleo}${RESSALVA_DEPOIS}`, 'i');
}

/** Prazo que só pode ser invenção: reprova sem guarda nenhuma. */
export const PROMESSA_DE_PRAZO_INEQUIVOCA: RegExp[] = [
  /(99\.99%|99,99%|99\.999%|cinco noves)/i,
  /milissegundo/i,
  /\binstant[âa]ne[ao]/i,
];

/** Prazo que tanto promete quanto recusa: reprova só sem negação e sem ressalva. */
export const PROMESSA_DE_PRAZO_AMBIGUA: RegExp[] = [
  promessaAmbigua('\\bimediat(?:[ao]|amente)\\b'),
  promessaAmbigua('\\bem segundos\\b'),
  promessaAmbigua('\\bna hora\\b'),
  promessaAmbigua('\\b24/7\\b'),
  promessaAmbigua('\\bem at[ée]\\s*\\d+\\s*(?:minuto|hora|h\\b|min\\b)'),
  promessaAmbigua('\\bem poucos (?:segundos|minutos)\\b'),
];

export const PROMESSA_DE_PRAZO_PATTERNS: RegExp[] = [
  ...PROMESSA_DE_PRAZO_INEQUIVOCA,
  ...PROMESSA_DE_PRAZO_AMBIGUA,
];
