/**
 * C2 (Passo 5): a lista completa de cenários da execução, na linguagem do
 * dono do negócio.
 * ============================================================================
 * A244/A221: a tela listava só os reprovados e parciais, e cada cartão mostrava
 * só a última frase. O dono não via o que o agente acertou, nem o histórico
 * da conversa simulada, nem por que o avaliador decidiu.
 * A151: diagnóstico em inglês ("Judge error", "Scenario crashed") chegava ao
 * cliente. A088: a resposta aparecia com as tags <reply> dentro.
 * A055: "parcial" vale zero na nota, e nada explicava isso.
 * P21: reprovação de CONHECIMENTO por falta de informação vira "Cadastrar esta
 * informação", e o aviso de treino passa a dizer o que falta.
 *
 * Funções puras, testadas fora do componente.
 * ============================================================================
 */
import type { AcaoDeTreino, AgentEvalRunDetailScenario } from '@/lib/adminApi';
// Caminho relativo de propósito: o vitest do web não resolve o atalho '@/'.
import { linkParaCadastrarPergunta } from '../../../../../lib/perguntaPreenchida';

export type VereditoDoCenario = AgentEvalRunDetailScenario['combined'];

/** O veredito em uma palavra, em português. */
export function rotuloDoVeredito(combined: VereditoDoCenario): string {
  switch (combined) {
    case 'pass':
      return 'Aprovado';
    case 'partial':
      return 'Parcial';
    case 'fail':
      return 'Reprovado';
    case 'inconclusivo':
      return 'Inconclusivo';
    default:
      return 'Não avaliado';
  }
}

/** A055: por que "parcial" pesa como reprovação. Uma frase só, para a tela e a ajuda. */
export const EXPLICACAO_PARCIAL =
  'Parcial conta como não aprovado na nota: o cenário só soma quando a regra automática e o ' +
  'avaliador aprovam juntos.';

/**
 * A088: a resposta como o cliente final a leria. Execuções antigas gravaram a
 * saída crua do modelo, com o texto dobrado e as tags do protocolo.
 */
export function respostaParaExibir(texto: string | null | undefined): string {
  const cru = String(texto ?? '');
  const reply = cru.match(/<reply>([\s\S]*?)<\/reply>/i);
  const base = reply ? reply[1] : cru;
  return base
    .replace(/<action_data>[\s\S]*?<\/action_data>/gi, '')
    .replace(/<action>[\s\S]*?<\/action>/gi, '')
    .replace(/<buttons>[\s\S]*?<\/buttons>/gi, '')
    .replace(/<\/?(action|action_data|buttons|reply)\b[^>]*>/gi, '')
    .trim();
}

/** Diagnósticos técnicos em inglês que execuções antigas gravaram (A151). */
const DIAGNOSTICOS_TECNICOS: Array<[RegExp, string]> = [
  [/^Scenario crashed/i, 'O teste deste cenário não completou por uma falha técnica. Não é erro do seu agente.'],
  [/^Judge error/i, 'O avaliador não respondeu a tempo. Não é erro do seu agente.'],
  [/Judge response unparseable/i, 'O avaliador não devolveu um veredito legível. Não é erro do seu agente.'],
  [/all providers exhausted/i, 'Os provedores de IA estavam fora do ar durante o teste. Não é erro do seu agente.'],
];

/** O diagnóstico que o dono lê, sempre em português. */
export function diagnosticoLegivel(
  r: Pick<AgentEvalRunDetailScenario, 'combined' | 'judge' | 'falhaTecnica' | 'inconclusivo'>,
): string {
  if (r.combined === 'inconclusivo' && r.inconclusivo?.explicacao) return r.inconclusivo.explicacao;
  if (r.combined === 'erro' && r.falhaTecnica) return r.falhaTecnica;
  const motivo = String(r.judge?.reason ?? '').trim();
  for (const [padrao, texto] of DIAGNOSTICOS_TECNICOS) {
    if (padrao.test(motivo)) return texto;
  }
  return motivo || (r.combined === 'pass' ? 'Aprovado pelas duas checagens.' : 'Sem diagnóstico registrado.');
}

/** A ação de treino do cenário, quando a reprovação foi por falta de informação. */
export function acaoDeTreinoDo(r: Pick<AgentEvalRunDetailScenario, 'suggestedFix'>): AcaoDeTreino | null {
  return r.suggestedFix?.acaoDeTreino ?? null;
}

/**
 * O botão "Cadastrar esta informação" aparece? Só em cenário de CONHECIMENTO
 * que não passou, com ação de treino, e quando o teste USOU a base
 * (ragStatus 'ok'). Antes disso, a promessa de "cadastre e passa" seria falsa:
 * o agente testado nem via a base.
 */
export function podeCadastrarInformacao(
  r: Pick<AgentEvalRunDetailScenario, 'natureza' | 'combined' | 'ragStatus' | 'suggestedFix'>,
): boolean {
  if (r.natureza !== 'conhecimento') return false;
  if (r.combined !== 'fail' && r.combined !== 'partial') return false;
  if (r.ragStatus !== 'ok') return false;
  return acaoDeTreinoDo(r) !== null;
}

/** Para onde o botão leva: a pergunta pré-preenchida, ou o questionário. */
export function linkDaAcaoDeTreino(acao: AcaoDeTreino): string {
  if (acao.tipo === 'qa') return linkParaCadastrarPergunta(acao.pergunta);
  return '/ai-training#survey';
}

/** O rótulo curto do que falta, para o aviso "Faltam: ...". */
function rotuloDoQueFalta(acao: AcaoDeTreino): string {
  if (acao.tipo === 'questionario') return acao.rotulo ?? 'um campo do questionário';
  const p = acao.pergunta.trim();
  return `resposta para "${p.length > 60 ? `${p.slice(0, 59).trimEnd()}…` : p}"`;
}

/**
 * O aviso de treino ESPECÍFICO (P21): só existe quando há reprovação de
 * conhecimento por falta de informação, e diz o que falta. Devolve null
 * quando não há o que cadastrar: o aviso genérico antigo aparecia em toda
 * nota abaixo de 90, mesmo quando o problema era de conduta.
 */
export function textoDoAvisoDeTreino(
  results: Array<Pick<AgentEvalRunDetailScenario, 'natureza' | 'combined' | 'suggestedFix'>>,
): string | null {
  const faltam: string[] = [];
  for (const r of results ?? []) {
    if (r.natureza !== 'conhecimento') continue;
    if (r.combined !== 'fail' && r.combined !== 'partial') continue;
    const acao = acaoDeTreinoDo(r);
    if (!acao) continue;
    const rotulo = rotuloDoQueFalta(acao);
    if (!faltam.includes(rotulo)) faltam.push(rotulo);
  }
  if (faltam.length === 0) return null;
  const lista = faltam.length > 4 ? [...faltam.slice(0, 4), `mais ${faltam.length - 4}`] : faltam;
  return `Faltam: ${lista.join(', ')}.`;
}

/** Ordem da lista completa: primeiro o que pede ação, depois o resto. */
export function ordenarParaALista<T extends Pick<AgentEvalRunDetailScenario, 'combined' | 'severity'>>(
  results: T[],
): T[] {
  const peso: Record<string, number> = { fail: 0, partial: 1, inconclusivo: 2, erro: 3, pass: 4 };
  const sev: Record<string, number> = { critical: 0, high: 1, medium: 2 };
  return [...(results ?? [])].sort(
    (a, b) =>
      (peso[a.combined] ?? 5) - (peso[b.combined] ?? 5) || (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3),
  );
}
