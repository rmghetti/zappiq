'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Search, Bot, User, Instagram, Smartphone,
  Tag, Target, Flame, CheckSquare, Clock, TrendingUp, Sparkles, ArrowRightCircle,
  UserPlus, FileText, DollarSign, X, Hand, CheckCircle2, RotateCcw, PauseCircle, StickyNote,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { useAuthStore } from '../../../stores/authStore';
import { AgentMessageActions } from '../../../components/conversations/AgentMessageActions';

interface Conversation {
  id: string;
  status: string;
  channel?: string;
  aiPaused?: boolean;
  assignedToId?: string | null;
  contact: { id: string; name: string; phone: string; avatarUrl?: string; leadStatus: string };
  messages: Array<{ content: string; createdAt: string; direction: string }>;
  _count: { messages: number };
  updatedAt: string;
}

/** Feature 5a.1 — indicador de handoff: IA pausada quando aiPaused ou ASSIGNED. */
function isHumanHandoffActive(conv?: { aiPaused?: boolean; status?: string } | null): boolean {
  return !!conv && (conv.aiPaused === true || conv.status === 'ASSIGNED');
}

interface Message {
  id: string;
  content: string;
  direction: string;
  type: string;
  isFromBot: boolean;
  createdAt: string;
  sender?: { name: string; avatar?: string };
}

interface CrmContext {
  contact: {
    id: string; name?: string; phone: string; email?: string; company?: string;
    leadStatus: string; leadScore: number; funnelStage: string; tags: string[];
    firstTouchAt?: string; lastTouchAt?: string; createdAt: string;
  } | null;
  deal: { id: string; title: string; value?: string; stage: string; pipelineStage?: { name: string; color?: string } | null } | null;
  tasks: Array<{ id: string; title: string; dueDate?: string; status: string }>;
  activities: Array<{ id: string; type: string; actor: string; title: string; body?: string; createdAt: string }>;
}

const LEAD_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  NEW: { label: 'Novo', cls: 'bg-gray-100 text-gray-600' },
  CONTACTED: { label: 'Contatado', cls: 'bg-sky-100 text-sky-700' },
  QUALIFIED: { label: 'Qualificado', cls: 'bg-indigo-100 text-indigo-700' },
  UNQUALIFIED: { label: 'Desqualificado', cls: 'bg-red-100 text-red-700' },
  CONVERTED: { label: 'Cliente', cls: 'bg-green-100 text-green-700' },
};

const ACTIVITY_ICON: Record<string, any> = {
  CONTACT_CREATED: UserPlus,
  STAGE_CHANGE: ArrowRightCircle,
  LEAD_SCORE_CHANGE: TrendingUp,
  DEAL_CREATED: DollarSign,
  DEAL_WON: DollarSign,
  DEAL_LOST: X,
  TASK_CREATED: CheckSquare,
  TASK_COMPLETED: CheckSquare,
  AI_SUMMARY: Sparkles,
  NOTE: FileText,
  CAMPAIGN_EVENT: Target,
  FIELD_UPDATE: FileText,
  MESSAGE: MessageSquare,
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [crm, setCrm] = useState<CrmContext | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // Feature 5a.1 — handoff humano ↔ IA.
  const currentUser = useAuthStore((s) => s.user);
  const [actionBusy, setActionBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  // W2.3 — paginação: cursor para "carregar anteriores" + flag de fim do histórico.
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  // Só rola pro fim no carregamento inicial da conversa, não ao prepender antigas.
  const shouldScrollToEnd = useRef(true);

  const loadList = useCallback(() => {
    api.get('/api/conversations?limit=50')
      .then((res) => setConversations(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // Deep link (#W2.7): ?id=<conversaId> abre a conversa direto. Os links da home
  // (dashboard) apontam pra cá. Roda uma vez no mount; setar selectedId dispara o
  // efeito que carrega mensagens/contexto. Lê window.location.search pra evitar o
  // Suspense exigido pelo useSearchParams.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setSelectedId(id);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    // Carrega a JANELA MAIS RECENTE (a API já devolve em ordem cronológica).
    shouldScrollToEnd.current = true;
    setMessages([]);
    setNextBefore(null);
    setHasMore(false);
    api.get(`/api/conversations/${selectedId}/messages?limit=50`)
      .then((res) => {
        setMessages(res.data || []);
        setNextBefore(res.nextBefore ?? null);
        setHasMore(Boolean(res.hasMore));
      })
      .catch(() => {});
    setCrm(null);
    setCrmLoading(true);
    api.get(`/api/conversations/${selectedId}/context`)
      .then((res) => setCrm(res.data || null))
      .catch(() => {})
      .finally(() => setCrmLoading(false));
  }, [selectedId]);

  // "Carregar anteriores": busca a página imediatamente anterior via cursor e
  // faz PREPEND, preservando a posição de scroll do usuário (sem pular pro fim).
  async function loadEarlier() {
    if (!selectedId || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    const container = messagesScrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    const prevTop = container?.scrollTop ?? 0;
    try {
      const res = await api.get(`/api/conversations/${selectedId}/messages?limit=50&before=${encodeURIComponent(nextBefore)}`);
      const older: Message[] = res.data || [];
      shouldScrollToEnd.current = false;
      setMessages((prev) => [...older, ...prev]);
      setNextBefore(res.nextBefore ?? null);
      setHasMore(Boolean(res.hasMore));
      // Mantém o viewport ancorado na mesma mensagem após o prepend.
      requestAnimationFrame(() => {
        const c = messagesScrollRef.current;
        if (c) c.scrollTop = prevTop + (c.scrollHeight - prevHeight);
      });
    } catch {}
    setLoadingMore(false);
  }

  useEffect(() => {
    if (shouldScrollToEnd.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    const handler = (data: any) => {
      if (data.conversationId === selectedId) {
        shouldScrollToEnd.current = true;
        setMessages((prev) => [...prev, data.message]);
        // Atualiza o card de CRM (estágio/score podem ter mudado no turno).
        api.get(`/api/conversations/${selectedId}/context`).then((res) => setCrm(res.data || null)).catch(() => {});
      }
      loadList();
    };
    socket.on('new_message', handler);
    return () => { socket.off('new_message', handler); };
  }, [selectedId, loadList]);

  async function handleSend() {
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    try {
      await api.post(`/api/conversations/${selectedId}/messages`, { content: newMessage });
      shouldScrollToEnd.current = true;
      setMessages((prev) => [...prev, {
        id: Date.now().toString(), content: newMessage, direction: 'OUTBOUND',
        type: 'TEXT', isFromBot: false, createdAt: new Date().toISOString(),
      }]);
      setNewMessage('');
    } catch {}
    setSending(false);
  }

  // Atualiza o item da lista localmente (feedback imediato) e recarrega do servidor.
  function patchSelected(patch: Partial<Conversation>) {
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)));
  }

  // ASSUMIR — atribui ao usuário logado e pausa a Iza.
  async function handleAssume() {
    if (!selectedId || !currentUser?.id || actionBusy) return;
    setActionBusy(true);
    try {
      await api.put(`/api/conversations/${selectedId}/assign`, { agentId: currentUser.id });
      patchSelected({ status: 'ASSIGNED', assignedToId: currentUser.id, aiPaused: true });
      loadList();
    } catch {}
    setActionBusy(false);
  }

  // ENCERRAR — fecha a conversa.
  async function handleClose() {
    if (!selectedId || actionBusy) return;
    setActionBusy(true);
    try {
      await api.put(`/api/conversations/${selectedId}/close`);
      patchSelected({ status: 'CLOSED' });
      loadList();
    } catch {}
    setActionBusy(false);
  }

  // REABRIR — reabre uma conversa fechada.
  async function handleReopen() {
    if (!selectedId || actionBusy) return;
    setActionBusy(true);
    try {
      await api.put(`/api/conversations/${selectedId}/reopen`);
      patchSelected({ status: selected?.assignedToId ? 'ASSIGNED' : 'OPEN' });
      loadList();
    } catch {}
    setActionBusy(false);
  }

  // RETOMAR IZA — despausa a IA.
  async function handleResumeAi() {
    if (!selectedId || actionBusy) return;
    setActionBusy(true);
    try {
      await api.put(`/api/conversations/${selectedId}/resume-ai`);
      patchSelected({ aiPaused: false, status: 'OPEN' });
      loadList();
    } catch {}
    setActionBusy(false);
  }

  // NOTA INTERNA — registra observação no histórico.
  async function handleSaveNote() {
    if (!selectedId || !noteText.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      await api.post(`/api/conversations/${selectedId}/notes`, { content: noteText.trim() });
      setNoteText('');
      setNoteOpen(false);
      // Recarrega o contexto de CRM (a nota vira atividade na timeline).
      api.get(`/api/conversations/${selectedId}/context`).then((res) => setCrm(res.data || null)).catch(() => {});
    } catch {}
    setNoteSaving(false);
  }

  const selected = conversations.find((c) => c.id === selectedId);
  const filtered = conversations.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (channelFilter !== 'all' && (c.channel || 'whatsapp') !== channelFilter) return false;
    if (searchTerm && !(c.contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.contact.phone.includes(searchTerm))) return false;
    return true;
  });

  const formatTime = (date: string) => new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formatDay = (date: string) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  const ChannelIcon = ({ channel }: { channel?: string }) =>
    (channel === 'instagram')
      ? <Instagram size={11} className="text-pink-500" />
      : <Smartphone size={11} className="text-green-500" />;

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6 bg-white">
      {/* ── Painel 1 — Lista de conversas ── */}
      <div className="w-[340px] border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[['all', 'Todas'], ['OPEN', 'Abertas'], ['WAITING', 'Aguardando'], ['CLOSED', 'Fechadas']].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className={`px-2 py-1 rounded-full text-[11px] font-medium ${statusFilter === v ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {l}
              </button>
            ))}
            <span className="w-px h-4 bg-gray-200 mx-0.5" />
            {[['all', 'Canal'], ['whatsapp', 'WA'], ['instagram', 'IG']].map(([v, l]) => (
              <button key={v} onClick={() => setChannelFilter(v)}
                className={`px-2 py-1 rounded-full text-[11px] font-medium ${channelFilter === v ? 'bg-secondary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filtered.map((conv) => {
              const st = LEAD_STATUS_STYLE[conv.contact.leadStatus] || LEAD_STATUS_STYLE.NEW;
              return (
                <button key={conv.id} onClick={() => setSelectedId(conv.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${selectedId === conv.id ? 'bg-primary-50' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-secondary-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {conv.contact.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                        <ChannelIcon channel={conv.channel} /> {conv.contact.name || conv.contact.phone}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(conv.updatedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="text-xs text-gray-500 truncate">{conv.messages?.[0]?.content || 'Sem mensagens'}</p>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Painel 2 — Conversa ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={56} className="mx-auto text-gray-200 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400">Selecione uma conversa</h3>
              <p className="text-sm text-gray-400 mt-1">Veja a conversa e o contexto de CRM do contato</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-secondary-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {selected.contact.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{selected.contact.name || selected.contact.phone}</p>
                    <div className="flex items-center gap-2">
                      <ChannelIcon channel={selected.channel} />
                      <span className="text-xs text-gray-500">{selected.contact.phone}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${selected.status === 'OPEN' ? 'bg-green-100 text-green-700' : selected.status === 'WAITING' ? 'bg-yellow-100 text-yellow-700' : selected.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {selected.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Feature 5a.1 — ações de handoff */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {selected.status !== 'CLOSED' && !isHumanHandoffActive(selected) && (
                    <button onClick={handleAssume} disabled={actionBusy || !currentUser?.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      <Hand size={13} /> Assumir
                    </button>
                  )}
                  <button onClick={() => setNoteOpen((v) => !v)} disabled={actionBusy}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                    <StickyNote size={13} /> Nota
                  </button>
                  {selected.status === 'CLOSED' ? (
                    <button onClick={handleReopen} disabled={actionBusy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition-colors">
                      <RotateCcw size={13} /> Reabrir
                    </button>
                  ) : (
                    <button onClick={handleClose} disabled={actionBusy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                      <CheckCircle2 size={13} /> Encerrar
                    </button>
                  )}
                </div>
              </div>

              {/* Indicador: IA pausada / atendimento humano */}
              {isHumanHandoffActive(selected) && selected.status !== 'CLOSED' && (
                <div className="mt-2 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                    <PauseCircle size={14} /> IA pausada — em atendimento humano
                  </span>
                  <button onClick={handleResumeAi} disabled={actionBusy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 transition-colors">
                    <Bot size={13} /> Retomar Iza
                  </button>
                </div>
              )}

              {/* Nota interna — campo inline */}
              {noteOpen && (
                <div className="mt-2 flex items-start gap-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Nota interna (não enviada ao contato)..."
                    rows={2}
                    className="flex-1 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button onClick={handleSaveNote} disabled={!noteText.trim() || noteSaving}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors self-stretch">
                    {noteSaving ? '...' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>

            <div ref={messagesScrollRef} className="flex-1 overflow-y-auto px-5 py-4 bg-[#ECE5DD] space-y-2">
              {hasMore && (
                <div className="flex justify-center pb-2">
                  <button
                    onClick={loadEarlier}
                    disabled={loadingMore}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/80 text-gray-600 hover:bg-white shadow-sm disabled:opacity-50 transition-colors">
                    {loadingMore ? 'Carregando...' : 'Carregar anteriores'}
                  </button>
                </div>
              )}
              {messages.map((msg, idx) => {
                const previousInbound = msg.isFromBot
                  ? [...messages.slice(0, idx)].reverse().find((m) => m.direction === 'INBOUND')?.content || ''
                  : '';
                return (
                  <div key={msg.id} className={`flex ${msg.direction === 'INBOUND' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`group max-w-[70%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                      msg.direction === 'INBOUND' ? 'bg-white text-gray-800 rounded-tl-none' : 'bg-[#D9FDD3] text-gray-800 rounded-tr-none'
                    }`}>
                      {msg.isFromBot && (
                        <div className="flex items-center gap-1 text-[10px] text-accent-500 font-semibold mb-1"><Bot size={10} /> Agente IA</div>
                      )}
                      {!msg.isFromBot && msg.direction === 'OUTBOUND' && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold mb-1"><User size={10} /> {msg.sender?.name || 'Humano'}</div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                        {msg.direction === 'OUTBOUND' && <span className="text-[10px] text-blue-500">✓✓</span>}
                      </div>
                      {msg.isFromBot && <AgentMessageActions question={previousInbound} agentAnswer={msg.content} />}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-center gap-3 px-5 py-3 bg-white border-t border-gray-200">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Digite uma mensagem..."
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button onClick={handleSend} disabled={!newMessage.trim() || sending}
                className="p-2.5 bg-secondary-500 text-white rounded-full hover:bg-secondary-600 disabled:opacity-50 transition-colors">
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Painel 3 — Contexto CRM ── */}
      {selected && (
        <div className="w-[320px] border-l border-gray-200 flex flex-col overflow-y-auto bg-gray-50/50">
          {crmLoading && !crm ? (
            <div className="p-6 text-center text-gray-400 text-sm">Carregando contexto...</div>
          ) : (
            <CrmPanel crm={crm} formatDay={formatDay} />
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-gray-400';
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, score)}%` }} />
    </div>
  );
}

function CrmPanel({ crm, formatDay }: { crm: CrmContext | null; formatDay: (d: string) => string }) {
  if (!crm || !crm.contact) {
    return <div className="p-6 text-center text-gray-400 text-sm">Sem contexto de CRM.</div>;
  }
  const c = crm.contact;
  const st = LEAD_STATUS_STYLE[c.leadStatus] || LEAD_STATUS_STYLE.NEW;
  return (
    <div className="p-4 space-y-4">
      {/* Card do contato */}
      <div className="rounded-xl bg-white border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-secondary-500 flex items-center justify-center text-white font-bold">
            {c.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{c.name || c.phone}</p>
            <p className="text-xs text-gray-500 truncate">{c.company || c.phone}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
          <span className="text-[11px] text-gray-500 flex items-center gap-1"><Flame size={12} className="text-amber-500" /> Score {c.leadScore}</span>
        </div>
        <ScoreBar score={c.leadScore} />
        {c.tags?.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pt-1">
            {c.tags.map((t) => (
              <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Tag size={9} />{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Negócio (deal) */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-1"><Target size={12} /> Oportunidade</p>
        {crm.deal ? (
          <div className="rounded-xl bg-white border border-gray-100 p-3">
            <p className="text-sm font-medium text-gray-900">{crm.deal.title}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: crm.deal.pipelineStage?.color || '#6366f1' }}>
                {crm.deal.pipelineStage?.name || crm.deal.stage}
              </span>
              {crm.deal.value && <span className="text-xs font-semibold text-gray-700">R$ {crm.deal.value}</span>}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Nenhuma oportunidade aberta ainda.</p>
        )}
      </div>

      {/* Próximos passos (tasks) */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-1"><CheckSquare size={12} /> Próximos passos</p>
        {crm.tasks.length > 0 ? (
          <div className="space-y-1.5">
            {crm.tasks.map((t) => (
              <div key={t.id} className="rounded-lg bg-white border border-gray-100 p-2.5 flex items-start gap-2">
                <CheckSquare size={14} className="text-primary-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800">{t.title}</p>
                  {t.dueDate && <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><Clock size={9} /> vence {formatDay(t.dueDate)}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sem tarefas pendentes.</p>
        )}
      </div>

      {/* Timeline */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-1"><Clock size={12} /> Linha do tempo</p>
        {crm.activities.length > 0 ? (
          <div className="space-y-0">
            {crm.activities.map((a, i) => {
              const Icon = ACTIVITY_ICON[a.type] || Clock;
              return (
                <div key={a.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${a.actor === 'AI' ? 'bg-accent-100 text-accent-600' : 'bg-gray-100 text-gray-500'}`}>
                      <Icon size={12} />
                    </div>
                    {i < crm.activities.length - 1 && <div className="w-px flex-1 bg-gray-200 my-0.5" />}
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-xs text-gray-800 leading-snug">{a.title}</p>
                    {a.body && <p className="text-[10px] text-gray-400 mt-0.5">{a.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDay(a.createdAt)} · {a.actor === 'AI' ? 'IA' : a.actor === 'HUMAN' ? 'Humano' : 'Sistema'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sem atividades registradas.</p>
        )}
      </div>
    </div>
  );
}
