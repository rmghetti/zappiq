/* ══════════════════════════════════════════════════════════════════════
 * Tenant Isolation Guard — a Iza não vaza pro cliente.
 * --------------------------------------------------------------------
 * Por quê (14/07/2026, relato do CMJ):
 *   A Qualidade da IA avaliava a Vera (agente do CMJ) contra o gabarito da
 *   Iza. O juiz reprovou a Vera porque ela "não saúda especificamente a
 *   ZappIQ (saudou apenas 'Rod' e mencionou CMJ)". O suggestFix então propôs
 *   uma REGRA INVIOLÁVEL mandando a Vera se apresentar como Iza da ZappIQ, e
 *   o botão Aplicar gravaria isso no systemPrompt do CMJ.
 *
 * O gate por org (isZappIQOrg) resolve a origem. Este guard é a rede final:
 * mesmo que um cenário novo entre contaminado, ou que o LLM invente a marca
 * numa sugestão, nada com marca da ZappIQ chega ao tenant.
 *
 * Onde é usado:
 *   1. Teste do gabarito (resolveEvalSet) — quebra o CI, não o runtime.
 *   2. Antes de exibir uma sugestão de patch ao cliente.
 *   3. Antes de applyPatch gravar no Agent.systemPrompt. ← a rede final.
 *
 * Cuidado que custou caro:
 *   Buscar "iza" por substring acusa "humanizar", "organiza", "autoriza".
 *   Por isso o nome da agente só casa com fronteira de palavra (\bIza\b).
 * ══════════════════════════════════════════════════════════════════════ */

export interface BrandLeak {
  /** Termo canônico que vazou (ex: 'Iza', 'ZappIQ'). */
  term: string;
  /** Trecho ao redor da ocorrência, pra quem for consertar achar rápido. */
  excerpt: string;
}

interface Pattern {
  term: string;
  regex: RegExp;
}

/**
 * Marca inequívoca da ZappIQ. Zero tolerância a falso positivo:
 * cada regex aqui foi escolhida pra não casar com português comum.
 */
const BRAND_PATTERNS: Pattern[] = [
  // \b antes do I exige não-letra: "humanizar"/"organiza" não casam porque
  // 'iza' vem precedido de letra. Underscore é \w, então IZA_LITE também não.
  { term: 'Iza', regex: /\bIza\b/gi },
  { term: 'ZappIQ', regex: /zappiq/gi },
  // O link de agendamento agora é zappiq.com.br/agendar, já coberto pelo termo 'ZappIQ'.
];

/**
 * Conteúdo comercial da ZappIQ. Não é "marca" (um cliente pode legitimamente
 * cobrar R$ 197 por algo), então só vale no modo estrito, usado onde o texto
 * NUNCA deveria falar do comercial da ZappIQ: o gabarito do eval.
 */
const COMMERCIAL_PATTERNS: Pattern[] = [
  { term: 'preço do plano Starter (R$ 197)', regex: /R\$\s*197\b/g },
  { term: 'pacote Voice', regex: /\bVoice\s*\d{3,4}\b/gi },
  { term: 'preço do Voice 200 (R$ 79,90)', regex: /R\$\s*79[,.]90\b/g },
  { term: 'trial de 14 dias da ZappIQ', regex: /\b14\s*dias\s*(gr[áa]tis|de\s*trial)/gi },
  { term: 'concorrente citado no prompt da Iza', regex: /take\s*blip/gi },
];

function excerptAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + len + 30);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Acha marca/conteúdo da ZappIQ num texto.
 *
 * @param opts.strict  também procura preço/SKU/trial da ZappIQ (use no eval).
 * @param opts.allow   termos canônicos a ignorar. Escape hatch pro caso raro
 *                     de um tenant se chamar legitimamente como um termo nosso.
 * @returns lista de vazamentos (vazia = limpo).
 */
export function findForeignBrandLeaks(
  text: string,
  opts: { strict?: boolean; allow?: string[] } = {},
): BrandLeak[] {
  if (!text) return [];
  const allow = new Set((opts.allow || []).map((a) => a.toLowerCase()));
  const patterns = opts.strict ? [...BRAND_PATTERNS, ...COMMERCIAL_PATTERNS] : BRAND_PATTERNS;

  const leaks: BrandLeak[] = [];
  for (const p of patterns) {
    if (allow.has(p.term.toLowerCase())) continue;
    // regex tem /g e é reutilizada entre chamadas — zerar lastIndex é obrigatório.
    p.regex.lastIndex = 0;
    const match = p.regex.exec(text);
    if (match) {
      leaks.push({ term: p.term, excerpt: excerptAround(text, match.index, match[0].length) });
    }
    p.regex.lastIndex = 0;
  }
  return leaks;
}

export class ForeignBrandLeakError extends Error {
  readonly code = 'FOREIGN_BRAND_LEAK';
  readonly leaks: BrandLeak[];
  constructor(message: string, leaks: BrandLeak[]) {
    super(message);
    this.name = 'ForeignBrandLeakError';
    this.leaks = leaks;
  }
}

/** O mínimo que o guard precisa saber do tenant. */
export interface IsolationSubject {
  isZappIQ: boolean;
  agentName?: string;
  businessName?: string;
}

/**
 * Lança ForeignBrandLeakError se `text` levar marca da ZappIQ pra um tenant.
 *
 * Não faz nada quando a org É a ZappIQ: lá a Iza é a identidade legítima.
 *
 * @param context onde o texto ia parar ('systemPrompt', 'sugestão de patch',
 *                'cenário de eval'). Entra na mensagem de erro.
 */
export function assertNoForeignBrand(
  text: string,
  subject: IsolationSubject,
  context: string,
  opts: { strict?: boolean } = {},
): void {
  if (subject.isZappIQ) return;

  // Se a agente do tenant se chama Iza, o nome dela não é vazamento.
  const allow: string[] = [];
  if (subject.agentName && /^iza$/i.test(subject.agentName.trim())) allow.push('Iza');

  const leaks = findForeignBrandLeaks(text, { strict: opts.strict, allow });
  if (leaks.length === 0) return;

  const quem = subject.businessName || 'o cliente';
  const detalhe = leaks.map((l) => `  • ${l.term} → "${l.excerpt}"`).join('\n');
  throw new ForeignBrandLeakError(
    `Vazamento de marca da ZappIQ em "${context}" para ${quem}. ` +
      `O agente do cliente não pode receber identidade, link ou preço da ZappIQ.\n${detalhe}`,
    leaks,
  );
}
