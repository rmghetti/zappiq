/**
 * A171 — execução que não foi avaliada não vira nota na tela.
 * ============================================================================
 * Quando o provedor de IA derruba mais de 20% dos cenários, a API grava a
 * linha como 'failed' com um motivo específico, sem nota nenhuma. Sem esta
 * leitura, a tela mostraria "Falhou" ao lado de uma nota vazia, e o dono do
 * negócio entenderia que o agente dele foi mal.
 *
 * A frase precisa dizer as duas coisas: que não é culpa do agente e que basta
 * rodar de novo.
 * ============================================================================
 */

/** Motivo gravado pela API. Tem de casar com ERRO_FALHA_TECNICA_DO_PROVEDOR. */
export const MOTIVO_FALHA_TECNICA =
  'falha técnica do provedor: mais de 20% dos cenários sem resposta válida';

export interface ExecucaoParaLeitura {
  status: string;
  error?: string | null;
}

/** A execução morreu por falha do provedor, e não por qualidade do agente? */
export function naoFoiAvaliadaPorFalhaTecnica(run: ExecucaoParaLeitura | null | undefined): boolean {
  if (!run || run.status !== 'failed') return false;
  return String(run.error ?? '').startsWith('falha técnica do provedor');
}

/** Rótulo curto, para a lista lateral. */
export const ROTULO_NAO_AVALIADA = 'Não avaliada';

/** Frase longa, para o topo do detalhe. */
export const TEXTO_FALHA_TECNICA =
  'Esta execução não foi avaliada por falha técnica do provedor de IA. ' +
  'Não é uma nota do seu agente. Rode o teste de novo.';
