/* ══════════════════════════════════════════════════════════════════════
 * origensPermitidas: de onde o navegador pode chamar esta API.
 * --------------------------------------------------------------------
 * A lista fixa mudou de casa (era ALLOWED_ORIGIN_PATTERNS em server.ts)
 * sem mudar uma linha: o CORS global, o socket do painel e o widget do
 * chat do site leem a MESMA lista daqui.
 *
 * C1b (Passo 4, A241): o widget do chat do site passa a aceitar também as
 * origens que a organização cadastrou em settings.webChatAllowedOrigins.
 * A lista fixa continua valendo como reserva: nada que funciona hoje deixa
 * de funcionar. Pura: sem banco (quem lê as settings passa a lista pronta).
 * ══════════════════════════════════════════════════════════════════════ */

/** A lista de sempre. `appUrl` é o NEXT_PUBLIC_APP_URL do ambiente. */
export function padroesDeOrigemFixos(appUrl: string): Array<string | RegExp> {
  return [
    appUrl,
    'https://zappiq.com.br',
    'https://www.zappiq.com.br',
    /^https:\/\/zappiq-git-[a-z0-9-]+-zappiq\.vercel\.app$/, // branch alias previews
    /^https:\/\/zappiq-[a-z0-9]+-zappiq\.vercel\.app$/, // deployment hash previews
    // FEATURE webchat-por-org: sites de CLIENTES que embedam o widget público
    // (POST /api/web-chat/org/:organizationId/message) precisam fazer fetch
    // cross-origin daqui. Primeiro cliente: CMJ (cmj.com.br), widget da Vera.
    // C1b: fica como reserva; a origem de um cliente novo entra pelas
    // settings da organização (webChatAllowedOrigins), sem mexer no código.
    'https://cmj.com.br',
    'https://www.cmj.com.br',
    // localhost: só pra testar o widget em dev local contra esta API (não
    // expõe nada novo — endpoints seguem exigindo Bearer token onde precisam).
    /^http:\/\/localhost:\d+$/,
  ];
}

/** A origem casa com algum padrão da lista? */
export function origemCasaComPadroes(origin: string, padroes: Array<string | RegExp>): boolean {
  return padroes.some((p) => (typeof p === 'string' ? p === origin : p.test(origin)));
}

/**
 * Normaliza uma origem cadastrada pelo dono: minúsculas, sem barra no fim,
 * só esquema e host (e porta). Devolve null para o que não é origem
 * http(s) válida: lixo nas settings nunca vira permissão.
 */
export function origemNormalizada(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null;
  const texto = bruto.trim();
  if (!texto) return null;
  try {
    const url = new URL(texto);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/** As origens da organização (settings.webChatAllowedOrigins), já limpas. */
export function origensDaOrganizacao(settings: Record<string, any> | null | undefined): string[] {
  const lista = settings?.webChatAllowedOrigins;
  if (!Array.isArray(lista)) return [];
  const limpas = lista.map(origemNormalizada).filter((o): o is string => Boolean(o));
  return Array.from(new Set(limpas));
}

/**
 * O widget desta organização pode rodar nesta origem?
 *
 * Sem Origin (servidor, curl, healthcheck) segue a regra do CORS global:
 * passa. Com Origin: vale a lista fixa (reserva, o comportamento de hoje)
 * OU a lista que a organização cadastrou.
 */
export function origemPermitidaNoWidget(input: {
  origin: string | undefined | null;
  padroesFixos: Array<string | RegExp>;
  origensDaOrganizacao: string[];
}): boolean {
  if (!input.origin) return true;
  if (origemCasaComPadroes(input.origin, input.padroesFixos)) return true;
  const normalizada = origemNormalizada(input.origin);
  return Boolean(normalizada && input.origensDaOrganizacao.includes(normalizada));
}
