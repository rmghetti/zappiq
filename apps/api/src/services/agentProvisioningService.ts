/* ══════════════════════════════════════════════════════════════════════
 * agentProvisioningService — cria/garante o Agent 'live' de uma org (W1.5).
 * --------------------------------------------------------------------
 * Bug (W1.5): nenhum ponto do produto fazia prisma.agent.create/upsert.
 * Resultado em prod: agents_total=1, 15/16 orgs sem Agent → o
 * agentOrchestrator cai SEMPRE no fallback do promptEngine e a tela
 * /treinar/qualidade (que lista/edita o Agent da org) fica inacessível.
 *
 * Este service centraliza a criação idempotente do Agent live 'comercial'
 * (a persona padrão que o orchestrator busca por `role`). É chamado:
 *   (a) no onboarding (dentro da transação de criação da org) — garante
 *       1 Agent por org na origem, sem depender de seed manual;
 *   (b) pelo script scripts/backfillAgents.ts — semeia as orgs existentes
 *       que ainda não têm Agent.
 *
 * Chave de idempotência: (organizationId, role). Reexecutar NÃO duplica
 * nem sobrescreve um Agent que o cliente já customizou — se já existe um
 * Agent com esse role, a função é no-op e devolve `created: false`.
 *
 * Aceita um PrismaClient OU um Prisma.TransactionClient (`db`), para poder
 * rodar tanto dentro da transação do onboarding quanto standalone no backfill.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { getSystemPrompt } from '../agents/promptEngine.js';
import { logger } from '../utils/logger.js';

/**
 * Role da persona padrão semeada por org. O orchestrator busca por
 * role='comercial' quando o lead NÃO é CONVERTED (o caso comum). Semear
 * 'comercial' é o que tira a org do fallback e libera /treinar/qualidade.
 * O caminho 'suporte' (lead CONVERTED) continua com fallback back-compat.
 */
export const DEFAULT_AGENT_ROLE = 'comercial';

/**
 * Subconjunto mínimo do PrismaClient que este service usa. Compatível tanto
 * com `prisma` quanto com o `tx` de dentro de `prisma.$transaction`.
 */
export interface AgentProvisioningDb {
  agent: {
    findFirst: (args: any) => Promise<{ id: string } | null>;
    create: (args: any) => Promise<{ id: string }>;
  };
}

export interface EnsureAgentInput {
  organizationId: string;
  /** settings da org (settings.agentName, niche, tone, businessName...). */
  settings?: Record<string, any> | null;
  /** override do role — default 'comercial'. */
  role?: string;
}

export interface EnsureAgentResult {
  created: boolean;
  agentId: string;
  role: string;
}

/**
 * Monta o systemPrompt inicial do Agent a partir das settings da org.
 * Reusa o promptEngine (mesma base que o fallback do orchestrator), então
 * o texto seedado é idêntico ao que a org já receberia — a diferença é que
 * agora vira uma linha editável na tabela Agent (/treinar/qualidade).
 * Puro/testável.
 */
export function buildSeedSystemPrompt(settings?: Record<string, any> | null): string {
  const s = settings ?? {};
  return getSystemPrompt({
    niche: s.niche || 'generic',
    agentName: s.agentName || 'Assistente',
    businessName: s.businessName || 'Empresa',
    tone: s.tone || 'friendly',
    businessHours: s.businessHours,
    // Sem conversionUrls de propósito: link NÃO se congela em prompt seedado.
    //
    // Este seed roda no signup (onboarding.ts), quando surveyAnswers está vazio
    // — o cliente ainda nem abriu o /treinar —, então aqui não haveria link pra
    // gravar de qualquer forma. E gravar seria pior: PUT /ai-training/survey não
    // re-seeda o prompt, então o link congelado no seed viveria pra sempre e
    // ainda brigaria com o bloco fresco quando o cliente trocasse de domínio.
    //
    // O bloco de links é montado em RUNTIME, das settings, no
    // agentOrchestrator.buildSystemPromptForContact — vale pra org seedada e pro
    // fallback. Ver buildTenantLinksBlock em agents/tenantConversionUrls.ts.
  });
}

/**
 * Garante que a org tenha um Agent live com o role dado (default 'comercial').
 * Idempotente por (organizationId, role): se já existe, é no-op.
 *
 * @param db  prisma OU tx (dentro de $transaction).
 */
export async function ensureLiveAgentForOrg(
  db: AgentProvisioningDb,
  input: EnsureAgentInput,
): Promise<EnsureAgentResult> {
  const role = input.role || DEFAULT_AGENT_ROLE;
  const { organizationId } = input;

  // Idempotência: qualquer Agent com esse role já basta (não só 'live') —
  // não recriamos nem sobrescrevemos o que o cliente pode ter customizado.
  const existing = await db.agent.findFirst({
    where: { organizationId, role },
    select: { id: true },
  });
  if (existing) {
    return { created: false, agentId: existing.id, role };
  }

  const s = input.settings ?? {};
  const agentName = s.agentName || 'Assistente';
  const systemPrompt = buildSeedSystemPrompt(s);

  const created = await db.agent.create({
    data: {
      organizationId,
      name: agentName,
      role,
      status: 'live',
      systemPrompt,
      toneConfig: {},
      scopeConfig: {},
      abilities: {},
    },
    select: { id: true },
  });

  return { created: true, agentId: created.id, role };
}

export interface BackfillAgentsResult {
  scanned: number;
  created: number;
  skipped: number;
  durationMs: number;
  dryRun: boolean;
}

/**
 * Backfill idempotente: semeia o Agent live 'comercial' das orgs existentes
 * que ainda não têm. Reexecutar não duplica (ensureLiveAgentForOrg é no-op
 * quando o Agent já existe). NÃO destrói nem sobrescreve dado.
 *
 * Segue o padrão de runBackfillCrmAccounts (função pura de I/O, sem
 * process.exit — o wrapper CLI scripts/backfillAgents.ts é o ponto de entrada).
 */
export async function runBackfillAgents(
  opts: { dryRun?: boolean } = {},
): Promise<BackfillAgentsResult> {
  const DRY = Boolean(opts.dryRun);
  const startedAt = Date.now();

  const orgs = await prisma.organization.findMany({
    select: { id: true, settings: true },
  });

  let created = 0;
  let skipped = 0;
  for (const org of orgs) {
    const settings = (org.settings ?? {}) as Record<string, any>;

    if (DRY) {
      const existing = await prisma.agent.findFirst({
        where: { organizationId: org.id, role: DEFAULT_AGENT_ROLE },
        select: { id: true },
      });
      if (existing) skipped++;
      else created++;
      continue;
    }

    const r = await ensureLiveAgentForOrg(prisma as unknown as AgentProvisioningDb, {
      organizationId: org.id,
      settings,
    });
    if (r.created) created++;
    else skipped++;
  }

  const durationMs = Date.now() - startedAt;
  logger.info({
    msg: 'backfill_agents_done',
    dryRun: DRY,
    scanned: orgs.length,
    created,
    skipped,
    durationMs,
  });
  return { scanned: orgs.length, created, skipped, durationMs, dryRun: DRY };
}
