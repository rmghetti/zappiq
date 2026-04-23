/* ══════════════════════════════════════════════════════════════════════════
 * LeadMagnetBanner — Design V4 (Chatbase-style · Geist + gradient g→b→p)
 * --------------------------------------------------------------------------
 * Banner horizontal compacto entre Pricing e BlogPreview. Fundo bg-soft com
 * ícone gradient, título institucional e CTA minimalista.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';

export function LeadMagnetBanner() {
  return (
    <section className="py-12 bg-bg">
      <div className="zappiq-wrap">
        <Link
          href="/recursos"
          className="group flex flex-col sm:flex-row items-center justify-between gap-5 bg-bg-soft border border-line rounded-[20px] p-6 lg:p-7 hover:border-accent/40 hover:shadow-[0_20px_40px_-20px_rgba(74,82,208,0.15)] transition-all"
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0 shadow-[0_8px_16px_-8px_rgba(74,82,208,0.4)]"
              style={{
                background:
                  'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
              }}
            >
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[15px] font-medium text-ink tracking-tight leading-tight">
                Guia Definitivo · Automação WhatsApp para PMEs brasileiras
              </p>
              <p className="text-[12.5px] text-muted mt-1">
                E-book gratuito · 38 páginas · casos reais, playbooks e benchmarks por vertical.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 bg-white border border-line group-hover:border-accent group-hover:text-accent text-ink font-medium px-5 py-2.5 rounded-[12px] transition-colors text-[13px] flex-shrink-0">
            Baixar gratuito <ArrowRight size={14} />
          </span>
        </Link>
      </div>
    </section>
  );
}
