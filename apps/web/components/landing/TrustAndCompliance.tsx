'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * TrustAndCompliance — Design V4 (seção dark · Chatbase-style)
 * --------------------------------------------------------------------------
 * Preserva 3 pilares institucionais (LGPD, SLA 99,9%, Observabilidade Radar)
 * e grid de 6 certificações técnicas. Visual novo: bloco dark (#0A0B12) com
 * gradient accent nos pilares.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { Shield, Lock, Server, Activity, FileCheck, Radar, ArrowRight } from 'lucide-react';

const PILLARS = [
  {
    icon: Shield,
    title: 'LGPD Compliance by design',
    summary:
      'ZappIQ foi construída desde o primeiro dia com LGPD no core. Não é checkbox, é arquitetura.',
    points: [
      'Art. 18 · DSR com SLA de 15 dias',
      'Art. 37 · ROP auditável',
      'Art. 46 · segurança documentada',
      'Art. 48 · incidente em ≤72h',
      'DPO disponível para contato direto',
    ],
    href: '/lgpd',
    cta: 'Ver conformidade LGPD',
  },
  {
    icon: Activity,
    title: 'SLA contratual 99,9% (Enterprise)',
    summary:
      'Uptime garantido por contrato com créditos automáticos. RPO 1h, RTO 4h, formalmente documentados.',
    points: [
      'Relatório mensal público de uptime',
      'Créditos 10% / 25% / 50% por severidade',
      'Deploy rolling · zero downtime',
      'Point-in-time recovery 30 dias',
      'Backup cifrado offsite semanal',
    ],
    href: '/sla',
    cta: 'Ver termos do SLA',
  },
  {
    icon: Radar,
    title: 'Observabilidade que vira decisão',
    summary:
      'Radar 360° transforma conversas em BI executável. Cohort analysis, forecast ML, benchmarking — incluso no Enterprise.',
    points: [
      'Dashboards executivos customizáveis',
      'Alertas proativos (queda/picos)',
      'Forecast de pipeline via ML',
      'Benchmarking anônimo por segmento',
      'Export pra Power BI e Looker',
    ],
    href: '/observabilidade',
    cta: 'Conhecer Radar 360°',
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
    <section id="seguranca" className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Segurança · Conformidade · Confiança</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            Feita pra empresas que não podem parar.{' '}
            <span className="text-grad">E precisam responder pra auditoria.</span>
          </h2>
          <p className="text-[16px] text-muted leading-relaxed">
            ZappIQ não é canal de atendimento. É infraestrutura crítica.
            Por isso tratamos segurança, conformidade e observabilidade como produto — não como checkbox.
          </p>
        </div>

        {/* 3 pilares claros */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 mb-12">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="card-soft p-7 lg:p-8 bg-white flex flex-col"
              >
                <div
                  className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-5 shadow-[0_8px_16px_-8px_rgba(74,82,208,0.4)]"
                  style={{
                    background:
                      'linear-gradient(135deg, #2FB57A 0%, #2F7FB5 45%, #4A52D0 100%)',
                  }}
                >
                  <Icon size={20} className="text-white" />
                </div>
                <h3 className="text-[18px] font-medium text-ink leading-tight tracking-tight mb-2">
                  {pillar.title}
                </h3>
                <p className="text-[13.5px] text-muted mb-4 leading-relaxed">{pillar.summary}</p>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {pillar.points.map((p) => (
                    <li key={p} className="text-[12.5px] text-muted flex items-start gap-2">
                      <span className="text-accent font-bold flex-shrink-0 mt-0.5">·</span>
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={pillar.href}
                  className="text-[13px] font-medium text-accent hover:underline inline-flex items-center gap-1"
                >
                  {pillar.cta} <ArrowRight size={13} />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Bloco dark · certificações técnicas */}
        <div
          className="rounded-[28px] p-8 lg:p-12 text-white relative overflow-hidden"
          style={{
            background: '#0A0B12',
            boxShadow: '0 30px 80px -20px rgba(10,11,18,0.4)',
          }}
        >
          {/* glow decorativo */}
          <div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(74,82,208,0.6) 0%, rgba(47,127,181,0.3) 40%, transparent 70%)',
            }}
          />
          <h3 className="text-[22px] lg:text-[26px] font-medium text-white text-center mb-2 tracking-tight relative">
            Stack de segurança técnica.
          </h3>
          <p className="text-[13.5px] text-white/60 text-center mb-10 relative">
            Auditável. Documentação sob NDA para prospects Enterprise.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative">
            {CERTIFICATIONS.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-[12px] px-4 py-3 backdrop-blur-sm"
                >
                  <div
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(47,181,122,0.2), rgba(74,82,208,0.25))',
                    }}
                  >
                    <Icon size={14} className="text-white" />
                  </div>
                  <span className="text-[12.5px] text-white/90 font-medium">{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
