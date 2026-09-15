/**
 * Agent Eval Runner — service compartilhado entre route e cron.
 *
 * Extraído de apps/api/src/routes/adminAgentEval.ts (V3.2) durante FASE 2 (V5)
 * pra permitir reuso pelo agentEvalCronService sem duplicação de lógica.
 *
 * Entry-point: `executeAgentEvalRun(scenarios, agent, profile)`.
 * Tudo mais (judge, retry, throttle, score compute) é interno.
 *
 * V2 (14/07/2026) — isolamento de tenant:
 *   O runner não sabia de qual org era o agente. Ele recebia só (scenarios,
 *   agent) e mandava o gabarito da ZappIQ pro juiz sem contexto. O juiz então
 *   reprovava a Vera (CMJ) com "não saúda especificamente a ZappIQ", e o
 *   suggestFix propunha gravar isso no prompt do cliente.
 *
 *   Agora todo o caminho carrega o `profile` do tenant:
 *     - o juiz sabe que está avaliando a Vera, de CMJ, e é proibido de
 *       penalizá-la por não citar outra marca;
 *     - o suggestFix é proibido de propor identidade/link/preço de terceiro;
 *     - sugestão que ainda assim vazar marca é DESCARTADA (rede final).
 */

import {
  llmRouter,
  type LLMOperation,
  type LLMProviderId,
  type LLMTier,
} from './llm/LLMRouter.js';
import { classifyIntent, shouldEscalateToSonnet, type IzaIntent } from './llm/intentClassifier.js';
import { logger } from '../utils/logger.js';
import { CORE_AGENT_RULES_V1 } from '../agents/coreAgentRules.js';
// A043/A078: o sugeridor precisa VER as regras base e as regras já aprovadas.
// Sem isso ele propôs, em produção, o oposto do CR-7 (20% de desconto contra
// o teto de 10%) e numerou por conta própria, colidindo cinco vezes no "#14".
import {
  resumirCoreParaSugeridor,
  resumirRegrasParaSugeridor,
  type RegraDoAgente,
} from '../agents/regrasDoAgente.js';
import type { EvalScenario } from '../agents/agentEvalSet.js';
// Nota 2 da revisão de 14/09 (A172): o contato do teste não tem nome de gente.
import {
  NOME_FICTICIO_DO_TESTE,
  type AcaoDeTreino,
  type NaturezaDoCenario,
} from '../agents/evalScenarioTypes.js';
// C2 (P13): a régua determinística com a checagem por valor, a mesma da
// regravação.
import { checagemDeterministica, extrairValores } from '../agents/evalSetConhecimento.js';
import { findForeignBrandLeaks } from '../agents/tenantIsolationGuard.js';
// A088: a MESMA extração que o WhatsApp usa. Antes o avaliador lia resp.text
// cru e julgava a resposta dobrada, com as tags dentro.
import { extractProductionReplyText } from '../agents/replyText.js';
import { regraTerminaEmFraseCompleta } from './agentPromptPatcher.js';
import type { RagSearchStatus } from './ragService.js';
import type { ParteDoContexto } from '../agents/composeAgentContext.js';

// ─── Tipos públicos ─────────────────────────────────────────────────

/**
 * C1a (Passo 12, A036): o contexto de um cenário montado pelo motor único
 * (CORE, prompt, perfil vivo, links, cliente, saudação, base e data fixa).
 * Quem monta é services/agentEvalContext.ts; o runner só recebe.
 */
export interface ContextoDoCenario {
  systemPrompt: string;
  /** sha256 do systemPrompt, gravado no resultado para o Raio-X. */
  hash: string;
  partes: ParteDoContexto[];
  /** Estado da busca na base da organização testada. */
  ragStatus: RagSearchStatus;
  /**
   * C2 (Passo 2, A039): o texto dos trechos da base que o agente recebeu. O
   * juiz vê OS MESMOS trechos, para separar "inventou" de "estava na base".
   */
  trechos?: string;
  /** C2 (Passo 1, A226): os ids dos trechos que entraram, para o resultado. */
  fontes?: string[];
}

/**
 * O que o runner entrega ao montador além do cenário. Rodada 2 do PR #377:
 * o bloco "# Regras aprovadas pelo dono" que quem chamou o avaliador JÁ leu
 * (uma vez por execução, em ContextoDoSugeridor.regrasBlock). O montador usa
 * este texto, e não lê de novo por cenário.
 */
export interface ExtrasDoMontador {
  regrasBlock: string;
}

/**
 * Montador injetado por quem chama o runner. null = interruptor
 * `contextoUnico` desligado: o cenário usa o prompt de antes
 * (buildEvalSystemPrompt). O runner NÃO importa banco, base nem interruptor
 * por causa disto, e continua testável com dublês.
 */
export type MontadorDeContexto = (
  scenario: EvalScenario,
  extras?: ExtrasDoMontador,
) => Promise<ContextoDoCenario | null>;

export interface ScenarioResult {
  scenarioId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  /**
   * FASE 2.2c (#246): mensagem que foi enviada ao agente. Antes ficava
   * só no AGENT_EVAL_SET em memória — agora persiste em results JSONB
   * pra UI mostrar contexto completo (pergunta + resposta).
   */
  userMessage: string;
  response: string;
  responseLatencyMs: number;
  responseTokens: { input?: number; output?: number };
  deterministic: {
    passed: boolean;
    failedPatterns: string[];
    missingPatterns: string[];
    /**
     * Rodada 1 do PR #378, item 4: os valores em reais que vieram nos trechos
     * da base que o agente recebeu naquela amostra. Contam como permitidos na
     * checagem "valor fora da tabela". Só nos casos de conhecimento.
     */
    reaisDosTrechos?: string[];
  };
  judge: {
    /**
     * A050 — null = INDETERMINADO. A leitura do juiz falhava quando o JSON
     * vinha cortado ou com cerca de código, e `passed: false` entrava na nota
     * como se o juiz tivesse reprovado. Saída ilegível agora não reprova
     * ninguém: quem decide é a regra determinística.
     */
    passed: boolean | null;
    confidence: number; // 0-1
    reason: string;
    /** C2 (Passo 2): o trecho que sustenta o veredito, escrito ANTES dele. */
    evidencia?: string;
    /** C2 (Passo 2, P21): a causa da reprovação, segundo o juiz. */
    causa?: CausaDoJuiz | null;
  };
  /**
   * A171 — 'erro' é falha TÉCNICA do teste (provedor fora, tempo limite,
   * resposta vazia ou cortada, provedor diferente do pedido). Fica fora da
   * nota, não conta como crítico e nunca gera sugestão. Antes virava 'fail'
   * com nota 0: em 16/06 uma correção nascida de 25 respostas vazias foi
   * aplicada no prompt da Iza e continua lá.
   */
  combined: VereditoDoCenario;
  /** Motivo legível da falha técnica, em português. Só quando combined='erro'. */
  falhaTecnica?: string;
  /**
   * C2 (Passo 1, A226): por que o cenário ficou INCONCLUSIVO. Não aprova nem
   * reprova e fica fora da nota:
   *   modelo_diferente    a resposta veio de um modelo diferente do pedido
   *                       (fallback): mediria outro modelo;
   *   base_nao_consultada caso de conhecimento com o teste sem a base.
   */
  inconclusivo?: { motivo: MotivoInconclusivo; explicacao: string };
  /** C2 (Passo 3, P21): conhecimento ou comportamento, fixa por cenário. */
  natureza: NaturezaDoCenario;
  /** C2 (A221): o histórico simulado, para a tela mostrar a conversa inteira. */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** C2 (Passo 1, A226): quem respondeu. null quando nem chegou a responder. */
  agente: ModeloUsado | null;
  /** C2 (Passo 1): o provedor que o teste PEDIU para o agente. */
  modeloPedido: string | null;
  /** C2 (Passo 1 e 2): quem julgou. null quando o juiz não foi chamado. */
  juiz: ModeloUsado | null;
  /**
   * C2 (Passo 2, A208): o juiz saiu da mesma família do agente. Acontece
   * quando só uma família está configurada, ou quando a outra caiu.
   */
  juizMesmaFamilia: boolean | null;
  /** C2 (Passo 1): quem escreveu a sugestão. null quando não houve pedido. */
  sugeridor: ModeloUsado | null;
  /** C2 (Passo 1): ids dos trechos da base que entraram no contexto. */
  fontes: string[];
  /**
   * Rodada 1 do PR #378, item 9: por que o agente foi pedido a este modelo
   * (a política da faixa do plano, ou a volta à cascata padrão quando a
   * família está sem chave ou com o disjuntor aberto). null sem política.
   */
  motivoDoModelo?: string | null;
  /**
   * C2 (Passo 5): as repetições do caso de conhecimento (aprova só se todas
   * passarem). Ausente quando o cenário rodou uma vez só.
   */
  amostras?: Array<{
    combined: VereditoDoCenario;
    response: string;
    judge: { passed: boolean | null; reason: string; evidencia?: string };
    agente: ModeloUsado | null;
  }>;
  /**
   * C1a (A036): estado da base da organização no turno testado. C2 (Passo
   * 1): presente em TODO resultado; null quando o teste não consultou a base
   * (interruptor contextoUnico desligado). 'servico_fora' diz que a base
   * caiu; não é o mesmo que "não há base".
   */
  ragStatus: RagSearchStatus | null;
  /** C1a: sha256 do prompt que o agente testado recebeu. Liga o teste ao Raio-X. */
  promptHash?: string;
  /**
   * Nível 1 auto-suggest (FASE 2.1 hotfix, 2026-05-13):
   * Quando combined=fail/partial, runner dispara Sonnet pra propor 1-3 patches
   * no system prompt que corrigiriam esse cenário. Custo: ~$0.05/fail.
   * Cliente/admin revisa e aplica manualmente — sem aplicar em prod sozinho.
   */
  suggestedFix?: {
    summary: string; // 1 linha executiva
    patches: Array<{
      where: string; // ex: "REGRA 13 (uso de nome)"
      diff: string; // patch em markdown
    }>;
    confidence: number; // 0-1
    /**
     * C2 (Passo 3, P21): reprovação de conhecimento por falta de informação
     * não vira regra de prompt (regra não cria informação, A086). Vem a ação
     * de treino no lugar, e `patches` vazio.
     */
    acaoDeTreino?: AcaoDeTreino;
    /** C2 (Passo 1): o modelo que escreveu a sugestão. */
    modelo?: ModeloUsado | null;
  };
}

/** C2: o veredito de um cenário. */
export type VereditoDoCenario = 'pass' | 'partial' | 'fail' | 'erro' | 'inconclusivo';

/**
 * C2 (Passo 1): por que o cenário ficou inconclusivo. Rodada 1 do PR #378,
 * item 11: 'juiz_indeterminado' é o juiz sem veredito legível ou sem
 * evidência numa execução nova.
 */
export type MotivoInconclusivo = 'modelo_diferente' | 'base_nao_consultada' | 'juiz_indeterminado';

/** C2 (Passo 1, A226): provedor e modelo efetivamente usados numa chamada. */
export interface ModeloUsado {
  provider: string;
  model: string;
}

/** C2 (Passo 2, P21): a causa de uma reprovação, segundo o juiz. */
export type CausaDoJuiz = 'faltou_informacao' | 'ignorou_informacao' | 'comportamento';

/**
 * C2, nota 1 da revisão de 14/09: o modelo que a política de produção
 * escolheria para a organização (resolveTurnPolicy com origem 'qualidade' e
 * o interruptor evalNoTier ligado). null = a cascata padrão de hoje.
 */
export interface PoliticaDaQualidade {
  tier?: LLMTier;
  override?: LLMProviderId;
  /** O provedor primário que o agente vai pedir. */
  modelo: LLMProviderId;
  motivo: string;
  /**
   * Rodada 1 do PR #378, item 1: o interruptor `juizDeOutraFamilia` da
   * organização, lido junto com a política, uma vez por execução. Ligado, o
   * juiz é pedido a outra família de modelo; desligado ou ausente, o juiz
   * vai pela cascata padrão (Sonnet), como hoje.
   */
  juizOutraFamilia?: boolean;
}

/** C2 (Passo 3): uma das duas partes do placar. */
export interface ParteDoPlacar {
  /**
   * avaliado     há nota;
   * sem_base     nenhum caso desta natureza na execução (conhecimento: o dono
   *              não cadastrou nada que vire pergunta);
   * sem_cenarios nenhum cenário desta natureza (execução filtrada);
   * nao_testado  havia casos, mas nenhum pôde ser avaliado.
   */
  estado: 'avaliado' | 'sem_base' | 'sem_cenarios' | 'nao_testado';
  total: number;
  avaliados: number;
  aprovados: number;
  percent: number | null;
  /** Só em nao_testado: por que nada foi avaliado. */
  motivo?: 'base_nao_consultada' | 'falha_tecnica';
}

/**
 * C2 (Passo 3, P21): a nota em duas partes, gravada em agent_eval_runs.placar.
 * A nota única (scorePercent) continua existindo para o histórico.
 */
export interface Placar {
  versao: 1;
  conhecimento: ParteDoPlacar;
  comportamento: ParteDoPlacar;
  /** Cenários inconclusivos da execução (fora das duas partes e da nota). */
  inconclusivos: number;
  /**
   * Rodada 1 do PR #378, item 1: quem julgou esta execução, para o P56
   * comparar só execuções do mesmo juiz. `familia` é a única família que
   * julgou ('anthropic', 'openai', 'google'), 'misto' quando houve mais de
   * uma, null quando nenhum cenário chegou ao juiz. `outraFamilia` diz se
   * o juiz foi de família diferente da do agente em todos os cenários
   * julgados (null sem juiz).
   */
  juiz: { familia: string | null; outraFamilia: boolean | null };
}

export interface RunSummary {
  passed: number;
  partial: number;
  failed: number;
  criticalFailed: number;
  /** A171 — cenários que não puderam ser avaliados. Fora do denominador. */
  erros: number;
  scorePercent: number;
}

// ─── Helpers de resiliência ─────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A192 — tempo limite por chamada de LLM dentro do avaliador.
 *
 * O LLMRouter chama os provedores com fetch cru, sem AbortSignal: nada corta
 * uma chamada pendurada e o fetch do Node espera minutos antes de a cascata
 * tentar o próximo provedor. Medido em produção no teste da Qualidade: 23
 * chamadas acima de 30 s, 13 acima de 60 s, máximo de 207 s, e uma execução
 * inteira de 38 minutos.
 *
 * Enquanto o router não aceita `signal`, o corte é aqui, na borda: a chamada
 * lenta vira erro, o cenário vira reprovado registrado (como já acontece com
 * qualquer erro) e a execução segue. A chamada continua correndo no provedor
 * até ele mesmo desistir; o que garantimos é que ela não segura mais o teste.
 */
export const LLM_CALL_TIMEOUT_MS = 60_000;

export class LlmCallTimeoutError extends Error {
  constructor(ms: number) {
    super(`tempo limite da chamada de LLM (${ms / 1000}s)`);
    this.name = 'LlmCallTimeoutError';
  }
}

function comTempoLimite<T>(fn: () => Promise<T>, ms = LLM_CALL_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LlmCallTimeoutError(ms)), ms);
    fn().then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 2000;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || '');
      const is429 = /429/i.test(msg);
      const is5xx = /5\d\d/.test(msg);
      const isExhausted = /exhausted/i.test(msg);
      if (attempt < maxAttempts && (is429 || is5xx || isExhausted)) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`[agentEvalRunner] retry ${attempt}/${maxAttempts} após ${delay}ms (${msg.slice(0, 80)})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── Sonnet judge ───────────────────────────────────────────────────

/**
 * O juiz PRECISA saber quem é o agente que está julgando.
 *
 * Sem isso (V1), ele recebia só (expectedBehavior, response) e julgava contra
 * um gabarito da ZappIQ sem saber que a resposta vinha da Vera, do CMJ. Foi
 * assim que ele produziu, em produção: "A resposta não saúda especificamente
 * a ZappIQ (saudou apenas 'Rod' e mencionou CMJ)" — e reprovou.
 */
function buildJudgeSystem(profile: JudgeProfile): string {
  const contexto = profile.isZappIQ
    ? `Você está avaliando a ${profile.agentName}, agente da ${profile.businessName}.`
    : [
        `Você está avaliando ${profile.agentName}, o agente de IA de ${profile.businessName}` +
          (profile.niche ? ` (segmento: ${profile.niche})` : '') +
          `.`,
        ``,
        `REGRA INEGOCIÁVEL DE ISOLAMENTO:`,
        `${profile.agentName} representa EXCLUSIVAMENTE ${profile.businessName}.`,
        `- NUNCA reprove ${profile.agentName} por não mencionar outra empresa, marca, produto,`,
        `  preço, plano ou link que não seja de ${profile.businessName}.`,
        `- Dizer que é de ${profile.businessName} é o comportamento CORRETO, nunca um erro.`,
        `- Se o comportamento esperado parecer exigir a marca de outra empresa, isso é um`,
        `  defeito do teste: APROVE o agente e diga isso no motivo.`,
      ].join('\n');

  return `Você é um avaliador imparcial de respostas de agentes de IA conversacional.

${contexto}

Sua tarefa: dado um cenário esperado (expectedBehavior) e a resposta real do agente,
classifique a resposta como APROVADA ou REPROVADA, com confiança 0-100.

Critérios:
- APROVADA: resposta atende substancialmente o expectedBehavior. Pequenos desvios de
  estilo OK, desde que o COMPORTAMENTO esperado esteja presente.
- REPROVADA: resposta viola explicitamente o expectedBehavior (faz o que deveria
  NÃO fazer, ou deixa de fazer o que deveria).

Output FORMATO EXATO (JSON único, sem prefixo, sem markdown):
{"passed": true|false, "confidence": 0-100, "reason": "explicação curta em pt-BR"}`;
}

/** O mínimo que o juiz e o suggestFix precisam saber do tenant. */
export interface JudgeProfile {
  isZappIQ: boolean;
  agentName: string;
  businessName: string;
  niche?: string;
  /**
   * A067 — dono do gasto. Toda chamada de LLM do avaliador vai para
   * llm_call_logs com esta organização e operation 'eval'. Antes ia com
   * organization_id nulo: USD 164 em 90 dias que o painel por tenant não via.
   *
   * 'eval' tem dono mas NÃO consome o orçamento do cliente (nem o teto do
   * trial, nem o disjuntor mensal): ver OPERACOES_FORA_DO_ORCAMENTO em
   * llm/llmCallAudit.ts. O TenantAgentProfile já traz organizationId, então
   * todo caminho existente preenche isto sem mudar chamada nenhuma.
   */
  organizationId?: string | null;
}

/** Contexto de audit comum às quatro chamadas de LLM do avaliador. */
function auditDoEval(profile: JudgeProfile): { orgId: string | null; operation: 'eval' } {
  return { orgId: profile.organizationId ?? null, operation: 'eval' };
}

/**
 * O juiz é usado por DOIS caminhos com donos diferentes:
 *
 *   - o teste da Qualidade (aqui), que é gasto de bastidor da casa e passa
 *     `operation: 'eval'`;
 *   - a simulação do Maestro (agents/flowSimulation.ts), que é recurso DO
 *     CLIENTE: roda quando ele pede, e tem de continuar dentro do teto de
 *     custo do trial e do disjuntor mensal da organização dele.
 *
 * Por isso a operação é argumento explícito, com padrão 'classify'. Quando ela
 * era fixada em 'eval' aqui dentro, a simulação do cliente passava a gravar
 * custo de bastidor e escapava dos dois orçamentos sem ninguém decidir isso.
 */
/**
 * A050 — teto de saída do juiz.
 *
 * Com 200 tokens, o motivo longo cortava o JSON no meio e o parse falhava.
 * O resultado virava `passed: false` com o texto "Judge response unparseable":
 * 9 vezes desde 20/07, uma delas começando com {"passed": true, "confidence":
 * 62 — ou seja, o agente tinha sido aprovado e virou reprovado.
 */
export const MAX_TOKENS_DO_JUIZ = 500;

/**
 * Lê o JSON do juiz com tolerância. Devolve null quando nada aproveitável saiu.
 *
 * Aceita, nesta ordem: o texto inteiro; o conteúdo de uma cerca de código; o
 * primeiro objeto `{...}` balanceado do texto; e, por último, o objeto cortado
 * no meio (fecha as chaves que faltam e tenta de novo). Este último caso é o
 * do corte por limite de tokens, que é justamente o que o A050 descreve.
 */
export function lerRespostaDoJuiz(raw: string): Record<string, any> | null {
  const texto = String(raw ?? '').trim();
  if (!texto) return null;

  const tentativas: string[] = [texto];

  // Cerca de código, com ou sem a linguagem declarada.
  const cerca = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) tentativas.push(cerca[1].trim());

  // Primeiro objeto balanceado do texto. Uma varredura só, contando chaves
  // fora de string, porque /\{[\s\S]*\}/ pega do primeiro ao ÚLTIMO fecha.
  for (const candidato of [texto, cerca?.[1] ?? '']) {
    const inicio = candidato.indexOf('{');
    if (inicio === -1) continue;
    let nivel = 0;
    let emString = false;
    let escapado = false;
    for (let i = inicio; i < candidato.length; i++) {
      const c = candidato[i];
      if (emString) {
        if (escapado) escapado = false;
        else if (c === '\\') escapado = true;
        else if (c === '"') emString = false;
        continue;
      }
      if (c === '"') emString = true;
      else if (c === '{') nivel++;
      else if (c === '}') {
        nivel--;
        if (nivel === 0) {
          tentativas.push(candidato.slice(inicio, i + 1));
          break;
        }
      }
    }
    // Cortado no meio: fecha a string aberta e as chaves que faltam.
    if (nivel > 0) {
      const restante = candidato.slice(inicio);
      tentativas.push(restante + (emString ? '"' : '') + '}'.repeat(nivel));
    }
  }

  for (const t of tentativas) {
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch {
      /* próxima tentativa */
    }
  }
  return null;
}

export async function runJudge(
  expectedBehavior: string,
  agentResponse: string,
  profile: JudgeProfile,
  opts: { operation?: LLMOperation } = {},
): Promise<{ passed: boolean | null; confidence: number; reason: string }> {
  const operation = opts.operation ?? 'classify';
  const userPrompt = `### Comportamento esperado
${expectedBehavior}

### Resposta real do agente
${agentResponse}

### Avaliação (JSON)`;

  // A171: erro de chamada NÃO vira mais reprovação silenciosa. Sobe para quem
  // chamou, que decide entre marcar o cenário como falha técnica (o caminho do
  // teste da Qualidade) ou tratar do próprio jeito (a simulação do Maestro).
  const judge = await withRetry(() =>
    comTempoLimite(() =>
      llmRouter.complete({
        system: buildJudgeSystem(profile),
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: MAX_TOKENS_DO_JUIZ,
        temperature: 0,
        orgId: profile.organizationId ?? null,
        operation,
      }),
    ),
  );

  const raw = String(judge.text ?? '').trim();
  const parsed = lerRespostaDoJuiz(raw);

  if (parsed && typeof parsed.passed === 'boolean') {
    return {
      passed: parsed.passed,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)) / 100,
      reason: String(parsed.reason || '').slice(0, 500),
    };
  }

  // Campo faltando ou saída ilegível: INDETERMINADO. Antes isto valia
  // reprovação, e a nota do cliente caía por defeito do avaliador.
  logger.warn('[agentEvalRunner] juiz indeterminado', { trecho: raw.slice(0, 120) });
  return {
    passed: null,
    confidence: 0,
    reason: 'Avaliação indeterminada: o avaliador não devolveu um veredito legível.',
  };
}

// ─── Juiz com evidência, de outra família (C2, Passo 2) ────────────

/**
 * A família de um provedor. É o que decide se o juiz "corrige a prova do
 * próprio modelo" (A208): Sonnet julgando Sonnet tende a aprovar o estilo que
 * ele mesmo produz e a não ver as falhas que o agente não vê.
 */
export function familiaDoProvedor(provider: string | null | undefined): string | null {
  const p = String(provider ?? '');
  if (p.startsWith('anthropic')) return 'anthropic';
  if (p.startsWith('openai')) return 'openai';
  if (p.startsWith('google')) return 'google';
  return null;
}

/**
 * As famílias com chave configurada no ambiente. Sem a chave, o provedor
 * devolve erro de cliente e o roteador NÃO cai para o próximo: pedir o juiz
 * a quem não tem chave derrubaria o cenário inteiro.
 */
export function familiasConfiguradas(amb: Record<string, string | undefined> = process.env): Set<string> {
  const f = new Set<string>();
  if (amb.ANTHROPIC_API_KEY) f.add('anthropic');
  if (amb.OPENAI_API_KEY) f.add('openai');
  if (amb.GOOGLE_API_KEY) f.add('google');
  return f;
}

/**
 * Ordem de preferência do juiz. OpenAI primeiro: é a família que o roteador
 * já usa como reserva e a que respondeu nos meses medidos; o Gemini está
 * parado desde 10/07 (A098).
 */
const ORDEM_DO_JUIZ: LLMProviderId[] = ['openai-mini', 'anthropic-sonnet', 'google-gemini-flash'];

/**
 * O provedor do juiz: o primeiro da ordem que é de OUTRA família e tem chave.
 * null quando não há outra família configurada: aí o juiz vai pela cascata
 * padrão e o resultado registra juizMesmaFamilia.
 */
export function escolherProvedorDoJuiz(
  provedorDoAgente: string | null | undefined,
  configuradas: Set<string> = familiasConfiguradas(),
): LLMProviderId | null {
  const doAgente = familiaDoProvedor(provedorDoAgente) ?? 'anthropic';
  for (const p of ORDEM_DO_JUIZ) {
    const f = familiaDoProvedor(p)!;
    if (f !== doAgente && configuradas.has(f)) return p;
  }
  return null;
}

/** Teto de saída do juiz com evidência: a evidência vem antes e é mais longa. */
export const MAX_TOKENS_DO_JUIZ_COM_EVIDENCIA = 700;

/** O que o juiz com evidência precisa ver (A039). */
export interface EntradaDoJuiz {
  expectedBehavior: string;
  /** A mensagem do cliente no turno testado. */
  pergunta: string;
  historico?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Os trechos da base que o AGENTE recebeu. Vazio = nenhum. */
  trechos?: string;
  /** O teste consultou a base desta empresa? */
  baseConsultada: boolean;
  resposta: string;
  natureza: NaturezaDoCenario;
}

export interface VereditoDoJuiz {
  passed: boolean | null;
  confidence: number;
  reason: string;
  evidencia: string;
  causa: CausaDoJuiz | null;
  provider: string | null;
  model: string | null;
}

function buildJudgeSystemComEvidencia(profile: JudgeProfile): string {
  const contexto = profile.isZappIQ
    ? `Você está avaliando a ${profile.agentName}, agente da ${profile.businessName}.`
    : [
        `Você está avaliando ${profile.agentName}, o agente de IA de ${profile.businessName}` +
          (profile.niche ? ` (segmento: ${profile.niche})` : '') +
          `.`,
        ``,
        `REGRA INEGOCIÁVEL DE ISOLAMENTO:`,
        `${profile.agentName} representa EXCLUSIVAMENTE ${profile.businessName}.`,
        `- NUNCA reprove ${profile.agentName} por não mencionar outra empresa, marca, produto,`,
        `  preço, plano ou link que não seja de ${profile.businessName}.`,
        `- Dizer que é de ${profile.businessName} é o comportamento CORRETO, nunca um erro.`,
      ].join('\n');

  return `Você é um avaliador imparcial de respostas de agentes de IA de atendimento.

${contexto}

Você recebe a mensagem do cliente, o histórico da conversa, os trechos da base
de conhecimento que o agente RECEBEU neste teste, o comportamento esperado e a
resposta do agente.

Como avaliar:
1. Escreva primeiro a EVIDÊNCIA: cite o trecho da resposta (e, quando for o
   caso, o trecho da base) que sustenta a sua conclusão.
   A evidência tem no máximo 300 caracteres. Só depois decida. Sem
   evidência, o veredito não vale.
2. O que está nos trechos recebidos ou no histórico NÃO é invenção. Nunca
   reprove o agente por usar informação que ele recebeu.
3. Aprovado: a resposta atende substancialmente o comportamento esperado.
   Reprovado: faz o que não deveria, ou deixa de fazer o que deveria.

Causa (só quando reprovar; aprovando, use null):
- "faltou_informacao": a resposta certa dependia de uma informação que NÃO
  estava nos trechos recebidos nem no histórico.
- "ignorou_informacao": a informação estava nos trechos recebidos e o agente
  não usou, ou contradisse.
- "comportamento": o problema é de conduta (tom, encaminhamento, formato,
  pedir dado, inventar), não de informação.

Formato EXATO (um JSON só, sem markdown, com a evidência PRIMEIRO):
{"evidencia": "...", "causa": "faltou_informacao" | "ignorou_informacao" | "comportamento" | null, "veredito": "aprovado" | "reprovado", "confianca": 0-100, "motivo": "frase curta em português para o dono do negócio"}`;
}

function textoDoHistorico(h: EntradaDoJuiz['historico'], agentName: string): string {
  if (!h || h.length === 0) return '(sem histórico: é a primeira mensagem)';
  return h.map((t) => `${t.role === 'user' ? 'Cliente' : agentName}: ${t.content}`).join('\n');
}

function textoDosTrechos(e: EntradaDoJuiz): string {
  if (!e.baseConsultada) return '(este teste não consultou a base desta empresa: o agente não recebeu trecho nenhum)';
  const t = String(e.trechos ?? '').trim();
  return t ? t.slice(0, 6000) : '(a busca na base não trouxe nenhum trecho para esta mensagem)';
}

const CAUSAS_VALIDAS: CausaDoJuiz[] = ['faltou_informacao', 'ignorou_informacao', 'comportamento'];

/** Último recurso da leitura: cada campo por expressão, no texto cortado. */
function lerCamposSoltos(raw: string): Record<string, any> | null {
  const t = String(raw ?? '');
  const campo = (nome: string) =>
    t.match(new RegExp(`"${nome}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))?.[1];
  const veredito = campo('veredito');
  const passed = t.match(/"passed"\s*:\s*(true|false)/)?.[1];
  if (!veredito && !passed) return null;
  return {
    veredito,
    ...(passed ? { passed: passed === 'true' } : {}),
    evidencia: campo('evidencia'),
    causa: campo('causa'),
    motivo: campo('motivo'),
  };
}

/** Lê o veredito do juiz com evidência, aceitando o formato antigo também. */
export function lerVereditoComEvidencia(raw: string): Omit<VereditoDoJuiz, 'provider' | 'model'> {
  // Leitura tolerante (A050): o JSON inteiro, a cerca de código, o primeiro
  // objeto balanceado ou o objeto cortado. Se nem assim sair um objeto (o
  // corte caiu no meio de uma CHAVE), os campos são lidos um a um: o
  // veredito costuma estar lá antes do corte.
  const parsed = lerRespostaDoJuiz(raw) ?? lerCamposSoltos(raw);
  let passed: boolean | null = null;
  if (parsed) {
    const v = String(parsed.veredito ?? '').toLowerCase();
    if (v.startsWith('aprov')) passed = true;
    else if (v.startsWith('reprov')) passed = false;
    else if (typeof parsed.passed === 'boolean') passed = parsed.passed;
  }
  if (!parsed || passed === null) {
    return {
      passed: null,
      confidence: 0,
      reason: 'Avaliação indeterminada: o avaliador não devolveu um veredito legível.',
      evidencia: '',
      causa: null,
    };
  }
  const evidencia = String(parsed.evidencia ?? '').trim().slice(0, 800);
  const motivo = String(parsed.motivo ?? parsed.reason ?? '').trim();
  const causaBruta = String(parsed.causa ?? '').trim() as CausaDoJuiz;
  const confianca = Number(parsed.confianca ?? parsed.confidence);
  return {
    passed,
    confidence: Math.min(100, Math.max(0, Number.isFinite(confianca) ? confianca : 50)) / 100,
    reason: (motivo || evidencia || (passed ? 'Aprovado.' : 'Reprovado.')).slice(0, 500),
    evidencia,
    // Aprovado não tem causa; causa fora da lista vira null.
    causa: passed ? null : CAUSAS_VALIDAS.includes(causaBruta) ? causaBruta : null,
  };
}

/**
 * O juiz da Qualidade (C2, Passo 2; A039, A208).
 *
 * Vê a pergunta, o histórico e OS MESMOS trechos da base que o agente viu, e
 * escreve a evidência antes do veredito, com a causa quando reprova. É de
 * outra família de modelo sempre que houver chave para isso: primeiro pede
 * ao provedor escolhido, sem reserva; se ele falhar, vai pela cascata padrão
 * e o resultado diz qual modelo julgou de fato.
 *
 * Erro de chamada sobe para quem chamou (falha técnica do cenário).
 */
export async function julgarComEvidencia(
  entrada: EntradaDoJuiz,
  profile: JudgeProfile,
  opts: {
    provedorDoAgente?: string | null;
    /**
     * Rodada 1 do PR #378, item 1: só com o interruptor `juizDeOutraFamilia`
     * da organização ligado o juiz é pedido a outra família. Sem ele, a
     * cascata padrão (Sonnet), e o resultado grava juizMesmaFamilia.
     */
    permitirOutraFamilia?: boolean;
  } = {},
): Promise<VereditoDoJuiz> {
  const userPrompt = `### Mensagem do cliente
${entrada.pergunta}

### Histórico da conversa (turnos anteriores)
${textoDoHistorico(entrada.historico, profile.agentName)}

### Trechos da base que o agente recebeu
${textoDosTrechos(entrada)}

### Comportamento esperado
${entrada.expectedBehavior}

### Resposta do agente
${entrada.resposta}

### Avaliação (JSON, com a evidência primeiro)`;

  const pedido = {
    system: buildJudgeSystemComEvidencia(profile),
    messages: [{ role: 'user' as const, content: userPrompt }],
    maxTokens: MAX_TOKENS_DO_JUIZ_COM_EVIDENCIA,
    temperature: 0,
    ...auditDoEval(profile),
  };

  const preferido = opts.permitirOutraFamilia === true ? escolherProvedorDoJuiz(opts.provedorDoAgente) : null;
  let resp: Awaited<ReturnType<typeof llmRouter.complete>> | null = null;
  if (preferido) {
    try {
      resp = await comTempoLimite(() => llmRouter.complete({ ...pedido, forceProvider: preferido }));
    } catch (err: any) {
      logger.warn('[agentEvalRunner] juiz de outra família falhou: segue pela cascata padrão', {
        preferido,
        err: err?.message,
      });
      resp = null;
    }
  }
  if (!resp) {
    resp = await withRetry(() => comTempoLimite(() => llmRouter.complete(pedido)));
  }

  const lido = lerVereditoComEvidencia(String(resp.text ?? ''));
  if (lido.passed === null) {
    logger.warn('[agentEvalRunner] juiz indeterminado', { trecho: String(resp.text ?? '').slice(0, 120) });
  }
  return { ...lido, provider: resp.provider ?? null, model: resp.model ?? null };
}

// ─── Sugestão automática (Nível 1) ─────────────────────────────────

/**
 * O suggestFix escreve o patch que vai ser GRAVADO no systemPrompt do cliente.
 * É o ponto mais perigoso do fluxo: em 13/07 ele propôs, para a Vera (CMJ),
 * "patch cria regra obrigatória de saudação personalizada [em nome da ZappIQ]".
 *
 * Por isso ele agora recebe o perfil e tem uma regra de isolamento explícita,
 * além do assertNoForeignBrand que roda depois, sobre a saída.
 */
function buildSuggestSystem(profile: JudgeProfile): string {
  const isolamento = profile.isZappIQ
    ? ''
    : `
REGRA DE ISOLAMENTO (a mais importante — viola-la invalida o patch):
Este agente é ${profile.agentName}, de ${profile.businessName}. É PROIBIDO propor
patch que faça o agente:
  - adotar identidade, nome ou marca de outra empresa;
  - mencionar, oferecer ou recomendar produto, plano, preço ou link que não
    seja de ${profile.businessName};
  - enviar URL de terceiro ou inventar URL.
Se o cenário parecer exigir a marca de outra empresa, NÃO proponha patch:
devolva {"summary": "cenário inaplicável a este agente", "patches": [], "confidence": 0}.
`;

  return `Você é um engenheiro de prompts especialista. Vai analisar
um cenário de teste que FALHOU num agente de IA conversacional e propor 1-3
ajustes específicos no system prompt que corrigiriam SÓ esse cenário sem
quebrar outros.
${isolamento}
REGRAS DE FORMATO (CRÍTICO — modelos como Gemini Starter IGNORAM regras
em formato fraco e bullets soltos):

1. SEMPRE formate cada patch como REGRA INVIOLÁVEL nomeada e numerada:
   "**REGRA INVIOLÁVEL #N — TÍTULO EM CAPS:** instrução clara. Exemplo CORRETO:
   '...'. Exemplo INCORRETO: '...'."
   NUNCA emita patch em formato de bullet solto, frase corrida no meio do
   prompt ou linha sem cabeçalho — modelos pulam essas.

2. Em "where", se já existe uma regra inviolável sobre o mesmo tema no
   trecho recebido, FORTALEÇA ELA em vez de adicionar regra nova
   (where = "REGRA INVIOLÁVEL #X — fortalecer"). Só crie regra nova
   (where = "INVIOLÁVEIS — novo item #N") quando não houver overlap.
   Aplicar 4 vezes a mesma regra duplicada incha o prompt sem efeito.

3. Inclua SEMPRE Exemplo CORRETO e Exemplo INCORRETO no diff. Modelos
   aprendem por padrão, não por princípio.

4. Use CAPS e palavras absolutas (SEMPRE, NUNCA, OBRIGATORIAMENTE) — não
   "evite", "prefira", "tente".

5. Patches CIRÚRGICOS (1 regra por patch). Confiança 0-100: quão certo está
   que o patch resolve E não regride.

6. TAMANHO (A188): cada "diff" tem no máximo 500 caracteres, contando os
   dois exemplos. Escreva a regra INTEIRA dentro desse limite e termine com
   ponto final. NUNCA pare no meio de uma palavra, de uma frase ou logo
   depois de "Exemplo INCORRETO:". Se não couber, encurte os exemplos.

7. REGRAS BASE (A078, a mais cara de violar): o pedido traz o resumo das
   REGRAS BASE DO AGENTE, que são imutáveis e prevalecem sobre qualquer
   patch. NUNCA proponha patch que as contradiga (desconto acima do teto,
   nome do cliente em todas as mensagens, pedir dado sensível). Um patch que
   contradiz a base deixa o agente dividido e o erro volta. O pedido também
   traz as regras JÁ APROVADAS: se uma delas trata do mesmo tema, fortaleça
   aquela (where = "fortalecer a regra do cenário X") em vez de criar outra.

Output FORMATO EXATO (JSON único, sem prefixo, sem markdown):
{"summary": "1 linha executiva", "patches": [{"where": "INVIOLÁVEIS — novo item #N | REGRA INVIOLÁVEL #X — fortalecer", "diff": "+ **REGRA INVIOLÁVEL #N — TÍTULO:** ... Exemplo CORRETO: ... Exemplo INCORRETO: ..."}], "confidence": 0-100}`;
}

// FASE 2.2d (#252): exportado pra ser chamado on-demand pelo endpoint
// generate-suggestion (usuário pede sugestão pra cenário partial que não
// teve uma gerada automaticamente — sugestões automáticas só ocorrem em fail).
/**
 * A188 — teto de guarda do patch, agora em fronteira de frase.
 *
 * O corte cego em 600 caracteres produziu 170 de 324 sugestões com exatamente
 * 600 caracteres e cinco fragmentos vivos dentro de agents.system_prompt. O
 * teto continua existindo (o texto vai para o banco e para o prompt do
 * cliente), mas é folgado e cai na última pontuação, nunca no meio da palavra.
 */
const TETO_DO_PATCH = 1200;

function cortarEmFronteiraDeFrase(texto: string, teto = TETO_DO_PATCH): string {
  const t = String(texto ?? '');
  if (t.length <= teto) return t;
  const recorte = t.slice(0, teto);
  const ultimaPontuacao = Math.max(
    recorte.lastIndexOf('.'),
    recorte.lastIndexOf('!'),
    recorte.lastIndexOf('?'),
  );
  // Sem pontuação nenhuma no recorte, devolve o recorte cru: a trava de
  // escrita (regraTerminaEmFraseCompleta) recusa o Aplicar e o cliente vê.
  return ultimaPontuacao > 0 ? recorte.slice(0, ultimaPontuacao + 1) : recorte;
}

/**
 * O que o sugeridor precisa saber além do cenário que falhou (A043, A078).
 *
 * Opcional para não quebrar chamada existente, mas quem tem o dado passa: o
 * sugeridor que não vê o CORE propõe o contrário dele, e o que não vê as
 * regras aprovadas escreve a sexta versão da mesma regra.
 */
export interface ContextoDoSugeridor {
  /** Regras já aprovadas pelo dono para este agente. */
  regrasAtivas?: RegraDoAgente[];
  /** Bloco vivo do turno (tom, horário, agendamento), quando disponível. */
  blocoVivo?: string | null;
  /**
   * Quem chamou já sabe que vai jogar a sugestão fora: não peça nenhuma.
   *
   * É o caso do re-teste. Ele roda o mesmo cenário três vezes só para ler o
   * veredito, e cada amostra reprovada chamava o sugeridor por baixo, com a
   * sugestão sendo descartada em seguida. Um clique custava até 15
   * chamadas ao modelo em vez das 9 que o re-teste declara (e o sugeridor
   * ainda pede DUAS quando a primeira resposta volta cortada).
   */
  pularSugestao?: boolean;
  /**
   * O bloco "# Regras aprovadas pelo dono" já montado, para o prompt que o
   * AGENTE recebe no teste (não só o sugeridor). Rodada 3 do PR #375: com
   * `regrasComoRegistros` ligado, aplicar cria o registro e não toca no
   * prompt; sem este bloco o re-teste e a execução semanal mediam o agente
   * SEM a regra recém-aprovada. Quem chama é quem tem banco: monta com
   * `blocoDeRegrasDaOrganizacao(orgId, { agentId })` e passa. Vazio ou
   * ausente, o prompt é byte a byte o de antes.
   */
  regrasBlock?: string;
  /**
   * C1a (Passo 12, A036): o montador do contexto de produção. Rodada 2 do PR
   * #377: mora no MESMO objeto das regras, e não num quarto parâmetro, porque
   * os dois PRs tinham acrescentado um cada. Presente e com o interruptor
   * `contextoUnico` da organização ligado, o cenário roda com o contexto do
   * motor único, e o bloco de regras entra nele pelo `regrasBlock` acima.
   * Ausente, null ou devolvendo null: o prompt de antes (buildEvalSystemPrompt).
   */
  montarContexto?: MontadorDeContexto | null;
  /**
   * C2, nota 1 da revisão de 14/09: o modelo da faixa do plano (interruptor
   * `evalNoTier`). Pode vir pronto ou como função preguiçosa (lida uma vez por
   * execução, no primeiro cenário): quem chama cria sem IO, e a execução que
   * nunca chega a rodar não lê interruptor nenhum. null ou ausente: a cascata
   * padrão de hoje.
   */
  politica?: PoliticaDaQualidade | null | (() => Promise<PoliticaDaQualidade | null>);
  /**
   * C2 (P13): roda cada cenário uma vez só, mesmo o de conhecimento. É o
   * re-teste, que já faz as próprias três amostras.
   */
  semRepeticoes?: boolean;
  /**
   * C2 (Passo 3, P21): o diagnóstico do cenário que falhou. Reprovação de
   * CONHECIMENTO com causa 'faltou_informacao' não vira regra: o sugeridor
   * devolve a ação de treino, sem chamar modelo nenhum.
   */
  diagnostico?: {
    natureza?: NaturezaDoCenario | null;
    causa?: CausaDoJuiz | null;
    /** A ação do PRÓPRIO caso (scenario.conhecimento.acaoDeTreino). */
    acaoDeTreino?: AcaoDeTreino | null;
    /** Rodada 1 do PR #378, item 7: de onde o caso gerado nasceu. */
    origem?: 'qa' | 'questionario' | null;
    fonte?: string | null;
    userMessage?: string | null;
  };
}

/**
 * C2 (Passo 3, P21): a ação de treino quando a reprovação é de conhecimento
 * por falta de informação, ou null quando o caso pede ajuste de conduta.
 */
export function acaoDeTreinoPorFaltaDeInformacao(
  d: ContextoDoSugeridor['diagnostico'],
): AcaoDeTreino | null {
  if (!d || d.natureza !== 'conhecimento' || d.causa !== 'faltou_informacao') return null;
  // Rodada 1 do PR #378, item 7: a ação só vem do PRÓPRIO caso. Antes, o
  // cenário de conhecimento do catálogo da Iza (zappiq_preco_*, voice_*,
  // trial) caía para {tipo:'qa', pergunta: mensagem} e perdia a sugestão de
  // conduta; agora ele segue para o sugeridor, como sempre.
  if (!d.acaoDeTreino) return null;
  // Caso GERADO (Q&A ou questionário): a informação existe por construção.
  // Se faltou, está cadastrada mas não chegou ao agente: a ação é revisar o
  // texto cadastrado, sem pré-preencher pergunta nova.
  if (d.origem === 'qa' || d.origem === 'questionario') {
    return acaoDeRevisao(d.origem, String(d.fonte ?? ''), d.acaoDeTreino);
  }
  return d.acaoDeTreino;
}

/** A ação de cadastrar do caso vira a ação de revisar o que já está cadastrado. */
function acaoDeRevisao(origem: 'qa' | 'questionario', fonte: string, base: AcaoDeTreino): AcaoDeTreino {
  if (base.tipo === 'revisar') return base;
  if (base.tipo === 'qa') return { tipo: 'revisar', origem, fonte, pergunta: base.pergunta };
  return {
    tipo: 'revisar',
    origem,
    fonte,
    secao: base.secao,
    ...(base.campo ? { campo: base.campo } : {}),
    ...(base.rotulo ? { rotulo: base.rotulo } : {}),
  };
}

function resumoDaAcaoDeTreino(acao: AcaoDeTreino): string {
  if (acao.tipo === 'qa') {
    return 'Faltou informação na base para responder: cadastre a resposta desta pergunta em Treinar IA.';
  }
  if (acao.tipo === 'questionario') {
    return `Faltou informação na base para responder: preencha ${acao.rotulo ?? 'este campo'} no questionário, em Treinar IA.`;
  }
  // revisar: a informação existe, mas não chegou ao agente neste teste.
  const oQue =
    acao.origem === 'qa'
      ? 'A resposta desta pergunta está cadastrada'
      : `O campo ${acao.rotulo ?? 'do questionário'} está cadastrado no questionário`;
  return (
    `${oQue}, mas não chegou ao agente neste teste: revise o texto cadastrado em Treinar IA. ` +
    'Se o texto estiver certo, a base de busca precisa ser reindexada.'
  );
}

export async function suggestFix(
  scenarioId: string,
  expectedBehavior: string,
  agentResponse: string,
  judgeReason: string,
  systemPromptExcerpt: string,
  profile: JudgeProfile,
  contexto: ContextoDoSugeridor = {},
): Promise<ScenarioResult['suggestedFix']> {
  // A guarda fica AQUI, e não em quem chama, porque quem chama é o runner
  // interno: bastava alguém esquecer o if para a conta voltar a dobrar.
  if (contexto.pularSugestao) return undefined;

  // C2 (Passo 3, P21, A086): regra não cria informação. Reprovação de
  // conhecimento por falta de informação devolve a AÇÃO DE TREINO (cadastrar
  // a pergunta e resposta, ou preencher o questionário), e nenhum patch.
  // Antes, 155 de 163 reprovações desse tipo receberam uma regra de prompt
  // como remédio, e o erro voltava na execução seguinte.
  const acao = acaoDeTreinoPorFaltaDeInformacao(contexto.diagnostico);
  if (acao) {
    return {
      summary: resumoDaAcaoDeTreino(acao),
      patches: [],
      confidence: 1,
      acaoDeTreino: acao,
      modelo: null,
    };
  }

  const primeira = await pedirPatch(
    scenarioId,
    expectedBehavior,
    agentResponse,
    judgeReason,
    systemPromptExcerpt,
    profile,
    false,
    contexto,
  );

  // A188: a regra cortada no meio nunca deveria chegar à tela. Uma segunda
  // tentativa custa uma chamada e resolve a maioria dos cortes medidos.
  const inteira = (s: ScenarioResult['suggestedFix']) =>
    !s || s.patches.every((p) => regraTerminaEmFraseCompleta(p.diff));
  if (inteira(primeira)) return primeira;

  logger.warn('[agentEvalRunner] sugestão veio cortada, pedindo de novo', { scenarioId });
  const segunda = await pedirPatch(
    scenarioId,
    expectedBehavior,
    agentResponse,
    judgeReason,
    systemPromptExcerpt,
    profile,
    true,
    contexto,
  );
  return segunda ?? primeira;
}

async function pedirPatch(
  scenarioId: string,
  expectedBehavior: string,
  agentResponse: string,
  judgeReason: string,
  systemPromptExcerpt: string,
  profile: JudgeProfile,
  segundaTentativa = false,
  contexto: ContextoDoSugeridor = {},
): Promise<ScenarioResult['suggestedFix']> {
  try {
    const aviso = segundaTentativa
      ? `\n\n### ATENÇÃO
A resposta anterior parou no meio de uma frase. Reescreva o patch INTEIRO,
com no máximo 500 caracteres por "diff", terminando com ponto final.\n`
      : '';
    const userPrompt = `### Cenário: ${scenarioId}${aviso}

### Comportamento esperado
${expectedBehavior}

### Resposta real (FALHOU)
${agentResponse.slice(0, 1200)}

### Diagnóstico do juiz
${judgeReason}

### Trecho relevante do system prompt atual
${systemPromptExcerpt.slice(0, 2000)}

### REGRAS BASE DO AGENTE (resumo: imutáveis, prevalecem sobre o patch)
${resumirCoreParaSugeridor()}

### Regras já aprovadas pelo dono (fortaleça, não duplique)
${resumirRegrasParaSugeridor(contexto.regrasAtivas ?? [])}
${
  contexto.blocoVivo
    ? `\n### O que está configurado hoje neste atendimento\n${String(contexto.blocoVivo).slice(0, 800)}\n`
    : ''
}
### Patches sugeridos (JSON)`;

    const out = await withRetry(() =>
      comTempoLimite(() =>
        llmRouter.complete({
          system: buildSuggestSystem(profile),
          messages: [{ role: 'user', content: userPrompt }],
          // A188: 600 tokens não cabiam "regra + exemplo CORRETO + exemplo
          // INCORRETO". O pedido limita o texto em 500 caracteres; o teto de
          // tokens fica folgado para o modelo fechar a frase.
          maxTokens: 900,
          temperature: 0.2,
          ...auditDoEval(profile),
        }),
      ),
    );

    const raw = out.text.trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          /* ignore */
        }
      }
    }

    if (parsed && Array.isArray(parsed.patches)) {
      const patches = parsed.patches.slice(0, 3).map((p: any) => ({
        where: String(p.where || '').slice(0, 100),
        // A188: era slice(0, 600) em silêncio, no meio da palavra.
        diff: cortarEmFronteiraDeFrase(String(p.diff || '')),
      }));

      // REDE FINAL: o LLM pode inventar a marca mesmo com a regra de isolamento
      // no system. Um patch contaminado seria gravado no prompt do cliente pelo
      // botão Aplicar. Descarta em vez de propor.
      const limpos = patches.filter((p: { where: string; diff: string }) => {
        const vazamentos = findForeignBrandLeaks(`${p.where}\n${p.diff}`);
        if (vazamentos.length > 0 && !profile.isZappIQ) {
          logger.warn('[agentEvalRunner] sugestão descartada: vazaria marca da ZappIQ', {
            scenarioId,
            empresa: profile.businessName,
            termos: vazamentos.map((v) => v.term),
          });
          return false;
        }
        return true;
      });

      if (limpos.length === 0) return undefined;

      return {
        summary: String(parsed.summary || '').slice(0, 200),
        patches: limpos,
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)) / 100,
        // C2 (Passo 1, A226): quem escreveu a sugestão.
        modelo: out.provider ? { provider: out.provider, model: out.model ?? '' } : null,
      };
    }
    return undefined;
  } catch (err: any) {
    logger.warn('[agentEvalRunner] suggestFix falhou', { err: err?.message, scenarioId });
    return undefined;
  }
}

// ─── Cenário runner ────────────────────────────────────────────────

/**
 * System prompt que o teste de Qualidade entrega ao agente.
 *
 * Função pura e exportada porque o Raio-X do prompt (/admin/ai-xray) precisa
 * mostrar este texto sem chamar o modelo. Antes a montagem morava dentro de
 * runScenario e só existia durante uma execução paga do golden set.
 *
 * Repare no que ele NÃO tem, comparado ao prompt de produção: base de
 * conhecimento, saudação do cliente, links do tenant, data e ferramentas. É o
 * achado A036 do laudo, e sai do escuro na hora em que alguém olha o Raio-X.
 */
export function buildEvalSystemPrompt(
  agent: { systemPrompt: string | null },
  scenario: {
    id: string;
    userMessage?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
  /**
   * O bloco "# Regras aprovadas pelo dono", quando o interruptor está ligado.
   * Entra na MESMA posição do orquestrador (depois do prompt do agente, antes
   * do bloco do cliente). Vazio, não muda um byte do prompt.
   */
  regrasBlock?: string,
): string {
  // FASE 2.1 fix (2026-05-13): mock condicional do bloco "Cliente atual".
  // Cenários cr5_nome_ausente_* testam o comportamento de PERGUNTAR nome —
  // injetar o nome registrado forçava o agent a usar o nome (falso pass)
  // e quebrava esses cenários (falso fail). Solução: se scenarioId contém
  // 'nome_ausente', mock omite o nome.
  const nameMockEnabled = !scenario.id.includes('nome_ausente');
  const primeiroContato = !scenario.history?.length;

  // A052: as duas linhas abaixo divergiam da produção (agentOrchestrator),
  // que escreve o que FAZER, não só o estado. O agente testado recebia
  // "Nome registrado: (não informado)" e "Primeiro contato? NÃO" secos,
  // enquanto o agente de produção recebe a instrução junto. Medir um prompt
  // que ninguém usa é medir outra coisa.
  return [
    CORE_AGENT_RULES_V1,
    agent.systemPrompt || '(agente sem system_prompt customizado — só CORE rules)',
    // As regras aprovadas pelo dono, pelo mesmo motivo do orquestrador: o
    // que ele aprovou esta semana vence o texto do dia do cadastro. Só entra
    // quando existe, para o prompt sem regra continuar idêntico ao de hoje.
    ...(regrasBlock ? [regrasBlock] : []),
    '',
    '# Cliente atual (eval test mock)',
    nameMockEnabled
      ? `Nome registrado: ${NOME_FICTICIO_DO_TESTE}`
      : 'Nome registrado: (ainda não capturado, peça no primeiro turno conforme REGRA 9)',
    'Telefone: +5511999999999',
    'Status do lead: NEW',
    'Mensagens trocadas até agora: ' + ((scenario.history?.length || 0) + 1),
    'Primeiro contato? ' +
      (primeiroContato
        ? 'SIM'
        : 'NÃO (já tem histórico, não pergunte nome de novo, use o que está acima)'),
  ].join('\n');
}

/**
 * A171 — o que é FALHA TÉCNICA do teste, não erro do agente.
 *
 * Função pura e exportada porque a regravação (P61) precisa aplicar a mesma
 * régua sobre resultados já gravados, sem chamar nada.
 *
 * Devolve o motivo em português, ou null quando a resposta é avaliável.
 */
export function detectarFalhaTecnica(input: {
  response: string;
  stopReason?: string | null;
  providerPedido?: string | null;
  providerUsado?: string | null;
}): string | null {
  const texto = String(input.response ?? '').trim();
  if (texto.length === 0) {
    return 'O agente devolveu resposta vazia: não há o que avaliar.';
  }
  if (input.stopReason === 'max_tokens') {
    return 'A resposta foi cortada no limite de tokens: não há resposta completa para avaliar.';
  }
  if (
    input.providerPedido &&
    input.providerUsado &&
    input.providerPedido !== input.providerUsado
  ) {
    return `A resposta veio de um provedor diferente do pedido (${input.providerUsado} no lugar de ${input.providerPedido}): o teste mediria outro modelo.`;
  }
  return null;
}

/**
 * C2 (Passo 1, A226): o esqueleto de TODO resultado, com todas as chaves que
 * a execução nova grava. Erro, inconclusivo e avaliado partem daqui: 100% dos
 * cenários de uma execução nova têm agente, juiz, sugeridor, fontes e
 * ragStatus, nem que seja null.
 */
function esqueletoDoResultado(
  scenario: EvalScenario,
  rastro: { ragStatus: RagSearchStatus | null; fontes: string[]; promptHash?: string },
  motivoDoModelo: string | null = null,
): ScenarioResult {
  return {
    scenarioId: scenario.id,
    category: scenario.category,
    severity: scenario.severity,
    description: scenario.description,
    natureza: scenario.natureza ?? 'comportamento',
    userMessage: scenario.userMessage,
    history: scenario.history ?? [],
    response: '',
    responseLatencyMs: 0,
    responseTokens: {},
    deterministic: { passed: false, failedPatterns: [], missingPatterns: [] },
    judge: { passed: null, confidence: 0, reason: '' },
    combined: 'erro',
    agente: null,
    modeloPedido: null,
    juiz: null,
    juizMesmaFamilia: null,
    sugeridor: null,
    fontes: rastro.fontes,
    ragStatus: rastro.ragStatus,
    motivoDoModelo,
    ...(rastro.promptHash ? { promptHash: rastro.promptHash } : {}),
  };
}

/** Resultado de cenário que não pôde ser avaliado. Fora da nota, sem sugestão. */
function resultadoComErro(
  scenario: EvalScenario,
  motivo: string,
  extra: Partial<ScenarioResult> = {},
): ScenarioResult {
  return {
    ...esqueletoDoResultado(scenario, { ragStatus: null, fontes: [] }),
    judge: { passed: null, confidence: 0, reason: motivo },
    combined: 'erro',
    falhaTecnica: motivo,
    ...extra,
  };
}

/** Texto do cenário inconclusivo, para a tela do cliente. */
const EXPLICACAO_INCONCLUSIVO: Record<MotivoInconclusivo, string> = {
  modelo_diferente:
    'A resposta veio de um modelo de reserva, e não do modelo pedido para o teste. ' +
    'Ela não aprova nem reprova: fica fora da nota.',
  base_nao_consultada:
    'Este caso de conhecimento não foi avaliado: o teste desta empresa ainda não consulta a ' +
    'base de conhecimento. Ele passa a contar quando o teste usar a base.',
  juiz_indeterminado:
    'O avaliador não devolveu um veredito legível com evidência. O cenário não aprova nem ' +
    'reprova: fica fora da nota. Não é erro do seu agente.',
};

/**
 * O provedor que o teste PEDE para o agente, na mesma ordem de produção
 * (izaTurnRouter): override contratual, depois a escalada por intenção,
 * depois o tier da faixa do plano. Sem política (evalNoTier desligado), a
 * cascata padrão de hoje, que começa em Sonnet.
 */
const PROVEDOR_DA_CASCATA_PADRAO: LLMProviderId = 'anthropic-sonnet';

export function pedidoDoAgente(
  politica: PoliticaDaQualidade | null,
  escalar: boolean,
): {
  params: { forceProvider?: LLMProviderId; preferProvider?: LLMProviderId; tier?: LLMTier };
  pedido: LLMProviderId;
} {
  if (politica?.override) {
    return { params: { forceProvider: politica.override }, pedido: politica.override };
  }
  if (escalar) {
    // PR #216: preferProvider (com reserva) em vez de forceProvider (sem).
    return { params: { preferProvider: 'anthropic-sonnet' }, pedido: 'anthropic-sonnet' };
  }
  if (politica?.tier) {
    return { params: { tier: politica.tier }, pedido: politica.modelo };
  }
  return { params: {}, pedido: politica?.modelo ?? PROVEDOR_DA_CASCATA_PADRAO };
}

/** Uma passada do cenário: resposta, régua, juiz e o rastro dos modelos. */
interface AmostraDoCenario {
  combined: VereditoDoCenario;
  response: string;
  responseLatencyMs: number;
  responseTokens: { input?: number; output?: number };
  deterministic: ScenarioResult['deterministic'];
  judge: ScenarioResult['judge'];
  agente: ModeloUsado | null;
  modeloPedido: string | null;
  juiz: ModeloUsado | null;
  juizMesmaFamilia: boolean | null;
  falhaTecnica?: string;
  inconclusivo?: ScenarioResult['inconclusivo'];
}

async function umaAmostra(
  scenario: EvalScenario,
  systemPrompt: string,
  profile: JudgeProfile,
  politica: PoliticaDaQualidade | null,
  doCenario: ContextoDoCenario | null,
): Promise<AmostraDoCenario> {
  const messages = (scenario.history || []).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  messages.push({ role: 'user', content: scenario.userMessage });

  // V5 fix (2026-05-26): eval runner DEVE espelhar prod 1:1. Roda
  // classifyIntent + shouldEscalateToSonnet ANTES da chamada principal,
  // mesma cascata do izaTurnRouter.
  let escalar = false;
  try {
    // Com tempo limite como as demais: a classificação também vai ao provedor
    // pelo mesmo fetch sem AbortSignal.
    const intent: IzaIntent = await comTempoLimite(() =>
      classifyIntent(scenario.userMessage, messages.slice(0, -1) as any, {
        // agentName fica de fora de propósito: o izaTurnRouter de produção
        // também não passa, e o avaliador tem de espelhar produção 1:1.
        ...auditDoEval(profile),
        conversationId: null,
      }),
    );
    escalar = shouldEscalateToSonnet(intent);
  } catch (err: any) {
    logger.warn('[agentEvalRunner] classifyIntent falhou no eval — usando default tier', {
      scenarioId: scenario.id,
      err: err?.message,
    });
  }

  const { params, pedido } = pedidoDoAgente(politica, escalar);

  const t0 = Date.now();
  const resp = await withRetry(() =>
    comTempoLimite(() =>
      llmRouter.complete({
        system: systemPrompt,
        messages: messages as any,
        maxTokens: 800,
        temperature: 0.3,
        ...params,
        ...auditDoEval(profile),
      }),
    ),
  );
  const responseLatencyMs = Date.now() - t0;
  const responseTokens = { input: resp.usage?.inputTokens, output: resp.usage?.outputTokens };
  const agente: ModeloUsado | null = resp.provider
    ? { provider: resp.provider, model: resp.model ?? '' }
    : null;

  // A088: a mesma extração da produção. O cliente final lê o conteúdo de
  // <reply>; o avaliador lia o texto cru, com a resposta dobrada e as tags.
  const response = extractProductionReplyText(resp.text);

  const base = {
    response,
    responseLatencyMs,
    responseTokens,
    agente,
    modeloPedido: pedido,
    juiz: null,
    juizMesmaFamilia: null,
    deterministic: { passed: false, failedPatterns: [] as string[], missingPatterns: [] as string[] },
  };

  // A171: falha técnica sai da nota AQUI, antes do juiz e antes do sugeridor.
  const falha = detectarFalhaTecnica({ response, stopReason: resp.stopReason });
  if (falha) {
    logger.warn('[agentEvalRunner] cenário sem resposta avaliável', {
      scenarioId: scenario.id,
      motivo: falha,
    });
    return {
      ...base,
      combined: 'erro',
      judge: { passed: null, confidence: 0, reason: falha },
      falhaTecnica: falha,
    };
  }

  // C2 (Passo 1, A226): resposta servida por um modelo diferente do pedido
  // (a cascata caiu na reserva) mede OUTRO modelo. Não aprova nem reprova, e
  // não gasta juiz nem sugestão. Foi sobre execuções assim (72% das
  // respostas em Haiku ou gpt-4o-mini) que 29 das 30 correções da Iza nasceram.
  if (resp.provider && resp.provider !== pedido) {
    return {
      ...base,
      combined: 'inconclusivo',
      judge: { passed: null, confidence: 0, reason: EXPLICACAO_INCONCLUSIVO.modelo_diferente },
      inconclusivo: {
        motivo: 'modelo_diferente',
        explicacao:
          `${EXPLICACAO_INCONCLUSIVO.modelo_diferente} Pedido: ${pedido}. ` +
          `Respondeu: ${resp.provider}${resp.model ? ` (${resp.model})` : ''}.`,
      },
    };
  }

  // C2 (P13): os padrões de sempre mais a checagem por valor, a mesma régua
  // da regravação. Rodada 1 do PR #378, item 4: os valores em reais dos
  // trechos que o agente recebeu nesta amostra também são permitidos.
  const deterministic = checagemDeterministica(scenario, response, {
    reaisExtras: doCenario ? extrairValores(doCenario.trechos ?? '').reais : undefined,
  });

  // A171: chamada do juiz que quebra é falha TÉCNICA do teste, não erro do
  // agente.
  let veredito: VereditoDoJuiz;
  try {
    veredito = await julgarComEvidencia(
      {
        expectedBehavior: scenario.expectedBehavior,
        pergunta: scenario.userMessage,
        historico: scenario.history,
        trechos: doCenario?.trechos ?? '',
        baseConsultada: Boolean(doCenario),
        resposta: response,
        natureza: scenario.natureza ?? 'comportamento',
      },
      profile,
      {
        provedorDoAgente: resp.provider ?? pedido,
        // Item 1 da rodada 1 do #378: outra família só com o interruptor.
        permitirOutraFamilia: politica?.juizOutraFamilia === true,
      },
    );
  } catch (err: any) {
    const motivo = `O avaliador não respondeu a tempo (${String(err?.message || 'falha na chamada')}).`;
    logger.warn('[agentEvalRunner] juiz falhou', { scenarioId: scenario.id, err: err?.message });
    return {
      ...base,
      deterministic,
      combined: 'erro',
      judge: { passed: null, confidence: 0, reason: motivo },
      falhaTecnica: motivo,
    };
  }

  const juiz: ModeloUsado | null = veredito.provider
    ? { provider: veredito.provider, model: veredito.model ?? '' }
    : null;
  const familiaDoAgente = familiaDoProvedor(resp.provider ?? pedido);
  const juizMesmaFamilia = juiz ? familiaDoProvedor(juiz.provider) === familiaDoAgente : null;

  // A050: juiz INDETERMINADO não reprova. Rodada 1 do PR #378, item 11: e
  // também não aprova pela regra determinística sozinha. Veredito ilegível
  // (JSON cortado antes do veredito) ou sem evidência numa execução nova
  // vira inconclusivo, fora da nota; conta no portão de falha do provedor.
  if (veredito.passed === null || !veredito.evidencia) {
    logger.warn('[agentEvalRunner] juiz sem veredito ou sem evidência: inconclusivo', {
      scenarioId: scenario.id,
      semVeredito: veredito.passed === null,
      semEvidencia: !veredito.evidencia,
    });
    return {
      ...base,
      deterministic,
      combined: 'inconclusivo',
      juiz,
      juizMesmaFamilia,
      judge: {
        passed: null,
        confidence: 0,
        reason: EXPLICACAO_INCONCLUSIVO.juiz_indeterminado,
        evidencia: veredito.evidencia,
        causa: null,
      },
      inconclusivo: {
        motivo: 'juiz_indeterminado',
        explicacao: EXPLICACAO_INCONCLUSIVO.juiz_indeterminado,
      },
    };
  }

  let combined: 'pass' | 'partial' | 'fail';
  if (deterministic.passed && veredito.passed) combined = 'pass';
  else if (!deterministic.passed && !veredito.passed) combined = 'fail';
  else combined = 'partial';

  return {
    ...base,
    deterministic,
    combined,
    juiz,
    juizMesmaFamilia,
    judge: {
      passed: veredito.passed,
      confidence: veredito.confidence,
      reason: veredito.reason,
      evidencia: veredito.evidencia,
      causa: veredito.causa,
    },
  };
}

/**
 * Junta as repetições de um caso (C2, P13): aprova só se TODAS passarem.
 * Falha técnica em qualquer uma deixa o caso fora da nota; inconclusivo
 * também. A amostra que representa o caso é a primeira que não passou (é
 * ela que explica a reprovação) ou a última, quando todas passaram.
 */
function consolidarAmostras(amostras: AmostraDoCenario[]): {
  combined: VereditoDoCenario;
  representante: AmostraDoCenario;
} {
  const erro = amostras.find((a) => a.combined === 'erro');
  if (erro) return { combined: 'erro', representante: erro };
  const inconclusiva = amostras.find((a) => a.combined === 'inconclusivo');
  if (inconclusiva) return { combined: 'inconclusivo', representante: inconclusiva };
  const naoPassou = amostras.find((a) => a.combined !== 'pass');
  if (!naoPassou) return { combined: 'pass', representante: amostras[amostras.length - 1] };
  const combined = amostras.some((a) => a.combined === 'fail') ? 'fail' : 'partial';
  return { combined, representante: naoPassou };
}

async function runScenario(
  scenario: EvalScenario,
  agent: { id: string; systemPrompt: string | null; name: string },
  profile: JudgeProfile,
  contexto: ContextoDoSugeridor = {},
  politica: PoliticaDaQualidade | null = null,
): Promise<ScenarioResult> {
  // C1a: o contexto de produção quando o montador existe e o interruptor da
  // organização está ligado. Erro no montador não derruba o cenário: cai no
  // prompt de antes, com registro, porque o teste ainda vale como era.
  //
  // Rodada 2 do PR #377: o bloco de regras do chamador vai ao montador (o
  // compositor o põe depois do perfil vivo) e ao prompt de antes (depois do
  // system_prompt). É o MESMO texto nos dois ramos, lido uma vez só.
  const regrasBlock = contexto.regrasBlock ?? '';
  let doCenario: ContextoDoCenario | null = null;
  if (contexto.montarContexto) {
    try {
      doCenario = await contexto.montarContexto(scenario, { regrasBlock });
    } catch (err: any) {
      logger.warn('[agentEvalRunner] montador de contexto falhou: cenário com o prompt de antes', {
        scenarioId: scenario.id,
        err: err?.message,
      });
      doCenario = null;
    }
  }
  const systemPrompt = doCenario
    ? doCenario.systemPrompt
    : buildEvalSystemPrompt(agent, scenario, contexto.regrasBlock);
  const rastro = {
    ragStatus: doCenario ? doCenario.ragStatus : null,
    fontes: doCenario?.fontes ?? [],
    promptHash: doCenario?.hash,
  };
  const esqueleto = esqueletoDoResultado(scenario, rastro, politica?.motivo ?? null);

  // ─── C2 (P13, A037): caso de conhecimento só conta com a base no teste ───
  // Os casos gerados do conteúdo do cliente respondem com a BASE. Rodar sem
  // ela é repetir o cr7_preco_da_base_correto (26 reprovações em 26, porque o
  // agente testado não via a tabela). Sem base no teste, o caso fica
  // inconclusivo, sem chamar modelo nenhum; com a base fora do ar, é falha
  // técnica.
  if (scenario.conhecimento && !doCenario) {
    return {
      ...esqueleto,
      combined: 'inconclusivo',
      judge: { passed: null, confidence: 0, reason: EXPLICACAO_INCONCLUSIVO.base_nao_consultada },
      inconclusivo: {
        motivo: 'base_nao_consultada',
        explicacao: EXPLICACAO_INCONCLUSIVO.base_nao_consultada,
      },
    };
  }
  if (scenario.conhecimento && doCenario?.ragStatus === 'servico_fora') {
    const motivo =
      'A base de conhecimento estava fora do ar durante o teste: não dá para avaliar o que o agente sabe.';
    return {
      ...esqueleto,
      combined: 'erro',
      judge: { passed: null, confidence: 0, reason: motivo },
      falhaTecnica: motivo,
    };
  }

  // C2 (P13): o caso de conhecimento roda 2 vezes e aprova só se as duas
  // passarem. O re-teste pede uma passada só: ele já faz as próprias três.
  const repeticoes = contexto.semRepeticoes ? 1 : Math.max(1, Math.trunc(scenario.repeticoes ?? 1));
  const amostras: AmostraDoCenario[] = [];
  for (let i = 0; i < repeticoes; i++) {
    const a = await umaAmostra(scenario, systemPrompt, profile, politica, doCenario);
    amostras.push(a);
    // Falha técnica ou inconclusivo já decidem o caso: não gasta outra passada.
    if (a.combined === 'erro' || a.combined === 'inconclusivo') break;
  }
  const { combined, representante } = consolidarAmostras(amostras);

  // Nível 1 auto-suggest: sugestão para TODA não-aprovação (fail + partial).
  // C2 (P21): reprovação de conhecimento por falta de informação recebe a
  // ação de treino, sem modelo nenhum (suggestFix decide pelo diagnóstico).
  let suggestedFix: ScenarioResult['suggestedFix'] = undefined;
  if (combined === 'fail' || combined === 'partial') {
    suggestedFix = await suggestFix(
      scenario.id,
      scenario.expectedBehavior,
      representante.response,
      representante.judge.reason,
      agent.systemPrompt || '(sem prompt customizado)',
      profile,
      {
        ...contexto,
        diagnostico: {
          natureza: scenario.natureza ?? 'comportamento',
          causa: representante.judge.causa ?? null,
          acaoDeTreino: scenario.conhecimento?.acaoDeTreino ?? null,
          origem: scenario.conhecimento?.origem ?? null,
          fonte: scenario.conhecimento?.fonte ?? null,
          userMessage: scenario.userMessage,
        },
      },
    );
  }

  return {
    ...esqueleto,
    response: representante.response,
    responseLatencyMs: representante.responseLatencyMs,
    responseTokens: representante.responseTokens,
    deterministic: representante.deterministic,
    judge: representante.judge,
    combined,
    agente: representante.agente,
    modeloPedido: representante.modeloPedido,
    juiz: representante.juiz,
    juizMesmaFamilia: representante.juizMesmaFamilia,
    sugeridor: suggestedFix?.modelo ?? null,
    ...(representante.falhaTecnica ? { falhaTecnica: representante.falhaTecnica } : {}),
    ...(representante.inconclusivo ? { inconclusivo: representante.inconclusivo } : {}),
    ...(suggestedFix ? { suggestedFix } : {}),
    ...(repeticoes > 1
      ? {
          amostras: amostras.map((a) => ({
            combined: a.combined,
            response: a.response,
            judge: { passed: a.judge.passed, reason: a.judge.reason, evidencia: a.judge.evidencia },
            agente: a.agente,
          })),
        }
      : {}),
  };
}

// ─── Score compute ─────────────────────────────────────────────────

/** Cenário que não entra no denominador da nota: erro técnico ou inconclusivo. */
function foraDaNota(r: { combined: string }): boolean {
  return r.combined === 'erro' || r.combined === 'inconclusivo';
}

export function computeSummary(results: ScenarioResult[]): RunSummary {
  const passed = results.filter((r) => r.combined === 'pass').length;
  const partial = results.filter((r) => r.combined === 'partial').length;
  const failed = results.filter((r) => r.combined === 'fail').length;

  // A171 + C2 (Passo 1): 'erros' conta o que o PROVEDOR impediu de avaliar,
  // e é o que alimenta o portão dos 20%: falha técnica, resposta servida
  // por um modelo diferente do pedido (a cascata caiu na reserva) e, na
  // rodada 1 do PR #378 (item 11), o juiz sem veredito ou sem evidência. O
  // caso de conhecimento sem base no teste não entra aqui: não é defeito do
  // provedor, e contá-lo derrubaria a execução inteira pelo portão.
  const erros = results.filter(
    (r) =>
      r.combined === 'erro' ||
      (r.combined === 'inconclusivo' &&
        (r.inconclusivo?.motivo === 'modelo_diferente' || r.inconclusivo?.motivo === 'juiz_indeterminado')),
  ).length;

  // A245: todo cenário crítico que NÃO passou conta como crítico. Falha
  // técnica e inconclusivo ficam de fora: não dizem nada sobre o agente.
  const criticalFailed = results.filter(
    (r) => r.severity === 'critical' && r.combined !== 'pass' && !foraDaNota(r),
  ).length;

  // A171: o denominador é o que foi possível avaliar.
  const avaliaveis = results.filter((r) => !foraDaNota(r)).length;

  return {
    passed,
    partial,
    failed,
    criticalFailed,
    erros,
    scorePercent: avaliaveis > 0 ? Math.round((passed / avaliaveis) * 100) : 0,
  };
}

/**
 * C2 (Passo 3, P21): a nota em duas partes, Conhecimento do negócio e
 * Comportamento, com a mesma régua da nota única (parcial conta zero,
 * erro e inconclusivo ficam fora). Pura.
 *
 * Agente sem nenhum caso de conhecimento mostra 'sem_base' na parte de
 * conhecimento, e não uma porcentagem: antes, o agente sem conteúdo
 * nenhum tirava 77% num teste que não media conhecimento.
 */
export function computePlacar(
  results: Array<
    Pick<ScenarioResult, 'combined' | 'inconclusivo'> & {
      natureza?: NaturezaDoCenario;
      juiz?: ModeloUsado | null;
      juizMesmaFamilia?: boolean | null;
    }
  >,
): Placar {
  const parte = (lista: typeof results, vazio: ParteDoPlacar['estado']): ParteDoPlacar => {
    const total = lista.length;
    const avaliados = lista.filter((r) => !foraDaNota(r));
    const aprovados = avaliados.filter((r) => r.combined === 'pass').length;
    if (total === 0) return { estado: vazio, total: 0, avaliados: 0, aprovados: 0, percent: null };
    if (avaliados.length === 0) {
      return {
        estado: 'nao_testado',
        total,
        avaliados: 0,
        aprovados: 0,
        percent: null,
        motivo: lista.some((r) => r.inconclusivo?.motivo === 'base_nao_consultada')
          ? 'base_nao_consultada'
          : 'falha_tecnica',
      };
    }
    return {
      estado: 'avaliado',
      total,
      avaliados: avaliados.length,
      aprovados,
      percent: Math.round((aprovados / avaliados.length) * 100),
    };
  };
  const conhecimento = results.filter((r) => r.natureza === 'conhecimento');
  const comportamento = results.filter((r) => r.natureza !== 'conhecimento');

  // Rodada 1 do PR #378, item 1: a família do juiz desta execução.
  const julgados = results.filter((r) => r.juiz?.provider);
  const familias = new Set(julgados.map((r) => familiaDoProvedor(r.juiz!.provider) ?? 'desconhecida'));
  const juiz: Placar['juiz'] =
    julgados.length === 0
      ? { familia: null, outraFamilia: null }
      : {
          familia: familias.size === 1 ? [...familias][0] : 'misto',
          outraFamilia: julgados.every((r) => r.juizMesmaFamilia === false),
        };

  return {
    versao: 1,
    conhecimento: parte(conhecimento, 'sem_base'),
    comportamento: parte(comportamento, 'sem_cenarios'),
    inconclusivos: results.filter((r) => r.combined === 'inconclusivo').length,
    juiz,
  };
}

// ─── Re-verify verdict helper (Q1 — fecha o loop pós-fix) ────────

/**
 * Computa o veredicto de re-verificação comparando o resultado anterior
 * (before) com o novo resultado (after) de um re-run pós-fix.
 *
 * Pure function — sem I/O, testável em isolamento.
 *
 * @param before - combined anterior (do results JSONB da run), ou null se
 *                 não disponível (runs antigas).
 * @param afterResult - combined retornado pelo executeAgentEvalRun após o fix.
 * @returns { scenarioId, before, after, improved } — improved = after === 'pass'.
 */
export function computeReverifyVerdict(
  before: VereditoDoCenario | null,
  afterResult: VereditoDoCenario,
): { before: typeof before; after: typeof afterResult; improved: boolean } {
  return {
    before,
    after: afterResult,
    improved: afterResult === 'pass',
  };
}

// ─── Public entry-point ───────────────────────────────────────────

const THROTTLE_BETWEEN_SCENARIOS_MS = 1500;

/**
 * Executa o golden set inteiro num agent. Throttle de 1.5s entre cenários
 * pra absorver rate limit Anthropic. Retries automáticos em 429/5xx
 * (3 attempts, exponential backoff).
 *
 * Cenário que crasha durante exec não trava o run — vira fail registrado.
 */
export async function executeAgentEvalRun(
  scenarios: EvalScenario[],
  agent: { id: string; name: string; systemPrompt: string | null },
  profile: JudgeProfile,
  /**
   * A043: as regras já aprovadas e o bloco vivo, para o sugeridor fortalecer
   * a regra existente em vez de escrever a sexta versão dela. Quem chama é
   * quem tem banco; o avaliador não vai buscar sozinho. C1a: e o montador do
   * contexto de produção (`montarContexto`), no mesmo objeto. C2: e a
   * política da faixa do plano (`politica`, interruptor evalNoTier).
   */
  contexto: ContextoDoSugeridor = {},
): Promise<{ results: ScenarioResult[]; durationMs: number; summary: RunSummary; placar: Placar }> {
  const t0 = Date.now();
  const results: ScenarioResult[] = [];
  // C2, nota 1: a política é lida UMA vez por execução, e só se algum
  // cenário for rodar. Falha na leitura: a cascata padrão de hoje.
  let politica: PoliticaDaQualidade | null | undefined;
  const politicaDaExecucao = async (): Promise<PoliticaDaQualidade | null> => {
    if (politica !== undefined) return politica;
    try {
      politica =
        typeof contexto.politica === 'function' ? await contexto.politica() : contexto.politica ?? null;
    } catch (err: any) {
      logger.warn('[agentEvalRunner] política da faixa do plano indisponível: cascata padrão', {
        err: err?.message,
      });
      politica = null;
    }
    return politica ?? null;
  };
  let isFirst = true;
  for (const s of scenarios) {
    if (!isFirst) await sleep(THROTTLE_BETWEEN_SCENARIOS_MS);
    isFirst = false;
    try {
      const r = await runScenario(s, agent, profile, contexto, await politicaDaExecucao());
      results.push(r);
    } catch (err: any) {
      // A171: cenário que quebra é FALHA TÉCNICA, não reprovação. Eram 90
      // cenários "Scenario crashed" contados na nota, 32 deles com sugestão
      // gerada por cima de resposta vazia.
      logger.warn(`[agentEvalRunner] scenario ${s.id} falhou`, { err: err?.message });
      results.push(
        resultadoComErro(
          s,
          `O teste deste cenário não completou (${String(err?.message || 'falha desconhecida')}).`,
        ),
      );
    }
  }
  const durationMs = Date.now() - t0;
  const summary = computeSummary(results);
  return { results, durationMs, summary, placar: computePlacar(results) };
}
