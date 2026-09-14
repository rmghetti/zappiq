/* ══════════════════════════════════════════════════════════════════════
 * Funil do cadastro (A242, 14/09/2026)
 * --------------------------------------------------------------------
 * Entre "confirmou o e-mail" e "criou a organização" não existia NENHUM
 * evento. Em 60 dias, 5 pessoas confirmaram o cadastro e nenhuma virou
 * organização, e não havia como saber em que passo pararam. Foi por isso
 * que "ninguém novo chegou" virou "ninguém quis".
 *
 * Três eventos novos, pelo track() que já existe (analytics_events):
 *   onboarding_step_view  — o lead viu o passo N
 *   onboarding_complete   — a organização nasceu
 *   onboarding_error      — parou no passo N, com o motivo
 *
 * LGPD: nada de dado pessoal nas props. O motivo do erro é uma ETIQUETA
 * curta e fechada, nunca a mensagem do servidor (que pode carregar e-mail,
 * nome ou trecho do questionário).
 * ══════════════════════════════════════════════════════════════════════ */

export const EVENTO_PASSO = 'onboarding_step_view';
export const EVENTO_CONCLUSAO = 'onboarding_complete';
export const EVENTO_ERRO = 'onboarding_error';

/** Etiquetas fechadas de motivo. Nenhuma delas carrega dado do cliente. */
export type MotivoDeErro =
  | 'ja_registrado'
  | 'validacao'
  | 'sem_permissao'
  | 'limite_de_tentativas'
  | 'servidor'
  | 'rede'
  | 'desconhecido';

/**
 * Traduz o que deu errado numa etiqueta curta e sem PII.
 *
 * Recebe o status HTTP quando existe (o servidor respondeu) e a mensagem só
 * para distinguir falha de rede; a mensagem NUNCA é devolvida.
 */
export function motivoDoErro(status: number | null, mensagem?: unknown): MotivoDeErro {
  if (status === 409) return 'ja_registrado';
  if (status === 400 || status === 422) return 'validacao';
  if (status === 401 || status === 403) return 'sem_permissao';
  if (status === 429) return 'limite_de_tentativas';
  if (status != null && status >= 500) return 'servidor';
  if (status != null) return 'desconhecido';

  const texto = mensagem instanceof Error ? mensagem.message : String(mensagem ?? '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(texto)) {
    return 'rede';
  }
  return 'desconhecido';
}

/** Props do evento de passo. Só número, nunca conteúdo de resposta. */
export function propsDoPasso(passo: number, totalDePassos: number): Record<string, number> {
  return { step: passo, total_steps: totalDePassos };
}

/** Props do evento de erro. Passo + etiqueta, e nada mais. */
export function propsDoErro(passo: number, motivo: MotivoDeErro): Record<string, unknown> {
  return { step: passo, reason: motivo };
}
