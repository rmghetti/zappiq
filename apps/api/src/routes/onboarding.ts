import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { signToken, signRefreshToken } from '../utils/token.js';
import { logger } from '../utils/logger.js';
import * as ragService from '../services/ragService.js';
import { buildKnowledgeBase, surveyDocFilename } from '../services/knowledgeBaseBuilder.js';
import { ensureLiveAgentForOrg } from '../services/agentProvisioningService.js';
import { seedDefaultPipelineStages } from '../services/pipelineStageProvisioningService.js';

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
  // Segmento (key) + subsegmentos (keys) escolhidos no cadastro. Persistidos
  // pra personalizar survey/exemplos por segmento e subsegmento (Goal 2).
  segmento: z.string().optional(),
  subsegmentos: z.array(z.string()).optional(),

  // Step 3 — Agent config
  agentName: z.string().default('Bia'),
  tone: z.string().default('friendly'),
  businessHours: z.record(z.any()).optional(),
  greetingMessage: z.string().optional(),
  handoffMessage: z.string().optional(),

  // Step 4 — Survey answers
  surveyAnswers: z.record(z.any()).optional(),

  // Step 5 — Quota limit behavior (#150)
  // 'notify_decide' (default) -> avisa em 95%, deixa decidir
  // 'auto_charge' -> autoOverage on, cobra excedente automatico
  // 'hard_block' -> bloqueia em 100%, sem excedente
  quotaLimitBehavior: z.enum(['notify_decide', 'auto_charge', 'hard_block']).optional(),

  // Step 6 — Website
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

// GET /api/onboarding/status — check if onboarding is complete
router.get('/status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.organizationId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const org = orgId
      ? await prisma.organization.findUnique({ where: { id: orgId } })
      : null;

    res.json({
      completed: !!org,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: org ? {
        id: org.id,
        name: org.name,
        plan: (org as any).plan,
        isTrialActive: (org as any).isTrialActive,
      } : null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/onboarding/complete
router.post('/complete', validate(onboardingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name, businessName, email, password, phone,
      niche, segmento, subsegmentos, agentName, tone, businessHours, greetingMessage, handoffMessage,
      surveyAnswers, websiteUrl, quotaLimitBehavior,
    } = req.body;

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'E-mail já registrado' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Achado §0.6 — o onboarding forçava plan='STARTER' e ignorava o plano que
    // o lead escolheu no site (signups.plan_chosen). Ex: Gustavo escolheu SCALE
    // e isso se perdia na conclusão. Aqui lemos o plano declarado no signup
    // (por email, case-insensitive) e o usamos quando for um PlanType válido.
    const emailLower = email.toLowerCase();
    const resolvedPlan = await resolvePlanFromSignup(emailLower);

    // Create org + user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Trial por ATIVAÇÃO (decisão D-plano, 20/08/2026): o relógio dos 14
      // dias NÃO começa mais no cadastro. trialStartedAt/trialEndsAt nascem
      // NULL e são preenchidos na primeira mensagem inbound real de WhatsApp
      // (routes/webhook.ts) ou, para conta dormente, à força em D+30 do
      // signup (services/trialExpirationCron.ts). Antes da ativação a conta
      // fica no estágio NOVO (paywall none). Efeito desejado no checkout:
      // com trialStartedAt NULL, effectiveTrialDays (billingCheckout.util)
      // concede o trial do Stripe a quem assinar antes de ativar.
      const org = await tx.organization.create({
        data: {
          name: businessName,
          slug: `${slug}-${Date.now().toString(36)}`,
          plan: resolvedPlan,
          ...orgTrialSeedAtSignup(),
          settings: {
            niche,
            // Segmento (key) + subsegmentos (keys) — base pra personalização
            // por segmento/subsegmento. Fallback do segmento = niche.
            segmento: segmento || niche || null,
            subsegmentos: Array.isArray(subsegmentos) ? subsegmentos : [],
            agentName: agentName || 'Bia',
            tone: mapTone(tone),
            businessName,
            businessHours: businessHours || { weekdays: '08:00-18:00' },
            greetingMessage: greetingMessage || null,
            handoffMessage: handoffMessage || null,
            phone: phone || null,
            // 2026-05-20 — persistir as respostas do survey em settings pra
            // permitir EDIÇÃO posterior (/api/ai-training/survey). Antes elas
            // viravam só doc RAG e sumiam — o "Responder agora" não tinha
            // de onde ler as respostas atuais.
            surveyAnswers: surveyAnswers || {},
            // #150 — billing behavior escolhido no signup
            billing: (() => {
              const b = (quotaLimitBehavior as string) || 'notify_decide';
              if (b === 'auto_charge') {
                return { autoOverage: true, hardCeilingBrl: null, notifyAtPercent: 80, quotaLimitBehavior: 'auto_charge' };
              }
              if (b === 'hard_block') {
                return { autoOverage: false, hardCeilingBrl: null, notifyAtPercent: 90, quotaLimitBehavior: 'hard_block' };
              }
              return { autoOverage: false, hardCeilingBrl: null, notifyAtPercent: 95, quotaLimitBehavior: 'notify_decide' };
            })(),
          },
        } as any,
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

      // W1.5 — semeia o Agent live 'comercial' da org na MESMA transação.
      // Sem isto o orchestrator caía sempre no fallback do promptEngine e a
      // tela /treinar/qualidade (que lista/edita o Agent) ficava inacessível.
      // Dentro da tx: 1 Agent por org garantido na origem, sem duplicar.
      await ensureLiveAgentForOrg(tx, {
        organizationId: org.id,
        settings: (org.settings ?? {}) as Record<string, any>,
      });

      // Fix W3.5 — semeia os 7 PipelineStage default na MESMA transação.
      // Antes os estágios só existiam via backfill da migração 20260524, então
      // orgs criadas depois (incl. CMJ) nasciam SEM estágios e o "mover pra
      // Proposta" / sync de stageId em PUT /deals/:id/stage falhava em
      // silêncio. Idempotente por org.
      await seedDefaultPipelineStages(org.id, tx);

      return { org, user };
    });

    // ── Área Clientes / Fase 1 — liga o signup à org e cria o espelho CRM ──
    // Fora da transação (a tabela signups vive fora do Prisma; acesso via raw
    // SQL) e best-effort: uma falha aqui não pode derrubar o onboarding do
    // cliente. Idempotente por natureza (UPDATE por email + upsert por org).
    await linkSignupAndSeedCrmAccount({
      orgId: result.org.id,
      email: emailLower,
      company: businessName,
      plan: resolvedPlan,
      trialEndsAt: (result.org as any).trialEndsAt ?? null,
    }).catch((err: any) =>
      logger.warn('[Onboarding] wire signup/crm_account falhou (não bloqueante):', err?.message),
    );

    // Process survey answers -> RAG (async, non-blocking)
    if (surveyAnswers && Object.keys(surveyAnswers).length > 0) {
      const knowledgeBase = buildKnowledgeBase({ businessName, niche, surveyAnswers });
      ragService.ingestDocument(result.org.id, {
        filename: surveyDocFilename(niche),
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
        plan: resolvedPlan,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Campos de trial no MOMENTO DO CADASTRO, no desenho de trial por ativação (D-plano,
 * 20/08/2026). As datas ficam NULL de propósito: quem as preenche é a
 * primeira conversa real de WhatsApp (webhook) ou a ativação forçada D+30
 * (trialExpirationCron). isTrialActive segue true como "janela de avaliação
 * aberta"; sem trialEndsAt a conta deriva pra NOVO (accountLifecycle), não
 * pra TRIAL. Cap de US$ 15 em custo LLM protege margem de signups curiosos.
 * Pura e exportada pra teste travar que o cadastro não volte a setar datas.
 */
export function orgTrialSeedAtSignup(): {
  trialStartedAt: null;
  trialEndsAt: null;
  trialCostCapUsd: number;
  isTrialActive: boolean;
  trialConverted: boolean;
  subscriptionStatus: string;
} {
  return {
    trialStartedAt: null,
    trialEndsAt: null,
    trialCostCapUsd: 15.0,
    isTrialActive: true,
    trialConverted: false,
    subscriptionStatus: 'trialing',
  };
}

/**
 * Normaliza um plano declarado no signup (signups.plan_chosen, texto livre)
 * para um PlanType válido do Prisma. Retorna null se não reconhecer.
 * Pura e testável — usada pelo fix do §0.6.
 */
export function normalizePlanChosen(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim().toUpperCase();
  const valid = new Set(['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE']);
  return valid.has(v) ? v : null;
}

/**
 * Lê o plano escolhido pelo lead em signups.plan_chosen (por email) e devolve
 * um PlanType válido, ou 'STARTER' como fallback. A tabela signups vive fora do
 * Prisma; acessada por raw SQL. Best-effort: qualquer erro cai no fallback.
 */
async function resolvePlanFromSignup(emailLower: string): Promise<string> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT plan_chosen FROM signups WHERE lower(email) = lower($1)
       ORDER BY created_at DESC LIMIT 1`,
      emailLower,
    )) as Array<{ plan_chosen: string | null }>;
    const normalized = normalizePlanChosen(rows?.[0]?.plan_chosen);
    return normalized ?? 'STARTER';
  } catch (err: any) {
    logger.warn('[Onboarding] resolvePlanFromSignup falhou, usando STARTER:', err?.message);
    return 'STARTER';
  }
}

/**
 * Fase 1 — para de gerar signups órfãos e nasce o espelho CRM da conta:
 *  (a) UPDATE signups: liga organization_id, seta onboarding_path='wizard'
 *      (se ausente), status='active', updated_at=now(), casando por email.
 *  (b) upsert em crm_accounts: 1 linha por org, lifecycleStage='NOVO'.
 * Idempotente: reexecutar não duplica (UPDATE por email + upsert por org).
 */
async function linkSignupAndSeedCrmAccount(args: {
  orgId: string;
  email: string;
  company: string | null;
  plan: string | null;
  trialEndsAt: Date | null;
}): Promise<void> {
  const { orgId, email, company, plan, trialEndsAt } = args;

  // (a) liga o signup à org (best-effort — signups pode não ter a linha).
  await prisma.$executeRawUnsafe(
    `UPDATE signups
        SET organization_id = $1,
            onboarding_path = COALESCE(onboarding_path, 'wizard'),
            status = 'active',
            updated_at = now()
      WHERE lower(email) = lower($2)`,
    orgId,
    email,
  );

  // pega o signupId (se existir) para gravar o elo em crm_accounts.
  const sig = (await prisma.$queryRawUnsafe(
    `SELECT id FROM signups WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
    orgId,
  )) as Array<{ id: string }>;
  const signupId = sig?.[0]?.id ?? null;

  // (b) upsert do espelho CRM (nasce NOVO). organizationId é único.
  await prisma.crmAccount.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      signupId,
      email,
      company,
      plan,
      lifecycleStage: 'NOVO',
      trialEndsAt,
    },
    update: {
      // reexecução: mantém o estágio, só reforça os campos de identidade/elo.
      signupId: signupId ?? undefined,
      email,
      company: company ?? undefined,
      plan: plan ?? undefined,
      trialEndsAt: trialEndsAt ?? undefined,
    },
  });
}

function mapTone(tone: string): string {
  const map: Record<string, string> = {
    'Amigável': 'friendly', 'amigavel': 'friendly', 'friendly': 'friendly',
    'Formal': 'formal', 'formal': 'formal',
    'Técnico': 'technical', 'tecnico': 'technical', 'technical': 'technical',
  };
  return map[tone] || 'friendly';
}

export default router;
