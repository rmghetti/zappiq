'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/iza-knowledge — Editor da Camada 2 (iza_facts)
 * --------------------------------------------------------------------
 * Antes deste PR: SUPERADMIN tinha que abrir Supabase Studio e rodar SQL
 * manual pra atualizar fatos da Iza. Atrito alto + risco de typo.
 *
 * Agora: dashboard pra criar/editar/desativar facts via UI. Cada mutação
 * invalida o cache do izaFactsService — próximo turno reflete (≤60s).
 *
 * Restrito a SUPERADMIN. Mesma fonte de verdade pra WhatsApp + IG + chat web.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw, Plus, Edit2, Trash2, AlertCircle, CheckCircle2,
  Power, BookOpen, Save, X as XIcon, ExternalLink, Database,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import {
  izaFactsApi,
  type IzaFactRow,
  type IzaFactSection,
  type IzaFactStatus,
  type IzaFactCreateInput,
  type IzaFactUpdateInput,
} from '../../../../lib/adminApi';

const SECTIONS: IzaFactSection[] = ['canais', 'features', 'urls', 'compliance', 'pricing', 'parcerias'];
const STATUSES: IzaFactStatus[] = ['live', 'beta', 'rollout', 'pending', 'sunset'];

const SECTION_LABEL: Record<IzaFactSection, string> = {
  canais: 'Canais',
  features: 'Features',
  urls: 'URLs',
  compliance: 'Compliance',
  pricing: 'Pricing',
  parcerias: 'Parcerias',
};

const STATUS_COLORS: Record<IzaFactStatus, string> = {
  live: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  beta: 'bg-amber-100 text-amber-800 border-amber-200',
  rollout: 'bg-blue-100 text-blue-800 border-blue-200',
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  sunset: 'bg-rose-100 text-rose-800 border-rose-200',
};

interface FormState extends Partial<IzaFactCreateInput> {
  active?: boolean;
}

const EMPTY_FORM: FormState = {
  id: '',
  section: 'canais',
  fact_key: '',
  label: '',
  status: 'live',
  description: '',
  url: '',
  order_idx: 100,
  notes: '',
};

export default function IzaKnowledgePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [facts, setFacts] = useState<IzaFactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await izaFactsApi.list();
      setFacts(res.facts);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar facts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') load();
  }, [user]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Agrupa por section
  const grouped = useMemo(() => {
    const visible = facts.filter((f) => showInactive || f.active);
    const map = new Map<IzaFactSection, IzaFactRow[]>();
    for (const f of visible) {
      const arr = map.get(f.section) || [];
      arr.push(f);
      map.set(f.section, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.order_idx - b.order_idx);
    }
    return map;
  }, [facts, showInactive]);

  const startEdit = (f: IzaFactRow) => {
    setCreating(false);
    setEditingId(f.id);
    setForm({
      id: f.id,
      section: f.section,
      fact_key: f.fact_key,
      label: f.label,
      status: f.status,
      description: f.description || '',
      url: f.url || '',
      order_idx: f.order_idx,
      notes: f.notes || '',
      active: f.active,
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_FORM);
  };

  const cancelForm = () => {
    setEditingId(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (creating) {
        await izaFactsApi.create({
          id: form.id!,
          section: form.section!,
          fact_key: form.fact_key!,
          label: form.label!,
          status: form.status!,
          description: form.description || null,
          url: form.url || null,
          order_idx: form.order_idx ?? 100,
          notes: form.notes || null,
        });
        showToast('Fato criado.');
      } else if (editingId) {
        const updates: IzaFactUpdateInput = {
          section: form.section,
          fact_key: form.fact_key,
          label: form.label,
          status: form.status,
          description: form.description ?? null,
          url: form.url ?? null,
          order_idx: form.order_idx,
          notes: form.notes ?? null,
          active: form.active,
        };
        await izaFactsApi.update(editingId, updates);
        showToast('Fato atualizado. Cache invalidado.');
      }
      cancelForm();
      await load();
    } catch (err: any) {
      const errMsg = err?.message || 'Erro ao salvar';
      if (errMsg.includes('fact_id_exists')) {
        showToast('ID já existe — escolha outro.');
      } else {
        showToast(errMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (f: IzaFactRow) => {
    try {
      await izaFactsApi.update(f.id, { active: !f.active });
      showToast(f.active ? `Desativado: ${f.label}` : `Reativado: ${f.label}`);
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro');
    }
  };

  const handleDelete = async (f: IzaFactRow) => {
    if (!confirm(`Desativar "${f.label}"?\n\nO fato vira inactive (soft delete) — Iza não mostra mais. Pode reativar depois.`)) return;
    try {
      await izaFactsApi.remove(f.id);
      showToast(`Removido: ${f.label}`);
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro');
    }
  };

  const handleInvalidateCache = async () => {
    try {
      await izaFactsApi.invalidateCache();
      showToast('Cache invalidado. Próximo turno da Iza reflete o estado atual.');
    } catch (err: any) {
      showToast(err?.message || 'Erro');
    }
  };

  if (user?.role !== 'SUPERADMIN') {
    return <div className="p-8 text-gray-500">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Iza Knowledge (Camada 2)</h1>
              <p className="text-sm text-gray-600">
                Fatos da plataforma injetados em runtime no system prompt da Iza. Mudou aqui, reflete em ≤60s em todos os canais (WhatsApp + Instagram + chat web).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInvalidateCache}
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              title="Força reload imediato do cache (sem esperar TTL de 60s)"
            >
              <RefreshCw size={14} /> Invalidar cache
            </button>
            <button
              type="button"
              onClick={load}
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recarregar
            </button>
            <button
              type="button"
              onClick={startCreate}
              className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <Plus size={14} /> Novo fato
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            {toast}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700">Mostrar inativos</span>
          </label>
          <div className="text-gray-500">{facts.filter((f) => f.active).length} ativos · {facts.length} total</div>
        </div>

        {/* Form (create or edit) */}
        {(creating || editingId) && (
          <FormPanel
            form={form}
            setForm={setForm}
            creating={creating}
            editingId={editingId}
            saving={saving}
            onSave={handleSave}
            onCancel={cancelForm}
          />
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Sections */}
        {loading && !facts.length ? (
          <div className="p-8 text-center text-gray-500">Carregando facts…</div>
        ) : (
          SECTIONS.map((section) => {
            const items = grouped.get(section) || [];
            if (items.length === 0) return null;
            return (
              <div key={section} className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  {SECTION_LABEL[section]} <span className="text-gray-400">({items.length})</span>
                </h2>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr className="text-left text-xs uppercase text-gray-500">
                        <th className="px-3 py-2 w-24">Status</th>
                        <th className="px-3 py-2">Label</th>
                        <th className="px-3 py-2 w-16">Ordem</th>
                        <th className="px-3 py-2 w-32">Atualizado</th>
                        <th className="px-3 py-2 w-32 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((f) => (
                        <tr key={f.id} className={`border-b border-gray-100 last:border-0 ${f.active ? '' : 'opacity-50'}`}>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[f.status]}`}>
                              {f.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-gray-900">{f.label}</div>
                            {f.description && (
                              <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{f.description}</div>
                            )}
                            {f.url && (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-1"
                              >
                                {f.url} <ExternalLink size={10} />
                              </a>
                            )}
                            <div className="text-[10px] text-gray-400 mt-1 font-mono">id: {f.id}</div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">{f.order_idx}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">
                            {new Date(f.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            {f.updated_by && <div className="text-[10px] text-gray-400">{f.updated_by}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleActive(f)}
                                className={`p-1.5 rounded hover:bg-gray-100 ${f.active ? 'text-emerald-600' : 'text-gray-400'}`}
                                title={f.active ? 'Desativar' : 'Reativar'}
                              >
                                <Power size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(f)}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                                title="Editar"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(f)}
                                className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                                title="Desativar (soft delete)"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}

        {/* Footer dica */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
          <Database size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <div className="font-semibold mb-1">Como a Iza usa esses fatos</div>
            <div>
              A cada turno (WhatsApp / Instagram / chat web), os fatos <code className="bg-white px-1 rounded">active=true</code> são renderizados como um bloco "<b>FATOS ATUAIS DA PLATAFORMA</b>" e injetados no system prompt entre o <code className="bg-white px-1 rounded">CORE_AGENT_RULES_V1</code> (inviolável) e o <code className="bg-white px-1 rounded">agent.system_prompt</code> (seedado). Cache de 60s — clica "Invalidar cache" pra forçar reload imediato após edição crítica.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Form Panel ──────────────────────────────────────── */

interface FormPanelProps {
  form: FormState;
  setForm: (f: FormState) => void;
  creating: boolean;
  editingId: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function FormPanel({ form, setForm, creating, editingId, saving, onSave, onCancel }: FormPanelProps) {
  const update = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
  const idValid = /^[a-z0-9_]+$/.test(form.id || '');
  const canSave =
    !!form.id && idValid && !!form.fact_key && !!form.label && !!form.section && !!form.status;

  return (
    <div className="mb-6 bg-white border-2 border-emerald-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          {creating ? <><Plus size={16} /> Novo fato</> : <><Edit2 size={16} /> Editando: {editingId}</>}
        </h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <XIcon size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ID (só create) */}
        {creating && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ID (snake_case, único)</label>
            <input
              type="text"
              value={form.id || ''}
              onChange={(e) => update({ id: e.target.value.toLowerCase() })}
              placeholder="ex: canal_telegram"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            {!idValid && form.id && (
              <div className="text-xs text-rose-600 mt-1">Use só a-z, 0-9 e _</div>
            )}
          </div>
        )}

        {/* Section */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Seção</label>
          <select
            value={form.section}
            onChange={(e) => update({ section: e.target.value as IzaFactSection })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>{SECTION_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => update({ status: e.target.value as IzaFactStatus })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* fact_key */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">fact_key (curto, único na seção)</label>
          <input
            type="text"
            value={form.fact_key || ''}
            onChange={(e) => update({ fact_key: e.target.value })}
            placeholder="ex: telegram"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* order_idx */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ordem (menor = aparece primeiro)</label>
          <input
            type="number"
            value={form.order_idx ?? 100}
            onChange={(e) => update({ order_idx: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Label (full width) */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Label (curto, vai pra Iza)</label>
          <input
            type="text"
            value={form.label || ''}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="ex: Telegram Bot (em rollout)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Description (full width, textarea) */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Descrição (vai pra Iza — seja específico)</label>
          <textarea
            value={form.description || ''}
            onChange={(e) => update({ description: e.target.value })}
            rows={3}
            placeholder="Detalhes que a Iza deve usar pra responder dúvidas sobre esse fato."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* URL */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">URL (opcional — vira link Markdown automático no chat)</label>
          <input
            type="url"
            value={form.url || ''}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://zappiq.com.br/..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Notes (internal) */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Notas internas (não vai pra Iza)</label>
          <input
            type="text"
            value={form.notes || ''}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Contexto pro time. Ex: 'GA desde 2026-06'"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Active (edit only) */}
        {!creating && (
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => update({ active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Ativo (incluir no bloco FATOS ATUAIS)</span>
            </label>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <><RefreshCw size={14} className="animate-spin" /> Salvando…</>
          ) : (
            <><Save size={14} /> {creating ? 'Criar fato' : 'Salvar'}</>
          )}
        </button>
      </div>
    </div>
  );
}
