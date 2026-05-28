/**
 * Bootstrap idempotente: popula flow_templates se a tabela estiver vazia.
 * Roda no startup do API (apps/api/src/server.ts) depois do prisma init.
 *
 * Resultado: Fly redeploy = templates disponiveis sem acao humana.
 */

import { prisma, FLOW_TEMPLATES_DATA } from '@zappiq/database';
import { logger } from '../utils/logger';

export async function bootstrapFlowTemplatesIfEmpty(): Promise<void> {
  try {
    const count = await prisma.flowTemplate.count();
    if (count > 0) {
      logger.info(`[bootstrap:flowTemplates] ${count} registros, skip seed`);
      return;
    }

    logger.info(`[bootstrap:flowTemplates] tabela vazia, seedando ${FLOW_TEMPLATES_DATA.length} templates...`);

    for (const tpl of FLOW_TEMPLATES_DATA) {
      await prisma.flowTemplate.create({ data: tpl as any });
    }

    logger.info(`[bootstrap:flowTemplates] OK — ${FLOW_TEMPLATES_DATA.length} templates inseridos`);
  } catch (err: any) {
    logger.error(`[bootstrap:flowTemplates] FAIL: ${err?.message ?? err}`);
    // nao crashar startup — pagina mostra empty state se algo der errado
  }
}
