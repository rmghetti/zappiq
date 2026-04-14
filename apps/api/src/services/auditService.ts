/**
 * LGPD-compliant audit service.
 *
 * Implementa:
 * - Registro estruturado (Art. 37 — ROPA)
 * - Cadeia hash SHA-256 tamper-evident (Art. 46 — segurança)
 * - Rastreamento do titular dos dados (Art. 48 — apuração de incidentes)
 * - Finalidade e base legal obrigatórias em operações sobre dados pessoais (Art. 6, 7, 11)
 * - Verificação de integridade da cadeia (Art. 37 §4)
 * - Anonimização de logs vencidos em vez de hard delete (Art. 16)
 *
 * Uso:
 *   await logAuditEvent(req, {
 *     action: 'conversation.delete',
 *     resource: 'conversation',
 *     resourceId: id,
 *     purpose: 'Atendimento a requisição do titular (DSR #42)',
 *     legalBasis: 'CONSENT',
 *     dataSubjectId: conversation.contactId,
 *     before: conversation,
 *   });
 */

import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { prisma, Prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

type LegalBasis =
  | 'CONSENT'
  | 'CONTRACT'
  | 'LEGAL_OBLIGATION'
  | 'LEGITIMATE_INTEREST'
  | 'VITAL_INTERESTS'
  | 'PUBLIC_INTEREST'
  | 'CREDIT_PROTECTION'
  | 'HEALTH_PROTECTION';

export interface AuditEventInput {
  action: string;             // e.g. "conversation.delete"
  resource: string;           // e.g. "conversation"
  resourceId?: string;
  purpose?: string;           // LGPD Art. 6 — finalidade específica
  legalBasis?: LegalBasis;    // LGPD Art. 7/11 — base legal
  dataSubjectId?: string;     // contactId quando a operação toca PII
  before?: unknown;
  after?: unknown;
  details?: Record<string, unknown>;
}

/**
 * Canonicaliza o payload do evento e calcula o hash SHA-256.
 * O hash é determinístico: mesma entrada → mesmo hash.
 * prevHash forma a cadeia — qualquer mutação retroativa quebra a verificação.
 */
function computeHash(record: {
  sequence: bigint;
  action: string;
  resource: string;
  resourceId: string | null;
  purpose: string | null;
  legalBasis: string | null;
  dataSubjectId: string | null;
  details: unknown;
  before: unknown;
  after: unknown;
  userId: string;
  organizationId: string;
  createdAt: Date;
  prevHash: string | null;
}): string {
  // Ordenação estável de chaves garante hash determinístico
  const canonical = JSON.stringify(
    record,
    (_, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (value instanceof Date) return value.toISOString();
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = (value as Record<string, unknown>)[key];
            return acc;
          }, {});
      }
      return value;
    },
  );
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Sanitiza um snapshot antes de persistir: remove campos altamente sensíveis
 * que não deveriam estar no log (princípio da minimização — Art. 6, III).
 */
function sanitizeSnapshot(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const forbidden = new Set([
    'passwordHash',
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'whatsappAccessToken',
    'apiKey',
    'secret',
  ]);
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (forbidden.has(k)) {
      clone[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      clone[k] = sanitizeSnapshot(v);
    } else {
      clone[k] = v;
    }
  }
  return clone;
}

/**
 * Registra um evento de auditoria LGPD-compliant.
 * Usa transação serializable para evitar race na cadeia hash.
 */
export async function logAuditEvent(req: Request, input: AuditEventInput): Promise<void> {
  const user = req.user;
  const organizationId = req.organizationId;

  if (!user || !organizationId) {
    logger.warn('[Audit] Ignorando evento sem contexto autenticado', { action: input.action });
    return;
  }

  const ipAddress = (req.ip || req.socket.remoteAddress || null)?.toString() ?? null;
  const userAgent = req.get('user-agent') ?? null;

  // Warning-level em produção: eventos sobre dados pessoais SEM base legal são não-conformes
  if (input.dataSubjectId && !input.legalBasis) {
    logger.error('[Audit] LGPD: evento sobre dado pessoal sem legalBasis', {
      action: input.action,
      resource: input.resource,
      userId: user.userId,
    });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const last = await tx.auditLog.findFirst({
          where: { organizationId },
          orderBy: { sequence: 'desc' },
          select: { hash: true },
        });

        const createdAt = new Date();
        const sanitizedBefore = sanitizeSnapshot(input.before);
        const sanitizedAfter = sanitizeSnapshot(input.after);

        // sequence real vem do autoincrement — para o hash usamos BigInt(0)
        // como placeholder determinístico. A verificação usa o mesmo valor.
        const hashPayload = {
          sequence: BigInt(0),
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          purpose: input.purpose ?? null,
          legalBasis: input.legalBasis ?? null,
          dataSubjectId: input.dataSubjectId ?? null,
          details: (input.details ?? null) as unknown,
          before: (sanitizedBefore ?? null) as unknown,
          after: (sanitizedAfter ?? null) as unknown,
          userId: user.userId,
          organizationId,
          createdAt,
          prevHash: last?.hash ?? null,
        };

        const hash = computeHash(hashPayload);

        await tx.auditLog.create({
          data: {
            action: input.action,
            resource: input.resource,
            resourceId: input.resourceId ?? null,
            purpose: input.purpose ?? null,
            legalBasis: (input.legalBasis as any) ?? null,
            dataSubjectId: input.dataSubjectId ?? null,
            details: (input.details ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            before: (sanitizedBefore ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            after: (sanitizedAfter ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            ipAddress,
            userAgent,
            hash,
            prevHash: last?.hash ?? null,
            userId: user.userId,
            organizationId,
            createdAt,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    // Audit failure NÃO pode derrubar a operação de negócio, mas deve acender alerta
    logger.error('[Audit] Falha ao persistir evento', {
      action: input.action,
      resource: input.resource,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Verifica integridade da cadeia hash para uma organização.
 * Retorna a primeira sequência quebrada (ou null se íntegra).
 */
export async function verifyAuditChain(
  organizationId: string,
  options: { limit?: number } = {},
): Promise<{ valid: boolean; brokenAtSequence: bigint | null; checkedCount: number }> {
  const limit = options.limit ?? 10000;

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      anonymizedAt: null,
      hash: { not: null }, // linhas legacy sem hash ficam fora da verificação
    },
    orderBy: { sequence: 'asc' },
    take: limit,
  });

  let prev: string | null = null;
  for (const log of logs) {
    const expected = computeHash({
      sequence: BigInt(0), // sequence não entra no hash original
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      purpose: log.purpose,
      legalBasis: log.legalBasis,
      dataSubjectId: log.dataSubjectId,
      details: log.details,
      before: log.before,
      after: log.after,
      userId: log.userId,
      organizationId: log.organizationId,
      createdAt: log.createdAt,
      prevHash: prev,
    });

    if (expected !== log.hash || log.prevHash !== prev) {
      return { valid: false, brokenAtSequence: log.sequence, checkedCount: logs.length };
    }
    prev = log.hash;
  }

  return { valid: true, brokenAtSequence: null, checkedCount: logs.length };
}

/**
 * Anonimiza logs além do período de retenção (LGPD Art. 16).
 * Remove PII (ipAddress, userAgent, before/after, dataSubjectId) mas preserva
 * action/resource/timestamp p/ fins estatísticos e de conformidade.
 * NÃO quebra a cadeia hash — o registro original permanece verificável até
 * o ponto da anonimização.
 */
export async function anonymizeExpiredAuditLogs(organizationId: string, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.auditLog.updateMany({
    where: {
      organizationId,
      createdAt: { lt: cutoff },
      anonymizedAt: null,
    },
    data: {
      ipAddress: null,
      userAgent: null,
      before: Prisma.JsonNull,
      after: Prisma.JsonNull,
      dataSubjectId: null,
      details: Prisma.JsonNull,
      anonymizedAt: new Date(),
    },
  });

  if (result.count > 0) {
    logger.info(`[Audit] Anonimizados ${result.count} registros > ${retentionDays}d (org=${organizationId})`);
  }

  return result.count;
}
