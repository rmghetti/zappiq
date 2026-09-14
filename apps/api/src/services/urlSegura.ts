/**
 * URL pública de verdade: resolve o nome, confere o endereço e só então conecta
 * (A016).
 * ----------------------------------------------------------------------------
 * A checagem antiga olhava o texto do endereço escrito na URL, contra uma lista
 * curta de nomes e três faixas IPv4 em decimal. Passava qualquer domínio comum
 * apontando para a rede interna, qualquer endereço IPv6, o nome `*.internal` do
 * Fly, e principalmente qualquer redirecionamento: o axios segue até cinco
 * saltos por padrão, e nenhum deles era conferido. Como o conteúdo baixado vira
 * trecho buscável na base do cliente, isso era um jeito de ler serviço interno
 * pela própria base de conhecimento.
 *
 * O que este módulo faz, nesta ordem:
 *   1. aceita só http e https;
 *   2. recusa nome interno conhecido (`*.internal` do Fly, `*.local`,
 *      `localhost`, `metadata.google.internal`);
 *   3. aceita só as portas de uso normal na web (80, 443, 8080, 8443), para a
 *      URL não virar varredura de porta da rede de saída;
 *   4. resolve o nome com `dns.lookup(..., { all: true })` e recusa se QUALQUER
 *      endereço cair em faixa interna (loopback, link-local com o endereço de
 *      metadados da nuvem, 10/8, 172.16/12, 192.168/16, 100.64/10, ::1,
 *      fc00::/7 que cobre o fdaa::/16 do Fly, fe80::/10, e todas as formas de
 *      IPv6 que carregam um IPv4 por dentro: o mapeado `::ffff:0:0/96`, o
 *      compatível `::/96` e o NAT64 `64:ff9b::/96`);
 *   5. conecta com `lookup` fixo no endereço que acabou de ser aprovado, o que
 *      fecha a janela entre a checagem e a conexão;
 *   6. não deixa o cliente HTTP seguir redirecionamento sozinho
 *      (`maxRedirects: 0`): cada destino passa pelas etapas 1 a 5 de novo, no
 *      máximo três vezes.
 *
 * Os limites de 20 MB e 30 segundos da ingestão continuam valendo.
 *
 * LIMITE CONHECIDO: fixar o `lookup` só vale com saída direta. Se um dia a API
 * rodar atrás de proxy de saída (`HTTP_PROXY`/`HTTPS_PROXY` no ambiente), o
 * axios manda o pedido para o proxy e quem resolve o nome é ele: o endereço que
 * aprovamos aqui deixa de ser o endereço conectado, e a janela entre a checagem
 * e a conexão reabre. Hoje o Fly não usa proxy de saída. Quem ligar um proxy
 * precisa voltar aqui e mover a checagem para o proxy ou para uma lista de
 * destinos permitidos.
 */
import { promises as dns } from 'node:dns';
import { BlockList, isIP, isIPv4 } from 'node:net';
import axios, { AxiosResponse } from 'axios';

/**
 * Erro de destino recusado. A mensagem chega ao cliente, então é em português.
 *
 * O `statusCode` existe para o errorHandler: sem ele o erro cai no ramo
 * genérico, vira 500, e em produção a frase é trocada por "Internal Server
 * Error". Com 422 a frase que explica o problema chega a quem colou a URL.
 */
export class UrlNaoPublicaError extends Error {
  statusCode = 422;

  constructor(motivo: string) {
    super(motivo);
    this.name = 'UrlNaoPublicaError';
  }
}

/** Nomes que nunca são públicos, mesmo que o DNS responda alguma coisa. */
const NOMES_BLOQUEADOS = new Set(['localhost', 'metadata.google.internal']);

/** Sufixos de rede privada: `.internal` é a rede interna do Fly. */
const SUFIXOS_BLOQUEADOS = ['.internal', '.local', '.localdomain', '.localhost'];

const bloqueioV4 = new BlockList();
bloqueioV4.addSubnet('0.0.0.0', 8, 'ipv4'); // "este host"
bloqueioV4.addSubnet('10.0.0.0', 8, 'ipv4');
bloqueioV4.addSubnet('100.64.0.0', 10, 'ipv4'); // CGNAT
bloqueioV4.addSubnet('127.0.0.0', 8, 'ipv4'); // loopback
bloqueioV4.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local e metadados da nuvem
bloqueioV4.addSubnet('172.16.0.0', 12, 'ipv4');
bloqueioV4.addSubnet('192.168.0.0', 16, 'ipv4');
bloqueioV4.addSubnet('192.0.0.0', 24, 'ipv4'); // atribuições de protocolo
bloqueioV4.addSubnet('198.18.0.0', 15, 'ipv4'); // testes de desempenho
bloqueioV4.addSubnet('224.0.0.0', 4, 'ipv4'); // multicast
bloqueioV4.addSubnet('240.0.0.0', 4, 'ipv4'); // reservado

const bloqueioV6 = new BlockList();
bloqueioV6.addAddress('::', 'ipv6');
bloqueioV6.addAddress('::1', 'ipv6'); // loopback
bloqueioV6.addSubnet('::', 96, 'ipv6'); // IPv4 compatível: `::127.0.0.1` vira `::7f00:1`
bloqueioV6.addSubnet('64:ff9b::', 96, 'ipv6'); // NAT64: leva a qualquer IPv4
bloqueioV6.addSubnet('fc00::', 7, 'ipv6'); // privado, cobre o fdaa::/16 do Fly
bloqueioV6.addSubnet('fe80::', 10, 'ipv6'); // link-local
bloqueioV6.addSubnet('ff00::', 8, 'ipv6'); // multicast

/**
 * Verdadeiro quando o endereço é de uso interno.
 *
 * O ponto delicado é o IPv6 que carrega um IPv4 por dentro. O interpretador de
 * URL do Node normaliza `[::ffff:169.254.169.254]` para `[::ffff:a9fe:a9fe]`,
 * em hexadecimal, então casar a forma decimal com expressão regular deixava
 * passar exatamente a grafia que chega pela URL. Aqui a tradução é feita pelo
 * próprio `BlockList`: consultar o bloqueio de IPv4 com tipo `ipv6` faz o Node
 * converter o endereço mapeado antes de comparar, em qualquer grafia. O que o
 * mapeado não cobre (IPv4 compatível e NAT64) entra como faixa no bloqueio de
 * IPv6.
 *
 * Endereço que não é IP, ou consulta que estoura, conta como interno: o que não
 * dá para conferir não vira conexão.
 */
export function enderecoEhInterno(endereco: string): boolean {
  const limpo = endereco.replace(/^\[|\]$/g, '').split('%')[0];
  if (!isIP(limpo)) return true;
  try {
    if (isIPv4(limpo)) return bloqueioV4.check(limpo, 'ipv4');
    // Primeiro pelas regras de IPv4 (pega o mapeado), depois pelas de IPv6.
    if (bloqueioV4.check(limpo, 'ipv6')) return true;
    return bloqueioV6.check(limpo, 'ipv6');
  } catch {
    return true;
  }
}

/** Verdadeiro quando o nome é de rede interna pelo próprio nome. */
export function nomeEhInterno(hostname: string): boolean {
  const nome = hostname.toLowerCase().replace(/\.$/, '');
  if (NOMES_BLOQUEADOS.has(nome)) return true;
  return SUFIXOS_BLOQUEADOS.some((s) => nome.endsWith(s));
}

/**
 * Portas aceitas. Página pública mora em 80 ou 443, e 8080/8443 cobrem o site
 * que roda atrás de proxy. Fora disso a URL deixa de ser leitura de página e
 * vira sonda da rede de saída (Redis em 6379, Postgres em 5432, painel interno
 * em 9200), inclusive contra um nome público que aponta para fora da nuvem.
 */
const PORTAS_PERMITIDAS = new Set([80, 443, 8080, 8443]);

export interface AlvoPublico {
  /** URL já interpretada. */
  url: URL;
  /** Endereço aprovado, o mesmo que será usado na conexão. */
  endereco: string;
  /** 4 ou 6. */
  familia: number;
}

/**
 * Resolve e aprova a URL, ou lança `UrlNaoPublicaError`. Não conecta em nada.
 */
export async function resolverUrlPublica(url: string): Promise<AlvoPublico> {
  let interpretada: URL;
  try {
    interpretada = new URL(url);
  } catch {
    throw new UrlNaoPublicaError('Endereço inválido.');
  }
  if (!['http:', 'https:'].includes(interpretada.protocol)) {
    throw new UrlNaoPublicaError('Só aceitamos endereços http ou https.');
  }
  const hostname = interpretada.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) throw new UrlNaoPublicaError('Endereço inválido.');
  if (nomeEhInterno(hostname)) {
    throw new UrlNaoPublicaError('Esse endereço é de uma rede interna e não pode ser lido aqui.');
  }
  // O endereço escrito direto na URL é conferido antes do DNS e antes da porta:
  // é o achado mais grave, e a mensagem precisa ser a dele. Não é só atalho, o
  // `[::ffff:169.254.169.254]` chega aqui já em hexadecimal, e conferir na
  // entrada evita depender de como o resolvedor devolve um IP literal.
  if (isIP(hostname) && enderecoEhInterno(hostname)) {
    throw new UrlNaoPublicaError(
      'Esse endereço aponta para uma rede interna ou privada e não pode ser lido aqui.',
    );
  }
  const porta = interpretada.port
    ? Number(interpretada.port)
    : interpretada.protocol === 'https:'
      ? 443
      : 80;
  if (!PORTAS_PERMITIDAS.has(porta)) {
    throw new UrlNaoPublicaError(
      'Só conseguimos ler páginas nas portas 80, 443, 8080 e 8443. Informe o endereço do site.',
    );
  }

  let resolvidos: Array<{ address: string; family: number }>;
  try {
    resolvidos = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UrlNaoPublicaError('Não foi possível resolver esse endereço.');
  }
  if (!resolvidos || resolvidos.length === 0) {
    throw new UrlNaoPublicaError('Não foi possível resolver esse endereço.');
  }
  // Um endereço interno na lista já basta: um nome pode responder o público na
  // primeira consulta e o interno na segunda.
  for (const r of resolvidos) {
    if (enderecoEhInterno(r.address)) {
      throw new UrlNaoPublicaError(
        'Esse endereço aponta para uma rede interna ou privada e não pode ser lido aqui.',
      );
    }
  }
  const escolhido = resolvidos[0];
  return { url: interpretada, endereco: escolhido.address, familia: escolhido.family };
}

/** Quantos saltos de redirecionamento aceitamos revalidar. */
const MAXIMO_DE_REDIRECIONAMENTOS = 3;

export interface OpcoesDeBusca {
  /** Tempo máximo por salto, em milissegundos. */
  timeoutMs?: number;
  /** Tamanho máximo do corpo, em bytes. */
  maxBytes?: number;
  /**
   * Cabeçalhos do pedido, repetidos em cada salto. Serve para o User-Agent com
   * que a ZappIQ se identifica no site de quem está sendo lido.
   */
  headers?: Record<string, string>;
}

/**
 * Baixa a URL como binário, revalidando cada redirecionamento. Devolve a
 * resposta final do axios (mesma forma que `axios.get` devolvia antes).
 */
export async function buscarUrlPublica(
  url: string,
  opcoes: OpcoesDeBusca = {},
): Promise<AxiosResponse<any>> {
  const timeout = opcoes.timeoutMs ?? 30_000;
  const maxContentLength = opcoes.maxBytes ?? 20 * 1024 * 1024;
  const headers = opcoes.headers ?? {};

  let alvo = url;
  for (let salto = 0; salto <= MAXIMO_DE_REDIRECIONAMENTOS; salto++) {
    const { url: interpretada, endereco, familia } = await resolverUrlPublica(alvo);
    const resposta = await axios.get(alvo, {
      responseType: 'arraybuffer',
      timeout,
      maxContentLength,
      maxRedirects: 0,
      headers,
      // O endereço já aprovado é o que vai ser conectado. Sem isso, entre a
      // checagem e a conexão o nome poderia resolver para outro endereço.
      lookup: ((_hostname: string, opcoesDoNode: any, callback: any) => {
        if (opcoesDoNode && opcoesDoNode.all) {
          callback(null, [{ address: endereco, family: familia }]);
          return;
        }
        callback(null, endereco, familia);
      }) as any,
      // 3xx não é erro aqui: é o salto que vamos revalidar na próxima volta.
      validateStatus: (status: number) => status >= 200 && status < 400,
    });

    const status = Number(resposta.status);
    if (status < 300 || status >= 400) return resposta;

    const destino = (resposta.headers as any)?.location || (resposta.headers as any)?.Location;
    if (!destino) {
      throw new UrlNaoPublicaError('O servidor respondeu um redirecionamento sem destino.');
    }
    alvo = new URL(String(destino), interpretada).toString();
  }
  throw new UrlNaoPublicaError('Esse endereço redireciona demais. Informe o endereço final.');
}
