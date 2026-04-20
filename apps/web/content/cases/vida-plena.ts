/**
 * ============================================================================
 * Case canônico — Clínica Vida Plena
 * ============================================================================
 * Fonte ÚNICA de verdade para o case "Vida Plena" no site ZappIQ.
 *
 * Home, /cases, /segmentos/saude e qualquer outro componente DEVEM importar
 * daqui. Nunca hardcodar número, nome ou métrica do case em componente.
 *
 * Estado atual: PENDING (autorização LGPD em andamento — BLOCKER B-01).
 * Enquanto PENDING, `displayName` vira genérico e métricas viram "médias de
 * clientes beta em Saúde".
 *
 * Ao receber autorização:
 *   1. trocar authorizationStatus para 'AUTHORIZED'
 *   2. preencher campos `*.verified = true`
 *   3. adicionar logo em apps/web/public/cases/vida-plena/logo.svg
 *
 * Referência regulatória: LGPD Art. 7, item IX (autorização por escrito).
 * ============================================================================
 */

export type AuthorizationStatus = 'PENDING' | 'AUTHORIZED';

export interface VidaPlenaCase {
  // ─── Identidade ────────────────────────────────────────────────────────
  id: 'vida-plena';
  displayName: string;              // "Clínica Vida Plena" quando autorizado
  businessName: string;             // nome curto p/ chat widget do hero
  authorDisplayName: string;        // "Dra. Camila Andrade" quando autorizado
  authorRole: string;
  segment: 'saude' | 'odontologia' | 'medicina';
  city: string;
  state: string;
  authorizationStatus: AuthorizationStatus;

  // ─── Logo ──────────────────────────────────────────────────────────────
  logoPath: string | null;          // null enquanto não autorizado

  // ─── Métricas canônicas (verificadas pelo cliente) ─────────────────────
  metrics: {
    responseRate: number;                 // %  — taxa de resposta dentro de 2min
    avgResponseMinutes: number;           // minutos
    appointmentsUplift: number;           // %  — uplift em agendamentos vs baseline
    noShowBefore: number;                 // % (taxa no-show antes ZappIQ)
    noShowAfter: number;                  // % (taxa no-show depois ZappIQ)
    csatScore: number;                    // 0–5
    leadsUplift: number;                  // % — uplift em leads qualificados
    humanHandoffRate: number;             // % — % de conversas que chegam em humano
    verified: boolean;                    // true quando cliente validou os números
  };

  // ─── Depoimento ────────────────────────────────────────────────────────
  testimonial: {
    quote: string;
    verifiedByEmail: boolean;
  };

  // ─── Dados do trial/produção ───────────────────────────────────────────
  goLiveDate: string;                  // ISO date
  planUsed: 'STARTER' | 'GROWTH' | 'SCALE' | 'BUSINESS';
}

// ─────────────────────────────────────────────────────────────────────────
// FONTE ÚNICA
// ─────────────────────────────────────────────────────────────────────────

export const VIDA_PLENA: VidaPlenaCase = {
  id: 'vida-plena',
  // TODO-V2-009: trocar por 'Clínica Vida Plena' quando authorizationStatus = 'AUTHORIZED'
  displayName: 'Clínica de Saúde (case em validação)',
  businessName: 'Sua Clínica',
  // TODO-V2-009: trocar por 'Dra. Camila Andrade' quando autorizado
  authorDisplayName: 'Dra. Camila (nome preservado por solicitação da paciente)',
  authorRole: 'Diretora clínica',
  segment: 'saude',
  city: 'São Paulo',
  state: 'SP',
  authorizationStatus: 'PENDING',

  logoPath: null,

  // TODO-V2-010: números verificados pelo cliente. Manter este objeto como
  // FONTE ÚNICA. Zero ocorrência de '45%', '250%', '8%', '4.9' fora daqui.
  metrics: {
    responseRate: 99.2,
    avgResponseMinutes: 3,
    appointmentsUplift: 45,
    noShowBefore: 28,
    noShowAfter: 8,
    csatScore: 4.9,
    leadsUplift: 250,
    humanHandoffRate: 28,
    verified: false,             // ←  vai virar true quando cliente assinar termo
  },

  testimonial: {
    quote:
      'A IA virou a recepção 24/7. Minha secretária ganhou 4h por dia para cuidar de quem chega na clínica — não de quem manda WhatsApp.',
    verifiedByEmail: false,
  },

  goLiveDate: '2026-01-20',
  planUsed: 'GROWTH',
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers de renderização — usar SEMPRE estes nas views
// ─────────────────────────────────────────────────────────────────────────

/** Se autorizado, retorna nome real; senão, retorna placeholder respeitoso. */
export function getCaseName(c: VidaPlenaCase = VIDA_PLENA): string {
  return c.authorizationStatus === 'AUTHORIZED' ? c.displayName : 'Exemplo ilustrativo · cliente Saúde';
}

/** Similar para autor. */
export function getAuthorDisplay(c: VidaPlenaCase = VIDA_PLENA): string {
  return c.authorizationStatus === 'AUTHORIZED'
    ? c.authorDisplayName
    : 'Diretora clínica (identidade preservada)';
}

/** Disclaimer obrigatório abaixo de qualquer alegação de métrica. */
export const CASE_DISCLAIMER =
  'Métricas observadas em clientes beta ZappIQ entre ago/25 e fev/26. Variam por vertical, maturidade da base de conhecimento e configuração de handoff humano. Uso de nome e dados do cliente sob autorização LGPD Art. 7, item IX.';

/** Lista de métricas em formato p/ UI (evita hard-code no componente). */
export function getHighlightMetrics(c: VidaPlenaCase = VIDA_PLENA) {
  return [
    { label: 'Taxa de resposta', value: `${c.metrics.responseRate}%`, verified: c.metrics.verified },
    { label: 'Tempo médio de resposta', value: `${c.metrics.avgResponseMinutes} min`, verified: c.metrics.verified },
    { label: 'Uplift em agendamentos', value: `+${c.metrics.appointmentsUplift}%`, verified: c.metrics.verified },
    { label: 'No-show (antes → depois)', value: `${c.metrics.noShowBefore}% → ${c.metrics.noShowAfter}%`, verified: c.metrics.verified },
    { label: 'CSAT', value: c.metrics.csatScore.toFixed(1), verified: c.metrics.verified },
  ];
}
