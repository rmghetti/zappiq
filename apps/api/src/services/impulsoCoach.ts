/*
 * ═════════════════════════════════════════════════════════════════
 * Impulso — Copiloto & Coach (pilar 3).
 * Le os contadores REAIS de uma campanha + o budgetPlan definido na
 * criacao (Iza Estrategista) e gera sugestoes objetivas de "o que e
 * quanto fazer" — em pt-BR, sem travessao, linguagem de dono de negocio.
 *
 * Deliberadamente DETERMINISTICO (sem chamada de LLM): e barato (roda
 * a cada listagem, sem custo por visualizacao), instantaneo e auditavel
 * — as regras sao explicitas, nao "a IA achou". Pura funcao de contadores
 * -> insights, testavel isoladamente.
 * ═════════════════════════════════════════════════════════════════
 */

export type CoachSeverity = 'good' | 'info' | 'warning';

export interface CoachInsight {
  severity: CoachSeverity;
  title: string;
  message: string;
}

export interface CoachCampaignInput {
  status: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  failedCount: number;
  budgetPlan?: { recommendedContacts?: number; recommendedAdSpendBrl?: number } | null;
}

const REPLY_RATE_LOW = 0.03; // abaixo disso, taxa de resposta fraca pro WhatsApp
const REPLY_RATE_HIGH = 0.15; // acima disso, taxa de resposta excelente
const FAILURE_RATE_WARN = 0.1; // 10%+ de falha merece atenção

/** Gera até 2 sugestões priorizadas (a mais acionável primeiro). Nunca lança. */
export function computeCoachInsights(c: CoachCampaignInput): CoachInsight[] {
  const insights: CoachInsight[] = [];
  const sent = c.sentCount || 0;

  // ── Campanha ainda não disparou: orienta pelo plano de verba ──────
  if (sent === 0) {
    const recommended = c.budgetPlan?.recommendedContacts;
    const spend = c.budgetPlan?.recommendedAdSpendBrl;
    if (recommended) {
      insights.push({
        severity: 'info',
        title: 'Pronta para disparar',
        message: spend
          ? `O plano sugere disparar para ${recommended.toLocaleString('pt-BR')} contatos, com ~R$ ${spend.toLocaleString('pt-BR')} de investimento em anúncio para reforçar o alcance.`
          : `O plano sugere disparar para ${recommended.toLocaleString('pt-BR')} contatos.`,
      });
    }
    return insights;
  }

  // ── Taxa de falha de envio ─────────────────────────────────────────
  const failureRate = sent > 0 ? c.failedCount / sent : 0;
  if (failureRate >= FAILURE_RATE_WARN) {
    insights.push({
      severity: 'warning',
      title: 'Muitas mensagens falharam',
      message: `${Math.round(failureRate * 100)}% dos envios falharam. Verifique se os números estão corretos e se o seu WhatsApp Business segue com boa qualidade.`,
    });
  }

  // ── Taxa de resposta ────────────────────────────────────────────────
  const replyRate = sent > 0 ? c.repliedCount / sent : 0;
  if (sent >= 20) {
    // só avalia com volume mínimo pra não julgar amostra pequena
    if (replyRate < REPLY_RATE_LOW) {
      insights.push({
        severity: 'warning',
        title: 'Taxa de resposta abaixo do esperado',
        message: `Só ${Math.round(replyRate * 100)}% responderam até agora. Considere testar outro horário de envio ou ajustar a oferta na mensagem.`,
      });
    } else if (replyRate > REPLY_RATE_HIGH) {
      insights.push({
        severity: 'good',
        title: 'Ótima taxa de resposta',
        message: `${Math.round(replyRate * 100)}% responderam. Vale repetir esse horário e essa oferta em uma próxima campanha.`,
      });
    }
  }

  // ── Progresso vs. plano de contatos ──────────────────────────────────
  const recommended = c.budgetPlan?.recommendedContacts;
  if (recommended && recommended > 0 && c.status === 'COMPLETED') {
    const pct = sent / recommended;
    if (pct < 0.7) {
      insights.push({
        severity: 'info',
        title: 'Alcance menor que o planejado',
        message: `O disparo alcançou ${sent.toLocaleString('pt-BR')} de ${recommended.toLocaleString('pt-BR')} contatos previstos. Amplie sua base de contatos com consentimento de marketing para chegar mais perto da meta.`,
      });
    }
  }

  return insights.slice(0, 2);
}
