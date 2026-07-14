'use client';

/**
 * CanaisTutorialCard — card de acesso ao tutorial interativo de ativação de
 * canais (WhatsApp/Instagram), no MESMO padrão dos demais tutoriais ZappIQ:
 * card CTA (Baixar PDF + Abrir tutorial) + modal grande com <iframe>
 * self-contained (/tutoriais/tutorial-interativo.html). Fecha via
 * postMessage('zappiq-tutorial-close') + Escape.
 *
 * Usado no Dashboard inicial pra dar máxima visibilidade ao onboarding de
 * canais (cliente novo vê ao logar). O mesmo tutorial também vive em
 * Configurações → Canais (ConectarCanais).
 */
import { useEffect, useState } from 'react';
import { BookOpen, Download, ArrowRight, X } from 'lucide-react';

const TUTORIAL_HTML = '/tutoriais/tutorial-interativo.html';
const TUTORIAL_PDF = '/tutoriais/cadastrar-whatsapp-instagram.pdf';

export function CanaisTutorialCard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e?.data === 'zappiq-tutorial-close') setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      window.addEventListener('message', onMessage);
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('message', onMessage);
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [open]);

  return (
    <>
      <div className="mb-6 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/70 to-white p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
          <BookOpen size={22} className="text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-600">
            Recomendado · 3 min de leitura
          </p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">
            Como conectar WhatsApp e Instagram
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Tutorial interativo, tela a tela. Pelo computador, sem conhecimento técnico.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <a
            href={TUTORIAL_PDF}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
          >
            <Download size={14} /> Baixar PDF
          </a>
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
          >
            <BookOpen size={14} /> Abrir tutorial
          </button>
          {/* CTA primário: leva direto pro campo de conexão em Configurações. */}
          <a
            href="/settings#canais"
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center gap-2 whitespace-nowrap"
          >
            Conectar canais <ArrowRight size={14} />
          </a>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col sm:p-4 md:p-6" role="dialog" aria-modal="true">
          <div className="relative bg-white sm:rounded-2xl overflow-hidden shadow-2xl w-full h-full sm:max-w-6xl sm:mx-auto flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-white">
              <span className="text-xs font-medium text-gray-500">Tutorial de ativação · ZappIQ</span>
              <div className="flex items-center gap-2">
                <a
                  href={TUTORIAL_PDF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <Download size={13} /> Baixar PDF
                </a>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fechar tutorial"
                  className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={TUTORIAL_HTML}
              title="Tutorial interativo de ativação ZappIQ — WhatsApp e Instagram"
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </>
  );
}
