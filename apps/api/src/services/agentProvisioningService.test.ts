import { describe, it, expect, vi } from 'vitest';
import {
  ensureLiveAgentForOrg,
  buildSeedSystemPrompt,
  DEFAULT_AGENT_ROLE,
  type AgentProvisioningDb,
} from './agentProvisioningService.js';

/**
 * db fake: um Map em memória por (organizationId, role) simulando a tabela
 * agents. findFirst casa por where.organizationId + where.role; create insere.
 */
function makeFakeDb() {
  const rows: Array<{ id: string; organizationId: string; role: string; status: string; systemPrompt: string; name: string }> = [];
  let seq = 0;
  const db: AgentProvisioningDb & { rows: typeof rows } = {
    rows,
    agent: {
      findFirst: vi.fn(async (args: any) => {
        const { organizationId, role } = args.where;
        const found = rows.find((r) => r.organizationId === organizationId && r.role === role);
        return found ? { id: found.id } : null;
      }),
      create: vi.fn(async (args: any) => {
        const id = `agent-${++seq}`;
        rows.push({ id, ...args.data });
        return { id };
      }),
    },
  };
  return db;
}

describe('ensureLiveAgentForOrg', () => {
  it('cria um Agent live comercial quando a org não tem nenhum', async () => {
    const db = makeFakeDb();
    const r = await ensureLiveAgentForOrg(db, {
      organizationId: 'org-1',
      settings: { agentName: 'Bia', niche: 'varejo', businessName: 'Loja X', tone: 'friendly' },
    });

    expect(r.created).toBe(true);
    expect(r.role).toBe('comercial');
    expect(r.agentId).toBeTruthy();
    expect(db.agent.create).toHaveBeenCalledOnce();
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ organizationId: 'org-1', role: 'comercial', status: 'live', name: 'Bia' });
    expect(db.rows[0].systemPrompt.length).toBeGreaterThan(0);
  });

  it('é idempotente: 2a chamada NÃO cria nem duplica (no-op)', async () => {
    const db = makeFakeDb();
    const first = await ensureLiveAgentForOrg(db, { organizationId: 'org-1', settings: { agentName: 'Bia' } });
    const second = await ensureLiveAgentForOrg(db, { organizationId: 'org-1', settings: { agentName: 'Bia' } });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.agentId).toBe(first.agentId);
    expect(db.agent.create).toHaveBeenCalledOnce(); // só na 1a
    expect(db.rows).toHaveLength(1);
  });

  it('NÃO sobrescreve um Agent comercial já existente (customizado pelo cliente)', async () => {
    const db = makeFakeDb();
    // simula Agent pré-existente customizado (ex.: draft ou já editado)
    db.rows.push({ id: 'custom-1', organizationId: 'org-9', role: 'comercial', status: 'draft', systemPrompt: 'PROMPT CUSTOMIZADO', name: 'Zé' });

    const r = await ensureLiveAgentForOrg(db, { organizationId: 'org-9', settings: { agentName: 'Bia' } });

    expect(r.created).toBe(false);
    expect(r.agentId).toBe('custom-1');
    expect(db.agent.create).not.toHaveBeenCalled();
    expect(db.rows.find((x) => x.id === 'custom-1')!.systemPrompt).toBe('PROMPT CUSTOMIZADO');
  });

  it('usa fallbacks quando settings estão ausentes/vazias', async () => {
    const db = makeFakeDb();
    const r = await ensureLiveAgentForOrg(db, { organizationId: 'org-empty' });
    expect(r.created).toBe(true);
    expect(db.rows[0].name).toBe('Assistente');
    expect(db.rows[0].role).toBe(DEFAULT_AGENT_ROLE);
  });

  it('respeita override de role', async () => {
    const db = makeFakeDb();
    const r = await ensureLiveAgentForOrg(db, { organizationId: 'org-1', role: 'suporte', settings: { agentName: 'Ana' } });
    expect(r.role).toBe('suporte');
    expect(db.rows[0].role).toBe('suporte');
  });
});

describe('buildSeedSystemPrompt', () => {
  it('gera prompt com identidade do agente e do negócio', () => {
    const p = buildSeedSystemPrompt({ agentName: 'Bia', businessName: 'Loja X', niche: 'varejo', tone: 'friendly' });
    expect(p).toContain('Bia');
    expect(p).toContain('Loja X');
  });

  it('null/undefined safe (usa fallbacks Assistente/Empresa)', () => {
    expect(buildSeedSystemPrompt(null)).toContain('Assistente');
    expect(buildSeedSystemPrompt(undefined)).toContain('Empresa');
  });
});
