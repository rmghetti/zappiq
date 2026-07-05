'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * /templates — FEATURE 5b.2 (gestão de templates de WhatsApp)
 * --------------------------------------------------------------------------
 * Lista / cria / edita / exclui templates (MessageTemplate). Também submete
 * à Meta pra aprovação (POST /api/templates/:id/submit) e destaca templates
 * de reengajamento (reabrem a janela de 24h da Meta).
 *
 * Backend: apps/api/src/routes/templates.ts (CRUD já existente).
 * Consome: GET/POST/PUT/DELETE /api/templates, POST /api/templates/:id/submit
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Plus, Pencil, Trash2, Send, RefreshCw, Loader2,
  CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { TemplateFormModal, type TemplateRecord } from '../../../components/templates/TemplateFormModal';

const STATUS_BADGE: Record<string, { cls: string; icon: any; label: string }> = {
  APPROVED: { cls: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Aprovado' },
  PENDING: { cls: 'bg-gray-100 text-gray-600', icon: Clock, label: 'Pendente' },
  SUBMITTED: { cls: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Em análise' },
  REJECTED: { cls: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejeitado' },
};

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    api.get('/api/templates')
      .then((res) => setTemplates(res.data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (t: TemplateRecord) => { setEditing(t); setModalOpen(true); };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Excluir este template? Esta ação não pode ser desfeita.')) return;
    setBusyId(id);
    try {
      await api.delete(`/api/templates/${id}`);
      fetchTemplates();
    } catch {
      alert('Não foi possível excluir o template.');
    } finally {
      setBusyId(null);
    }
  }, [fetchTemplates]);

  const handleSubmitToMeta = useCallback(async (id: string) => {
    if (!confirm('Enviar este template à Meta para aprovação? Depois de enviado, não pode ser editado até a resposta da Meta.')) return;
    setBusyId(id);
    try {
      await api.post(`/api/templates/${id}/submit`);
      fetchTemplates();
    } catch (err: any) {
      alert(err?.message || 'Não foi possível enviar o template à Meta.');
    } finally {
      setBusyId(null);
    }
  }, [fetchTemplates]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates de WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">
            Modelos aprovados pela Meta — usados em campanhas e pra reabrir a janela de 24h.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600"
        >
          <Plus size={16} /> Novo template
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
          ))
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum template cadastrado</h3>
            <p className="text-sm text-gray-500 mb-4">
              Crie um template pra usar em campanhas e pra reengajar contatos fora da janela de 24h.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600"
            >
              <Plus size={16} /> Criar primeiro template
            </button>
          </div>
        ) : (
          templates.map((t) => {
            const status = STATUS_BADGE[t.metaStatus || 'PENDING'] || STATUS_BADGE.PENDING;
            const StatusIcon = status.icon;
            const isBusy = busyId === t.id;
            // Só faz sentido (re)submeter enquanto não aprovado.
            const canSubmit = (t.metaStatus || 'PENDING') !== 'APPROVED' && (t.metaStatus || 'PENDING') !== 'SUBMITTED';
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-gray-900 truncate">{t.name}</h3>
                      {t.isReengagement && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                          <RefreshCw size={10} /> Reengajamento 24h
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {CATEGORY_LABEL[t.category] || t.category} · {t.language}
                    </p>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2 whitespace-pre-wrap">{t.bodyText}</p>
                    {t.footerText && (
                      <p className="text-[11px] text-gray-400 mt-1 italic">{t.footerText}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.cls}`}>
                      <StatusIcon size={12} /> {status.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {canSubmit && (
                        <button
                          onClick={() => handleSubmitToMeta(t.id)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
                          title="Enviar à Meta para aprovação"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Enviar à Meta
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(t)}
                        disabled={isBusy}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={isBusy}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <TemplateFormModal
        open={modalOpen}
        template={editing}
        onClose={() => setModalOpen(false)}
        onSaved={fetchTemplates}
      />
    </div>
  );
}
