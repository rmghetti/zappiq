'use client';

/**
 * AgentHealthChip — chip pequeno no Header com score do agente.
 *
 * Sempre visível em todas as páginas /(dashboard)/*. Click navega
 * pra /ai-training (página completa de treinamento). Cor por level.
 *
 * UX: gamificação leve. Cliente vê número e quer subir. Loop psicológico
 * pra manter engajamento contínuo de treinamento.
 */
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useAgentReadiness, readinessLevelColor, readinessLevelLabel } from '../../hooks/useAgentReadiness';
import { useAuthStore } from '../../stores/authStore';

export function AgentHealthChip() {
  const { readiness, loading } = useAgentReadiness();
  const { organization } = useAuthStore();

  if (loading || !readiness) return null;

  const colors = readinessLevelColor(readiness.level);
  const levelLabel = readinessLevelLabel(readiness.level);
  const settings = (organization?.settings as any) || {};
  const agentName: string = settings.agentName || 'Agente';

  return (
    <Link
      href="/ai-training"
      className={`hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg} ${colors.border} border transition-all hover:shadow-sm group`}
      title={`Treinar ${agentName} — ${levelLabel} (${readiness.score}/100)`}
    >
      <Sparkles size={14} className={colors.text} />
      <span className={`text-xs font-semibold ${colors.text}`}>
        {agentName}: {readiness.score}
      </span>
      <span className={`text-[10px] uppercase tracking-wider font-bold ${colors.text} opacity-75`}>
        {levelLabel}
      </span>
    </Link>
  );
}
