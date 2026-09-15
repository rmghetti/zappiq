/* ══════════════════════════════════════════════════════════════════════
 * Leitura única dos interruptores por turno (C1b, nota 1 da revisão de
 * 14/09).
 * --------------------------------------------------------------------
 * O turno lia até quatro interruptores (contextoUnico, perfilVivo,
 * regrasComoRegistros, modeloPorPolitica), cada um um GET no Redis. Com o
 * Redis fora, eram quatro GETs falhos por turno. Agora uma chamada devolve
 * todos, com o MESMO cache de 30 s e a MESMA invalidação ao ligar ou
 * desligar.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { FLAG_NAMES, FLAG_CACHE_TTL_SECONDS, flagsCacheKey, flagCacheKey, lerFlagsDaOrganizacao, setFlag } =
  await import('./featureFlags.js');

function cacheFalso() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string, _ttl?: number) => {
      store.set(k, v);
      return true;
    }),
    del: vi.fn(async (k: string) => {
      store.delete(k);
      return true;
    }),
  };
}

function bancoFalso(linhas: Array<{ organizationId: string; flag: string; enabled: boolean }>) {
  return {
    orgFeatureFlag: {
      findUnique: vi.fn(),
      findMany: vi.fn(async ({ where }: any) => linhas.filter((l) => l.organizationId === where.organizationId)),
      upsert: vi.fn(async () => ({})),
    },
  };
}

describe('lerFlagsDaOrganizacao', () => {
  it('uma leitura devolve TODOS os interruptores; o que não tem linha vem desligado', async () => {
    const cache = cacheFalso();
    const db = bancoFalso([
      { organizationId: 'org-1', flag: 'contextoUnico', enabled: true },
      { organizationId: 'org-1', flag: 'perfilVivo', enabled: false },
      { organizationId: 'org-2', flag: 'modeloPorPolitica', enabled: true },
    ]);

    const flags = await lerFlagsDaOrganizacao('org-1', { cache, db } as any);

    expect(Object.keys(flags).sort()).toEqual([...FLAG_NAMES].sort());
    expect(flags.contextoUnico).toBe(true);
    expect(flags.perfilVivo).toBe(false);
    expect(flags.modeloPorPolitica).toBe(false);
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(cache.get).toHaveBeenCalledWith(flagsCacheKey('org-1'));
    expect(db.orgFeatureFlag.findMany).toHaveBeenCalledTimes(1);
    expect(db.orgFeatureFlag.findUnique).not.toHaveBeenCalled();
  });

  it('guarda no cache pelos mesmos 30 s, e a segunda leitura não vai ao banco', async () => {
    const cache = cacheFalso();
    const db = bancoFalso([{ organizationId: 'org-1', flag: 'contextoUnico', enabled: true }]);

    await lerFlagsDaOrganizacao('org-1', { cache, db } as any);
    const segunda = await lerFlagsDaOrganizacao('org-1', { cache, db } as any);

    expect(cache.set).toHaveBeenCalledWith(flagsCacheKey('org-1'), expect.any(String), FLAG_CACHE_TTL_SECONDS);
    expect(db.orgFeatureFlag.findMany).toHaveBeenCalledTimes(1);
    expect(segunda.contextoUnico).toBe(true);
  });

  it('Redis fora: UMA tentativa só, e tudo desligado (fail-closed)', async () => {
    const cache = cacheFalso();
    cache.get.mockRejectedValue(new Error('redis down'));
    const db = bancoFalso([{ organizationId: 'org-1', flag: 'contextoUnico', enabled: true }]);

    const flags = await lerFlagsDaOrganizacao('org-1', { cache, db } as any);

    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  it('banco fora: tudo desligado, nunca lança', async () => {
    const cache = cacheFalso();
    const db = bancoFalso([]);
    db.orgFeatureFlag.findMany.mockRejectedValue(new Error('db down'));

    const flags = await lerFlagsDaOrganizacao('org-1', { cache, db } as any);
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  it('valor estranho no cache é ignorado e relido do banco', async () => {
    const cache = cacheFalso();
    cache.store.set(flagsCacheKey('org-1'), '{lixo');
    const db = bancoFalso([{ organizationId: 'org-1', flag: 'perfilVivo', enabled: true }]);

    const flags = await lerFlagsDaOrganizacao('org-1', { cache, db } as any);
    expect(flags.perfilVivo).toBe(true);
  });

  it('ligar ou desligar invalida as DUAS chaves: a do interruptor e a da leitura única', async () => {
    const cache = cacheFalso();
    const db = bancoFalso([]);
    await setFlag('org-1', 'contextoUnico', true, 'admin', null, { cache, db } as any);
    expect(cache.del).toHaveBeenCalledWith(flagCacheKey('org-1', 'contextoUnico'));
    expect(cache.del).toHaveBeenCalledWith(flagsCacheKey('org-1'));
  });
});
