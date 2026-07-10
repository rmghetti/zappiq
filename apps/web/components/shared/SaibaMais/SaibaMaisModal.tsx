'use client';

/**
 * SaibaMaisModal — o popup grande e ilustrado do "Saiba mais".
 *
 * Renderiza os quatro blocos do padrão MACHIA (o que é, para que serve, como
 * implementar, exemplo de resultado) a partir de um SaibaMaisContent do registro
 * central. Escrito para um dono de PME leigo.
 */
import { useEffect, useRef } from 'react';
import { X, Lightbulb, Target, ListChecks, TrendingUp } from 'lucide-react';
import type { SaibaMaisContent } from '@/content/saiba-mais/types';

const GRAD = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0]';

function Bloco({
  icon,
  titulo,
  children,
}: {
  icon: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-gray-100 px-6 py-5 first:border-t-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[#2F7FB5]">{icon}</span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{titulo}</h3>
      </div>
      <div className="text-[15px] leading-relaxed text-gray-800">{children}</div>
    </section>
  );
}

export function SaibaMaisModal({
  content,
  onClose,
}: {
  content: SaibaMaisContent;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Saiba mais: ${content.titulo}`}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`${GRAD} flex items-center justify-between px-6 py-4`}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/80">Saiba mais</p>
            <h2 className="text-xl font-bold text-white">{content.titulo}</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-white/90 transition hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </header>

        {content.mockup && (
          <div
            className="border-b border-gray-100 bg-gray-50 px-6 py-5"
            // SVG/HTML autorado por nós, conteúdo confiável do registro.
            dangerouslySetInnerHTML={{ __html: content.mockup }}
          />
        )}

        <Bloco icon={<Lightbulb size={16} />} titulo="O que é">
          <p>{content.oQueE}</p>
        </Bloco>

        <Bloco icon={<Target size={16} />} titulo="Para que serve">
          <p>{content.paraQueServe}</p>
        </Bloco>

        <Bloco icon={<ListChecks size={16} />} titulo="Como implementar">
          <ol className="list-decimal space-y-1.5 pl-5">
            {content.comoImplementar.map((passo, i) => (
              <li key={i}>{passo}</li>
            ))}
          </ol>
        </Bloco>

        <Bloco icon={<TrendingUp size={16} />} titulo="Exemplo de resultado na operação">
          <p className="rounded-lg bg-[#F3F4FE] px-4 py-3 text-gray-800">{content.exemploResultado}</p>
        </Bloco>
      </div>
    </div>
  );
}
