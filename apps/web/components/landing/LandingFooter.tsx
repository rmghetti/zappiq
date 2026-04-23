/* ══════════════════════════════════════════════════════════════════════════
 * LandingFooter — Design V4 (Chatbase-style · dark #0A0B12 · Geist)
 * --------------------------------------------------------------------------
 * Footer institucional com 5 colunas (Produto · Planos · Empresa · Recursos ·
 * Conformidade), badges de segurança, razão social CNPJ, DPO LGPD, créditos.
 *
 * V4 purge: link "Garantia 60 dias" substituído por "14 dias grátis".
 * Tagline: "Onboarding Zero · Voz Nativa · 14 dias grátis".
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { Logo } from '../Logo';
import { Shield, Lock, Server, Activity, Radar } from 'lucide-react';

const COLUMNS = [
  {
    title: 'Produto',
    links: [
      { label: 'ZappIQCore', href: '/#produtos' },
      { label: 'PulseAI', href: '/#produtos' },
      { label: 'SparkCampaigns', href: '/#produtos' },
      { label: 'RadarInsights', href: '/#produtos' },
      { label: 'NexusCRM', href: '/#produtos' },
      { label: 'ForgeStudio', href: '/#produtos' },
      { label: 'EchoCopilot', href: '/#produtos' },
      { label: 'ShieldCompliance', href: '/#produtos' },
      { label: 'Radar 360° (add-on)', href: '/observabilidade' },
    ],
  },
  {
    title: 'Planos',
    links: [
      { label: 'Starter · Growth · Scale', href: '/#precos' },
      { label: 'Business', href: '/#precos' },
      { label: 'Enterprise', href: '/enterprise' },
      { label: '14 dias grátis', href: '/#precos' },
      { label: 'Voz Nativa (add-on)', href: '/voz' },
      { label: 'Migração Zenvia', href: '/migracao-zenvia' },
      { label: 'SLA contratual', href: '/sla' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre', href: '/sobre' },
      { label: 'Blog', href: '/blog' },
      { label: 'Cases', href: '/cases' },
      { label: 'Carreiras', href: '/carreiras' },
      { label: 'Parceiros', href: '/parceiros' },
      { label: 'Contato', href: '/contato' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { label: 'Documentação', href: 'https://docs.zappiq.com.br' },
      { label: 'API Reference', href: 'https://docs.zappiq.com.br/api' },
      { label: 'Comparativo', href: '/comparativo' },
      { label: 'Demo interativo', href: '/demo' },
      { label: 'Como funciona o Survey', href: '/como-funciona-survey' },
      { label: 'Selo ZappIQ', href: '/selo' },
      { label: 'Status da plataforma', href: 'https://status.zappiq.com.br' },
    ],
  },
  {
    title: 'Conformidade',
    links: [
      { label: 'Termos de Uso', href: '/legal/termos' },
      { label: 'Política de Privacidade', href: '/legal/privacidade' },
      { label: 'Política de Cookies', href: '/legal/cookies' },
      { label: 'DPA (Data Processing Addendum)', href: '/legal/dpa' },
      { label: 'Fair-Use & Limites Técnicos', href: '/legal/fair-use' },
      { label: 'Parceria WhatsApp Business', href: '/legal/parceria-meta' },
      { label: 'Deletar meus dados (LGPD)', href: '/legal/deletar-dados' },
      { label: 'Benchmarks concorrentes', href: '/legal/benchmarks-concorrentes' },
      { label: 'Contato DPO', href: 'mailto:rodrigo.ghetti@zappiq.com.br' },
    ],
  },
];

const SECURITY_BADGES = [
  { icon: Shield, label: 'Conforme LGPD (Lei 13.709/18)' },
  { icon: Lock, label: 'Criptografia AES-256 + TLS 1.3' },
  { icon: Server, label: 'Dados hospedados no Brasil' },
  { icon: Activity, label: 'SLA 99,9% contratual (Enterprise)' },
  { icon: Radar, label: 'Observabilidade de negócio (Radar 360°)' },
];

export function Footer() {
  return (
    <footer
      className="relative overflow-hidden text-white pt-20 pb-10"
      style={{ background: '#0A0B12' }}
    >
      {/* glow decorativo topo */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-64 pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(74,82,208,0.4) 0%, transparent 70%)',
        }}
      />

      <div className="relative zappiq-wrap">
        {/* Badges de segurança */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-14 pb-12 border-b border-white/8">
          {SECURITY_BADGES.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.label}
                className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2 backdrop-blur-sm"
              >
                <div
                  className="w-6 h-6 rounded-[6px] flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(47,181,122,0.25), rgba(74,82,208,0.3))',
                  }}
                >
                  <Icon size={12} className="text-white" />
                </div>
                <span className="text-[11.5px] text-white/85 font-medium">{b.label}</span>
              </div>
            );
          })}
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-14">
          {/* Coluna brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <Link href="/" aria-label="ZappIQ home">
                <Logo variant="negativo" height={48} />
              </Link>
            </div>
            <p className="text-[12.5px] text-white/55 leading-relaxed">
              Inteligência conversacional para PMEs brasileiras via WhatsApp.
            </p>
            <p className="text-[11px] text-white/35 leading-relaxed mt-3">
              V4 · Onboarding Zero · Voz Nativa · 14 dias grátis
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[10.5px] font-semibold text-white/60 uppercase tracking-[0.12em] mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => {
                  const isExternal =
                    link.href.startsWith('http') || link.href.startsWith('mailto:');
                  if (isExternal) {
                    return (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-[12.5px] text-white/55 hover:text-white transition-colors"
                          rel="noopener noreferrer"
                          target={link.href.startsWith('http') ? '_blank' : undefined}
                        >
                          {link.label}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[12.5px] text-white/55 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bloco institucional */}
        <div className="border-t border-white/8 pt-8 space-y-5">
          <div className="text-[11.5px] text-white/45 leading-relaxed text-center sm:text-left">
            <p className="font-semibold text-white/70">
              ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA{' '}
              <span className="text-white/40 font-normal">(d.b.a. ZappIQ)</span>
            </p>
            <p>CNPJ 46.788.145/0001-08 — detentora da marca ZappIQ</p>
            <p>
              Av. das Nações Unidas, 12901 — CENU Torre Norte, 25° andar — São Paulo/SP —
              CEP 04578-910
            </p>
            <p className="mt-3">
              Encarregado de Dados (DPO):{' '}
              <a
                href="mailto:rodrigo.ghetti@zappiq.com.br"
                className="text-white/70 hover:text-white"
              >
                rodrigo.ghetti@zappiq.com.br
              </a>
              {' · '}
              <Link href="/legal/privacidade" className="text-white/70 hover:text-white">
                Política de Privacidade
              </Link>
              {' · '}
              <Link href="/legal/deletar-dados" className="text-white/70 hover:text-white">
                Deletar meus dados
              </Link>
              {' · '}
              <Link href="/legal/dpa" className="text-white/70 hover:text-white">
                DPA
              </Link>
            </p>
            <p className="text-[10.5px] text-white/30 mt-1">
              DPO contatável diretamente conforme LGPD Art. 41. Prazo de resposta: 15 dias úteis
              (48h planos Business/Enterprise).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
            <p className="text-[11.5px] text-white/40">
              © 2026 ZappIQ. Todos os direitos reservados. Produto brasileiro 🇧🇷
            </p>
            <p className="text-[11.5px] text-white/40">
              Imprensa e parcerias:{' '}
              <a
                href="mailto:marketing@zappiq.com.br"
                className="text-white/60 hover:text-white"
              >
                marketing@zappiq.com.br
              </a>
              {' · '}
              <span className="text-white/25">redes sociais oficiais em breve</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
