/**
 * ragService.ssrf.test.ts (A016)
 * ============================================================================
 * A ingestão por URL olhava só o nome escrito na URL. Bastava um domínio comum
 * apontando para um endereço interno para o conteúdo de um serviço da rede da
 * API virar trecho buscável na base de conhecimento do próprio cliente. E o
 * axios seguia até cinco redirecionamentos sem conferir nenhum destino.
 *
 * Aqui o DNS é simulado: o teste manda um nome público que resolve para o
 * endereço de metadados da nuvem, um redirecionamento para a faixa 10/8 e o
 * nome interno do Fly. Nenhum deles pode virar requisição.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Respostas de DNS por nome, montadas em cada teste. */
const dns: Record<string, Array<{ address: string; family: number }>> = {};

vi.mock('node:dns', () => {
  const lookup = vi.fn(async (hostname: string) => {
    const r = dns[hostname];
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
const respostas: Record<string, any> = {};
const chamadasHttp: string[] = [];

const axiosGet = vi.fn(async (url: string, _config?: any) => {
  chamadasHttp.push(url);
  const r = respostas[url];
  if (!r) throw new Error(`URL inesperada no teste: ${url}`);
  return r;
});

// O ragClient (instância do axios) atende o `/ready`, que é de onde sai a
// lista de extratores do serviço de indexação. Sem esta resposta o teste mediria
// o caminho de erro do `ragCapabilities`, não a ingestão.
const instanciaGet = vi.fn(async (caminho: string) => {
  if (caminho === '/ready') return { data: { extratores: ['pdf', 'html', 'texto'] } };
  throw new Error(`caminho inesperado no ragClient: ${caminho}`);
});

vi.mock('axios', () => {
  const instancia = { get: (...a: any[]) => (instanciaGet as any)(...a), post: vi.fn(), delete: vi.fn() };
  const axios: any = {
    get: (...args: any[]) => (axiosGet as any)(...args),
    create: vi.fn(() => instancia),
  };
  return { default: axios, ...axios };
});

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./cloud/index.js', () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    del: vi.fn(async () => true),
    // A ingestão marca a versão da configuração (B4, #365): sem incrby o teste
    // quebrava dentro do bumpConfigVersion, antes de medir o que ele mede.
    incrby: vi.fn(async () => 1),
    expire: vi.fn(async () => true),
  },
}));

// A ingestão no serviço Python é um fetch. Nenhum teste pode sair para a rede.
const fetchMock = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ namespace: 'org_1', source: 's', chunks_ingested: 1 }),
  text: async () => '',
}));
vi.stubGlobal('fetch', fetchMock);

const { ingestUrl, MENSAGEM_URL_NAO_PUBLICA, MENSAGEM_REDE_SOCIAL, esquecerCapacidadesDoRag } =
  await import('./ragService.js');

function paginaOk(texto: string) {
  return { data: Buffer.from(texto, 'utf-8'), status: 200, headers: { 'content-type': 'text/plain' } };
}

function redirecionaPara(destino: string) {
  return { data: Buffer.from(''), status: 302, headers: { location: destino } };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(dns)) delete dns[k];
  for (const k of Object.keys(respostas)) delete respostas[k];
  chamadasHttp.length = 0;
  esquecerCapacidadesDoRag();
});

describe('ingestUrl: endereço interno é recusado antes de conectar (A016)', () => {
  it('recusa nome público que resolve para o endereço de metadados da nuvem', async () => {
    dns['docs.exemplo.com.br'] = [{ address: '169.254.169.254', family: 4 }];
    await expect(ingestUrl('org-1', 'https://docs.exemplo.com.br/manual')).rejects.toThrow(
      MENSAGEM_URL_NAO_PUBLICA,
    );
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('recusa nome que resolve para a faixa privada 10/8', async () => {
    dns['intranet.exemplo.com.br'] = [{ address: '10.0.0.7', family: 4 }];
    await expect(ingestUrl('org-1', 'https://intranet.exemplo.com.br/x')).rejects.toThrow();
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('recusa quando UM dos endereços do nome é interno', async () => {
    dns['duplo.exemplo.com.br'] = [
      { address: '93.184.216.34', family: 4 },
      { address: '192.168.1.10', family: 4 },
    ];
    await expect(ingestUrl('org-1', 'https://duplo.exemplo.com.br/x')).rejects.toThrow();
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('recusa o nome interno do Fly (zappiq-rag.internal), sem nem consultar DNS', async () => {
    await expect(ingestUrl('org-1', 'http://zappiq-rag.internal/ingest')).rejects.toThrow(
      MENSAGEM_URL_NAO_PUBLICA,
    );
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('recusa IPv6 de loopback e a faixa privada fc00::/7', async () => {
    dns['seis.exemplo.com.br'] = [{ address: '::1', family: 6 }];
    await expect(ingestUrl('org-1', 'https://seis.exemplo.com.br/x')).rejects.toThrow();
    dns['fly.exemplo.com.br'] = [{ address: 'fdaa:0:1::3', family: 6 }];
    await expect(ingestUrl('org-1', 'https://fly.exemplo.com.br/x')).rejects.toThrow();
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('recusa endereço IPv4 mapeado em IPv6 (::ffff:169.254.169.254)', async () => {
    dns['mapeado.exemplo.com.br'] = [{ address: '::ffff:169.254.169.254', family: 6 }];
    await expect(ingestUrl('org-1', 'https://mapeado.exemplo.com.br/x')).rejects.toThrow();
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('recusa esquema que não é http nem https', async () => {
    await expect(ingestUrl('org-1', 'file:///etc/passwd')).rejects.toThrow();
    expect(axiosGet).not.toHaveBeenCalled();
  });
});

describe('ingestUrl: redirecionamento é revalidado (A016)', () => {
  it('recusa redirecionamento para http://10.0.0.1', async () => {
    dns['site.exemplo.com.br'] = [{ address: '93.184.216.34', family: 4 }];
    dns['10.0.0.1'] = [{ address: '10.0.0.1', family: 4 }];
    respostas['https://site.exemplo.com.br/doc'] = redirecionaPara('http://10.0.0.1/segredo');

    await expect(ingestUrl('org-1', 'https://site.exemplo.com.br/doc')).rejects.toThrow();
    // Chegou a pedir a primeira URL (pública), nunca a segunda.
    expect(chamadasHttp).toEqual(['https://site.exemplo.com.br/doc']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('segue redirecionamento para destino público e ingere o conteúdo', async () => {
    dns['site.exemplo.com.br'] = [{ address: '93.184.216.34', family: 4 }];
    dns['cdn.exemplo.com.br'] = [{ address: '93.184.216.35', family: 4 }];
    respostas['https://site.exemplo.com.br/doc'] = redirecionaPara('https://cdn.exemplo.com.br/doc.txt');
    respostas['https://cdn.exemplo.com.br/doc.txt'] = paginaOk('conteúdo público');

    await ingestUrl('org-1', 'https://site.exemplo.com.br/doc');
    expect(chamadasHttp).toEqual([
      'https://site.exemplo.com.br/doc',
      'https://cdn.exemplo.com.br/doc.txt',
    ]);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('desiste depois de 3 redirecionamentos', async () => {
    for (let i = 0; i <= 4; i++) {
      dns[`salto${i}.exemplo.com.br`] = [{ address: '93.184.216.34', family: 4 }];
      respostas[`https://salto${i}.exemplo.com.br/x`] = redirecionaPara(
        `https://salto${i + 1}.exemplo.com.br/x`,
      );
    }
    // Redirecionamento demais também é destino que não dá para ler: a frase é a
    // mesma, e ela diz o que fazer (colar o texto ou usar o endereço final).
    await expect(ingestUrl('org-1', 'https://salto0.exemplo.com.br/x')).rejects.toThrow(
      MENSAGEM_URL_NAO_PUBLICA,
    );
  });

  it('o pedido vai com o endereço já resolvido e sem seguir redirecionamento sozinho', async () => {
    dns['site.exemplo.com.br'] = [{ address: '93.184.216.34', family: 4 }];
    respostas['https://site.exemplo.com.br/doc'] = paginaOk('olá');

    await ingestUrl('org-1', 'https://site.exemplo.com.br/doc');
    const config = axiosGet.mock.calls[0][1] as any;
    expect(config.maxRedirects).toBe(0);
    expect(config.timeout).toBe(30_000);
    expect(config.maxContentLength).toBe(20 * 1024 * 1024);
    // O `lookup` fixo é o que impede o endereço mudar entre a checagem e a
    // conexão (o clássico DNS rebinding).
    expect(typeof config.lookup).toBe('function');
    const devolvido = await new Promise((resolve) =>
      config.lookup('site.exemplo.com.br', {}, (_e: any, endereco: string) => resolve(endereco)),
    );
    expect(devolvido).toBe('93.184.216.34');
  });
});

describe('conciliação com o PR #366: rede social, User-Agent e frases (A016 + A012)', () => {
  it('perfil de rede social é recusado ANTES de gastar requisição', async () => {
    await expect(ingestUrl('org-1', 'https://www.instagram.com/alguem/')).rejects.toThrow(
      MENSAGEM_REDE_SOCIAL,
    );
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('erro de rede vira "não consegui ler a página", não "endereço não é público"', async () => {
    dns['site.exemplo.com.br'] = [{ address: '93.184.216.34', family: 4 }];
    // Nenhuma resposta cadastrada: o axios falso lança erro comum de rede.
    await expect(ingestUrl('org-1', 'https://site.exemplo.com.br/doc')).rejects.toThrow(
      /não consegui ler|ler esta página|página/i,
    );
    await expect(ingestUrl('org-1', 'https://site.exemplo.com.br/doc')).rejects.not.toThrow(
      MENSAGEM_URL_NAO_PUBLICA,
    );
  });
});
