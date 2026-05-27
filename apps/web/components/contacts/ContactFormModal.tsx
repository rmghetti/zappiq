'use client';

/**
 * ContactFormModal — modal único pra criar OU editar contato.
 *
 * Modo CRIAR: passa contact=undefined → form vazio → POST /api/contacts
 * Modo EDITAR: passa contact={...} → form preenchido → PUT /api/contacts/:id
 *               + botão "Excluir contato" → DELETE /api/contacts/:id
 *
 * Campos: nome (opcional), telefone (obrigatório, min 10), email (opcional,
 * validado), empresa (opcional), status (enum), tags (separadas por vírgula).
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Trash2, AlertCircle, Check } from 'lucide-react';
import { api } from '../../lib/api';

export interface Contact {
  id: string;
  name?: string | null;
  phone: string;
  email?: string | null;
  company?: string | null;
  leadStatus: string;
  leadScore: number;
  tags: string[];
  lastInteractionAt?: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  contact?: Contact | null; // undefined/null = modo criar
}

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'Novo' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'QUALIFIED', label: 'Qualificado' },
  { value: 'UNQUALIFIED', label: 'Não qualificado' },
  { value: 'CONVERTED', label: 'Convertido' },
];

export function ContactFormModal({ open, onClose, onSaved, contact }: Props) {
  const isEdit = !!contact?.id;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [leadStatus, setLeadStatus] = useState('NEW');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setName(contact?.name || '');
      setPhone(contact?.phone || '');
      setEmail(contact?.email || '');
      setCompany(contact?.company || '');
      setLeadStatus(contact?.leadStatus || 'NEW');
      setTagsInput((contact?.tags || []).join(', '));
      setError(null);
      setConfirmDelete(false);
    }
  }, [open, contact]);

  if (!open) return null;

  async function handleSubmit() {
    setError(null);
    const trimmedPhone = phone.replace(/\D/g, '');
    if (trimmedPhone.length < 10) {
      setError('Telefone precisa de no mínimo 10 dígitos.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('E-mail inválido.');
      return;
    }
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = {
      name: name.trim() || undefined,
      phone: trimmedPhone,
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      leadStatus,
      tags,
    };
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/api/contacts/${contact!.id}`, payload);
      } else {
        await api.post('/api/contacts', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Erro ao salvar contato';
      if (msg.includes('already exists') || msg.includes('409')) {
        setError('Já existe um contato com esse telefone.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!contact?.id) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/api/contacts/${contact.id}`);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir contato');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => !submitting && !deleting && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Editar contato' : 'Novo contato'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEdit ? 'Atualize informações ou exclua o contato.' : 'Adicione um novo lead à sua base.'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting || deleting}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Nome (opcional)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Telefone (com DDD) *
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 11987654321"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isEdit}
            />
            {isEdit && (
              <p className="text-[10px] text-gray-400 mt-1">
                Telefone não pode ser editado (chave única).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                E-mail (opcional)
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@empresa.com"
                type="email"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Empresa (opcional)
              </label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Acme Ltda"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Status do lead
            </label>
            <select
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Tags (separadas por vírgula)
            </label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Ex: vip, recorrente, indicado"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
          <div>
            {isEdit && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={submitting || deleting}
                className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            )}
            {isEdit && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-700">Tem certeza?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-xs text-gray-600 hover:text-gray-900"
                >
                  Não
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-600 text-white rounded font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Sim, excluir
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={submitting || deleting}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || deleting || !phone}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar contato'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
