/**
 * settings.team — regras de negócio da Equipe (14/08).
 *
 * Extraído do route handler para teste puro (padrão settings.schema.ts).
 * Três contratos de segurança:
 *
 *  1. ASSIGNABLE_ROLES: papéis que um admin de ORGANIZAÇÃO pode atribuir.
 *     SUPERADMIN fica de fora de propósito — é papel de PLATAFORMA
 *     (cross-tenant); antes desta whitelist um ADMIN conseguia criar um
 *     SUPERADMIN via POST /team e herdar o painel da plataforma inteira.
 *  2. Senha temporária forte gerada no servidor (fluxo sem servidor de
 *     e-mail: o admin copia do modal uma única vez e repassa ao membro).
 *  3. guardTeamChange: ninguém altera o próprio papel nem se desativa/remove,
 *     e a organização nunca fica sem pelo menos um ADMIN ativo.
 */
import { z } from 'zod';
import crypto from 'node:crypto';

export const ASSIGNABLE_ROLES = ['ADMIN', 'SUPERVISOR', 'AGENT', 'AUDITOR'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const roleSchema = z.enum(ASSIGNABLE_ROLES);

export const teamCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(120),
    email: z
      .string()
      .trim()
      .email('E-mail inválido')
      .transform((v) => v.toLowerCase()),
    role: roleSchema.default('AGENT'),
    // Opcional: sem senha, o servidor gera uma temporária e devolve UMA vez.
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(128).optional(),
  })
  .strict();

export const teamUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((d) => d.name !== undefined || d.role !== undefined || d.isActive !== undefined, {
    message: 'Nada para atualizar',
  });

/**
 * Senha temporária: 14 caracteres, alfabeto sem ambíguos (0/O, 1/l/I) e com
 * pelo menos uma maiúscula, uma minúscula e um dígito garantidos. crypto.randomInt
 * (CSPRNG) — Math.random não serve para credencial.
 */
export function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set: string) => set[crypto.randomInt(set.length)];
  const chars = Array.from({ length: 11 }, () => pick(all));
  chars.push(pick(upper), pick(lower), pick(digits));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface TeamTarget {
  id: string;
  role: string;
  isActive: boolean;
}

export interface TeamChange {
  role?: string;
  isActive?: boolean;
  remove?: boolean;
}

export type GuardResult = { ok: true } | { ok: false; status: number; error: string };

export function guardTeamChange(input: {
  requesterUserId: string;
  target: TeamTarget;
  change: TeamChange;
  /** Contagem de usuários ADMIN ativos na org (incluindo o alvo). */
  activeAdminCount: number;
}): GuardResult {
  const { requesterUserId, target, change, activeAdminCount } = input;
  const isSelf = target.id === requesterUserId;

  if (change.remove && isSelf) {
    return { ok: false, status: 400, error: 'Você não pode remover a si mesmo da equipe.' };
  }

  const changesOwnRole = isSelf && change.role !== undefined && change.role !== target.role;
  const deactivatesSelf = isSelf && change.isActive === false;
  if (changesOwnRole || deactivatesSelf) {
    return {
      ok: false,
      status: 400,
      error: 'Você não pode alterar o próprio papel nem se desativar. Peça a outro ADMIN.',
    };
  }

  const targetIsActiveAdmin = target.role === 'ADMIN' && target.isActive;
  const losesAdmin =
    change.remove === true ||
    (change.role !== undefined && change.role !== 'ADMIN') ||
    change.isActive === false;
  if (targetIsActiveAdmin && losesAdmin && activeAdminCount <= 1) {
    return {
      ok: false,
      status: 400,
      error: 'A organização precisa de pelo menos um ADMIN ativo. Promova outro membro antes.',
    };
  }

  return { ok: true };
}
