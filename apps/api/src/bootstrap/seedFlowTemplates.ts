/**
 * Bootstrap idempotente dos templates Maestro. Roda no startup do API.
 *
 * A REGRA de semeadura mora em @zappiq/database (flowTemplatesUpsert.ts), porque
 * o seed manual (packages/database/prisma/seeds/flowTemplates.ts) usa a mesma.
 * Aqui fica so a ligacao com o prisma e o logger do API.
 *
 * Por que UPSERT e nao "insere so os faltantes" (comportamento anterior): a
 * versao antiga comparava por NOME e so inseria o que faltava, entao corrigir o
 * conteudo de um template no codigo NAO surtia efeito nenhum em quem ja tinha as
 * linhas semeadas — que era o caso de producao. Detalhe em flowTemplatesUpsert.
 */

import { prisma, upsertFlowTemplates, formatUpsertResult } from '@zappiq/database';
import { logger } from '../utils/logger';

export async function bootstrapFlowTemplates(): Promise<void> {
  try {
    const r = await upsertFlowTemplates(prisma, {
      info: (m) => logger.info(m),
      error: (m) => logger.error(m),
    });
    const resumo = formatUpsertResult(r);
    if (r.failed > 0) logger.error(`[bootstrap:flowTemplates] concluido COM FALHAS — ${resumo}`);
    else logger.info(`[bootstrap:flowTemplates] OK — ${resumo}`);
  } catch (err: any) {
    logger.error(`[bootstrap:flowTemplates] FAIL: ${err?.message ?? err}`);
  }
}
