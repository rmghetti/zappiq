import { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

/* ═══════════════════════════════════════════════════════════════════════
 * RLS Tenant Middleware
 *
 * Seta a variável de sessão `app.current_organization_id` no PostgreSQL
 * para que as policies de RLS filtrem automaticamente por organização.
 *
 * Uso: aplicar DEPOIS do authMiddleware, que popula req.organizationId.
 *
 * Para rotas que usam transações ($transaction), a variável já estará
 * disponível se o middleware rodar antes. Para queries avulsas fora de
 * transação explícita, usamos Prisma.$executeRawUnsafe com SET LOCAL
 * que vale para a próxima query na mesma conexão.
 *
 * IMPORTANTE: RLS só é enforced para o role app_user. Se a aplicação
 * conectar como superuser/postgres, as policies são bypassed.
 * Em produção, a connection string deve usar o role app_user.
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Middleware Express que injeta o organizationId na sessão PG.
 * Deve rodar DEPOIS de authMiddleware.
 */
export function rlsTenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const orgId = req.organizationId;

  if (!orgId) {
    // Rota não autenticada ou sem org — RLS vai bloquear tudo (safe default)
    next();
    return;
  }

  // Validar formato do orgId (cuid) para evitar SQL injection
  if (!/^[a-z0-9]{20,30}$/i.test(orgId)) {
    logger.warn('rlsTenantMiddleware: invalid organizationId format', { orgId });
    res.status(400).json({ error: 'Invalid organization context' });
    return;
  }

  // SET LOCAL vale apenas para a transação corrente.
  // Como Prisma usa connection pooling, precisamos garantir que o SET
  // e as queries subsequentes rodem na mesma conexão. A forma mais
  // segura é wrapping via $transaction, mas como middleware Express
  // não controla o lifecycle da query, setamos via $executeRawUnsafe
  // e confiamos que o next handler usa a mesma conexão do pool.
  //
  // Para garantia total, os handlers críticos devem usar:
  //   await prisma.$transaction(async (tx) => {
  //     await tx.$executeRawUnsafe(`SET LOCAL ...`);
  //     // queries aqui
  //   });
  prisma.$executeRawUnsafe(
    `SET LOCAL app.current_organization_id = '${orgId}'`
  )
    .then(() => next())
    .catch((err) => {
      logger.error('rlsTenantMiddleware: failed to set org context', err);
      next(); // Fail open — RLS policy vai bloquear se não setado
    });
}

/**
 * Helper para usar em handlers que fazem $transaction.
 * Garante que o SET LOCAL e as queries rodem na mesma conexão.
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   await setTenantContext(tx, orgId);
 *   const contacts = await tx.contact.findMany();
 * });
 */
export async function setTenantContext(
  tx: { $executeRawUnsafe: (query: string) => Promise<any> },
  organizationId: string,
): Promise<void> {
  if (!/^[a-z0-9]{20,30}$/i.test(organizationId)) {
    throw new Error('setTenantContext: invalid organizationId format');
  }
  await tx.$executeRawUnsafe(
    `SET LOCAL app.current_organization_id = '${organizationId}'`
  );
}
