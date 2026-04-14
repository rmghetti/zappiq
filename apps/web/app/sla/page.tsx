import Link from 'next/link';
import { PublicLayout } from '@/components/landing/PublicLayout';
import { Activity, Clock, Shield, TrendingDown, Zap, FileText, ArrowRight, Check, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'SLA — Disponibilidade e Garantias Contratuais | ZappIQ',
  description: 'SLA formal 99,9% de uptime no plano Enterprise. Créditos automáticos por descumprimento. RPO 1h, RTO 4h. Transparência total de disponibilidade.',
};

const SLA_TABLE = [
  { plan: 'Starter', uptime: 'Best effort', credits: '—', rpo: '24h', rto: '24h' },
  { plan: 'Growth', uptime: 'Best effort', credits: '—', rpo: '24h', rto: '24h' },
  { plan: 'Scale', uptime: '99,5% alvo', credits: '—', rpo: '4h', rto: '8h' },
  { plan: 'Enterprise', uptime: '99,9% contratual', credits: 'Sim', rpo: '1h', rto: '4h' },
];

const CREDIT_TIERS = [
  { uptime: '< 99,9% e ≥ 99,0%', credit: '10% da mensalidade' },
  { uptime: '< 99,0% e ≥ 95,0%', credit: '25% da mensalidade' },
  { uptime: '< 95,0%', credit: '50% da mensalidade' },
];

const EXCLUSIONS = [
  'Manutenção programada (anunciada com 7 dias de antecedência)',
  'Indisponibilidade de integrações de terceiros (WhatsApp/Meta, gateways de pagamento) fora do controle ZappIQ',
  'Eventos de força maior (desastre natural, ataque massivo de DDoS em escala regional)',
  'Uso em violação dos Termos de Uso ou políticas aceitáveis',
  'Problemas causados pelo cliente (configuração errada, dados corrompidos)',
];

export default function SLAPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-800 via-orange-900 to-gray-900 pt-20 pb-24 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(251,191,36,0.15),_transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-1.5 mb-6">
            <Activity size={14} className="text-amber-300" />
            <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider">SLA — Service Level Agreement</span>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl font-extrabold mb-6 max-w-4xl leading-tight">
            <span className="text-amber-400">99,9%</span> de uptime, formalmente contratado.
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mb-8 leading-relaxed">
            No plano Enterprise, nosso SLA é contratual, não promessa de marketing. Uptime mensurado em tempo real, relatório público mensal e créditos automáticos em caso de descumprimento. Transparência total.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="#termos"
              className="bg-amber-400 text-gray-900 font-semibold px-7 py-4 rounded-xl hover:bg-amber-300 transition-colors inline-flex items-center justify-center gap-2">
              Ver termos do SLA <ArrowRight size={18} />
            </Link>
            <Link href="https://status.zappiq.com.br"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2">
              Status em tempo real
            </Link>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 pt-10 border-t border-white/10">
            {[
              { value: '99,9%', label: 'Uptime Enterprise' },
              { value: '1h', label: 'RPO — Recovery Point' },
              { value: '4h', label: 'RTO — Recovery Time' },
              { value: '72h', label: 'Notificação de incidente' },
            ].map((kpi) => (
              <div key={kpi.label}>
                <div className="text-3xl lg:text-4xl font-extrabold text-amber-400 mb-1">{kpi.value}</div>
                <div className="text-xs text-gray-400">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O que é SLA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-3">O que significa na prática</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-6">
            99,9% de uptime é muito? É pouco? Depende.
          </h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              <strong>99,9% de disponibilidade</strong> significa no máximo <strong>~43 minutos de indisponibilidade por mês</strong>. Parece pouco? Para uma operação enxuta, é aceitável. Para uma operação onde WhatsApp é canal crítico de vendas e atendimento, pode ser caro.
            </p>
            <p>
              Por isso o SLA Enterprise é contratual: se a gente passar desses 43 minutos, você recebe crédito proporcional automaticamente, sem precisar abrir ticket nem negociar.
            </p>
            <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded">
              <p className="font-semibold text-amber-900 mb-2">RPO e RTO — o que ninguém te conta</p>
              <p className="text-amber-900 text-sm">
                <strong>RPO (Recovery Point Objective):</strong> quanto de dado sua empresa pode perder em um disaster recovery. No Enterprise, no máximo 1h. Traduzindo: se acontecer o pior, você perde no máximo 1 hora de conversas.
                <br /><br />
                <strong>RTO (Recovery Time Objective):</strong> em quanto tempo voltamos ao ar. No Enterprise, 4h. Comparação: a maioria dos concorrentes promete SLA mas não documenta RPO/RTO — e isso é o que realmente importa em incidente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabela de SLA por plano */}
      <section id="termos" className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-3">SLA por plano</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Garantias por nível de serviço
            </h2>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-900 text-white px-6 py-4 text-xs font-semibold uppercase tracking-wider">
              <div className="col-span-3">Plano</div>
              <div className="col-span-3">Uptime</div>
              <div className="col-span-2">Créditos</div>
              <div className="col-span-2">RPO</div>
              <div className="col-span-2">RTO</div>
            </div>
            {SLA_TABLE.map((row, i) => (
              <div key={row.plan} className={`grid grid-cols-12 px-6 py-5 items-center border-b border-gray-100 last:border-b-0 ${row.plan === 'Enterprise' ? 'bg-gradient-to-r from-amber-50 to-orange-50' : ''}`}>
                <div className="col-span-3 font-semibold text-gray-900 flex items-center gap-2">
                  {row.plan}
                  {row.plan === 'Enterprise' && (
                    <span className="bg-amber-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">Contratual</span>
                  )}
                </div>
                <div className="col-span-3 text-sm text-gray-700">{row.uptime}</div>
                <div className="col-span-2 text-sm text-gray-700">{row.credits}</div>
                <div className="col-span-2 text-sm text-gray-700">{row.rpo}</div>
                <div className="col-span-2 text-sm text-gray-700">{row.rto}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Créditos */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-3">Créditos (Enterprise)</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Se a gente falhar, paga
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Créditos são aplicados automaticamente na fatura do mês seguinte. Sem ticket, sem conversa, sem justificativa necessária.
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-8">
            {CREDIT_TIERS.map((t, i) => (
              <div key={t.uptime} className={`flex items-center justify-between py-4 ${i !== 0 ? 'border-t border-amber-200' : ''}`}>
                <div className="flex items-center gap-3">
                  <TrendingDown size={20} className="text-amber-700" />
                  <span className="font-semibold text-gray-900">Uptime {t.uptime}</span>
                </div>
                <span className="text-2xl font-extrabold text-amber-700">{t.credit}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Créditos limitados a 50% da mensalidade do mês afetado. Não substituem resolução do incidente nem indenização por danos indiretos.
          </p>
        </div>
      </section>

      {/* Como medimos */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-3">Como medimos</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Transparência de ponta a ponta
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <Activity size={32} className="text-amber-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Monitoramento contínuo</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Healthchecks automatizados a cada 15 segundos em múltiplas regiões. Se a nossa API não responder 200 OK em dois checks consecutivos, já conta como downtime.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <FileText size={32} className="text-amber-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Relatório mensal público</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Publicamos uptime do mês no primeiro dia útil seguinte em status.zappiq.com.br. Número público, verificável, sem maquiagem.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <Zap size={32} className="text-amber-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Postmortem público</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Incidentes significativos recebem postmortem público em até 72h: o que aconteceu, impacto, causa raiz, ações de prevenção.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Exclusões */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-3">Exclusões</p>
          <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-gray-900 mb-5">
            O que não conta como downtime
          </h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Com transparência, aqui está o que o SLA não cobre. Padrão de mercado:
          </p>

          <ul className="space-y-3">
            {EXCLUSIONS.map((e) => (
              <li key={e} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                <AlertTriangle size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{e}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Shield size={40} className="mx-auto mb-5 text-amber-400" />
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold mb-5">
            Operação crítica exige SLA crítico
          </h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            SLA contratual é parte do plano Enterprise. Falar com especialista leva 30 minutos e não custa nada.
          </p>
          <Link href="/enterprise"
            className="bg-amber-400 text-gray-900 font-semibold px-7 py-4 rounded-xl hover:bg-amber-300 transition-colors inline-flex items-center gap-2">
            Conhecer plano Enterprise <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
