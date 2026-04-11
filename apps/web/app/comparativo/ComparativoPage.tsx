'use client';

import Link from 'next/link';
import { ArrowRight, Check, X, Minus } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';

/* ------------------------------------------------------------------ */
/* Dados da tabela comparativa                                         */
/* ------------------------------------------------------------------ */

type CellValue = 'yes' | 'no' | 'partial' | string;

type Row = {
  feature: string;
  zappiq: CellValue;
  a: CellValue;
  b: CellValue;
  c: CellValue;
};

const ROWS: Row[] = [
  { feature: 'Preco inicial', zappiq: 'R$97/mes', a: 'R$299/mes', b: 'R$199/mes', c: 'R$499/mes' },
  { feature: 'IA nativa incluida', zappiq: 'yes', a: 'no', b: 'partial', c: 'yes' },
  { feature: 'Setup em minutos', zappiq: 'yes', a: 'no', b: 'no', c: 'partial' },
  { feature: 'Onboarding gratuito', zappiq: 'yes', a: 'no', b: 'yes', c: 'no' },
  { feature: 'API WhatsApp oficial', zappiq: 'yes', a: 'yes', b: 'partial', c: 'yes' },
  { feature: 'Suporte em portugues', zappiq: 'yes', a: 'partial', b: 'yes', c: 'no' },
  { feature: 'Dashboard analytics', zappiq: 'yes', a: 'yes', b: 'partial', c: 'yes' },
  { feature: 'Multicanal', zappiq: 'yes', a: 'yes', b: 'no', c: 'partial' },
  { feature: 'Garantia de ROI', zappiq: 'yes', a: 'no', b: 'no', c: 'no' },
  { feature: 'LGPD compliance', zappiq: 'yes', a: 'partial', b: 'yes', c: 'partial' },
];

const COLUMNS = [
  { key: 'zappiq' as const, label: 'ZappIQ', highlight: true },
  { key: 'a' as const, label: 'Plataforma A', highlight: false },
  { key: 'b' as const, label: 'Plataforma B', highlight: false },
  { key: 'c' as const, label: 'Plataforma C', highlight: false },
];

/* ------------------------------------------------------------------ */
/* Renderizador de celula                                              */
/* ------------------------------------------------------------------ */

function CellContent({ value, highlight }: { value: CellValue; highlight: boolean }) {
  if (value === 'yes') {
    return (
      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${highlight ? 'bg-primary-100 text-primary-600' : 'bg-green-100 text-green-600'}`}>
        <Check size={16} strokeWidth={3} />
      </span>
    );
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-500">
        <X size={16} strokeWidth={3} />
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
        <Minus size={14} /> Parcial
      </span>
    );
  }
  return <span className="text-sm font-medium text-gray-700">{value}</span>;
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export function ComparativoPage() {
  return (
    <PublicLayout>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Comparativo</p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
            ZappIQ vs. Concorrentes: veja por que somos a melhor escolha
          </h1>
          <p className="text-lg text-gray-500">
            Comparamos preco, funcionalidades e suporte para voce tomar a melhor decisao.
          </p>
        </div>
      </div>

      {/* Tabela — Desktop */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
            {/* Header row */}
            <div className="grid grid-cols-5 bg-[#F8FAF9]">
              <div className="px-6 py-4 text-sm font-semibold text-gray-500">Funcionalidade</div>
              {COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className={`px-6 py-4 text-center text-sm font-bold ${
                    col.highlight
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-700'
                  }`}
                >
                  {col.label}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {ROWS.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAF9]'} border-t border-gray-100`}
              >
                <div className="px-6 py-4 text-sm font-medium text-gray-700 flex items-center">
                  {row.feature}
                </div>
                {COLUMNS.map((col) => (
                  <div
                    key={col.key}
                    className={`px-6 py-4 flex items-center justify-center ${
                      col.highlight ? 'bg-primary-50/50' : ''
                    }`}
                  >
                    <CellContent value={row[col.key]} highlight={col.highlight} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-4">
          {ROWS.map((row) => (
            <div key={row.feature} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-900 mb-3">{row.feature}</p>
              <div className="grid grid-cols-2 gap-3">
                {COLUMNS.map((col) => (
                  <div key={col.key} className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${col.highlight ? 'text-primary-600' : 'text-gray-500'}`}>
                      {col.label}:
                    </span>
                    <CellContent value={row[col.key]} highlight={col.highlight} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-6 flex flex-wrap items-center gap-6 justify-center text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600"><Check size={12} strokeWidth={3} /></span>
            Incluso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500"><X size={12} strokeWidth={3} /></span>
            Nao incluso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-600"><Minus size={12} /></span>
            Parcial / add-on pago
          </span>
        </div>
      </div>

      {/* CTA */}
      <section className="py-20 bg-[#1A1A2E]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-white mb-5">
            Pronto para mudar?
          </h2>
          <p className="text-gray-400 mb-8">Comece gratis por 14 dias. Sem cartao de credito. Sem compromisso.</p>
          {/* PLACEHOLDER: substituir por dado real */}
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-secondary-500/30 text-base"
          >
            Comecar Gratis por 14 Dias <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
