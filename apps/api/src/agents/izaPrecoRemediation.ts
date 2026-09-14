/* ══════════════════════════════════════════════════════════════════════
 * Remediação: tira o preço MORTO do prompt da Iza.
 * --------------------------------------------------------------------
 * Achado A229. O `agents.system_prompt` da org da ZappIQ foi editado à mão
 * em 16/06/2026 e ficou com uma tabela de planos do Pricing V3: Starter
 * R$ 197, Growth R$ 497, Scale R$ 997, Business R$ 1.997, mais o exemplo
 * de fala "o Scale a R$ 997 cobre com folga". Desde 27/05 o Scale custa
 * R$ 1.497, Starter e Business estão descontinuados e o plano de entrada é
 * o Lite. O prompt vendia preço velho para lead novo.
 *
 * A correção tem dois lados. O outro lado (izaFactsService) passou a gerar
 * a seção PRICING do catálogo em runtime. Este aqui limpa o que já está
 * gravado no banco, porque prompt gravado não se regenera sozinho.
 *
 * Cirúrgica de propósito, nunca regenerar: o prompt da Iza tem ~27 mil
 * caracteres de patch acumulado (few-shot de verticais bloqueadas, de
 * handoff, de tom). Regenerar apagaria esse trabalho.
 *
 * ── RODADA 2 (14/09/2026) ────────────────────────────────────────────
 * A rodada 1 apagava TODO valor em reais. Rodar isso sobre o prompt REAL
 * mostrou três danos e uma trava furada:
 *
 *   1. `R$ 0,0197/msg` virava `[preço vigente, ver a seção PRICING]97/msg`.
 *      A expressão aceitava no máximo duas casas decimais e cortava o valor
 *      no meio. Agora aceita até quatro.
 *
 *   2. Os preços VIGENTES do add-on de voz (R$ 79,90 a R$ 929,90 e os seis
 *      overages por minuto) morriam junto com os mortos. A Iza ficava sem
 *      como cotar Voice 400 a 4000 às vésperas do treinamento do CMJ, onde
 *      ela é a vitrine. Agora só vira ponteiro o valor que NÃO existe no
 *      catálogo vigente. A comparação é por NÚMERO, então "R$ 929,90" e
 *      "929,90" são o mesmo valor.
 *
 *   3. As regras de FORMATO de preço ("Valores SEMPRE em formato de moeda
 *      completo (ex: ...)") perdiam o exemplo numérico e viravam regra sem
 *      demonstração. Numa linha que ENSINA formato, o valor morto vira um
 *      valor VIGENTE do catálogo, não o ponteiro.
 *
 *   4. A trava recusava o prompt real por `| >4.000 | Enterprise |`, que são
 *      minutos de voz. Os minutos das faixas de voz passaram a sair do
 *      catálogo, como já saíam as cotas dos planos, e a trava passou a
 *      aceitar número com a unidade escrita junto.
 *
 * MORTO VENCE VIVO: um valor que é preço de plano DESCONTINUADO vira
 * ponteiro mesmo que o mesmo número exista noutro canto do catálogo. É o
 * caso do 197: preço do Starter (morto) e também do Impulso Start (vivo).
 * Na dúvida some, porque foi exatamente "Starter R$ 197" que abriu o A229.
 * ══════════════════════════════════════════════════════════════════════ */

import {
  PLAN_IDS,
  PLAN_CONFIG,
  ADDONS,
  ADDONS_V4_LIST,
  VOICE_ADDON_META,
  listActivePlans,
  listLegacyPlans,
  planAnnualMonthlyEquivalent,
} from '@zappiq/shared';

/** Uma linha que É a tabela de planos. O `**Planos**` é o que a delimita. */
const LINHA_DE_TABELA_DE_PLANOS = /^[ \t]*\*\*Planos\*\*.*$/gm;

/**
 * O que entra no lugar da tabela: um ponteiro para a seção gerada do
 * catálogo, que o `izaFactsService` injeta antes deste prompt a cada turno.
 */
const PONTEIRO_DA_TABELA =
  '**Preços**: a lista de planos, cotas, desconto anual e add-ons está na seção PRICING do bloco "# FATOS ATUAIS DA PLATAFORMA", que chega com este prompt a cada turno e vem do catálogo oficial. Use SÓ o que estiver lá. Se o valor não estiver lá, diga que vai confirmar com o time.';

/**
 * Qualquer valor em reais escrito no prompt.
 *
 * O `[0-9.]*` de antes era guloso e comia o ponto final da frase: "R$ 997."
 * saía inteiro, ponto incluído, e a frase perdia a pontuação ao virar
 * ponteiro. Agora o separador de milhar só conta quando vem seguido de três
 * dígitos, então "R$ 997." casa "R$ 997" e devolve o ponto à frase.
 *
 * Os centavos aceitam de uma a QUATRO casas. Duas não bastavam: o prompt real
 * traz `R$ 0,0197/msg` (o preço por mensagem derivado do pacote), e parar na
 * segunda casa deixava `[preço vigente, ver a seção PRICING]97/msg` no texto.
 */
const VALOR_EM_REAIS = /R\$\s*[0-9]+(?:\.[0-9]{3})*(?:,[0-9]{1,4})?/g;

/**
 * O que entra no lugar de cada valor MORTO. Sem dígito, para não criar drift
 * novo, e entre colchetes para a frase continuar legível: "o Scale a [preço
 * vigente, ver a seção PRICING] cobre com folga".
 */
export const PONTEIRO_DO_VALOR = '[preço vigente, ver a seção PRICING]';

/**
 * Linha que ENSINA como escrever preço, em vez de vender um preço.
 *
 * O número ali é ilustração de formato ("moeda completa, nunca por extenso").
 * Trocar por ponteiro deixa a regra sem demonstração, que foi o que a rodada 1
 * fez com a REGRA INVIOLÁVEL #20 e com a regra de áudio. Nestas linhas o valor
 * morto vira um valor VIGENTE do catálogo, no mesmo formato.
 */
const LINHA_QUE_ENSINA_FORMATO_DE_PRECO = /formato de moeda|por extenso/i;

/**
 * Marcadores que provam que o prompt continua sendo o prompt da Iza.
 *
 * São vários porque o prompt da Iza é manual e não passa pelo template do
 * `promptEngine`: ele começa com o próprio cabeçalho, não com
 * `## IDENTIDADE`. A validação não escolhe um: ela exige que TODOS os que
 * existiam antes continuem existindo depois.
 */
export const MARCADORES_DE_IDENTIDADE = [
  '## IDENTIDADE',
  '# IDENTIDADE',
  '# Iza',
  'Você é a **Iza**',
  'Você é **Iza**',
  'Você é a Iza',
];

/** Piso de tamanho: abaixo disso a transformação comeu conteúdo, não preço. */
export const PISO_DE_TAMANHO = 0.6;

export const MOTIVO_IDENTIDADE = 'marcador de identidade';
export const MOTIVO_TAMANHO = 'encolheu abaixo de 60%';
export const MOTIVO_NUMERO_PERTO_DE_PLANO = 'número sem "R$" encostado em nome de plano';
export const MOTIVO_VALOR_MORTO = 'valor em reais que não existe no catálogo vigente';

/**
 * Nomes de plano que já apareceram no catálogo da ZappIQ, vivos ou mortos.
 * Serve só para caçar número encostado num nome de plano; não é fonte de
 * preço nenhum.
 */
const NOMES_DE_PLANO_CONHECIDOS = ['Lite', 'Starter', 'Growth', 'Scale', 'Business', 'Enterprise'];

/** Quantos caracteres separam o número do nome do plano para contar como "perto". */
export const DISTANCIA_MAXIMA_DO_PLANO = 40;

/** Quantos caracteres depois do número ainda contam como "a unidade dele". */
export const DISTANCIA_MAXIMA_DA_UNIDADE = 20;

/**
 * Um número inteiro escrito à moda brasileira, com ou sem separador de
 * milhar: "997", "1.497", "1497", "80.000", "997,00".
 */
const NUMERO_NO_TEXTO = /(?:[0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)(?:,[0-9]{1,2})?/g;

/**
 * Unidade escrita junto do número. Quem escreve "4.000 minutos" está falando
 * de quantidade, não de mensalidade.
 *
 * "/mês" NÃO entra nesta lista de propósito, embora o enunciado da tarefa a
 * cite: "/mês" gruda tanto em quantidade quanto em dinheiro, e aceitá-la
 * deixaria passar exatamente o caso que a trava existe para pegar, o preço
 * velho escrito sem cifrão ("Scale: 997/mês"). Escolha conservadora.
 */
const UNIDADE_DEPOIS_DO_NUMERO =
  /(\bminutos?\b|\bmin\b|\bmsgs?\b|\bmensage(m|ns)\b|\bcontatos?\b|\bdisparos?\b|\bdocumentos?\b|\bdias?\b|\bmil\b|%)/i;

/** Ano tem quatro dígitos e vem depois de "em", "desde", "revisado" ou "/". */
const ANO_NO_TEXTO = /^(19|20)[0-9]{2}$/;
const ANTES_DE_ANO = /(\bem\b|\bdesde\b|\brevisado\b|\/)\s*$/i;

/** Chave estável para comparar dinheiro sem sofrer com ponto flutuante. */
function chaveDeValor(v: number): string {
  return v.toFixed(4);
}

function acrescentar(set: Set<string>, v: unknown): void {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return;
  set.add(chaveDeValor(v));
}

/**
 * Todo preço que o catálogo comercial diz hoje: planos ativos (mensal e
 * equivalente anual), add-ons do catálogo antigo e do V4, faixas de voz e
 * overage por minuto de voz.
 *
 * Deriva do `planConfig` de propósito. Preço que mudar no catálogo passa a ser
 * preservado (ou removido) aqui no mesmo commit, sem lista digitada à mão.
 */
function precosVigentes(): Set<string> {
  const set = new Set<string>();

  for (const p of listActivePlans()) {
    acrescentar(set, p.priceMonthly);
    acrescentar(set, planAnnualMonthlyEquivalent(p));
  }
  for (const a of Object.values(ADDONS)) acrescentar(set, a.priceMonthly);
  for (const a of ADDONS_V4_LIST) acrescentar(set, a.amountBrl);
  for (const m of Object.values(VOICE_ADDON_META)) acrescentar(set, m.overagePerMinBrl);

  return set;
}

/**
 * Preço de plano DESCONTINUADO. Vence o vigente: o mesmo 197 é o Starter
 * (morto) e o Impulso Start (vivo), e foi "Starter R$ 197" que abriu o A229.
 *
 * Só planos entram aqui. As tabelas `VOICE_ADDON_LEGACY_V1_STRIPE_IDS` e
 * `VOICE_ADDON_DEPRECATED_STRIPE_IDS` ficam DE FORA porque colidem com preço
 * vivo (o V2 errado do Voice 1500 é R$ 79,90, que é o Voice 200 de hoje);
 * usá-las mataria a tabela de voz inteira.
 */
function precosMortos(): Set<string> {
  const set = new Set<string>();
  for (const p of listLegacyPlans()) {
    acrescentar(set, p.priceMonthly);
    acrescentar(set, planAnnualMonthlyEquivalent(p));
  }
  return set;
}

/** "R$ 1.497,00" e "R$ 0,0197" viram 1497 e 0.0197. */
export function valorEmReaisParaNumero(texto: string): number | null {
  const limpo = (texto ?? '').replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Este valor em reais é um preço que o catálogo diz HOJE? */
export function ehPrecoVigente(valor: number): boolean {
  const chave = chaveDeValor(valor);
  if (precosMortos().has(chave)) return false;
  return precosVigentes().has(chave);
}

/** Parte inteira de cada preço, nas duas grafias ("1497" e "1.497"). */
function inteirosDe(precos: Set<string>): Set<string> {
  const set = new Set<string>();
  for (const chave of precos) {
    const inteiro = Math.trunc(Number(chave));
    if (inteiro <= 0) continue;
    set.add(String(inteiro));
    set.add(inteiro.toLocaleString('pt-BR'));
  }
  return set;
}

/**
 * Números que o catálogo legitimamente escreve ao lado de um nome de plano:
 * cota de mensagens, de contatos, de disparos, de documentos, dias de trial e
 * os MINUTOS das faixas de voz.
 *
 * Os minutos entraram na rodada 2. Sem eles a trava recusava o prompt real por
 * `| >4.000 | Enterprise (sob consulta) |`, que é a linha da tabela de volume
 * de voz: 4.000 são minutos, não mensalidade.
 */
function cotasConhecidas(): Set<string> {
  const set = new Set<string>();
  const guarda = (n: unknown): void => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return;
    set.add(String(n));
    set.add(n.toLocaleString('pt-BR'));
  };
  for (const id of PLAN_IDS) {
    const p = PLAN_CONFIG[id];
    for (const limite of Object.values(p.limits)) guarda(limite);
    guarda(p.trialDays);
    guarda(p.annualDiscountPercent);
  }
  for (const m of Object.values(VOICE_ADDON_META)) {
    guarda(m.minutesIncluded);
    guarda(m.hardCeilingMinutes);
    guarda(m.trialMinutes);
    guarda(m.trialDays);
  }
  return set;
}

/**
 * Preço VIGENTE que serve de exemplo numa regra de formato: o do plano de
 * entrada (o mais barato entre os ativos com preço). Sai no mesmo desenho do
 * valor que ele substitui, com ou sem centavos.
 */
function exemploDePrecoVigente(original: string): string {
  const comPreco = listActivePlans()
    .map((p) => p.priceMonthly)
    .filter((v): v is number => typeof v === 'number' && v > 0)
    .sort((a, b) => a - b);

  // Catálogo sem nenhum plano com preço: não há exemplo honesto a dar.
  if (comPreco.length === 0) return PONTEIRO_DO_VALOR;

  const valor = comPreco[0];
  const temCentavos = original.includes(',');
  return temCentavos
    ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `R$ ${Math.trunc(valor).toLocaleString('pt-BR')}`;
}

/**
 * Números de 3 ou 4 dígitos que sobraram perto de um nome de plano.
 *
 * É a forma que a substituição de "R$ <valor>" não alcança: o preço velho
 * some de "R$ 997" e sobrevive em "Scale 997", em "997,00" e em "997/mês".
 * Aí a prova de produção (`system_prompt LIKE '%997%'` = 0) falharia sem
 * ninguém ver. Três e quatro dígitos porque é o tamanho de todo preço de
 * plano do catálogo; cinco dígitos em diante é cota, não mensalidade.
 *
 * A ordem das absolvições importa: cota do catálogo primeiro (é o número mais
 * comum e o mais inequívoco), preço de plano morto depois (esse nunca é
 * absolvido), e só então preço vigente e número com unidade escrita junto.
 */
export function numerosSuspeitosPertoDePlano(texto: string): string[] {
  const conteudo = texto ?? '';
  const cotas = cotasConhecidas();
  const vivos = inteirosDe(precosVigentes());
  const mortos = inteirosDe(precosMortos());
  const achados: string[] = [];

  NUMERO_NO_TEXTO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMERO_NO_TEXTO.exec(conteudo)) !== null) {
    const inteiro = m[0].split(',')[0];
    const digitos = inteiro.replace(/\./g, '');
    if (digitos.length < 3 || digitos.length > 4) continue;

    const fim = m.index + m[0].length;
    const ehCota = cotas.has(inteiro) || cotas.has(digitos);
    const ehMorto = mortos.has(inteiro) || mortos.has(digitos);
    const ehVivo = vivos.has(inteiro) || vivos.has(digitos);
    const temUnidade = UNIDADE_DEPOIS_DO_NUMERO.test(
      conteudo.slice(fim, fim + DISTANCIA_MAXIMA_DA_UNIDADE),
    );
    const ehAno =
      ANO_NO_TEXTO.test(digitos) &&
      ANTES_DE_ANO.test(conteudo.slice(Math.max(0, m.index - DISTANCIA_MAXIMA_DA_UNIDADE), m.index));

    if (ehCota) continue;
    if (!ehMorto && (ehVivo || temUnidade || ehAno)) continue;

    const ini = Math.max(0, m.index - DISTANCIA_MAXIMA_DO_PLANO);
    const janela = conteudo.slice(ini, fim + DISTANCIA_MAXIMA_DO_PLANO);
    const plano = NOMES_DE_PLANO_CONHECIDOS.find((nome) =>
      new RegExp(`\\b${nome}\\b`, 'i').test(janela),
    );
    if (plano) achados.push(`"${m[0]}" perto de "${plano}"`);
  }

  return achados;
}

export interface ResultadoRemocaoPrecos {
  /** Prompt já sem preço morto. */
  prompt: string;
  /** Houve alguma mudança? false = prompt já estava limpo. */
  mudou: boolean;
  /** Linhas de tabela de planos que saíram (para o diff e a auditoria). */
  linhasDePlanoRemovidas: string[];
  /** Cada valor em reais MORTO que saiu (para o diff e a auditoria). */
  valoresEmReaisSubstituidos: string[];
  /** Cada valor em reais VIGENTE que ficou (para o diff e a auditoria). */
  valoresEmReaisPreservados: string[];
}

/**
 * Tira do prompt a tabela de planos e todo valor em reais que o catálogo não
 * diz mais, mantendo as regras de como falar de preço e os valores vigentes.
 *
 * Função PURA: mesma entrada, mesma saída, sem banco e sem relógio. É a
 * mesma função usada pelo modo com banco e pelo modo offline do script, para
 * o que foi testado ser exatamente o que vai para produção.
 *
 * Idempotente: rodar de novo sobre a saída devolve `mudou: false`.
 */
export function removerTabelaDePrecos(promptOriginal: string): ResultadoRemocaoPrecos {
  const original = promptOriginal ?? '';

  const linhasDePlanoRemovidas = original.match(LINHA_DE_TABELA_DE_PLANOS) ?? [];
  const semTabela = original.replace(LINHA_DE_TABELA_DE_PLANOS, () => PONTEIRO_DA_TABELA);

  const valoresEmReaisSubstituidos: string[] = [];
  const valoresEmReaisPreservados: string[] = [];

  // Linha a linha porque a decisão de "trocar por ponteiro" ou "trocar por um
  // exemplo vigente" depende do que a LINHA está fazendo. Nenhum valor em
  // reais atravessa quebra de linha, então fatiar não muda o que casa.
  const prompt = semTabela
    .split('\n')
    .map((linha) => {
      const ensinaFormato = LINHA_QUE_ENSINA_FORMATO_DE_PRECO.test(linha);
      return linha.replace(VALOR_EM_REAIS, (achado) => {
        const valor = valorEmReaisParaNumero(achado);
        if (valor !== null && ehPrecoVigente(valor)) {
          valoresEmReaisPreservados.push(achado);
          return achado;
        }
        valoresEmReaisSubstituidos.push(achado);
        return ensinaFormato ? exemploDePrecoVigente(achado) : PONTEIRO_DO_VALOR;
      });
    })
    .join('\n');

  return {
    prompt,
    mudou: prompt !== original,
    linhasDePlanoRemovidas: linhasDePlanoRemovidas.map((l) => l.trim()),
    valoresEmReaisSubstituidos,
    valoresEmReaisPreservados,
  };
}

export interface ValidacaoPrompt {
  ok: boolean;
  motivos: string[];
}

/**
 * A trava antes de gravar. Recusa quando:
 *   1. o prompt original não tem marcador de identidade nenhum (fail-closed:
 *      sem âncora não dá para provar que nada essencial sumiu);
 *   2. algum marcador que existia antes sumiu depois;
 *   3. o resultado ficou com menos de 60% do tamanho do original;
 *   4. sobrou valor em reais que o catálogo não diz mais (preço vigente PODE
 *      ficar: é a rodada 2, e é o que mantém a Iza capaz de cotar voz);
 *   5. sobrou número de 3 ou 4 dígitos perto de um nome de plano, que é o
 *      preço velho escrito sem cifrão ("Scale 997", "997,00", "997/mês").
 */
export function validarPromptResultante(antes: string, depois: string): ValidacaoPrompt {
  const motivos: string[] = [];
  const original = antes ?? '';
  const resultado = depois ?? '';

  const presentesAntes = MARCADORES_DE_IDENTIDADE.filter((m) => original.includes(m));
  if (presentesAntes.length === 0) {
    motivos.push(
      `O prompt original não tem nenhum ${MOTIVO_IDENTIDADE} conhecido, então não dá para provar que a identidade sobreviveu. Nada será gravado.`,
    );
  }
  for (const m of presentesAntes) {
    if (!resultado.includes(m)) {
      motivos.push(`O resultado perdeu o ${MOTIVO_IDENTIDADE} "${m}".`);
    }
  }

  if (original.length > 0 && resultado.length < original.length * PISO_DE_TAMANHO) {
    motivos.push(
      `O prompt ${MOTIVO_TAMANHO} do original (${resultado.length} de ${original.length} caracteres).`,
    );
  }

  const sobraram = (resultado.match(VALOR_EM_REAIS) ?? []).filter((v) => {
    const n = valorEmReaisParaNumero(v);
    return n === null || !ehPrecoVigente(n);
  });
  if (sobraram.length > 0) {
    motivos.push(
      `Sobrou ${MOTIVO_VALOR_MORTO}: ${sobraram.slice(0, 5).join(', ')} (${sobraram.length} ocorrência(s)).`,
    );
  }

  const suspeitos = numerosSuspeitosPertoDePlano(resultado);
  if (suspeitos.length > 0) {
    motivos.push(
      `Sobrou ${MOTIVO_NUMERO_PERTO_DE_PLANO}: ${suspeitos.slice(0, 5).join('; ')} (${suspeitos.length} ocorrência(s)). Cota do catálogo e preço vigente passam sozinhos. Se for outra quantidade, escreva a unidade junto ("4.000 minutos"); se for preço de plano descontinuado ou preço que saiu do catálogo, tire na mão.`,
    );
  }

  return { ok: motivos.length === 0, motivos };
}

/**
 * Números que sobraram SEM o "R$" na frente.
 *
 * Existem duas formas, e a segunda é a perigosa:
 *   1. um preço do catálogo escrito solto ("o plano sai por 1.497");
 *   2. um número QUALQUER encostado no nome de um plano ("o Scale 997").
 *
 * A forma 2 é o buraco que a substituição de "R$ <valor>" não fecha: o preço
 * velho some de "R$ 997" e sobrevive em "Scale 997", e aí a prova de produção
 * (`system_prompt LIKE '%997%'` = 0) falharia sem ninguém ver.
 *
 * Esta é a lente LARGA, e ela só avisa: "Scale 80.000 mensagens" cai aqui e é
 * cota legítima. O lugar disto é o dry-run, na frente de quem revisa. Quem
 * BLOQUEIA a gravação é `numerosSuspeitosPertoDePlano`, dentro de
 * `validarPromptResultante`, e só na forma de preço (3 ou 4 dígitos, fora das
 * cotas e dos preços vigentes do catálogo).
 */
export function avisosDeNumeroSolto(prompt: string, precos: number[]): string[] {
  const avisos: string[] = [];
  const texto = prompt ?? '';

  for (const preco of precos) {
    const comPonto = preco.toLocaleString('pt-BR');
    for (const forma of new Set([String(preco), comPonto])) {
      if (texto.includes(forma)) {
        avisos.push(`Ainda aparece o número "${forma}" sem "R$" na frente. Confira se é preço.`);
      }
    }
  }

  for (const plano of NOMES_DE_PLANO_CONHECIDOS) {
    const re = new RegExp(`\\b${plano}\\b[^\\n]{0,14}?([0-9][0-9.,]*)`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      avisos.push(
        `O nome "${plano}" aparece colado no número "${m[1]}". Se for preço velho escrito sem "R$", tire na mão antes de gravar.`,
      );
    }
  }

  return avisos;
}
