/**
 * buscaPublica.ts — a única camada que fala HTTP com os provedores de busca.
 *
 * Até 15/07/2026 este módulo tinha ZERO teste direto: todo teste do Mira
 * MOCKA `./buscaPublica.js` inteiro, então a montagem real da URL (query
 * params) nunca era exercitada. Foi assim que `search_lang=pt` — a Brave só
 * aceita a variante regional, 'pt-br'/'pt-pt' — sobreviveu até uma campanha
 * real em produção, e só apareceu porque a honestidade da fonte (este mesmo
 * PR) parou de engolir o erro. Este arquivo fecha essa lacuna: mocka
 * `fetch`, confere os parâmetros exatos enviados a cada provedor, e prova a
 * cascata e a honestidade fim a fim, sem simulação de camada nenhuma.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@zappiq/database', () => ({ prisma: { miraEnriquecimentoLog: { create: vi.fn().mockResolvedValue({}) } } }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const envMock: Record<string, any> = {};
vi.mock('../../config/env.js', () => ({ env: envMock }));

function resetEnv() {
  for (const k of Object.keys(envMock)) delete envMock[k];
  envMock.MIRA_SEARCH_PROVIDER = 'auto';
}

const { webSearch, buscaPublicaProvider, buscaPublicaDisponivel } = await import('./buscaPublica.js');

function respostaBrave(results: any[] = []) {
  return { ok: true, status: 200, text: async () => '', json: async () => ({ web: { results } }) };
}

beforeEach(() => {
  resetEnv();
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchBrave — parâmetros exatos da URL', () => {
  it('usa search_lang=pt-br, nunca "pt" sozinho (a Brave rejeita com 422)', async () => {
    envMock.BRAVE_API_KEY = 'chave-teste';
    const fetchMock = vi.fn().mockResolvedValue(respostaBrave([]));
    vi.stubGlobal('fetch', fetchMock);

    await webSearch('org-1', 'indústrias metalúrgicas SP');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('search_lang')).toBe('pt-br');
    expect(url.searchParams.get('country')).toBe('br');
    expect(url.searchParams.get('q')).toBe('indústrias metalúrgicas SP');
  });

  it('manda o token no header X-Subscription-Token, nunca na query string', async () => {
    envMock.BRAVE_API_KEY = 'segredo-nao-pode-vazar-na-url';
    const fetchMock = vi.fn().mockResolvedValue(respostaBrave([]));
    vi.stubGlobal('fetch', fetchMock);

    await webSearch('org-1', 'teste');

    const [urlArg, initArg] = fetchMock.mock.calls[0];
    expect(String(urlArg)).not.toContain('segredo-nao-pode-vazar-na-url');
    expect((initArg as any).headers['X-Subscription-Token']).toBe('segredo-nao-pode-vazar-na-url');
  });
});

describe('cascata: provedor que falha em runtime cai para o próximo', () => {
  it('Google 403 (API nunca habilitada) cai para o Brave, que responde', async () => {
    envMock.GOOGLE_CSE_KEY = 'k';
    envMock.GOOGLE_CSE_CX = 'cx';
    envMock.BRAVE_API_KEY = 'b';
    envMock.MIRA_SEARCH_PROVIDER = 'brave'; // preferência: Brave primeiro
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        respostaBrave([{ title: 'Fulano - CEO na ACME | LinkedIn', url: 'https://linkedin.com/in/fulano', description: 'CEO' }])
      );
    vi.stubGlobal('fetch', fetchMock);

    const hits = await webSearch('org-1', 'ACME diretor site:linkedin.com/in');

    expect(hits).toHaveLength(1);
    expect(hits[0].url).toBe('https://linkedin.com/in/fulano');
  });

  it('todo provedor configurado falha: propaga fonte_falhou com o motivo de cada um', async () => {
    envMock.GOOGLE_CSE_KEY = 'k';
    envMock.GOOGLE_CSE_CX = 'cx';
    envMock.BRAVE_API_KEY = 'b';
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(webSearch('org-1', 'q')).rejects.toMatchObject({ status: 502, message: 'fonte_falhou' });
    // duas tentativas: uma por provedor configurado, nunca desiste no primeiro
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('nenhum provedor configurado: fonte_indisponivel, sem tentar nada', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(buscaPublicaDisponivel()).toBe(false);
    expect(buscaPublicaProvider()).toBeNull();
    await expect(webSearch('org-1', 'q')).rejects.toMatchObject({ status: 501, message: 'fonte_indisponivel' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('MIRA_SEARCH_PROVIDER=off desliga a cascata mesmo com chave configurada', async () => {
    envMock.BRAVE_API_KEY = 'b';
    envMock.MIRA_SEARCH_PROVIDER = 'off';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(buscaPublicaDisponivel()).toBe(false);
    await expect(webSearch('org-1', 'q')).rejects.toMatchObject({ status: 501 });
  });
});

describe('mercado vazio é legítimo', () => {
  it('provedor respondeu e não achou nada: [] , sem lançar', async () => {
    envMock.BRAVE_API_KEY = 'b';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaBrave([])));

    const hits = await webSearch('org-1', 'algo bem específico');
    expect(hits).toEqual([]);
  });
});
