/**
 * A214 — a segunda porta de cadastro foi fechada.
 *
 * POST /api/auth/register continuava montada e pública. Ela criava
 * organização com plano STARTER e settings vazio e NÃO fazia nada do que o
 * cadastro real faz: sem agente live (ensureLiveAgentForOrg), sem base de
 * conhecimento, sem trial, sem ligar o signup, sem espelho no CRM. Quem
 * entrasse por ali caía no fallback do promptEngine, com configurações
 * vazias, e ficava sem Qualidade.
 *
 * Medido em 14/09/2026: nenhuma das 15 organizações veio dessa porta, e
 * nenhum componente do apps/web chamava a rota (só um método morto no
 * authStore, removido no mesmo PR). Por isso o caminho escolhido foi
 * REMOVER, não alinhar: manter duas portas de cadastro é manter duas
 * definições de "conta pronta".
 *
 * Abordagem: mesma de appointments.test.ts — sem supertest (server.ts puxa
 * Redis, OTel e BullMQ no import). Inspecionamos o router de verdade.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('@zappiq/database', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    organization: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  Prisma: {},
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const { default: router } = await import('./auth.js');

/** Caminhos montados no router de autenticação, por método. */
function caminhosMontados(metodo: string): string[] {
  const stack = (router as unknown as { stack: any[] }).stack;
  return stack
    .filter((layer) => layer.route && layer.route.methods[metodo])
    .map((layer) => layer.route.path as string);
}

describe('router de autenticação — a porta paralela de cadastro sumiu', () => {
  it('POST /register não existe mais (a rota devolve 404 no Express)', () => {
    expect(caminhosMontados('post')).not.toContain('/register');
  });

  it('o login continua montado (nada além da porta paralela saiu)', () => {
    expect(caminhosMontados('post')).toContain('/login');
  });

  it('o arquivo não tem mais o handler de registro', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const fonte = readFileSync(fileURLToPath(new URL('./auth.ts', import.meta.url)), 'utf8');
    expect(fonte).not.toMatch(/router\.post\(\s*'\/register'/);
    expect(fonte).not.toMatch(/registerSchema/);
  });
});
