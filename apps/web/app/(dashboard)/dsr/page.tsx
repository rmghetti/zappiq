'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { FileLock, Clock, CheckCircle2, XCircle, AlertTriangle, Download, Trash2 } from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';

interface DSR {
  id: string;
  type: string;
  status: string;
  requesterEmail: string;
  requesterName: string | null;
  contactId: string | null;
  reason: string | null;
  rejectionReason: string | null;
  responseData: any;
  handledById: string | null;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  ACCESS: 'Acesso aos dados',
  CORRECTION: 'Correção',
  ANONYMIZATION: 'Anonimização',
  PORTABILITY: 'Portabilidade',
  DELETION: 'Eliminação',
  CONSENT_REVOKE: 'Revogação de consentimento',
  INFORMATION: 'Informação sobre compartilhamento',
};

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock size={14} /> },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Clock size={14} /> },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle2 size={14} /> },
  REJECTED: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <XCircle size={14} /> },
  EXPIRED: { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertTriangle size={14} /> },
};

export default function DSRPage() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<DSR[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const isAuthorized = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN' || user?.role === 'AUDITOR';

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (filterStatus) params.append('status', filterStatus);
      const res = await api.get<{ data: DSR[] }>(`/api/dsr?${params}`);
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateStatus(id: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED', rejectionReason?: string) {
    try {
      await api.put(`/api/dsr/${id}`, { status, rejectionReason });
      load();
    } catch (err) {
      alert('Falha ao atualizar requisição');
      console.error(err);
    }
  }

  // Export é um download de arquivo (JSON/CSV cru), não passa pelo api.get que
  // faz JSON.parse — usamos api.getBlob (fetch autenticado) e disparamos o
  // download no browser.
  async function exportData(id: string, format: 'json' | 'csv') {
    setBusyId(id);
    try {
      const blob = await api.getBlob(`/api/dsr/${id}/export?format=${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DSR-${id.slice(-8).toUpperCase()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Falha ao exportar dados do titular');
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  async function fulfillDeletion(id: string) {
    if (
      !window.confirm(
        'Eliminar e ANONIMIZAR os dados do titular?\n\nNome, telefone e e-mail viram placeholders e as conversas são removidas (soft-delete). Métricas agregadas são preservadas. A ação marca a requisição como concluída e não pode ser desfeita.',
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const res = await api.post<{ data: { contactsAnonymized: number; conversationsSoftDeleted: number } }>(
        `/api/dsr/${id}/delete`,
        { notify: true },
      );
      alert(
        `Concluído. Contatos anonimizados: ${res.data.contactsAnonymized}. Conversas removidas: ${res.data.conversationsSoftDeleted}.`,
      );
      load();
    } catch (err) {
      alert('Falha ao eliminar dados do titular');
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  async function completeExport(id: string) {
    setBusyId(id);
    try {
      await api.post(`/api/dsr/${id}/complete-export`, { notify: true });
      load();
    } catch (err) {
      alert('Falha ao concluir a solicitação de acesso/portabilidade');
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (isAuthorized) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center">
        <FileLock className="mx-auto text-gray-300" size={48} />
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-gray-600">Esta área é restrita a papéis ADMIN e AUDITOR.</p>
      </div>
    );
  }

  function daysToDue(dueDate: string): number {
    return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileLock className="text-primary-600" /> Requisições do Titular (LGPD Art. 18)
          <SaibaMais featureKey="dsr.pagina" />
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Prazo legal: 15 dias (Art. 19). Acima do prazo = descumprimento passível de sanção.
        </p>
        <SaibaMais featureKey="dsr.fluxo-atendimento" variant="link" className="mt-2" />
      </div>

      <div className="flex items-center gap-2">
        {['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              filterStatus === s
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s || 'Todas'}
          </button>
        ))}
        <SaibaMais featureKey="dsr.filtro-status" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Protocolo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">
                <span className="inline-flex items-center gap-1">Tipo <SaibaMais featureKey="dsr.tipo-solicitacao" /></span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Titular</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">
                <span className="inline-flex items-center gap-1">Status <SaibaMais featureKey="dsr.status-badge" /></span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">
                <span className="inline-flex items-center gap-1">Prazo (dias) <SaibaMais featureKey="dsr.prazo" /></span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Carregando...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Nenhuma requisição.</td></tr>
            ) : requests.map((r) => {
              const style = STATUS_STYLE[r.status] ?? STATUS_STYLE.PENDING;
              const dias = daysToDue(r.dueDate);
              const vencido = dias < 0 && r.status !== 'COMPLETED' && r.status !== 'REJECTED';
              return (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.id.slice(-8).toUpperCase()}</td>
                  <td className="px-4 py-3 text-gray-900">{TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{r.requesterName ?? '—'}</div>
                    <div className="text-xs text-gray-500">{r.requesterEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                      {style.icon} {r.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-medium ${vencido ? 'text-red-600' : dias <= 3 ? 'text-yellow-600' : 'text-gray-700'}`}>
                    {vencido ? `Vencido há ${Math.abs(dias)}d` : `${dias}d`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                    {r.status === 'PENDING' && (
                      <button
                        onClick={() => updateStatus(r.id, 'IN_PROGRESS')}
                        disabled={busyId === r.id}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                      >
                        Iniciar
                      </button>
                    )}

                    {/* Ações de export — sempre disponíveis p/ ACCESS/PORTABILITY */}
                    {(r.type === 'ACCESS' || r.type === 'PORTABILITY') && (
                      <>
                        <button
                          onClick={() => exportData(r.id, 'json')}
                          disabled={busyId === r.id}
                          title="Baixar dados do titular em JSON"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 disabled:opacity-50"
                        >
                          <Download size={12} /> JSON
                        </button>
                        <button
                          onClick={() => exportData(r.id, 'csv')}
                          disabled={busyId === r.id}
                          title="Baixar dados do titular em CSV"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 disabled:opacity-50"
                        >
                          <Download size={12} /> CSV
                        </button>
                      </>
                    )}

                    {(r.status === 'PENDING' || r.status === 'IN_PROGRESS') && (
                      <>
                        {/* Eliminação/anonimização automatizada p/ DELETION/ANONYMIZATION */}
                        {(r.type === 'DELETION' || r.type === 'ANONYMIZATION') && (
                          <button
                            onClick={() => fulfillDeletion(r.id)}
                            disabled={busyId === r.id}
                            title="Anonimizar contato + soft-delete das conversas"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        )}

                        {(r.type === 'ACCESS' || r.type === 'PORTABILITY') ? (
                          <span className="inline-flex items-center gap-0.5">
                            <button
                              onClick={() => completeExport(r.id)}
                              disabled={busyId === r.id}
                              className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50"
                            >
                              Concluir + avisar
                            </button>
                            <SaibaMais featureKey="dsr.concluir-exportacao" />
                          </span>
                        ) : (
                          <button
                            onClick={() => updateStatus(r.id, 'COMPLETED')}
                            disabled={busyId === r.id}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50"
                          >
                            Concluir
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const reason = window.prompt('Motivo da rejeição:');
                            if (reason) updateStatus(r.id, 'REJECTED', reason);
                          }}
                          disabled={busyId === r.id}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          Rejeitar
                        </button>
                      </>
                    )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
