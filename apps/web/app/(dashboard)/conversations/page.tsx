'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, Search, Phone, Bot, User, Clock, ChevronDown } from 'lucide-react';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';

interface Conversation {
  id: string;
  status: string;
  contact: { id: string; name: string; phone: string; avatarUrl?: string; leadStatus: string };
  messages: Array<{ content: string; createdAt: string; direction: string }>;
  _count: { messages: number };
  updatedAt: string;
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

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/api/conversations?limit=50')
      .then((res) => setConversations(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.get(`/api/conversations/${selectedId}/messages?limit=100`)
      .then((res) => setMessages(res.data || []))
      .catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time messages via Socket.io
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: any) => {
      if (data.conversationId === selectedId) {
        setMessages((prev) => [...prev, data.message]);
      }
      // Refresh conversation list
      api.get('/api/conversations?limit=50').then((res) => setConversations(res.data || [])).catch(() => {});
    };
    socket.on('new_message', handler);
    return () => { socket.off('new_message', handler); };
  }, [selectedId]);

  async function handleSend() {
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    try {
      await api.post(`/api/conversations/${selectedId}/messages`, { content: newMessage });
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        content: newMessage,
        direction: 'OUTBOUND',
        type: 'TEXT',
        isFromBot: false,
        createdAt: new Date().toISOString(),
      }]);
      setNewMessage('');
    } catch {}
    setSending(false);
  }

  const selected = conversations.find((c) => c.id === selectedId);
  const filtered = conversations.filter((c) =>
    !searchTerm || c.contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.contact.phone.includes(searchTerm)
  );

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6 bg-white">
      {/* Left — Conversation List */}
      <div className="w-[380px] border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Nenhuma conversa ainda</p>
            </div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${selectedId === conv.id ? 'bg-primary-50' : ''}`}
              >
                <div className="w-10 h-10 rounded-full bg-secondary-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {conv.contact.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 truncate">{conv.contact.name || conv.contact.phone}</span>
                    <span className="text-[10px] text-gray-400">{formatTime(conv.updatedAt)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{conv.messages?.[0]?.content || 'Sem mensagens'}</p>
                </div>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${conv.status === 'OPEN' ? 'bg-green-400' : conv.status === 'WAITING' ? 'bg-yellow-400' : 'bg-gray-300'}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right — Chat Panel */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={56} className="mx-auto text-gray-200 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400">Selecione uma conversa</h3>
              <p className="text-sm text-gray-400 mt-1">Escolha uma conversa ao lado para ver as mensagens</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary-500 flex items-center justify-center text-white text-sm font-bold">
                  {selected.contact.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selected.contact.name || selected.contact.phone}</p>
                  <div className="flex items-center gap-2">
                    <Phone size={10} className="text-gray-400" />
                    <span className="text-xs text-gray-500">{selected.contact.phone}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${selected.status === 'OPEN' ? 'bg-green-100 text-green-700' : selected.status === 'WAITING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                      {selected.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-[#ECE5DD] space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === 'INBOUND' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    msg.direction === 'INBOUND'
                      ? 'bg-white text-gray-800 rounded-tl-none'
                      : 'bg-[#D9FDD3] text-gray-800 rounded-tr-none'
                  }`}>
                    {msg.isFromBot && (
                      <div className="flex items-center gap-1 text-[10px] text-accent-500 font-semibold mb-1">
                        <Bot size={10} /> ZappIQ IA
                      </div>
                    )}
                    {!msg.isFromBot && msg.direction === 'OUTBOUND' && msg.sender && (
                      <div className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold mb-1">
                        <User size={10} /> {msg.sender.name}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                      {msg.direction === 'OUTBOUND' && <span className="text-[10px] text-blue-500">✓✓</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-3 bg-white border-t border-gray-200">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Digite uma mensagem..."
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="p-2.5 bg-secondary-500 text-white rounded-full hover:bg-secondary-600 disabled:opacity-50 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
