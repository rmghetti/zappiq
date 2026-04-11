import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { signToken, signRefreshToken } from '../utils/token.js';
import { logger } from '../utils/logger.js';
import * as ragService from '../services/ragService.js';

const router = Router();

const onboardingSchema = z.object({
  // Step 1 — Account
  name: z.string().min(2),
  businessName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),

  // Step 2 — Segment
  niche: z.string().min(2),

  // Step 3 — Agent config
  agentName: z.string().default('Bia'),
  tone: z.string().default('friendly'),
  businessHours: z.record(z.any()).optional(),
  greetingMessage: z.string().optional(),
  handoffMessage: z.string().optional(),

  // Step 4 — Survey answers
  surveyAnswers: z.record(z.any()).optional(),

  // Step 5 — Website
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

// POST /api/onboarding/complete
router.post('/complete', validate(onboardingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name, businessName, email, password, phone,
      niche, agentName, tone, businessHours, greetingMessage, handoffMessage,
      surveyAnswers, websiteUrl,
    } = req.body;

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'E-mail já registrado' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create org + user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const org = await tx.organization.create({
        data: {
          name: businessName,
          slug: `${slug}-${Date.now().toString(36)}`,
          plan: 'STARTER',
          settings: {
            niche,
            agentName: agentName || 'Bia',
            tone: mapTone(tone),
            businessName,
            businessHours: businessHours || { weekdays: '08:00-18:00' },
            greetingMessage: greetingMessage || null,
            handoffMessage: handoffMessage || null,
            phone: phone || null,
          },
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

      // Create default knowledge base
      await tx.knowledgeBase.create({
        data: {
          name: `Base Principal — ${businessName}`,
          organizationId: org.id,
        },
      });

      return { org, user };
    });

    // Process survey answers -> RAG (async, non-blocking)
    if (surveyAnswers && Object.keys(surveyAnswers).length > 0) {
      const knowledgeBase = buildKnowledgeBase({ businessName, niche, surveyAnswers });
      ragService.ingestDocument(result.org.id, {
        filename: `onboarding-survey-${niche}.txt`,
        content: Buffer.from(knowledgeBase),
        mimeType: 'text/plain',
      }).catch((err: any) => logger.warn('[Onboarding] RAG ingestion failed:', err.message));
    }

    // Index website (async, non-blocking)
    if (websiteUrl) {
      ragService.ingestUrl(result.org.id, websiteUrl)
        .catch((err: any) => logger.warn('[Onboarding] URL ingestion failed:', err.message));
    }

    const token = signToken(result.user, result.org.id);
    const refreshToken = signRefreshToken(result.user.id);

    logger.info(`[Onboarding] Complete: org ${result.org.id} (${businessName}) — niche: ${niche}`);

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
      organization: {
        id: result.org.id,
        name: businessName,
        niche,
        agentName: agentName || 'Bia',
        plan: 'STARTER',
      },
    });
  } catch (err) {
    next(err);
  }
});

function mapTone(tone: string): string {
  const map: Record<string, string> = {
    'Amigável': 'friendly', 'amigavel': 'friendly', 'friendly': 'friendly',
    'Formal': 'formal', 'formal': 'formal',
    'Técnico': 'technical', 'tecnico': 'technical', 'technical': 'technical',
  };
  return map[tone] || 'friendly';
}

function buildKnowledgeBase({ businessName, niche, surveyAnswers }: { businessName: string; niche: string; surveyAnswers: Record<string, any> }): string {
  const lines: string[] = [];
  lines.push(`=== BASE DE CONHECIMENTO — ${businessName.toUpperCase()} ===`);
  lines.push(`Segmento: ${niche}`);
  lines.push('');
  lines.push('--- INFORMAÇÕES DO NEGÓCIO (coletadas no onboarding) ---');
  lines.push('');

  for (const [key, value] of Object.entries(surveyAnswers)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`## ${key}`);
      for (const [question, answer] of Object.entries(value as Record<string, any>)) {
        if (answer && String(answer).trim()) {
          lines.push(`**${question}:** ${answer}`);
        }
      }
      lines.push('');
    } else if (value && String(value).trim()) {
      lines.push(`**${key}:** ${value}`);
    }
  }

  lines.push('');
  lines.push('--- FIM DA BASE DE CONHECIMENTO ---');
  return lines.join('\n');
}

export default router;
