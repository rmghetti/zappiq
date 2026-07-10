'use client';

/**
 * AgentMessageActions — mini-toolbar inline em bolhas do agente.
 *
 * Mecanismo #4 do PR #106: treinamento contextual. Cliente vê resposta
 * ruim do agente no Inbox → clica "Corrigir" → ensina resposta correta
 * → vira Q&A na KB. Próxima vez agente acerta.
 *
 * Princípio: friction zero entre "ver erro" e "corrigir erro".
 *
 * Renderiza só em bolhas isFromBot. Aparece on hover.
 */
import { useState } from 'react';
import { Pencil, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useAgentReadiness } from '../../hooks/useAgentReadiness';
import { SaibaMais } from '@/components/shared/SaibaMais';

interface Props {
  /** Pergunta original do cliente (mensagem INBOUND anterior) */
  question: string;
  /** Resposta do agente que precisa correção */
  agentAnswer: string;
}

export function AgentMessageActions({ question, agentAnswer }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedQuestion, setEditedQuestion] = useState(question);
  const [correctedAnswer, setCorrectedAnswer] = useState('');
  const { organization } = useAuthStore();
  const { mutate: refreshReadiness } = useAgentReadiness();

  const settings = (organization?.settings as any) || {};
  const agentName: string = settings.agentName || 'agente';

  async function handleSubmit() {
    if (!correctedAnswer.trim() || correctedAnswer.length < 3) {
      setError('Resposta correta precisa de no mínimo 3 caracteres.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/ai-training/qa', {
        question: editedQuestion.trim().substring(0, 500),
        answer: correctedAnswer.trim().substring(0, 4000),
        category: 'inline_correction',
        priority: 5,
      });
      setSuccess(true);
      void refreshReadiness();
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setCorrectedAnswer('');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar correção');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Mini toolbar — opacity 0 → 100 on parent hover (group-hover do Tailwind) */}
      <button
        onClick={() => { setOpen(true); setError(null); setSuccess(false); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 text-[10px] text-blue-600 hover:text-blue-700 font-medium"
        title={`Corrigir resposta de ${agentName}`}
      >
        <Pencil size={10} />
        Corrigir & treinar {agentName}
      </button>

      {/* Modal de correção */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-3">
                  <Check size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {agentName} aprendeu com você
                </h3>
                <p className="text-sm text-gray-500">
                  Próxima vez que receber essa pergunta, vai responder do jeito certo.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                      Corrigir resposta de {agentName}
                      <SaibaMais featureKey="conversations.corrigir-treinar" />
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Vamos transformar isso em Q&A — {agentName} aprende pra próxima.
                    </p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    disabled={submitting}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Pergunta do cliente
                    </label>
                    <textarea
                      value={editedQuestion}
                      onChange={(e) => setEditedQuestion(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Ex: Vocês atendem aos sábados?"
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Resposta INCORRETA que {agentName} deu
                    </label>
                    <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm text-red-900 leading-relaxed">
                      {agentAnswer}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Resposta CORRETA — o que {agentName} deveria ter dito
                    </label>
                    <textarea
                      value={correctedAnswer}
                      onChange={(e) => setCorrectedAnswer(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Ex: Sim! Atendemos aos sábados das 9h às 13h."
                      maxLength={4000}
                      autoFocus
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      {correctedAnswer.length}/4000 caracteres
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setOpen(false)}
                      disabled={submitting}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !correctedAnswer.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Treinando...
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          Salvar & treinar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
