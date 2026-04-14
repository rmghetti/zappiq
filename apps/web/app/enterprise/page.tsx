import Link from 'next/link';
import { PublicLayout } from '@/components/landing/PublicLayout';
import {
  Shield, Activity, Radar, Users, Headphones, FileCheck, Zap,
  Award, Building2, ArrowRight, Check, Sparkles, Lock
} from 'lucide-react';

export const metadata = {
  title: 'ZappIQ Enterprise — Plano premium com SLA 99,9% e LGPD auditável',
  description: 'Operações estratégicas exigem SLA contratual, observabilidade profunda e conformidade auditável. ZappIQ Enterprise entrega tudo isso com SOC/NOC dedicado 24/7.',
};

const FEATURES_BLOCKS = [
  {
    icon: Activity,
    accent: 'from-amber-500 to-orange-500',
    title: 'SLA contratual 99,9%',
    desc: 'Uptime garantido com créditos automáticos. Relatório mensal de disponibilidade. RPO 1h e RTO 4h documentados em contrato.',
  },
  {
    icon: Radar,
    accent: 'from-purple-600 to-indigo-600',
    title: 'Radar 360° incluído',
    desc: 'Observabilidade de negócio com BI, previsão de pipeline por ML e benchmarking. Valor equivalente a R$ 397/mês — incluso no plano.',
  },
  {
    icon: Headphones,
    accent: 'from-emerald-500 to-teal-600',
    title: 'SOC/NOC dedicado 24/7',
    desc: 'Time técnico monitorando sua operação em tempo real, não só nossa infraestrutura. Escalation direto para engenharia em P1/P2.',
  },
  {
    icon: Users,
    accent: 'from-sky-500 to-blue-600',
    title: 'Gerente de Sucesso dedicado',
    desc: 'Cadência semanal nos primeiros 3 meses, QBRs trimestrais, acesso a roadmap e influência em priorização.',
  },
  {
    icon: Shield,
    accent: 'from-rose-500 to-pink-600',
    title: 'LGPD Enterprise',
    desc: 'Contato direto com DPO, ROP customizado, SLA de 48h para DSR, DPA contratado, auditoria anual com certificado.',
  },
  {
    icon: FileCheck,
    accent: 'from-slate-600 to-gray-800',
    title: 'Retenção customizada',
    desc: 'Logs de auditoria até 5 anos (setores regulados). Backup customizado. PITR dedicado. Isolamento de infraestrutura.',
  },
  {
    icon: Zap,
    accent: 'from-yellow-400 to-amber-500',
    title: 'Integrações sob medida',
    desc: 'Até 40h/mês de desenvolvimento customizado inclusas. ERPs legados, webhooks com retry customizado, SSO (SAML 2.0 / OIDC).',
  },
  {
    icon: Award,
    accent: 'from-cyan-500 to-sky-600',
    title: 'Onboarding white-glove',
    desc: 'Project Manager + Arquiteto de Soluções dedicados por 30 dias. Treinamento para até 20 colaboradores. Go-live assistido.',
  },
];

const WHO_ITS_FOR = [
  'Operações com mais de 50 colaboradores',
  'Empresas com áreas de compliance ativas',
  'Volume acima de 5.000 conversas/mês',
  'Múltiplas unidades, marcas ou filiais',
  'Setores regulados: financeiro, saúde, educação, jurídico',
  'Operações que exigem DPO interno ou terceirizado',
];

const PRICING_TABLE = [
  { item: 'Base mensal', value: 'R$ 2.997/mês' },
  { item: 'Setup fee (one-time)', value: 'R$ 9.997 — isento em contrato anual' },
  { item: 'Desconto anual', value: '15% (R$ 30.567/ano)' },
  { item: 'Desconto 2 anos', value: '25% (R$ 53.946 total)' },
  { item: 'Dev customizado extra', value: 'R$ 250/hora após 40h/mês inclusas' },
  { item: 'Treinamento adicional', value: 'R$ 2.500/dia' },
];

export default function EnterprisePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pt-32 pb-20 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(245,158,11,0.15),_transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-1.5 mb-6">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">ZappIQ Enterprise</span>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl font-extrabold mb-6 max-w-4xl leading-tight">
            Quando o WhatsApp vira <span className="text-amber-400">infraestrutura crítica</span> da sua operação.
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mb-8 leading-relaxed">
            Para empresas que não podem parar, precisam responder pra auditoria e tratam conversação como canal estratégico. SLA contratual, observabilidade profunda, SOC/NOC dedicado e conformidade LGPD auditável — em uma plataforma única.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="#falar-com-especialista"
              className="bg-amber-400 text-gray-900 font-semibold px-7 py-4 rounded-xl hover:bg-amber-300 transition-colors inline-flex items-center justify-center gap-2">
              Falar com especialista <ArrowRight size={18} />
            </Link>
            <Link href="/demo"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2">
              Ver demonstração
            </Link>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 pt-10 border-t border-white/10">
            {[
              { value: '99,9%', label: 'SLA contratual' },
              { value: '24/7', label: 'SOC/NOC dedicado' },
              { value: '4h', label: 'RTO em disaster recovery' },
              { value: '5 anos', label: 'Retenção de logs' },
            ].map((kpi) => (
              <div key={kpi.label}>
                <div className="text-3xl lg:text-4xl font-extrabold text-amber-400 mb-1">{kpi.value}</div>
                <div className="text-xs text-gray-400">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">O que inclui</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Tudo ilimitado. E muito mais.
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Enterprise inclui tudo do Scale sem limites — e soma camadas de serviço, conformidade e observabilidade que operações estratégicas exigem.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES_BLOCKS.map((f) => (
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

      {/* Para quem é */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Para quem é</p>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-5">
                Para quem trata WhatsApp como canal estratégico
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Enterprise é pra operações em que uma hora de indisponibilidade custa caro, o compliance cobra todo trimestre e a diretoria quer dashboards que virem decisão — não relatório engavetado.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-7">
              <h3 className="font-display font-bold text-gray-900 mb-5 flex items-center gap-2">
                <Building2 size={20} className="text-primary-600" /> Perfil ideal
              </h3>
              <ul className="space-y-3">
                {WHO_ITS_FOR.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing detalhado */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Investimento</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Preço transparente. Contrato sob medida.
            </h2>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 lg:p-10 text-white mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-amber-400" />
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">A partir de</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-6xl font-extrabold text-white">R$ 2.997</span>
              <span className="text-xl text-gray-400">/mês</span>
            </div>
            <p className="text-sm text-gray-400">Customizado conforme volume, integrações e necessidades de conformidade.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {PRICING_TABLE.map((row, i) => (
              <div key={row.item} className={`flex items-center justify-between px-6 py-4 ${i !== 0 ? 'border-t border-gray-100' : ''}`}>
                <span className="text-sm text-gray-600">{row.item}</span>
                <span className="text-sm font-semibold text-gray-900">{row.value}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            Payback típico: 30–90 dias, considerando substituição de atendentes + redução de perda de leads + ganho de conversão via Radar 360°.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section id="falar-com-especialista" className="py-20 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Lock size={40} className="mx-auto mb-5 text-primary-200" />
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold mb-4">
            Pronto para elevar sua operação?
          </h2>
          <p className="text-primary-100 mb-8 max-w-2xl mx-auto">
            Agende uma conversa de 30 minutos com nosso time de especialistas. Sem custo, sem compromisso. Saímos com uma proposta customizada pro seu cenário.
          </p>
          <Link href="/demo?plano=enterprise"
            className="bg-amber-400 text-gray-900 font-semibold px-8 py-4 rounded-xl hover:bg-amber-300 transition-colors inline-flex items-center gap-2">
            Agendar conversa com especialista <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-primary-200 mt-5">
            Resposta em até 4 horas úteis · NDA disponível sob solicitação
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
