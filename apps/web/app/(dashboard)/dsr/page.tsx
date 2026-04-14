'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { FileLock, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

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

  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'AUDITOR';

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

  async function updateStatus(id: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED', rejectionReason?: string) {
    try {
      await api.put(`/api/dsr/${id}`, { status, rejectionReason });
      load();
    } catch (err) {
      alert('Falha ao atualizar requisição');
      console.error(err);
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
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Prazo legal: 15 dias (Art. 19). Acima do prazo = descumprimento passível de sanção.
        </p>
      </div>

      <div className="flex gap-2">
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
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Protocolo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Titular</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Prazo (dias)</th>
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
                  <td className="px-4 py-3 space-x-1">
                    {r.status === 'PENDING' && (
                      <button
                        onClick={() => updateStatus(r.id, 'IN_PROGRESS')}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      >
                        Iniciar
                      </button>
                    )}
                    {(r.status === 'PENDING' || r.status === 'IN_PROGRESS') && (
                      <>
                        <button
                          onClick={() => updateStatus(r.id, 'COMPLETED')}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                        >
                          Concluir
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt('Motivo da rejeição:');
                            if (reason) updateStatus(r.id, 'REJECTED', reason);
                          }}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Rejeitar
                        </button>
                      </>
                    )}
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
