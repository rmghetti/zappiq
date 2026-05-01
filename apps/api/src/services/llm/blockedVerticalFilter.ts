/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Pre-filter de verticais bloqueadas (defense-in-depth)
 * --------------------------------------------------------------------
 * Detecta menções a segmentos que ZappIQ NÃO atende ANTES de chamar o LLM.
 * Quando match: retorna template estático de desqualificação respeitosa,
 * sem custo de LLM e sem risco de o modelo "negociar" a vertical.
 *
 * Verticais bloqueadas (decisão comercial 2026-04-30):
 *   - Apostas (cassino, esportivas, bingo online)
 *   - Cripto não-regulada (P2P sem registro CVM, ICO, NFT financeiro)
 *   - Pornografia / conteúdo adulto
 *   - MLM / marketing multinível
 *
 * Por que pre-filter?
 *   Gate 1 revelou que mesmo Sonnet 4.6 (com prompt V4 enxuto explícito)
 *   FALHOU em desqualificar "casa de apostas" em 2 testes consecutivos —
 *   tratou como lead normal. Prompt V5 com few-shot melhorou (5/5 em Mini
 *   Gate 1.5), mas não confiamos só no LLM pra compliance LGPD/Procon.
 *   Pre-filter é defense-in-depth: pega o caso ANTES do LLM ver.
 *
 * Falsos positivos aceitáveis: paranoia > permissividade. Se filtrar
 * algo legítimo, cliente pode pedir humano e a operação verifica.
 *
 * Falsos negativos a aceitar: se cliente disfarçar (ex: "promo de gaming")
 * pode passar — o prompt LLM (V5+) é a 2ª camada.
 * ══════════════════════════════════════════════════════════════════════ */

export type BlockedVertical =
  | 'apostas'
  | 'cripto-nao-regulada'
  | 'pornografia'
  | 'mlm';

export interface BlockedVerticalMatch {
  blocked: true;
  vertical: BlockedVertical;
  /** Template de resposta a enviar ao cliente (sem chamar LLM). */
  suggestedResponse: string;
  /** Trecho do input que casou com o pattern (audit). */
  matchedSnippet: string;
}

export interface BlockedVerticalNoMatch {
  blocked: false;
}

export type BlockedVerticalResult = BlockedVerticalMatch | BlockedVerticalNoMatch;

/**
 * Padrões regex por vertical. Ordem importa: padrões mais específicos
 * primeiro pra evitar overlap (ex: "marketing multinível" > "marketing").
 *
 * Strategia: word boundaries (\b) + case-insensitive + sem acentos sensitive
 * (regex já cobre via case e via aliases comuns sem acento).
 */
const PATTERNS: Array<{
  vertical: BlockedVertical;
  regex: RegExp;
}> = [
  // ── Apostas ───────────────────────────────────────────────────
  {
    vertical: 'apostas',
    regex: new RegExp(
      [
        '\\b(casa(s)?\\s+de\\s+apostas?)\\b',
        '\\b(cassino(s)?\\s+online)\\b',
        '\\b(cassino(s)?)\\b',
        '\\b(apostas?\\s+esportiva(s)?)\\b',
        '\\b(bet365|sportingbet|bet\\s*nacional|sportsbet|betano)\\b',
        '\\b(bingo\\s+online)\\b',
        '\\b(jogos?\\s+de\\s+azar)\\b',
        '\\b(roleta\\s+online|caça[-\\s]?n[ií]queis?\\s+online)\\b',
      ].join('|'),
      'i',
    ),
  },
  // ── Cripto não-regulada ──────────────────────────────────────
  {
    vertical: 'cripto-nao-regulada',
    regex: new RegExp(
      [
        '\\b(corretora\\s+(de\\s+)?cripto\\s+p2p)\\b',
        '\\b(p2p\\s+(de\\s+)?cripto)\\b',
        '\\b(cripto\\s+p2p)\\b',
        '\\b(ico|initial\\s+coin\\s+offering)\\b',
        '\\b(nft\\s+financeiro|nft\\s+como\\s+investimento|nft\\s+investimento)\\b',
        '\\b(plataforma\\s+(de\\s+)?cripto\\s+sem\\s+registro)\\b',
        '\\b(corretora\\s+sem\\s+registro\\s+(da\\s+)?cvm)\\b',
        '\\b(token\\s+sale\\s+sem\\s+registro)\\b',
      ].join('|'),
      'i',
    ),
  },
  // ── Pornografia ──────────────────────────────────────────────
  {
    vertical: 'pornografia',
    regex: new RegExp(
      [
        '\\b(porn[oô]grafia|conte[uú]do\\s+adulto|conte[uú]do\\s+pornogr[aá]fico)\\b',
        '\\b(only\\s*fans|onlyfans)\\b',
        '\\b(privacy\\s+(br|brasil))\\b',
        '\\b(camgirl|camboy|cam\\s+(girl|boy))\\b',
        '\\b(escort(s)?|garota(s)?\\s+de\\s+programa)\\b',
        '\\b(site\\s+adulto|plataforma\\s+adulta)\\b',
      ].join('|'),
      'i',
    ),
  },
  // ── MLM / Multinível ─────────────────────────────────────────
  {
    vertical: 'mlm',
    regex: new RegExp(
      [
        '\\b(mlm)\\b',
        '\\b(marketing\\s+multin[ií]vel)\\b',
        '\\b(multin[ií]vel)\\b',
        '\\b(marketing\\s+de\\s+rede)\\b',
        '\\b(matriz\\s+(bin[aá]ria|tern[aá]ria|forçada))\\b',
        '\\b(herbalife|amway|forever\\s+living|hinode|polishop|natura\\s+rede)\\b',
        '\\b(plano\\s+de\\s+remunera[cç][aã]o\\s+multin[ií]vel)\\b',
      ].join('|'),
      'i',
    ),
  },
];

/**
 * Templates estáticos de desqualificação por vertical.
 * Tom: respeitoso, breve, sem moralizar, sem oferecer alternativa.
 *
 * Contraste com falha do Sonnet em Gate 1 (p15): perguntou volume e
 * detalhes em vez de desqualificar. Esses templates são determinísticos
 * — zero risco de "negociar" a vertical.
 */
const RESPONSES: Record<BlockedVertical, string> = {
  apostas:
    'Obrigada pelo contato! Infelizmente a ZappIQ não atende o segmento de apostas no momento. Desejo sucesso no seu projeto.',
  'cripto-nao-regulada':
    'Obrigada pelo interesse! A ZappIQ não atende plataformas cripto não-reguladas no momento. Recomendo buscar fornecedores especializados nesse setor regulado pela CVM.',
  pornografia:
    'Obrigada pelo contato! A ZappIQ não atende plataformas de conteúdo adulto. Recomendo buscar provedores especializados nesse segmento.',
  mlm:
    'Obrigada pelo contato! A ZappIQ não atende operações de MLM/marketing multinível no momento. Desejo sucesso no seu projeto.',
};

/**
 * Detecta se a mensagem do cliente menciona vertical bloqueada.
 *
 * @param text Mensagem bruta do cliente (não-PII redacted — pra preservar
 *             keywords). Aplicar redact APÓS este filtro, não antes.
 * @returns Match com vertical + template, ou no-match.
 */
export function detectBlockedVertical(text: string | null | undefined): BlockedVerticalResult {
  if (!text || typeof text !== 'string') return { blocked: false };
  for (const { vertical, regex } of PATTERNS) {
    const match = regex.exec(text);
    if (match) {
      return {
        blocked: true,
        vertical,
        suggestedResponse: RESPONSES[vertical],
        matchedSnippet: match[0],
      };
    }
  }
  return { blocked: false };
}

/**
 * Helper pra checar se um string genérico contém vertical bloqueada.
 * Útil pra usar em condicionais: `if (isBlocked(msg)) { ... }`.
 */
export function isBlocked(text: string | null | undefined): boolean {
  return detectBlockedVertical(text).blocked;
}

/**
 * Retorna a lista de verticais cobertas (pra UI/admin/healthcheck).
 */
export function listBlockedVerticals(): BlockedVertical[] {
  return ['apostas', 'cripto-nao-regulada', 'pornografia', 'mlm'];
}
