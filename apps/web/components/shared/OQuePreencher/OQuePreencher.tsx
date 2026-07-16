'use client';

/**
 * <OQuePreencher /> — o gatilho "O que preencher aqui", ao lado do título do campo.
 *
 * Uso:
 *   <OQuePreencher campoKey="mira.campanha.alvos.b2b" />
 *
 * Diferente do <SaibaMais />, que é um (i) discreto: aqui o gatilho é um selo
 * escrito e visível, de propósito. O (i) você só clica se já desconfia que
 * errou, e quem escreve "empresas PME" no campo de atividade não desconfia de
 * nada. O selo precisa ser lido ANTES de digitar, não depois.
 *
 * Se a campoKey não existir: em desenvolvimento avisa no console; em produção
 * não renderiza nada (falha silenciosa e segura), igual ao Saiba mais.
 */
import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { getPreencher } from '@/content/preencher';
import { track } from '@/lib/track';
import { OQuePreencherModal } from './OQuePreencherModal';

export function OQuePreencher({ campoKey, className = '' }: { campoKey: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const content = getPreencher(campoKey);

  if (!content) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[OQuePreencher] campoKey sem conteúdo no registro: "${campoKey}"`);
    }
    return null;
  }

  const abrir = () => {
    setOpen(true);
    void track('o_que_preencher_opened', {
      campoKey,
      rota: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={`O que preencher em ${content.titulo}`}
        className={`inline-flex items-center gap-1 rounded-full border border-[#2F7FB5]/25 bg-[#2F7FB5]/[0.07] px-2 py-0.5 text-[10px] font-semibold text-[#2F7FB5] transition hover:border-[#2F7FB5]/50 hover:bg-[#2F7FB5]/15 ${className}`}
      >
        <HelpCircle size={11} aria-hidden />
        O que preencher aqui
      </button>

      {open && <OQuePreencherModal content={content} onClose={() => setOpen(false)} />}
    </>
  );
}
