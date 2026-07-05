/**
 * W2.6 — dois sistemas DSR paralelos.
 *
 * Bug: o portal público gravava em public.dsr_requests (Supabase) enquanto o
 * admin /dsr lê data_subject_requests (Prisma) — a solicitação do titular nunca
 * chegava na fila do admin. O fix unifica a gravação em data_subject_requests
 * via createPublicDsr(). Estes testes garantem:
 *   - mapeamento tipo pt-BR → enum Prisma;
 *   - validação do payload do portal;
 *   - resolução de org (slug → env → primeira org);
 *   - createPublicDsr grava 1 linha PENDING com SLA de 15 dias na fonte do admin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const findFirst = vi.fn();
const create = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
    dataSubjectRequest: {
      create: (...a: unknown[]) => create(...a),
    },
  },
}));

const {
  mapTipo,
  validatePortalDsr,
  resolveDsrOrganizationId,
  buildReason,
  createPublicDsr,
  DSR_DEADLINE_DAYS,
} = await import('./dsrIntake.js');

const basePayload = {
  tipo: 'EXCLUSAO' as const,
  nomeCompleto: 'Maria Souza',
  email: 'Maria@Example.COM',
  documento: '123.456.789-09',
  vinculo: 'CLIENTE' as const,
  confirmaIdentidade: true,
};

beforeEach(() => {
  findUnique.mockReset();
  findFirst.mockReset();
  create.mockReset();
  delete process.env.DSR_PLATFORM_ORG_SLUG;
});

describe('mapTipo — pt-BR → enum Prisma', () => {
  it('mapeia todos os tipos do portal', () => {
    expect(mapTipo('EXCLUSAO')).toBe('DELETION');
    expect(mapTipo('ACESSO')).toBe('ACCESS');
    expect(mapTipo('CORRECAO')).toBe('CORRECTION');
    expect(mapTipo('ANONIMIZACAO')).toBe('ANONYMIZATION');
    expect(mapTipo('PORTABILIDADE')).toBe('PORTABILITY');
    expect(mapTipo('REVOGACAO_CONSENTIMENTO')).toBe('CONSENT_REVOKE');
  });
});

describe('validatePortalDsr', () => {
  it('aceita e normaliza payload válido', () => {
    const r = validatePortalDsr(basePayload);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.email).toBe('maria@example.com'); // lowercased
      expect(r.data.documento).toBe('12345678909'); // só dígitos
      expect(r.data.nomeCompleto).toBe('Maria Souza');
    }
  });

  it('rejeita tipo inválido', () => {
    const r = validatePortalDsr({ ...basePayload, tipo: 'NOPE' });
    expect(r).toEqual({ ok: false, error: 'Tipo de solicitação inválido' });
  });

  it('rejeita e-mail inválido', () => {
    const r = validatePortalDsr({ ...basePayload, email: 'sem-arroba' });
    expect(r).toEqual({ ok: false, error: 'E-mail inválido' });
  });

  it('rejeita documento curto', () => {
    const r = validatePortalDsr({ ...basePayload, documento: '123' });
    expect(r).toEqual({ ok: false, error: 'Documento inválido (CPF ou CNPJ)' });
  });

  it('rejeita quando confirmaIdentidade não é true', () => {
    const r = validatePortalDsr({ ...basePayload, confirmaIdentidade: false });
    expect(r.ok).toBe(false);
  });

  it('rejeita vínculo inválido', () => {
    const r = validatePortalDsr({ ...basePayload, vinculo: 'XPTO' });
    expect(r).toEqual({ ok: false, error: 'Vínculo inválido' });
  });
});

describe('resolveDsrOrganizationId — ordem de resolução', () => {
  it('1) usa slug explícito quando encontrado', async () => {
    findUnique.mockResolvedValueOnce({ id: 'org-slug' });
    const id = await resolveDsrOrganizationId('minha-org');
    expect(id).toBe('org-slug');
    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: 'minha-org' },
      select: { id: true },
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('2) cai para DSR_PLATFORM_ORG_SLUG quando slug não resolve', async () => {
    process.env.DSR_PLATFORM_ORG_SLUG = 'zappiq-platform';
    findUnique
      .mockResolvedValueOnce(null) // slug explícito não achou
      .mockResolvedValueOnce({ id: 'org-platform' }); // platform slug achou
    const id = await resolveDsrOrganizationId('inexistente');
    expect(id).toBe('org-platform');
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('3) cai para a primeira org quando nada mais resolve', async () => {
    findFirst.mockResolvedValueOnce({ id: 'org-first' });
    const id = await resolveDsrOrganizationId(undefined);
    expect(id).toBe('org-first');
    expect(findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  });

  it('lança quando não há nenhuma org', async () => {
    findFirst.mockResolvedValueOnce(null);
    await expect(resolveDsrOrganizationId(undefined)).rejects.toThrow(/Nenhuma organização/);
  });
});

describe('buildReason', () => {
  it('inclui vínculo, documento, telefone e detalhes', () => {
    const reason = buildReason({
      ...basePayload,
      documento: '12345678909',
      telefone: '11999998888',
      detalhes: 'Quero excluir tudo',
    });
    expect(reason).toContain('Vínculo: CLIENTE');
    expect(reason).toContain('Documento: 12345678909');
    expect(reason).toContain('Telefone: 11999998888');
    expect(reason).toContain('Detalhes: Quero excluir tudo');
  });
});

describe('createPublicDsr — grava na fonte do admin', () => {
  it('cria 1 linha PENDING em data_subject_requests com SLA de 15 dias', async () => {
    findFirst.mockResolvedValueOnce({ id: 'org-first' });
    create.mockResolvedValueOnce({ id: 'clxdsr000abcd1234', dueDate: new Date('2026-07-20') });

    const valid = validatePortalDsr({ ...basePayload, tipo: 'ACESSO' });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;

    const result = await createPublicDsr(valid.data);

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.data.type).toBe('ACCESS');
    expect(arg.data.status).toBe('PENDING');
    expect(arg.data.requesterEmail).toBe('maria@example.com');
    expect(arg.data.requesterName).toBe('Maria Souza');
    expect(arg.data.organizationId).toBe('org-first');

    // dueDate ~= agora + 15 dias
    const now = Date.now();
    const due = (arg.data.dueDate as Date).getTime();
    const diffDays = Math.round((due - now) / 86400000);
    expect(diffDays).toBe(DSR_DEADLINE_DAYS);

    // protocolo derivado do id (últimos 8, upper)
    expect(result.protocol).toBe('DSR-ABCD1234');
    expect(result.id).toBe('clxdsr000abcd1234');
  });
});
