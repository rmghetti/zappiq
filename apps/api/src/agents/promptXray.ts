/* ══════════════════════════════════════════════════════════════════════
 * promptXray: Raio-X do que a IA recebe, sem chamar o modelo.
 * --------------------------------------------------------------------
 * Tarefa A3 do plano "Treinar IA e Qualidade da IA" (achados A072, A036,
 * A057, A058, A059, A068).
 *
 * O problema que isto resolve: quando o dono do negócio diz "a IA não faz o
 * que eu configurei", hoje não existe forma de olhar. O prompt é montado em
 * quatro caminhos diferentes (WhatsApp, Instagram, chat do site, teste de
 * Qualidade) e cada um perde uma coisa diferente pelo caminho. O Raio-X
 * monta o prompt pelo MESMO caminho da produção, fatia em blocos legíveis e
 * compara cada bloco com o que a organização configurou.
 *
 * Este arquivo é puro de propósito: sem banco, sem rede e, principalmente,
 * SEM chamada a modelo. O Raio-X custa zero e pode ser rodado à vontade.
 *
 * Duas funções:
 *   sliceBySections: corta o prompt nos cabeçalhos que a produção usa.
 *   runChecks:       devolve a lista de verde e vermelho, com o trecho que
 *                     foi procurado em cada caso, para quem olha decidir.
 * ══════════════════════════════════════════════════════════════════════ */

import { getToneInstructions } from './promptEngine.js';
import { normalizeUrl } from './tenantConversionUrls.js';
// O bloco vivo (A8) reescreve tom e horário no turno. O Raio-X precisa
// procurar o texto que ELE escreve, e não só o texto cru das settings.
import { linhaDeTomDoPerfilVivo, normalizarHorario } from './tenantLiveProfile.js';

// ── Fatiamento ───────────────────────────────────────────────────────

export interface FatiaDoPrompt {
  titulo: string;
  texto: string;
  chars: number;
}

/**
 * Cabeçalhos de primeiro nível que ABREM os blocos montados pela produção.
 * A ordem aqui não importa (o corte é por linha), mas o texto sim: cada
 * padrão precisa casar com o cabeçalho literal do código que monta o bloco.
 *
 *   Regras base       → coreAgentRules.ts (CORE_AGENT_RULES_V1)
 *   Fatos atuais      → izaFactsService.ts (só a org da ZappIQ recebe)
 *   Identidade        → agents.system_prompt, seedado por promptEngine.ts
 *   Links oficiais    → tenantConversionUrls.ts (camada viva, por turno)
 *   Cliente atual     → agentOrchestrator.buildSystemPromptForContact
 *   Saudação          → agentOrchestrator.buildGreetingBlock
 *   Contexto (RAG)    → agentOrchestrator.buildSystemPromptForContact
 *   Agora             → agentOrchestrator.buildSystemPromptForContact
 *
 * O que não casa com nenhum destes fica dentro da fatia anterior. É de
 * propósito: nenhum caractere do prompt pode sumir do Raio-X.
 */
const CABECALHOS: Array<{ titulo: string; casa: (linha: string, proxima: string) => boolean }> = [
  {
    titulo: 'Regras base (CORE)',
    // O bloco abre com uma linha de moldura ('# ═══…') antes do título. Se a
    // moldura vier primeiro, o corte tem de ser nela, senão a moldura ficaria
    // órfã na fatia anterior.
    casa: (linha, proxima) =>
      /^#{1,3}\s+REGRAS BASE DO AGENTE/.test(linha) ||
      (/^#\s+═+\s*$/.test(linha) && /^#{1,3}\s+REGRAS BASE DO AGENTE/.test(proxima)),
  },
  { titulo: 'Fatos atuais da plataforma', casa: (l) => /^#{1,3}\s+FATOS ATUAIS/.test(l) },
  { titulo: 'Identidade (prompt do agente)', casa: (l) => /^#{1,3}\s+IDENTIDADE/.test(l) },
  { titulo: 'Links oficiais do tenant', casa: (l) => /^#{1,3}\s+Links oficiais/.test(l) },
  { titulo: 'Cliente atual', casa: (l) => /^#{1,3}\s+Cliente atual/.test(l) },
  { titulo: 'Saudação configurada', casa: (l) => /^#{1,3}\s+Saudação configurada/.test(l) },
  { titulo: 'Contexto recuperado (RAG)', casa: (l) => /^#{1,3}\s+Contexto recuperado/.test(l) },
  { titulo: 'Agora', casa: (l) => /^#{1,3}\s+Agora\s*$/.test(l) },
];

/**
 * Corta o prompt em fatias legíveis. O que vier antes do primeiro cabeçalho
 * conhecido vira a fatia 'Início'. Junta as fatias de volta com '\n' e você
 * tem o prompt original de novo, caractere por caractere.
 */
export function sliceBySections(prompt: string): FatiaDoPrompt[] {
  const linhas = String(prompt ?? '').split('\n');
  const fatias: Array<{ titulo: string; linhas: string[] }> = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const proxima = linhas[i + 1] ?? '';
    const cabecalho = CABECALHOS.find((c) => c.casa(linha, proxima));
    const atual = fatias[fatias.length - 1];
    // Um bloco pode abrir com mais de uma linha de cabeçalho seguidas (o CORE
    // abre com moldura + título). Linhas seguidas que casam com o MESMO bloco
    // pertencem à fatia recém-aberta, não abrem outra.
    const continuacao =
      cabecalho && atual && atual.titulo === cabecalho.titulo && atual.linhas.length <= 2;
    if (cabecalho && !continuacao) {
      fatias.push({ titulo: cabecalho.titulo, linhas: [linha] });
      continue;
    }
    if (fatias.length === 0) fatias.push({ titulo: 'Início', linhas: [] });
    fatias[fatias.length - 1].linhas.push(linha);
  }

  return fatias
    .map((f) => ({ titulo: f.titulo, texto: f.linhas.join('\n') }))
    // Uma fatia 'Início' vazia (prompt que já começa no CORE) não interessa
    // a ninguém. Qualquer outra fatia fica, mesmo curta.
    .filter((f, idx) => !(idx === 0 && f.titulo === 'Início' && f.texto.trim() === ''))
    .map((f) => ({ ...f, chars: f.texto.length }));
}

// ── Checagens ────────────────────────────────────────────────────────

export interface FonteRecuperada {
  source: string;
  similarity: number;
}

export interface QaAtivo {
  id: string;
  question: string;
}

export interface ChecagemXray {
  id: string;
  rotulo: string;
  ok: boolean;
  /** Sempre diz QUAL trecho foi procurado, para quem olha poder decidir. */
  detalhe: string;
}

export interface EntradaDasChecagens {
  prompt: string;
  settings: Record<string, any> | null | undefined;
  sources: FonteRecuperada[];
  ultimaMensagem: string;
  qaAtivos: QaAtivo[];
}

/** Minúsculas, sem acento, sem espaço duplicado. Para comparar texto de gente. */
function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    // Faixa dos acentos combinantes (U+0300 a U+036F), por escape: escrita
    // com os caracteres literais ela fica invisível no editor e some num
    // salvamento desatento.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function recorte(valor: string, max = 120): string {
  return valor.length > max ? `${valor.slice(0, max)}...` : valor;
}

function identidadeEmpresa(settings: Record<string, any> | null | undefined): Record<string, any> {
  return (settings?.surveyAnswers?.identidade_empresa as Record<string, any>) || {};
}

/** Prefixo do documento gerado a partir do questionário do cadastro. */
const PREFIXO_QUESTIONARIO = 'onboarding-survey-';

/** Frases que o CR-3 do CORE proíbe o agente de usar. */
const FRASES_PROIBIDAS_CR3 = [
  'como posso ajudar',
  'como posso te ajudar',
  'em que posso ajudar',
  'estou a disposicao',
];

/**
 * Horários cadastrados, nos três formatos que convivem hoje no produto:
 *   1. businessHours em inglês   (painel Treinar IA): weekdays/saturday/sunday/holidays
 *   2. businessHours em português (cadastro/onboarding): Segunda..Domingo
 *   3. businessHoursConfig        (Configurações, usado pelo Maestro): days[0..6]
 *
 * Devolve os textos que DEVERIAM aparecer no prompt e se domingo abre.
 */
function horariosCadastrados(settings: Record<string, any> | null | undefined): {
  esperados: string[];
  domingoAbre: boolean;
  domingoTexto: string;
} {
  const esperados: string[] = [];
  let domingoAbre = false;
  let domingoTexto = '';

  const bh = settings?.businessHours;
  if (bh && typeof bh === 'object') {
    for (const [chave, valor] of Object.entries(bh as Record<string, any>)) {
      const v = texto(valor);
      if (!v || /^fechado$/i.test(v)) continue;
      esperados.push(v);
      const chaveNorm = normalizar(chave);
      if (chaveNorm === 'sunday' || chaveNorm === 'domingo') {
        domingoAbre = true;
        domingoTexto = v;
      }
    }
  }

  const cfg = settings?.businessHoursConfig;
  if (cfg && typeof cfg === 'object' && cfg.days && typeof cfg.days === 'object') {
    for (const [dia, janela] of Object.entries(cfg.days as Record<string, any>)) {
      if (!janela || typeof janela !== 'object') continue;
      const abre = texto(janela.open);
      const fecha = texto(janela.close);
      if (!abre && !fecha) continue;
      const faixa = [abre, fecha].filter(Boolean).join(' às ');
      esperados.push(faixa);
      if (String(dia) === '0') {
        domingoAbre = true;
        domingoTexto = domingoTexto || faixa;
      }
    }
  }

  return { esperados, domingoAbre, domingoTexto };
}

/**
 * Compara o prompt montado com o que a organização configurou. Cada item traz
 * no detalhe o trecho procurado: o Raio-X não julga, ele mostra.
 */
export function runChecks(entrada: EntradaDasChecagens): ChecagemXray[] {
  const prompt = String(entrada.prompt ?? '');
  const settings = entrada.settings || {};
  const sources = entrada.sources || [];
  const ultimaMensagem = String(entrada.ultimaMensagem ?? '');
  const qaAtivos = entrada.qaAtivos || [];

  return [
    checarTom(prompt, settings),
    checarHorario(prompt, settings),
    checarSaudacao(prompt, settings),
    checarLinkDoSite(prompt, settings),
    checarBaseConsultada(sources),
    checarQaLiteral(sources, ultimaMensagem, qaAtivos),
    checarPrecoNaBase(settings, sources, ultimaMensagem, qaAtivos),
    checarSaudacaoContraCr3(settings),
  ];
}

/**
 * Os únicos tons que o montador do prompt entende (promptEngine.getToneInstructions).
 * Qualquer outro valor cai no amigável por dentro, em silêncio.
 */
const TONS_RECONHECIDOS = ['friendly', 'formal', 'technical'];

const ROTULO_TOM = 'O tom de voz configurado chegou ao prompt';

function checarTom(prompt: string, settings: Record<string, any>): ChecagemXray {
  const configurado = texto(settings.tone);
  const tom = configurado || 'friendly';

  // Caminho do perfil vivo (A8): com o interruptor ligado, o tom entra no
  // prompt como UMA LINHA montada no turno, e não como o cabeçalho de seção
  // que o seed gravava. Essa linha aceita qualquer tom, inclusive o texto
  // livre que o dono escreveu no questionário. Se ela está no prompt, o tom
  // configurado chegou de verdade, e não há o que reclamar.
  const linhaViva = linhaDeTomDoPerfilVivo(tom);
  if (linhaViva && prompt.includes(linhaViva)) {
    return {
      id: 'tom_no_prompt',
      rotulo: ROTULO_TOM,
      ok: true,
      detalhe: `Tom configurado nas configurações: "${tom}". Encontrado no bloco vivo do prompt: "${recorte(linhaViva)}".`,
    };
  }

  // getToneInstructions devolve o bloco AMIGÁVEL para qualquer valor fora dos
  // três reconhecidos. Sem este corte a checagem ficaria verde comparando o
  // prompt com o bloco amigável, justamente no caso em que o tom escolhido
  // pelo cliente foi jogado fora. Falso positivo é pior do que não checar.
  if (configurado && !TONS_RECONHECIDOS.includes(configurado)) {
    return {
      id: 'tom_no_prompt',
      rotulo: ROTULO_TOM,
      ok: false,
      detalhe: `Tom configurado nas configurações: "${configurado}". Esse valor não é reconhecido pelo montador do prompt do seed, que só entende ${TONS_RECONHECIDOS.map(
        (t) => `"${t}"`,
      ).join(', ')}, e o bloco vivo do perfil não está neste prompt (interruptor "perfilVivo" desligado). A produção caiu no tom amigável, então o agente responde num tom que ninguém escolheu.`,
    };
  }

  // Primeira linha não vazia do bloco: é o cabeçalho do tom, curto e único.
  const trecho = getToneInstructions(tom).split('\n').find((l) => l.trim()) || '';
  const ok = Boolean(trecho) && prompt.includes(trecho);
  return {
    id: 'tom_no_prompt',
    rotulo: ROTULO_TOM,
    ok,
    detalhe: `Tom configurado nas configurações: "${tom}". Trecho procurado no prompt: "${trecho.trim()}".${
      ok ? '' : ' Não encontrado: o agente está respondendo com outro tom.'
    }`,
  };
}

function checarHorario(prompt: string, settings: Record<string, any>): ChecagemXray {
  const { esperados, domingoAbre, domingoTexto } = horariosCadastrados(settings);
  const promptFechaDomingo = /Domingo:\s*Fechado/i.test(prompt);

  if (domingoAbre && promptFechaDomingo) {
    return {
      id: 'horario_confere',
      rotulo: 'O horário de funcionamento confere com o cadastro',
      ok: false,
      detalhe: `O prompt afirma "Domingo: Fechado", mas o cadastro diz que domingo abre: "${domingoTexto}". A IA vai recusar atendimento num dia em que o negócio está aberto.`,
    };
  }

  if (esperados.length === 0) {
    return {
      id: 'horario_confere',
      rotulo: 'O horário de funcionamento confere com o cadastro',
      ok: true,
      detalhe: 'Nenhum horário cadastrado nas configurações, então não há o que conferir no prompt.',
    };
  }

  const encontrado = esperados.find((e) => prompt.includes(e));
  if (encontrado) {
    return {
      id: 'horario_confere',
      rotulo: 'O horário de funcionamento confere com o cadastro',
      ok: true,
      detalhe: `Horário cadastrado encontrado no prompt: "${encontrado}".`,
    };
  }

  // Caminho do perfil vivo (A8): o bloco montado no turno NORMALIZA o texto
  // do cadastro ("11:30-23:00" vira "11:30 às 23:00", os dias iguais viram
  // uma faixa só). Procurar apenas o texto cru pintava de vermelho justamente
  // a organização em que o horário chegou certo à IA. Aqui procuramos também
  // o texto que o bloco vivo escreve, com o MESMO normalizador dele.
  const textoVivo = normalizarHorario(settings).texto;
  if (textoVivo && prompt.includes(textoVivo)) {
    return {
      id: 'horario_confere',
      rotulo: 'O horário de funcionamento confere com o cadastro',
      ok: true,
      detalhe: `Horário encontrado no prompt pelo texto do bloco vivo: "${recorte(textoVivo, 200)}". O cadastro guarda o mesmo horário em outro formato (${esperados
        .map((e) => `"${e}"`)
        .join(', ')}).`,
    };
  }

  return {
    id: 'horario_confere',
    rotulo: 'O horário de funcionamento confere com o cadastro',
    ok: false,
    detalhe: `Nenhum dos horários cadastrados aparece no prompt. Trechos procurados: ${esperados
      .map((e) => `"${e}"`)
      .join(', ')}${
      textoVivo ? `, e também o texto do bloco vivo "${recorte(textoVivo, 200)}"` : ''
    }.`,
  };
}

function checarSaudacao(prompt: string, settings: Record<string, any>): ChecagemXray {
  const saudacao = texto(settings.greetingMessage);
  if (!saudacao) {
    return {
      id: 'saudacao_no_primeiro_contato',
      rotulo: 'A saudação cadastrada entra no primeiro contato',
      ok: true,
      detalhe: 'Nenhuma saudação cadastrada nas configurações, então não há o que procurar no prompt.',
    };
  }
  const ok = prompt.includes(saudacao);
  return {
    id: 'saudacao_no_primeiro_contato',
    rotulo: 'A saudação cadastrada entra no primeiro contato',
    ok,
    detalhe: `Trecho procurado no prompt: "${recorte(saudacao)}".${
      ok ? '' : ' Não encontrado: a IA abre a conversa com a frase padrão, não com a do cliente.'
    }`,
  };
}

function checarLinkDoSite(prompt: string, settings: Record<string, any>): ChecagemXray {
  const bruto = texto(identidadeEmpresa(settings).ide_site_url);
  const url = normalizeUrl(bruto);
  if (!url) {
    return {
      id: 'link_do_site',
      rotulo: 'O link do site cadastrado está no prompt',
      ok: true,
      detalhe: bruto
        ? `Nenhum site válido cadastrado no questionário (valor gravado: "${recorte(bruto, 60)}").`
        : 'Nenhum site cadastrado no questionário, então não há link para procurar no prompt.',
    };
  }
  const ok = prompt.includes(url);
  return {
    id: 'link_do_site',
    rotulo: 'O link do site cadastrado está no prompt',
    ok,
    detalhe: `Trecho procurado no prompt: "${url}".${
      ok ? '' : ' Não encontrado: a IA não tem para onde mandar o cliente na hora da conversão.'
    }`,
  };
}

function checarBaseConsultada(sources: FonteRecuperada[]): ChecagemXray {
  const ok = sources.length > 0;
  return {
    id: 'base_consultada',
    rotulo: 'A base de conhecimento foi consultada neste turno',
    ok,
    detalhe: ok
      ? `${sources.length} fonte(s) recuperada(s): ${sources.map((s) => s.source).join(', ')}.`
      : 'Nenhuma fonte recuperada. Neste turno a IA respondeu sem nada do treinamento do cliente.',
  };
}

function checarQaLiteral(
  sources: FonteRecuperada[],
  ultimaMensagem: string,
  qaAtivos: QaAtivo[],
): ChecagemXray {
  const alvo = normalizar(ultimaMensagem);
  const par = alvo ? qaAtivos.find((q) => normalizar(q.question) === alvo) : undefined;
  if (!par) {
    return {
      id: 'qa_literal',
      rotulo: 'Pergunta idêntica a um Q&A traz aquele Q&A',
      ok: true,
      detalhe: 'A última mensagem não é igual à pergunta de nenhum Q&A ativo, então não há o que exigir da busca.',
    };
  }
  const esperado = `qa-${par.id}.txt`;
  const ok = sources.some((s) => s.source === esperado);
  return {
    id: 'qa_literal',
    rotulo: 'Pergunta idêntica a um Q&A traz aquele Q&A',
    ok,
    detalhe: `A mensagem é igual ao Q&A "${recorte(par.question, 80)}". Fonte esperada entre as recuperadas: "${esperado}".${
      ok ? '' : ' Não veio: a resposta fixa que o cliente cadastrou não chegou à IA.'
    }`,
  };
}

function checarPrecoNaBase(
  settings: Record<string, any>,
  sources: FonteRecuperada[],
  ultimaMensagem: string,
  qaAtivos: QaAtivo[],
): ChecagemXray {
  const perguntaPreco = /pre[çc]o|quanto custa|valor/i.test(ultimaMensagem);
  if (!perguntaPreco) {
    return {
      id: 'preco_na_base',
      rotulo: 'Pergunta de preço traz a fonte de preço',
      ok: true,
      detalhe: 'A última mensagem não pergunta preço (não contém "preço", "quanto custa" nem "valor").',
    };
  }

  const tabela = texto(identidadeEmpresa(settings).pre_tabela_precos);
  const veioQuestionario = sources.some((s) => s.source.startsWith(PREFIXO_QUESTIONARIO));
  const idsDeQaDePreco = qaAtivos
    .filter((q) => normalizar(q.question).includes('preco'))
    .map((q) => `qa-${q.id}.txt`);
  const veioQaDePreco = sources.some((s) => idsDeQaDePreco.includes(s.source));

  const ok = (veioQuestionario && Boolean(tabela)) || veioQaDePreco;
  const motivo = veioQuestionario && !tabela
    ? ' O questionário voltou na busca, mas o campo "pre_tabela_precos" está em branco: não há preço na base.'
    : '';

  return {
    id: 'preco_na_base',
    rotulo: 'Pergunta de preço traz a fonte de preço',
    ok,
    detalhe: `Fontes aceitas: o documento do questionário ("${PREFIXO_QUESTIONARIO}*.txt" com a tabela de preços preenchida) ou um Q&A cuja pergunta contenha "preço"${
      idsDeQaDePreco.length ? ` (${idsDeQaDePreco.join(', ')})` : ''
    }. Fontes recuperadas: ${sources.length ? sources.map((s) => s.source).join(', ') : 'nenhuma'}.${motivo}`,
  };
}

function checarSaudacaoContraCr3(settings: Record<string, any>): ChecagemXray {
  const saudacao = texto(settings.greetingMessage);
  if (!saudacao) {
    return {
      id: 'saudacao_contradiz_cr3',
      rotulo: 'A saudação cadastrada não contraria o CR-3 do CORE',
      ok: true,
      detalhe: 'Nenhuma saudação cadastrada nas configurações, então não há contradição possível.',
    };
  }
  const normalizada = normalizar(saudacao);
  const proibida = FRASES_PROIBIDAS_CR3.find((f) => normalizada.includes(f));
  return {
    id: 'saudacao_contradiz_cr3',
    rotulo: 'A saudação cadastrada não contraria o CR-3 do CORE',
    ok: !proibida,
    detalhe: proibida
      ? `A saudação contém "${proibida}", que o CR-3 das regras base proíbe. O modelo recebe duas ordens opostas no mesmo prompt e obedece uma delas por sorte.`
      : `Frases procuradas na saudação (proibidas pelo CR-3): ${FRASES_PROIBIDAS_CR3.map((f) => `"${f}"`).join(', ')}. Nenhuma encontrada.`,
  };
}
