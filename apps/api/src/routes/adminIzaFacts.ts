/* ══════════════════════════════════════════════════════════════════════════
 * adminIzaFacts — CRUD pra Camada 2 (iza_facts table)
 * --------------------------------------------------------------------------
 * Antes deste PR: Camada 2 estava operacional mas a única forma de atualizar
 * facts era via SQL direto no Supabase Studio. Atrito alto + risco de typo.
 *
 * Agora: dashboard /admin/iza-knowledge permite ao SUPERADMIN ver, criar,
 * editar, ativar/desativar e remover facts via UI. Cada mutação invalida
 * o cache do izaFactsService — próximo turno da Iza já reflete.
 *
 * Endpoints (todos SUPERADMIN):
 *   GET    /api/admin/iza-facts            → lista (active + inactive)
 *   POST   /api/admin/iza-facts            → cria novo fact
 *   PATCH  /api/admin/iza-facts/:id        → atualiza campos
 *   DELETE /api/admin/iza-facts/:id        → soft delete (active=false)
 *   POST   /api/admin/iza-facts/cache/invalidate → força reload do cache
 * ══════════════════════════════════════════════════════════════════════════ */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { invalidateIzaFactsCache } from '../services/izaFactsService.js';

const router = Router();

// ── Validators ───────────────────────────────────────────

const SECTIONS = ['canais', 'features', 'urls', 'compliance', 'pricing', 'parcerias'] as const;
const STATUSES = ['live', 'beta', 'rollout', 'pending', 'sunset'] as const;

const createSchema = z.object({
  id: z.string().trim().min(2).max(64).regex(/^[a-z0-9_]+$/, 'id deve ser snake_case ASCII (a-z, 0-9, _)'),
  section: z.enum(SECTIONS),
  fact_key: z.string().trim().min(2).max(64),
  label: z.string().trim().min(2).max(200),
  status: z.enum(STATUSES),
  description: z.string().trim().max(2000).optional().nullable(),
  url: z.string().trim().url().max(500).optional().nullable(),
  order_idx: z.number().int().min(0).max(9999).default(100),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const updateSchema = createSchema.partial().omit({ id: true });

// ── GET /api/admin/iza-facts ─────────────────────────────

router.get(
  '/iza-facts',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (_req: Request, res: Response) => {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, section, fact_key, label, status, description, url, order_idx,
                active, notes, updated_at, updated_by
         FROM iza_facts
         ORDER BY active DESC, section, order_idx, fact_key`,
      );
      res.json({ facts: rows, total: rows.length });
    } catch (err: any) {
      logger.error('[adminIzaFacts] list failed', { err: err?.message });
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// ── POST /api/admin/iza-facts ────────────────────────────

router.post(
  '/iza-facts',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const f = parsed.data;
    const user = (req as any).user;
    const updatedBy = user?.email || 'admin';

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO iza_facts (id, section, fact_key, label, status, description, url, order_idx, notes, active, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, now(), $10)`,
        f.id, f.section, f.fact_key, f.label, f.status,
        f.description ?? null, f.url ?? null, f.order_idx, f.notes ?? null, updatedBy,
      );
      invalidateIzaFactsCache();
      logger.info('[adminIzaFacts] created', { id: f.id, by: updatedBy });
      res.status(201).json({ ok: true, id: f.id });
    } catch (err: any) {
      const msg = err?.message || 'unknown';
      if (msg.includes('duplicate key') || msg.includes('unique')) {
        return res.status(409).json({ error: 'fact_id_exists' });
      }
      logger.error('[adminIzaFacts] create failed', { err: msg, id: f.id });
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// ── PATCH /api/admin/iza-facts/:id ───────────────────────

router.patch(
  '/iza-facts/:id',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const id = String(req.params.id).slice(0, 64);
    const parsed = updateSchema.extend({ active: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const updates = parsed.data;
    const user = (req as any).user;
    const updatedBy = user?.email || 'admin';

    // Build dynamic SET clause
    const setClauses: string[] = [];
    const values: any[] = [];
    let argIdx = 1;
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) continue;
      setClauses.push(`"${k}" = $${argIdx}`);
      values.push(v);
      argIdx++;
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'no_fields_to_update' });
    }
    setClauses.push(`updated_at = now()`);
    setClauses.push(`updated_by = $${argIdx}`);
    values.push(updatedBy);
    argIdx++;
    values.push(id);

    try {
      const rowsAffected = await prisma.$executeRawUnsafe(
        `UPDATE iza_facts SET ${setClauses.join(', ')} WHERE id = $${argIdx}`,
        ...values,
      );
      if (rowsAffected === 0) {
        return res.status(404).json({ error: 'fact_not_found' });
      }
      invalidateIzaFactsCache();
      logger.info('[adminIzaFacts] updated', { id, fields: Object.keys(updates), by: updatedBy });
      res.json({ ok: true, id, rowsAffected });
    } catch (err: any) {
      logger.error('[adminIzaFacts] update failed', { err: err?.message, id });
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// ── DELETE /api/admin/iza-facts/:id (soft delete) ────────

router.delete(
  '/iza-facts/:id',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const id = String(req.params.id).slice(0, 64);
    const user = (req as any).user;
    const updatedBy = user?.email || 'admin';
    try {
      const rowsAffected = await prisma.$executeRawUnsafe(
        `UPDATE iza_facts SET active = false, updated_at = now(), updated_by = $1 WHERE id = $2`,
        updatedBy, id,
      );
      if (rowsAffected === 0) {
        return res.status(404).json({ error: 'fact_not_found' });
      }
      invalidateIzaFactsCache();
      logger.info('[adminIzaFacts] soft-deleted', { id, by: updatedBy });
      res.json({ ok: true });
    } catch (err: any) {
      logger.error('[adminIzaFacts] delete failed', { err: err?.message, id });
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// ── POST /api/admin/iza-facts/cache/invalidate ───────────

router.post(
  '/iza-facts/cache/invalidate',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  (_req: Request, res: Response) => {
    invalidateIzaFactsCache();
    res.json({ ok: true });
  },
);

export default router;
