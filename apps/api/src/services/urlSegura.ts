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
 *   3. resolve o nome com `dns.lookup(..., { all: true })` e recusa se QUALQUER
 *      endereço cair em faixa interna (loopback, link-local com o endereço de
 *      metadados da nuvem, 10/8, 172.16/12, 192.168/16, 100.64/10, ::1,
 *      fc00::/7 que cobre o fdaa::/16 do Fly, fe80::/10, e o IPv4 mapeado em
 *      IPv6);
 *   4. conecta com `lookup` fixo no endereço que acabou de ser aprovado, o que
 *      fecha a janela entre a checagem e a conexão;
 *   5. não deixa o cliente HTTP seguir redirecionamento sozinho
 *      (`maxRedirects: 0`): cada destino passa pelas etapas 1 a 4 de novo, no
 *      máximo três vezes.
 *
 * Os limites de 20 MB e 30 segundos da ingestão continuam valendo.
 */
import { promises as dns } from 'node:dns';
import { BlockList, isIPv4 } from 'node:net';
import axios, { AxiosResponse } from 'axios';

/** Erro de destino recusado. A mensagem chega ao cliente, então é em português. */
export class UrlNaoPublicaError extends Error {
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
bloqueioV6.addSubnet('fc00::', 7, 'ipv6'); // privado, cobre o fdaa::/16 do Fly
bloqueioV6.addSubnet('fe80::', 10, 'ipv6'); // link-local
bloqueioV6.addSubnet('ff00::', 8, 'ipv6'); // multicast

/**
 * Verdadeiro quando o endereço é de uso interno. Trata o IPv4 mapeado em IPv6
 * (`::ffff:10.0.0.1`) pelas regras de IPv4, que é como ele se comporta na rede.
 */
export function enderecoEhInterno(endereco: string): boolean {
  const limpo = endereco.replace(/^\[|\]$/g, '').split('%')[0];
  const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(limpo);
  if (mapeado) return bloqueioV4.check(mapeado[1], 'ipv4');
  if (isIPv4(limpo)) return bloqueioV4.check(limpo, 'ipv4');
  try {
    return bloqueioV6.check(limpo, 'ipv6');
  } catch {
    // Endereço que não dá para interpretar não vira conexão.
    return true;
  }
}

/** Verdadeiro quando o nome é de rede interna pelo próprio nome. */
export function nomeEhInterno(hostname: string): boolean {
  const nome = hostname.toLowerCase().replace(/\.$/, '');
  if (NOMES_BLOQUEADOS.has(nome)) return true;
  return SUFIXOS_BLOQUEADOS.some((s) => nome.endsWith(s));
}

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

  let alvo = url;
  for (let salto = 0; salto <= MAXIMO_DE_REDIRECIONAMENTOS; salto++) {
    const { url: interpretada, endereco, familia } = await resolverUrlPublica(alvo);
    const resposta = await axios.get(alvo, {
      responseType: 'arraybuffer',
      timeout,
      maxContentLength,
      maxRedirects: 0,
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
