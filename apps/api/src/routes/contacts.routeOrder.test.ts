/**
 * W2.2 — exportar contatos quebrado.
 *
 * Bug: em contacts.ts a rota GET /export estava registrada DEPOIS de GET /:id.
 * No Express, a primeira rota que casa o path vence, então '/:id' capturava
 * 'export' como :id e devolvia 404 (contato inexistente). O fix é registrar
 * '/export' ANTES de '/:id'.
 *
 * Abordagem: teste puro (sem supertest — server.ts puxa Redis/OTel/BullMQ).
 * Mockamos as deps de I/O (@zappiq/database e o middleware de RLS), importamos
 * o router e inspecionamos o router.stack do Express para garantir a ORDEM de
 * registro. Ordem de registro == ordem de match no Express 4.
 */
import { describe, it, expect, vi } from 'vitest';

// Evita conexão real com o banco quando o módulo do route é importado.
vi.mock('@zappiq/database', () => ({
  prisma: {},
  Prisma: {},
}));

// withTenant não deve tocar o banco no teste de ordenação de rota.
vi.mock('../middleware/rlsTenant.js', () => ({
  withTenant: vi.fn(),
}));

const { default: router } = await import('./contacts.js');

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean> };
};

/** Retorna [{ method, path }] das rotas GET na ordem em que foram registradas. */
function getRoutes(): { method: string; path: string }[] {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;
  const routes: { method: string; path: string }[] = [];
  for (const layer of stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({ method: method.toUpperCase(), path: layer.route.path });
    }
  }
  return routes;
}

describe('contacts router — ordem das rotas (W2.2)', () => {
  it('registra GET /export ANTES de GET /:id', () => {
    const gets = getRoutes().filter((r) => r.method === 'GET');
    const exportIdx = gets.findIndex((r) => r.path === '/export');
    const idIdx = gets.findIndex((r) => r.path === '/:id');

    expect(exportIdx, 'GET /export deve existir').toBeGreaterThanOrEqual(0);
    expect(idIdx, 'GET /:id deve existir').toBeGreaterThanOrEqual(0);
    expect(
      exportIdx,
      "GET /export precisa vir antes de GET /:id, senão '/:id' captura 'export' (404)",
    ).toBeLessThan(idIdx);
  });

  it("'/export' NÃO casa com o padrão de '/:id' antes de sua própria rota", () => {
    // Garante que a primeira rota GET que casaria o path 'export' é a /export,
    // não a /:id — que é exatamente o modo de falha do bug.
    const gets = getRoutes().filter((r) => r.method === 'GET');
    const firstMatch = gets.find((r) => r.path === '/export' || r.path === '/:id');
    expect(firstMatch?.path).toBe('/export');
  });
});
