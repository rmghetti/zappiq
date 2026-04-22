import Link from 'next/link';
import { PublicLayout } from '@/components/landing/PublicLayout';
import {
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  Calendar,
  Sparkles,
  AlertCircle,
  FileText,
  TrendingUp,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════════
 * /garantia — Garantia 60 dias ZappIQ V3.2
 * --------------------------------------------------------------------------
 * Contrato explícito da Garantia 60d: 30 dias de trial gratuito + 60 dias de
 * garantia contratual com 3 KPIs alvo definidos em onboarding. Se no final
 * do 4º mês (30d trial + 60d garantia) o cliente não bater pelo menos 2 de 3
 * KPIs por causa documentada do produto, recebe crédito proporcional ou
 * refund integral da mensalidade já paga desde o fim do trial.
 *
 * Owner operacional: a definir (BLOCKER #32). Por enquanto, responsável é
 * o CSM da conta mais Head de Vendas. Crédito/refund é operado pelo
 * Financeiro com nota fiscal complementar.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Garantia de 60 dias — ZappIQ V3.2',
  description:
    '30 dias grátis para testar. Mais 60 dias de garantia contratual com KPIs alvo acordados no onboarding. Se não performar, devolvemos o dinheiro.',
};

const PILLARS = [
  {
    icon: Calendar,
    title: '30 dias grátis. Cartão não obrigatório no início.',
    body:
      'Cadastro → conecta WhatsApp → IA responde em até 60 minutos. Você só cadastra método de pagamento ao final do trial, se decidir continuar.',
  },
  {
    icon: Shield,
    title: '60 dias de garantia contratual. Não é promessa de marketing.',
    body:
      'Após os 30 dias grátis, os próximos 60 dias são cobertos pelo Acordo KPI Garantia 60d. Se não bater os KPIs acordados, você recebe crédito ou refund — documentado em contrato.',
  },
  {
    icon: CheckCircle,
    title: '3 KPIs definidos no onboarding. Sem letra miúda.',
    body:
      'Tempo de 1ª resposta, taxa de resolução sem handoff humano e CSAT. Os alvos são calibrados com você na primeira semana, com base na sua vertical e volume real.',
  },
];

const KPIS_VERTICALS = [
  {
    name: 'Serviços locais / SaaS B2C',
    tempoResposta: '≤ 3 min (IA)',
    resolucaoSemHandoff: '≥ 55%',
    csat: '≥ 4,3 / 5,0',
  },
  {
    name: 'E-commerce / varejo',
    tempoResposta: '≤ 2 min (IA)',
    resolucaoSemHandoff: '≥ 60%',
    csat: '≥ 4,2 / 5,0',
  },
  {
    name: 'Saúde / clínicas',
    tempoResposta: '≤ 5 min (IA) · 15 min (humano)',
    resolucaoSemHandoff: '≥ 45%',
    csat: '≥ 4,5 / 5,0',
  },
  {
    name: 'Educação / cursos',
    tempoResposta: '≤ 4 min (IA)',
    resolucaoSemHandoff: '≥ 50%',
    csat: '≥ 4,3 / 5,0',
  },
  {
    name: 'Serviços financeiros / crédito',
    tempoResposta: '≤ 5 min (IA)',
    resolucaoSemHandoff: '≥ 40%',
    csat: '≥ 4,4 / 5,0',
  },
];

const FLOW_STEPS = [
  {
    phase: 'Dia 0',
    title: 'Cadastro e conexão',
    body:
      'Survey Onboarding Zero (30–90 min), conexão WhatsApp Cloud API oficial, importação da base de conhecimento. Zero setup fee.',
  },
  {
    phase: 'Dias 1–7',
    title: 'Calibração + 1ª conversa real',
    body:
      'CSM calibra os 3 KPIs alvo com você baseado na vertical. Base de conhecimento é revisada. IA começa a responder clientes reais no dia 1.',
  },
  {
    phase: 'Dias 8–30',
    title: 'Trial gratuito',
    body:
      'Período de teste sem compromisso. Sem cobrança. Relatório semanal de KPIs no dashboard. Ao final, você decide continuar ou cancelar com 1 clique.',
  },
  {
    phase: 'Dias 31–90',
    title: 'Garantia 60d ativa',
    body:
      'Cobrança da mensalidade inicia. Monitoramos os 3 KPIs semanalmente. Se no dia 90 você não atingiu ao menos 2 de 3 KPIs acordados, ativamos o refund.',
  },
  {
    phase: 'Dia 91+',
    title: 'Cliente ativo ou refund',
    body:
      'Se KPIs ok: segue como cliente normal, com Radar 360° ativo (se Business+) e relatório mensal. Se KPIs não ok e causa é documentadamente do produto: refund integral das 2 mensalidades pagas.',
  },
];

const FAIR_USE = [
  'A garantia cobre a mensalidade recorrente (Starter/Growth/Scale/Business). Add-ons (Radar 360°, Voz Outbound, broadcasts extras) não são refundados — o add-on já foi entregue.',
  'Causa raiz da falha precisa ser atribuível ao produto (bug, limitação, deficiência). Se a causa for base de conhecimento incompleta que o cliente recusou atualizar, OU volume muito fora do plano contratado, OU uso indevido (ex.: envio de cold outbound sem consentimento), a garantia não se aplica.',
  'A decisão de aplicar refund ou crédito é do ZappIQ após análise do log do tenant e das conversas. Prazo de análise: até 15 dias corridos após fim do dia 90.',
  'Refund é integral em R$ para mensalidades já pagas entre dia 30 e dia 90. Trial (dias 0–30) é gratuito, não há o que reembolsar.',
  'A garantia não se aplica a contratos Enterprise com condições negociadas fora do padrão V3.2 (estes têm SLA formal no contrato).',
  'Cliente pode cancelar a qualquer momento dentro do trial com 1 clique, sem obrigação e sem justificativa.',
];

export default function GarantiaPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 via-primary-900 to-gray-900 pt-20 pb-24 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(37,211,102,0.15),_transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="inline-flex items-center gap-2 bg-primary-400/10 border border-primary-400/30 rounded-full px-4 py-1.5 mb-6">
            <Shield size={14} className="text-primary-300" />
            <span className="text-xs font-semibold text-primary-200 uppercase tracking-wider">
              Garantia contratual V3.2
            </span>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl font-extrabold mb-6 max-w-4xl leading-tight">
            30 dias grátis.
            <br />
            Mais <span className="text-primary-400">60 dias de garantia.</span>
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mb-8 leading-relaxed">
            Se no fim do 4º mês os KPIs acordados não estiverem batidos por causa atribuível ao produto,
            devolvemos o dinheiro. Isso está no contrato — não é promessa de marketing.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="bg-primary-400 text-gray-900 font-semibold px-7 py-4 rounded-xl hover:bg-primary-300 transition-colors inline-flex items-center justify-center gap-2"
            >
              Começar 30 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="#como-funciona"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2"
            >
              Como funciona a garantia
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 pt-10 border-t border-white/10">
            {[
              { value: '30d', label: 'Grátis no início' },
              { value: '60d', label: 'Garantia contratual' },
              { value: '3 KPIs', label: 'Alvo no onboarding' },
              { value: '1 clique', label: 'Cancelamento a qualquer momento' },
            ].map((kpi) => (
              <div key={kpi.label}>
                <div className="text-3xl lg:text-4xl font-extrabold text-primary-400 mb-1">{kpi.value}</div>
                <div className="text-xs text-gray-400">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 pilares */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              Três pilares, zero letra miúda
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">
              O que exatamente está coberto
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-7 hover:border-primary-200 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-5">
                  <p.icon size={22} className="text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-gray-900 mb-2">{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Linha do tempo */}
      <section id="como-funciona" className="py-20 bg-[#F8FAF9]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              Linha do tempo
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">
              Como funciona na prática, dia a dia
            </h2>
          </div>
          <ol className="relative border-l-2 border-primary-200 ml-4 space-y-10">
            {FLOW_STEPS.map((s, i) => (
              <li key={s.phase} className="pl-8">
                <div className="absolute -left-3 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-[11px] font-bold text-white">
                  {i + 1}
                </div>
                <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                  {s.phase}
                </p>
                <h3 className="font-display text-lg font-bold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* KPIs por vertical */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              KPIs alvo de referência
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
              Seus 3 KPIs, calibrados por vertical
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Valores de referência — o alvo real é calibrado com seu CSM na primeira semana, com base
              em volume real, sazonalidade e complexidade da base de conhecimento.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold">Vertical</th>
                  <th className="text-left px-6 py-4 font-semibold">Tempo de 1ª resposta</th>
                  <th className="text-left px-6 py-4 font-semibold">Resolução sem handoff</th>
                  <th className="text-left px-6 py-4 font-semibold">CSAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {KPIS_VERTICALS.map((row) => (
                  <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{row.name}</td>
                    <td className="px-6 py-4 text-gray-700">{row.tempoResposta}</td>
                    <td className="px-6 py-4 text-gray-700">{row.resolucaoSemHandoff}</td>
                    <td className="px-6 py-4 text-gray-700">{row.csat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Referência interna de baseline ZappIQ. Alvo contratual é registrado no Acordo KPI assinado
            em onboarding e pode ser renegociado antes do dia 30.
          </p>
        </div>
      </section>

      {/* Fair use */}
      <section className="py-20 bg-amber-50/50 border-y border-amber-200/60">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-start gap-3 mb-6">
            <AlertCircle size={22} className="text-amber-700 mt-1 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                Transparência — o que a garantia NÃO cobre
              </p>
              <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-gray-900">
                Limites explícitos da garantia
              </h2>
            </div>
          </div>
          <ul className="space-y-3">
            {FAIR_USE.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 pt-6 border-t border-amber-200/60">
            <Link
              href="/legal/fair-use"
              className="text-sm font-semibold text-amber-900 hover:text-amber-700 inline-flex items-center gap-1"
            >
              Ler fair-use completo e limites técnicos <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-6">
            <Sparkles size={14} className="text-primary-600" />
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">
              Pronto para testar com garantia?
            </span>
          </div>
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-gray-900 mb-4">
            Comece hoje com 30 dias grátis.
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Sem setup fee, sem cartão de crédito no início, cancelamento em 1 clique. Se passar do trial e
            os KPIs não baterem, devolvemos o dinheiro.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-primary-500 hover:bg-primary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"
            >
              Começar 30 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="/contato"
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              Falar com especialista
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
