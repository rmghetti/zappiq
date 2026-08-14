/**
 * Equipe profissional (14/08) — contratos de segurança e ciclo de vida.
 *
 * Mesmo padrão de settings.security.test.ts: teste puro (vitest, zero I/O)
 * sobre os helpers extraídos do route handler, porque o repo não tem harness
 * supertest (server.ts puxa Redis/OTel/BullMQ).
 *
 * O que está travado aqui:
 *  1. Whitelist de papéis atribuíveis — um ADMIN de org NÃO pode criar/promover
 *     SUPERADMIN (papel de plataforma, cross-tenant). Era possível antes.
 *  2. Senha temporária forte gerada no servidor quando o admin não digita uma.
 *  3. Guardas de ciclo de vida: ninguém mexe no próprio papel/status, e a org
 *     nunca fica sem ADMIN ativo.
 *  4. Guarda estática: rotas de escrita de /team aceitam ADMIN + SUPERADMIN
 *     (onboarding assistido via override), nunca ADMIN sozinho.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  teamCreateSchema,
  teamUpdateSchema,
  generateTempPassword,
  guardTeamChange,
  ASSIGNABLE_ROLES,
} from './settings.team.js';

// ── Whitelist de papéis ─────────────────────────────────────────────────────
describe('teamCreateSchema — criar membro', () => {
  it('aceita membro válido sem senha (servidor gera temporária)', () => {
    const r = teamCreateSchema.safeParse({ name: 'Ana Souza', email: 'Ana@Empresa.com', role: 'AGENT' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('ana@empresa.com'); // normalizado
  });

  it('aceita senha própria com 8+ caracteres', () => {
    const r = teamCreateSchema.safeParse({ name: 'Ana', email: 'a@b.com', role: 'ADMIN', password: 'segura123' });
    expect(r.success).toBe(true);
  });

  it('REJEITA papel SUPERADMIN (escalada para admin de plataforma)', () => {
    const r = teamCreateSchema.safeParse({ name: 'Mal', email: 'mal@x.com', role: 'SUPERADMIN', password: 'senha1234' });
    expect(r.success).toBe(false);
  });

  it('REJEITA papel desconhecido', () => {
    const r = teamCreateSchema.safeParse({ name: 'X', email: 'x@x.com', role: 'HACKER' });
    expect(r.success).toBe(false);
  });

  it('REJEITA e-mail inválido e senha curta', () => {
    expect(teamCreateSchema.safeParse({ name: 'X', email: 'nao-eh-email', role: 'AGENT' }).success).toBe(false);
    expect(teamCreateSchema.safeParse({ name: 'X', email: 'x@x.com', role: 'AGENT', password: 'curta' }).success).toBe(false);
  });

  it('REJEITA campo extra (organizationId injetado) por causa do .strict()', () => {
    const r = teamCreateSchema.safeParse({ name: 'X', email: 'x@x.com', role: 'AGENT', organizationId: 'outra-org' });
    expect(r.success).toBe(false);
  });

  it('ASSIGNABLE_ROLES cobre os 4 papéis de organização e nada além', () => {
    expect([...ASSIGNABLE_ROLES].sort()).toEqual(['ADMIN', 'AGENT', 'AUDITOR', 'SUPERVISOR']);
  });
});

describe('teamUpdateSchema — editar membro', () => {
  it('aceita mudança de papel, ativação e nome', () => {
    expect(teamUpdateSchema.safeParse({ role: 'SUPERVISOR' }).success).toBe(true);
    expect(teamUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(teamUpdateSchema.safeParse({ name: 'Novo Nome' }).success).toBe(true);
  });

  it('REJEITA promover a SUPERADMIN', () => {
    expect(teamUpdateSchema.safeParse({ role: 'SUPERADMIN' }).success).toBe(false);
  });

  it('REJEITA corpo vazio (PUT sem efeito)', () => {
    expect(teamUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('REJEITA mass assignment (passwordHash/email por esta rota)', () => {
    expect(teamUpdateSchema.safeParse({ passwordHash: 'hack' }).success).toBe(false);
    expect(teamUpdateSchema.safeParse({ email: 'novo@x.com' }).success).toBe(false);
  });
});

// ── Senha temporária ────────────────────────────────────────────────────────
describe('generateTempPassword', () => {
  it('gera 12+ caracteres com maiúscula, minúscula e dígito', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateTempPassword();
      expect(p.length).toBeGreaterThanOrEqual(12);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
    }
  });

  it('não repete entre chamadas', () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword());
  });
});

// ── Guardas de ciclo de vida ────────────────────────────────────────────────
describe('guardTeamChange — proteções de papel e remoção', () => {
  const admin = { id: 'u-admin', role: 'ADMIN', isActive: true };
  const other = { id: 'u-agent', role: 'AGENT', isActive: true };

  it('bloqueia remover a si mesmo', () => {
    const r = guardTeamChange({ requesterUserId: 'u-admin', target: admin, change: { remove: true }, activeAdminCount: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('bloqueia alterar o próprio papel', () => {
    const r = guardTeamChange({ requesterUserId: 'u-admin', target: admin, change: { role: 'AGENT' }, activeAdminCount: 2 });
    expect(r.ok).toBe(false);
  });

  it('bloqueia desativar a si mesmo', () => {
    const r = guardTeamChange({ requesterUserId: 'u-admin', target: admin, change: { isActive: false }, activeAdminCount: 2 });
    expect(r.ok).toBe(false);
  });

  it('bloqueia rebaixar o último ADMIN ativo (mesmo por outro requisitante)', () => {
    const r = guardTeamChange({ requesterUserId: 'u-super', target: admin, change: { role: 'AGENT' }, activeAdminCount: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ADMIN ativo/);
  });

  it('bloqueia desativar e remover o último ADMIN ativo', () => {
    expect(guardTeamChange({ requesterUserId: 'u-super', target: admin, change: { isActive: false }, activeAdminCount: 1 }).ok).toBe(false);
    expect(guardTeamChange({ requesterUserId: 'u-super', target: admin, change: { remove: true }, activeAdminCount: 1 }).ok).toBe(false);
  });

  it('permite rebaixar ADMIN quando existe outro ADMIN ativo', () => {
    expect(guardTeamChange({ requesterUserId: 'u-super', target: admin, change: { role: 'SUPERVISOR' }, activeAdminCount: 2 }).ok).toBe(true);
  });

  it('permite mudanças normais em não-admin (papel, desativar, remover)', () => {
    expect(guardTeamChange({ requesterUserId: 'u-admin', target: other, change: { role: 'SUPERVISOR' }, activeAdminCount: 1 }).ok).toBe(true);
    expect(guardTeamChange({ requesterUserId: 'u-admin', target: other, change: { isActive: false }, activeAdminCount: 1 }).ok).toBe(true);
    expect(guardTeamChange({ requesterUserId: 'u-admin', target: other, change: { remove: true }, activeAdminCount: 1 }).ok).toBe(true);
  });

  it('permite editar o próprio nome (só nome não é mudança sensível)', () => {
    expect(guardTeamChange({ requesterUserId: 'u-admin', target: admin, change: {}, activeAdminCount: 1 }).ok).toBe(true);
  });
});

// ── Guarda estática: SUPERADMIN nunca fica de fora das rotas de equipe ──────
describe('settings.ts — rotas de escrita de /team aceitam ADMIN + SUPERADMIN', () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'settings.ts'),
    'utf8',
  );

  it("nenhuma rota /team usa requireRole('ADMIN') sozinho", () => {
    const teamRouteLines = source.split('\n').filter((l) => l.includes("'/team"));
    for (const line of teamRouteLines) {
      expect(line, `rota de equipe com gate incompleto: ${line.trim()}`).not.toMatch(
        /requireRole\('ADMIN'\)/,
      );
    }
  });

  it('POST, PUT e DELETE de /team têm requireRole com SUPERADMIN', () => {
    for (const verb of ['post', 'put', 'delete']) {
      const re = new RegExp(`router\\.${verb}\\('/team[^']*',\\s*requireRole\\('ADMIN',\\s*'SUPERADMIN'\\)`);
      expect(re.test(source), `router.${verb} de /team sem ADMIN+SUPERADMIN`).toBe(true);
    }
  });
});
