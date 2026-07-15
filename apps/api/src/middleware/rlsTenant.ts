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
 *
 * ⚠️ ESTADO REAL EM PRODUÇÃO (verificado em 15/07/2026)
 * A frase acima descreve o DESENHO, não o que está no ar. Em produção:
 *   - o papel `app_user` NÃO EXISTE (a migração 20260417 que o criaria consta
 *     como aplicada mas nunca executou — ver 20260715000004_rls_fecha_anon);
 *   - a API conecta como `postgres`, que é DONO das tabelas e tem
 *     rolbypassrls=true → as policies NUNCA são avaliadas para a API.
 *
 * Ou seja: este middleware seta um contexto que hoje NINGUÉM lê. O isolamento
 * entre organizações depende 100% do filtro `organizationId` no `where` de cada
 * query. NÃO OMITA ESSE FILTRO confiando na RLS — ela não vai te salvar.
 *
 * A RLS ligada hoje serve a outro propósito, real: barrar a chave `anon` do
 * Supabase (pública, vai no bundle do front) de ler as tabelas via PostgREST.
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Middleware Express que injeta o organizationId na sessão PG.
 * Deve rodar DEPOIS de authMiddleware.
 */
export function rlsTenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  // PR #218 (CRM Onda 3b): SUPERADMIN pode passar header X-Organization-Override
  // pra visualizar dados de qualquer org. Suporta org-switcher do header sem
  // furar RLS — o orgId override eh o que vai pra SET LOCAL.
  // Se user nao for SUPERADMIN, header eh IGNORADO (defesa em profundidade).
  const overrideHeader = req.headers['x-organization-override'];
  const userRole = (req.user as any)?.role;
  let orgId = req.organizationId;

  if (
    overrideHeader &&
    typeof overrideHeader === 'string' &&
    userRole === 'SUPERADMIN' &&
    /^[a-z0-9]{20,30}$/i.test(overrideHeader)
  ) {
    logger.info('rlsTenantMiddleware: SUPERADMIN org override', {
      userId: (req.user as any)?.userId,
      realOrgId: orgId,
      overrideOrgId: overrideHeader,
    });
    orgId = overrideHeader;
  }

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

/* ═══════════════════════════════════════════════════════════════════════
 * V2-024 (Sprint 0 Blocker 4) · withTenant — wrapper ergonômico
 * --------------------------------------------------------------------
 * Encapsula handler em prisma.$transaction com SET LOCAL na primeira
 * linha. Resolve o problema do middleware rlsTenant em pgbouncer
 * transaction-mode: SET LOCAL + queries SUBSEQUENTES garantidos na mesma
 * conexão.
 *
 * Antes:
 *   const contacts = await prisma.contact.findMany({ where: { orgId, ... } });
 *
 * Depois:
 *   const contacts = await withTenant(req, (tx) =>
 *     tx.contact.findMany({ where: { ... } })
 *   );
 *
 * Notas:
 *   - Filtro `organizationId` no `where` é OBRIGATÓRIO, não "defesa em
 *     profundidade": em produção a RLS não filtra para a API (ver o aviso no
 *     topo deste arquivo). Sem o filtro, o withTenant NÃO isola nada.
 *   - Lança erro 400 se req.organizationId ausente (assumido após auth)
 *   - O callback recebe o TransactionClient — mesma API do prisma global
 *     mas com SET LOCAL aplicado e contexto isolado
 *   - Erros propagam normalmente (rollback automático em transaction)
 * ═══════════════════════════════════════════════════════════════════════ */
import type { Prisma } from '@zappiq/database';

export type TenantTx = Prisma.TransactionClient;

export async function withTenant<T>(
  req: { organizationId?: string },
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  const orgId = req.organizationId;
  if (!orgId) {
    throw new Error('withTenant: req.organizationId ausente — autenticação necessária');
  }
  return prisma.$transaction(async (tx) => {
    await setTenantContext(tx, orgId);
    return fn(tx as TenantTx);
  });
}
