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
 *   • "**REGRA INVIOLÁVEL #N — ...**" solto no meio do texto, com
 *     numeração do modelo (A043: cinco "#14" e três "#13" na Iza).
 *
 * Três decisões que este módulo fixa, e que o teste protege:
 *
 *   1. Bloco TRUNCADO nunca vira regra ativa. Metade das sugestões saía
 *     cortada em 600 caracteres (A188) e cinco fragmentos estão vivos nos
 *     prompts hoje. Não dá para adivinhar o fim da frase: o fragmento sai do
 *     prompt, entra como 'substituida' com motivo 'truncada' e aparece no
 *     relatório para o dono decidir se quer reescrever a regra.
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

    const texto = limparTextoDaRegra(arrumar(corpo.join('\n')));
    if (texto) {
      blocos.push({
        origemNoTexto: 'patch_manual',
        titulo: linha.trim(),
        texto,
        scenarioId: cenario,
        carimbo: carimbo ? carimbo.replace('T', ' ') : null,
        truncada: !regraTerminaEmFraseCompleta(texto),
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
    const texto = limparTextoDaRegra(arrumar(p));
    if (!texto) continue;
    blocos.push({
      origemNoTexto: 'regra_inviolavel',
      titulo: p.trim().split('\n')[0].slice(0, 120),
      texto,
      scenarioId: null,
      carimbo: null,
      truncada: !regraTerminaEmFraseCompleta(texto),
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
