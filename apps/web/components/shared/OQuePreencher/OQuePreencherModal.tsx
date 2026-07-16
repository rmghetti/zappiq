'use client';

/**
 * O popup do "O que preencher aqui": o tutorial do campo.
 *
 * A ordem dos blocos é deliberada. O "não preencha" vem LOGO depois do "escreva
 * assim", porque é onde está o valor: o cliente não erra por falta de exemplo
 * (o campo já tem placeholder), erra por não saber que a informação dele
 * pertence a outro lugar. Por isso todo item do "não preencha" carrega o
 * destino, e não só a proibição.
 */
import { useEffect, useRef } from 'react';
import { X, ArrowRight, Ban, Check, PencilLine, Sparkles } from 'lucide-react';
import type { PreencherCampoContent } from '@/content/preencher/types';

const GRAD = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0]';

function Bloco({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-100 px-6 py-5 first:border-t-0">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-[#2F7FB5]">{icon}</span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{titulo}</h3>
      </div>
      <div className="text-[15px] leading-relaxed text-gray-800">{children}</div>
    </section>
  );
}

export function OQuePreencherModal({
  content,
  onClose,
}: {
  content: PreencherCampoContent;
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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`O que preencher em ${content.titulo}`}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`${GRAD} sticky top-0 z-10 flex items-center justify-between px-6 py-4`}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/80">O que preencher aqui</p>
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

        <p className="border-b border-gray-100 bg-[#F7FAFD] px-6 py-4 text-[15px] leading-relaxed text-gray-700">
          {content.resumo}
        </p>

        {content.ilustracao && (
          <div
            className="border-b border-gray-100 bg-gray-50 px-6 py-5"
            // SVG autorado por nós, vindo do registro. Nunca entrada de usuário.
            dangerouslySetInnerHTML={{ __html: content.ilustracao }}
          />
        )}

        <Bloco icon={<PencilLine size={16} />} titulo="Escreva assim">
          <ul className="space-y-2">
            {content.deve.map((d, i) => (
              <li key={i} className="flex gap-2.5">
                <Check size={17} className="mt-0.5 shrink-0 text-[#2FB57A]" aria-hidden />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </Bloco>

        <Bloco icon={<Ban size={16} />} titulo="Não preencha aqui (e onde isso deve ir)">
          <ul className="space-y-3">
            {content.naoDeve.map((n, i) => (
              <li key={i} className="rounded-lg border border-red-100 bg-red-50/50 px-3.5 py-3">
                <p className="flex gap-2 font-medium text-gray-900">
                  <Ban size={16} className="mt-0.5 shrink-0 text-red-500" aria-hidden />
                  {n.item}
                </p>
                <p className="mt-1 pl-6 text-sm text-gray-600">{n.porque}</p>
                {n.ondeVai && (
                  <p className="mt-1.5 flex gap-2 pl-6 text-sm font-medium text-[#0F7A50]">
                    <ArrowRight size={15} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{n.ondeVai}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Bloco>

        <Bloco icon={<Sparkles size={16} />} titulo="Exemplos">
          <ul className="space-y-1.5">
            {content.exemplos.map((e, i) => (
              <li
                key={i}
                className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-lg px-3 py-2 ${
                  e.bom ? 'bg-emerald-50' : 'bg-red-50'
                }`}
              >
                {e.bom ? (
                  <Check size={15} className="shrink-0 text-[#2FB57A]" aria-label="Bom exemplo" />
                ) : (
                  <X size={15} className="shrink-0 text-red-500" aria-label="Exemplo a evitar" />
                )}
                <code className="font-mono text-sm text-gray-900">{e.valor}</code>
                <span className="text-sm text-gray-500">{e.nota}</span>
              </li>
            ))}
          </ul>
        </Bloco>

        <Bloco icon={<ArrowRight size={16} />} titulo="O que a Mira faz com isso">
          <p className="rounded-lg bg-[#F3F4FE] px-4 py-3 text-gray-800">{content.comoVira}</p>
        </Bloco>
      </div>
    </div>
  );
}
