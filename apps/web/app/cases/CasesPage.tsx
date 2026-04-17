'use client';

import Link from 'next/link';
import { ArrowRight, Clock, Stethoscope, ShoppingBag, Wrench, GraduationCap, Building2, MessageCircle } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';

/* ═══════════════════════════════════════════════════════════════════════
 * CasesPage — versão pré-launch (honesta)
 *
 * Em vez de cases fictícios com métricas inventadas, mostramos:
 *   1. Segmentos-alvo com os problemas que resolvemos (sem fabricar dados)
 *   2. CTA para trial + formulário de interesse em ser "case fundador"
 *
 * Quando houver cases reais pós-launch, substituir esta página pela
 * versão completa com dados de clientes (manter backup em CasesPage.full.tsx).
 * ═══════════════════════════════════════════════════════════════════════ */

const SEGMENTS = [
  {
    icon: Stethoscope,
    name: 'Clínicas e Consultórios',
    pain: 'Pacientes desistem quando o WhatsApp demora. No-show consome até 25% do faturamento.',
    solve: 'Agendamento automático 24/7, lembretes inteligentes e confirmação por IA.',
    color: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-50',
    textAccent: 'text-blue-600',
  },
  {
    icon: ShoppingBag,
    name: 'E-commerce e Varejo',
    pain: 'Carrinho abandonado e perguntas repetitivas consomem o time de vendas.',
    solve: 'IA vendedora 24/7, recuperação automática de carrinho e catálogo integrado.',
    color: 'from-purple-500 to-purple-600',
    bgLight: 'bg-purple-50',
    textAccent: 'text-purple-600',
  },
  {
    icon: Wrench,
    name: 'Serviços e Oficinas',
    pain: 'Dono responde WhatsApp o dia inteiro em vez de focar na operação.',
    solve: 'IA responde sobre preços, horários e status. Agenda automático, libera o operador.',
    color: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50',
    textAccent: 'text-amber-600',
  },
  {
    icon: GraduationCap,
    name: 'Escolas e Cursos',
    pain: '80% das dúvidas de pais chegam fora do horário. Secretaria não dá conta.',
    solve: 'IA responde sobre turmas, valores e matrículas 24/7. Lembretes de vencimento automáticos.',
    color: 'from-emerald-500 to-green-600',
    bgLight: 'bg-emerald-50',
    textAccent: 'text-emerald-600',
  },
  {
    icon: Building2,
    name: 'Consultoria B2B',
    pain: 'Leads quentes esfriam enquanto o time filtra os frios manualmente.',
    solve: 'Qualificação automática BANT/SPIN pela IA. Time recebe só lead pronto para fechar.',
    color: 'from-indigo-500 to-indigo-600',
    bgLight: 'bg-indigo-50',
    textAccent: 'text-indigo-600',
  },
  {
    icon: MessageCircle,
    name: 'Seu Segmento',
    pain: 'Se o WhatsApp é o canal principal da sua operação, a dor é a mesma: escala manual não funciona.',
    solve: 'ZappIQ se adapta ao seu fluxo. Configure em minutos, sem consultoria e sem setup fee.',
    color: 'from-primary-500 to-secondary-500',
    bgLight: 'bg-primary-50',
    textAccent: 'text-primary-600',
  },
];

export function CasesPage() {
  return (
    <PublicLayout>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Segmentos que Atendemos
          </p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
            A dor é a mesma. A solução é ZappIQ.
          </h1>
          <p className="text-lg text-gray-500">
            Cada negócio tem suas particularidades, mas o gargalo do WhatsApp manual é universal.
            Veja como a ZappIQ resolve para o seu segmento.
          </p>
        </div>
      </div>

      {/* Segmentos */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SEGMENTS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.name}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow flex flex-col"
              >
                <div className={`w-12 h-12 ${s.bgLight} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon size={24} className={s.textAccent} />
                </div>
                <h2 className="font-display text-lg font-bold text-gray-900 mb-2">{s.name}</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{s.pain}</p>
                <div className={`${s.bgLight} rounded-lg p-3 mt-auto`}>
                  <p className={`text-sm font-medium ${s.textAccent}`}>{s.solve}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Founder Case — convite */}
      <section className="py-16 bg-[#F8FAF9]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-secondary-100 text-secondary-700 text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full mb-6">
            <Clock size={14} /> Programa Fundadores
          </div>
          <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-gray-900 mb-4">
            Seja um dos primeiros cases da ZappIQ
          </h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Estamos selecionando os primeiros clientes para acompanhamento próximo.
            Você ganha suporte prioritário e consultoria gratuita de implantação.
            Em troca, documentamos os resultados reais juntos e publicamos aqui.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-primary-500/25"
            >
              Começar 14 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-primary-400 text-gray-700 font-semibold px-7 py-3.5 rounded-xl transition-all bg-white hover:bg-primary-50"
            >
              Ver Demo ao Vivo
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-[#1A1A2E]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-white mb-5">
            O próximo case pode ser o seu
          </h2>
          <p className="text-gray-400 mb-8">
            Sem setup fee, sem contrato mínimo. Configure em minutos e meça o resultado real.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-secondary-500/30 text-base"
          >
            Começar Grátis <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
