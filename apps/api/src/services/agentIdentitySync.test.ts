/**
 * agentIdentitySync.test.ts
 * ============================================================================
 * O cliente renomeava a IA em "Treinar IA > Identidade" e nada acontecia: o
 * PUT gravava só em organization.settings, e o agente em produção (que vem da
 * tabela Agent) continuava com o nome antigo.
 *
 * Regra que este teste protege: o que o cliente edita chega ao agente DELE, e
 * nenhuma customização acumulada no prompt é destruída no caminho.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { renameAgentInPrompt, syncAgentIdentity } = await import('./agentIdentitySync.js');

// Trecho real do prompt da Vera (CMJ), como está em produção.
const PROMPT_VERA = `## IDENTIDADE
Você é Vera, atendente virtual da empresa da CMJ.
Data/hora atual: 05/07/2026, 01:24:07 (Fuso: America/Sao_Paulo)

## INSTRUÇÕES GERAIS
- Seja CONCISO e DIRETO.

Lembre-se: você representa CMJ.`;

describe('renameAgentInPrompt', () => {
  it('troca o nome na linha de identidade e preserva o resto', () => {
    const novo = renameAgentInPrompt(PROMPT_VERA, 'Vera', 'Sofia')!;
    expect(novo).toContain('Você é Sofia, atendente virtual da empresa da CMJ.');
    expect(novo).not.toContain('Você é Vera');
    // O resto do prompt fica intacto.
    expect(novo).toContain('Seja CONCISO e DIRETO');
    expect(novo).toContain('Lembre-se: você representa CMJ.');
    expect(novo).toContain('Data/hora atual');
  });

  it('não mexe se o nome não mudou', () => {
    expect(renameAgentInPrompt(PROMPT_VERA, 'Vera', 'Vera')).toBeNull();
    expect(renameAgentInPrompt(PROMPT_VERA, 'Vera', ' Vera ')).toBeNull();
  });

  it('não mexe se não achar a linha de identidade (prompt customizado)', () => {
    expect(renameAgentInPrompt('prompt totalmente customizado', 'Vera', 'Sofia')).toBeNull();
  });

  it('não quebra com nome que tem caractere de regex', () => {
    const p = 'Você é A+B, atendente virtual da X.';
    expect(renameAgentInPrompt(p, 'A+B', 'C')).toContain('Você é C, atendente');
  });

  it('troca só a linha de identidade, não outras ocorrências do nome', () => {
    const p = `Você é Vera, atendente da CMJ.\nO cliente pode perguntar pela Vera na recepção.`;
    const novo = renameAgentInPrompt(p, 'Vera', 'Sofia')!;
    expect(novo).toContain('Você é Sofia, atendente');
    // A segunda menção é conteúdo do cliente, não identidade: não mexemos.
    expect(novo).toContain('perguntar pela Vera na recepção');
  });
});

describe('syncAgentIdentity', () => {
  let db: any;
  let raw: string[];
  beforeEach(() => {
    raw = [];
    db = {
      // Colaboradores do publishPrompt: o prompt novo passa por lá, para a
      // troca de nome entrar no histórico com a origem certa.
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        raw.push(`${strings.join('?')} :: ${values.join('|')}`);
        return 1;
      }),
      agentPromptVersion: {
        findFirst: vi.fn().mockResolvedValue({ version: 7, hash: 'abc' }),
      },
      agent: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ag1',
          name: 'Vera',
          systemPrompt: PROMPT_VERA,
        }),
        findUnique: vi.fn().mockResolvedValue({ systemPrompt: PROMPT_VERA }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
  });

  it('propaga o nome novo para o Agent e para o prompt', async () => {
    const out = await syncAgentIdentity(db, 'org-cmj', 'Sofia');

    expect(out.synced).toBe(true);
    expect(out.nomeAntigo).toBe('Vera');
    expect(out.promptAtualizado).toBe(true);

    // 1a escrita: só o nome do agente.
    const primeira = db.agent.update.mock.calls[0][0].data;
    expect(primeira.name).toBe('Sofia');
    expect(primeira.systemPrompt).toBeUndefined();

    // 2a escrita: o prompt, pelo publishPrompt, com a origem declarada.
    const segunda = db.agent.update.mock.calls[1][0].data;
    expect(segunda.systemPrompt).toContain('Você é Sofia');
    expect(raw.some((s) => s.includes('zappiq.prompt_source') && s.includes('identity_sync'))).toBe(
      true,
    );
  });

  it('não faz update quando o nome não mudou', async () => {
    const out = await syncAgentIdentity(db, 'org-cmj', 'Vera');
    expect(out.synced).toBe(false);
    expect(db.agent.update).not.toHaveBeenCalled();
  });

  it('ignora nome vazio', async () => {
    expect((await syncAgentIdentity(db, 'org-cmj', '   ')).synced).toBe(false);
    expect((await syncAgentIdentity(db, 'org-cmj', null)).synced).toBe(false);
    expect(db.agent.update).not.toHaveBeenCalled();
  });

  it('org sem Agent seedado não quebra', async () => {
    db.agent.findFirst.mockResolvedValue(null);
    expect((await syncAgentIdentity(db, 'org-nova', 'Sofia')).synced).toBe(false);
  });

  it('atualiza o nome mesmo se o prompt for customizado demais pra casar', async () => {
    db.agent.findFirst.mockResolvedValue({
      id: 'ag1',
      name: 'Vera',
      systemPrompt: 'prompt reescrito à mão, sem a linha padrão',
    });
    const out = await syncAgentIdentity(db, 'org-cmj', 'Sofia');

    expect(out.synced).toBe(true);
    expect(out.promptAtualizado).toBe(false);
    const data = db.agent.update.mock.calls[0][0].data;
    expect(data.name).toBe('Sofia');
    // Não destrói o prompt customizado: nem grava, nem versiona.
    expect(data.systemPrompt).toBeUndefined();
    expect(db.agent.update).toHaveBeenCalledOnce();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it('erro no banco não derruba o save do cliente', async () => {
    db.agent.findFirst.mockRejectedValue(new Error('db down'));
    const out = await syncAgentIdentity(db, 'org-cmj', 'Sofia');
    expect(out.synced).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * O nome e o prompt são a MESMA mudança do cliente.
 * --------------------------------------------------------------------
 * Quando o `db` é o prisma (e portanto sabe abrir transação), as duas
 * escritas tinham de entrar juntas. Estavam em transações separadas: se o
 * publishPrompt caísse, o agente ficava com o nome novo e o prompt velho,
 * ainda se apresentando como Vera.
 *
 * O banco falso abaixo imita o commit de verdade: escrita fora de
 * transação vale na hora, escrita dentro só vale se o bloco terminar.
 * ════════════════════════════════════════════════════════════════════ */
describe('syncAgentIdentity com transação', () => {
  const PROMPT_INICIAL = PROMPT_VERA;

  function bancoTransacional(opts: { falhaAoGravarPrompt?: boolean } = {}) {
    const gravado = { name: 'Vera', systemPrompt: PROMPT_INICIAL };

    /** Uma "conexão": lê do que está gravado, escreve no destino que receber. */
    function conexao(destino: { name?: string; systemPrompt?: string }) {
      return {
        $executeRaw: vi.fn(async () => 1),
        agentPromptVersion: {
          findFirst: vi.fn(async () => ({ version: 8, hash: 'h8' })),
        },
        agent: {
          findFirst: vi.fn(async () => ({
            id: 'ag1',
            name: gravado.name,
            systemPrompt: gravado.systemPrompt,
          })),
          findUnique: vi.fn(async () => ({
            systemPrompt: destino.systemPrompt ?? gravado.systemPrompt,
          })),
          update: vi.fn(async ({ data }: any) => {
            if (data.systemPrompt !== undefined && opts.falhaAoGravarPrompt) {
              throw new Error('banco caiu ao gravar o prompt');
            }
            if (data.name !== undefined) destino.name = data.name;
            if (data.systemPrompt !== undefined) destino.systemPrompt = data.systemPrompt;
            return {};
          }),
        },
      };
    }

    // Fora de transação, a escrita cai direto no que está gravado.
    const db: any = conexao(gravado);
    db.$transaction = vi.fn(async (fn: any) => {
      const rascunho: any = {};
      const saida = await fn(conexao(rascunho));
      // Chegou aqui: commit. Se o callback lançar, o rascunho morre com ele.
      Object.assign(gravado, rascunho);
      return saida;
    });

    return { db, gravado };
  }

  it('falha ao gravar o prompt não deixa o nome novo gravado', async () => {
    const { db, gravado } = bancoTransacional({ falhaAoGravarPrompt: true });

    const out = await syncAgentIdentity(db, 'org-cmj', 'Sofia');

    // Fail-soft na resposta ao cliente, como sempre foi.
    expect(out.synced).toBe(false);
    // Mas o banco não pode ter ficado pela metade.
    expect(gravado.name).toBe('Vera');
    expect(gravado.systemPrompt).toBe(PROMPT_INICIAL);
  });

  it('nome e prompt entram juntos quando tudo dá certo', async () => {
    const { db, gravado } = bancoTransacional();

    const out = await syncAgentIdentity(db, 'org-cmj', 'Sofia');

    expect(out.synced).toBe(true);
    expect(out.promptAtualizado).toBe(true);
    expect(gravado.name).toBe('Sofia');
    expect(gravado.systemPrompt).toContain('Você é Sofia');
    // As duas escritas foram no mesmo bloco.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
