'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/iza-conversations — Espião nas conversas da Iza (SUPERADMIN)
 * --------------------------------------------------------------------
 * SUPERADMIN logado em qualquer tenant consegue ver as conversas da Iza
 * canonical (org cmo1ywwfe00ko1jskexiexsm4). Bypass do tenant filter
 * via endpoint backend dedicado.
 *
 * Lista conversas + click vai pra /admin/iza-conversations/[id].
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { izaApi, IzaConversationsResponse } from '../../../../lib/adminApi';

export default function IzaConversationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = useState<IzaConversationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  useEffect(() => {
    if (user?.role !== 'SUPERADMIN') return;
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await izaApi.getConversations();
        if (mounted) { setData(res); setError(null); }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Erro');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [user]);

  if (user?.role !== 'SUPERADMIN') return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="text-primary-500" size={26} />
            Conversas da Iza
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Toda interação da Iza canonical (ZappIQ-Superadmin) · refresh auto 30s
          </p>
        </div>
        <button
          onClick={() => location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-900">{error}</p>
        </div>
      )}

      {data && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{data.total} conversas (mais recentes primeiro)</h3>
            <span className="text-[10px] text-gray-400 font-mono">org: {data.izaOrgId.slice(0, 16)}…</span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.rows.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Nenhuma conversa encontrada</div>
            )}
            {data.rows.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/admin/iza-conversations/${c.id}`)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">
                      {c.contactName || c.contactPhone || '—'}
                    </span>
                    {c.contactPhone && c.contactName && (
                      <span className="text-[10px] text-gray-400 font-mono">{c.contactPhone}</span>
                    )}
                    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded ${statusColor(c.status)}`}>
                      {c.status}
                    </span>
                    {c.channel && (
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{c.channel}</span>
                    )}
                    {typeof c.csatScore === 'number' && (
                      <span className="text-[10px] font-bold text-amber-600">{c.csatScore}/5 ★</span>
                    )}
                  </div>
                  {c.lastMsg && (
                    <p className="text-xs text-gray-600 truncate">{c.lastMsg}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    <span>{c.msgCount} msgs</span>
                    <span>·</span>
                    <span>
                      última {c.lastMsgAt ? new Date(c.lastMsgAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </span>
                    {c.closedAt && (
                      <>
                        <span>·</span>
                        <span className="text-red-500">Fechada em {new Date(c.closedAt).toLocaleString('pt-BR', { dateStyle: 'short' })}</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    OPEN: 'bg-green-100 text-green-700',
    WAITING: 'bg-amber-100 text-amber-700',
    CLOSED: 'bg-gray-100 text-gray-600',
    ESCALATED: 'bg-red-100 text-red-700',
  };
  return map[s] || 'bg-gray-100 text-gray-600';
}
