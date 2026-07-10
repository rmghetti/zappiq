'use client';

/**
 * IzaAjuda — chat de suporte da plataforma, disponível em todas as páginas do
 * Dashboard (Fase 2). Minimizável; o cliente pergunta como usar a ZappIQ e a
 * Iza Ajuda responde com base no material de ajuda (corpus clientSafe).
 *
 * Distinta da Iza do WhatsApp: esta só orienta o USO da plataforma. Cada
 * resposta pode oferecer o "Saiba mais" do recurso citado (liga na Fase 1).
 *
 * Posição: canto inferior esquerdo (o TreinarAgenteFAB já ocupa a direita).
 * Estado aberto/fechado persiste em localStorage (zappiq_iza_ajuda_open).
 */
import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, X, Send, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getSaibaMais } from '@/content/saiba-mais';
import { SaibaMaisModal } from '@/components/shared/SaibaMais/SaibaMaisModal';

type Source = { featureKey: string; titulo: string };
type Msg = { role: 'user' | 'assistant'; content: string; sources?: Source[] };

const OPEN_KEY = 'zappiq_iza_ajuda_open';
const SAUDACAO: Msg = {
  role: 'assistant',
  content: 'Oi! Eu sou a Iza Ajuda. Me pergunte qualquer coisa sobre usar a ZappIQ e eu te explico na hora.',
};

export function IzaAjuda() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([SAUDACAO]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(OPEN_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, loading]);

  async function enviar() {
    const pergunta = input.trim();
    if (!pergunta || loading) return;
    setInput('');
    const historico = msgs
      .filter((m) => m !== SAUDACAO)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: pergunta }]);
    setLoading(true);
    try {
      const res: any = await api.post('/api/iza-ajuda/chat', { message: pergunta, history: historico });
      const body = res?.data ?? res;
      setMsgs((m) => [
        ...m,
        { role: 'assistant', content: body?.reply || 'Desculpa, não consegui responder agora.', sources: body?.sources || [] },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', content: 'Tive um problema para responder agora. Tente de novo em instantes.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const detalheContent = detalhe ? getSaibaMais(detalhe) : undefined;

  return (
    <>
      <div className="fixed bottom-6 left-6 z-50">
        {open ? (
          <div className="flex h-[520px] max-h-[75vh] w-[360px] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0] px-4 py-3">
              <div className="flex items-center gap-2 text-white">
                <MessageCircleQuestion size={18} />
                <div>
                  <p className="text-sm font-semibold leading-tight">Iza Ajuda</p>
                  <p className="text-[11px] leading-tight text-white/80">Suporte da plataforma</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Minimizar" className="rounded-full p-1 text-white/90 hover:bg-white/20">
                <X size={18} />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-3">
              {msgs.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed ${
                      m.role === 'user' ? 'bg-[#2F7FB5] text-white' : 'bg-white text-gray-800 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.sources
                          .filter((s) => getSaibaMais(s.featureKey))
                          .slice(0, 3)
                          .map((s) => (
                            <button
                              key={s.featureKey}
                              onClick={() => setDetalhe(s.featureKey)}
                              className="rounded-full border border-[#2F7FB5]/30 bg-[#2F7FB5]/5 px-2.5 py-1 text-[11px] font-medium text-[#2F7FB5] hover:bg-[#2F7FB5]/10"
                            >
                              Saiba mais: {s.titulo}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white px-3 py-2 text-gray-500 shadow-sm">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') enviar();
                }}
                placeholder="Pergunte como usar a ZappIQ..."
                className="flex-1 rounded-full border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-[#2F7FB5]"
              />
              <button
                onClick={enviar}
                disabled={loading || !input.trim()}
                aria-label="Enviar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2F7FB5] text-white transition hover:bg-[#4A52D0] disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir a Iza Ajuda"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
          >
            <MessageCircleQuestion size={20} />
            Ajuda
          </button>
        )}
      </div>

      {detalheContent && <SaibaMaisModal content={detalheContent} onClose={() => setDetalhe(null)} />}
    </>
  );
}
