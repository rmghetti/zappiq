/**
 * urlSegura.test.ts (A016, revisão de segurança do PR #369)
 * ============================================================================
 * O teste de SSRF que já existia injetava o IPv4 mapeado em IPv6 como RESPOSTA
 * de DNS, e na forma decimal (`::ffff:169.254.169.254`). Só que o caminho real
 * do atacante é outro: escrever o endereço na própria URL. O interpretador de
 * URL do Node normaliza `[::ffff:169.254.169.254]` para `[::ffff:a9fe:a9fe]`,
 * em hexadecimal, e era exatamente essa forma que a checagem antiga não
 * reconhecia. O mesmo valia para o IPv4 compatível (`::127.0.0.1`) e para o
 * prefixo de NAT64 (`64:ff9b::/96`).
 *
 * Aqui os endereços entram pela URL, como o cliente manda. Nenhum teste toca a
 * rede: o DNS é simulado e devolve o próprio endereço quando o nome já é um IP,
 * que é o que o resolvedor de verdade faz.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isIP } from 'node:net';

/** Nomes com resposta combinada. IP literal responde ele mesmo. */
const dnsPorNome: Record<string, Array<{ address: string; family: number }>> = {};
const consultasDeDns: string[] = [];

vi.mock('node:dns', () => {
  const lookup = vi.fn(async (hostname: string) => {
    consultasDeDns.push(hostname);
    const familia = isIP(hostname);
    if (familia) return [{ address: hostname, family: familia }];
    const r = dnsPorNome[hostname];
    if (!r) {
      const err: any = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
      err.code = 'ENOTFOUND';
      throw err;
    }
    return r;
  });
  return { default: { promises: { lookup } }, promises: { lookup } };
});

/** Respostas de HTTP por URL, montadas em cada teste. */
const respostasHttp: Record<string, any> = {};
const chamadasHttp: Array<{ url: string; config: any }> = [];

const axiosGet = vi.fn(async (url: string, config?: any) => {
  chamadasHttp.push({ url, config });
  const r = respostasHttp[url];
  if (!r) throw new Error(`URL inesperada no teste: ${url}`);
  return r;
});

vi.mock('axios', () => {
  const axios: any = {
    get: (...args: any[]) => (axiosGet as any)(...args),
    create: vi.fn(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() })),
  };
  return { default: axios, ...axios };
});

const { enderecoEhInterno, resolverUrlPublica, buscarUrlPublica, UrlNaoPublicaError } =
  await import('./urlSegura.js');

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(dnsPorNome)) delete dnsPorNome[k];
  for (const k of Object.keys(respostasHttp)) delete respostasHttp[k];
  consultasDeDns.length = 0;
  chamadasHttp.length = 0;
});

/** O nome como o interpretador de URL entrega, sem os colchetes. */
function maquinaDaUrl(url: string): string {
  return new URL(url).hostname.replace(/^\[|\]$/g, '');
}

describe('enderecoEhInterno: IPv6 que carrega endereço IPv4 (P1)', () => {
  it('reconhece o endereço de metadados escrito como IPv6 mapeado na URL', () => {
    // A URL diz `[::ffff:169.254.169.254]`, o interpretador entrega
    // `[::ffff:a9fe:a9fe]`. A regra antiga só casava a forma decimal.
    expect(maquinaDaUrl('http://[::ffff:169.254.169.254]/')).toBe('::ffff:a9fe:a9fe');
    expect(enderecoEhInterno('::ffff:a9fe:a9fe')).toBe(true);
  });

  it('reconhece o loopback e a faixa 10/8 mapeados em hexadecimal', () => {
    expect(enderecoEhInterno(maquinaDaUrl('http://[::ffff:127.0.0.1]:6379/'))).toBe(true);
    expect(enderecoEhInterno(maquinaDaUrl('http://[::ffff:10.0.0.1]/'))).toBe(true);
  });

  it('reconhece o IPv4 compatível (::/96), que não tem o ffff no meio', () => {
    expect(maquinaDaUrl('http://[::127.0.0.1]/')).toBe('::7f00:1');
    expect(enderecoEhInterno('::7f00:1')).toBe(true);
  });

  it('reconhece o prefixo de NAT64 (64:ff9b::/96) levando aos metadados', () => {
    expect(enderecoEhInterno(maquinaDaUrl('http://[64:ff9b::a9fe:a9fe]/'))).toBe(true);
  });

  it('continua reconhecendo a forma decimal que o DNS às vezes devolve', () => {
    expect(enderecoEhInterno('::ffff:169.254.169.254')).toBe(true);
  });

  it('endereço público mapeado NÃO é recusado por essa regra', () => {
    expect(maquinaDaUrl('http://[::ffff:1.1.1.1]/')).toBe('::ffff:101:101');
    expect(enderecoEhInterno('::ffff:101:101')).toBe(false);
    expect(enderecoEhInterno('1.1.1.1')).toBe(false);
    expect(enderecoEhInterno('2606:4700:4700::1111')).toBe(false);
  });

  it('o que não dá para interpretar como endereço conta como interno', () => {
    expect(enderecoEhInterno('nao-e-um-endereco')).toBe(true);
    expect(enderecoEhInterno('')).toBe(true);
  });

  it('as faixas que já valiam continuam valendo', () => {
    expect(enderecoEhInterno('169.254.169.254')).toBe(true);
    expect(enderecoEhInterno('10.0.0.7')).toBe(true);
    expect(enderecoEhInterno('192.168.1.10')).toBe(true);
    expect(enderecoEhInterno('::1')).toBe(true);
    expect(enderecoEhInterno('fdaa:0:1::3')).toBe(true);
    expect(enderecoEhInterno('fe80::1%eth0')).toBe(true);
    expect(enderecoEhInterno('93.184.216.34')).toBe(false);
  });
});

describe('resolverUrlPublica: o endereço escrito na URL é recusado (P2)', () => {
  const recusadas = [
    'http://[::ffff:169.254.169.254]/',
    'http://[::ffff:127.0.0.1]:6379/',
    'http://[::ffff:10.0.0.1]/',
    'http://[::127.0.0.1]/',
    'http://[64:ff9b::a9fe:a9fe]/',
  ];

  for (const url of recusadas) {
    it(`recusa ${url}`, async () => {
      await expect(resolverUrlPublica(url)).rejects.toThrow(UrlNaoPublicaError);
      await expect(resolverUrlPublica(url)).rejects.toThrow(/interna|privad/i);
    });
  }

  it('a recusa é pelo endereço, não pela porta: 8080 é porta permitida', async () => {
    // Se a regra fosse só de porta, esta URL passaria.
    await expect(resolverUrlPublica('http://[::ffff:127.0.0.1]:8080/')).rejects.toThrow(
      /interna|privad/i,
    );
  });

  it('endereço público escrito na URL passa pela regra de faixa interna', async () => {
    const alvo = await resolverUrlPublica('http://[::ffff:1.1.1.1]/');
    expect(alvo.endereco).toBe('::ffff:101:101');
  });
});

describe('buscarUrlPublica: porta e cabeçalhos', () => {
  it('recusa porta fora de 80, 443, 8080 e 8443', async () => {
    dnsPorNome['site.exemplo.com.br'] = [{ address: '93.184.216.34', family: 4 }];
    await expect(resolverUrlPublica('http://site.exemplo.com.br:6379/')).rejects.toThrow(
      UrlNaoPublicaError,
    );
    await expect(resolverUrlPublica('http://site.exemplo.com.br:25/')).rejects.toThrow(/porta/i);
  });

  it('aceita as portas de uso normal', async () => {
    dnsPorNome['site.exemplo.com.br'] = [{ address: '93.184.216.34', family: 4 }];
    for (const url of [
      'https://site.exemplo.com.br/x',
      'http://site.exemplo.com.br:80/x',
      'https://site.exemplo.com.br:443/x',
      'http://site.exemplo.com.br:8080/x',
      'https://site.exemplo.com.br:8443/x',
    ]) {
      await expect(resolverUrlPublica(url)).resolves.toMatchObject({
        endereco: '93.184.216.34',
      });
    }
  });

  it('manda os cabeçalhos recebidos em todos os saltos', async () => {
    dnsPorNome['site.exemplo.com.br'] = [{ address: '93.184.216.34', family: 4 }];
    dnsPorNome['cdn.exemplo.com.br'] = [{ address: '93.184.216.35', family: 4 }];
    respostasHttp['https://site.exemplo.com.br/doc'] = {
      data: Buffer.from(''),
      status: 302,
      headers: { location: 'https://cdn.exemplo.com.br/doc.txt' },
    };
    respostasHttp['https://cdn.exemplo.com.br/doc.txt'] = {
      data: Buffer.from('olá'),
      status: 200,
      headers: { 'content-type': 'text/plain' },
    };

    await buscarUrlPublica('https://site.exemplo.com.br/doc', {
      headers: { 'User-Agent': 'ZappIQ-Crawler/1.0 (+https://zappiq.com.br)' },
    });

    expect(chamadasHttp).toHaveLength(2);
    for (const c of chamadasHttp) {
      expect(c.config.headers['User-Agent']).toBe('ZappIQ-Crawler/1.0 (+https://zappiq.com.br)');
    }
  });
});

describe('UrlNaoPublicaError (P4)', () => {
  it('carrega 422 para a frase em português chegar ao cliente', () => {
    const err = new UrlNaoPublicaError('Esse endereço é de uma rede interna.');
    expect(err.statusCode).toBe(422);
  });
});
