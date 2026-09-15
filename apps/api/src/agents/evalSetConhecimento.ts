/* ══════════════════════════════════════════════════════════════════════
 * Cenários de CONHECIMENTO gerados do conteúdo do próprio cliente.
 * --------------------------------------------------------------------
 * Tarefa C2 (Passo 13, P13 primeiro ciclo, sem tabela nova).
 *
 * A Saiba Mais prometia que a nota media o quanto o agente sabe do negócio,
 * mas o único cenário de conhecimento era o cr7_preco_da_base_correto, e ele
 * reprovou 26 de 26 vezes: o juiz recebia a tabela cortada em 600
 * caracteres e o agente testado não recebia nada (A037, A086). Um agente sem
 * conteúdo nenhum tirava 77%.
 *
 * Aqui a matéria-prima é o que o dono JÁ cadastrou:
 *   - cada pergunta e resposta ATIVA vira um cenário, com a pergunta
 *     literal (sem paráfrase por modelo, que poderia mudar o sentido);
 *   - os campos factuais do questionário (tabela de preços, horário,
 *     formas de pagamento e endereço) viram um cenário cada. O desconto
 *     máximo NÃO vira pergunta: é política interna, e treinar o agente a
 *     responder o teto de desconto ao cliente final é o risco do A191. Ele
 *     continua cobrado pelo cr7_no_invent_preco_desconto.
 *
 * A checagem determinística é por VALOR, não por frase: todo número da
 * resposta cadastrada precisa aparecer na resposta do agente, e nenhum valor
 * em reais pode sair de fora da tabela. O juiz (outra família de modelo, com
 * a evidência antes do veredito) cuida do resto.
 *
 * Módulo PURO: sem banco, sem rede, sem modelo. O perfil já chega carregado.
 * ══════════════════════════════════════════════════════════════════════ */

import { PERGUNTA_POR_ID } from '@zappiq/shared';
import type { TenantAgentProfile } from './tenantAgentProfile.js';
import type { AcaoDeTreino, CasoDeConhecimento, EvalScenario } from './evalScenarioTypes.js';

/** Teto de casos de conhecimento por execução (rodízio). */
export const TETO_DE_CASOS_DE_CONHECIMENTO = 8;

/** Repetições de cada caso de conhecimento: aprova só se todas passarem. */
export const REPETICOES_DO_CASO_DE_CONHECIMENTO = 2;

/** Prefixo dos ids gerados. Nunca colide com o gabarito universal. */
export const PREFIXO_DO_CASO_DE_QA = 'kb_qa_';
export const PREFIXO_DO_CASO_DO_QUESTIONARIO = 'kb_questionario_';

/* ── Valores: números, horários e reais ───────────────────────────── */

/**
 * Número no formato canônico: sem separador de milhar, com ponto decimal e
 * sem zero à toa. "1.500,00" e "1500" viram "1500"; "79,90" vira "79.9";
 * "08" vira "8".
 */
export function numeroCanonico(bruto: string): string | null {
  let t = String(bruto ?? '').trim();
  if (!t) return null;
  if (t.includes(',')) {
    // Vírgula é decimal (pt-BR): os pontos são milhar.
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // "1.500" e "35.000": ponto de milhar, sem decimal.
    t = t.replace(/\./g, '');
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

export interface ValoresDoTexto {
  /** Todo número solto, inclusive o que vem depois de "R$". */
  numeros: Set<string>;
  /** Horários como "8:00" e "18:30". */
  horarios: Set<string>;
  /** Valores em reais (canônicos), só os que vêm com "R$". */
  reais: Set<string>;
}

/**
 * "08:00", "8h", "8h30", "18 horas", "9hs". O "h" não pode ser começo de
 * palavra ("3 hambúrgueres" não é horário).
 */
const HORARIO = /\b([01]?\d|2[0-3])\s*(?::|h(?:oras?|s)?(?![a-zà-úç]))\s*([0-5]\d)?(?!\d)/gi;
const REAIS = /R\$\s*(\d[\d.,]*\d|\d)/gi;
const NUMERO = /\d+(?:[.,]\d+)*/g;

/**
 * Tira do texto o que parece número mas não é valor: marcador de lista no
 * começo da linha ("1. Consulta", "2) Limpeza"). Sem isto, a tabela de preços
 * numerada exigiria que o agente dissesse "1" e "2".
 */
function semMarcadorDeLista(texto: string): string {
  return texto.replace(/^\s*\d{1,2}\s*[.)-]\s+/gm, ' ');
}

/** Extrai números, horários e valores em reais de um texto. Pura. */
export function extrairValores(texto: string): ValoresDoTexto {
  const numeros = new Set<string>();
  const horarios = new Set<string>();
  const reais = new Set<string>();

  let resto = semMarcadorDeLista(String(texto ?? ''));

  // 1. Reais primeiro: "R$ 1.500,00" não pode virar horário nem três números.
  resto = resto.replace(REAIS, (_m, valor: string) => {
    const c = numeroCanonico(valor.replace(/[.,]$/, ''));
    if (c) {
      reais.add(c);
      numeros.add(c);
    }
    return ' ';
  });

  // 2. Horários: "08:00", "8h", "8h30", "18 horas".
  resto = resto.replace(HORARIO, (_m, h: string, min: string | undefined) => {
    // "24h por dia" fica de fora: 24 não é hora do relógio no padrão acima,
    // e sobra como número solto.
    horarios.add(`${Number(h)}:${min ?? '00'}`);
    return ' ';
  });

  // 3. O resto dos números.
  for (const m of resto.matchAll(NUMERO)) {
    const c = numeroCanonico(m[0].replace(/[.,]$/, ''));
    if (c) numeros.add(c);
  }

  return { numeros, horarios, reais };
}

/**
 * Os valores que a resposta do agente PRECISA conter, no formato de busca:
 * 'n:1500' para número e 'h:8:00' para horário.
 */
export function valoresEsperadosDe(referencia: string): string[] {
  const v = extrairValores(referencia);
  return [...[...v.horarios].map((h) => `h:${h}`), ...[...v.numeros].map((n) => `n:${n}`)];
}

/** "n:1500" vira "1500"; "h:8:00" vira "8:00". Para a tela. */
export function valorLegivel(token: string): string {
  return String(token ?? '').replace(/^[nh]:/, '');
}

/** O agente disse este valor? Horário cheio ("8:00") aceita "8" solto. */
function contemValor(resposta: ValoresDoTexto, token: string): boolean {
  if (token.startsWith('h:')) {
    const h = token.slice(2);
    if (resposta.horarios.has(h)) return true;
    const [hora, minuto] = h.split(':');
    return minuto === '00' && resposta.numeros.has(String(Number(hora)));
  }
  return resposta.numeros.has(token.slice(2));
}

export interface ChecagemDeConhecimento {
  /** Valores da resposta cadastrada que o agente não disse. */
  faltando: string[];
  /** Valores em reais que o agente disse e que não estão na tabela. */
  foraDaTabela: string[];
}

/**
 * A checagem determinística de um caso de conhecimento. Pura.
 *
 * 'todos': todo valor cadastrado tem de aparecer (a regra das perguntas e
 * respostas). 'algum': basta um (a tabela de preços, que tem dezenas de
 * linhas e o cliente perguntou "quanto custa?").
 */
export function checarConhecimento(
  resposta: string,
  caso: Pick<CasoDeConhecimento, 'valoresEsperados' | 'exigencia' | 'reaisPermitidos'>,
): ChecagemDeConhecimento {
  const doAgente = extrairValores(resposta);
  const esperados = caso.valoresEsperados ?? [];

  let faltando: string[] = [];
  if (esperados.length > 0) {
    const ausentes = esperados.filter((t) => !contemValor(doAgente, t));
    if (caso.exigencia === 'algum') {
      faltando = ausentes.length === esperados.length ? esperados.map(valorLegivel) : [];
    } else {
      faltando = ausentes.map(valorLegivel);
    }
  }

  const permitidos = new Set(caso.reaisPermitidos ?? []);
  const foraDaTabela = [...doAgente.reais].filter((r) => !permitidos.has(r));

  return { faltando, foraDaTabela };
}

/**
 * A régua determinística inteira de um cenário: os padrões de sempre mais a
 * checagem por valor, quando o cenário é de conhecimento gerado. Pura.
 *
 * É a MESMA função no avaliador e na regravação: uma régua só.
 */
export function checagemDeterministica(
  cenario: Pick<EvalScenario, 'passPatterns' | 'failPatterns' | 'conhecimento'>,
  resposta: string,
): { passed: boolean; failedPatterns: string[]; missingPatterns: string[] } {
  const missingPatterns: string[] = [];
  const failedPatterns: string[] = [];
  for (const p of cenario.passPatterns ?? []) {
    if (!p.test(resposta)) missingPatterns.push(p.toString());
  }
  for (const p of cenario.failPatterns ?? []) {
    if (p.test(resposta)) failedPatterns.push(p.toString());
  }
  if (cenario.conhecimento) {
    const c = checarConhecimento(resposta, cenario.conhecimento);
    for (const v of c.faltando) missingPatterns.push(`valor cadastrado: ${v}`);
    for (const r of c.foraDaTabela) failedPatterns.push(`valor em reais fora da tabela: ${r}`);
  }
  return {
    passed: missingPatterns.length === 0 && failedPatterns.length === 0,
    failedPatterns,
    missingPatterns,
  };
}

/* ── Os casos ─────────────────────────────────────────────────────── */

/** Seção do questionário de um campo, para a ação de treino. */
function secaoDoCampo(campo: string, reserva: string): string {
  return PERGUNTA_POR_ID.get(campo)?.secaoId ?? reserva;
}

/** Texto curto para a descrição do cenário. */
function curto(texto: string, max = 80): string {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Todo valor em reais que o dono cadastrou: tabela e respostas. */
function reaisCadastrados(p: TenantAgentProfile): string[] {
  const fontes = [p.fatos?.precos ?? p.precos ?? '', ...(p.qaAtivos ?? []).map((q) => q.resposta)];
  const todos = new Set<string>();
  for (const f of fontes) for (const r of extrairValores(f).reais) todos.add(r);
  return [...todos];
}

interface FatoDoQuestionario {
  campo: string;
  /** Pergunta do CLIENTE FINAL, não a do questionário (que é para o dono). */
  pergunta: string;
  rotulo: string;
  secaoReserva: string;
  exigencia: 'todos' | 'algum';
  severity: EvalScenario['severity'];
  valor: (p: TenantAgentProfile) => string | null;
}

/**
 * Os campos factuais do questionário que viram pergunta. A ordem é a do
 * rodízio: estes entram antes das perguntas e respostas.
 */
const FATOS_DO_QUESTIONARIO: FatoDoQuestionario[] = [
  {
    campo: 'pre_tabela_precos',
    pergunta: 'quanto custa?',
    rotulo: 'tabela de preços',
    secaoReserva: 'precos_condicoes',
    // Tabela tem dezenas de linhas; "quanto custa?" pede ao menos um valor.
    exigencia: 'algum',
    severity: 'critical',
    valor: (p) => p.fatos?.precos ?? p.precos ?? null,
  },
  {
    campo: 'ide_horarios_funcionamento',
    pergunta: 'qual o horário de atendimento de vocês?',
    rotulo: 'horário de funcionamento',
    secaoReserva: 'identidade_empresa',
    exigencia: 'todos',
    severity: 'high',
    valor: (p) => p.fatos?.horario ?? null,
  },
  {
    campo: 'pre_formas_pagamento',
    pergunta: 'quais as formas de pagamento?',
    rotulo: 'formas de pagamento',
    secaoReserva: 'precos_condicoes',
    exigencia: 'algum',
    severity: 'medium',
    valor: (p) => p.fatos?.pagamento ?? null,
  },
  {
    campo: 'ide_endereco_principal',
    pergunta: 'qual o endereço de vocês?',
    rotulo: 'endereço',
    secaoReserva: 'identidade_empresa',
    // Rua e número bastam: exigir CEP e complemento reprovaria o certo.
    exigencia: 'algum',
    severity: 'medium',
    valor: (p) => p.fatos?.endereco ?? null,
  },
];

function cenarioDoFato(p: TenantAgentProfile, fato: FatoDoQuestionario, reais: string[]): EvalScenario | null {
  const referencia = String(fato.valor(p) ?? '').trim();
  if (!referencia) return null;
  const acaoDeTreino: AcaoDeTreino = {
    tipo: 'questionario',
    secao: secaoDoCampo(fato.campo, fato.secaoReserva),
    campo: fato.campo,
    rotulo: fato.rotulo,
  };
  const conhecimento: CasoDeConhecimento = {
    origem: 'questionario',
    fonte: fato.campo,
    referencia,
    valoresEsperados: valoresEsperadosDe(referencia),
    exigencia: fato.exigencia,
    reaisPermitidos: reais,
    acaoDeTreino,
  };
  return {
    id: `${PREFIXO_DO_CASO_DO_QUESTIONARIO}${fato.campo}`,
    category: 'kb_conhecimento',
    natureza: 'conhecimento',
    severity: fato.severity,
    description: `Resposta sobre ${fato.rotulo} vem do que foi cadastrado no questionário`,
    userMessage: fato.pergunta,
    // A tabela vai INTEIRA para o juiz: o corte em 600 caracteres fazia o
    // juiz chamar de inventado o valor que estava depois do corte (A037).
    expectedBehavior:
      `Responder sobre ${fato.rotulo} de ${p.businessName} com o que está cadastrado (abaixo). ` +
      `Pode usar outras palavras, mas os valores, horários e condições têm de ser os cadastrados. ` +
      `NÃO inventar valor que não está cadastrado. Se faltar a informação no que o agente recebeu, ` +
      `dizer que vai verificar em vez de inventar.\n` +
      `Cadastrado pelo dono:\n${referencia}`,
    repeticoes: REPETICOES_DO_CASO_DE_CONHECIMENTO,
    conhecimento,
  };
}

function cenarioDoQa(
  p: TenantAgentProfile,
  qa: { id: string; pergunta: string; resposta: string },
  reais: string[],
): EvalScenario | null {
  const pergunta = String(qa.pergunta ?? '').trim();
  const resposta = String(qa.resposta ?? '').trim();
  if (!pergunta || !resposta || !qa.id) return null;
  const conhecimento: CasoDeConhecimento = {
    origem: 'qa',
    fonte: qa.id,
    referencia: resposta,
    valoresEsperados: valoresEsperadosDe(resposta),
    exigencia: 'todos',
    reaisPermitidos: reais,
    acaoDeTreino: { tipo: 'qa', pergunta },
  };
  return {
    id: `${PREFIXO_DO_CASO_DE_QA}${qa.id}`,
    category: 'kb_conhecimento',
    natureza: 'conhecimento',
    severity: 'high',
    description: `Pergunta cadastrada: "${curto(pergunta)}"`,
    // A pergunta LITERAL, como o dono escreveu (P13): paráfrase por modelo
    // poderia mudar o sentido e reprovar injustamente.
    userMessage: pergunta,
    expectedBehavior:
      `Responder conforme a resposta que ${p.businessName} cadastrou para esta pergunta (abaixo). ` +
      `Pode usar outras palavras, mas os números, valores, prazos e condições têm de ser os ` +
      `cadastrados. NÃO inventar informação que não está na resposta cadastrada.\n` +
      `Resposta cadastrada pelo dono:\n${resposta}`,
    repeticoes: REPETICOES_DO_CASO_DE_CONHECIMENTO,
    conhecimento,
  };
}

/**
 * TODOS os casos de conhecimento do tenant (sem rodízio). O rodízio é da
 * EXECUÇÃO (aplicarRodizio): quem procura um cenário pelo id (re-teste,
 * sugestão, aplicar) precisa achar qualquer um deles.
 *
 * A org da ZappIQ fica de fora dos campos do questionário: o comercial da
 * Iza vem do catálogo (evalSetZappIQ.ts). As perguntas e respostas ativas
 * dela entram, como as de qualquer tenant.
 */
export function cenariosDeConhecimento(p: TenantAgentProfile): EvalScenario[] {
  const reais = reaisCadastrados(p);
  const fatos = p.isZappIQ
    ? []
    : FATOS_DO_QUESTIONARIO.map((f) => cenarioDoFato(p, f, reais)).filter(
        (s): s is EvalScenario => s !== null,
      );
  const vistos = new Set<string>();
  const qas = (p.qaAtivos ?? [])
    .map((qa) => cenarioDoQa(p, qa, reais))
    .filter((s): s is EvalScenario => {
      if (!s || vistos.has(s.id)) return false;
      vistos.add(s.id);
      return true;
    });
  return [...fatos, ...qas];
}

/* ── Rodízio ──────────────────────────────────────────────────────── */

const DIA_MS = 24 * 3600 * 1000;

/**
 * A semana do rodízio (dias desde a época dividido por 7). A execução
 * semanal e as manuais da mesma semana testam os mesmos casos, e a nota da
 * semana é comparável; na semana seguinte entram os próximos.
 */
export function semanaDoRodizio(agora: Date): number {
  return Math.floor(agora.getTime() / DIA_MS / 7);
}

/**
 * Até `limite` casos de conhecimento por execução. Os do questionário entram
 * primeiro (são poucos e cobrem o que o cliente mais pergunta: preço,
 * horário, pagamento, endereço); as perguntas e respostas giram na vaga que
 * sobra, a partir de um deslocamento que anda a cada semana, até todas terem
 * passado. Cenários que não são casos gerados atravessam intactos, na ordem.
 */
export function aplicarRodizio(
  cenarios: EvalScenario[],
  semente: number,
  limite = TETO_DE_CASOS_DE_CONHECIMENTO,
): EvalScenario[] {
  const gerados = cenarios.filter((c) => c.conhecimento);
  if (gerados.length <= limite) return cenarios;

  const doQuestionario = gerados.filter((c) => c.conhecimento!.origem === 'questionario');
  const deQa = gerados.filter((c) => c.conhecimento!.origem === 'qa');

  const escolhidos = new Set<string>(doQuestionario.slice(0, limite).map((c) => c.id));
  const vagas = limite - escolhidos.size;
  if (vagas > 0 && deQa.length > 0) {
    const inicio = ((Math.abs(Math.trunc(semente)) * vagas) % deQa.length + deQa.length) % deQa.length;
    for (let i = 0; i < Math.min(vagas, deQa.length); i++) {
      escolhidos.add(deQa[(inicio + i) % deQa.length].id);
    }
  }
  return cenarios.filter((c) => !c.conhecimento || escolhidos.has(c.id));
}

/* ── Aviso: o preço em dois lugares (A086) ─────────────────────────── */

/** Formata o valor canônico em reais para a frase ("35000" vira "R$ 35.000"). */
function emReais(canonico: string): string {
  const n = Number(canonico);
  if (!Number.isFinite(n)) return `R$ ${canonico}`;
  return Number.isInteger(n)
    ? `R$ ${n.toLocaleString('pt-BR')}`
    : `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * O preço existe em dois lugares com valores diferentes? (A086)
 *
 * O caso real: o prompt da Vera, editado à mão em 09/09, diz R$ 6.300; o
 * questionário diz R$ 35.000. O agente responde qualquer um dos dois, e o
 * juiz chamava de inventado o que estava no prompt. Devolve a frase para a
 * tela, ou null quando não há conflito (ou não há os dois lados).
 */
export function avisoDePrecoEmDoisLugares(
  systemPrompt: string | null | undefined,
  tabela: string | null | undefined,
): string | null {
  const noPrompt = [...extrairValores(String(systemPrompt ?? '')).reais];
  const naTabela = new Set(extrairValores(String(tabela ?? '')).reais);
  if (noPrompt.length === 0 || naTabela.size === 0) return null;
  const diferentes = noPrompt.filter((v) => !naTabela.has(v));
  if (diferentes.length === 0) return null;
  const doPrompt = diferentes.slice(0, 3).map(emReais).join(', ');
  const doQuestionario = [...naTabela].slice(0, 3).map(emReais).join(', ');
  return (
    `O preço aparece em dois lugares com valores diferentes: no texto do agente (${doPrompt}) ` +
    `e no questionário (${doQuestionario}). O agente pode responder qualquer um dos dois. ` +
    'Deixe o preço só no questionário, em Treinar IA, e tire do texto do agente.'
  );
}
