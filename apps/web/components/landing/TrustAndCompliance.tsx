'use client';

import Link from 'next/link';
import { Shield, Lock, Server, Activity, FileCheck, Radar } from 'lucide-react';

const PILLARS = [
  {
    icon: Shield,
    title: 'LGPD Compliance by design',
    summary:
      'A Lei Geral de Proteção de Dados (Lei 13.709/2018) regula como empresas tratam dados pessoais no Brasil. ZappIQ foi construída desde o primeiro dia com LGPD no core — não é checkbox, é arquitetura.',
    points: [
      'Art. 18 — atendimento a titulares (DSR) com SLA de 15 dias',
      'Art. 37 — ROP (Registro de Operações de Tratamento) auditável',
      'Art. 46 — medidas técnicas de segurança documentadas',
      'Art. 48 — notificação de incidente em até 72h',
      'DPO disponível para contato direto',
    ],
    href: '/lgpd',
    cta: 'Ver nossa conformidade LGPD',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Activity,
    title: 'SLA contratual 99,9% (Enterprise)',
    summary:
      'Uptime garantido por contrato, com créditos automáticos em caso de descumprimento. RPO 1h (ponto de recuperação de dados) e RTO 4h (tempo de retomada) formalmente documentados.',
    points: [
      'Relatório mensal de uptime público',
      'Créditos de 10% / 25% / 50% conforme severidade da falha',
      'Deploy rolling sem downtime (duas máquinas mínimas sempre ativas)',
      'Point-in-time recovery 30 dias',
      'Backup semanal em armazenamento cifrado offsite',
    ],
    href: '/sla',
    cta: 'Ver termos do SLA',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    icon: Radar,
    title: 'Observabilidade que vira decisão',
    summary:
      'Radar 360° transforma suas conversas em inteligência de negócio. Cohort analysis, previsão de pipeline (ML), benchmarking de mercado, alertas proativos e BI exportável. Incluído no Enterprise.',
    points: [
      'Dashboards executivos customizáveis',
      'Alertas proativos (queda de conversão, picos de abandono)',
      'Previsão de pipeline por machine learning',
      'Benchmarking anônimo contra seu segmento',
      'Exporta para Power BI e Looker Studio',
    ],
    href: '/observabilidade',
    cta: 'Conhecer o Radar 360°',
    accent: 'from-purple-600 to-indigo-600',
  },
];

const CERTIFICATIONS = [
  { icon: Lock, label: 'Criptografia AES-256 em repouso' },
  { icon: Lock, label: 'TLS 1.3 em trânsito' },
  { icon: Server, label: 'Servidores 100% no Brasil (São Paulo)' },
  { icon: FileCheck, label: 'Backup cifrado + PITR 30 dias' },
  { icon: Shield, label: 'Isolamento multi-tenant (RLS)' },
  { icon: Activity, label: 'Auditoria completa de acessos' },
];

export function TrustAndCompliance() {
  return (
    <section id="seguranca" className="py-20 lg:py-28 bg-gradient-to-b from-white via-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Segurança, conformidade e confiança
          </p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
            Feita para empresas que não podem parar.<br className="hidden sm:block" /> E que precisam responder pra auditoria.
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            ZappIQ não é um canal de atendimento. É infraestrutura crítica da sua operação. Por isso tratamos segurança, conformidade e observabilidade como produto — não como checkbox.
          </p>
        </div>

        {/* 3 pilares */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl transition-shadow">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.accent} flex items-center justify-center mb-4`}>
                <pillar.icon size={24} className="text-white" />
              </div>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-2">{pillar.title}</h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">{pillar.summary}</p>
              <ul className="space-y-2 mb-5">
                {pillar.points.map((p) => (
                  <li key={p} className="text-xs text-gray-500 flex items-start gap-2">
                    <span className="text-primary-500 font-bold flex-shrink-0">•</span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link href={pillar.href} className="text-sm font-semibold text-primary-600 hover:text-primary-800 inline-flex items-center gap-1">
                {pillar.cta} →
              </Link>
            </div>
          ))}
        </div>

        {/* Grid de certificações técnicas */}
        <div className="bg-gray-900 rounded-3xl p-8 lg:p-10">
          <h3 className="font-display text-xl lg:text-2xl font-bold text-white text-center mb-8">
            Stack de segurança técnica
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CERTIFICATIONS.map((c) => (
              <div key={c.label} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                  <c.icon size={16} className="text-primary-400" />
                </div>
                <span className="text-sm text-gray-300">{c.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center mt-6">
            Arquitetura auditável. Documentação técnica disponível sob NDA para prospects Enterprise.
          </p>
        </div>
      </div>
    </section>
  );
}
