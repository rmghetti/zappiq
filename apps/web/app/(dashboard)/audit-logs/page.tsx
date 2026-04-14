'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Search } from 'lucide-react';

interface AuditLog {
  id: string;
  sequence: string;
  action: string;
  resource: string;
  resourceId: string | null;
  purpose: string | null;
  legalBasis: string | null;
  dataSubjectId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  hash: string;
  prevHash: string | null;
  anonymizedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
}

interface ListResponse {
  success: boolean;
  data: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

const LEGAL_BASIS_LABEL: Record<string, string> = {
  CONSENT: 'Consentimento',
  CONTRACT: 'Contrato',
  LEGAL_OBLIGATION: 'Obrigação legal',
  LEGITIMATE_INTEREST: 'Legítimo interesse',
  VITAL_INTERESTS: 'Interesses vitais',
  PUBLIC_INTEREST: 'Interesse público',
  CREDIT_PROTECTION: 'Proteção ao crédito',
  HEALTH_PROTECTION: 'Proteção à saúde',
};

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; checkedCount: number; brokenAtSequence: string | null } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'AUDITOR';

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterAction) params.append('action', filterAction);
      if (filterResource) params.append('resource', filterResource);
      const res = await api.get<ListResponse>(`/api/audit-logs?${params}`);
      setLogs(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  }

  async function verifyChain() {
    setVerifying(true);
    try {
      const res = await api.get<{ valid: boolean; checkedCount: number; brokenAtSequence: string | null }>(
        '/api/audit-logs/verify',
      );
      setVerifyResult(res);
    } catch (err) {
      console.error('Chain verification failed', err);
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (isAuthorized) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center">
        <ShieldCheck className="mx-auto text-gray-300" size={48} />
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-gray-600">Esta área é restrita a papéis ADMIN e AUDITOR.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-primary-600" /> Trilha de Auditoria
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Registros LGPD — Art. 37 (ROPA) e Art. 46 (integridade). Cadeia SHA-256 tamper-evident.
          </p>
        </div>
        <button
          onClick={verifyChain}
          disabled={verifying}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {verifying ? <RefreshCw className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
          Verificar Integridade
        </button>
      </div>

      {verifyResult && (
        <div
          className={`rounded-lg border p-4 flex items-start gap-3 ${
            verifyResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}
        >
          {verifyResult.valid ? (
            <CheckCircle2 className="text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="text-red-600 flex-shrink-0" />
          )}
          <div>
            <p className={`font-medium ${verifyResult.valid ? 'text-green-900' : 'text-red-900'}`}>
              {verifyResult.valid
                ? `Cadeia íntegra — ${verifyResult.checkedCount} registros verificados.`
                : `CADEIA VIOLADA na sequência ${verifyResult.brokenAtSequence}.`}
            </p>
            {!verifyResult.valid && (
              <p className="mt-1 text-sm text-red-700">
                Acionar DPO imediatamente. Este é um incidente de segurança nos termos do Art. 48 da LGPD.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Filtrar por ação (ex: conversation.delete)"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Filtrar por recurso (ex: conversation)"
            value={filterResource}
            onChange={(e) => setFilterResource(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={() => { setPage(1); load(); }}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          Aplicar
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Quando</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ação</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Recurso</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ator</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Base legal</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Carregando...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Nenhum registro.</td></tr>
            ) : logs.map((log) => (
              <tr
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.sequence}</td>
                <td className="px-4 py-3 text-gray-700">{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-900">{log.action}</td>
                <td className="px-4 py-3 text-gray-700">
                  {log.resource}
                  {log.resourceId && <span className="text-gray-400 ml-1">#{log.resourceId.slice(-6)}</span>}
                </td>
                <td className="px-4 py-3 text-gray-700">{log.user.name}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {log.legalBasis ? LEGAL_BASIS_LABEL[log.legalBasis] ?? log.legalBasis : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.ipAddress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
          <span className="text-gray-600">{total} registros</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5">Página {page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal detalhe */}
      {selectedLog && (
        <div
          onClick={() => setSelectedLog(null)}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Evento #{selectedLog.sequence}</h2>
                <p className="text-sm text-gray-500 mt-1 font-mono">{selectedLog.action}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Quando">{new Date(selectedLog.createdAt).toLocaleString('pt-BR')}</Field>
                <Field label="Ator">{selectedLog.user.name} ({selectedLog.user.role})</Field>
                <Field label="Recurso">{selectedLog.resource} {selectedLog.resourceId && `#${selectedLog.resourceId}`}</Field>
                <Field label="Titular dos dados">{selectedLog.dataSubjectId ?? '—'}</Field>
                <Field label="Base legal">{selectedLog.legalBasis ? LEGAL_BASIS_LABEL[selectedLog.legalBasis] : '—'}</Field>
                <Field label="Finalidade">{selectedLog.purpose ?? '—'}</Field>
                <Field label="IP">{selectedLog.ipAddress ?? '—'}</Field>
                <Field label="User-Agent">{selectedLog.userAgent?.slice(0, 40) ?? '—'}</Field>
              </div>
              <Field label="Hash (SHA-256)" mono>{selectedLog.hash}</Field>
              <Field label="Hash anterior" mono>{selectedLog.prevHash ?? '(genesis)'}</Field>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-gray-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>{children}</dd>
    </div>
  );
}
