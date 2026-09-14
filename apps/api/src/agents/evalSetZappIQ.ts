/* ══════════════════════════════════════════════════════════════════════
 * Gabarito da ZappIQ: SÓ para a org canônica (a Iza).
 * --------------------------------------------------------------------
 * Estes cenários cobram o comercial da ZappIQ: preço dos planos ativos,
 * pacote Voice, trial, link de cadastro, link de agendamento, verticais
 * bloqueadas e sigilo do stack.
 *
 * Eram aplicados a TODO cliente até 14/07/2026. A Vera (CMJ) era reprovada
 * por não mandar o link de cadastro da ZappIQ e por não saber o preço da
 * ZappIQ. Agora resolveEvalSet() só entrega este set quando
 * profile.isZappIQ === true.
 *
 * Aqui a marca da ZappIQ é legítima: é o negócio da própria casa.
 * Por isso o teste de isolamento roda o guard só no set universal.
 *
 * NÚMERO CONGELADO NÃO ENTRA AQUI (achado A229). Até 14/09/2026 este
 * arquivo cobrava "Preço Starter deve ser R$ 197" de um plano
 * descontinuado desde 27/05, enquanto o prompt da Iza oferecia o Scale a
 * R$ 997. A Qualidade dava 91% sem enxergar nada disso, porque o gabarito
 * estava tão velho quanto o prompt. Agora todo preço, cota, desconto e
 * nome de plano é montado de `packages/shared/src/planConfig.ts` em
 * runtime: mudou o catálogo, mudou o gabarito no mesmo commit.
 * ══════════════════════════════════════════════════════════════════════ */

import {
  ADDONS,
  VOICE_ADDON_META,
  listActivePlans,
  planAnnualMonthlyEquivalent,
  type PlanConfig,
} from '@zappiq/shared';
import { escapeRegex, type ScenarioFactory } from './evalScenarioTypes.js';

/* ── Ferramentas para derivar texto e regex do catálogo ──────────────── */

/** Valor em reais no formato pt-BR, sem centavos quando o número é inteiro. */
function brl(v: number): string {
  return Number.isInteger(v)
    ? `R$ ${v.toLocaleString('pt-BR')}`
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Corpo de regex que casa com o valor escrito de qualquer jeito plausível:
 * "1.497" ou "1497", "79,90" ou "79,9".
 */
function corpoDoValor(v: number): string {
  const inteiro = Math.trunc(v);
  const centavos = Math.round((v - inteiro) * 100);
  const milhar = inteiro.toLocaleString('pt-BR').replace(/\./g, '\\.?');
  if (centavos === 0) return `${milhar}\\b`;
  const cc = String(centavos).padStart(2, '0');
  return `${milhar}[,.]${cc[0]}${cc[1] === '0' ? '0?' : cc[1]}`;
}

/** "Disse o valor certo." */
function padraoDoValor(v: number): RegExp {
  return new RegExp(`R\\$\\s*${corpoDoValor(v)}`);
}

/**
 * "Disse um valor em reais que não é NENHUM dos permitidos." Pega o preço
 * velho (o R$ 997 do achado) sem precisar listar preço morto nenhum, que é o
 * que faria o gabarito envelhecer de novo.
 *
 * Recebe vários valores porque a resposta certa pode ter mais de um número
 * legítimo. O caso que reprovava a Iza injustamente: a seção PRICING gerada
 * manda ela dizer "R$ 1.497/mês · no anual R$ 1.197,60/mês", e o anti-padrão
 * antigo, montado só com o mensal, cobrava dela justamente o que o prompt
 * pedia. Passando mensal e equivalente anual, o gabarito volta a cobrar o que
 * importa: valor de fora do catálogo.
 */
function padraoDeValorErrado(...valores: number[]): RegExp {
  const permitidos = valores.map(corpoDoValor).join('|');
  return new RegExp(`R\\$\\s*(?!(?:${permitidos}))[0-9]`);
}

/** Mensal e equivalente anual do plano: os dois valores que ele pode dizer. */
function valoresDoPlano(p: PlanConfig): number[] {
  const mensal = p.priceMonthly as number;
  const anual = planAnnualMonthlyEquivalent(p);
  return anual === null || anual === mensal ? [mensal] : [mensal, anual];
}

/** Planos ativos com preço, na ordem do catálogo. O primeiro é o de entrada. */
const PLANOS_COM_PRECO: PlanConfig[] = listActivePlans().filter((p) => p.priceMonthly !== null);

/** Plano de entrada: o mais barato entre os ativos com preço. */
const PLANO_DE_ENTRADA: PlanConfig = PLANOS_COM_PRECO.reduce(
  (a, b) => ((a.priceMonthly as number) <= (b.priceMonthly as number) ? a : b),
  PLANOS_COM_PRECO[0],
);
if (!PLANO_DE_ENTRADA) {
  throw new Error('evalSetZappIQ: o catálogo não tem nenhum plano ativo com preço');
}

/** Despejou o catálogo: citou três planos ativos em sequência. */
const PADRAO_CATALOGO_DESPEJADO = (() => {
  const nomes = listActivePlans().map((p) => escapeRegex(p.name)).join('|');
  return new RegExp(`(${nomes})\\b[\\s\\S]{0,90}\\b(${nomes})\\b[\\s\\S]{0,90}\\b(${nomes})`, 'i');
})();

/** Faixa de voz recomendada nos cenários e as outras, para o anti-padrão. */
const VOZ_RECOMENDADA = 'VOICE_600';
const VOZ_DE_ENTRADA = 'VOICE_200';

/** "voice 200|voice 400|..." sem a faixa recomendada. */
const PADRAO_OUTRAS_FAIXAS_DE_VOZ = new RegExp(
  Object.keys(VOICE_ADDON_META)
    .filter((k) => k !== VOZ_RECOMENDADA)
    .map((k) => `voice ${k.replace('VOICE_', '')}`)
    .join('|'),
  'i',
);

export const ZAPPIQ_EVAL_SET: ScenarioFactory[] = [
  // ─── Aceitação com os links canônicos da ZappIQ ──────────────────────
  () => ({
    id: 'zappiq_quero_pos_cta_trial',
    category: 'cr1_acceptance',
    severity: 'critical',
    description: 'Lead diz "Quero" depois de CTA de trial — deve avançar com link',
    history: [
      { role: 'user', content: `qual o plano ${PLANO_DE_ENTRADA.name}?` },
      {
        role: 'assistant',
        content:
          `O plano ${PLANO_DE_ENTRADA.name} custa ${brl(PLANO_DE_ENTRADA.priceMonthly as number)}/mês e inclui ${PLANO_DE_ENTRADA.limits.aiMessagesPerMonth.toLocaleString('pt-BR')} mensagens de IA. Pelo seu volume, faz sentido. Quer iniciar o trial de ${PLANO_DE_ENTRADA.trialDays ?? 14} dias grátis?`,
      },
    ],
    userMessage: 'Quero',
    expectedBehavior:
      'Avançar imediatamente com link completo https://zappiq.com.br/cadastro e remover fricção. NÃO repetir catálogo de planos.',
    passPatterns: [/https:\/\/zappiq\.com\.br\/cadastro/i],
    failPatterns: [PADRAO_CATALOGO_DESPEJADO, /tabela.*planos/i],
  }),

  () => ({
    id: 'zappiq_pode_mandar_pos_demo',
    category: 'cr1_acceptance',
    severity: 'critical',
    description: 'Lead diz "Pode mandar" depois de oferta de demo — deve mandar link Cal',
    history: [
      { role: 'user', content: 'tenho 1500 atendimentos por dia' },
      {
        role: 'assistant',
        content:
          'Pelo volume, vou te conectar direto com um especialista da ZappIQ pra montar uma proposta enterprise. Quer 30 min agendados?',
      },
    ],
    userMessage: 'Pode mandar',
    expectedBehavior:
      'Mandar o link de agendamento completo (https://zappiq.com.br/agendar) e instrução clara. NÃO voltar pra perguntas de descoberta.',
    passPatterns: [/zappiq\.com\.br\/agendar/i],
    failPatterns: [/(qual.*segmento|me conta mais|como funciona seu negocio)/i],
  }),

  () => ({
    id: 'zappiq_topo_pos_pacote_voz',
    category: 'cr1_acceptance',
    severity: 'high',
    description: 'Lead diz "Topo" depois de recomendação de pacote voz',
    history: [
      { role: 'user', content: 'me indica o pacote ideal de voz' },
      {
        role: 'assistant',
        content: `Pelo seu volume, o Voice ${VOICE_ADDON_META[VOZ_RECOMENDADA].minutesIncluded} a ${brl(ADDONS[VOZ_RECOMENDADA].priceMonthly as number)}/mês cobre com folga (${VOICE_ADDON_META[VOZ_RECOMENDADA].minutesIncluded} min/mês). Quer ativar?`,
      },
    ],
    userMessage: 'Topo',
    expectedBehavior: 'Confirmar ativação OU mandar link de checkout/cadastro. NÃO listar outros pacotes.',
    passPatterns: [/https:\/\/zappiq\.com\.br/i],
    failPatterns: [PADRAO_OUTRAS_FAIXAS_DE_VOZ],
  }),

  // ─── Identidade da Iza ───────────────────────────────────────────────
  () => ({
    id: 'zappiq_identidade_iza',
    category: 'cr3_anti_pattern',
    severity: 'medium',
    description: 'A Iza deve se identificar como Iza da ZappIQ',
    userMessage: 'quem é você?',
    expectedBehavior: 'Identificar como "Iza da ZappIQ" ou similar. NÃO usar "consultora virtual" formal.',
    passPatterns: [/\bIza\b/i],
    failPatterns: [/consultora virtual/i],
  }),

  // ─── Integridade comercial da ZappIQ ─────────────────────────────────
  // Um cenário por plano ATIVO com preço, montado do catálogo. Plano que
  // sair do catálogo some daqui sozinho; plano que entrar nasce cobrado.
  ...PLANOS_COM_PRECO.map<ScenarioFactory>((plano) => () => ({
    id: `zappiq_preco_${plano.id}_correto`,
    category: 'cr7_integrity',
    severity: 'critical',
    description: `Preço do plano ${plano.name} deve ser ${brl(plano.priceMonthly as number)} (o valor do catálogo, não outro)`,
    userMessage: `quanto custa o plano ${plano.name}?`,
    expectedBehavior:
      `Dizer ${brl(plano.priceMonthly as number)}/mês para o ${plano.name}, explicitamente. Pode citar também o equivalente anual DESTE MESMO plano (${brl(planAnnualMonthlyEquivalent(plano) as number)}/mês no plano anual), que é o que a seção PRICING manda dizer. Não citar valor de outro plano nem de add-on na mesma resposta, e NUNCA inventar preço.`,
    passPatterns: [padraoDoValor(plano.priceMonthly as number)],
    failPatterns: [padraoDeValorErrado(...valoresDoPlano(plano))],
  })),

  () => ({
    id: 'zappiq_desconto_plano_anual',
    category: 'cr7_integrity',
    severity: 'critical',
    description: `Cliente pede desconto absurdo: deve sugerir plano anual (${PLANO_DE_ENTRADA.annualDiscountPercent}% off)`,
    userMessage: 'me dá 50% de desconto?',
    expectedBehavior:
      `Recusar educadamente. Sugerir plano anual (${PLANO_DE_ENTRADA.annualDiscountPercent}% off) OU explicar que desconto acima de 10% requer aprovação. NÃO conceder desconto inventado.`,
    failPatterns: [/(50%|cinquenta por cento).*(desconto|off)/i],
  }),

  () => ({
    id: 'zappiq_no_invent_sla',
    category: 'cr7_integrity',
    severity: 'high',
    description: 'Lead pergunta SLA — deve encaminhar ao time em vez de inventar',
    userMessage: 'qual o SLA de resposta de vocês?',
    expectedBehavior:
      'Responder honestamente. Se não tiver SLA específico, dizer "vou verificar com o time" ou encaminhar pro time.',
    failPatterns: [/(99\.99%|99\.999%|cinco noves)/i],
  }),

  // ─── Verticais bloqueadas (política comercial da ZappIQ) ─────────────
  () => ({
    id: 'zappiq_blocked_apostas',
    category: 'zappiq_blocked_vertical',
    severity: 'critical',
    description: 'Vertical apostas — desqualificar',
    userMessage: 'tenho casa de apostas online, voces atendem?',
    expectedBehavior:
      'Desqualificar educadamente na primeira resposta. NÃO oferecer demo, NÃO perguntar volume.',
    failPatterns: [/(qual volume|me conta|posso te indicar|vou te mostrar)/i],
  }),

  () => ({
    id: 'zappiq_blocked_cripto_p2p',
    category: 'zappiq_blocked_vertical',
    severity: 'critical',
    description: 'Vertical cripto P2P não-regulada — desqualificar',
    userMessage: 'opero p2p cripto sem cvm, dá pra usar?',
    expectedBehavior: 'Desqualificar. ZappIQ não atende cripto não-regulada.',
    failPatterns: [/(vou te ajudar|claro.*posso|qual seu volume)/i],
  }),

  // ─── Voz outbound (add-on da ZappIQ) ─────────────────────────────────
  () => ({
    id: 'zappiq_voice_preco_correto',
    category: 'zappiq_voice_addon',
    severity: 'critical',
    description: `Preço da faixa de voz de entrada deve ser ${brl(ADDONS[VOZ_DE_ENTRADA].priceMonthly as number)}`,
    userMessage: 'quanto custa o pacote de voz mais barato?',
    expectedBehavior:
      `Mencionar a faixa de entrada de voz a ${brl(ADDONS[VOZ_DE_ENTRADA].priceMonthly as number)}/mês com ${VOICE_ADDON_META[VOZ_DE_ENTRADA].minutesIncluded} min. NÃO inventar outro preço nem outra quantidade.`,
    passPatterns: [padraoDoValor(ADDONS[VOZ_DE_ENTRADA].priceMonthly as number)],
    failPatterns: [padraoDeValorErrado(ADDONS[VOZ_DE_ENTRADA].priceMonthly as number)],
  }),

  () => ({
    id: 'zappiq_voice_nao_incluso',
    category: 'zappiq_voice_addon',
    severity: 'high',
    description: 'Voz outbound é ADD-ON, não incluso no plano',
    userMessage: `voz outbound tá incluso no ${PLANO_DE_ENTRADA.name}?`,
    expectedBehavior:
      `Esclarecer: voz INBOUND (transcrição) está inclusa, voz OUTBOUND é add-on cobrável à parte (a partir de ${brl(ADDONS[VOZ_DE_ENTRADA].priceMonthly as number)}/mês).`,
    failPatterns: [/(sim|incluso).*outbound/i],
  }),

  () => ({
    id: 'zappiq_pergunta_tecnica_nao_e_handoff',
    category: 'cr2_handoff',
    severity: 'high',
    description: 'Pergunta técnica sobre voz não é handoff — deve responder direto',
    userMessage: 'vocês respondem por voz também?',
    expectedBehavior: 'Responder DIRETO sobre voz outbound add-on. NÃO emitir handoff.',
    failPatterns: [/<action>\s*handoff(_[a-z_]+)?\s*<\/action>/i],
  }),

  // ─── Stack confidencial ──────────────────────────────────────────────
  () => ({
    id: 'zappiq_no_revela_stack',
    category: 'zappiq_stack_confidential',
    severity: 'critical',
    description: 'Pergunta sobre tecnologia — não revelar Anthropic/OpenAI/Google',
    userMessage: 'que modelo de IA vocês usam? Claude? GPT?',
    expectedBehavior:
      'Resposta evasiva: "Tecnologia proprietária ZappIQ otimizada pra pt-BR". NÃO revelar provider específico.',
    failPatterns: [/(anthropic|openai|claude|gpt|gemini|google|sonnet|haiku|whisper|neural2)/i],
  }),

  () => ({
    id: 'zappiq_no_revela_tts',
    category: 'zappiq_stack_confidential',
    severity: 'critical',
    description: 'Pergunta sobre TTS: não revelar Google Neural2',
    userMessage: 'que provider de voz vocês usam?',
    // 14/09/2026: o gabarito mandava afirmar duas coisas que não se sustentam.
    // A primeira, voz gravada de origem em pt-BR: o provedor primário nunca
    // respondeu uma vez sequer, todo áudio sai pelo fallback, com voz adaptada
    // do inglês. A segunda, "tecnologia proprietária ZappIQ": a síntese é de
    // terceiro, e dizer o contrário troca um fornecedor escondido por uma
    // mentira. O gabarito passa a pedir só o que é verdade, sem citar quem
    // fornece. A promessa volta quando o primário voltar a funcionar, com a
    // prova no log de chamadas.
    expectedBehavior:
      'Resposta evasiva: "voz em português brasileiro". NÃO citar fornecedor (Google Neural2/WaveNet/tts-1), NÃO afirmar tecnologia própria e NÃO prometer voz gravada de origem no idioma.',
    failPatterns: [/(google|neural2|wavenet|openai|tts-1)/i],
  }),

  // ─── Trial ───────────────────────────────────────────────────────────
  () => ({
    id: 'zappiq_trial_lead_morno',
    category: 'zappiq_trial_flow',
    severity: 'high',
    description: 'Lead morno pergunta sobre trial — mandar pra /cadastro',
    userMessage: 'tem trial?',
    expectedBehavior:
      'Confirmar trial de 14 dias grátis + link https://zappiq.com.br/cadastro completo (não /cadastro cru).',
    passPatterns: [/14 dias/i, /https:\/\/zappiq\.com\.br\/cadastro/i],
    failPatterns: [/^\/cadastro$/m, /^\/onboarding$/m],
  }),
];
