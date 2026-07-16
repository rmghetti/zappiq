/**
 * Mira Prospects — telemetria para o Analytics (observabilidade do add-on).
 *
 * Agrega o estado do módulo por org: funil de Alvos, cota do mês, qualidade
 * das fontes de enriquecimento (match rate/latência por fonte, doc 08),
 * cobertura de decisores (QSA x pegada pública), releases e conversão em CRM.
 * Só leitura; usado pela aba Mira Prospects do /analytics (gated por requireMira).
 */
import { prisma } from '@zappiq/database';
import { getMiraEntitlement, currentMonthKey } from '../../middleware/requireMira.js';

export interface MiraAnalytics {
  period: { days: number; since: string };
  funil: {
    total: number;
    criadosNoPeriodo: number;
    byStatus: Record<string, number>;
    byMotor: Record<string, number>;
    byKind: Record<string, number>;
    scoreMedioProntos: number | null;
  };
  cota: {
    used: number;
    total: number;
    tierQuota: number;
    packExtra: number;
    remaining: number;
    blocked: boolean;
    tier: string | null;
    packsComprados: number;
    monthKey: string;
  };
  fontes: Array<{
    fonte: string;
    total: number;
    valido: number;
    naoEncontrado: number;
    erro: number;
    matchRatePct: number;
    latenciaMediaMs: number | null;
  }>;
  decisores: { total: number; qsa: number; pegadaPublica: number };
  releases: { totalNoPeriodo: number; naoLidos: number };
  conversao: { prontos: number; pousaramCrm: number; taxaCrmPct: number };
}

const P = prisma as any;

export async function computeMiraAnalytics(orgId: string, periodDays = 30): Promise<MiraAnalytics> {
  const days = Math.min(Math.max(periodDays, 1), 365);
  const since = new Date(Date.now() - days * 86400000);

  const [statusRows, motorRows, kindRows, total, criadosNoPeriodo, prontosAgg, prontos, pousaramCrm] =
    await Promise.all([
      P.miraAlvo.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: true }),
      P.miraAlvo.groupBy({ by: ['motor'], where: { organizationId: orgId }, _count: true }),
      P.miraAlvo.groupBy({ by: ['kind'], where: { organizationId: orgId }, _count: true }),
      P.miraAlvo.count({ where: { organizationId: orgId } }),
      P.miraAlvo.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
      P.miraAlvo.aggregate({ where: { organizationId: orgId, status: 'READY' }, _avg: { miraScore: true } }),
      P.miraAlvo.count({ where: { organizationId: orgId, status: { in: ['READY', 'DELIVERED'] } } }),
      P.miraAlvo.count({ where: { organizationId: orgId, dealId: { not: null } } }),
    ]);

  const toMap = (rows: any[], key: string): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r[key]] = typeof r._count === 'number' ? r._count : r._count?._all ?? 0;
    return m;
  };

  // Cota do mês corrente
  const ent = await getMiraEntitlement(orgId);
  const monthKey = currentMonthKey();
  const ledger = await P.miraUsageMonthly.findUnique({
    where: { organizationId_monthKey: { organizationId: orgId, monthKey } },
    select: { packPurchases: true },
  });
  const packsComprados = Array.isArray(ledger?.packPurchases) ? ledger.packPurchases.length : 0;

  // Qualidade das fontes de enriquecimento (log do período)
  const logRows: any[] = await P.miraEnriquecimentoLog.groupBy({
    by: ['fonte', 'resultado'],
    where: { organizationId: orgId, createdAt: { gte: since } },
    _count: true,
    _avg: { latenciaMs: true },
  });
  const fonteMap = new Map<string, { total: number; valido: number; naoEncontrado: number; erro: number; latSum: number; latN: number }>();
  for (const r of logRows) {
    const f = fonteMap.get(r.fonte) ?? { total: 0, valido: 0, naoEncontrado: 0, erro: 0, latSum: 0, latN: 0 };
    const c = typeof r._count === 'number' ? r._count : r._count?._all ?? 0;
    f.total += c;
    if (r.resultado === 'valido') f.valido += c;
    else if (r.resultado === 'nao_encontrado') f.naoEncontrado += c;
    else if (r.resultado === 'erro') f.erro += c;
    if (r._avg?.latenciaMs != null) {
      f.latSum += r._avg.latenciaMs * c;
      f.latN += c;
    }
    fonteMap.set(r.fonte, f);
  }
  const fontes = Array.from(fonteMap.entries())
    .map(([fonte, f]) => ({
      fonte,
      total: f.total,
      valido: f.valido,
      naoEncontrado: f.naoEncontrado,
      erro: f.erro,
      matchRatePct: f.total ? Math.round((f.valido / f.total) * 100) : 0,
      latenciaMediaMs: f.latN ? Math.round(f.latSum / f.latN) : null,
    }))
    .sort((a, b) => b.total - a.total);

  // Decisores por fonte (QSA x pegada pública)
  const [decTotal, decQsa] = await Promise.all([
    P.miraDecisor.count({ where: { alvo: { organizationId: orgId } } }),
    P.miraDecisor.count({ where: { alvo: { organizationId: orgId }, vinculoQsa: true } }),
  ]);

  // Releases no período
  const [relPeriodo, relNaoLidos] = await Promise.all([
    P.miraRelease.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
    P.miraRelease.count({ where: { organizationId: orgId, lida: false } }),
  ]);

  return {
    period: { days, since: since.toISOString() },
    funil: {
      total,
      criadosNoPeriodo,
      byStatus: toMap(statusRows, 'status'),
      byMotor: toMap(motorRows, 'motor'),
      byKind: toMap(kindRows, 'kind'),
      scoreMedioProntos: prontosAgg?._avg?.miraScore != null ? Math.round(prontosAgg._avg.miraScore) : null,
    },
    cota: {
      used: ent.quota.used,
      total: ent.quota.total,
      tierQuota: ent.quota.tierQuota,
      packExtra: ent.quota.packExtra,
      remaining: ent.quota.remaining,
      blocked: ent.quota.blocked,
      tier: ent.access.tier,
      packsComprados,
      monthKey,
    },
    fontes,
    decisores: { total: decTotal, qsa: decQsa, pegadaPublica: Math.max(0, decTotal - decQsa) },
    releases: { totalNoPeriodo: relPeriodo, naoLidos: relNaoLidos },
    conversao: {
      prontos,
      pousaramCrm,
      taxaCrmPct: prontos ? Math.round((pousaramCrm / prontos) * 100) : 0,
    },
  };
}
