'use client';

/**
 * Bloco V3.2 — Garantia 60 Dias
 * -----------------------------
 * Substitui o bloco legado "Founders" (que falava de early-access V2).
 * Mensagem: 30 dias de trial + 60 dias de garantia após assinar.
 * Se em 60 dias a IA não atingir os KPIs acordados, reembolso integral.
 */
import Link from 'next/link';
import { Shield, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';

const PILARES = [
  {
    icon: <Calendar size={22} />,
    title: '30 dias grátis',
    description: 'Trial completo, com todos os recursos do plano escolhido. Cancela em um clique, sem pergunta.',
  },
  {
    icon: <Shield size={22} />,
    title: '60 dias de garantia',
    description: 'Após assinar, se a IA não bater os KPIs acordados no seu Acordo de Performance, devolvemos 100% do valor pago.',
  },
  {
    icon: <CheckCircle2 size={22} />,
    title: 'KPIs no seu onboarding',
    description: 'Os KPIs são definidos junto com você no survey inicial. Sem surpresa, sem letra miúda.',
  },
];

export function Garantia60d() {
  return (
    <section id="garantia" className="py-20 lg:py-28 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Shield size={14} /> Diferencial V3.2
            </div>
            <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
              30 dias grátis.<br />
              <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">Mais 60 dias de garantia.</span>
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-6">
              90 dias para provar que funciona na sua operação. Não funcionou? Devolvemos todo o valor pago — direto e sem burocracia.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              Nenhum outro fornecedor de IA conversacional para WhatsApp no Brasil oferece isso hoje.
              A gente oferece porque acredita no produto e porque entende que seu risco é o que trava a decisão.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/garantia"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-primary-500/25"
              >
                Ver termos completos da Garantia 60d <ArrowRight size={16} />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 border border-primary-300 hover:border-primary-500 text-primary-600 hover:text-primary-700 font-semibold px-6 py-3 rounded-xl transition-all bg-white hover:bg-primary-50"
              >
                Começar 30 dias grátis
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            {PILARES.map((p) => (
              <div
                key={p.title}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white flex-shrink-0">
                  {p.icon}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-gray-900 mb-1">{p.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
