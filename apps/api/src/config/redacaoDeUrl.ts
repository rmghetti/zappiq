/**
 * Query string fora dos atributos de span (A201).
 * ----------------------------------------------------------------------------
 * As auto-instrumentações do OpenTelemetry sobem quase todas ligadas, inclusive
 * as de HTTP e de undici (o cliente por trás do `fetch`). As duas gravam a URL
 * COMPLETA de cada chamada de saída num atributo de span (`url.full`/`url.query`
 * no undici, `http.url`/`http.target` no http). Quando o exportador aponta para
 * um serviço de observabilidade de terceiro, tudo que estiver na query string vai
 * junto, com a retenção de lá.
 *
 * Como esta casa tinha credencial em query string (a chave do Gemini, a do TTS
 * do Google e o par de app da Meta na assinatura de webhook), o atributo do span
 * virava um caminho de vazamento. A chave do Gemini saiu da URL na mesma
 * mudança; isto aqui é a segunda camada, que vale para qualquer chamada, hoje e
 * amanhã: nenhum span registra query string.
 *
 * Só toca em atributo. Não muda a requisição, não muda o corpo, não desliga
 * instrumentação.
 */

/** Tira a query string e o fragmento de uma URL. Devolve o que veio se não der para interpretar. */
export function urlSemQuery(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    // Caminho relativo, ou coisa que não é URL: corta na mão.
    const corte = url.search(/[?#]/);
    return corte === -1 ? url : url.slice(0, corte);
  }
}

/** Tira a query string de um caminho (`/v1/x?token=abc` vira `/v1/x`). */
export function caminhoSemQuery(caminho: string): string {
  if (!caminho) return caminho;
  const corte = caminho.search(/[?#]/);
  return corte === -1 ? caminho : caminho.slice(0, corte);
}

/**
 * Atributos de substituição para uma chamada de saída do undici. O objeto que
 * chega é o `request` da instrumentação, com `origin` e `path`.
 */
export function atributosSemQueryDoUndici(request: {
  origin?: string;
  path?: string;
}): Record<string, string> {
  const caminho = caminhoSemQuery(String(request?.path ?? ''));
  let completa = caminho;
  try {
    completa = new URL(caminho, String(request?.origin ?? '')).toString();
  } catch {
    completa = urlSemQuery(`${request?.origin ?? ''}${request?.path ?? ''}`);
  }
  return { 'url.full': completa, 'url.query': '', 'url.path': caminho };
}

/**
 * Atributos de substituição para uma chamada de saída do módulo http (é por
 * onde passa o axios). O objeto que chega é o `RequestOptions` já resolvido.
 */
export function atributosSemQueryDoHttp(opcoes: {
  protocol?: string | null;
  hostname?: string | null;
  host?: string | null;
  port?: string | number | null;
  path?: string | null;
}): Record<string, string> {
  const caminho = caminhoSemQuery(String(opcoes?.path ?? ''));
  const protocolo = String(opcoes?.protocol ?? 'http:').replace(/:?$/, ':');
  const maquina = String(opcoes?.hostname ?? opcoes?.host ?? '').replace(/:\d+$/, '');
  const porta = opcoes?.port ? `:${opcoes.port}` : '';
  const completa = maquina ? `${protocolo}//${maquina}${porta}${caminho}` : caminho;
  return {
    'http.url': completa,
    'http.target': caminho,
    'url.full': completa,
    'url.query': '',
    'url.path': caminho,
  };
}

/**
 * Configuração das auto-instrumentações com a redação ligada. Vai inteira para
 * `getNodeAutoInstrumentations`.
 */
export const instrumentacoesSemQueryNaUrl = {
  // fs e dns geram ruído enorme sem valor de negócio.
  '@opentelemetry/instrumentation-fs': { enabled: false },
  '@opentelemetry/instrumentation-dns': { enabled: false },
  '@opentelemetry/instrumentation-undici': {
    startSpanHook: (request: any) => atributosSemQueryDoUndici(request || {}),
  },
  '@opentelemetry/instrumentation-http': {
    startOutgoingSpanHook: (opcoes: any) => atributosSemQueryDoHttp(opcoes || {}),
  },
};
