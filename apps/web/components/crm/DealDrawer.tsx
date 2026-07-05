'use client';

/**
 * DealDrawer — detalhe/edição de um deal do kanban (Feature 5a.3).
 *
 * Abre ao clicar num card do pipeline (/crm). Reusa o layout de painel lateral
 * do AccountDrawer (overlay + painel 460px à direita, seções em cartões cinza).
 *
 * Mostra:
 *   - Título e valor EDITÁVEIS (PUT /api/deals/:id — validado por zod no back).
 *   - Estágio (badge, read-only aqui; move-stage continua no drag do kanban).
 *   - Contato vinculado (nome/telefone) + atalhos: abrir no WhatsApp (wa.me) e
 *     abrir a conversa (/conversations?id=...).
 *   - Timeline de activities do deal (GET /api/deals/:id já devolve).
 *   - Conversa de origem (sourceConversation) quando existir.
 *
 * O fetch do detalhe é feito aqui dentro quando `dealId` muda; o kanban só passa
 * o id + callbacks. Ao salvar, chama onSaved() pro kanban refazer a lista.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, User, Phone, MessageCircle, ExternalLink, Loader2, Check, AlertCircle, Pencil,
} from 'lucide-react';
import { api } from '../../lib/api';

interface DealActivity {
  id: string;
  type: string;
  actor: string;
  title: string;
  body: string | null;
  conversationId: string | null;
  createdAt: string;
}

interface DealDetail {
  id: string;
  title: string;
  value: number | string | null;
  stage: string;
  contact: { id: string; name: string | null; phone: string; email: string | null; avatarUrl?: string | null } | null;
  sourceConversation: { id: string; status: string; channel: string; summary: string | null; updatedAt: string } | null;
  activities: DealActivity[];
}

interface Props {
  dealId: string | null;
  onClose: () => void;
  /** chamado após salvar edição, pro kanban refazer a lista/métricas. */
  onSaved: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  new: 'Novo',
  contatado: 'Contatado',
  qualified: 'Qualificado',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  won: 'Ganho',
  lost: 'Perdido',
};

const STAGE_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contatado: 'bg-sky-100 text-sky-800',
  qualified: 'bg-yellow-100 text-yellow-800',
  proposal: 'bg-orange-100 text-orange-800',
  negotiation: 'bg-purple-100 text-purple-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

// Rótulos legíveis pros tipos de activity (enum ActivityType do banco).
const ACTIVITY_LABELS: Record<string, string> = {
  CONTACT_CREATED: 'Contato criado',
  MESSAGE: 'Mensagem',
  STAGE_CHANGE: 'Mudança de estágio',
  NOTE: 'Nota',
  TASK_CREATED: 'Tarefa criada',
  TASK_COMPLETED: 'Tarefa concluída',
  CAMPAIGN_EVENT: 'Evento de campanha',
  AI_SUMMARY: 'Resumo da IA',
  FIELD_UPDATE: 'Campo atualizado',
  LEAD_SCORE_CHANGE: 'Lead score',
  DEAL_CREATED: 'Deal criado',
  DEAL_WON: 'Deal ganho',
  DEAL_LOST: 'Deal perdido',
};

function fmtBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n || 0);
}

/** Só dígitos — pra montar o link wa.me a partir do telefone salvo. */
function waNumber(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

export function DealDrawer({ dealId, onClose, onSaved }: Props) {
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edição inline de título + valor.
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [valueDraft, setValueDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback((id: string) => {
    setLoading(true);
    setError(null);
    api.get(`/api/deals/${id}`)
      .then((res) => {
        const d: DealDetail = res.data || res;
        setDeal(d);
        setTitleDraft(d.title || '');
        setValueDraft(d.value != null ? String(d.value) : '');
      })
      .catch((err: any) => setError(err?.message || 'Erro ao carregar o deal'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dealId) { setDeal(null); setEditing(false); return; }
    load(dealId);
    setEditing(false);
    setSaveError(null);
  }, [dealId, load]);

  async function handleSave() {
    if (!deal) return;
    setSaveError(null);
    const title = titleDraft.trim();
    if (title.length < 2) { setSaveError('Título precisa ter no mínimo 2 caracteres.'); return; }
    // Aceita "1.497,00" ou "1497.00" ou vazio (null).
    let value: number | null = null;
    if (valueDraft.trim()) {
      const parsed = Number(valueDraft.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'));
      if (Number.isNaN(parsed)) { setSaveError('Valor inválido.'); return; }
      value = parsed;
    }
    setSaving(true);
    try {
      const res = await api.put(`/api/deals/${deal.id}`, { title, value });
      const updated = res.data || res;
      // Mantém contato/conversa/activities já carregados; só reflete o editado.
      setDeal((prev) => (prev ? { ...prev, title: updated.title, value: updated.value } : prev));
      setEditing(false);
      onSaved();
    } catch (err: any) {
      setSaveError(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (!dealId) return null;

  const contact = deal?.contact;
  const wa = contact ? waNumber(contact.phone) : '';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

      <div className="absolute right-0 top-0 bottom-0 w-[460px] max-w-full bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0 pr-3">
            {loading && !deal ? (
              <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse" />
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 break-words">{deal?.title ?? '—'}</h2>
                {deal && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded ${STAGE_BADGE[deal.stage] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STAGE_LABELS[deal.stage] ?? deal.stage}
                    </span>
                    {deal.value != null && (
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded">
                        {fmtBRL(Number(deal.value))}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Fechar">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && !deal ? (
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-48 bg-gray-200 rounded" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : !deal ? (
            <div className="flex items-center justify-center h-64 text-gray-500">Sem dados disponíveis</div>
          ) : (
            <>
              {/* Detalhes editáveis — título + valor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Detalhes</h3>
                  {!editing && (
                    <button
                      onClick={() => { setEditing(true); setSaveError(null); }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Título *</label>
                      <input
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Valor (R$)</label>
                      <input
                        value={valueDraft}
                        onChange={(e) => setValueDraft(e.target.value)}
                        placeholder="Ex: 1.497,00"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    {saveError && (
                      <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{saveError}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => { setEditing(false); setTitleDraft(deal.title); setValueDraft(deal.value != null ? String(deal.value) : ''); setSaveError(null); }}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || titleDraft.trim().length < 2}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-semibold hover:bg-primary-600 disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-600">Título</span>
                      <span className="font-semibold text-gray-900 text-right break-words">{deal.title}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-600">Valor</span>
                      <span className="font-semibold text-gray-900 text-right">
                        {deal.value != null ? fmtBRL(Number(deal.value)) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-600">Estágio</span>
                      <span className="font-semibold text-gray-900 text-right">
                        {STAGE_LABELS[deal.stage] ?? deal.stage}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Contato vinculado */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Contato</h3>
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  {contact ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-primary-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{contact.name || 'Sem nome'}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone size={11} /> {contact.phone || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {wa && (
                          <a
                            href={`https://wa.me/${wa}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100"
                          >
                            <MessageCircle size={13} /> WhatsApp <ExternalLink size={11} />
                          </a>
                        )}
                        {deal.sourceConversation && (
                          <Link
                            href={`/conversations?id=${deal.sourceConversation.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold hover:bg-primary-100"
                          >
                            <MessageCircle size={13} /> Abrir conversa
                          </Link>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">Sem contato vinculado.</p>
                  )}
                </div>
              </div>

              {/* Conversa de origem (vínculo IA conversa→deal) */}
              {deal.sourceConversation && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Conversa de origem</h3>
                  <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-600">Canal</span>
                      <span className="font-semibold text-gray-900 text-right capitalize">{deal.sourceConversation.channel}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-600">Status</span>
                      <span className="font-semibold text-gray-900 text-right">{deal.sourceConversation.status}</span>
                    </div>
                    {deal.sourceConversation.summary && (
                      <p className="text-xs text-gray-600 pt-1 border-t border-gray-200">{deal.sourceConversation.summary}</p>
                    )}
                    <Link
                      href={`/conversations?id=${deal.sourceConversation.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
                    >
                      Abrir conversa <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              )}

              {/* Timeline de activities */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Atividades</h3>
                {deal.activities.length === 0 ? (
                  <p className="text-xs text-gray-400">Sem atividades registradas para este deal.</p>
                ) : (
                  <ul className="space-y-3">
                    {deal.activities.map((a) => (
                      <li key={a.id} className="relative pl-4 border-l-2 border-gray-200">
                        <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary-400" />
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-800">
                            {ACTIVITY_LABELS[a.type] ?? a.type}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {new Date(a.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        {a.title && <p className="text-xs text-gray-700 mt-0.5">{a.title}</p>}
                        {a.body && <p className="text-[11px] text-gray-500 mt-0.5">{a.body}</p>}
                        {a.conversationId && (
                          <Link
                            href={`/conversations?id=${a.conversationId}`}
                            className="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline mt-1"
                          >
                            Ver conversa <ExternalLink size={10} />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
