'use client';

/**
 * DealFormModal — modal pra criar novo deal no CRM.
 *
 * Carrega contatos da org pra dropdown (associar deal a contato existente).
 * Pré-seleciona stage='new'. Submit → POST /api/deals → refresh kanban.
 *
 * Pode ser estendido pra editar (passa deal existente) — por ora só criar
 * porque move-stage já é feito inline na page CRM.
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, Search } from 'lucide-react';
import { api } from '../../lib/api';

interface ContactOption {
  id: string;
  name?: string | null;
  phone: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialStage?: string;
}

const STAGES = [
  { value: 'new', label: 'Novo' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perdido' },
];

export function DealFormModal({ open, onClose, onSaved, initialStage = 'new' }: Props) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState(initialStage);
  const [contactId, setContactId] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resetar form quando modal abre
  useEffect(() => {
    if (open) {
      setTitle('');
      setValue('');
      setStage(initialStage);
      setContactId('');
      setContactSearch('');
      setContacts([]);
      setError(null);
    }
  }, [open, initialStage]);

  // Buscar contatos quando search muda (debounce simples)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setLoadingContacts(true);
      const params = new URLSearchParams({ limit: '20' });
      if (contactSearch) params.append('search', contactSearch);
      api.get(`/api/contacts?${params}`)
        .then((res) => setContacts(res.data || []))
        .catch(() => setContacts([]))
        .finally(() => setLoadingContacts(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, contactSearch]);

  if (!open) return null;

  async function handleSubmit() {
    setError(null);
    if (title.trim().length < 2) {
      setError('Título precisa ter no mínimo 2 caracteres.');
      return;
    }
    if (!contactId) {
      setError('Selecione um contato.');
      return;
    }
    const numericValue = value ? Number(value.replace(/[^\d.,]/g, '').replace(',', '.')) : undefined;
    if (value && Number.isNaN(numericValue)) {
      setError('Valor inválido.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/deals', {
        title: title.trim(),
        value: numericValue,
        stage,
        contactId,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar deal');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedContact = contacts.find((c) => c.id === contactId);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Novo deal</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Crie uma oportunidade no pipeline associada a um contato existente.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Título do deal *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Plano Growth — Clínica Sorria"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Valor (R$)
              </label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Ex: 497,00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Etapa inicial
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Contato associado *
            </label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={contactSearch}
                onChange={(e) => { setContactSearch(e.target.value); setContactId(''); }}
                placeholder="Buscar contato por nome ou telefone..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {loadingContacts ? (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  <Loader2 size={14} className="animate-spin inline" /> Buscando...
                </div>
              ) : contacts.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  Nenhum contato encontrado.
                  {!contactSearch && ' Cadastre um contato primeiro em /contacts.'}
                </div>
              ) : (
                contacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setContactId(c.id)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      contactId === c.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div>
                      <div className="font-medium text-gray-900">{c.name || c.phone}</div>
                      {c.name && <div className="text-xs text-gray-500">{c.phone}</div>}
                    </div>
                    {contactId === c.id && <Check size={14} className="text-primary-600" />}
                  </button>
                ))
              )}
            </div>
            {selectedContact && (
              <p className="text-[10px] text-gray-500 mt-1">
                Selecionado: <strong>{selectedContact.name || selectedContact.phone}</strong>
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !contactId}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {submitting ? 'Criando...' : 'Criar deal'}
          </button>
        </div>
      </div>
    </div>
  );
}
