'use client';

/**
 * DocumentDetailModal — abre um item da base de conhecimento na íntegra.
 *
 * Texto colado: mostra o conteúdo inteiro e permite editar título e texto.
 * Salvar → PUT /api/ai-training/documents/:id, que reindexa a base de
 * conhecimento (RAG) do cliente sob o novo título e limpa os trechos do antigo.
 *
 * Arquivo e URL: só leitura. O conteúdo deles vem da fonte (o PDF enviado, a
 * página do site) e vive no vector store, não aqui. Editar daria a impressão
 * falsa de alterar o arquivo original. Para corrigir, o caminho é remover e
 * enviar de novo.
 *
 * O conteúdo não vem na listagem (GET /documents devolve só metadata), então
 * o modal busca GET /documents/:id ao abrir.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Trash2, Pencil, AlertCircle, Globe, FileText, ClipboardPaste } from 'lucide-react';
import { api } from '../../lib/api';

interface DocumentDetail {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl?: string | null;
  content: string;
  createdAt: string;
  editable: boolean;
}

interface Props {
  documentId: string | null; // null = fechado
  onClose: () => void;
  onSaved: () => void; // recarrega a lista + readiness na página
}

export function DocumentDetailModal({ documentId, onClose, onSaved }: Props) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ document: DocumentDetail }>(`/api/ai-training/documents/${id}`);
      setDoc(data.document);
      setTitle(data.document.title);
      setContent(data.document.content);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar este item.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (documentId) {
      setDoc(null);
      setEditing(false);
      setConfirmDelete(false);
      load(documentId);
    }
  }, [documentId, load]);

  if (!documentId) return null;

  const busy = saving || deleting;
  const canSave = title.trim().length >= 2 && content.trim().length >= 20;

  async function handleSave() {
    if (!doc || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/ai-training/documents/${doc.id}`, {
        title: title.trim(),
        content: content.trim(),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar o texto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!doc) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/api/ai-training/documents/${doc.id}`);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao remover o item.');
      setDeleting(false);
    }
  }

  const kindLabel =
    doc?.sourceType === 'url' ? 'URL' : doc?.sourceType === 'text' ? 'Texto colado' : 'Arquivo';
  const KindIcon = doc?.sourceType === 'url' ? Globe : doc?.sourceType === 'text' ? ClipboardPaste : FileText;

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
        aria-label="Item da base de conhecimento"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {editing ? 'Editar texto' : doc?.title || 'Carregando...'}
            </h2>
            {doc && !editing && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                <KindIcon size={12} /> {kindLabel} · adicionado em{' '}
                {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
              </p>
            )}
            {editing && (
              <p className="text-xs text-gray-500 mt-0.5">
                Ao salvar, a IA passa a usar a nova versão nas respostas.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50 flex-shrink-0"
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

          {loading && (
            <div className="py-10 flex items-center justify-center text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}

          {doc && !loading && editing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Título</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Conteúdo</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={14}
                  maxLength={50000}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {content.trim().length > 0 && content.trim().length < 20
                    ? 'Cole um pouco mais de conteúdo (mín. 20 caracteres)'
                    : `${content.length.toLocaleString('pt-BR')} caracteres`}
                </p>
              </div>
            </>
          )}

          {doc && !loading && !editing && (
            <>
              {doc.sourceType === 'url' && doc.sourceUrl && (
                <a
                  href={doc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:underline break-all inline-block"
                >
                  {doc.sourceUrl}
                </a>
              )}
              {doc.content ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Conteúdo
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {doc.content}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-6 text-center">
                  <KindIcon size={22} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    O conteúdo deste {kindLabel.toLowerCase()} está indexado na base da IA, não
                    guardamos uma cópia aqui.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Para corrigir a informação, remova o item e envie a versão nova.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {doc && !loading && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-gray-700">Remover este item da base?</span>
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Remover
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
                <Trash2 size={15} /> Remover
              </button>
            )}

            {!confirmDelete && (
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={() => {
                        setTitle(doc.title);
                        setContent(doc.content);
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
                  doc.editable && (
                    <button
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      <Pencil size={14} /> Editar
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
