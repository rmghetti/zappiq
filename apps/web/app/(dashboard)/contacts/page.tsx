'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Search, Plus, Download, Filter, ChevronLeft, ChevronRight, Mail, Phone } from 'lucide-react';
import { api } from '../../../lib/api';
import { ContactFormModal, type Contact } from '../../../components/contacts/ContactFormModal';
import { SaibaMais } from '@/components/shared/SaibaMais';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  QUALIFIED: 'bg-green-100 text-green-700',
  UNQUALIFIED: 'bg-red-100 text-red-700',
  CONVERTED: 'bg-purple-100 text-purple-700',
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [exporting, setExporting] = useState(false);
  const limit = 20;

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.getBlob('/api/contacts/export');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contacts.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // silencioso — falha de export não deve quebrar a página
    } finally {
      setExporting(false);
    }
  }

  const fetchContacts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (search) params.append('search', search);
    if (statusFilter) params.append('status', statusFilter);

    api.get(`/api/contacts?${params}`)
      .then((res) => { setContacts(res.data || []); setTotal(res.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  function openCreate() {
    setEditingContact(null);
    setModalOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditingContact(contact);
    setModalOpen(true);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-1.5">
            Contatos
            <SaibaMais featureKey="contacts.overview" />
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} contatos no total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={16} /> {exporting ? 'Exportando...' : 'Exportar'}
          </button>
          <SaibaMais featureKey="contacts.export" className="self-center" />
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600"
          >
            <Plus size={16} /> Novo Contato
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, telefone ou email..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os status</option>
          <option value="NEW">Novo</option>
          <option value="CONTACTED">Contactado</option>
          <option value="QUALIFIED">Qualificado</option>
          <option value="UNQUALIFIED">Não qualificado</option>
          <option value="CONVERTED">Convertido</option>
        </select>
        <SaibaMais featureKey="contacts.lead-status" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                <span className="inline-flex items-center gap-1">
                  Contato
                  <SaibaMais featureKey="contacts.row-click-edit" />
                </span>
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Telefone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                <span className="inline-flex items-center gap-1">
                  Score
                  <SaibaMais featureKey="contacts.lead-score" />
                </span>
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                <span className="inline-flex items-center gap-1">
                  Tags
                  <SaibaMais featureKey="contacts.tags" />
                </span>
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Última interação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" /></td>
                </tr>
              ))
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                  <p>Nenhum contato encontrado</p>
                  <div className="mt-2 flex justify-center">
                    <SaibaMais featureKey="contacts.empty-state" variant="link" />
                  </div>
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openEdit(c)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                        {c.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        {/* Nome abre o PERFIL (Negócios/Conversas/Tarefas); a linha
                            continua abrindo o form de edição rápida — dois destinos,
                            então o link precisa parar a propagação do clique. */}
                        <Link
                          href={`/contacts/${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-medium text-gray-900 hover:text-primary-600 hover:underline"
                        >
                          {c.name || '—'}
                        </Link>
                        {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{c.phone}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[c.leadStatus] || 'bg-gray-100 text-gray-600'}`}>
                      {c.leadStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(c.leadScore, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{c.leadScore}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {c.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {c.lastInteractionAt ? new Date(c.lastInteractionAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PR #108 — Modal CRUD (criar/editar/deletar) */}
      <ContactFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchContacts}
        contact={editingContact}
      />
    </div>
  );
}
