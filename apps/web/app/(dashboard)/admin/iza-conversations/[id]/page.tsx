'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/iza-conversations/[id] — Detalhe de 1 conversa da Iza
 * --------------------------------------------------------------------
 * SUPERADMIN vê as mensagens completas (INBOUND + OUTBOUND, bot + human)
 * de uma conversa da Iza canonical. View de espião — sem ações.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, Bot, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../../../../stores/authStore';
import { izaApi, IzaConversationDetailResponse } from '../../../../../lib/adminApi';

export default function IzaConversationDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const { user } = useAuthStore();
  const [data, setData] = useState<IzaConversationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  useEffect(() => {
    if (user?.role !== 'SUPERADMIN' || !params.id) return;
    let mounted = true;
    izaApi.getConversationDetail(params.id)
      .then((res) => { if (mounted) setData(res); })
      .catch((err) => { if (mounted) setError(err?.message || 'Erro'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [user, params.id]);

  if (user?.role !== 'SUPERADMIN') return null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.push('/admin/iza-conversations')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        Voltar pra lista de conversas
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-900">{error}</p>
        </div>
      )}

      {loading && !data && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          Carregando conversa…
        </div>
      )}

      {data && (
        <>
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h1 className="text-lg font-bold text-gray-900 mb-1">
              {data.conversation.contactName || data.conversation.contactPhone || 'Conversa sem contato'}
            </h1>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
              {data.conversation.contactPhone && <span className="font-mono">📞 {data.conversation.contactPhone}</span>}
              <span>Status: <strong className="text-gray-700">{data.conversation.status}</strong></span>
              <span>Canal: <strong className="text-gray-700">{data.conversation.channel}</strong></span>
              {typeof data.conversation.csatScore === 'number' && (
                <span>CSAT: <strong className="text-amber-600">{data.conversation.csatScore}/5</strong></span>
              )}
              <span>Aberta em: <strong className="text-gray-700">
                {new Date(data.conversation.createdAt).toLocaleString('pt-BR')}
              </strong></span>
              {data.conversation.closedAt && (
                <span className="text-red-600">Fechada em: <strong>{new Date(data.conversation.closedAt).toLocaleString('pt-BR')}</strong></span>
              )}
            </div>
            {data.conversation.summary && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Sumário IA</p>
                <p className="text-sm text-gray-700">{data.conversation.summary}</p>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">{data.messages.length} mensagens</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[calc(100vh-300px)] overflow-y-auto">
              {data.messages.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-gray-400">Nenhuma mensagem</div>
              )}
              {data.messages.map((m) => {
                const isBot = m.isFromBot;
                const isInbound = m.direction === 'INBOUND';
                return (
                  <div key={m.id} className={`px-5 py-3 ${isInbound ? 'bg-gray-50' : 'bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isBot ? 'bg-primary-100 text-primary-700' : isInbound ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isBot ? <Bot size={14} /> : <UserIcon size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700">
                            {isBot ? 'Iza (bot)' : isInbound ? 'Contato' : 'Atendente humano'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(m.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                          </span>
                          {m.messageType && m.messageType !== 'TEXT' && (
                            <span className="inline-flex text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{m.messageType}</span>
                          )}
                          {m.status && (
                            <span className="text-[9px] text-gray-400">· {m.status}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
