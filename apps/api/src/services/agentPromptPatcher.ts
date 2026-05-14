/**
 * Agent Prompt Patcher — aplicação cirúrgica de patches em system_prompt.
 *
 * FASE 2.2a (task #243): quando admin/cliente clica "Aplicar Sugestão" no
 * dashboard de Qualidade do Agente, esse service:
 *   1. Lê o systemPrompt atual do agent
 *   2. Decide ONDE inserir o diff (baseado no campo `where` da sugestão)
 *   3. Aplica o patch retornando { promptBefore, promptAfter }
 *   4. Chamador persiste audit + faz UPDATE no DB
 *
 * Estratégia de aplicação (em ordem de tentativa):
 *
 *   a) Match direto: se `where` contém "REGRA N" e o prompt tem
 *      "# REGRA N", insere o diff DEPOIS do bloco da regra.
 *
 *   b) Match de seção: se `where` menciona "section" ou "bloco" + palavra
 *      chave, procura header markdown (## ou #) com palavra.
 *
 *   c) Fallback append: anexa no final do prompt com marcador
 *      "# PATCH MANUAL YYYY-MM-DD HH:MM (cenário: X)".
 *
 * Sempre retorna promptBefore + promptAfter mesmo se fallback ativou,
 * pra audit ter snapshot completo de rollback.
 */

const FALLBACK_MARKER_PREFIX = '# PATCH MANUAL';

export interface PatchInput {
  /** system_prompt atual do agent (lido do DB). */
  currentPrompt: string;
  /**
   * Hint de localização vinda da sugestão IA. Pode ser:
   *   - "REGRA 13 (uso de nome)"
   *   - "Seção 'PROIBIÇÕES'"
   *   - "Final do prompt"
   *   - "Anti-padrões"
   */
  where: string;
  /** Diff em markdown que vai ser inserido. Texto que deve aparecer no prompt depois. */
  diff: string;
  /** ID do cenário pra audit no marker de fallback. */
  scenarioId: string;
}

export interface PatchResult {
  promptBefore: string;
  promptAfter: string;
  /** Como o patch foi aplicado: 'rule_match' | 'section_match' | 'append'. */
  strategy: 'rule_match' | 'section_match' | 'append';
  /** Linha aproximada onde inseriu (1-indexed). Útil pra UI mostrar contexto. */
  insertedAtLine: number;
}

/**
 * FASE 2.2c (#246): erro lançado quando o diff sugerido já existe (substring
 * exata após sanitize) dentro do prompt atual. Aplicar de novo seria
 * silenciosamente duplicar a regra, que foi a causa do "erro persiste após
 * apply" — a IA gerou a mesma sugestão fraca duas vezes (zappiq_trial_lead_morno,
 * hash 29dc9b01 aplicado em 13:56 E 14:21), e a regra ficou diluída no prompt,
 * sendo ignorada pelo LLM em runtime. Só resolveu quando o usuário editou
 * manualmente para "REGRA INVIOLÁVEL #14 ... OBRIGATORIAMENTE".
 *
 * Caller deve capturar e retornar 409 + UI instrui o usuário a editar
 * a sugestão tornando-a mais forte (caps, "REGRA INVIOLÁVEL", PROIBIDO).
 */
export class DuplicatePatchError extends Error {
  readonly code = 'DUPLICATE_PATCH';
  readonly existingExcerpt: string;
  constructor(existingExcerpt: string) {
    super(
      'Esta sugestão já existe no prompt — aplicar duplicaria a regra. ' +
        'Edite a sugestão antes de aplicar: torne-a mais forte (caps, "REGRA INVIOLÁVEL", PROIBIDO).',
    );
    this.name = 'DuplicatePatchError';
    this.existingExcerpt = existingExcerpt;
  }
}

/**
 * Normaliza string pra comparação fuzzy: lowercase, colapsa whitespace,
 * remove pontuação e marcadores markdown comuns. Permite detectar
 * duplicação mesmo se a IA reformatou marginalmente a sugestão.
 */
function normalizeForDedup(s: string): string {
  return s
    .toLowerCase()
    .replace(/[*_`>+-]/g, '') // strip markdown emphasis e diff prefixes
    .replace(/[.,;:!?()"']/g, '') // strip pontuação
    .replace(/\s+/g, ' ') // colapsa whitespace
    .trim();
}

export function applyPatch(input: PatchInput): PatchResult {
  const { currentPrompt, where, diff, scenarioId } = input;
  const cleanDiff = sanitizeDiff(diff);

  // FASE 2.2c (#246): dedup check ANTES de qualquer estratégia.
  // Se o diff já está (mesmo aproximadamente) no prompt, rejeita.
  const normalizedDiff = normalizeForDedup(cleanDiff);
  const normalizedPrompt = normalizeForDedup(currentPrompt);
  // Threshold: diff precisa ter >= 30 chars normalizados pra disparar dedup
  // (frases muito curtas comuns como "+ Use o nome" podem dar falso positivo).
  if (normalizedDiff.length >= 30 && normalizedPrompt.includes(normalizedDiff)) {
    throw new DuplicatePatchError(cleanDiff.slice(0, 300));
  }

  // Estratégia A: match de REGRA N
  const ruleMatch = where.match(/REGRA\s+(\d+)/i);
  if (ruleMatch) {
    const ruleNum = ruleMatch[1];
    const result = insertAfterRule(currentPrompt, ruleNum, cleanDiff);
    if (result) {
      return {
        promptBefore: currentPrompt,
        promptAfter: result.promptAfter,
        strategy: 'rule_match',
        insertedAtLine: result.insertedAtLine,
      };
    }
  }

  // Estratégia B: match de seção por keyword
  const sectionKeywords = extractSectionKeywords(where);
  for (const kw of sectionKeywords) {
    const result = insertAfterSection(currentPrompt, kw, cleanDiff);
    if (result) {
      return {
        promptBefore: currentPrompt,
        promptAfter: result.promptAfter,
        strategy: 'section_match',
        insertedAtLine: result.insertedAtLine,
      };
    }
  }

  // Fallback C: append no final com marcador
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const marker = `\n\n${FALLBACK_MARKER_PREFIX} ${timestamp} (cenário: ${scenarioId})\n`;
  const promptAfter = currentPrompt.trimEnd() + marker + cleanDiff + '\n';

  return {
    promptBefore: currentPrompt,
    promptAfter,
    strategy: 'append',
    insertedAtLine: currentPrompt.split('\n').length + 2,
  };
}

/**
 * Remove prefixos comuns de diff (`+ `, `> `) sem perder conteúdo.
 * Aceita 3 formatos comuns: linhas com `+`, blockquote, ou texto puro.
 */
function sanitizeDiff(diff: string): string {
  return diff
    .split('\n')
    .map((line) => {
      // Remove `+ ` (diff style) sem afetar linhas que começam com "+"
      // em texto real (raro mas possível). Heuristica simples: só se for início.
      if (line.startsWith('+ ')) return line.slice(2);
      if (line.startsWith('> ')) return line.slice(2);
      return line;
    })
    .join('\n')
    .trim();
}

/**
 * Encontra "# REGRA N" no prompt e insere o diff logo após o bloco daquela
 * regra (ou seja, antes da próxima `# REGRA` ou fim do prompt).
 */
function insertAfterRule(
  prompt: string,
  ruleNum: string,
  diff: string,
): { promptAfter: string; insertedAtLine: number } | null {
  const lines = prompt.split('\n');
  // Procura linha que começa com "# REGRA <ruleNum>"
  const ruleStartIdx = lines.findIndex((l) =>
    new RegExp(`^#\\s*REGRA\\s+${ruleNum}\\b`, 'i').test(l),
  );
  if (ruleStartIdx === -1) return null;

  // Procura próximo "# REGRA" depois desse índice (fim do bloco da regra atual)
  let blockEndIdx = lines.length;
  for (let i = ruleStartIdx + 1; i < lines.length; i++) {
    if (/^#\s*REGRA\s+\d+/i.test(lines[i])) {
      blockEndIdx = i;
      break;
    }
  }

  // Insere antes do bloco da próxima regra (ou antes do fim do prompt)
  const before = lines.slice(0, blockEndIdx).join('\n');
  const after = lines.slice(blockEndIdx).join('\n');
  const promptAfter = `${before.trimEnd()}\n\n${diff}\n\n${after}`.trim() + '\n';

  return { promptAfter, insertedAtLine: blockEndIdx + 1 };
}

/**
 * Extrai keywords úteis do `where` pra fazer fuzzy match com seções.
 * Filtra stopwords e palavras curtas.
 */
function extractSectionKeywords(where: string): string[] {
  const stopwords = new Set([
    'a', 'o', 'as', 'os', 'e', 'ou', 'de', 'da', 'do', 'das', 'dos',
    'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem',
    'seção', 'secao', 'section', 'bloco', 'parte', 'fim', 'final',
  ]);
  return where
    .toLowerCase()
    .split(/[\s,.\-_/()'"]+/)
    .filter((w) => w.length >= 4 && !stopwords.has(w))
    .slice(0, 3); // top 3 keywords
}

/**
 * Procura header markdown contendo a keyword e insere diff logo após o
 * bloco daquela seção. Header pode ser # ou ##.
 */
function insertAfterSection(
  prompt: string,
  keyword: string,
  diff: string,
): { promptAfter: string; insertedAtLine: number } | null {
  const lines = prompt.split('\n');
  const sectionIdx = lines.findIndex(
    (l) => /^#{1,3}\s/.test(l) && l.toLowerCase().includes(keyword),
  );
  if (sectionIdx === -1) return null;

  // Próximo header (mesmo nível ou superior) marca fim da seção
  let blockEndIdx = lines.length;
  const headerLevel = (lines[sectionIdx].match(/^(#+)/) || [''])[1].length;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s/);
    if (match && match[1].length <= headerLevel) {
      blockEndIdx = i;
      break;
    }
  }

  const before = lines.slice(0, blockEndIdx).join('\n');
  const after = lines.slice(blockEndIdx).join('\n');
  const promptAfter = `${before.trimEnd()}\n\n${diff}\n\n${after}`.trim() + '\n';

  return { promptAfter, insertedAtLine: blockEndIdx + 1 };
}
