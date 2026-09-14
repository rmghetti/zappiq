/* ══════════════════════════════════════════════════════════════════════
 * tenantLiveProfile — o perfil VIVO do atendimento, montado a cada turno.
 * --------------------------------------------------------------------
 * Por que existe (achados A058, A059, A060, A070, A153, A164, A194):
 *   O tom, o horário e a data do agente foram congelados no prompt no dia
 *   do cadastro e nunca mais releram as settings. Em produção, 14 de 15
 *   agentes diziam "TOM DE VOZ AMIGÁVEL" com a organização configurada em
 *   "profissional", 4 afirmavam "Domingo: Fechado" para negócio aberto no
 *   domingo, e todos carregavam a data do dia do cadastro. Quem editava o
 *   Treinar IA não via efeito nenhum na conversa.
 *
 * A cura é a mesma camada que já funciona para a saudação e para os links
 * do tenant: nada congelado no prompt, tudo montado das settings no turno.
 * Este arquivo é a parte PURA disso. Sem banco, sem LLM, sem relógio
 * próprio (o 'agora' é injetado), para o comportamento ser testável.
 *
 * Regras que os testes trancam:
 *   1. Ausência de dado NUNCA vira afirmação. Sem horário cadastrado, a IA
 *      recebe "não informado" com ordem de confirmar, jamais um dia fechado.
 *   2. "Agora: aberto|fechado" é conta de código (isOpen), e só sai quando
 *      existe o businessHoursConfig, que é o único formato com fuso.
 *   3. Teto de tamanho: o bloco entra em todo turno pago, então ele tem
 *      limite por campo e limite total.
 *   4. Sem agendamento de verdade (tipo ativo E direito ao recurso), o
 *      bloco PROÍBE oferecer agendamento, em vez de prometer confirmação e
 *      lembrete que o produto não envia.
 * ══════════════════════════════════════════════════════════════════════ */

import { isOpen } from './businessHours.js';
import type { BusinessHoursConfig } from './flowEngine.js';

/** Teto do bloco inteiro. Ele viaja em todo turno: tamanho é custo. */
export const LIVE_PROFILE_MAX_CHARS = 1500;

/** Tetos por campo, antes do teto total. */
const MAX_NOME = 80;
const MAX_NEGOCIO = 120;
const MAX_TOM = 240;
const MAX_HORARIO = 600;
const MAX_HANDOFF = 300;
const MAX_AGENDAMENTO = 300;

/**
 * O texto exato da ausência de horário. Não é enfeite: é a frase que impede
 * a IA de inventar dia e hora quando o cliente não cadastrou nada.
 */
export const TEXTO_HORARIO_AUSENTE =
  'não informado (não afirme dias ou horários de funcionamento; diga que vai confirmar)';

/** Formatos de horário que convivem no banco hoje. */
export type FormatoHorario = 'config' | 'ingles' | 'portugues';

export interface HorarioNormalizado {
  /** Só o formato estruturado tem fuso, então só ele permite calcular "agora". */
  config: BusinessHoursConfig | null;
  /** Texto único para o prompt. null quando o cliente não cadastrou nada. */
  texto: string | null;
  formato: FormatoHorario | null;
}

const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
/** Ordem de leitura humana: segunda a domingo. */
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** Chaves em português do cadastro, com e sem acento, para o mesmo dia. */
const CHAVES_PT: Record<number, string[]> = {
  0: ['Domingo', 'domingo'],
  1: ['Segunda', 'segunda', 'Segunda-feira', 'segunda-feira'],
  2: ['Terça', 'terca', 'Terca', 'terça', 'Terça-feira', 'terca-feira'],
  3: ['Quarta', 'quarta', 'Quarta-feira', 'quarta-feira'],
  4: ['Quinta', 'quinta', 'Quinta-feira', 'quinta-feira'],
  5: ['Sexta', 'sexta', 'Sexta-feira', 'sexta-feira'],
  6: ['Sábado', 'sabado', 'Sabado', 'sábado'],
};

function limitar(texto: string, max: number): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function textoNaoVazio(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  return t ? t : null;
}

/** '12:00-22:00' vira '12:00 às 22:00'. Qualquer outro texto passa como está. */
function janelaEmTexto(valor: string): string | null {
  const t = valor.trim();
  if (!t) return null;
  if (/^(fechado|closed|-|n[aã]o abre)$/i.test(t)) return 'fechado';
  const m = t.match(/^(\d{1,2}:\d{2})\s*(?:-|às|as|a|até)\s*(\d{1,2}:\d{2})$/i);
  if (m) return `${m[1]} às ${m[2]}`;
  return t;
}

/**
 * Agrupa dias seguidos com o mesmo texto: "Segunda a sexta: 09:00 às 18:00".
 * @param porDia mapa dia da semana (0=domingo) → texto já formatado.
 */
function agruparDias(porDia: Map<number, string>): string[] {
  const linhas: string[] = [];
  let i = 0;
  while (i < ORDEM_SEMANA.length) {
    const dia = ORDEM_SEMANA[i];
    const valor = porDia.get(dia);
    if (valor === undefined) {
      i++;
      continue;
    }
    let fim = i;
    while (fim + 1 < ORDEM_SEMANA.length && porDia.get(ORDEM_SEMANA[fim + 1]) === valor) fim++;
    const primeiro = NOMES_DIAS[ORDEM_SEMANA[i]];
    const ultimo = NOMES_DIAS[ORDEM_SEMANA[fim]];
    if (fim === i) linhas.push(`${primeiro}: ${valor}`);
    else if (fim === i + 1) linhas.push(`${primeiro} e ${ultimo}: ${valor}`);
    else linhas.push(`${primeiro} a ${ultimo.toLowerCase()}: ${valor}`);
    i = fim + 1;
  }
  return linhas;
}

function lerConfig(valor: unknown): BusinessHoursConfig | null {
  if (!valor || typeof valor !== 'object') return null;
  const days = (valor as any).days;
  if (!days || typeof days !== 'object') return null;
  const temAlgumDia = ORDEM_SEMANA.some((d) => Object.prototype.hasOwnProperty.call(days, d) || Object.prototype.hasOwnProperty.call(days, String(d)));
  if (!temAlgumDia) return null;
  return valor as BusinessHoursConfig;
}

function horarioDoConfig(config: BusinessHoursConfig): string {
  const porDia = new Map<number, string>();
  for (const dia of ORDEM_SEMANA) {
    const janela = (config.days as any)?.[dia] ?? (config.days as any)?.[String(dia)];
    if (janela && janela.open && janela.close) porDia.set(dia, `${janela.open} às ${janela.close}`);
    else porDia.set(dia, 'fechado');
  }
  const linhas = agruparDias(porDia);
  const fuso = textoNaoVazio((config as any).timezone);
  const sufixo = fuso && fuso !== 'America/Sao_Paulo' ? ` (fuso ${fuso})` : '';
  return `${linhas.join('; ')}${sufixo}`;
}

function horarioIngles(hours: Record<string, any>): string | null {
  const partes: string[] = [];
  const weekdays = textoNaoVazio(hours.weekdays);
  const saturday = textoNaoVazio(hours.saturday);
  const sunday = textoNaoVazio(hours.sunday);
  const holidays = textoNaoVazio(hours.holidays);
  if (weekdays) partes.push(`Segunda a sexta: ${janelaEmTexto(weekdays)}`);
  if (saturday) partes.push(`Sábado: ${janelaEmTexto(saturday)}`);
  if (sunday) partes.push(`Domingo: ${janelaEmTexto(sunday)}`);
  if (holidays) partes.push(`Feriados: ${janelaEmTexto(holidays)}`);
  return partes.length ? partes.join('; ') : null;
}

function horarioPortugues(hours: Record<string, any>): string | null {
  const porDia = new Map<number, string>();
  for (const dia of ORDEM_SEMANA) {
    for (const chave of CHAVES_PT[dia]) {
      const bruto = textoNaoVazio(hours[chave]);
      if (bruto) {
        const t = janelaEmTexto(bruto);
        if (t) porDia.set(dia, t);
        break;
      }
    }
  }
  if (porDia.size === 0) return null;
  return agruparDias(porDia).join('; ');
}

/**
 * Lê o horário do cliente nos três formatos que existem no banco e devolve
 * UM texto. Ausência devolve null: quem consome decide o que dizer, e a
 * resposta certa nunca é "Domingo: Fechado".
 *
 * Precedência: businessHoursConfig (fonte única, com fuso) > formato do
 * painel de identidade (inglês) > formato do cadastro (português). Os dois
 * últimos ficam só para LER o legado; escrita nova vai para o config.
 */
export function normalizarHorario(
  settings: Record<string, any> | null | undefined,
): HorarioNormalizado {
  const s = settings ?? {};

  const config = lerConfig(s.businessHoursConfig);
  if (config) {
    return { config, texto: horarioDoConfig(config), formato: 'config' };
  }

  const hours = s.businessHours;
  if (hours && typeof hours === 'object') {
    const ingles = horarioIngles(hours as Record<string, any>);
    if (ingles) return { config: null, texto: ingles, formato: 'ingles' };

    const portugues = horarioPortugues(hours as Record<string, any>);
    if (portugues) return { config: null, texto: portugues, formato: 'portugues' };
  }

  return { config: null, texto: null, formato: null };
}

/** Uma linha por tom. O texto longo do enum ficou no promptEngine (fallback). */
const TOM_EM_UMA_LINHA: Record<string, string> = {
  friendly:
    'amigável. Linguagem próxima e informal, mas profissional. Pode usar "você" e emoji ocasional.',
  formal:
    'formal. Linguagem respeitosa, frases completas, sem gíria e com pouco emoji.',
  technical:
    'técnico. Preciso e direto, com a terminologia da área e foco em fatos e procedimentos.',
  professional:
    'profissional. Cordial e objetivo, sem gíria e sem excesso de emoji.',
};

function linhaDeTom(tone: unknown): string | null {
  const t = textoNaoVazio(tone);
  if (!t) return null;
  const conhecido = TOM_EM_UMA_LINHA[t.toLowerCase()];
  if (conhecido) return conhecido;
  // Tom escrito pelo cliente (questionário). Vale como ele escreveu.
  return limitar(t, MAX_TOM);
}

export interface LiveProfileAgendamento {
  /** Só true quando há tipo ativo E a organização tem direito ao recurso. */
  ativo: boolean;
  /** Nomes dos tipos ativos, para a IA dizer o que dá para marcar. */
  tipos?: string[];
}

export interface LiveProfileOpts {
  /** 'agora' injetado. Sem ele (ou sem businessHoursConfig) não sai a linha. */
  now?: Date | null;
  /**
   * Estado real do agendamento. `undefined` = quem chamou não resolveu, e o
   * bloco simplesmente não fala de agendamento (nem promete, nem proíbe).
   */
  agendamento?: LiveProfileAgendamento | null;
  maxChars?: number;
}

export interface LiveProfileIdentidade {
  agentName?: string | null;
  businessName?: string | null;
}

/**
 * O bloco que a IA recebe sobre a própria empresa, montado agora.
 *
 * Devolve '' quando não há nada de verdade para dizer: bloco oco só gasta
 * token e ensina o modelo a preencher lacuna.
 */
export function buildLiveProfileBlock(
  settings: Record<string, any> | null | undefined,
  perfil?: LiveProfileIdentidade | null,
  opts: LiveProfileOpts = {},
): string {
  const s = settings ?? {};
  const maxChars = opts.maxChars ?? LIVE_PROFILE_MAX_CHARS;

  const agentName = textoNaoVazio(s.agentName) ?? textoNaoVazio(perfil?.agentName);
  const businessName = textoNaoVazio(s.businessName) ?? textoNaoVazio(perfil?.businessName);

  const linhas: string[] = [];

  if (agentName && businessName) {
    linhas.push(`- Você é ${limitar(agentName, MAX_NOME)}, de ${limitar(businessName, MAX_NEGOCIO)}.`);
  } else if (agentName) {
    linhas.push(`- Você é ${limitar(agentName, MAX_NOME)}.`);
  } else if (businessName) {
    linhas.push(`- Você atende em nome de ${limitar(businessName, MAX_NEGOCIO)}.`);
  }

  const tom = linhaDeTom(s.tone);
  if (tom) linhas.push(`- Tom de voz: ${limitar(tom, MAX_TOM)}`);

  const horario = normalizarHorario(s);
  linhas.push(
    `- Horário de atendimento humano: ${horario.texto ? limitar(horario.texto, MAX_HORARIO) : TEXTO_HORARIO_AUSENTE}`,
  );

  if (horario.config && opts.now) {
    linhas.push(`- Agora: ${isOpen(horario.config, opts.now) ? 'aberto' : 'fechado'}`);
  }

  const handoff = textoNaoVazio(s.handoffMessage);
  if (handoff) {
    linhas.push(`- Ao transferir para uma pessoa, diga: "${limitar(handoff, MAX_HANDOFF)}"`);
  }

  const ag = opts.agendamento;
  if (ag) {
    if (ag.ativo) {
      const tipos = (ag.tipos ?? []).map((t) => String(t).trim()).filter(Boolean);
      const texto = tipos.length
        ? `disponível para: ${limitar(tipos.join(', '), MAX_AGENDAMENTO)}`
        : 'disponível. Use as ferramentas de horário e de marcação, nunca confirme de cabeça';
      linhas.push(`- Agendamento: ${texto}`);
    } else {
      linhas.push(
        '- Agendamento: não ofereça agendamento por aqui. Colete a preferência de data e horário e diga que a equipe confirma. Não confirme horário e não prometa aviso automático.',
      );
    }
  }

  // A linha de horário existe SEMPRE, mesmo na organização que não preencheu
  // nada: é ela que impede a IA de inventar dia e hora de funcionamento.
  const cabecalho = [
    '# Como você atende nesta empresa',
    'Estas informações vêm do que o dono do negócio preencheu e valem mais que qualquer trecho mais antigo deste prompt.',
  ];

  const bloco = [...cabecalho, ...linhas].join('\n');
  if (bloco.length <= maxChars) return bloco;

  // Corta por linha inteira: prompt com linha pela metade confunde o modelo.
  const cortado: string[] = [...cabecalho];
  let tamanho = cabecalho.join('\n').length;
  for (const linha of linhas) {
    if (tamanho + 1 + linha.length > maxChars) break;
    cortado.push(linha);
    tamanho += 1 + linha.length;
  }
  return cortado.join('\n').slice(0, maxChars).trimEnd();
}

/**
 * Saudação configurada pelo dono, só no primeiro contato.
 *
 * Mora aqui (e não no agentOrchestrator, que a exporta) porque o chat do
 * site precisa da MESMA saudação e não pode carregar o orquestrador inteiro
 * só para isso. Uma implementação, dois canais.
 */
export function buildGreetingBlock(
  isFirstContact: boolean,
  greetingMessage?: string | null,
): string {
  const msg = (greetingMessage || '').trim();
  if (!isFirstContact || !msg) return '';
  return [
    '# Saudação configurada pelo dono do negócio',
    'Na PRIMEIRA mensagem desta conversa (primeiro contato), abra com esta saudação, adaptando levemente ao seu tom mas mantendo o sentido e as informações. Depois de saudar, já responda à mensagem do cliente na mesma resposta. NÃO repita esta saudação nas mensagens seguintes:',
    msg,
  ].join('\n');
}
