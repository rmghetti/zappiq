/* ══════════════════════════════════════════════════════════════════════
 * A escolha do plano atravessando o round-trip do Google (A242)
 * --------------------------------------------------------------------
 * /api/signup/google grava o plano em `signups` antes de mandar o lead
 * para o Google, mas isso só é possível quando ele já digitou o e-mail.
 * Quem clica direto no botão do Google não tem chave nenhuma no banco, e o
 * parâmetro `plan` da URL não sobrevive de forma confiável: medido em
 * produção, oito eventos signup_oauth_started com plan=IZA_LITE e todas as
 * linhas correspondentes gravadas como GROWTH.
 *
 * Este cookie é a segunda rede. HttpOnly (o navegador não precisa ler),
 * SameSite=Lax (obrigatório: o retorno do Google é navegação de topo vinda
 * de outro site, e 'Strict' não mandaria o cookie), meia hora de vida.
 *
 * Mora em lib/ e não dentro de uma rota porque as duas rotas precisam dele
 * e rota importando rota quebra o build do Next.
 * ══════════════════════════════════════════════════════════════════════ */

import { isSelfSignupPlan, type PlanId } from '@zappiq/shared';

export const COOKIE_PLANO_ESCOLHIDO = 'zq_plano_escolhido';

/** Meia hora: tempo de sobra para o lead concluir o login do Google. */
export const COOKIE_MAX_AGE_SEGUNDOS = 30 * 60;

/** Lê o plano do cabeçalho Cookie. Devolve null quando não há ou não vale. */
export function planoDoCookie(req: Request): PlanId | null {
  const bruto = req.headers.get('cookie') || '';
  const par = bruto
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_PLANO_ESCOLHIDO}=`));
  if (!par) return null;
  const valor = decodeURIComponent(par.slice(COOKIE_PLANO_ESCOLHIDO.length + 1));
  return isSelfSignupPlan(valor) ? valor : null;
}

/**
 * Plano do lead que chega pelo Google sem linha em `signups`.
 *
 * Ordem: cookie (gravado por nós) primeiro, parâmetro da URL depois, e o
 * plano de ENTRADA como último recurso. O padrão anterior era GROWTH, um
 * plano três vezes mais caro que o pré-selecionado na tela.
 */
export function resolverPlanoDoOAuth(
  doCookie: string | null,
  daUrl: string | null,
): PlanId {
  if (isSelfSignupPlan(doCookie)) return doCookie;
  if (isSelfSignupPlan(daUrl)) return daUrl;
  return 'IZA_LITE';
}
