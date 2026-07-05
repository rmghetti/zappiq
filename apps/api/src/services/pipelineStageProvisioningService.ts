/* ══════════════════════════════════════════════════════════════════════
 * pipelineStageProvisioningService — semeia os PipelineStage default de uma
 * org (fix W3.5).
 * --------------------------------------------------------------------
 * Bug (W3.5): os 7 estágios default só existiam como BACKFILL dentro da
 * migração 20260524_crm_pipeline_activity_task. Nenhum ponto do produto
 * (registro em auth.ts, onboarding em onboarding.ts) criava PipelineStage
 * na criação da org. Resultado em prod: orgs criadas DEPOIS de 24/05/2026
 * nascem SEM estágios (2 orgs, incl. CMJ). Como PUT /deals/:id/stage resolve
 * o PipelineStage por (organizationId, name) e só grava stageId `if (ps)`,
 * o sync do stageId e o "mover pra Proposta" falham em SILÊNCIO — o deal
 * troca o campo legado `stage` mas nunca ganha stageId, e o painel de
 * contexto das Conversas não reflete o estágio.
 *
 * Este service centraliza a criação idempotente dos 7 estágios canônicos.
 * É chamado:
 *   (a) no registro (auth.ts) e no onboarding (onboarding.ts), dentro da
 *       transação de criação da org — garante os estágios na origem;
 *   (b) pelo script scripts/backfillPipelineStages.ts — semeia as orgs
 *       existentes que ainda não têm estágios.
 *
 * Chave de idempotência: existência de QUALQUER PipelineStage na org.
 * Se a org já tem estágios (mesmo customizados pelo cliente), a função é
 * no-op e devolve `created: false` — NÃO recria nem sobrescreve.
 *
 * Aceita um PrismaClient OU um Prisma.TransactionClient (`db`), para rodar
 * tanto dentro da transação do onboarding quanto standalone no backfill.
 *
 * Os 7 estágios (nome/order/cor/isWon/isLost) são IDÊNTICOS ao backfill da
 * migração 20260524 e batem com STAGE_KEY_TO_PIPELINE em routes/deals.ts.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

/**
 * Os 7 estágios canônicos do pipeline default (CRM Onda 0). Fonte única —
 * espelha EXATAMENTE o VALUES do backfill em
 * 20260524_crm_pipeline_activity_task/migration.sql e os nomes usados em
 * STAGE_KEY_TO_PIPELINE (routes/deals.ts). Manter os dois em sincronia.
 */
export const DEFAULT_PIPELINE_STAGES: ReadonlyArray<{
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
}> = [
  { name: 'Novo lead', order: 0, color: '#64748b', isWon: false, isLost: false },
  { name: 'Contatado', order: 1, color: '#0ea5e9', isWon: false, isLost: false },
  { name: 'Qualificado', order: 2, color: '#6366f1', isWon: false, isLost: false },
  { name: 'Proposta', order: 3, color: '#f59e0b', isWon: false, isLost: false },
  { name: 'Negociacao', order: 4, color: '#a855f7', isWon: false, isLost: false },
  { name: 'Ganho', order: 5, color: '#22c55e', isWon: true, isLost: false },
  { name: 'Perdido', order: 6, color: '#ef4444', isWon: false, isLost: true },
];

/**
 * Subconjunto mínimo do PrismaClient que este service usa. Compatível tanto
 * com `prisma` quanto com o `tx` de dentro de `prisma.$transaction`.
 */
export interface PipelineStageProvisioningDb {
  pipelineStage: {
    findFirst: (args: any) => Promise<{ id: string } | null>;
    createMany: (args: any) => Promise<{ count: number }>;
  };
}

export interface SeedPipelineStagesResult {
  created: boolean;
  /** quantos estágios foram inseridos (0 quando no-op). */
  count: number;
}

/**
 * Garante que a org tenha os 7 PipelineStage default. Idempotente por
 * "a org já tem ALGUM estágio": se já existe qualquer estágio, é no-op —
 * não recria nem duplica, e não mexe em estágios que o cliente customizou.
 *
 * @param orgId  id da organização.
 * @param db     prisma OU tx (dentro de $transaction). Default: prisma.
 */
export async function seedDefaultPipelineStages(
  orgId: string,
  db: PipelineStageProvisioningDb = prisma as unknown as PipelineStageProvisioningDb,
): Promise<SeedPipelineStagesResult> {
  // Idempotência: qualquer estágio já existente basta — a org já foi semeada
  // (pela migração de backfill, por este helper, ou customizada pelo cliente).
  const existing = await db.pipelineStage.findFirst({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (existing) {
    return { created: false, count: 0 };
  }

  const result = await db.pipelineStage.createMany({
    data: DEFAULT_PIPELINE_STAGES.map((s) => ({
      name: s.name,
      order: s.order,
      color: s.color,
      isWon: s.isWon,
      isLost: s.isLost,
      organizationId: orgId,
    })),
  });

  return { created: true, count: result.count };
}

export interface BackfillPipelineStagesResult {
  scanned: number;
  seeded: number;
  skipped: number;
  durationMs: number;
  dryRun: boolean;
}

/**
 * Backfill idempotente: semeia os 7 estágios default das orgs existentes que
 * ainda não têm nenhum (orgs criadas depois de 24/05/2026). Reexecutar não
 * duplica (seedDefaultPipelineStages é no-op quando a org já tem estágios).
 * NÃO destrói nem sobrescreve dado.
 *
 * Segue o padrão de runBackfillAgents (função pura de I/O, sem process.exit —
 * o wrapper CLI scripts/backfillPipelineStages.ts é o ponto de entrada).
 */
export async function runBackfillPipelineStages(
  opts: { dryRun?: boolean } = {},
): Promise<BackfillPipelineStagesResult> {
  const DRY = Boolean(opts.dryRun);
  const startedAt = Date.now();

  const orgs = await prisma.organization.findMany({ select: { id: true } });

  let seeded = 0;
  let skipped = 0;
  for (const org of orgs) {
    const existing = await prisma.pipelineStage.findFirst({
      where: { organizationId: org.id },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    if (DRY) {
      seeded++;
      continue;
    }
    const r = await seedDefaultPipelineStages(org.id);
    if (r.created) seeded++;
    else skipped++;
  }

  const durationMs = Date.now() - startedAt;
  logger.info({
    msg: 'backfill_pipeline_stages_done',
    dryRun: DRY,
    scanned: orgs.length,
    seeded,
    skipped,
    durationMs,
  });
  return { scanned: orgs.length, seeded, skipped, durationMs, dryRun: DRY };
}
