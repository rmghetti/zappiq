/* ══════════════════════════════════════════════════════════════════════
 * Rascunho do cadastro (A213 e A176, 14/09/2026)
 * --------------------------------------------------------------------
 * O que existia antes:
 *   - o formulário INTEIRO ia para o localStorage na chave
 *     'zappiq_onboarding', com password e passwordConfirm em texto claro;
 *   - ninguém lia essa chave, e o logout removia token, refresh e user e
 *     deixava a senha lá, para sempre;
 *   - por isso o popup do passo 1 prometia salvamento sozinho sem nada
 *     estar salvo de verdade: o único envio é o POST final.
 *
 * O que passa a valer:
 *   - a senha NUNCA é gravada (nem o e-mail, que o rascunho não precisa: ele
 *     volta da sessão autenticada);
 *   - o rascunho é gravado NO NAVEGADOR a cada mudança e RESTAURADO quando
 *     o lead volta no mesmo navegador (não é sincronização: outra máquina,
 *     ou navegador limpo, começa do zero, e o popup diz isso);
 *   - a chave é apagada no login e no logout.
 *
 * Tudo aqui é puro e recebe o armazenamento por parâmetro, para ter teste
 * de verdade sem jsdom.
 * ══════════════════════════════════════════════════════════════════════ */

/** Chave histórica. Mantida para não deixar duas sujeiras no navegador. */
export const CHAVE_RASCUNHO = 'zappiq_onboarding';

/** O contrato do localStorage que usamos. Nada além disto. */
export interface ArmazenamentoLocal {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/**
 * Campos que nunca podem sair da memória da página.
 *
 * `password` e `passwordConfirm` são a senha do cliente (ou, no caminho do
 * Google, a senha aleatória que vira o passwordHash do usuário, e o login
 * por senha aceita qualquer uma das duas). `email` é PII que o rascunho não
 * usa: quem preenche o e-mail é a sessão autenticada.
 */
export const CAMPOS_FORA_DO_RASCUNHO = ['password', 'passwordConfirm', 'email'] as const;

/** Devolve uma cópia do formulário sem os campos proibidos. */
export function sanitizarRascunho(form: Record<string, unknown>): Record<string, unknown> {
  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(form ?? {})) {
    if ((CAMPOS_FORA_DO_RASCUNHO as readonly string[]).includes(chave)) continue;
    limpo[chave] = valor;
  }
  return limpo;
}

/**
 * Grava o rascunho. Fail-soft: navegador em modo privado ou com cota cheia
 * recusa a escrita, e isso não pode derrubar o cadastro.
 */
export function salvarRascunho(form: Record<string, unknown>, storage: ArmazenamentoLocal): void {
  try {
    storage.setItem(CHAVE_RASCUNHO, JSON.stringify(sanitizarRascunho(form)));
  } catch {
    // Rascunho é conveniência, nunca requisito.
  }
}

/**
 * Lê o rascunho. Passa o resultado pelo mesmo saneamento da escrita, porque
 * o navegador do cliente pode ter uma chave gravada pela versão antiga, com
 * a senha dentro.
 */
export function lerRascunho(storage: ArmazenamentoLocal): Record<string, unknown> | null {
  try {
    const bruto = storage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return null;
    const objeto = JSON.parse(bruto);
    if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) return null;
    return sanitizarRascunho(objeto as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Apaga a chave do navegador. Chamado no login e no logout. */
export function limparRascunho(storage: ArmazenamentoLocal): void {
  try {
    storage.removeItem(CHAVE_RASCUNHO);
  } catch {
    // Nada a fazer; a chave some no próximo logout ou na limpeza do navegador.
  }
}

/** Atalho para o navegador real. Devolve null fora do browser (SSR). */
export function armazenamentoDoNavegador(): ArmazenamentoLocal | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
