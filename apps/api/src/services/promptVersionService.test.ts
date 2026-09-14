/**
 * promptVersionService.test.ts
 * ============================================================================
 * Este é o ÚNICO caminho do produto que pode reescrever Agent.systemPrompt.
 * As regras que não podem quebrar, testadas com um banco falso:
 *   1. o contexto da versão (origem, decisão, autor) é gravado ANTES do
 *      update, na mesma transação — é ele que o gatilho do Postgres lê;
 *   2. expectedHash divergente lança PromptChangedError e NÃO grava nada;
 *   3. o hash calculado aqui é o mesmo md5 que o Postgres calcula;
 *   4. origem inválida é recusada antes de qualquer escrita.
 * ============================================================================
 */
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';

vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
  hashPrompt,
  publishPrompt,
  setPromptContext,
  PromptChangedError,
  PROMPT_SOURCES,
} = await import('./promptVersionService.js');

/**
 * Banco falso com a ordem das operações registrada. Imita o gatilho do
 * Postgres: todo update que MUDA o texto cria a próxima versão.
 */
function makeFakeDb(promptAtual = 'prompt inicial') {
  const chamadas: string[] = [];
  const raw: string[] = [];
  const versoes: Array<{ agentId: string; version: number; hash: string; source: string; decisionId: string | null; createdBy: string | null }> = [
    { agentId: 'ag1', version: 1, hash: hashPrompt(promptAtual), source: 'migracao', decisionId: null, createdBy: null },
  ];
  const estado = { systemPrompt: promptAtual, contexto: { source: '', decision: '', actor: '' } };

  const tx = {
    chamadas,
    raw,
    versoes,
    estado,
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.join('?');
      raw.push(`${sql} :: ${values.join('|')}`);
      chamadas.push('set_config');
      if (sql.includes('zappiq.prompt_source')) estado.contexto.source = String(values[0]);
      if (sql.includes('zappiq.prompt_decision')) estado.contexto.decision = String(values[0]);
      if (sql.includes('zappiq.prompt_actor')) estado.contexto.actor = String(values[0]);
      return 1;
    }),
    agent: {
      findUnique: vi.fn(async () => {
        chamadas.push('findUnique');
        return { systemPrompt: estado.systemPrompt };
      }),
      update: vi.fn(async ({ data }: any) => {
        chamadas.push('update');
        if (data.systemPrompt !== estado.systemPrompt) {
          estado.systemPrompt = data.systemPrompt;
          versoes.push({
            agentId: 'ag1',
            version: versoes.length + 1,
            hash: hashPrompt(data.systemPrompt),
            source: estado.contexto.source || 'fora_do_app',
            decisionId: estado.contexto.decision || null,
            createdBy: estado.contexto.actor || null,
          });
        }
        return { id: 'ag1' };
      }),
    },
    agentPromptVersion: {
      findFirst: vi.fn(async () => {
        chamadas.push('findFirst');
        return versoes[versoes.length - 1] ?? null;
      }),
    },
  };

  const db = {
    ...tx,
    $transaction: vi.fn(async (fn: any) => {
      chamadas.push('begin');
      const out = await fn(tx);
      chamadas.push('commit');
      return out;
    }),
  };

  return { db, tx };
}

describe('hashPrompt', () => {
  it('é o md5 hexadecimal, exatamente o que o Postgres calcula com md5()', () => {
    const texto = 'Você é Vera, atendente virtual da CMJ.';
    expect(hashPrompt(texto)).toBe(createHash('md5').update(texto, 'utf8').digest('hex'));
    expect(hashPrompt(texto)).toHaveLength(32);
  });

  it('texto vazio tem hash estável', () => {
    expect(hashPrompt('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
});

describe('PROMPT_SOURCES', () => {
  it('lista as origens previstas', () => {
    expect([...PROMPT_SOURCES].sort()).toEqual(
      ['fix_apply', 'fix_revert', 'identity_sync', 'manual', 'migracao', 'remediacao', 'seed'].sort(),
    );
  });
});

describe('publishPrompt', () => {
  it('grava o contexto ANTES do update, dentro da mesma transação', async () => {
    const { db, tx } = makeFakeDb('prompt velho');

    await publishPrompt(
      { agentId: 'ag1', systemPrompt: 'prompt novo', source: 'fix_apply', decisionId: 'dec-1', actor: 'rodrigo@machia.tech' },
      db as any,
    );

    expect(db.$transaction).toHaveBeenCalledOnce();
    const ordem = tx.chamadas;
    expect(ordem[0]).toBe('begin');
    expect(ordem.indexOf('set_config')).toBeLessThan(ordem.indexOf('update'));
    expect(ordem[ordem.length - 1]).toBe('commit');

    // Os três parâmetros de contexto foram para o Postgres.
    expect(tx.raw.some((s) => s.includes('zappiq.prompt_source') && s.includes('fix_apply'))).toBe(true);
    expect(tx.raw.some((s) => s.includes('zappiq.prompt_decision') && s.includes('dec-1'))).toBe(true);
    expect(tx.raw.some((s) => s.includes('zappiq.prompt_actor') && s.includes('rodrigo@machia.tech'))).toBe(true);
  });

  it('devolve a versão e o hash da versão recém-criada', async () => {
    const { db } = makeFakeDb('prompt velho');

    const out = await publishPrompt(
      { agentId: 'ag1', systemPrompt: 'prompt novo', source: 'manual' },
      db as any,
    );

    expect(out.version).toBe(2);
    expect(out.hash).toBe(hashPrompt('prompt novo'));
  });

  it('a origem chega na versão gravada pelo gatilho', async () => {
    const { db, tx } = makeFakeDb('prompt velho');

    await publishPrompt(
      { agentId: 'ag1', systemPrompt: 'prompt novo', source: 'identity_sync', actor: 'sistema' },
      db as any,
    );

    expect(tx.versoes[tx.versoes.length - 1]).toMatchObject({
      version: 2,
      source: 'identity_sync',
      createdBy: 'sistema',
    });
  });

  it('expectedHash divergente lança PromptChangedError e NÃO grava', async () => {
    const { db, tx } = makeFakeDb('prompt que o cliente já editou depois');

    await expect(
      publishPrompt(
        {
          agentId: 'ag1',
          systemPrompt: 'restaurando o de antes',
          source: 'fix_revert',
          expectedHash: hashPrompt('o prompt que existia quando a correção foi aplicada'),
        },
        db as any,
      ),
    ).rejects.toBeInstanceOf(PromptChangedError);

    expect(tx.agent.update).not.toHaveBeenCalled();
    expect(tx.estado.systemPrompt).toBe('prompt que o cliente já editou depois');
    expect(tx.versoes).toHaveLength(1);
  });

  it('expectedHash igual ao prompt atual grava normalmente', async () => {
    const { db, tx } = makeFakeDb('prompt atual');

    const out = await publishPrompt(
      {
        agentId: 'ag1',
        systemPrompt: 'prompt seguinte',
        source: 'fix_revert',
        expectedHash: hashPrompt('prompt atual'),
      },
      db as any,
    );

    expect(out.version).toBe(2);
    expect(tx.estado.systemPrompt).toBe('prompt seguinte');
  });

  it('origem fora da lista é recusada antes de qualquer escrita', async () => {
    const { db, tx } = makeFakeDb();

    await expect(
      publishPrompt({ agentId: 'ag1', systemPrompt: 'x', source: 'inventada' as any }, db as any),
    ).rejects.toThrow(/origem/i);

    expect(tx.agent.update).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('recusa agentId vazio', async () => {
    const { db, tx } = makeFakeDb();
    await expect(
      publishPrompt({ agentId: '', systemPrompt: 'x', source: 'manual' }, db as any),
    ).rejects.toThrow(/agentId/);
    expect(tx.agent.update).not.toHaveBeenCalled();
  });

  it('aceita um tx já aberto (sem $transaction) e não abre outra transação', async () => {
    const { tx } = makeFakeDb('prompt velho');

    const out = await publishPrompt(
      { agentId: 'ag1', systemPrompt: 'prompt novo', source: 'remediacao' },
      tx as any,
    );

    expect(out.version).toBe(2);
    expect(tx.chamadas).not.toContain('begin');
    expect(tx.agent.update).toHaveBeenCalledOnce();
  });

  it('prompt idêntico não cria versão nova (o gatilho ignora update sem mudança)', async () => {
    const { db, tx } = makeFakeDb('mesmo prompt');

    const out = await publishPrompt(
      { agentId: 'ag1', systemPrompt: 'mesmo prompt', source: 'manual' },
      db as any,
    );

    expect(tx.versoes).toHaveLength(1);
    expect(out.version).toBe(1);
  });
});

describe('setPromptContext', () => {
  it('manda as três variáveis com escopo de transação (is_local = true)', async () => {
    const { tx } = makeFakeDb();

    await setPromptContext(tx as any, { source: 'seed', decisionId: null, actor: null });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
    expect(tx.raw.every((s) => s.includes('true'))).toBe(true);
    expect(tx.estado.contexto.source).toBe('seed');
    expect(tx.estado.contexto.decision).toBe('');
    expect(tx.estado.contexto.actor).toBe('');
  });
});
