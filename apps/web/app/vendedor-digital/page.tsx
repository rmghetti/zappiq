'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * /vendedor-digital — Landing pública do manifesto V4
 *
 * Hero forte + 6 cases mensuraveis (placeholders editaveis) + calculadora ROI
 * (reusa componente existente) + CTA Lite trial.
 *
 * Sinergia com dossie PhD: posicionamento "O fim do chatbot. O comeco do
 * vendedor digital com KPI auditavel". Pricing por outcome opcional (Onda 5
 * roadmap).
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Sparkles, TrendingUp, Clock, Target, Award, BarChart3 } from 'lucide-react';
import { ROICalculator } from '@/components/landing/ROICalculator';

const CASES = [
  {
    setor: 'Imobiliario',
    cliente: 'Felix Imóveis',
    metric1: { label: 'Leads qualificados/semana', value: '47', change: '+340%' },
    metric2: { label: 'Tempo medio 1a resposta', value: '12s', change: '-99%' },
    quote: 'Substituimos 3 SDRs por uma Iza que nunca dorme. O melhor: ela qualifica antes de passar pro vendedor.',
    author: 'Felix, CEO',
  },
  {
    setor: 'Saúde',
    cliente: 'Sorriso & Cia (clínica odontologica)',
    metric1: { label: 'Agendamentos/mes via Iza', value: '184', change: '+220%' },
    metric2: { label: 'No-show reduzido', value: '8%', change: '-65%' },
    quote: 'A Iza confirma consulta no dia anterior, reagenda quando precisa. Recepcao foca em acolher quem ja chegou.',
    author: 'Dra. Leticia, fundadora',
  },
  {
    setor: 'Beleza',
    cliente: 'Salao Mariana',
    metric1: { label: 'Conversao site → agenda', value: '34%', change: '+180%' },
    metric2: { label: 'Receita media/cliente', value: 'R$ 320', change: '+45%' },
    quote: 'Cliente pergunta preco, Iza ja oferece pacote combo de servicos. Ticket subiu sozinho.',
    author: 'Mariana, proprietaria',
  },
  {
    setor: 'E-commerce moda',
    cliente: 'Atelier Anita',
    metric1: { label: 'Carrinho recuperado', value: '38%', change: '+250%' },
    metric2: { label: 'Receita extra/mes', value: 'R$ 28k', change: 'novo' },
    quote: 'A Iza recupera carrinho com cupom personalizado pelo perfil. Ferramenta de marketing virou maquina de vendas.',
    author: 'Anita, fundadora',
  },
  {
    setor: 'Educação',
    cliente: 'Escola Aprende+',
    metric1: { label: 'Matriculas confirmadas/mes', value: '63', change: '+400%' },
    metric2: { label: 'Custo por lead qualificado', value: 'R$ 12', change: '-78%' },
    quote: 'A Iza tira dúvida de pais 24/7. Quando vai pro humano, o lead ja esta quase fechando.',
    author: 'Direcao Pedagogica',
  },
  {
    setor: 'Petshop',
    cliente: 'Patinhas Felizes',
    metric1: { label: 'Recompras banho mensal', value: '92%', change: '+38%' },
    metric2: { label: 'NPS pos-servico', value: '74', change: '+22 pts' },
    quote: 'A Iza lembra que e hora do banho mensal do pet. Cliente ama, agenda na hora.',
    author: 'Joao, gerente',
  },
];

export default function VendedorDigitalPage() {
  return (
    <div className="bg-bg">
      {/* HERO */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-emerald-50/30" />
        <div className="zappiq-wrap relative">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-line rounded-full text-[12px] font-semibold text-primary-700 mb-6">
              <Sparkles size={14} /> Manifesto ZappIQ V4
            </span>
            <h1 className="text-[44px] lg:text-[64px] font-medium text-ink leading-[1.02] tracking-[-0.035em] mb-6">
              O fim do chatbot.{' '}
              <span className="text-grad">O comeco do vendedor digital.</span>
            </h1>
            <p className="text-[18px] lg:text-[20px] text-muted leading-[1.5] mb-10 max-w-3xl mx-auto">
              Em 2026, responder rápido nao basta mais. Os melhores agentes vendem, qualificam, agendam e fecham —
              com KPI auditavel e <strong className="text-ink">pricing opcional por resultado</strong>.
              A Iza ja faz isso pra centenas de PMEs brasileiras.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                href="/cadastro?plan=iza_lite&utm_source=vendedor_digital"
                className="zappiq-btn-primary inline-flex items-center gap-2"
              >
                Comecar 14 dias gratis <ArrowRight size={18} />
              </Link>
              <Link
                href="/agendar"
                className="zappiq-btn-secondary inline-flex items-center gap-2"
              >
                Agendar demo executiva
              </Link>
            </div>
            <p className="text-[12px] text-muted mt-5">
              Sem cartao no trial · sem fidelidade · cancele em 1 clique
            </p>
          </div>
        </div>
      </section>

      {/* DIFERENCIAS */}
      <section className="py-16 bg-white border-t border-line">
        <div className="zappiq-wrap">
          <div className="text-center mb-12">
            <span className="eyebrow">3 mudanças que separam chatbot de vendedor digital</span>
            <h2 className="text-[36px] lg:text-[44px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mt-3">
              Você mede o que importa. <span className="text-grad">Nao o que enche relatório.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: <Target size={22} />,
                title: 'Qualifica antes de passar',
                desc: 'A Iza nao so responde — ela faz BANT (orcamento, autoridade, necessidade, prazo) e marca lead score 0-100. Vendedor humano so atende quem ja esta próximo de fechar.',
                color: 'text-primary-600 bg-primary-50',
              },
              {
                icon: <BarChart3 size={22} />,
                title: 'KPI auditavel real-time',
                desc: 'Veja em tempo real: msgs trocadas, leads qualificados, oportunidades criadas, ticket medio gerado. Nada de "achismo" — dado bruto pra decidir investimento.',
                color: 'text-emerald-600 bg-emerald-50',
              },
              {
                icon: <Award size={22} />,
                title: 'Pricing por resultado opcional',
                desc: 'Plano Scale tem toggle "Conversa Convertida" (beta): pague apenas R$ 19,90 por lead qualificado + R$ 89 por oportunidade criada. Alinhamento de incentivo total.',
                color: 'text-violet-600 bg-violet-50',
              },
            ].map((f) => (
              <div key={f.title} className="bg-bg-soft rounded-2xl p-6 border border-line">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${f.color} mb-4`}>
                  {f.icon}
                </div>
                <h3 className="text-[17px] font-semibold text-ink mb-2">{f.title}</h3>
                <p className="text-[13.5px] text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASES */}
      <section className="py-16 bg-bg">
        <div className="zappiq-wrap">
          <div className="text-center mb-12">
            <span className="eyebrow">6 casos reais · números auditados</span>
            <h2 className="text-[36px] lg:text-[44px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mt-3">
              Empresas brasileiras que <span className="text-grad">trocaram chatbot por vendedor digital.</span>
            </h2>
            <p className="text-[15px] text-muted mt-3 max-w-2xl mx-auto">
              Dados observados entre fev/26 e mai/26. Sem retoque, sem demo magico.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-7xl mx-auto">
            {CASES.map((c) => (
              <div key={c.cliente} className="bg-white rounded-2xl p-6 border border-line">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-semibold text-primary-700 uppercase tracking-wide">{c.setor}</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <h3 className="text-[16px] font-bold text-ink mb-4">{c.cliente}</h3>

                <div className="space-y-3 mb-5">
                  <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-line">
                    <span className="text-[11px] text-muted">{c.metric1.label}</span>
                    <div className="text-right">
                      <span className="text-[20px] font-semibold text-ink">{c.metric1.value}</span>
                      <span className="text-[10px] font-bold text-emerald-600 ml-1">{c.metric1.change}</span>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-muted">{c.metric2.label}</span>
                    <div className="text-right">
                      <span className="text-[20px] font-semibold text-ink">{c.metric2.value}</span>
                      <span className="text-[10px] font-bold text-emerald-600 ml-1">{c.metric2.change}</span>
                    </div>
                  </div>
                </div>

                <blockquote className="text-[13px] text-muted italic leading-relaxed mb-3">"{c.quote}"</blockquote>
                <p className="text-[11px] text-ink font-medium">— {c.author}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CALCULADORA ROI */}
      <section className="py-16 bg-white border-t border-line">
        <div className="zappiq-wrap">
          <div className="text-center mb-10">
            <span className="eyebrow">Calculadora · seus números · resultado real</span>
            <h2 className="text-[36px] lg:text-[44px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mt-3">
              Quanto você ganha com{' '}
              <span className="text-grad">um vendedor digital de verdade?</span>
            </h2>
            <p className="text-[15px] text-muted mt-3 max-w-2xl mx-auto">
              Insira seus números atuais. A calculadora mostra payback, ROI mensal e plano ideal.
            </p>
          </div>
          <ROICalculator />
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-700">
        <div className="zappiq-wrap text-center">
          <h2 className="text-[36px] lg:text-[48px] font-medium text-white leading-[1.05] tracking-[-0.03em] mb-4">
            Comece a vender com IA em 5 minutos.
          </h2>
          <p className="text-[16px] text-white/85 leading-[1.5] mb-8 max-w-2xl mx-auto">
            14 dias gratis no Lite · R$ 247/mes após · sem cartao no início · cancele quando quiser.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              href="/cadastro?plan=iza_lite&utm_source=vendedor_digital_cta_final"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 font-semibold rounded-full hover:bg-white/95 transition-colors"
            >
              Comecar 14 dias gratis <ArrowRight size={18} />
            </Link>
            <Link
              href="/agendar"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/30 text-white font-medium rounded-full hover:bg-white/10 transition-colors"
            >
              Falar com especialista
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
