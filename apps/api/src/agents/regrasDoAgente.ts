/* ══════════════════════════════════════════════════════════════════════
 * regrasDoAgente: a correção aprovada pelo dono como REGISTRO, não como
 * texto colado dentro do prompt.
 * --------------------------------------------------------------------
 * O sintoma que o fundador relatou é sempre o mesmo: ele aprova a correção
 * e o erro volta na execução seguinte. A causa está no lugar onde a
 * correção morava.
 *
 *   A079  O patcher escolhia ONDE colar por heurística. "REGRA 13" foi
 *         parar dentro do bloco da REGRA 1 oito vezes no prompt da Iza. Em
 *         prompt de cliente nenhum cabeçalho casa e tudo virava
 *         "# PATCH MANUAL" no fim, um por aplicação.
 *   A081  A trava era por execução, não por cenário: toda semana dava para
 *         colar outra versão da mesma regra. A Iza foi de 16.302 para
 *         26.898 caracteres em 30 aplicações.
 *   A043  O sugeridor via 2.000 caracteres do prompt e NUNCA o CORE, então
 *         numerava por conta própria (cinco "#14", três "#13").
 *   A078  Sem ver o CORE, ele propôs o oposto dele: "sugira o plano anual
 *         com 20% de desconto" contra "NUNCA dê desconto >10%".
 *   A217  E propôs proibir a frase que o próprio gabarito exige.
 *
 * Este módulo é PURO de propósito: montagem do bloco, resumo do CORE e
 * verificação de conflito não tocam banco, rede nem modelo. O acesso ao
 * banco fica em services/agentRulesService.ts.
 *
 * O bloco entra no prompt atrás do interruptor `regrasComoRegistros`.
 * Desligado, nada daqui aparece e o caminho do patch continua igual.
 * ══════════════════════════════════════════════════════════════════════ */

import { CORE_AGENT_RULES_V1 } from './coreAgentRules.js';

/** Cabeçalho do bloco montado no prompt. Lugar fixo, nome em português. */
export const TITULO_BLOCO_DE_REGRAS = '# Regras aprovadas pelo dono';

/**
 * Teto de regras ativas por agente (A081).
 *
 * Não é um número mágico de conforto: a Iza chegou a 30 correções aplicadas
 * e 26.898 caracteres de prompt. Passar disso é sinal de que o problema não
 * é de regra, e sim de conhecimento faltando ou de regras para consolidar.
 * A tela avisa antes; a rota recusa depois.
 */
export const TETO_DE_REGRAS_ATIVAS = 25;

/** Origem de uma regra, como o dono a vê na tela. */
export type OrigemDaRegra = 'sugestao_ia' | 'editada' | 'manual';

/** Status de uma regra. Só 'ativa' entra no prompt. */
export type StatusDaRegra = 'ativa' | 'substituida' | 'revertida';

/** O mínimo que o montador do prompt precisa saber de uma regra. */
export interface RegraDoAgente {
  id: string;
  scenarioId: string | null;
  texto: string;
  origem: OrigemDaRegra;
}

/* ── Limpeza do texto ────────────────────────────────────────────── */

/**
 * Deixa a regra no formato que entra no prompt.
 *
 * Tira o que era ruído de transporte: o prefixo de diff ("+ ", "> ") que o
 * sugeridor emite e a numeração que ele inventa. Quem numera agora é o
 * servidor, na hora de montar o bloco, então "REGRA INVIOLÁVEL #14" some e
 * o título da regra fica.
 *
 * O CORPO da regra atravessa verbatim. Reescrever o que o dono aprovou
 * seria mudar o comportamento dele sem ele saber.
 */
export function limparTextoDaRegra(texto: string): string {
  const semPrefixoDeDiff = String(texto ?? '')
    .split('\n')
    .map((linha) => {
      if (linha.startsWith('+ ')) return linha.slice(2);
      if (linha.startsWith('> ')) return linha.slice(2);
      return linha;
    })
    .join('\n')
    .trim();

  // "**REGRA INVIOLÁVEL #14 - TÍTULO:** corpo" vira "**TÍTULO:** corpo".
  // "REGRA INVIOLÁVEL #3 - corpo" vira "corpo".
  //
  // Exige INVIOLÁVEL ou um NÚMERO depois de "REGRA", senão a limpeza comeria
  // o começo de qualquer frase que abra com a palavra "regra".
  const semNumeracao = semPrefixoDeDiff.replace(
    /^(\*{0,2})\s*REGRA\s*(?:INVIOL[ÁA]VEL\s*(?:#\s*\d+)?|#\s*\d+|\d+)\s*(?:[—–\-:]\s*)?/iu,
    (_todo, asteriscos: string) => (asteriscos ? asteriscos : ''),
  );

  // Linhas em branco repetidas viram uma só: o bloco é uma lista, não um
  // documento.
  return semNumeracao.replace(/\n{3,}/g, '\n\n').trim();
}

/* ── Montagem do bloco ───────────────────────────────────────────── */

/**
 * Monta o bloco "# Regras aprovadas pelo dono" a partir das regras ativas.
 *
 * Devolve string vazia quando não há regra: o `.filter(Boolean)` do
 * montador do prompt descarta, e o prompt fica idêntico ao de antes.
 *
 * A numeração é do servidor e sempre sequencial (A043). O aviso de
 * precedência existe por causa do A078: a correção aprovada ajusta o
 * comportamento do agente, não revoga a regra base da plataforma.
 */
export function montarBlocoDeRegras(regras: RegraDoAgente[]): string {
  const ativas = (regras ?? []).filter((r) => String(r?.texto ?? '').trim().length > 0);
  if (ativas.length === 0) return '';

  // Passou do teto: ficam as MAIS RECENTES. A lista chega em ordem de
  // criação, então cortamos pela frente.
  //
  // O corte e o teto da rota contam a mesma coisa: regras ATIVAS DAQUELE
  // AGENTE. Era o descasamento apontado na revisão, e ele sumiu quando os
  // dois montadores de prompt passaram a carregar por agentId (PI-3). Se um
  // dia a lista voltar a chegar por organização, este corte volta a mentir:
  // a rota deixaria aprovar a 25a regra do agente e o bloco mostraria só as
  // 25 mais recentes da empresa inteira.
  const noTeto =
    ativas.length > TETO_DE_REGRAS_ATIVAS ? ativas.slice(-TETO_DE_REGRAS_ATIVAS) : ativas;

  const itens = noTeto.map((r, i) => `${i + 1}. ${limparTextoDaRegra(r.texto)}`);

  return [
    TITULO_BLOCO_DE_REGRAS,
    'Correções aprovadas pelo dono do negócio. Valem sobre o texto acima e não',
    'substituem as REGRAS BASE DO AGENTE, que continuam prevalecendo.',
    '',
    ...itens,
  ].join('\n');
}

/* ── Resumo do CORE para o sugeridor (A043, A078) ────────────────── */

/**
 * Resumo curto das REGRAS BASE DO AGENTE, derivado do próprio texto do CORE.
 *
 * Derivado, e não escrito à mão, porque uma cópia manual envelhece: mudar o
 * coreAgentRules.ts e esquecer o resumo devolveria o defeito A078 pela porta
 * dos fundos. Aqui o resumo acompanha a fonte.
 */
export function resumirCoreParaSugeridor(core: string = CORE_AGENT_RULES_V1): string {
  const LIMITE_POR_REGRA = 4;
  const LIMITE_DA_LINHA = 170;
  const saida: string[] = [];
  let dentroDeUmaRegra = false;
  let coletadas = 0;

  for (const linhaCrua of String(core ?? '').split('\n')) {
    const linha = linhaCrua.trim();

    const cabecalho = linha.match(/^##\s+(CR-\d+.*)$/);
    if (cabecalho) {
      saida.push(`- ${cabecalho[1].replace(/\*/g, '').trim()}`);
      dentroDeUmaRegra = true;
      coletadas = 0;
      continue;
    }
    if (/^#\s/.test(linha)) {
      // Cabeçalho de nível 1 encerra o bloco das CR (o "FIM DAS CORE RULES").
      dentroDeUmaRegra = false;
      continue;
    }
    if (!dentroDeUmaRegra || coletadas >= LIMITE_POR_REGRA || !linha) continue;

    const ehMarcador = /^[-•*]\s*|^[❌✅⚠]/u.test(linha);
    const ehImperativa = /\b(NUNCA|SEMPRE|IMEDIATAMENTE|OBRIGATORI|PROIBID)/u.test(linha);
    if (!ehMarcador && !ehImperativa) continue;

    const limpa = linha
      .replace(/^[-•*]\s*/u, '')
      .replace(/[`*]/g, '')
      .trim()
      .slice(0, LIMITE_DA_LINHA);
    if (limpa.length < 3) continue;
    saida.push(`  ${limpa}`);
    coletadas++;
  }

  return saida.join('\n');
}

/** Lista as regras já ativas para o sugeridor fortalecer em vez de duplicar. */
export function resumirRegrasParaSugeridor(regras: RegraDoAgente[]): string {
  const ativas = (regras ?? []).filter((r) => String(r?.texto ?? '').trim().length > 0);
  if (ativas.length === 0) {
    return 'Nenhuma regra aprovada ainda para este agente.';
  }
  return ativas
    .map((r) => `- [${r.scenarioId ?? 'sem cenário'}] ${limparTextoDaRegra(r.texto).slice(0, 300)}`)
    .join('\n');
}

/* ── Verificação de conflito (A078, A217) ────────────────────────── */

export type TipoDeConflito =
  | 'desconto_acima_do_teto'
  | 'nome_em_toda_mensagem'
  | 'nome_nunca_perguntado'
  | 'idioma_fora_do_portugues'
  | 'parceria_oficial_inventada'
  | 'dado_sensivel'
  | 'contradiz_o_gabarito'
  | 'contradiz_regra_ativa';

export interface Conflito {
  tipo: TipoDeConflito;
  /** Frase em português que vai para a tela do dono. */
  explicacao: string;
  /** O pedaço do texto que causou a recusa, quando existe. */
  trecho?: string;
}

/** Minúsculas, sem acento: comparação de texto sem depender de digitação. */
function normalizar(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quebra em frases: a negação só vale dentro da frase em que aparece. */
function frases(texto: string): string[] {
  return normalizar(texto)
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

const NEGACOES = /\b(nunca|jamais|nao|proibid[oa]|evite|sem autorizacao|sem aprovacao)\b/;

/**
 * O CR-7 não proíbe desconto grande: proíbe desconto grande SEM aprovação.
 * Uma regra que já fala em aprovação está dentro da exceção que a própria
 * regra base prevê, e recusá-la seria falso positivo.
 */
const RESSALVA_DE_APROVACAO = /\b(aprovacao|aprovad[oa]|autorizacao|autorizad[oa]|gerente|dono|diretor)\b/;

/** Teto de desconto do CR-7, em porcentagem. */
const TETO_DE_DESCONTO = 10;

function conflitoDeDesconto(texto: string): Conflito | null {
  for (const frase of frases(texto)) {
    if (!frase.includes('desconto')) continue;
    const negada = NEGACOES.test(frase) || RESSALVA_DE_APROVACAO.test(frase);

    // (a) percentual acima do teto na mesma frase do desconto.
    for (const m of frase.matchAll(/(\d{1,3})\s*%/g)) {
      const valor = Number(m[1]);
      if (valor > TETO_DE_DESCONTO && !negada) {
        return {
          tipo: 'desconto_acima_do_teto',
          explicacao:
            `Esta correção manda oferecer ${valor}% de desconto, e a regra base do agente ` +
            `(CR-7) proíbe passar de ${TETO_DE_DESCONTO}% sem aprovação. Com as duas no ar, o agente fica ` +
            'dividido e o erro volta. Ajuste o percentual ou registre a aprovação do desconto maior.',
          trecho: m[0],
        };
      }
    }

    // (b) ordem genérica de sempre dar desconto, sem teto declarado.
    //
    // O verbo tem de ser inequívoco. "de" solto não entra na lista: a
    // normalização tira o acento, então "dê" e "de" ficam iguais, e
    // "sempre informe o valor DE tabela e o DESCONTO vigente" viraria
    // recusa. A forma "dê desconto" é aceita só colada ao substantivo.
    if (
      !negada &&
      /\b(sempre|obrigatoriamente)\b[^.]{0,60}(\b(ofereca|conceda|garanta|libere|aplique)\b[^.]{0,30}desconto|\bde\s+(um\s+|o\s+)?desconto)/.test(
        frase,
      )
    ) {
      return {
        tipo: 'desconto_acima_do_teto',
        explicacao:
          'Esta correção manda sempre oferecer desconto, sem teto. A regra base do agente ' +
          `(CR-7) só permite desconto até ${TETO_DE_DESCONTO}% sem aprovação. Diga qual é o desconto ` +
          'permitido e em que caso ele vale.',
        trecho: frase.slice(0, 120),
      };
    }
  }
  return null;
}

function conflitoDeNome(texto: string): Conflito | null {
  const universalNaFrase = (f: string) =>
    f.includes('nome') &&
    (/\bem (todas as|toda) (mensagens|mensagem|respostas|resposta|falas|fala)\b/.test(f) ||
      /\b100% (das|de) (mensagens|respostas)\b/.test(f) ||
      /\bsempre repita o nome\b/.test(f) ||
      /\bem cada (mensagem|resposta)\b/.test(f));

  // A negação vale dentro da frase: "NÃO use o nome em todas as mensagens"
  // é justamente o que o CR-6 pede, e não pode virar recusa.
  const conflitante = frases(texto).some((f) => universalNaFrase(f) && !NEGACOES.test(f));
  if (!conflitante) return null;
  return {
    tipo: 'nome_em_toda_mensagem',
    explicacao:
      'Esta correção manda usar o nome do cliente em todas as mensagens, e a regra base do ' +
      'agente (CR-6) pede o nome em 30-40% das mensagens, não em todas. Repetir o nome a cada ' +
      'frase soa robótico e é justamente o que a regra base evita. Peça o nome na saudação e ' +
      'em momentos-chave.',
    trecho: texto.slice(0, 120),
  };
}

/* ── Família nova: proibir a pergunta do nome (CR-5) ──────────────── */

/**
 * O CR-5 não manda perguntar o nome sempre: manda perguntar UMA vez quando
 * não se sabe, e NUNCA perguntar de novo depois. As duas metades cabem numa
 * regra do dono, e só a primeira é conflito.
 *
 * Esta ressalva separa "nunca pergunte o nome" (contradiz o CR-5) de "não
 * pergunte o nome de novo" (é o que o CR-5 exige, e está escrito assim no
 * prompt de cliente hoje). Sem ela, a família recusaria a regra certa.
 */
const RESSALVA_DE_REPETICAO =
  /\b(de novo|novamente|outra vez|duas vezes|repetidamente|ja (informado|informou|registrado|fornecido|disse|deu)|ja tiver|ja estiver|ja foi|se ja|toda (mensagem|resposta))\b/;

/** "nunca/não" + verbo de pedir + "nome", tudo na mesma frase. */
const PROIBE_PERGUNTAR_NOME =
  /\b(nunca|jamais|nao|proibido)\b[^.]{0,40}\b(pergunt|peca|solicit)[^.]{0,20}\bnome\b/;

function conflitoDeNomeNuncaPerguntado(texto: string): Conflito | null {
  for (const frase of frases(texto)) {
    if (!PROIBE_PERGUNTAR_NOME.test(frase)) continue;
    if (RESSALVA_DE_REPETICAO.test(frase)) continue;
    return {
      tipo: 'nome_nunca_perguntado',
      explicacao:
        'Esta correção proíbe o agente de perguntar o nome do cliente, e a regra base do agente ' +
        '(CR-5) manda perguntar uma vez, no primeiro contato, quando o nome ainda não é ' +
        'conhecido. Com as duas no ar, o agente fica dividido e o erro volta. Se o que você quer ' +
        'é que ele não repita a pergunta, escreva "não pergunte o nome de novo quando o cliente ' +
        'já tiver informado".',
      trecho: frase.slice(0, 120),
    };
  }
  return null;
}

/* ── Família nova: responder fora do português (CR-6) ─────────────── */

const RESPONDER_EM_OUTRO_IDIOMA = /\bresponda\b[^.]{0,30}\b(ingles|espanhol|frances)\b/;

function conflitoDeIdioma(texto: string): Conflito | null {
  for (const frase of frases(texto)) {
    // "NUNCA responda em inglês" é o oposto: reforça o CR-6, não o contraria.
    if (NEGACOES.test(frase)) continue;
    if (!RESPONDER_EM_OUTRO_IDIOMA.test(frase)) continue;
    return {
      tipo: 'idioma_fora_do_portugues',
      explicacao:
        'Esta correção manda o agente responder em outro idioma, e a regra base do agente ' +
        '(CR-6) fixa português do Brasil em todo atendimento. Com as duas no ar, o agente troca ' +
        'de idioma no meio da conversa. Se você atende em outro idioma de verdade, isso é ' +
        'configuração do agente, não correção de um caso de teste: fale com o suporte.',
      trecho: frase.slice(0, 120),
    };
  }
  return null;
}

/* ── Família nova: parceria oficial inventada (CR-7) ──────────────── */

const ALEGA_PARCERIA_OFICIAL =
  /\b(parceir[oa]s?|representantes?|revend[a-zç]*|certificad[oa]s?|autorizad[oa]s?)\s+oficia(l|is)\b/;

function conflitoDeParceriaOficial(texto: string): Conflito | null {
  for (const frase of frases(texto)) {
    // "NUNCA diga que somos parceiros oficiais" é o reforço do CR-7.
    if (NEGACOES.test(frase)) continue;
    if (!ALEGA_PARCERIA_OFICIAL.test(frase)) continue;
    return {
      tipo: 'parceria_oficial_inventada',
      explicacao:
        'Esta correção manda o agente afirmar uma parceria ou certificação oficial, e a regra ' +
        'base do agente (CR-7) proíbe inventar condição comercial. Se a parceria existe mesmo, o ' +
        'lugar dela é a base de conhecimento do agente, com a fonte: aí ele responde com ' +
        'segurança e a informação vale para todos os canais.',
      trecho: frase.slice(0, 120),
    };
  }
  return null;
}

const TERMOS_SENSIVEIS = [
  'cpf',
  'rg ',
  'cartao de credito',
  'numero do cartao',
  'senha',
  'token',
  'otp',
  'dados bancarios',
  'conta bancaria',
];

function conflitoDeDadoSensivel(texto: string): Conflito | null {
  for (const frase of frases(texto)) {
    if (NEGACOES.test(frase)) continue;
    const termo = TERMOS_SENSIVEIS.find((t) => frase.includes(t));
    if (!termo) continue;
    // Só imperativo: é o agente sendo MANDADO a pedir. "Se o cliente pedir
    // para trocar a senha" tem "pedir" e "senha" na mesma frase, e quem
    // pede ali é o cliente.
    if (!/\b(peca|solicite|pergunte|exija|colete)\b/.test(frase)) continue;
    return {
      tipo: 'dado_sensivel',
      explicacao:
        'Esta correção manda o agente pedir um dado sensível pelo WhatsApp, e a regra base do ' +
        'agente (CR-8) proíbe. Para pagamento, use link de checkout seguro; para cadastro, peça ' +
        'e-mail, CNPJ ou nome da empresa.',
      trecho: termo.trim(),
    };
  }
  return null;
}

/**
 * Frases que a regra manda o agente NÃO dizer.
 *
 * Só o que está entre aspas conta: é o formato que o próprio sugeridor
 * emite ("Exemplo INCORRETO: '...'"), e comparar frase solta daria falso
 * positivo em qualquer texto longo.
 */
export function frasesProibidasPelaRegra(texto: string): string[] {
  const achadas: string[] = [];
  const t = String(texto ?? '');
  const marcadores =
    /(nunca\s+(?:diga|fale|mencione|use|responda)|n[ãa]o\s+(?:diga|fale|mencione|use)|proibido\s+(?:dizer|falar|mencionar)|exemplo\s+incorreto\s*:)/giu;
  let m: RegExpExecArray | null;
  while ((m = marcadores.exec(t)) !== null) {
    const resto = t.slice(m.index + m[0].length, m.index + m[0].length + 400);
    for (const aspas of resto.matchAll(/["“'’']([^"”'’]{12,200})["”'’]/gu)) {
      achadas.push(aspas[1].trim());
    }
  }
  return achadas;
}

function conflitoComGabarito(texto: string, expectedBehavior?: string | null): Conflito | null {
  const esperado = normalizar(expectedBehavior ?? '');
  if (!esperado) return null;
  for (const frase of frasesProibidasPelaRegra(texto)) {
    const alvo = normalizar(frase);
    if (alvo.length < 12) continue;
    if (esperado.includes(alvo)) {
      return {
        tipo: 'contradiz_o_gabarito',
        explicacao:
          `Esta correção proíbe dizer "${frase}", e é exatamente isso que o teste deste cenário ` +
          'espera que o agente responda. Com as duas no ar, o cenário reprova de qualquer jeito. ' +
          'Reescreva a correção sem proibir a resposta certa.',
        trecho: frase,
      };
    }
  }
  return null;
}

/**
 * Extrai pares (polaridade, predicado) de um texto de regra.
 *
 * "SEMPRE mencione tecnologia proprietária" vira { sempre, 'mencione
 * tecnologia proprietaria' }. É deterministicamente burro de propósito:
 * só pega o que vem depois do advérbio, até a pontuação.
 */
function clausulas(texto: string): Array<{ polaridade: 'sempre' | 'nunca'; predicado: string }> {
  const out: Array<{ polaridade: 'sempre' | 'nunca'; predicado: string }> = [];
  for (const frase of frases(texto)) {
    const m = frase.match(/\b(sempre|obrigatoriamente|nunca|jamais)\b\s+([^.,;!?]{10,160})/);
    if (!m) continue;
    const polaridade = m[1] === 'nunca' || m[1] === 'jamais' ? 'nunca' : 'sempre';
    out.push({ polaridade, predicado: m[2].trim() });
  }
  return out;
}

/**
 * O predicado de uma regra bate com o da outra?
 *
 * Duas réguas, as duas conservadoras: contenção (uma frase inteira dentro da
 * outra) ou o mesmo começo. O caso real da Iza é o segundo: "mencione
 * tecnologia proprietária ao cliente" contra "mencione tecnologia proprietária
 * quando perguntarem do sistema" só coincide no começo.
 */
function mesmoAssunto(a: string, b: string): boolean {
  if (a.length < 12 || b.length < 12) return false;
  const menor = a.length <= b.length ? a : b;
  const maior = a.length <= b.length ? b : a;
  if (maior.includes(menor)) return true;

  const ta = a.split(' ');
  const tb = b.split(' ');
  let iguais = 0;
  while (iguais < ta.length && iguais < tb.length && ta[iguais] === tb[iguais]) iguais++;
  const comeco = ta.slice(0, iguais).join(' ');
  return iguais >= 3 && comeco.length >= 12;
}

function conflitoComRegraAtiva(
  texto: string,
  regrasAtivas: RegraDoAgente[],
  cenarioDaRegraNova?: string | null,
): Conflito | null {
  const novas = clausulas(texto);
  if (novas.length === 0) return null;

  for (const regra of regrasAtivas) {
    // A regra do MESMO cenário não conflita: ela vai SUBSTITUIR esta.
    if (cenarioDaRegraNova && regra.scenarioId === cenarioDaRegraNova) continue;
    for (const antiga of clausulas(regra.texto)) {
      for (const nova of novas) {
        if (nova.polaridade === antiga.polaridade) continue;
        if (!mesmoAssunto(nova.predicado, antiga.predicado)) continue;
        return {
          tipo: 'contradiz_regra_ativa',
          explicacao:
            `Esta correção manda o contrário de uma regra que já está ativa no cenário ` +
            `"${regra.scenarioId ?? 'sem cenário'}". Com as duas no ar, o agente fica dividido e o ` +
            'erro volta. Desfaça a regra antiga ou reescreva esta.',
          trecho: antiga.predicado.slice(0, 120),
        };
      }
    }
  }
  return null;
}

export interface EntradaDaVerificacao {
  /** Texto da regra que o dono quer aplicar (já editado por ele, se editou). */
  texto: string;
  /** Comportamento esperado do cenário, quando a regra vem de um cenário. */
  expectedBehavior?: string | null;
  /** Regras já ativas neste agente. */
  regrasAtivas?: RegraDoAgente[];
  /** Cenário da regra nova: a do mesmo cenário substitui, não conflita. */
  cenarioDaRegraNova?: string | null;
}

/**
 * Verificador determinístico de conflito, rodado ANTES de gravar.
 *
 * Deliberadamente estreito: só contradição óbvia, do tipo que já está em
 * produção hoje. Um verificador ansioso barraria correção legítima, e o
 * dono deixaria de confiar na tela. Cada família tem guarda de negação,
 * porque "NUNCA dê mais de 20% de desconto" é o oposto de "dê 20%".
 *
 * Oito famílias, uma por regra base que as correções de produção
 * atropelaram: desconto acima do teto (CR-7), nome em toda mensagem (CR-6),
 * proibir a pergunta do nome (CR-5), responder fora do português (CR-6),
 * parceria oficial inventada (CR-7), dado sensível (CR-8), contradição com o
 * gabarito do cenário (A217) e contradição com regra já ativa (A078).
 */
export function detectarConflitos(entrada: EntradaDaVerificacao): Conflito[] {
  const texto = limparTextoDaRegra(entrada.texto ?? '');
  if (!texto) return [];

  const achados = [
    conflitoDeDesconto(texto),
    conflitoDeNome(texto),
    conflitoDeNomeNuncaPerguntado(texto),
    conflitoDeIdioma(texto),
    conflitoDeParceriaOficial(texto),
    conflitoDeDadoSensivel(texto),
    conflitoComGabarito(texto, entrada.expectedBehavior),
    conflitoComRegraAtiva(texto, entrada.regrasAtivas ?? [], entrada.cenarioDaRegraNova),
  ];

  return achados.filter((c): c is Conflito => c !== null);
}
