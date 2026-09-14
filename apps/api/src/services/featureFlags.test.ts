/**
 * featureFlags.test.ts
 * ============================================================================
 * Interruptor por organização. O que estes testes protegem:
 *   1. Nenhuma flag do registro pode ficar com a data de remoção no passado.
 *      Flag sem prazo vira código morto permanente.
 *   2. Banco quebrado nunca liga comportamento novo: o padrão é sempre false.
 *   3. Mudar a flag invalida o cache na hora (senão o cliente esperaria 30 s
 *      para ver o efeito e a gente acharia que a rota não funcionou).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
  FLAGS,
  FLAG_CACHE_TTL_SECONDS,
  flagCacheKey,
  isFlagOn,
  setFlag,
  listFlags,
} = await import('./featureFlags.js');

/** Cache falso em memória, com registro das chamadas. */
function makeFakeCache() {
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

/** Banco falso: uma linha por (organizationId, flag). */
function makeFakeDb(rows: any[] = []) {
  return {
    rows,
    orgFeatureFlag: {
      findUnique: vi.fn(async ({ where }: any) => {
        const { organizationId, flag } = where.organizationId_flag;
        return rows.find((r) => r.organizationId === organizationId && r.flag === flag) ?? null;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        rows.filter((r) => r.organizationId === where.organizationId),
      ),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const { organizationId, flag } = where.organizationId_flag;
        const atual = rows.find((r) => r.organizationId === organizationId && r.flag === flag);
        if (atual) {
          Object.assign(atual, update);
          return atual;
        }
        const nova = { ...create };
        rows.push(nova);
        return nova;
      }),
    },
  };
}

describe('registro FLAGS', () => {
  it('tem as sete flags previstas no plano', () => {
    expect(Object.keys(FLAGS).sort()).toEqual(
      [
        'compositorUnico',
        'evalNoTier',
        'guardaComercial',
        'perfilVivo',
        'ragNoChatDoSite',
        // C3: as correções aprovadas viram registros e o bloco de regras
        // entra no prompt só com este interruptor ligado.
        'regrasComoRegistros',
        'treinarSomenteAdmin',
      ].sort(),
    );
  });

  it('nenhuma flag tem prazo de remoção vencido (força a limpeza)', () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencidas: string[] = [];
    for (const [nome, def] of Object.entries(FLAGS)) {
      expect(def.descricao.length).toBeGreaterThan(10);
      expect(def.removeBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (new Date(`${def.removeBy}T00:00:00Z`).getTime() < hoje.getTime()) {
        vencidas.push(`${nome} (removeBy ${def.removeBy})`);
      }
    }
    expect(
      vencidas,
      `Flags com prazo vencido. Tire o interruptor do código ou renegocie a data: ${vencidas.join(', ')}`,
    ).toEqual([]);
  });
});

describe('isFlagOn', () => {
  let cache: ReturnType<typeof makeFakeCache>;
  beforeEach(() => {
    cache = makeFakeCache();
  });

  it('devolve false quando a organização não tem a linha', async () => {
    const db = makeFakeDb([]);
    const ligada = await isFlagOn('org-1', 'perfilVivo', { db: db as any, cache: cache as any });
    expect(ligada).toBe(false);
  });

  it('devolve true quando a linha está ligada e guarda no cache por 30 s', async () => {
    const db = makeFakeDb([{ organizationId: 'org-1', flag: 'perfilVivo', enabled: true }]);
    const ligada = await isFlagOn('org-1', 'perfilVivo', { db: db as any, cache: cache as any });

    expect(ligada).toBe(true);
    expect(cache.set).toHaveBeenCalledWith(
      flagCacheKey('org-1', 'perfilVivo'),
      '1',
      FLAG_CACHE_TTL_SECONDS,
    );
    expect(FLAG_CACHE_TTL_SECONDS).toBe(30);
  });

  it('lê do cache sem tocar no banco na segunda chamada', async () => {
    const db = makeFakeDb([{ organizationId: 'org-1', flag: 'perfilVivo', enabled: true }]);
    const deps = { db: db as any, cache: cache as any };

    await isFlagOn('org-1', 'perfilVivo', deps);
    await isFlagOn('org-1', 'perfilVivo', deps);

    expect(db.orgFeatureFlag.findUnique).toHaveBeenCalledTimes(1);
  });

  it('devolve false com o banco quebrado (nunca liga comportamento novo por erro)', async () => {
    const db = {
      orgFeatureFlag: {
        findUnique: vi.fn(async () => {
          throw new Error('P1001: banco fora do ar');
        }),
      },
    };
    const ligada = await isFlagOn('org-1', 'perfilVivo', { db: db as any, cache: cache as any });
    expect(ligada).toBe(false);
  });

  it('cache que lança derruba a leitura para desligado (padrão false em qualquer erro)', async () => {
    const cacheRuim = {
      get: vi.fn(async () => {
        throw new Error('redis fora do ar');
      }),
      set: vi.fn(async () => true),
      del: vi.fn(async () => true),
    };
    const db = makeFakeDb([{ organizationId: 'org-1', flag: 'perfilVivo', enabled: true }]);
    const ligada = await isFlagOn('org-1', 'perfilVivo', {
      db: db as any,
      cache: cacheRuim as any,
    });

    // A flag está LIGADA no banco, e ainda assim a resposta é false: um cache
    // que lança é erro, e erro nunca liga comportamento novo no cliente.
    // O cache real (RedisCacheProvider) é fail-soft e devolve null em vez de
    // lançar, então na prática este caminho é a rede de proteção.
    expect(db.rows[0].enabled).toBe(true);
    expect(ligada).toBe(false);
  });
});

describe('setFlag', () => {
  it('grava a linha e invalida o cache na hora', async () => {
    const cache = makeFakeCache();
    const db = makeFakeDb([]);
    const deps = { db: db as any, cache: cache as any };

    // Primeiro alguém lê: o false entra no cache.
    expect(await isFlagOn('org-1', 'perfilVivo', deps)).toBe(false);
    expect(cache.store.get(flagCacheKey('org-1', 'perfilVivo'))).toBe('0');

    await setFlag('org-1', 'perfilVivo', true, 'rodrigo@machia.tech', undefined, deps);

    expect(cache.del).toHaveBeenCalledWith(flagCacheKey('org-1', 'perfilVivo'));
    expect(cache.store.has(flagCacheKey('org-1', 'perfilVivo'))).toBe(false);
    // E a leitura seguinte já enxerga o valor novo.
    expect(await isFlagOn('org-1', 'perfilVivo', deps)).toBe(true);
  });

  it('registra quem mudou e herda o prazo do registro quando não vem no corpo', async () => {
    const db = makeFakeDb([]);
    const deps = { db: db as any, cache: makeFakeCache() as any };

    await setFlag('org-1', 'guardaComercial', true, 'rodrigo@machia.tech', undefined, deps);

    expect(db.rows[0]).toMatchObject({
      organizationId: 'org-1',
      flag: 'guardaComercial',
      enabled: true,
      updatedBy: 'rodrigo@machia.tech',
    });
    expect(db.rows[0].removeBy).toEqual(new Date(`${FLAGS.guardaComercial.removeBy}T00:00:00Z`));
  });

  it('recusa flag que não existe no registro', async () => {
    const db = makeFakeDb([]);
    const deps = { db: db as any, cache: makeFakeCache() as any };

    await expect(
      setFlag('org-1', 'flagInventada' as any, true, 'x@y.com', undefined, deps),
    ).rejects.toThrow(/flagInventada/);
    expect(db.rows).toHaveLength(0);
  });
});

describe('listFlags', () => {
  it('devolve o registro inteiro com o estado da organização', async () => {
    const db = makeFakeDb([
      {
        organizationId: 'org-1',
        flag: 'perfilVivo',
        enabled: true,
        updatedBy: 'rodrigo@machia.tech',
        updatedAt: new Date('2026-09-14T12:00:00Z'),
        removeBy: new Date('2026-12-31T00:00:00Z'),
      },
    ]);

    const lista = await listFlags('org-1', { db: db as any, cache: makeFakeCache() as any });

    expect(lista).toHaveLength(Object.keys(FLAGS).length);
    const viva = lista.find((f) => f.flag === 'perfilVivo')!;
    expect(viva.enabled).toBe(true);
    expect(viva.updatedBy).toBe('rodrigo@machia.tech');
    expect(viva.descricao).toBe(FLAGS.perfilVivo.descricao);

    const outra = lista.find((f) => f.flag === 'evalNoTier')!;
    expect(outra.enabled).toBe(false);
    expect(outra.updatedBy).toBeNull();
    expect(outra.removeBy).toBe(FLAGS.evalNoTier.removeBy);
  });

  it('devolve tudo desligado com o banco quebrado', async () => {
    const db = {
      orgFeatureFlag: {
        findMany: vi.fn(async () => {
          throw new Error('P1001');
        }),
      },
    };
    const lista = await listFlags('org-1', { db: db as any, cache: makeFakeCache() as any });
    expect(lista).toHaveLength(Object.keys(FLAGS).length);
    expect(lista.every((f) => f.enabled === false)).toBe(true);
  });
});
