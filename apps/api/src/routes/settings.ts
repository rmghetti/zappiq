import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { trainingFieldsChanged } from '../services/trainingChange.js';
import { refreshAIReadiness } from '../services/aiReadinessService.js';
import { updateSettingsSchema, redactOrgSecrets } from './settings.schema.js';

const router = Router();

// ── Organization Settings ───────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
    // W1.3: nunca vazar segredos de canal (whatsapp/instagram token, metaAppSecret).
    res.json({ success: true, data: redactOrgSecrets(org) });
  } catch (err) { next(err); }
});

router.put('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    // W1.3: whitelist .strict() — bloqueia mass assignment de plan/trial/
    // subscription/stripe*/quota. Campo desconhecido → 400 (nunca ignora em
    // silêncio, pra o cliente não achar que "funcionou").
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;
    const before = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const org = await prisma.organization.update({
      where: { id: orgId },
      data,
    });
    // Maestro reativo: identidade/treino mudou → marca os fluxos como desatualizados
    const newSettings = data.settings;
    if (newSettings && trainingFieldsChanged((before?.settings as any) || {}, newSettings)) {
      await refreshAIReadiness(orgId).catch(() => null);
    }
    // Consistência com o GET: resposta também sem segredos.
    res.json({ success: true, data: redactOrgSecrets(org) });
  } catch (err) { next(err); }
});

// ── Team Management ─────────────────────────────
router.get('/team', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.organizationId! },
      select: { id: true, email: true, name: true, role: true, avatar: true, isOnline: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

router.post('/team', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, role, password } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ error: 'email, name, and password are required' });
      return;
    }

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role: role || 'AGENT',
        passwordHash,
        organizationId: req.organizationId!,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'Email already exists' }); return; }
    next(err);
  }
});

router.put('/team/:userId', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, role } = req.body;
    const user = await prisma.user.updateMany({
      where: { id: req.params.userId, organizationId: req.organizationId! },
      data: { ...(name && { name }), ...(role && { role }) },
    });
    if (user.count === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/team/:userId', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.userId === req.user!.userId) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }
    const result = await prisma.user.deleteMany({ where: { id: req.params.userId, organizationId: req.organizationId! } });
    if (result.count === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ success: true, message: 'User removed' });
  } catch (err) { next(err); }
});

export default router;
