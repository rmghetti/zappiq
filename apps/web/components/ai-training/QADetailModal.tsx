'use client';

/**
 * QADetailModal — abre um Q&A cadastrado na íntegra, com edição e exclusão.
 *
 * Antes, o item da lista mostrava pergunta e resposta truncadas pelo layout e
 * não tinha clique: para corrigir uma vírgula o cliente precisava apagar e
 * recadastrar. Aqui ele lê o conteúdo inteiro, edita e salva.
 *
 * Modo LEITURA (padrão ao abrir) → botão "Editar" liga o modo EDIÇÃO.
 * Salvar    → PUT /api/ai-training/qa/:id
 * Excluir   → DELETE /api/ai-training/qa/:id
 * As duas rotas já re-sincronizam a base de conhecimento (RAG) do cliente:
 * salvar reindexação o Q&A, excluir remove os trechos correspondentes.
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Trash2, Pencil, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';

export interface QAPairDetail {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  pair: QAPairDetail | null; // null = fechado
  onClose: () => void;
  onSaved: () => void; // recarrega a lista + readiness na página
}

export function QADetailModal({ pair, onClose, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reidrata o form toda vez que abre num Q&A diferente e volta pro modo leitura.
  useEffect(() => {
    if (pair) {
      setQuestion(pair.question);
      setAnswer(pair.answer);
      setCategory(pair.category || '');
      setEditing(false);
      setConfirmDelete(false);
      setError(null);
    }
  }, [pair]);

  if (!pair) return null;

  const busy = saving || deleting;
  const canSave = question.trim().length >= 3 && answer.trim().length >= 3;

  async function handleSave() {
    if (!pair || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/ai-training/qa/${pair.id}`, {
        question: question.trim(),
        answer: answer.trim(),
        // String vazia (e não undefined) para apagar a categoria de fato: uma
        // chave ausente no JSON faria o backend manter a categoria antiga.
        category: category.trim(),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar a pergunta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pair) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/api/ai-training/qa/${pair.id}`);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir a pergunta.');
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Pergunta e resposta cadastrada"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {editing ? 'Editar pergunta e resposta' : 'Pergunta e resposta'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {editing
                ? 'Ao salvar, a IA passa a usar a nova versão nas respostas.'
                : `Cadastrada em ${new Date(pair.createdAt).toLocaleDateString('pt-BR')}${
                    pair.isActive ? '' : ' · desativada, não está sendo usada pela IA'
                  }`}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {editing ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Pergunta</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Resposta</label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={8}
                  maxLength={4000}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {answer.length.toLocaleString('pt-BR')} / 4.000 caracteres
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Categoria (opcional)
                </label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={80}
                  placeholder="Ex.: Horários"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </>
          ) : (
            <>
              {pair.category && (
                <span className="inline-block text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                  {pair.category}
                </span>
              )}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Pergunta
                </p>
                <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap break-words">
                  {pair.question}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Resposta
                </p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                  {pair.answer}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-700">Excluir esta pergunta da base?</span>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Excluir
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5"
              >
                Manter
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 font-medium disabled:opacity-50"
            >
              <Trash2 size={15} /> Excluir
            </button>
          )}

          {!confirmDelete && (
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => {
                      // Descarta o rascunho e volta ao conteúdo salvo.
                      setQuestion(pair.question);
                      setAnswer(pair.answer);
                      setCategory(pair.category || '');
                      setEditing(false);
                      setError(null);
                    }}
                    disabled={busy}
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={busy || !canSave}
                    className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  <Pencil size={14} /> Editar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
