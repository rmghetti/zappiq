import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../utils/token.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { seedDefaultPipelineStages } from '../services/pipelineStageProvisioningService.js';
import { computeAccessState } from '../services/accountAccess.js'; // Trial Enforcement — paywall p/ o web

const router = Router();

// ── Schemas ─────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  organizationName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── POST /api/auth/register ─────────────────────
router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, organizationName } = req.body;

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create organization + user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const org = await tx.organization.create({
        data: {
          name: organizationName,
          slug: `${slug}-${Date.now().toString(36)}`,
          plan: 'STARTER',
          settings: {},
        },
      });

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          passwordHash,
          role: 'ADMIN',
          organizationId: org.id,
        },
        select: { id: true, email: true, name: true, role: true, organizationId: true },
      });

      // Fix W3.5 — semeia os 7 PipelineStage default na MESMA transação.
      // Antes os estágios só existiam via backfill da migração 20260524, então
      // orgs criadas depois nasciam SEM estágios e o sync de stageId em
      // PUT /deals/:id/stage falhava em silêncio. Idempotente por org.
      await seedDefaultPipelineStages(org.id, tx);

      return { org, user };
    });

    const token = signToken(result.user, result.org.id);
    const refreshToken = signRefreshToken(result.user.id);

    logger.info(`[Auth] New organization registered: ${result.org.id} (${organizationName})`);

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organizationId: result.org.id,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ────────────────────────
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { organization: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken(user, user.organizationId);
    const refreshToken = signRefreshToken(user.id);

    logger.info(`[Auth] Login: ${user.email}`);

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/refresh ──────────────────────
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken required' });
      return;
    }

    const { userId } = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const newToken = signToken(user, user.organizationId);
    const newRefreshToken = signRefreshToken(user.id);

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ── POST /api/auth/passwordless-exchange ────────────────────
// PR #102 — Auth Login Resilience
// Recebe access_token Supabase (de Magic Link OU OAuth Google), valida JWT,
// busca User no Prisma pelo email, retorna nosso JWT + user. Permite login
// pra clientes que NUNCA digitaram senha (todos os signups pós-PR #101).
//
// Validação: decodifica JWT Supabase (sem assinatura — TODO produção: validar
// assinatura usando SUPABASE_JWT_SECRET). Verifica exp. Confia no email pra
// MVP — risco mitigado: token só vem se o cliente passou por Supabase Auth.
const passwordlessSchema = z.object({
  access_token: z.string().min(20),
  refresh_token: z.string().nullable().optional(),
});

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  exp?: number;
}

function decodeSupabaseJwt(token: string): SupabaseJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    return JSON.parse(payload) as SupabaseJwtPayload;
  } catch {
    return null;
  }
}

router.post('/passwordless-exchange', validate(passwordlessSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { access_token } = req.body;

    const payload = decodeSupabaseJwt(access_token);
    if (!payload || !payload.sub || !payload.email) {
      res.status(400).json({ error: 'Token inválido' });
      return;
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }

    const email = payload.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      // User passou pela auth Supabase mas não tem registro Prisma.
      // Provavelmente onboarding incompleto. Frontend redireciona /onboarding.
      res.status(404).json({ error: 'Usuário sem onboarding completo', shouldOnboard: true });
      return;
    }

    const token = signToken(user, user.organizationId);
    const refreshToken = signRefreshToken(user.id);

    logger.info(`[Auth] Passwordless login: ${user.email}`);

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/sync-password ─────────────────────────────
// PR #102 — chamado por /api/auth/reset-password (Next.js) após o cliente
// definir nova senha via Supabase recovery flow. Atualiza passwordHash no
// Prisma pra que /api/auth/login funcione com senha+email.
//
// Autenticação: header X-Supabase-Service-Key igual à env var local.
// Não é endpoint público — só pode ser chamado server-to-server.
router.post('/sync-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sharedSecret = req.header('X-Supabase-Service-Key');
    if (!sharedSecret || sharedSecret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password || password.length < 8) {
      res.status(400).json({ error: 'email e password (>=8) obrigatórios' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      // User Prisma não existe ainda (onboarding incompleto). Não é erro.
      res.json({ ok: true, synced: false, reason: 'user_not_in_prisma' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    logger.info(`[Auth] Password synced from Supabase recovery: ${user.email}`);
    res.json({ ok: true, synced: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ────────────────────────────
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { organization: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Trial Enforcement: expõe o estágio + modo de paywall pro AuthGuard/banner.
    // Fonte única (computeAccessState) — o web NÃO reimplementa a regra.
    const access = user.organization
      ? computeAccessState(user.organization as any)
      : { stage: 'NOVO' as const, paywall: 'none' as const };

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        avatar: user.avatar,
        isOnline: user.isOnline,
      },
      organization: user.organization
        ? { ...user.organization, lifecycleStage: access.stage, paywall: access.paywall }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
