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

import { llmRouter, type LLMOperation } from './llm/LLMRouter.js';
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
import { findForeignBrandLeaks } from '../agents/tenantIsolationGuard.js';
// A088: a MESMA extração que o WhatsApp usa. Antes o avaliador lia resp.text
// cru e julgava a resposta dobrada, com as tags dentro.
import { extractProductionReplyText } from '../agents/replyText.js';
import { regraTerminaEmFraseCompleta } from './agentPromptPatcher.js';

// ─── Tipos públicos ─────────────────────────────────────────────────

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
  };
  /**
   * A171 — 'erro' é falha TÉCNICA do teste (provedor fora, tempo limite,
   * resposta vazia ou cortada, provedor diferente do pedido). Fica fora da
   * nota, não conta como crítico e nunca gera sugestão. Antes virava 'fail'
   * com nota 0: em 16/06 uma correção nascida de 25 respostas vazias foi
   * aplicada no prompt da Iza e continua lá.
   */
  combined: 'pass' | 'partial' | 'fail' | 'erro';
  /** Motivo legível da falha técnica, em português. Só quando combined='erro'. */
  falhaTecnica?: string;
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
  };
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

7. REGRAS BASE (A078 — a mais cara de violar): o pedido traz o resumo das
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
   * sugestão sendo descartada em seguida. Um clique custava de 9 a 12
   * chamadas ao modelo em vez das 6 que a tela declara (e o sugeridor ainda
   * pede DUAS quando a primeira resposta volta cortada).
   */
  pularSugestao?: boolean;
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

### REGRAS BASE DO AGENTE (resumo — imutáveis, prevalecem sobre o patch)
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
): string {
  // FASE 2.1 fix (2026-05-13): mock condicional do bloco "Cliente atual".
  // Cenários cr5_nome_ausente_* testam o comportamento de PERGUNTAR nome —
  // injetar "Nome registrado: Rod" forçava o agent a usar o nome (falso pass)
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
    '',
    '# Cliente atual (eval test mock)',
    nameMockEnabled
      ? 'Nome registrado: Rod'
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

/** Resultado de cenário que não pôde ser avaliado. Fora da nota, sem sugestão. */
function resultadoComErro(
  scenario: EvalScenario,
  motivo: string,
  extra: Partial<ScenarioResult> = {},
): ScenarioResult {
  return {
    scenarioId: scenario.id,
    category: scenario.category,
    severity: scenario.severity,
    description: scenario.description,
    userMessage: scenario.userMessage,
    response: '',
    responseLatencyMs: 0,
    responseTokens: {},
    deterministic: { passed: false, failedPatterns: [], missingPatterns: [] },
    judge: { passed: null, confidence: 0, reason: motivo },
    combined: 'erro',
    falhaTecnica: motivo,
    ...extra,
  };
}

async function runScenario(
  scenario: EvalScenario,
  agent: { id: string; systemPrompt: string | null; name: string },
  profile: JudgeProfile,
  contexto: ContextoDoSugeridor = {},
): Promise<ScenarioResult> {
  const systemPrompt = buildEvalSystemPrompt(agent, scenario);

  const messages = (scenario.history || []).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  messages.push({ role: 'user', content: scenario.userMessage });

  // V5 fix (2026-05-26): eval runner DEVE espelhar prod 1:1. Antes chamava
  // llmRouter.complete direto, sem classify — ou seja, eval testava Gemini
  // Starter puro enquanto prod já escalava pra Sonnet em intent crítica
  // (handoff/objection/enterprise/purchase_intent/price_question). Resultado:
  // cenários como zappiq_voice_preco_correto sempre apareciam como 'partial'
  // no eval (Gemini reflex "começa em R$ X"), mesmo com Sonnet acertando
  // em prod. Agora roda classifyIntent + shouldEscalateToSonnet ANTES da
  // chamada principal — mesma cascata do izaTurnRouter.
  let intent: IzaIntent = 'normal';
  let preferProvider: 'anthropic-sonnet' | undefined;
  try {
    // Com tempo limite como as demais: a classificação também vai ao provedor
    // pelo mesmo fetch sem AbortSignal, e pendurada aqui segurava a execução
    // inteira antes de a primeira resposta do agente sequer ser pedida.
    intent = await comTempoLimite(() =>
      classifyIntent(scenario.userMessage, messages.slice(0, -1) as any, {
        // agentName fica de fora de propósito: o izaTurnRouter de produção
        // também não passa, e o avaliador tem de espelhar produção 1:1.
        ...auditDoEval(profile),
        conversationId: null,
      }),
    );
    if (shouldEscalateToSonnet(intent)) {
      // PR #216: preferProvider (com fallback) em vez de forceProvider (sem).
      // Bug anterior: Sonnet rate-limit derrubava 7 cenarios com "all providers
      // exhausted". Agora cai pra Haiku/Gemini se Sonnet falhar.
      preferProvider = 'anthropic-sonnet';
    }
  } catch (err: any) {
    logger.warn('[agentEvalRunner] classifyIntent falhou no eval — usando default tier', {
      scenarioId: scenario.id,
      err: err?.message,
    });
  }

  const t0 = Date.now();
  const resp = await withRetry(() =>
    comTempoLimite(() =>
      llmRouter.complete({
        system: systemPrompt,
        messages: messages as any,
        maxTokens: 800,
        temperature: 0.3,
        preferProvider,
        ...auditDoEval(profile),
      }),
    ),
  );
  const responseLatencyMs = Date.now() - t0;

  // A088: a mesma extração da produção. O cliente final lê o conteúdo de
  // <reply>; o avaliador lia o texto cru, com a resposta dobrada e as tags.
  const response = extractProductionReplyText(resp.text);

  // A171: falha técnica sai da nota AQUI, antes do juiz e antes do sugeridor.
  // Gastar juiz e sugestão sobre uma resposta vazia foi o que produziu, em
  // 16/06, uma correção aplicada no prompt da Iza a partir de 25 respostas
  // vazias, com o sugeridor inventando a causa.
  const falha = detectarFalhaTecnica({
    response,
    stopReason: resp.stopReason,
    providerPedido: preferProvider ?? null,
    providerUsado: resp.provider ?? null,
  });
  if (falha) {
    logger.warn('[agentEvalRunner] cenário sem resposta avaliável', {
      scenarioId: scenario.id,
      motivo: falha,
    });
    return resultadoComErro(scenario, falha, {
      responseLatencyMs,
      responseTokens: { input: resp.usage?.inputTokens, output: resp.usage?.outputTokens },
    });
  }

  const passPatterns = scenario.passPatterns || [];
  const failPatterns = scenario.failPatterns || [];
  const missingPatterns: string[] = [];
  const failedPatterns: string[] = [];
  for (const p of passPatterns) {
    if (!p.test(response)) missingPatterns.push(p.toString());
  }
  for (const p of failPatterns) {
    if (p.test(response)) failedPatterns.push(p.toString());
  }
  const deterministicPassed = missingPatterns.length === 0 && failedPatterns.length === 0;

  // 'eval' explícito: aqui o juiz é gasto de bastidor da casa. O padrão da
  // função é 'classify', que é o que a simulação do Maestro precisa.
  //
  // A171: chamada do juiz que quebra é falha TÉCNICA do teste, não erro do
  // agente. Antes virava reprovação com o texto "Judge error: ..." indo parar
  // na tela do cliente, em inglês.
  let judge: { passed: boolean | null; confidence: number; reason: string };
  try {
    judge = await runJudge(scenario.expectedBehavior, response, profile, { operation: 'eval' });
  } catch (err: any) {
    const motivo = `O avaliador não respondeu a tempo (${String(err?.message || 'falha na chamada')}).`;
    logger.warn('[agentEvalRunner] juiz falhou', { scenarioId: scenario.id, err: err?.message });
    return resultadoComErro(scenario, motivo, {
      response,
      responseLatencyMs,
      responseTokens: { input: resp.usage?.inputTokens, output: resp.usage?.outputTokens },
      deterministic: { passed: deterministicPassed, failedPatterns, missingPatterns },
    });
  }

  // A050: juiz INDETERMINADO não reprova. Quem decide, nesse caso, é a regra
  // determinística sozinha. Antes o indeterminado entrava como reprovação.
  let combined: 'pass' | 'partial' | 'fail';
  if (judge.passed === null) combined = deterministicPassed ? 'pass' : 'fail';
  else if (deterministicPassed && judge.passed) combined = 'pass';
  else if (!deterministicPassed && !judge.passed) combined = 'fail';
  else combined = 'partial';

  // Nível 1 auto-suggest: gera sugestão pra TODA NÃO-aprovação (fail + partial).
  // Mudanca 2026-05-25: parciais tambem ganham sugestao e botao Aplicar — o
  // objetivo e fechar o loop curto e empurrar o score em direcao a 90%+ (sem
  // depender do usuario lembrar de pedir sob demanda pra desvios menores).
  let suggestedFix: ScenarioResult['suggestedFix'] = undefined;
  if (combined === 'fail' || combined === 'partial') {
    suggestedFix = await suggestFix(
      scenario.id,
      scenario.expectedBehavior,
      response,
      judge.reason,
      agent.systemPrompt || '(sem prompt customizado)',
      profile,
      contexto,
    );
  }

  return {
    scenarioId: scenario.id,
    category: scenario.category,
    severity: scenario.severity,
    description: scenario.description,
    userMessage: scenario.userMessage,
    response,
    responseLatencyMs,
    responseTokens: {
      input: resp.usage?.inputTokens,
      output: resp.usage?.outputTokens,
    },
    suggestedFix,
    deterministic: {
      passed: deterministicPassed,
      failedPatterns,
      missingPatterns,
    },
    judge,
    combined,
  };
}

// ─── Score compute ─────────────────────────────────────────────────

export function computeSummary(results: ScenarioResult[]): RunSummary {
  const passed = results.filter((r) => r.combined === 'pass').length;
  const partial = results.filter((r) => r.combined === 'partial').length;
  const failed = results.filter((r) => r.combined === 'fail').length;
  const erros = results.filter((r) => r.combined === 'erro').length;

  // A245: o indicador "Críticos" contava só 'fail', e 'fail' exige que a regra
  // automática E o juiz reprovem juntos. Qualquer divergência virava 'Parcial'.
  // Medido nos clientes: 138 desvios críticos rotulados Parcial, 1 reprovado,
  // e o indicador "Críticos" marcando 0 em 26 de 28 execuções.
  //
  // Agora todo cenário crítico que NÃO passou conta como crítico. Falha
  // técnica fica de fora: ela não diz nada sobre o agente.
  const criticalFailed = results.filter(
    (r) => r.severity === 'critical' && r.combined !== 'pass' && r.combined !== 'erro',
  ).length;

  // A171: o denominador é o que foi possível avaliar. Contar cenário quebrado
  // como reprovação derrubava a nota por defeito do provedor: em 15/06, 25
  // respostas vazias deram nota 0.
  const avaliaveis = results.length - erros;

  return {
    passed,
    partial,
    failed,
    criticalFailed,
    erros,
    scorePercent: avaliaveis > 0 ? Math.round((passed / avaliaveis) * 100) : 0,
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
  before: 'pass' | 'partial' | 'fail' | 'erro' | null,
  afterResult: 'pass' | 'partial' | 'fail' | 'erro',
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
   * quem tem banco; o avaliador não vai buscar sozinho.
   */
  contexto: ContextoDoSugeridor = {},
): Promise<{ results: ScenarioResult[]; durationMs: number; summary: RunSummary }> {
  const t0 = Date.now();
  const results: ScenarioResult[] = [];
  let isFirst = true;
  for (const s of scenarios) {
    if (!isFirst) await sleep(THROTTLE_BETWEEN_SCENARIOS_MS);
    isFirst = false;
    try {
      const r = await runScenario(s, agent, profile, contexto);
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
  return { results, durationMs, summary };
}
