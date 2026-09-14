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

/**
 * O que fazer com o que casou.
 *
 *   'recusa': desqualifica e encerra. Só vale na camada da política
 *                  comercial da ZappIQ, no NOSSO funil.
 *   'transbordo': a IA para e uma pessoa assume, com registro e aviso ao
 *                  dono. É o que a camada compliance faz desde 14/09/2026
 *                  (A232, A251): na conta de um cliente quem escreve é o
 *                  cliente final dele, e recusar cliente final com template
 *                  fixo é o defeito, não o recurso.
 */
export type BlockedVerticalAction = 'recusa' | 'transbordo';

export interface BlockedVerticalMatch {
  blocked: true;
  vertical: BlockedVertical;
  /** Camada que barrou (audit: distingue "é lei" de "é política nossa"). */
  layer: BlockedVerticalLayer;
  /** Recusar ou passar para uma pessoa. Ver BlockedVerticalAction. */
  action: BlockedVerticalAction;
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
        // A232: '\\bcassino\\b' isolado desqualificava o lead de pousada na
        // Praia do Cassino (Rio Grande). A palavra sozinha é topônimo.
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
        // A251/A232: a camada compliance passou a exigir OPERAÇÃO DECLARADA.
        //
        // Antes bastava a palavra solta ('pornografia', 'conteúdo adulto',
        // 'site adulto', 'escort', 'onlyfans'). O desenho partia de que quem
        // escreve é um lead pedindo para usar a plataforma; na conta de um
        // cliente quem escreve é o CLIENTE FINAL dele. Reprodução de
        // 14/09/2026: 7 de 7 frases legítimas recusadas numa org de cliente,
        // incluindo paciente com compulsão, vítima de exposição buscando
        // advogado e dono de Ford Escort numa oficina.
        //
        // O que ficou: a pessoa dizendo que o NEGÓCIO DELA é esse.
        '\\b(sou|somos)\\s+(criador(a)?|produtor(a)?|modelo)(es|as)?\\s+(de\\s+)?(conte[uú]do\\s+adulto|only\\s*fans|onlyfans|privacy\\s+(br|brasil))\\b',
        '\\b(camgirl|camboy|cam\\s+(girl|boy))\\b',
        '\\b(tenho|temos|possuo|possu[ií]mos|gerencio|administro|abri|abrimos|montei|montamos|criei|criamos)\\s+(um[ao]?\\s+)?(site|plataforma|canal|perfil|produtora|est[uú]dio|neg[oó]cio)\\s+(adulto|adulta|pornogr[aá]fic[oa]|de\\s+conte[uú]do\\s+adulto)\\b',
        '\\b(meu|minha|nosso|nossa)\\s+(site|plataforma|canal|perfil|produtora|est[uú]dio|neg[oó]cio|empresa)\\s+(adulto|adulta|pornogr[aá]fic[oa]|de\\s+conte[uú]do\\s+adulto)\\b',
        // 'site' fica de FORA desta alternativa de propósito: 'publicaram
        // minhas fotos num site adulto' é vítima pedindo advogado, não
        // operação. Site só casa com posse declarada (tenho/meu), acima.
        '\\b(plataforma|produtora|est[uú]dio)\\s+(de\\s+)?(conte[uú]do\\s+)?(adulto|adulta|pornogr[aá]fic[oa]|pornografia)\\b',
        '\\b(vendo|vender|comercializo|comercializar|monetizo|monetizar|produzo|produzir)\\s+(conte[uú]do\\s+adulto|conte[uú]do\\s+pornogr[aá]fico)\\b',
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
        // A232: Polishop e Natura saíram. São VAREJO: o lojista que revende
        // não está propondo multinível, e desqualificá-lo é perder venda.
        '\\b(herbalife|amway|forever\\s+living|hinode)\\b',
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
function complianceResponse(_vertical: BlockedVertical, businessName?: string | null): string {
  const nome = typeof businessName === 'string' ? businessName.trim() : '';
  const de = nome ? ` da ${nome}` : '';

  // Uma frase só, neutra, sem marca e sem recusa. Quem decide se atende é a
  // pessoa que vai assumir a conversa, com o contexto do negócio na mão.
  return (
    'Obrigada pelo contato! Para esse assunto eu prefiro te passar para uma pessoa ' +
    `da equipe${de}. Já avisei, e em instantes alguém continua com você por aqui.`
  );
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
      // A camada decide o que acontece: no NOSSO funil, recusa; na conta de
      // um cliente, transbordo. A resposta acompanha a decisão.
      const action: BlockedVerticalAction =
        layer === 'politica-comercial-zappiq' ? 'recusa' : 'transbordo';

      return {
        blocked: true,
        vertical,
        layer,
        action,
        suggestedResponse:
          action === 'recusa'
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

/* ══════════════════════════════════════════════════════════════════════
 * Categoria 'crise' (P62, 14/09/2026)
 * --------------------------------------------------------------------
 * A única regra da plataforma para ideação suicida e autolesão vivia na
 * seção de psicologia do modelo de segmento (nichePrompts). Ela nunca
 * chegou a agente nenhum: o cadastro grava a chave com acento e o
 * promptEngine caía no genérico (A163, A155). Nenhuma outra camada, CORE
 * ou pré-filtro, tinha qualquer regra sobre isso.
 *
 * Aqui ela vira GUARDA PROGRAMÁTICA: não depende do modelo obedecer.
 *
 * Três diferenças em relação às verticais bloqueadas acima, e todas são
 * de propósito:
 *
 *   1. NÃO BLOQUEIA. A resposta do agente continua saindo; a linha de
 *      acolhimento é ACRESCENTADA. Trocar a resposta por um template
 *      fixo é o defeito que A251 e A232 descrevem, e num momento de
 *      crise ele seria pior: a pessoa recebe uma parede.
 *
 *   2. Vale para TODA organização, sempre. Não é política comercial nem
 *      segmento: é a pessoa do outro lado.
 *
 *   3. NÃO devolve o trecho da mensagem. Indício de risco à vida é dado
 *      sensível de saúde (LGPD, art. 5º II e art. 11). O que sai daqui é
 *      o id da regra que casou, e é isso que vai para o registro.
 *
 * Falso positivo: a lista de negativos abaixo cobre a expressão figurada
 * do português falado ('morrendo de rir', 'mata a saudade', 'matar a
 * fome', 'me matar de trabalhar'). O que escapar dela recebe uma frase
 * acolhedora e neutra, que não constrange quem não está em risco.
 *
 * TODO (A051 / P62): o avaliador (agentEvalRunner) não passa pelo
 * pré-filtro, então a Qualidade não exercita este caminho. Enquanto o
 * runner não for tocado (PR #371 está aberto sobre ele), a cobertura vem
 * do cenário universal de crise em evalSetUniversal.ts, que checa a
 * presença do CVV na resposta.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Linha de acolhimento. Uma frase, sem marca, sem diagnóstico e sem
 * promessa: informa o CVV e mais nada. Quem promete o atendimento humano é
 * o canal, que sabe se o transbordo de fato acontece ali.
 */
export const LINHA_DE_ACOLHIMENTO_CVV =
  'Se você estiver passando por um momento difícil, o CVV atende de graça, 24 horas por dia: ligue 188 ou acesse cvv.org.br.';

/** Complemento usado só onde o transbordo existe de verdade (canais reais). */
export const LINHA_DE_TRANSBORDO_DE_CRISE =
  'Já avisei uma pessoa da nossa equipe para continuar essa conversa com você.';

/**
 * Tira acento e baixa a caixa. A lista de padrões abaixo é escrita SEM
 * acento por isso: 'suicidio' e 'suicídio' passam pela mesma regra, e não
 * existe variante esquecida.
 */
export function normalizarParaCrise(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Regras de crise, com id estável. O id é o que vai para o registro e para
 * o log; o texto da mensagem, nunca.
 *
 * As negações ficam dentro da própria regra (lookahead), não numa lista
 * separada, para que o negativo nasça junto do positivo que ele corrige.
 */
const REGRAS_DE_CRISE: Array<{ id: string; regex: RegExp }> = [
  {
    // 'vou me matar de trabalhar' e 'me matar de rir' são hipérbole. O
    // lookahead corta qualquer 'me matar de <verbo/substantivo>'.
    id: 'crise_me_matar',
    regex: /\b(quero|vou|penso em|pensando em|pretendo|vontade de|planejei|planejo)\s+me\s+matar\b(?!\s+de\s+\S)/,
  },
  { id: 'crise_tirar_a_vida', regex: /\btirar\s+(a\s+)?(minha|sua|propria|a\s+propria)\s+vida\b/ },
  { id: 'crise_por_fim_a_vida', regex: /\b(por|pôr|colocar)\s+(um\s+)?fim\s+(a|na|à)\s+(minha|essa)\s+vida\b/ },
  {
    id: 'crise_nao_aguento_viver',
    regex: /\bnao\s+aguento\s+mais\s+(viver|essa\s+vida|a\s+vida)\b/,
  },
  { id: 'crise_nao_quero_viver', regex: /\bnao\s+quero\s+mais\s+(viver|estar\s+aqui|acordar)\b/ },
  { id: 'crise_sem_sentido_viver', regex: /\bnao\s+(vejo|tem)\s+(mais\s+)?sentido\s+(em\s+)?viver\b/ },
  {
    // 'quero morrer', 'queria morrer', 'prefiro morrer'. Fora: 'morrendo
    // de rir', 'morrer de fome', 'meu carro morreu'.
    id: 'crise_quero_morrer',
    regex: /\b(quero|queria|prefiro|preferia|melhor)\s+morrer\b(?!\s+de\s+\S)/,
  },
  {
    // 'acabar com tudo' isolado é crise; seguido de 'isso', 'que' ou de um
    // complemento de tarefa é o expediente de qualquer segunda-feira.
    id: 'crise_acabar_com_tudo',
    regex: /\bacabar\s+com\s+tudo\b(?!\s*(isso|que|de\s+uma\s+vez|ate|antes|hoje|amanha|agora\b\s+\S))/,
  },
  {
    // 'me machucar na academia' e 'me machucar no treino' ficam de fora.
    id: 'crise_me_machucar',
    regex: /\bme\s+(machucar|machucando|ferir|cortar|cortando)\b(?!\s+(na|no|com\s+a\s+maquina)\b)/,
  },
  { id: 'crise_suicidio', regex: /\b(suicidio|suicida|suicidar|automutilacao|autolesao)\w*\b/ },
  { id: 'crise_se_jogar', regex: /\bme\s+jogar\s+(na\s+frente|do\s+alto|da\s+janela|da\s+ponte)\b/ },
  { id: 'crise_sumir_da_vida', regex: /\b(sumir|desaparecer)\s+(dessa|desta|da)\s+vida\b/ },
];

export type SinalDeCrise =
  | { crise: true; regra: string }
  | { crise: false };

/**
 * Detecta indício de risco à vida ou de autolesão.
 *
 * NÃO devolve o texto que casou: só o id da regra. Ver o cabeçalho desta
 * seção para o porquê.
 */
export function detectarSinalDeCrise(texto: string | null | undefined): SinalDeCrise {
  if (!texto || typeof texto !== 'string') return { crise: false };

  const normalizado = normalizarParaCrise(texto);
  for (const { id, regex } of REGRAS_DE_CRISE) {
    if (regex.test(normalizado)) return { crise: true, regra: id };
  }
  return { crise: false };
}

/** Catálogo das regras de crise, para tela de admin e teste de cobertura. */
export function listarRegrasDeCrise(): string[] {
  return REGRAS_DE_CRISE.map((r) => r.id);
}
