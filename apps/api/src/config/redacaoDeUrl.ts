/**
 * Query string fora dos atributos de span (A201).
 * ----------------------------------------------------------------------------
 * As auto-instrumentações do OpenTelemetry sobem quase todas ligadas, inclusive
 * as de HTTP e de undici (o cliente por trás do `fetch`). As duas gravam a URL
 * COMPLETA num atributo de span (`url.full`/`url.query` no undici,
 * `http.url`/`http.target` no http). Quando o exportador aponta para um serviço
 * de observabilidade de terceiro, tudo que estiver na query string vai junto,
 * com a retenção de lá.
 *
 * Vale para os dois sentidos, e os dois vazavam:
 *   • SAÍDA: a chave do Gemini, a do TTS do Google e o par de app da Meta na
 *     assinatura de webhook andavam em query string. A chave do Gemini saiu da
 *     URL na mesma mudança; a redação é a segunda camada, que vale para
 *     qualquer chamada, hoje e amanhã.
 *   • ENTRADA: o `?code=` que o Google devolve no retorno do OAuth, o
 *     `hub.verify_token` com que a Meta assina a verificação de webhook e o
 *     `session_id` com que o Stripe volta do checkout chegam na query string de
 *     rotas nossas, e viravam atributo de span do mesmo jeito.
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
 * Atributos de substituição para uma chamada que CHEGA na API. O objeto que
 * chega é o `IncomingMessage` do Node, com `url` (caminho mais query) e o
 * cabeçalho `host`.
 *
 * A entrada também carrega segredo em query string: o `?code=` que o Google
 * devolve no retorno do OAuth, o `hub.verify_token` com que a Meta assina a
 * verificação de webhook e o `session_id` com que o Stripe volta do checkout.
 * Na instrumentação do http os atributos de entrada que levam a query são
 * `http.url` (URL absoluta, montada com o caminho mais a query) e `http.target`
 * (o caminho com a query). `url.path` e `url.query` entram aqui também para o
 * caso de a convenção estável passar a preenchê-los.
 */
export function atributosSemQueryDaEntrada(request: {
  url?: string | null;
  headers?: Record<string, unknown> | null;
  socket?: { encrypted?: boolean } | null;
}): Record<string, string> {
  const caminho = caminhoSemQuery(String(request?.url ?? ''));
  const maquina = String(request?.headers?.host ?? '');
  const protocolo = request?.socket?.encrypted ? 'https:' : 'http:';
  const completa = maquina ? `${protocolo}//${maquina}${caminho}` : caminho;
  return {
    'http.url': completa,
    'http.target': caminho,
    'url.path': caminho,
    'url.query': '',
  };
}

/**
 * Configuração das auto-instrumentações com a redação ligada. Vai inteira para
 * `getNodeAutoInstrumentations`.
 *
 * Os ganchos devolvem atributos que a instrumentação aplica POR ÚLTIMO, por
 * cima dos que ela mesma montou (conferido no pacote instalado,
 * `@opentelemetry/instrumentation-http@0.54.2`, em
 * `getIncomingRequestAttributes`/`getOutgoingRequestAttributes`: os dois
 * terminam em `Object.assign(..., options.hookAttributes)`). É por isso que
 * devolver o valor sem query basta para apagar o que a instrumentação tinha
 * gravado com query.
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
    startIncomingSpanHook: (request: any) => atributosSemQueryDaEntrada(request || {}),
  },
};
