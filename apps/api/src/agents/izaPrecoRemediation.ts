/* ══════════════════════════════════════════════════════════════════════
 * Remediação: tira o preço congelado do prompt da Iza.
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
 * handoff, de tom). Regenerar apagaria esse trabalho. Aqui sai só o
 * NÚMERO; a regra de COMO falar de preço fica inteira.
 *
 * Por que tirar o valor em reais do prompt INTEIRO, e não só da REGRA 7:
 * a prova de que a migração funcionou é `system_prompt LIKE '%997%'` = 0.
 * Preço congelado em qualquer parágrafo é a mesma doença; deixar um
 * sobrevivente seria repetir o achado com outro número.
 * ══════════════════════════════════════════════════════════════════════ */

/** Uma linha que É a tabela de planos. O `**Planos**` é o que a delimita. */
const LINHA_DE_TABELA_DE_PLANOS = /^[ \t]*\*\*Planos\*\*.*$/gm;

/**
 * O que entra no lugar da tabela: um ponteiro para a seção gerada do
 * catálogo, que o `izaFactsService` injeta antes deste prompt a cada turno.
 */
const PONTEIRO_DA_TABELA =
  '**Preços**: a lista de planos, cotas, desconto anual e add-ons está na seção PRICING do bloco "# FATOS ATUAIS DA PLATAFORMA", que chega com este prompt a cada turno e vem do catálogo oficial. Use SÓ o que estiver lá. Se o valor não estiver lá, diga que vai confirmar com o time.';

/** Qualquer valor em reais escrito no prompt. */
const VALOR_EM_REAIS = /R\$\s*[0-9][0-9.]*(?:,[0-9]+)?/g;

/**
 * O que entra no lugar de cada valor solto. Sem dígito, para não criar drift
 * novo, e entre colchetes para a frase continuar legível: "o Scale a [preço
 * vigente, ver a seção PRICING] cobre com folga".
 */
const PONTEIRO_DO_VALOR = '[preço vigente, ver a seção PRICING]';

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

export interface ResultadoRemocaoPrecos {
  /** Prompt já sem preço congelado. */
  prompt: string;
  /** Houve alguma mudança? false = prompt já estava limpo. */
  mudou: boolean;
  /** Linhas de tabela de planos que saíram (para o diff e a auditoria). */
  linhasDePlanoRemovidas: string[];
  /** Cada valor em reais que virou ponteiro (para o diff e a auditoria). */
  valoresEmReaisSubstituidos: string[];
}

/**
 * Tira do prompt a tabela de planos e todo valor em reais, mantendo as
 * regras de como falar de preço.
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
  let prompt = original.replace(LINHA_DE_TABELA_DE_PLANOS, () => PONTEIRO_DA_TABELA);

  const valoresEmReaisSubstituidos = prompt.match(VALOR_EM_REAIS) ?? [];
  prompt = prompt.replace(VALOR_EM_REAIS, () => PONTEIRO_DO_VALOR);

  return {
    prompt,
    mudou: prompt !== original,
    linhasDePlanoRemovidas: linhasDePlanoRemovidas.map((l) => l.trim()),
    valoresEmReaisSubstituidos,
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
 *   4. sobrou valor em reais no resultado.
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

  const sobraram = resultado.match(VALOR_EM_REAIS) ?? [];
  if (sobraram.length > 0) {
    motivos.push(
      `Sobrou valor em reais no resultado: ${sobraram.slice(0, 5).join(', ')} (${sobraram.length} ocorrência(s)).`,
    );
  }

  return { ok: motivos.length === 0, motivos };
}

/**
 * Nomes de plano que já apareceram no catálogo da ZappIQ, vivos ou mortos.
 * Serve só para caçar número encostado num nome de plano; não é fonte de
 * preço nenhum.
 */
const NOMES_DE_PLANO_CONHECIDOS = ['Lite', 'Starter', 'Growth', 'Scale', 'Business', 'Enterprise'];

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
 * NÃO bloqueiam a gravação de propósito: "Scale 80.000 mensagens" cai aqui e
 * é cota legítima. O lugar disto é o dry-run, na frente de quem revisa.
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
