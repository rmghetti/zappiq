'use client';

/**
 * TreinarAgenteFAB — botão flutuante persistente em todas as páginas
 * autenticadas. Click expande mini-painel com atalhos pra treinar agente.
 *
 * UX (PR #106):
 *   - Posição: bottom-right fixed. Não sobrepõe footer.
 *   - Esconde quando level === 'expert' (cliente já treinou bastante,
 *     pode revisitar via Sidebar > Treinar IA quando quiser).
 *   - Click → mini-menu radial: Adicionar conhecimento, Criar Q&A,
 *     Ajustar tom, Ver gaps.
 *   - Esc/click-outside fecha.
 *
 * Princípio: friction zero. Cliente vê resposta ruim no inbox,
 * clica FAB, ensina, volta. Cada segundo de fricção entre "ver erro"
 * e "corrigir erro" é cliente que desiste de treinar.
 */
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Sparkles, X, Upload, MessageSquareText, User, BarChart3, ClipboardList } from 'lucide-react';
import { useAgentReadiness } from '../../hooks/useAgentReadiness';
import { useAuthStore } from '../../stores/authStore';

interface FabAction {
  href: string;
  icon: any;
  label: string;
  description: string;
  iconColor: string;
}

const ACTIONS: FabAction[] = [
  {
    href: '/ai-training#survey',
    icon: ClipboardList,
    label: 'Completar qualificação',
    description: 'Questionário do negócio — maior peso no score (30 pts)',
    iconColor: 'text-fuchsia-600',
  },
  {
    href: '/ai-training#documents',
    icon: Upload,
    label: 'Adicionar conhecimento',
    description: 'Upload PDF, doc, URL ou texto',
    iconColor: 'text-emerald-600',
  },
  {
    href: '/ai-training#qa',
    icon: MessageSquareText,
    label: 'Criar pergunta & resposta',
    description: 'Fixe respostas exatas pra perguntas comuns',
    iconColor: 'text-blue-600',
  },
  {
    href: '/ai-training#identity',
    icon: User,
    label: 'Ajustar tom & identidade',
    description: 'Nome, tom de voz, mensagens padrão',
    iconColor: 'text-violet-600',
  },
  {
    href: '/ai-training',
    icon: BarChart3,
    label: 'Ver score & gaps',
    description: 'Diagnóstico completo do agente',
    iconColor: 'text-orange-600',
  },
];

export function TreinarAgenteFAB() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { readiness, loading } = useAgentReadiness();
  const { organization } = useAuthStore();

  // Click outside fecha
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEsc);
      return () => {
        document.removeEventListener('mousedown', handleClick);
        document.removeEventListener('keydown', handleEsc);
      };
    }
  }, [open]);

  if (loading || !readiness) return null;
  // Esconde só quando expert E score >= 95 (essencialmente "100%")
  if (readiness.level === 'expert' && readiness.score >= 95) return null;

  const settings = (organization?.settings as any) || {};
  const agentName: string = settings.agentName || 'Agente';

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50">
      {/* Painel expandido */}
      {open && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-violet-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <Sparkles size={14} />
                  Treinar {agentName}
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  Score atual: {readiness.score}/100
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/20">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="p-2">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`mt-0.5 ${action.iconColor}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{action.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{action.description}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-500">
            Quanto mais você treinar {agentName}, melhor ele atende seus clientes.
          </div>
        </div>
      )}

      {/* Botão FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all ${
          open
            ? 'bg-gray-900 text-white'
            : 'bg-gradient-to-r from-emerald-500 to-violet-600 text-white hover:scale-105'
        }`}
        title={`Treinar ${agentName}`}
        aria-label={`Treinar ${agentName}`}
      >
        <Sparkles size={18} className={open ? '' : 'animate-pulse'} />
        <span className="text-sm font-semibold hidden sm:inline">Treinar {agentName}</span>
      </button>
    </div>
  );
}
