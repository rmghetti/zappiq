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
    title: 'LGPD resolvida. Pronta pra auditoria.',
    summary:
      'Não é checkbox bonito na landing. É LGPD no núcleo do produto desde o dia 1.',
    points: [
      'Seu cliente pede pra apagar? Resolvido em até 15 dias',
      'Registro de quem mexeu em quê, auditável',
      'Segurança documentada pra mostrar pro jurídico',
      'Incidente crítico? Avisamos em até 72 horas',
      'Encarregado de dados (DPO) com contato direto',
    ],
    href: '/lgpd',
    cta: 'Ver conformidade LGPD',
  },
  {
    icon: Activity,
    title: 'Uptime 99,9% — escrito em contrato.',
    summary:
      'Se a plataforma cair além do combinado, você recebe crédito automático. Sem precisar brigar.',
    points: [
      'Relatório mensal de disponibilidade, público',
      'Créditos automáticos de 10% a 50% por incidente',
      'Atualizações sem tirar sua operação do ar',
      'Recuperação completa em até 4 horas',
      'Backup criptografado, fora do site, toda semana',
    ],
    href: '/sla',
    cta: 'Ver termos do SLA',
  },
  {
    icon: Radar,
    title: 'Dashboards que viram decisão.',
    summary:
      'O Radar 360° transforma suas conversas em BI executável. Incluído nos planos Business e Enterprise.',
    points: [
      'Dashboards executivos do jeito que você precisa',
      'Alertas automáticos quando algo foge do normal',
      'Previsão de vendas por IA',
      'Comparativo anônimo com o seu setor',
      'Exporta pra Power BI e Looker sem dor',
    ],
    href: '/observabilidade',
    cta: 'Conhecer Radar 360°',
  },
];

const CERTIFICATIONS = [
  { icon: Lock, label: 'Dados criptografados no banco' },
  { icon: Lock, label: 'Conexão criptografada ponta a ponta' },
  { icon: Server, label: 'Servidores 100% no Brasil (São Paulo)' },
  { icon: FileCheck, label: 'Backup seguro + restauração até 30 dias atrás' },
  { icon: Shield, label: 'Seus dados isolados dos de outros clientes' },
  { icon: Activity, label: 'Registro auditável de todos os acessos' },
];

export function TrustAndCompliance() {
  return (
    <section id="seguranca" className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Segurança · Conformidade · Confiança</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            Segurança e conformidade que seu jurídico aprova.{' '}
            <span className="text-grad">Operação que seu CEO confia.</span>
          </h2>
          <p className="text-[16px] text-muted leading-relaxed">
            ZappIQ não é um "chatbotzinho". É infraestrutura crítica pro seu negócio.
            Por isso segurança, LGPD e visibilidade são produto aqui — não um capricho de marketing.
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
            Por baixo do capô: segurança de banco.
          </h3>
          <p className="text-[13.5px] text-white/60 text-center mb-10 relative">
            Auditável. Documentação completa disponível para prospects Enterprise sob NDA.
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
