/**
 * Integration test — generateRichDraft (Task B5 / Maestro 1B)
 * ============================================================================
 * Mocking style mirrors LLMRouter.test.ts: vi.mock before any import,
 * hoisted at the top of the file.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock LLMRouter before importing any module that uses it ──────────────────
vi.mock('../services/llm/LLMRouter.js', () => ({
  llmRouter: { complete: vi.fn() },
}));

// ── Mock @zappiq/database (prisma) to satisfy loadBusinessContext ────────────
// loadBusinessContext uses:
//   prisma.organization.findUnique   → org + settings
//   prisma.kBDocument.findMany       → doc titles
//   (prisma as any).QAPair.findMany  → Q&A pairs (cast because Prisma schema
//                                       uses QAPair, capital Q and A)
vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn().mockResolvedValue({
        plan: 'GROWTH',
        settings: { businessName: 'Loja X', niche: 'varejo' },
      }),
    },
    kBDocument: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    // loadBusinessContext casts prisma as any to access QAPair (Prisma generates
    // it as `qAPair` in camelCase but the code uses (prisma as any).QAPair)
    QAPair: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// ── Mock logger to silence output ────────────────────────────────────────────
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
import { llmRouter } from '../services/llm/LLMRouter.js';
import { generateRichDraft, loadBusinessContext } from './flowGenerator.js';
import { BLUEPRINTS } from './flowBlueprints.js';

// ── Fixture: a valid block plan that assemble() will accept ──────────────────
const PLAN = JSON.stringify({
  flowName: 'Qualificação',
  entry: 'b1',
  blocks: [
    { id: 'b1', type: 'message', text: 'Oi!', next: 'b2' },
    {
      id: 'b2',
      type: 'ask_buttons',
      question: 'O que procura?',
      options: [
        { title: 'Planos', next: 'b3' },
        { title: 'Suporte', next: 'b3' },
      ],
    },
    { id: 'b3', type: 'ai', prompt: 'ajude' },
  ],
  summary: 'rico',
  rationale: [],
});

// ─────────────────────────────────────────────────────────────────────────────

describe('generateRichDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('plano válido → draft rico (condition/interactive, source ai-rich)', async () => {
    (llmRouter.complete as ReturnType<typeof vi.fn>).mockResolvedValue({ text: PLAN });
    const ctx = await loadBusinessContext('org1');
    const d = await generateRichDraft(ctx, BLUEPRINTS.qualificacao, 'org1', false);

    expect(d.source).toBe('ai-rich');
    // ask_buttons expands to a condition node
    expect(d.nodes.some((n: any) => n.type === 'condition')).toBe(true);
    // ask_buttons buttons are interactive
    expect(d.nodes.some((n: any) => n.data?.interactive)).toBe(true);
  });

  it('JSON inválido → fallback (não ai-rich)', async () => {
    // First call (rich): returns unparseable text → fallback to content-fill.
    // Second call (content-fill): same mock returns unparseable text → content-fill
    // itself fails to parse → returns deterministic blueprint fallback (source:'fallback').
    (llmRouter.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'desculpa, não consigo',
    });
    const ctx = await loadBusinessContext('org1');
    const d = await generateRichDraft(ctx, BLUEPRINTS.qualificacao, 'org1', false);

    expect(d.source).not.toBe('ai-rich');
    expect(d.nodes.length).toBeGreaterThan(0);
  });

  it('LLM lança → fallback', async () => {
    // Both calls (rich + content-fill fallback) will throw → content-fill catches
    // and returns its own deterministic blueprint fallback (source:'fallback').
    (llmRouter.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const ctx = await loadBusinessContext('org1');
    const d = await generateRichDraft(ctx, BLUEPRINTS.qualificacao, 'org1', false);

    expect(d.source).not.toBe('ai-rich');
  });
});
