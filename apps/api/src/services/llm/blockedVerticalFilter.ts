/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Pre-filter de verticais bloqueadas (defense-in-depth)
 * --------------------------------------------------------------------
 * Detecta menções a segmentos bloqueados ANTES de chamar o LLM. Quando
 * match: retorna template estático de desqualificação respeitosa, sem custo
 * de LLM e sem risco de o modelo "negociar" a vertical.
 *
 * DUAS CAMADAS (decisão do fundador, 14/07/2026). Leia antes de mexer:
 *
 *   1. 'compliance' → vale pra TODOS os tenants.
 *      Hoje só `pornografia`. A mensagem NÃO cita marca nenhuma, porque ela
 *      chega ao lead DO CLIENTE.
 *
 *   2. 'politica-comercial-zappiq' → decisão comercial NOSSA, não do cliente.
 *      `apostas`, `cripto-nao-regulada`, `mlm`. Só se aplica quando a org é a
 *      da ZappIQ (isZappIQOrg). O CMJ decide o funil dele: se ele quiser
 *      atender casa de apostas, não somos nós que barramos o lead dele.
 *
 * Por que a separação (o bug que ela conserta):
 *   Este filtro roda pra TODA org (agentOrchestrator → routeIzaTurn →
 *   detectBlockedVertical), antes de qualquer LLM. As RESPONSES diziam
 *   literalmente "a ZappIQ não atende o segmento de apostas". Ou seja: o lead
 *   do CMJ mandava "tenho casa de apostas" e a Vera respondia falando da
 *   ZappIQ, ou seja, marca de terceiro na conversa do cliente.
 *
 * Fail-safe: org desconhecida = CLIENTE (só compliance). O lado seguro é
 * bloquear de menos com marca nenhuma, nunca falar da ZappIQ pra quem não é.
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

import { isZappIQOrg } from '../../config/zappiqOrg.js';

export type BlockedVertical =
  | 'apostas'
  | 'cripto-nao-regulada'
  | 'pornografia'
  | 'mlm';

/**
 * Quem a regra protege:
 *   - 'compliance': a lei/plataforma. Vale pra todo tenant, mensagem sem marca.
 *   - 'politica-comercial-zappiq': o nosso comercial. Só na org da ZappIQ.
 */
export type BlockedVerticalLayer = 'compliance' | 'politica-comercial-zappiq';

/**
 * Camada de cada vertical. Mover uma vertical pra 'compliance' significa
 * afirmar que NENHUM cliente da plataforma pode atendê-la: decisão jurídica,
 * não comercial. Na dúvida, deixe em 'politica-comercial-zappiq'.
 */
export const BLOCKED_VERTICAL_LAYERS: Record<BlockedVertical, BlockedVerticalLayer> = {
  pornografia: 'compliance',
  apostas: 'politica-comercial-zappiq',
  'cripto-nao-regulada': 'politica-comercial-zappiq',
  mlm: 'politica-comercial-zappiq',
};

export interface BlockedVerticalMatch {
  blocked: true;
  vertical: BlockedVertical;
  /** Camada que barrou (audit: distingue "é lei" de "é política nossa"). */
  layer: BlockedVerticalLayer;
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
 * Templates da POLÍTICA COMERCIAL da ZappIQ.
 * Só saem quando a org é a nossa, então citar a marca aqui é correto: é a Iza
 * falando da ZappIQ pro lead da ZappIQ. Nunca reuse isto pra org de cliente.
 *
 * Tom: respeitoso, breve, sem moralizar, sem oferecer alternativa.
 *
 * Contraste com falha do Sonnet em Gate 1 (p15): perguntou volume e
 * detalhes em vez de desqualificar. Esses templates são determinísticos
 * — zero risco de "negociar" a vertical.
 */
const ZAPPIQ_POLICY_RESPONSES: Record<BlockedVertical, string> = {
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
 * Templates de COMPLIANCE. Vão pro lead de qualquer tenant, então não podem
 * ter marca nenhuma: quem recusa é o negócio do cliente, não a ZappIQ.
 *
 * Sem businessName, cai na 1ª pessoa do plural ("Não atendemos"), que é
 * neutra e serve pra qualquer negócio.
 */
function complianceResponse(vertical: BlockedVertical, businessName?: string | null): string {
  const nome = typeof businessName === 'string' ? businessName.trim() : '';
  const sujeito = nome ? `${nome} não atende` : 'Não atendemos';

  const motivo: Record<BlockedVertical, string> = {
    pornografia: `${sujeito} plataformas de conteúdo adulto. Recomendo buscar provedores especializados nesse segmento.`,
    apostas: `${sujeito} o segmento de apostas no momento. Desejo sucesso no seu projeto.`,
    'cripto-nao-regulada': `${sujeito} plataformas cripto não-reguladas no momento. Desejo sucesso no seu projeto.`,
    mlm: `${sujeito} operações de MLM/marketing multinível no momento. Desejo sucesso no seu projeto.`,
  };

  return `Obrigada pelo contato! ${motivo[vertical]}`;
}

export interface DetectBlockedVerticalOptions {
  /**
   * Org do tenant. Ausente/desconhecida = tratado como CLIENTE (fail-safe):
   * só as verticais de compliance são checadas.
   */
  organizationId?: string | null;
  /** Override explícito, pra quem já resolveu a org e evita re-checar. */
  isZappIQ?: boolean;
  /**
   * Nome do negócio DO TENANT, usado na mensagem de compliance.
   * Sem ele a mensagem fica neutra ("Não atendemos..."), que também serve.
   */
  businessName?: string | null;
}

/**
 * Detecta se a mensagem do lead menciona vertical bloqueada PARA ESTE TENANT.
 *
 * A org decide o que é checado:
 *   - org da ZappIQ → compliance + política comercial nossa (as 4 verticais)
 *   - org de cliente (ou desconhecida) → só compliance, mensagem sem marca
 *
 * @param text Mensagem bruta do cliente (não-PII redacted — pra preservar
 *             keywords). Aplicar redact APÓS este filtro, não antes.
 * @returns Match com vertical + camada + template, ou no-match.
 */
export function detectBlockedVertical(
  text: string | null | undefined,
  opts: DetectBlockedVerticalOptions = {},
): BlockedVerticalResult {
  if (!text || typeof text !== 'string') return { blocked: false };

  const isZappIQ = opts.isZappIQ ?? isZappIQOrg(opts.organizationId);

  for (const { vertical, regex } of PATTERNS) {
    const layer = BLOCKED_VERTICAL_LAYERS[vertical];

    // Política comercial nossa não vale pro funil do cliente.
    if (layer === 'politica-comercial-zappiq' && !isZappIQ) continue;

    const match = regex.exec(text);
    if (match) {
      return {
        blocked: true,
        vertical,
        layer,
        suggestedResponse: isZappIQ
          ? ZAPPIQ_POLICY_RESPONSES[vertical]
          : complianceResponse(vertical, opts.businessName),
        matchedSnippet: match[0],
      };
    }
  }
  return { blocked: false };
}

/**
 * Helper pra checar se um string genérico contém vertical bloqueada.
 * Útil pra usar em condicionais: `if (isBlocked(msg, { organizationId })) { ... }`.
 */
export function isBlocked(
  text: string | null | undefined,
  opts: DetectBlockedVerticalOptions = {},
): boolean {
  return detectBlockedVertical(text, opts).blocked;
}

/**
 * Catálogo completo de verticais cobertas (pra UI/admin/healthcheck).
 *
 * É o catálogo, não o que se aplica a um tenant: use BLOCKED_VERTICAL_LAYERS
 * pra saber quais valem pra cliente (compliance) e quais são política nossa.
 */
export function listBlockedVerticals(): BlockedVertical[] {
  return ['apostas', 'cripto-nao-regulada', 'pornografia', 'mlm'];
}
