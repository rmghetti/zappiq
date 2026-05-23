'use client';

/**
 * AgentTrainingWidget — substitui o Welcome widget do Dashboard.
 *
 * Comportamento (PR #106):
 *   - Lê AgentReadiness via /api/ai-training/status (não localStorage)
 *   - Renderiza ${agent.name} dinâmico do organization.settings
 *   - Aparece ENQUANTO score < 100 (nunca dismissed permanente — cliente
 *     deve continuar treinando agente sempre)
 *   - Substitui CTAs estáticos por nextActions PROATIVAS do backend
 *
 * Diferença vs Welcome widget anterior:
 *   - Antes: 3 CTAs fixos, hardcoded "Iza", lia localStorage stale.
 *   - Agora: nextActions vivas (até 3), nome do agente do DB,
 *     visível enquanto ainda há ações de treino abertas.
 *
 * IMPORTANTE: nada hardcodado "Iza". Nome do agente vem de
 * organization.settings.agentName (ou fallback "seu agente").
 */
import Link from 'next/link';
import { Sparkles, ArrowRight, Upload, MessageSquareText, Settings, Globe, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useAgentReadiness, readinessLevelColor, readinessLevelLabel } from '../../hooks/useAgentReadiness';

const ACTION_ICONS: Record<string, any> = {
  complete_survey: MessageSquareText,
  define_identity: User,
  upload_documents: Upload,
  add_qa_pairs: MessageSquareText,
  connect_whatsapp: Globe,
};

const ACTION_HREFS: Record<string, string> = {
  complete_survey: '/onboarding',
  define_identity: '/ai-training#identity',
  upload_documents: '/ai-training#documents',
  add_qa_pairs: '/ai-training#qa',
  connect_whatsapp: '/settings#canais',
  connect_channels: '/settings#canais',
};

export function AgentTrainingWidget() {
  const { organization } = useAuthStore();
  const { readiness, loading } = useAgentReadiness();

  // Esconde quando expert (score >= 85). Cliente expert não precisa do widget.
  if (loading || !readiness || readiness.level === 'expert') return null;

  const settings = (organization?.settings as any) || {};
  const agentName: string = settings.agentName || 'seu agente';
  const businessName: string = organization?.name || '';

  const colors = readinessLevelColor(readiness.level);
  const levelLabel = readinessLevelLabel(readiness.level);

  // Pega até 3 nextActions de maior impacto
  const topActions = [...readiness.nextActions]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  return (
    <div className={`mb-6 rounded-2xl border-2 ${colors.border} bg-gradient-to-br from-white via-white to-emerald-50/30 p-6 shadow-sm`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-violet-600 text-white flex items-center justify-center flex-shrink-0">
          <Sparkles size={22} />
        </div>
        <div className="flex-1 min-w-0">
          {/* Score + level + nome do agente */}
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">
              {agentName} está em <span className={colors.text}>{levelLabel}</span>
            </h2>
            <span className={`px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} text-xs font-bold`}>
              {readiness.score}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${colors.dot} transition-all duration-700`}
                style={{ width: `${readiness.score}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Continue treinando {agentName} pra ele atender melhor seus clientes.
              Cada documento, Q&A ou ajuste de tom melhora a precisão das respostas.
            </p>
          </div>

          {/* Próximas ações sugeridas (até 3) */}
          {topActions.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-3">
              {topActions.map((action) => {
                const Icon = ACTION_ICONS[action.id] || Sparkles;
                const href = ACTION_HREFS[action.id] || '/ai-training';
                return (
                  <Link
                    key={action.id}
                    href={href}
                    className="flex items-start gap-2 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-emerald-400 hover:shadow-sm transition-all group"
                  >
                    <Icon size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{action.cta}</span>
                        <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                          +{action.impact}pt
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{action.title}</p>
                    </div>
                    <ArrowRight size={14} className="text-gray-400 group-hover:text-emerald-600 mt-1" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Link "ver tudo" pra página de treino */}
          {topActions.length > 0 && (
            <Link
              href="/ai-training"
              className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Ver todas as ações de treinamento
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
