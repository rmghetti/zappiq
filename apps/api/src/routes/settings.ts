import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── Organization Settings ───────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
});

router.put('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.update({
      where: { id: req.organizationId! },
      data: req.body,
    });
    res.json({ success: true, data: org });
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
