'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * IzaEstaAqui — Design V4 (dogfooding ao vivo · Chatbase-style)
 * --------------------------------------------------------------------------
 * Preserva tese V3.2: o próprio ZappIQ é atendido pela Iza rodando no
 * ZappIQ. Prova pública de funcionamento. IZA_WA_URL via env com fallback.
 *
 * Visual novo: split dark (#0A0B12) esquerda com CTA + card chat direita
 * em background claro. Gradient glows decorativos preservados.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Sparkles, Send, ArrowRight } from 'lucide-react';

const IZA_WA_URL =
  process.env.NEXT_PUBLIC_IZA_WA_URL ||
  'https://wa.me/5511945633305?text=Oi%20Iza!%20Quero%20conhecer%20o%20ZappIQ.';

const SUGGESTED_PROMPTS = [
  'Quanto custa o plano Growth?',
  'Como funcionam os 14 dias grátis?',
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
    <section
      id="iza"
      className="py-20 lg:py-28 text-white relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #0A0B12 0%, #14182B 50%, #1A1F45 100%)',
      }}
    >
      {/* glows decorativos */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div
          className="absolute top-0 left-10 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(47,127,181,0.35) 0%, transparent 60%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(74,82,208,0.4) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(47,181,122,0.25) 0%, transparent 60%)' }}
        />
      </div>

      <div className="relative zappiq-wrap">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Esquerda — copy + CTA */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full mb-5 backdrop-blur-sm uppercase tracking-[0.12em]">
              <Sparkles size={12} /> Teste você mesmo · agora
            </div>
            <h2 className="text-[40px] lg:text-[56px] font-medium leading-[1.02] tracking-[-0.03em] mb-5">
              A Iza está aqui.
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #8AB7E9 100%)',
                }}
              >
                E ela É a ZappIQ atendendo você.
              </span>
            </h2>
            <p className="text-[17px] text-white/80 leading-relaxed mb-4">
              A Iza é a nossa IA oficial. Pergunta sobre produto, preço, trial, implementação —
              ela responde no WhatsApp, 24/7. Quem atende você agora é a própria ZappIQ rodando no ZappIQ.
            </p>
            <p className="text-[14px] text-white/65 leading-relaxed mb-8">
              Se ela não consegue resolver, chama um humano do time. Se ela resolve bem,
              você já viu o produto funcionar antes de comprar. Prova pública, ao vivo.
            </p>

            <a
              href={IZA_WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-ink hover:bg-white/90 font-medium px-6 py-3.5 rounded-[14px] transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.15)] text-[14.5px]"
            >
              Conversar com a Iza agora <ArrowRight size={16} />
            </a>
          </div>

          {/* Direita — card chat claro */}
          <div className="bg-white rounded-[20px] p-6 lg:p-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)] text-ink">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-[14px] tracking-tight shadow-[0_8px_16px_-8px_rgba(74,82,208,0.4)]"
                style={{
                  background:
                    'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
                }}
              >
                IZ
              </div>
              <div>
                <p className="font-medium text-ink text-[14.5px] tracking-tight">Iza · Agente IA ZappIQ</p>
                <p className="text-[11.5px] text-[#2FB57A] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#2FB57A] rounded-full animate-pulse" /> Online agora
                </p>
              </div>
            </div>

            <p className="text-[12.5px] text-muted mb-3 uppercase tracking-[0.1em] font-semibold">
              Perguntas mais comuns
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {SUGGESTED_PROMPTS.map((p) => (
                <a
                  key={p}
                  href={buildUrl(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] bg-bg-soft hover:bg-accent/5 hover:text-accent hover:border-accent/30 text-ink px-3 py-1.5 rounded-full border border-line transition-colors"
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
                className="flex-1 px-4 py-3 border border-line rounded-[12px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-[13.5px] text-ink placeholder:text-muted"
              />
              <button
                type="submit"
                className="text-white px-4 py-3 rounded-[12px] transition-all flex items-center justify-center hover:opacity-90"
                style={{
                  background:
                    'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
                  boxShadow: '0 8px 20px -8px rgba(74,82,208,.4)',
                }}
                aria-label="Enviar pergunta"
              >
                <Send size={16} />
              </button>
            </form>

            <p className="text-[11px] text-muted mt-4 text-center">
              Abre em <strong className="text-ink">WhatsApp Business</strong> · nenhum dado é coletado antes de você enviar a mensagem.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
