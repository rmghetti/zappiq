/* ══════════════════════════════════════════════════════════════════════
 * reingestRag (CLI) — re-indexa docs + Q&A existentes no serviço RAG.
 * --------------------------------------------------------------------
 * Necessario 1x apos: (a) restaurar a credencial Postgres do zappiq-rag,
 * (b) alinhar ragService ao contrato /query+namespace, (c) setar
 * RAG_SERVICE_URL na API. Antes disso rag_chunks=0 (nada indexado).
 *
 * Fonte: kb_documents.content (via knowledge_bases.organizationId) + qa_pairs.
 * Idempotente o suficiente: o serviço RAG re-ingere por (namespace, source);
 * reprocessar sobrescreve/duplica por source — ok para um one-shot.
 *
 * Uso: (dry) REINGEST_DRY_RUN=1 pnpm --filter @zappiq/api exec tsx scripts/reingestRag.ts
 *      (real) pnpm --filter @zappiq/api exec tsx scripts/reingestRag.ts
 * Requer env: DATABASE_URL (prod), RAG_SERVICE_URL, RAG_SERVICE_SECRET.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { ingestDocument } from '../src/services/ragService.js';

const DRY = process.env.REINGEST_DRY_RUN === '1';

async function main() {
  console.log(`[reingestRag] início${DRY ? ' (DRY RUN)' : ''}`);

  const docs = (await prisma.$queryRawUnsafe(`
    SELECT d.id, d.title, d.content, k."organizationId" AS org
      FROM kb_documents d
      JOIN knowledge_bases k ON k.id = d."knowledgeBaseId"
     WHERE d.content IS NOT NULL AND length(trim(d.content)) > 0
  `)) as Array<{ id: string; title: string | null; content: string; org: string }>;

  const qas = (await prisma.$queryRawUnsafe(`
    SELECT id, question, answer, "organizationId" AS org
      FROM qa_pairs
     WHERE "isActive" = true AND answer IS NOT NULL AND length(trim(answer)) > 0
  `)) as Array<{ id: string; question: string; answer: string; org: string }>;

  console.log(`[reingestRag] docs=${docs.length} qas=${qas.length}`);

  let ok = 0, fail = 0;

  for (const d of docs) {
    if (DRY) { ok++; continue; }
    try {
      await ingestDocument(d.org, {
        filename: `${(d.title || 'doc-' + d.id).replace(/[^\w.\- ]/g, '_').slice(0, 80)}.txt`,
        content: Buffer.from(d.content, 'utf8'),
        mimeType: 'text/plain',
      });
      ok++;
    } catch (e: any) {
      fail++;
      console.error(`  doc ${d.id} (org ${d.org}) FALHOU: ${e?.message}`);
    }
  }

  for (const q of qas) {
    if (DRY) { ok++; continue; }
    try {
      await ingestDocument(q.org, {
        filename: `qa-${q.id}.txt`,
        content: Buffer.from(`Pergunta: ${q.question}\nResposta: ${q.answer}`, 'utf8'),
        mimeType: 'text/plain',
      });
      ok++;
    } catch (e: any) {
      fail++;
      console.error(`  qa ${q.id} (org ${q.org}) FALHOU: ${e?.message}`);
    }
  }

  console.log(`[reingestRag] concluído — ingeridos=${ok} falhas=${fail}`);
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error('[reingestRag] ERRO:', e); await prisma.$disconnect(); process.exit(1); });
