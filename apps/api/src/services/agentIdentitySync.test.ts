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
  beforeEach(() => {
    db = {
      agent: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ag1',
          name: 'Vera',
          systemPrompt: PROMPT_VERA,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
  });

  it('propaga o nome novo para o Agent e para o prompt', async () => {
    const out = await syncAgentIdentity(db, 'org-cmj', 'Sofia');

    expect(out.synced).toBe(true);
    expect(out.nomeAntigo).toBe('Vera');
    expect(out.promptAtualizado).toBe(true);

    const data = db.agent.update.mock.calls[0][0].data;
    expect(data.name).toBe('Sofia');
    expect(data.systemPrompt).toContain('Você é Sofia');
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
    // Não destrói o prompt customizado.
    expect(data.systemPrompt).toBeUndefined();
  });

  it('erro no banco não derruba o save do cliente', async () => {
    db.agent.findFirst.mockRejectedValue(new Error('db down'));
    const out = await syncAgentIdentity(db, 'org-cmj', 'Sofia');
    expect(out.synced).toBe(false);
  });
});
