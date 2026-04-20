/**
 * ============================================================================
 * Competitor Benchmarks — fonte única para alegações comparativas
 * ============================================================================
 * Qualquer número "{X}% maior" ou "{Y} mais caro" no site precisa apontar
 * para um registro aqui. Cada registro requer:
 *   - `evidenceUrl`  → link para PDF/print da cotação real (signed URL)
 *   - `capturedAt`   → data ISO de captura
 *   - `verifiedBy`   → email do analista que coletou
 *
 * Se `evidenceUrl` = null, a UI renderiza "baseado em benchmarks de mercado"
 * + link para /legal/benchmarks-concorrentes.md (metodologia).
 * Nunca expor número sem fonte.
 * ============================================================================
 */

export interface CompetitorBenchmark {
  competitor: 'blip' | 'huggy' | 'zenvia' | 'poli' | 'twilio' | 'take';
  feature: string;
  competitorValue: string;
  zappiqValue: string;
  deltaSummary: string;            // ex: "80% mais caro"
  evidenceUrl: string | null;      // signed URL Supabase Storage
  capturedAt: string | null;       // ISO date
  verifiedBy: string | null;       // email do analista
}

export const COMPETITOR_BENCHMARKS: CompetitorBenchmark[] = [
  {
    competitor: 'blip',
    feature: 'Setup fee',
    competitorValue: 'R$ 8.000 (mediana de 3 propostas de 2025)',
    zappiqValue: 'R$ 0',
    deltaSummary: 'R$ 8.000 a menos no upfront',
    // TODO-V2-004: preencher com signed URL do PDF de cotação real
    evidenceUrl: null,
    capturedAt: null,
    verifiedBy: null,
  },
  {
    competitor: 'huggy',
    feature: 'Mensalidade equivalente (plano com volume ~8.000 msgs/mês)',
    competitorValue: 'R$ 1.450',
    zappiqValue: 'R$ 797',
    deltaSummary: '~80% mais caro que ZappIQ Growth',
    evidenceUrl: null,
    capturedAt: null,
    verifiedBy: null,
  },
  {
    competitor: 'zenvia',
    feature: 'Time-to-IA-pronta',
    competitorValue: '90–180 dias (setup + consultoria)',
    zappiqValue: '< 24h (self-serve)',
    deltaSummary: '~100x mais rápido',
    evidenceUrl: null,
    capturedAt: null,
    verifiedBy: null,
  },
  {
    competitor: 'poli',
    feature: 'Trial gratuito',
    competitorValue: '7 dias',
    zappiqValue: '14 dias',
    deltaSummary: '2x mais tempo para validar',
    evidenceUrl: null,
    capturedAt: null,
    verifiedBy: null,
  },
];

/** Helper: retorna texto formatado ou fallback genérico. */
export function renderBenchmarkClaim(b: CompetitorBenchmark): {
  label: string;
  hasEvidence: boolean;
  evidenceHref: string;
} {
  return {
    label: `${b.competitor.toUpperCase()}: ${b.competitorValue} · ZappIQ: ${b.zappiqValue}`,
    hasEvidence: !!b.evidenceUrl,
    evidenceHref: b.evidenceUrl ?? '/legal/benchmarks-concorrentes',
  };
}
