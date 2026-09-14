/**
 * promptRemediationService.test.ts
 * ============================================================================
 * Este service reescreve Agent.systemPrompt de cliente em PRODUÇÃO. As regras
 * que não podem quebrar, testadas com um db falso:
 *   1. a org da ZappIQ NUNCA é tocada (lá o nosso link é legítimo);
 *   2. auditar não escreve nada, em hipótese alguma;
 *   3. não grava prompt que continua sujo;
 *   4. revert devolve byte a byte o que estava lá.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  auditarPrompts,
  aplicarRemediacao,
  reverterRemediacao,
  verificarNoBanco,
  IZA_ORG_ID,
  type RemediacaoDb,
} from './promptRemediationService.js';

const BLOCO = `### URLs canônicas ZappIQ (use EXATAMENTE essas, sem inventar variações)
- Signup / trial: https://zappiq.com.br/cadastro
- Site institucional: https://zappiq.com.br

`;

const promptCom = (quem: string) =>
  `## IDENTIDADE\nVocê é ${quem}.\n\n${BLOCO}### Segurança e Privacidade\n- Nunca peça cartão.`;

/** db falso: guarda as linhas em memória e registra todo update. */
function makeFakeDb(rows: any[]) {
  const updates: { id: string; systemPrompt: string }[] = [];
  /** Contexto que o publishPrompt manda ao Postgres antes de gravar. */
  const raw: string[] = [];
  const db: RemediacaoDb = {
    $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
      raw.push(`${strings.join('?')} :: ${values.join('|')}`);
      return 1;
    },
    agentPromptVersion: {
      findFirst: async () => ({ version: 2, hash: 'hash-falso' }),
    },
    agent: {
      findMany: async () => rows,
      update: async ({ where, data }: any) => {
        updates.push({ id: where.id, systemPrompt: data.systemPrompt });
        const row = rows.find((r) => r.id === where.id);
        if (row) row.systemPrompt = data.systemPrompt;
        return row;
      },
      findUnique: async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
    },
  };
  return { db, updates, rows, raw };
}

const linhas = () => [
  {
    id: 'a-cmj',
    name: 'Vera',
    organizationId: 'org-cmj',
    organization: { name: 'CMJ' },
    systemPrompt: promptCom('Vera, da CMJ'),
  },
  {
    id: 'a-iza',
    name: 'Iza',
    organizationId: IZA_ORG_ID,
    organization: { name: 'ZappIQ' },
    systemPrompt: promptCom('Iza, da ZappIQ'),
  },
  {
    id: 'a-limpo',
    name: 'Bia',
    organizationId: 'org-loja',
    organization: { name: 'Loja X' },
    systemPrompt: '## IDENTIDADE\nVocê é Bia.\n\n### Segurança\n- ok',
  },
];

describe('auditarPrompts', () => {
  it('acha só o prompt de CLIENTE contaminado', async () => {
    const { db } = makeFakeDb(linhas());
    const r = await auditarPrompts(db);

    expect(r.totalAgents).toBe(3);
    expect(r.afetados.map((a) => a.orgName)).toEqual(['CMJ']);
  });

  it('a org da ZappIQ é reportada, mas fica FORA da lista de correção', async () => {
    const { db } = makeFakeDb(linhas());
    const r = await auditarPrompts(db);

    expect(r.izaComBloco).toEqual(['Iza']);
    expect(r.afetados.some((a) => a.organizationId === IZA_ORG_ID)).toBe(false);
  });

  it('NÃO escreve nada (auditoria é read-only)', async () => {
    const { db, updates } = makeFakeDb(linhas());
    await auditarPrompts(db);

    expect(updates).toEqual([]);
  });

  it('já guarda o antes/depois pro snapshot e pro revert', async () => {
    const { db } = makeFakeDb(linhas());
    const [cmj] = (await auditarPrompts(db)).afetados;

    expect(cmj.promptAntes).toContain('zappiq.com.br');
    expect(cmj.promptDepois).not.toContain('zappiq.com.br');
    expect(cmj.removido).toContain('https://zappiq.com.br/cadastro');
  });
});

describe('aplicarRemediacao', () => {
  it('grava só o cliente e deixa a Iza intacta', async () => {
    const { db, updates, rows } = makeFakeDb(linhas());
    const r = await aplicarRemediacao(db, (await auditarPrompts(db)).afetados);

    expect(r.corrigidos).toBe(1);
    expect(updates.map((u) => u.id)).toEqual(['a-cmj']);

    const iza = rows.find((x) => x.id === 'a-iza');
    expect(iza.systemPrompt).toContain('https://zappiq.com.br/cadastro');
  });

  it('grava pelo publishPrompt, declarando a origem "remediacao"', async () => {
    const { db, raw } = makeFakeDb(linhas());
    await aplicarRemediacao(db, (await auditarPrompts(db)).afetados);

    expect(raw.some((s) => s.includes('zappiq.prompt_source') && s.includes('remediacao'))).toBe(
      true,
    );
  });

  it('recusa não declara origem nenhuma (não chega a escrever)', async () => {
    const { db, raw } = makeFakeDb(linhas());
    const itens = (await auditarPrompts(db)).afetados;
    itens[0].promptDepois = 'sobrou https://zappiq.com.br/cadastro aqui';

    await aplicarRemediacao(db, itens);

    expect(raw).toEqual([]);
  });

  it('depois de aplicar, o prompt do cliente não tem mais link nosso', async () => {
    const { db, rows } = makeFakeDb(linhas());
    await aplicarRemediacao(db, (await auditarPrompts(db)).afetados);

    const cmj = rows.find((x) => x.id === 'a-cmj');
    expect(cmj.systemPrompt).not.toContain('zappiq.com.br');
    expect(cmj.systemPrompt).toContain('### URLs (regra geral)');
    expect(cmj.systemPrompt).toContain('Você é Vera, da CMJ.');
    expect(cmj.systemPrompt).toContain('### Segurança e Privacidade');
  });

  it('recusa gravar se o prompt limpo AINDA tiver marca nossa', async () => {
    const { db, updates } = makeFakeDb(linhas());
    const itens = (await auditarPrompts(db)).afetados;
    // simula limpeza que não resolveu (ex.: link nosso repetido noutro trecho)
    itens[0].promptDepois = 'sobrou https://zappiq.com.br/cadastro aqui';

    const r = await aplicarRemediacao(db, itens);

    expect(r.corrigidos).toBe(0);
    expect(r.recusados[0].orgName).toBe('CMJ');
    expect(updates).toEqual([]);
  });

  it('idempotente: 2ª passada não acha mais nada', async () => {
    const { db } = makeFakeDb(linhas());
    await aplicarRemediacao(db, (await auditarPrompts(db)).afetados);

    expect((await auditarPrompts(db)).afetados).toEqual([]);
  });
});

describe('verificarNoBanco', () => {
  it('relê e confirma que ficou limpo', async () => {
    const { db } = makeFakeDb(linhas());
    const itens = (await auditarPrompts(db)).afetados;
    await aplicarRemediacao(db, itens);

    expect(await verificarNoBanco(db, itens)).toEqual([]);
  });
});

describe('reverterRemediacao', () => {
  it('devolve o prompt exatamente como estava', async () => {
    const { db, rows } = makeFakeDb(linhas());
    const original = rows.find((x) => x.id === 'a-cmj').systemPrompt;

    const itens = (await auditarPrompts(db)).afetados;
    await aplicarRemediacao(db, itens);
    expect(rows.find((x) => x.id === 'a-cmj').systemPrompt).not.toEqual(original);

    const n = await reverterRemediacao(db, itens);

    expect(n).toBe(1);
    expect(rows.find((x) => x.id === 'a-cmj').systemPrompt).toEqual(original);
  });

  it('o revert também passa pelo publishPrompt com origem "remediacao"', async () => {
    const { db, raw } = makeFakeDb(linhas());
    const itens = (await auditarPrompts(db)).afetados;
    await aplicarRemediacao(db, itens);
    raw.length = 0;

    await reverterRemediacao(db, itens);

    expect(raw.some((s) => s.includes('zappiq.prompt_source') && s.includes('remediacao'))).toBe(
      true,
    );
  });
});
