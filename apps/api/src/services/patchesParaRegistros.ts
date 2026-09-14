/* ══════════════════════════════════════════════════════════════════════
 * patchesParaRegistros: tira do prompt vivo o que foi colado nele e
 * transforma em registro de regra.
 * --------------------------------------------------------------------
 * O produto colou correção dentro de agents.system_prompt por dois
 * caminhos, e os dois deixaram rastro que ainda está lá:
 *
 *   • "# PATCH MANUAL AAAA-MM-DD HH:MM (cenário: X)" no fim do prompt,
 *     quando nenhum cabeçalho casou com a heurística (A079). É o caso de
 *     TODO prompt de cliente: a Marcia tem quatro.
 *   • "**REGRA INVIOLÁVEL #N (título)...**" solto no meio do texto, com
 *     numeração do modelo (A043: cinco "#14" e três "#13" na Iza).
 *
 * Três decisões que este módulo fixa, e que o teste protege:
 *
 *   1. Bloco TRUNCADO nunca vira regra ativa. Metade das sugestões saía
 *     cortada em 600 caracteres (A188) e cinco fragmentos estão vivos nos
 *     prompts hoje. Não dá para adivinhar o fim da frase: o fragmento sai do
 *     prompt, entra como 'substituida' com motivo 'truncada' e aparece no
 *     relatório para o dono decidir se quer reescrever a regra. A régua tem
 *     DUAS condições, porque cada uma sozinha deixa passar um corte real:
 *     pontuação final e aspas fechadas (ver `aspasFechadas`).
 *   1b. O nome fictício do teste ("Rod") vira "[nome]" (A172). Doze
 *     correções com esse nome já estão coladas nos prompts vivos.
 *   2. Dois patches do MESMO cenário viram UMA regra ativa: a mais recente
 *     não truncada. As outras viram histórico (A081).
 *   3. Nada é gravado se o prompt resultante perder "## IDENTIDADE",
 *     encolher demais ou ainda ter bloco de patch. Mesma régua de recusa do
 *     removerTabelaDePrecosDaIza.
 *
 * Módulo PURO: nada aqui toca banco. O CLI fica em
 * scripts/migrarPatchesParaRegistros.ts.
 * ══════════════════════════════════════════════════════════════════════ */

import { regraTerminaEmFraseCompleta } from './agentPromptPatcher.js';
import { limparTextoDaRegra } from '../agents/regrasDoAgente.js';

/** De onde, no texto, o bloco foi arrancado. */
export type OrigemNoTexto = 'patch_manual' | 'regra_inviolavel';

export interface BlocoDePatch {
  origemNoTexto: OrigemNoTexto;
  /** A linha de cabeçalho encontrada, para o relatório. */
  titulo: string;
  /** O corpo da regra, já sem prefixo de diff e sem numeração do modelo. */
  texto: string;
  /** Cenário lido do cabeçalho, quando o cabeçalho traz um. */
  scenarioId: string | null;
  /** "AAAA-MM-DD HH:MM" do cabeçalho do patch, quando existe. */
  carimbo: string | null;
  /** O texto para no meio da frase? (A188) */
  truncada: boolean;
}

export interface ExtracaoDePatches {
  blocos: BlocoDePatch[];
  /** O prompt sem nenhum dos blocos. */
  promptLimpo: string;
}

const MARCADOR_PATCH = '# PATCH MANUAL';

/** Junta linhas, tira espaço à toa e normaliza linhas em branco repetidas. */
function arrumar(texto: string): string {
  return texto
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * As aspas do texto estão todas fechadas?
 *
 * Esta é a segunda metade da régua do A188, e ela existe por causa de um
 * fragmento que está VIVO no prompt da Marcia. A régua antiga
 * (`regraTerminaEmFraseCompleta`) olha só o último caractere, e o corte do
 * sugeridor caiu logo depois do "?" de uma frase que abria aspas:
 *
 *   pergunte com esta frase exata: "Como posso te chamar?
 *
 * Termina em "?", então passava por frase inteira e virava regra ATIVA. A
 * aspa aberta é a prova de que o texto continuava.
 *
 * Contagem PAR, não casamento de pares: aspa curva de abertura e de
 * fechamento entram no mesmo balde porque o modelo mistura as duas formas na
 * mesma sugestão, e exigir a ordem certa daria falso positivo em texto
 * legítimo. Ímpar é que é sinal de corte.
 */
export function aspasFechadas(texto: string): boolean {
  const t = String(texto ?? '');
  const simples = (t.match(/'/g) ?? []).length;
  const duplas = (t.match(/["“”]/g) ?? []).length;
  return simples % 2 === 0 && duplas % 2 === 0;
}

/**
 * A regra está inteira? Pontuação final E aspas fechadas.
 *
 * As duas condições, porque cada uma sozinha deixa passar um corte real:
 * a pontuação não vê a aspa aberta, e a aspa não vê o corte no meio da
 * palavra ("...me co").
 */
function blocoTruncado(texto: string): boolean {
  return !regraTerminaEmFraseCompleta(texto) || !aspasFechadas(texto);
}

/**
 * O nome fictício do teste vira marcador (A172).
 *
 * O cenário do gabarito simula um contato chamado Rod. O sugeridor não era
 * proibido de usar o dado do teste, então 44% das sugestões traziam "Oi,
 * Rod!" como exemplo, doze foram aplicadas e hoje o prompt da Iza e o da
 * Marcia ensinam o agente a saudar "Rod". Levar isso para o registro seria
 * carimbar o defeito.
 *
 * Só a palavra inteira e só com R maiúsculo: "Rodrigo", "Rodoviária" e
 * "rodada" continuam intactos.
 */
function trocarNomeDoMock(texto: string): string {
  return String(texto ?? '').replace(/\bRod\b/g, '[nome]');
}

/**
 * Arranca do prompt os blocos de correção e devolve o resto.
 *
 * Os "# PATCH MANUAL" saem primeiro: uma regra inviolável que esteja DENTRO
 * de um bloco desses já viaja com ele, e não pode ser contada duas vezes.
 */
export function extrairPatches(prompt: string): ExtracaoDePatches {
  const original = String(prompt ?? '');
  const linhas = original.split('\n');

  const blocos: BlocoDePatch[] = [];
  const sobra: string[] = [];

  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (!linha.startsWith(MARCADOR_PATCH)) {
      sobra.push(linha);
      i++;
      continue;
    }

    // Cabeçalho do patch: lê cenário e carimbo, quando existem.
    const cenario = linha.match(/\(cen[áa]rio:\s*([^)]+)\)/i)?.[1]?.trim() ?? null;
    const carimbo = linha.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2})/)?.[1] ?? null;

    const corpo: string[] = [];
    i++;
    while (i < linhas.length && !/^#{1,3}\s/.test(linhas[i])) {
      corpo.push(linhas[i]);
      i++;
    }

    const texto = trocarNomeDoMock(limparTextoDaRegra(arrumar(corpo.join('\n'))));
    if (texto) {
      blocos.push({
        origemNoTexto: 'patch_manual',
        titulo: linha.trim(),
        texto,
        scenarioId: cenario,
        carimbo: carimbo ? carimbo.replace('T', ' ') : null,
        truncada: blocoTruncado(texto),
      });
    }
  }

  // Segunda passada: regras inviolávéis soltas no que sobrou.
  const restante = sobra.join('\n');
  const paragrafos = restante.split(/\n\s*\n/);
  const guardados: string[] = [];
  for (const p of paragrafos) {
    const ehRegraSolta = /^\s*\*{0,2}\s*REGRA\s+INVIOL[ÁA]VEL/iu.test(p);
    if (!ehRegraSolta) {
      guardados.push(p);
      continue;
    }
    const texto = trocarNomeDoMock(limparTextoDaRegra(arrumar(p)));
    if (!texto) continue;
    blocos.push({
      origemNoTexto: 'regra_inviolavel',
      titulo: p.trim().split('\n')[0].slice(0, 120),
      texto,
      scenarioId: null,
      carimbo: null,
      truncada: blocoTruncado(texto),
    });
  }

  return { blocos, promptLimpo: arrumar(guardados.join('\n\n')) + '\n' };
}

export interface RegistroPlanejado extends BlocoDePatch {
  status: 'ativa' | 'substituida';
  /** 'substituida_por_nova' | 'truncada' | null (quando ativa). */
  motivo: string | null;
}

/** Ordena por carimbo (mais novo por último); sem carimbo, mantém a ordem. */
function ordemDeAplicacao(blocos: BlocoDePatch[]): BlocoDePatch[] {
  return blocos
    .map((b, posicao) => ({ b, posicao }))
    .sort((x, y) => {
      const cx = x.b.carimbo ?? '';
      const cy = y.b.carimbo ?? '';
      if (cx && cy && cx !== cy) return cx < cy ? -1 : 1;
      return x.posicao - y.posicao;
    })
    .map((x) => x.b);
}

/**
 * Decide o status de cada bloco.
 *
 * Por cenário, a ATIVA é a mais recente NÃO TRUNCADA. Truncada nunca fica
 * ativa, mesmo quando é a mais recente: o cliente aprovou um texto inteiro e
 * recebeu meio, então o que está gravado não é a decisão dele. Um cenário
 * pode terminar a migração sem regra ativa, e é o resultado certo: a regra
 * volta a ser oferecida na próxima execução, inteira.
 *
 * Blocos sem cenário (regra solta) não substituem ninguém: cada um vira um
 * registro próprio.
 */
export function planejarRegistros(blocos: BlocoDePatch[]): RegistroPlanejado[] {
  const porCenario = new Map<string, BlocoDePatch[]>();
  const semCenario: BlocoDePatch[] = [];

  for (const b of blocos) {
    if (!b.scenarioId) {
      semCenario.push(b);
      continue;
    }
    const lista = porCenario.get(b.scenarioId) ?? [];
    lista.push(b);
    porCenario.set(b.scenarioId, lista);
  }

  const plano: RegistroPlanejado[] = [];

  for (const [, lista] of porCenario) {
    const ordenada = ordemDeAplicacao(lista);
    const inteiras = ordenada.filter((b) => !b.truncada);
    const vencedora = inteiras.length > 0 ? inteiras[inteiras.length - 1] : null;
    for (const b of ordenada) {
      if (b === vencedora) {
        plano.push({ ...b, status: 'ativa', motivo: null });
      } else {
        plano.push({
          ...b,
          status: 'substituida',
          motivo: b.truncada ? 'truncada' : 'substituida_por_nova',
        });
      }
    }
  }

  for (const b of semCenario) {
    plano.push({
      ...b,
      status: b.truncada ? 'substituida' : 'ativa',
      motivo: b.truncada ? 'truncada' : null,
    });
  }

  return plano;
}

/**
 * Quantos CARACTERES o texto tem, no mesmo sentido do `length()` do Postgres:
 * pontos de código, e não unidades UTF-16.
 *
 * Rodada 3 do PR #375. O `.length` do JS conta cada emoji como 2 (par
 * substituto), e o Postgres conta 1. O prompt da Marcia tem 3 caracteres
 * astrais: o banco dizia 6288 e o script imprimia 6291. A 4a prova do
 * roteiro compara os dois números e manda ROLLBACK em qualquer divergência,
 * então o operador desfaria uma gravação correta.
 *
 * O `wc -c` do terminal conta BYTES e dá ainda mais, por causa dos acentos.
 */
export function contarCaracteres(texto: string): number {
  return [...String(texto ?? '')].length;
}

export interface Validacao {
  ok: boolean;
  motivos: string[];
}

/**
 * Proporção mínima do original quando ninguém disse o que foi removido.
 *
 * É a rede grossa, para a chamada sem a lista de blocos. A rede fina é a
 * conta abaixo: o prompt limpo tem de ter o tamanho do original MENOS os
 * blocos que saíram. Um prompt que é 70% patch encolhe muito e está certo;
 * o que encolhe sem bloco que explique é que está errado.
 */
const PISO_DE_TAMANHO = 0.4;

/** Folga para as quebras de linha e os espaços que a limpeza normaliza. */
const FOLGA = 0.05;

/**
 * Recusa gravar um prompt que saiu estragado da limpeza.
 *
 * Mesma régua do removerTabelaDePrecosDaIza: a migração prefere não rodar a
 * rodar errado, porque quem paga por um prompt mutilado é o cliente final na
 * conversa seguinte.
 */
export function validarPromptLimpo(
  antes: string,
  depois: string,
  blocos: BlocoDePatch[] = [],
): Validacao {
  const motivos: string[] = [];
  const a = String(antes ?? '');
  const d = String(depois ?? '');

  if (a.includes('## IDENTIDADE') && !d.includes('## IDENTIDADE')) {
    motivos.push('o prompt resultante perdeu a seção ## IDENTIDADE');
  }

  if (blocos.length > 0) {
    const removido = blocos.reduce((soma, b) => soma + b.titulo.length + b.texto.length + 2, 0);
    const minimo = Math.max(0, a.length - removido - Math.ceil(a.length * FOLGA) - 40);
    if (d.length < minimo) {
      motivos.push(
        `o prompt encolheu mais do que os blocos removidos explicam (${a.length} para ` +
          `${d.length} caracteres, e os ${blocos.length} blocos somam ${removido})`,
      );
    }
  } else if (a.length > 0 && d.length < a.length * PISO_DE_TAMANHO) {
    motivos.push(
      `o prompt encolheu demais (${a.length} para ${d.length} caracteres, abaixo de ` +
        `${Math.round(PISO_DE_TAMANHO * 100)}% do original)`,
    );
  }
  if (d.includes(MARCADOR_PATCH)) {
    motivos.push('ainda sobrou um bloco "# PATCH MANUAL" no prompt resultante');
  }
  if (d.trim().length === 0) {
    motivos.push('o prompt resultante ficou vazio');
  }

  return { ok: motivos.length === 0, motivos };
}

/* ── CLI do script: os argumentos, decididos ANTES de tocar no banco ── */

/**
 * O que o script vai fazer.
 *
 * Rodada 4 do PR #375: a leitura dos argumentos era feita dentro do `main`
 * do script, e dois caminhos perigosos passavam por ela. `--help` caía no
 * modo com banco (com DATABASE_URL no ambiente, rodava DRY-RUN em todos os
 * agentes) e `--apply` sem `--agent` gravava em TODOS os agentes com patch
 * colado. Aqui a decisão é pura e testada; o script só obedece.
 */
export type ComandoDaMigracao =
  | { modo: 'ajuda' }
  | { modo: 'offline'; entrada: string; saida: string }
  | { modo: 'banco'; aplicar: boolean; agentId?: string }
  | { modo: 'recusado'; motivo: string };

/** Texto do `--help`. Sem travessão: vai para o terminal de quem opera. */
export const USO_DA_MIGRACAO = [
  'Uso (DATABASE_URL vem do AMBIENTE, nunca como argumento):',
  '',
  '  # modo OFFLINE, sem banco: lê um arquivo e escreve o prompt limpo',
  '  npx tsx scripts/migrarPatchesParaRegistros.ts --in prompt.txt --out limpo.txt',
  '',
  '  # modo com banco, só olhando (todos os agentes, ou um só com --agent)',
  '  npx tsx scripts/migrarPatchesParaRegistros.ts --dry-run [--agent <id>]',
  '',
  '  # gravando: limpa o prompt por publishPrompt e cria os registros.',
  '  # Um agente por vez: --apply sem --agent é recusado.',
  '  npx tsx scripts/migrarPatchesParaRegistros.ts --apply --agent <id>',
  '',
  '  --help, -h   mostra este texto e sai sem tocar no banco',
].join('\n');

const ARGUMENTOS_SOLTOS = new Set(['--help', '-h', '--dry-run', '--apply']);
const ARGUMENTOS_COM_VALOR = new Set(['--agent', '--in', '--out']);

/** Lê os argumentos do script. Pura: não lê ambiente, não abre arquivo, não conecta. */
export function lerArgumentosDaMigracao(argv: readonly string[]): ComandoDaMigracao {
  const args = [...(argv ?? [])];

  // Pedir ajuda nunca grava nem lê o banco, seja qual for o resto da linha.
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { modo: 'ajuda' };
  }

  const valores: Record<string, string> = {};
  const soltos = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (ARGUMENTOS_SOLTOS.has(a)) {
      soltos.add(a);
      continue;
    }
    if (ARGUMENTOS_COM_VALOR.has(a)) {
      const valor = args[i + 1];
      if (!valor || valor.startsWith('-')) {
        return { modo: 'recusado', motivo: `${a} precisa de um valor logo depois dele.` };
      }
      valores[a] = valor;
      i++;
      continue;
    }
    return {
      modo: 'recusado',
      motivo: `argumento desconhecido: ${a}. Nada foi feito.`,
    };
  }

  const temIn = '--in' in valores;
  const temOut = '--out' in valores;
  if (temIn || temOut) {
    if (!temIn || !temOut) {
      return { modo: 'recusado', motivo: 'o modo offline precisa de --in e --out juntos.' };
    }
    if (soltos.has('--apply') || soltos.has('--dry-run') || '--agent' in valores) {
      return {
        modo: 'recusado',
        motivo: 'o modo offline (--in/--out) não se mistura com --dry-run, --apply ou --agent.',
      };
    }
    return { modo: 'offline', entrada: valores['--in'], saida: valores['--out'] };
  }

  const aplicar = soltos.has('--apply');
  if (aplicar && soltos.has('--dry-run')) {
    return { modo: 'recusado', motivo: 'escolha --dry-run OU --apply, não os dois.' };
  }
  if (!aplicar && !soltos.has('--dry-run')) {
    // Só --agent, sem dizer o modo: conservador, não adivinha.
    return { modo: 'recusado', motivo: 'diga o modo: --dry-run (só olha) ou --apply (grava).' };
  }

  const agentId = valores['--agent'];
  if (aplicar && !agentId) {
    return {
      modo: 'recusado',
      motivo:
        '--apply exige --agent <id>. Gravar em todos os agentes de uma vez não é permitido: ' +
        'rode o --dry-run, escolha o agente e aplique um por vez.',
    };
  }

  return agentId ? { modo: 'banco', aplicar, agentId } : { modo: 'banco', aplicar };
}
