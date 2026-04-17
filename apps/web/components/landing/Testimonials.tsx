import Link from 'next/link';
import { ArrowRight, Sparkles, Users, Percent } from 'lucide-react';

const PERKS = [
  {
    icon: Percent,
    title: '50% off por 12 meses',
    description: 'Metade do preço no primeiro ano. Cupom exclusivo para fundadores.',
  },
  {
    icon: Users,
    title: 'Acesso direto ao time',
    description: 'Canal privado com os founders. Influencie o roadmap e priorize features que importam para você.',
  },
  {
    icon: Sparkles,
    title: 'Badge de Fundador',
    description: 'Reconhecimento permanente na plataforma. Quem entra antes, constrói junto.',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-[#F8FAF9]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Programa Fundadores</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">Seja um dos primeiros. Construa conosco.</h2>
          <p className="text-gray-500 mt-4 max-w-2xl mx-auto leading-relaxed">
            Estamos selecionando empresas para co-criar a ZappIQ. Em troca de feedback real, oferecemos condições que não vão existir depois do lançamento.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {PERKS.map((p) => (
            <div key={p.title} className="bg-white rounded-2xl border border-gray-200 p-7 hover:shadow-lg transition-shadow text-center">
              <div className="w-14 h-14 mx-auto rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center mb-4">
                <p.icon size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{p.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5"
          >
            Quero ser Fundador <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-gray-400 mt-3">Vagas limitadas — 14 dias grátis, sem cartão de crédito</p>
        </div>
      </div>
    </section>
  );
}
