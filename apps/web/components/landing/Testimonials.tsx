import { Star } from 'lucide-react';

const TESTIMONIALS = [
  { name: 'Dra. Camila', role: 'Clínica Vida Plena', text: 'A ZappIQ transformou nosso atendimento. De 4 horas de espera para resposta instantânea.', initials: 'DC' },
  { name: 'Ricardo', role: 'TrendMix Moda', text: 'Nossas vendas pelo WhatsApp cresceram 35% no primeiro mês. O Pulse AI vende sozinho!', initials: 'RM' },
  { name: 'Marcos', role: 'AutoTech', text: 'Recuperei 3 horas do meu dia. Agora posso focar na oficina em vez de ficar no celular.', initials: 'MA' },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-[#F8FAF9]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Depoimentos</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">O que dizem nossos clientes</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-white rounded-2xl border border-gray-200 p-7 relative hover:shadow-lg transition-shadow">
              <div className="text-6xl font-serif text-primary-100 absolute top-4 right-6">&ldquo;</div>
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-gray-600 leading-relaxed mb-6 relative z-10">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-xs font-bold">{t.initials}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
