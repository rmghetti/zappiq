'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * WhatsAppButton — V2 Chat Launcher dual (WhatsApp + Iza Chat in-page)
 * --------------------------------------------------------------------------
 * FAB único no canto inferior direito que abre menu com 2 opções:
 *   1. Conversar pelo WhatsApp  → wa.me link (web/app)
 *   2. Conversar aqui no site   → chat in-page persistente
 *
 * Chat in-page:
 *   - Janela 360x520 fixa bottom-right
 *   - Estados: open | minimized | closed
 *   - Persistência via localStorage (mensagens + estado) — sobrevive a
 *     navegação entre páginas (Hero → /precos → /sobre etc.)
 *   - Nunca encerra sozinho · só fecha por ação explícita do user (X)
 *   - Minimize → vira pílula compacta com badge
 *   - Restore → reabre com histórico intacto
 *
 * Roteia mensagens pro backend Iza: POST /api/web-chat (precisa endpoint
 * separado; por ora cliente envia + recebe stub canned reply pra demo.
 * Fase seguinte: ligar com agentOrchestrator via SSE).
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Minus, Send, Phone, ExternalLink } from 'lucide-react';

const WHATSAPP_NUMBER = '5511926160159';
const WELCOME = 'Oi! Sou a Iza, a IA da ZappIQ. Posso tirar dúvidas sobre preço, trial, integração WhatsApp/Instagram, treinamento da IA ou qualquer outra coisa. O que você gostaria de saber?';

const STORAGE_MSGS = 'zappiq_chat_msgs_v1';
const STORAGE_STATE = 'zappiq_chat_state_v1';
const STORAGE_DISMISSED_BUBBLE = 'zappiq_chat_bubble_dismissed_v2';

type ChatMode = 'closed' | 'menu' | 'inpage' | 'minimized';

type ChatMessage = {
  id: string;
  role: 'iza' | 'me';
  text: string;
  ts: number;
};

/* ── Respostas canned por intent (MVP — substituir por SSE backend Iza
       quando endpoint /api/web-chat estiver live) ── */
const CANNED_REPLIES: { match: RegExp; reply: string }[] = [
  { match: /pre[çc]o|valor|custa|plano/i, reply: 'Temos 5 tiers a partir de R$ 297/mês (Founders) até Enterprise sob consulta. Cada um tem volume diferente de conversas inclusas + Iza ilimitada. Vou mostrar a tabela completa? Posso te levar pra /precos.' },
  { match: /trial|14 dias|gratis|grátis|teste/i, reply: '14 dias grátis sem cartão. Você ativa, treina sua IA com docs/FAQ e testa em produção. Se gostar, continua. Se não, cancela em 1 clique. Quer começar agora?' },
  { match: /whatsapp|wpp|wa/i, reply: 'Integração oficial direta com WhatsApp Cloud API da Meta — sem atravessador. Você usa seu próprio número (recomendo chip dedicado). Ativa em 30-60min de setup guiado. Quer ver o passo a passo?' },
  { match: /instagram|insta|ig|direct|dm/i, reply: 'Instagram Direct está em rollout! Backend pronto, aprovação Meta em andamento. Mesma Iza, mesmo cérebro, agora respondendo DMs do Insta. Posso te avisar quando liberar?' },
  { match: /treina|treinar|aprende|docs/i, reply: 'Você sobe seus documentos (PDF, .docx, FAQ), escolhe segmento + sub-segmento e a ZappIQ gera um formulário guiado pra você responder. Sua IA aprende sozinha, sem custo de consultor. Posso explicar mais?' },
  { match: /demo|conhecer|reuni[ãa]o/i, reply: 'Posso agendar uma demo de 30min com nosso time comercial. Link aqui: /agendar — escolha o horário que melhor te atende.' },
  { match: /lgpd|privacidade|dados/i, reply: 'LGPD-first por design: DPA pronto em 2 cliques, encarregado de dados acessível, e seu cliente pode pedir exclusão em 48h pela plataforma. Dados primários ficam no Brasil (AWS São Paulo).' },
];

function generateReply(userText: string): string {
  for (const { match, reply } of CANNED_REPLIES) {
    if (match.test(userText)) return reply;
  }
  return 'Boa pergunta! Pra te responder com precisão, posso te conectar com um humano do nosso time. Que tal agendar uma conversa rápida? /agendar';
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function WhatsAppButton() {
  const [mode, setMode] = useState<ChatMode>('closed');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Hydration: ler localStorage uma vez */
  useEffect(() => {
    const savedMsgs = loadFromStorage<ChatMessage[]>(STORAGE_MSGS, []);
    const savedState = loadFromStorage<ChatMode>(STORAGE_STATE, 'closed');
    if (savedMsgs.length > 0) {
      setMessages(savedMsgs);
    }
    /* só restaura inpage/minimized — não auto-abre menu */
    if (savedState === 'inpage' || savedState === 'minimized') {
      setMode(savedState);
    }
    /* balão de boas-vindas após 4s se nada foi aberto antes */
    const t = setTimeout(() => {
      const dismissed = sessionStorage.getItem(STORAGE_DISMISSED_BUBBLE) === '1';
      if (!dismissed && savedState === 'closed') setShowBubble(true);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  /* Persistir mensagens + estado */
  useEffect(() => {
    saveToStorage(STORAGE_MSGS, messages);
  }, [messages]);

  useEffect(() => {
    saveToStorage(STORAGE_STATE, mode);
  }, [mode]);

  /* Scroll bottom on new msg */
  useEffect(() => {
    if (mode === 'inpage' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, mode]);

  const dismissBubble = useCallback(() => {
    setShowBubble(false);
    try {
      sessionStorage.setItem(STORAGE_DISMISSED_BUBBLE, '1');
    } catch {}
  }, []);

  const openMenu = () => {
    setMode('menu');
    dismissBubble();
  };

  const openInpage = () => {
    setMode('inpage');
    dismissBubble();
    /* primeira abertura → injetar welcome se ainda não tem mensagens */
    if (messages.length === 0) {
      setMessages([
        { id: crypto.randomUUID(), role: 'iza', text: WELCOME, ts: Date.now() },
      ]);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'me',
      text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const izaMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'iza',
        text: generateReply(text),
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, izaMsg]);
      setTyping(false);
    }, 900 + Math.random() * 700);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Oi! Vim do site da ZappIQ e gostaria de saber mais.'
  )}`;

  /* ─────────────────────────── RENDER ─────────────────────────── */

  /* Estado MINIMIZED — pílula compacta no canto */
  if (mode === 'minimized') {
    const unread = messages.filter((m) => m.role === 'iza').length > 0 ? 1 : 0;
    return (
      <button
        type="button"
        onClick={() => setMode('inpage')}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-all"
        aria-label="Restaurar chat com Iza"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">ZQ</span>
        </div>
        <span className="text-[13px] font-medium text-gray-900">Iza</span>
        {unread > 0 && (
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    );
  }

  /* Estado INPAGE — janela de chat fixa */
  if (mode === 'inpage') {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
        role="dialog"
        aria-label="Chat com a Iza"
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-3 text-white"
          style={{
            background: 'linear-gradient(135deg,#2FB57A 0%,#2F7FB5 50%,#4A52D0 100%)',
          }}
        >
          <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[11px] font-bold">ZQ</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold leading-tight">Iza · ZappIQ</div>
            <div className="text-[11px] opacity-85 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Online · responde em segundos
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMode('minimized')}
            className="w-7 h-7 hover:bg-white/15 rounded-md flex items-center justify-center transition-colors"
            aria-label="Minimizar"
            title="Minimizar"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={() => setMode('closed')}
            className="w-7 h-7 hover:bg-white/15 rounded-md flex items-center justify-center transition-colors"
            aria-label="Fechar chat"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mensagens */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 bg-[#F8FAFC]"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-[1.45] ${
                m.role === 'me'
                  ? 'ml-auto bg-gradient-to-br from-emerald-500 to-blue-600 text-white'
                  : 'mr-auto bg-white border border-gray-200 text-gray-900'
              }`}
            >
              {m.text.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          ))}
          {typing && (
            <div className="mr-auto bg-white border border-gray-200 rounded-2xl px-3 py-2 text-[13px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>

        {/* Quick action: ir pro WhatsApp */}
        <div className="px-3 py-2 border-t border-gray-100 bg-white flex items-center gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 hover:text-emerald-800 font-medium"
          >
            <Phone size={12} /> Prefere WhatsApp? <ExternalLink size={10} />
          </a>
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-200 bg-white flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Digite sua mensagem..."
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-full text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all"
            aria-label="Enviar"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    );
  }

  /* Estado MENU — popup com 2 opções */
  return (
    <>
      {mode === 'menu' && (
        <div className="fixed bottom-24 right-6 z-50 w-[300px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className="px-4 py-3 text-white flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg,#2FB57A 0%,#2F7FB5 50%,#4A52D0 100%)',
            }}
          >
            <div>
              <div className="text-[14px] font-semibold">Como prefere conversar?</div>
              <div className="text-[11px] opacity-85">Resposta em segundos · IA Iza</div>
            </div>
            <button
              type="button"
              onClick={() => setMode('closed')}
              className="w-7 h-7 hover:bg-white/15 rounded-md flex items-center justify-center transition-colors"
              aria-label="Fechar menu"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-2 flex flex-col gap-1">
            {/* Opção 1: WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMode('closed')}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
                <Phone size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-gray-900">Conversar pelo WhatsApp</div>
                <div className="text-[12px] text-gray-600 leading-snug">
                  Abre no app ou no WhatsApp Web — sua conversa fica salva no histórico
                </div>
              </div>
              <ExternalLink size={14} className="text-gray-400 group-hover:text-emerald-600 mt-1 flex-shrink-0" />
            </a>

            {/* Opção 2: Chat in-page */}
            <button
              type="button"
              onClick={openInpage}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <MessageCircle size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-gray-900">Conversar aqui no site</div>
                <div className="text-[12px] text-gray-600 leading-snug">
                  Chat in-page · histórico salvo · acompanha você navegando
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Balão de boas-vindas (só se nada foi aberto antes) */}
      {showBubble && mode === 'closed' && (
        <div className="fixed bottom-24 right-6 z-50 max-w-[280px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            type="button"
            onClick={dismissBubble}
            className="absolute -top-2 -right-2 w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
            aria-label="Fechar balão"
          >
            <X size={12} className="text-gray-500" />
          </button>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">ZQ</span>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-gray-900 mb-1">Iza · ZappIQ</p>
              <p className="text-[12px] text-gray-600 leading-relaxed">
                Tô aqui se precisar! Clique no botão pra conversar comigo pelo WhatsApp ou
                direto aqui na página.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FAB principal — abre menu */}
      <button
        type="button"
        onClick={openMenu}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-emerald-500 via-blue-500 to-indigo-600 hover:scale-110 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all"
        aria-label="Abrir chat com a Iza"
      >
        <MessageCircle size={26} className="text-white" />
      </button>
    </>
  );
}
