'use client';

/**
 * Bloco V3.2 — Iza está aqui
 * --------------------------
 * Dogfooding: o próprio ZappIQ é atendido pela Iza (agente IA rodando no
 * ZappIQ), no WhatsApp da empresa. Prova social ao vivo.
 *
 * PLACEHOLDER: substituir IZA_WA_URL por wa.me real quando a conta Iza estiver ativa.
 */
import { useState } from 'react';
import { Sparkles, Send, ArrowRight } from 'lucide-react';

// PLACEHOLDER — trocar pelo número real da Iza quando T7.A for executada.
const IZA_WA_URL = process.env.NEXT_PUBLIC_IZA_WA_URL || 'https://wa.me/5511000000000?text=Oi%20Iza!%20Quero%20conhecer%20o%20ZappIQ.';

const SUGGESTED_PROMPTS = [
  'Quanto custa o plano Growth?',
  'Como funciona a garantia de 60 dias?',
  'Vocês têm voz outbound?',
  'ZappIQ trata dados LGPD?',
];

export function IzaEstaAqui() {
  const [customQuestion, setCustomQuestion] = useState('');

  function buildUrl(text: string) {
    return `${IZA_WA_URL.split('?')[0]}?text=${encodeURIComponent(text)}`;
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const q = customQuestion.trim() || 'Oi Iza! Quero conhecer o ZappIQ.';
    window.open(buildUrl(q), '_blank', 'noopener,noreferrer');
  }

  return (
    <section id="iza" className="py-20 lg:py-28 bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 -z-0 opacity-40">
        <div className="absolute top-10 left-10 w-80 h-80 bg-secondary-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary-500/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Sparkles size={14} /> Dogfooding ao vivo
            </div>
            <h2 className="font-display text-3xl lg:text-5xl font-extrabold leading-tight mb-5">
              A Iza está aqui.<br />
              <span className="bg-gradient-to-r from-amber-300 to-secondary-300 bg-clip-text text-transparent">E ela usa ZappIQ.</span>
            </h2>
            <p className="text-lg text-white/80 leading-relaxed mb-4">
              A Iza é nossa agente de IA oficial. Ela tira dúvidas sobre produto, preço, garantia e implementação —
              no WhatsApp, 24/7. Quem atende você é a própria ZappIQ rodando no ZappIQ.
            </p>
            <p className="text-sm text-white/70 leading-relaxed mb-8">
              Se a Iza não consegue resolver, ela escala pra um humano do time. Mas se ela responde bem, você já está
              testando o produto antes de comprar. É a prova pública de que funciona.
            </p>

            <a
              href={IZA_WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-primary-700 hover:bg-primary-50 font-semibold px-7 py-3.5 rounded-xl transition-all shadow-xl"
            >
              Conversar com a Iza agora <ArrowRight size={18} />
            </a>
          </div>

          <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-2xl text-gray-900">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-lg">
                IZ
              </div>
              <div>
                <p className="font-display font-extrabold text-gray-900">Iza — Agente IA ZappIQ</p>
                <p className="text-xs text-secondary-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-secondary-500 rounded-full animate-pulse" /> Online agora
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4">Perguntas mais comuns:</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {SUGGESTED_PROMPTS.map((p) => (
                <a
                  key={p}
                  href={buildUrl(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-700 px-3 py-2 rounded-full border border-gray-200 transition-colors"
                >
                  {p}
                </a>
              ))}
            </div>

            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="Ou escreva sua própria pergunta..."
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <button
                type="submit"
                className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-3 rounded-xl transition-colors flex items-center justify-center"
                aria-label="Enviar pergunta"
              >
                <Send size={18} />
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-4 text-center">
              Abre em <strong>WhatsApp Business</strong> — nenhum dado é coletado antes de você enviar a mensagem.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
