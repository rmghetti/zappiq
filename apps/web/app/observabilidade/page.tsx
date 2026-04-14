import Link from 'next/link';
import { PublicLayout } from '@/components/landing/PublicLayout';
import {
  Radar, TrendingUp, AlertCircle, Users, BarChart3, Download,
  Clock, Zap, Target, Brain, ArrowRight, Check, Sparkles
} from 'lucide-react';

export const metadata = {
  title: 'Radar 360° — Observabilidade de Negócio para WhatsApp | ZappIQ',
  description: 'Transforme conversas em decisões. BI conversacional com cohort analysis, previsão de pipeline (ML), benchmarking e alertas proativos. Exporta para Power BI e Looker.',
};

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Dashboards executivos customizáveis',
    desc: '20+ widgets drag-and-drop. Branding com sua logo e cores. Compartilhamento por link com senha. Export PDF agendado por e-mail — o board recebe relatório sem você apertar um botão.',
    accent: 'from-purple-600 to-indigo-600',
  },
  {
    icon: Users,
    title: 'Cohort Analysis',
    desc: 'Retenção de leads por mês de entrada. Comportamento por segmento. Taxa de conversão por origem (WhatsApp direto, site, redes sociais). LTV estimado por cohort.',
    accent: 'from-blue-500 to-cyan-600',
  },
  {
    icon: Target,
    title: 'Funil de conversão multicamada',
    desc: 'Funil completo: primeiro contato → qualificação → proposta → fechamento. Taxa de drop-off em cada etapa. Identificação automática de gargalos.',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    icon: AlertCircle,
    title: 'Alertas proativos inteligentes',
    desc: 'Queda anormal de conversão detectada via desvio padrão histórico. Pico de abandono em horário específico. Palavra-chave emergente (ex: "concorrente", "cancelar"). Notifica via Slack, WhatsApp e e-mail.',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    icon: Brain,
    title: 'Previsão de pipeline (ML)',
    desc: 'Forecast de fechamento baseado em padrões históricos. Probabilidade de conversão por conversa ativa. Alerta de leads em risco. Sugestão de próxima ação por lead.',
    accent: 'from-violet-500 to-purple-700',
  },
  {
    icon: TrendingUp,
    title: 'Benchmarking de mercado',
    desc: 'Comparação anônima contra média do seu segmento. Percentil de performance em métricas-chave. Identificação de oportunidades: "você está no P25 em tempo de resposta".',
    accent: 'from-rose-500 to-pink-600',
  },
  {
    icon: Clock,
    title: 'Heatmap operacional',
    desc: 'Mapa de calor de volume por hora/dia. Horários ótimos para campanhas. Distribuição de carga por agente. Mostra onde sua operação suaja — e onde sobra capacidade.',
    accent: 'from-sky-500 to-blue-600',
  },
  {
    icon: Download,
    title: 'BI exportável (Power BI, Looker)',
    desc: 'Conector OData para Power BI. Conector Looker Studio. Export CSV/Excel agendado. API REST pra sua pipeline de dados. Seu time de BI usa as ferramentas que já conhece.',
    accent: 'from-indigo-600 to-blue-700',
  },
  {
    icon: Zap,
    title: 'SLA por agente e qualidade IA',
    desc: 'Tempo de 1ª resposta e de resolução por agente. Taxa de transferência humana vs IA. Qualidade da resposta do Pulse AI (avaliação manual + automática). Dados que viram conversa de 1:1.',
    accent: 'from-yellow-500 to-amber-600',
  },
];

const VALUE_POINTS = [
  '40% dos seus leads caem entre a segunda e terceira mensagem — agora você sabe qual',
  'Seu melhor agente tem 3x mais conversão às 10h vs às 16h',
  '60% dos clientes que mencionam "concorrente" cancelam em 30 dias — alerta preventivo',
  'Campanha A teve 2x mais resposta — replicar template em produtos similares',
  'Retenção D30 do cohort de março caiu 15% — investigar onboarding',
];

const PRICING_TIERS = [
  { plan: 'Starter', base: 297, radar: 197, badge: null },
  { plan: 'Growth', base: 597, radar: 197, badge: null },
  { plan: 'Scale', base: 997, radar: 397, badge: null },
  { plan: 'Enterprise', base: 2997, radar: 0, badge: 'Incluso' },
];

export default function ObservabilidadePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-900 via-indigo-900 to-gray-900 pt-20 pb-24 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,0.25),_transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-400/30 rounded-full px-4 py-1.5 mb-6">
            <Radar size={14} className="text-purple-300" />
            <span className="text-xs font-semibold text-purple-200 uppercase tracking-wider">Radar 360°</span>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl font-extrabold mb-6 max-w-4xl leading-tight">
            Transforme conversas em <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">decisões de negócio</span>.
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mb-8 leading-relaxed">
            Radar 360° é o produto de BI conversacional da ZappIQ. Não é dashboard bonito engavetado — é inteligência que vira margem e crescimento. Descubra onde seus leads caem, que agente converte mais, que palavra prevê cancelamento.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="#precos"
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold px-7 py-4 rounded-xl hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2">
              Ver preços e adicionar ao plano <ArrowRight size={18} />
            </Link>
            <Link href="/demo?produto=radar"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2">
              Ver demonstração
            </Link>
          </div>

          {/* Value Preview */}
          <div className="mt-14 pt-10 border-t border-white/10 max-w-3xl">
            <p className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-4">O que você descobre no primeiro mês</p>
            <ul className="space-y-3">
              {VALUE_POINTS.map((v) => (
                <li key={v} className="flex items-start gap-3 text-gray-300">
                  <Sparkles size={16} className="text-purple-400 flex-shrink-0 mt-1" />
                  <span className="leading-relaxed">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Para quem / por que importa */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">Por que observabilidade importa</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-5">
              Sua operação de WhatsApp gera dados. A pergunta é: você está usando?
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
              A maioria das empresas usa WhatsApp como canal de atendimento. As que crescem tratam WhatsApp como fonte de inteligência. Radar 360° é a infraestrutura que faz essa travessia — sem precisar contratar time de BI.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
              <div className="text-4xl font-extrabold text-gray-900 mb-2">R$ 8k–15k</div>
              <p className="text-sm text-gray-600 leading-relaxed">Custo mensal de um analista sênior de BI. Radar 360° entrega 20–30h/mês de trabalho analítico equivalente por R$197–397.</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
              <div className="text-4xl font-extrabold text-purple-700 mb-2">7%–22%</div>
              <p className="text-sm text-gray-600 leading-relaxed">Aumento médio de conversão observado em clientes que passam a usar dados de BI conversacional para ajustar scripts e horários.</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
              <div className="text-4xl font-extrabold text-amber-700 mb-2">&lt;30 dias</div>
              <p className="text-sm text-gray-600 leading-relaxed">Payback típico do Radar 360°. Um ajuste de horário ou template pago pelo insight geralmente cobre o add-on do ano.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">Funcionalidades</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              9 módulos. Um só produto.
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Tudo integrado à sua operação ZappIQ. Sem ETL, sem conector externo, sem lag. Dados em tempo real.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.accent} flex items-center justify-center mb-4`}>
                  <f.icon size={22} className="text-white" />
                </div>
                <h3 className="font-display font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">Preços</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Adicione ao seu plano ou vá direto de Enterprise
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Radar 360° é add-on opcional dos planos Starter, Growth e Scale. Incluso por padrão no plano Enterprise.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-50 px-6 py-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-4">Plano base</div>
              <div className="col-span-3 text-right">Base</div>
              <div className="col-span-3 text-right">+ Radar 360°</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            {PRICING_TIERS.map((t) => (
              <div key={t.plan} className="grid grid-cols-12 px-6 py-5 items-center border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                <div className="col-span-4 font-semibold text-gray-900 flex items-center gap-2">
                  {t.plan}
                  {t.badge && (
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                      {t.badge}
                    </span>
                  )}
                </div>
                <div className="col-span-3 text-right text-gray-600">R$ {t.base.toLocaleString('pt-BR')}/mês</div>
                <div className="col-span-3 text-right">
                  {t.radar === 0 ? (
                    <span className="text-emerald-600 font-semibold">Incluso</span>
                  ) : (
                    <span className="text-purple-700 font-semibold">+R$ {t.radar}/mês</span>
                  )}
                </div>
                <div className="col-span-2 text-right font-extrabold text-gray-900">
                  R$ {(t.base + t.radar).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            Preços mensais. Disponível em contrato anual com 20% de desconto. Trial gratuito de 14 dias.
          </p>
        </div>
      </section>

      {/* Why Enterprise inclui */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Sparkles size={40} className="mx-auto mb-5 text-amber-400" />
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold mb-5">
            Por que Radar 360° vem incluído no Enterprise?
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed mb-8">
            Operação estratégica não pode depender de achismo. Enterprise é quem trata WhatsApp como canal crítico — e canal crítico exige BI em tempo real para suporte à decisão do board. Radar 360° é parte indissociável da proposta de valor Enterprise.
          </p>
          <Link href="/enterprise"
            className="bg-amber-400 text-gray-900 font-semibold px-7 py-4 rounded-xl hover:bg-amber-300 transition-colors inline-flex items-center gap-2">
            Conhecer o plano Enterprise <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold mb-5">
            Pronto pra parar de tomar decisão no achismo?
          </h2>
          <p className="text-purple-100 mb-8 max-w-2xl mx-auto">
            Teste Radar 360° por 14 dias sem custo. Se não entregar insight acionável na primeira semana, cancele sem perguntar nada.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/onboarding?addon=radar"
              className="bg-white text-purple-700 font-semibold px-7 py-4 rounded-xl hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-2">
              Começar trial de 14 dias <ArrowRight size={18} />
            </Link>
            <Link href="/demo?produto=radar"
              className="border border-white/40 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-2">
              Ver demonstração
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
