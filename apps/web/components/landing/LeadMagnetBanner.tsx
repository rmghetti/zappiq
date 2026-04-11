import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';

export function LeadMagnetBanner() {
  return (
    <section className="py-10 bg-gradient-to-r from-primary-600 to-secondary-600">
      <div className="max-w-7xl mx-auto px-6">
        <Link href="/recursos" className="flex flex-col sm:flex-row items-center justify-between gap-4 group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              {/* PLACEHOLDER: substituir por título do lead magnet real */}
              <p className="text-white font-bold text-lg">Baixe grátis: Guia Definitivo de Automação WhatsApp</p>
              <p className="text-white/70 text-sm">E-book completo com estratégias para PMEs. Sem custo.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 bg-white/20 text-white font-semibold px-5 py-2.5 rounded-xl group-hover:bg-white/30 transition-colors text-sm flex-shrink-0">
            Baixar Grátis <ArrowRight size={14} />
          </span>
        </Link>
      </div>
    </section>
  );
}
