/**
 * Quem limpa o HTML depende da versão do serviço de indexação que está no ar.
 *
 * A janela de deploy não é simétrica: a API sobe sozinha ao fundir na main, e o
 * RAG só sobe depois, por workflow_dispatch. Nesse intervalo a API nova fala
 * com o RAG antigo, que aceita `text/html` como `text/*` e grava a PÁGINA
 * INTEIRA (script, menu, rodapé) no vetor, com selo verde de indexado na tela.
 *
 * A correção não depende de disciplina de deploy: a API pergunta ao RAG o que
 * ele sabe extrair (`extratores` no /ready) e escolhe o caminho. Com "html", a
 * página vai crua e o Readability roda lá. Sem o campo (RAG antigo) ou sem
 * resposta (serviço fora do ar), a API limpa aqui, como sempre fez.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ragGet = vi.fn();
const ragDelete = vi.fn();
const baixarPagina = vi.fn();

vi.mock('axios', () => {
  const instancia = {
    get: (...args: any[]) => ragGet(...args),
    post: vi.fn(),
    delete: (...args: any[]) => ragDelete(...args),
  };
  const fake = {
    create: () => instancia,
    get: (...args: any[]) => baixarPagina(...args),
  };
  return { default: fake, ...fake };
});

// O portão de destino (urlSegura.ts) resolve o nome antes de conectar. Sem este
// DNS falso o teste sairia para a rede de verdade, e o resultado passaria a
// depender de a máquina ter internet. `cmj.com.br` responde um endereço público
// combinado aqui.
vi.mock('node:dns', () => {
  const lookup = vi.fn(async (hostname: string) => {
    if (hostname === 'cmj.com.br') return [{ address: '93.184.216.34', family: 4 }];
    const err: any = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
    err.code = 'ENOTFOUND';
    throw err;
  });
  return { default: { promises: { lookup } }, promises: { lookup } };
});

// `incrby` e `del` entram aqui porque toda escrita de treino sobe a versão de
// configuração da organização, o que invalida o cache da busca (A010, A033).
vi.mock('./cloud/index.js', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    incrby: vi.fn().mockResolvedValue(2),
    del: vi.fn().mockResolvedValue(true),
  },
}));

const {
  deleteDocument,
  ingestUrl,
  ragCapabilities,
  esquecerCapacidadesDoRag,
  MENSAGEM_PAGINA_ILEGIVEL,
} = await import('./ragService.js');

const PAGINA = `<!doctype html><html><head><title>Cursos</title>
<style>.menu{color:red}</style><script>var rastreador = 1;</script></head>
<body><nav>Home Sobre Contato</nav>
<article><h1>Conselho do Futuro</h1><p>Doze encontros mensais &amp; mentoria.</p></article>
<footer>Todos os direitos reservados</footer></body></html>`;

/** O que foi enviado ao /ingest na última chamada. */
let enviado: FormData | null = null;

beforeEach(() => {
  esquecerCapacidadesDoRag();
  enviado = null;
  ragGet.mockReset();
  ragDelete.mockReset().mockResolvedValue({ data: { deleted: 3 } });
  baixarPagina.mockReset().mockResolvedValue({
    data: Buffer.from(PAGINA, 'utf-8'),
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: any) => {
      enviado = init.body as FormData;
      return {
        ok: true,
        status: 200,
        json: async () => ({ chunks_ingested: 2 }),
        text: async () => '',
      };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  esquecerCapacidadesDoRag();
});

const arquivoEnviado = async () => {
  const parte = enviado!.get('file') as Blob;
  return { tipo: parte.type, texto: await parte.text() };
};

const ragNovo = () =>
  ragGet.mockResolvedValue({
    data: { status: 'ready', extratores: ['pdf', 'docx', 'xlsx', 'html', 'texto'] },
  });

const ragAntigo = () =>
  ragGet.mockResolvedValue({ data: { status: 'ready', checks: {} } });

describe('ragCapabilities', () => {
  it('lê a lista de extratores do /ready', async () => {
    ragNovo();

    const capacidades = await ragCapabilities();

    expect(ragGet).toHaveBeenCalledWith('/ready');
    expect(capacidades.has('html')).toBe(true);
    expect(capacidades.has('docx')).toBe(true);
  });

  it('RAG sem o campo (versão anterior) não anuncia nada', async () => {
    ragAntigo();

    expect((await ragCapabilities()).has('html')).toBe(false);
  });

  it('serviço fora do ar não derruba a chamada: devolve lista vazia', async () => {
    ragGet.mockRejectedValue(new Error('connect ECONNREFUSED'));

    expect((await ragCapabilities()).size).toBe(0);
  });

  it('campo com formato inesperado é ignorado sem explodir', async () => {
    ragGet.mockResolvedValue({ data: { extratores: 'html' } });

    expect((await ragCapabilities()).has('html')).toBe(false);
  });

  it('pergunta uma vez e reusa por 5 minutos', async () => {
    ragNovo();

    await ragCapabilities();
    await ragCapabilities();
    await ragCapabilities();

    expect(ragGet).toHaveBeenCalledTimes(1);
  });

  it('depois de 5 minutos pergunta de novo (o RAG pode ter sido atualizado)', async () => {
    vi.useFakeTimers();
    try {
      ragAntigo();
      expect((await ragCapabilities()).has('html')).toBe(false);

      vi.advanceTimersByTime(5 * 60_000 + 1);
      ragNovo();

      expect((await ragCapabilities()).has('html')).toBe(true);
      expect(ragGet).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ingestUrl escolhe o caminho pela capacidade do RAG', () => {
  it('RAG novo recebe o HTML cru e a URL de origem', async () => {
    ragNovo();

    await ingestUrl('org-1', 'https://cmj.com.br/cursos', { source: 'doc-ck1' });

    const { tipo, texto } = await arquivoEnviado();
    expect(tipo).toBe('text/html');
    expect(texto).toContain('<article>');
    expect(enviado!.get('source_url')).toBe('https://cmj.com.br/cursos');
  });

  it('RAG antigo recebe texto limpo, e nunca a página inteira', async () => {
    ragAntigo();

    await ingestUrl('org-1', 'https://cmj.com.br/cursos', { source: 'doc-ck1' });

    const { tipo, texto } = await arquivoEnviado();
    expect(tipo).toBe('text/plain');
    expect(texto).toContain('Conselho do Futuro');
    expect(texto).toContain('Doze encontros mensais & mentoria.');
    expect(texto).not.toContain('<');
    expect(texto).not.toContain('var rastreador');
    expect(texto).not.toContain('color:red');
  });

  it('/ready fora do ar cai no caminho antigo, que é o seguro', async () => {
    ragGet.mockRejectedValue(new Error('connect ETIMEDOUT'));

    await ingestUrl('org-1', 'https://cmj.com.br/cursos', { source: 'doc-ck1' });

    const { tipo, texto } = await arquivoEnviado();
    expect(tipo).toBe('text/plain');
    expect(texto).not.toContain('<script');
  });

  it('página sem texto nenhum, no caminho antigo, é recusada em português', async () => {
    ragAntigo();
    baixarPagina.mockResolvedValue({
      data: Buffer.from('<html><script>x()</script></html>', 'utf-8'),
      headers: { 'content-type': 'text/html' },
    });

    await expect(
      ingestUrl('org-1', 'https://cmj.com.br/vazia', { source: 'doc-ck1' }),
    ).rejects.toMatchObject({ statusCode: 422, message: MENSAGEM_PAGINA_ILEGIVEL });
  });

  it('conteúdo que não é página (PDF numa URL) não passa pela limpeza de HTML', async () => {
    ragAntigo();
    baixarPagina.mockResolvedValue({
      data: Buffer.from('%PDF-1.4 conteúdo binário', 'utf-8'),
      headers: { 'content-type': 'application/pdf' },
    });

    await ingestUrl('org-1', 'https://cmj.com.br/ementa.pdf', { source: 'doc-ck1' });

    const { tipo, texto } = await arquivoEnviado();
    expect(tipo).toBe('application/pdf');
    expect(texto).toContain('%PDF-1.4');
  });

  it('endereço interno é recusado com 422, não com 503 "tente de novo"', async () => {
    ragNovo();

    await expect(ingestUrl('org-1', 'http://169.254.169.254/latest/meta-data')).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(baixarPagina).not.toHaveBeenCalled();
  });
});

describe('deleteDocument respeita a organização de quem chamou', () => {
  it('cada organização apaga dentro do próprio namespace', async () => {
    // O `source` é o mesmo nos dois casos de propósito: ids de documento são
    // únicos, mas um namespace errado apagaria conhecimento de outro cliente,
    // e não haveria como recuperar.
    await deleteDocument('cmo1yrbb600441jsk7yxf3vbb', 'doc-ck1');
    await deleteDocument('cmx9zzzz111112222233333aa', 'doc-ck1');

    const [primeira] = ragDelete.mock.calls[0];
    const [segunda] = ragDelete.mock.calls[1];

    expect(primeira).toBe('/ingest/org_cmo1yrbb600441jsk7yxf3vbb/doc-ck1');
    expect(segunda).toBe('/ingest/org_cmx9zzzz111112222233333aa/doc-ck1');
    expect(primeira).not.toBe(segunda);
  });

  it('título com barra e acento continua sendo uma única parte da URL', async () => {
    await deleteDocument('org-1', 'Política de troca s/ nota');

    const [caminho] = ragDelete.mock.calls[0];
    expect(caminho).toBe(
      `/ingest/org_org-1/${encodeURIComponent('Política de troca s/ nota')}`,
    );
  });
});
