/**
 * ============================================================================
 * Decisão pós-retorno de OAuth/Magic Link no /cadastro — lógica pura
 * ============================================================================
 * Extraída do Cadastro.tsx pra ser testável sem DOM (incidente 13/08/2026).
 *
 * Quando o cliente volta autenticado do Supabase (Google ou Magic Link) pela
 * porta do CADASTRO, o wizard chama passwordless-exchange pra descobrir se a
 * conta já existe. Esta função traduz a resposta dessa chamada em UMA ação:
 *
 *   200 + token + user       → 'dashboard'  (conta existe: entra)
 *   404 (ou shouldOnboard)   → 'signup'     (conta nova: segue o wizard)
 *   429                      → 'go_login' (rate_limited)   ← NÃO cai no cadastro
 *   rede/5xx/200 sem token   → 'go_login' (verify_failed)  ← NÃO cai no cadastro
 *
 * Antes desta função o código caía no wizard de cadastro em QUALQUER resposta
 * que não fosse 200 — inclusive 429 (limite de autenticação por IP, comum
 * depois de algumas tentativas). Resultado: quem já tinha conta ficava preso
 * na tela de cadastro. Só o 404 significa "conta nova"; o resto é incerteza, e
 * incerteza não pode virar um cadastro novo em cima de uma conta existente.
 * ============================================================================
 */

export type PostOAuthReason = 'rate_limited' | 'verify_failed';

export interface PasswordlessExchangeBody {
  token?: string;
  refreshToken?: string | null;
  user?: unknown;
  shouldOnboard?: boolean;
  error?: string;
}

export type PostOAuthDecision =
  | { action: 'dashboard'; token: string; refreshToken: string | null; user: unknown }
  | { action: 'signup' }
  | { action: 'go_login'; reason: PostOAuthReason };

/**
 * @param input.status  HTTP status da resposta do passwordless-exchange.
 *                      Use 0 para "fetch lançou" (erro de rede/timeout).
 * @param input.body    Corpo JSON já parseado (ou undefined se não deu pra ler).
 */
export function decidePostOAuthReturn(input: {
  status: number;
  body?: PasswordlessExchangeBody;
}): PostOAuthDecision {
  const { status, body } = input;

  // Conta existe: backend devolveu nosso JWT + user.
  if (status === 200 && body && typeof body.token === 'string' && body.token && body.user) {
    return {
      action: 'dashboard',
      token: body.token,
      refreshToken: body.refreshToken ?? null,
      user: body.user,
    };
  }

  // Conta nova de verdade: o único sinal confiável de "siga o cadastro".
  if (status === 404 || (body && body.shouldOnboard === true)) {
    return { action: 'signup' };
  }

  // Limite de autenticação por IP estourado (10/15min). Muito provável que a
  // pessoa já tenha conta e esteja tentando repetido. Manda pro login com aviso
  // pra aguardar — nunca pro formulário de cadastro.
  if (status === 429) {
    return { action: 'go_login', reason: 'rate_limited' };
  }

  // Qualquer outra coisa (rede, 5xx, 401, ou 200 anômalo sem token): não dá pra
  // confirmar a conta. Na dúvida, login, não abrir cadastro sobre conta que
  // pode existir.
  return { action: 'go_login', reason: 'verify_failed' };
}

/**
 * Traduz o ?reason= da URL do /login num aviso pro cliente (banner azul).
 * Devolve null quando não há motivo conhecido (nenhum banner).
 *
 * Sem travessão, por padrão de voz da casa. rate_limited pede pra AGUARDAR
 * porque o limite por IP pode ainda estar ativo quando a pessoa chega no login.
 */
export function loginReasonMessage(reason: string | null | undefined): string | null {
  switch (reason) {
    case 'already_registered':
      return 'Você já tem conta no ZappIQ. Entre com Google ou link mágico pra acessar seu dashboard.';
    case 'rate_limited':
      return 'Você já tem conta no ZappIQ. Tivemos muitas tentativas em pouco tempo: aguarde cerca de 1 minuto e entre com Google ou link mágico.';
    case 'verify_failed':
      return 'Não conseguimos confirmar seu acesso agora. Entre com Google ou link mágico pra abrir seu dashboard.';
    default:
      return null;
  }
}
