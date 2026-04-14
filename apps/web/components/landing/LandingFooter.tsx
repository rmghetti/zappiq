import Link from 'next/link';
import { Logo } from '../Logo';
import { Shield, Lock, Server, Activity, Radar } from 'lucide-react';

const COLUMNS = [
  { title: 'Produto', links: [
    { label: 'Core', href: '#produtos' },
    { label: 'Pulse AI', href: '#produtos' },
    { label: 'Spark Campaigns', href: '#produtos' },
    { label: 'Radar Insights', href: '#produtos' },
    { label: 'Radar 360° (Observabilidade)', href: '/observabilidade' },
    { label: 'Nexus CRM', href: '#produtos' },
    { label: 'Forge Studio', href: '#produtos' },
    { label: 'Echo Copilot', href: '#produtos' },
  ]},
  { title: 'Planos', links: [
    { label: 'Starter · Growth · Scale', href: '#precos' },
    { label: 'Enterprise', href: '/enterprise' },
    { label: 'Radar 360° add-on', href: '/observabilidade' },
    { label: 'SLA contratual', href: '/sla' },
  ]},
  { title: 'Empresa', links: [
    { label: 'Sobre', href: '#' },
    { label: 'Blog', href: '/blog' },
    { label: 'Cases', href: '/cases' },
    { label: 'Carreiras', href: '#' },
    { label: 'Contato', href: '#' },
  ]},
  { title: 'Recursos', links: [
    { label: 'Documentação', href: '#' },
    { label: 'API', href: '#' },
    { label: 'Comparativo', href: '/comparativo' },
    { label: 'Demo', href: '/demo' },
    { label: 'Status', href: 'https://status.zappiq.com.br' },
  ]},
  { title: 'Conformidade', links: [
    { label: 'LGPD', href: '/lgpd' },
    { label: 'SLA', href: '/sla' },
    { label: 'Segurança', href: '/lgpd' },
    { label: 'Contato DPO', href: 'mailto:dpo@zappiq.com' },
    { label: 'Termos de Uso', href: '#' },
    { label: 'Privacidade', href: '#' },
  ]},
];

const SECURITY_BADGES = [
  { icon: Shield, label: 'Conforme LGPD (Lei 13.709/18)' },
  { icon: Lock, label: 'Criptografia AES-256 + TLS 1.3' },
  { icon: Server, label: 'Servidores no Brasil' },
  { icon: Activity, label: 'SLA 99,9% contratual (Enterprise)' },
  { icon: Radar, label: 'Observabilidade de negócio' },
];

export function Footer() {
  return (
    <footer className="bg-[#1A1A2E] border-t border-white/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Badges de segurança */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-12 pb-10 border-b border-white/5">
          {SECURITY_BADGES.map((b) => (
            <div key={b.label} className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full px-5 py-2.5">
              <b.icon size={16} className="text-primary-400" />
              <span className="text-sm text-gray-400 font-medium">{b.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Logo column */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <Link href="/"><Logo variant="negativo" height={54} /></Link>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">Inteligência conversacional para PMEs brasileiras via WhatsApp.</p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link href={link.href} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">{link.label}</Link>
                    ) : (
                      <a href={link.href} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">{link.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 ZappIQ. Todos os direitos reservados. Produto brasileiro 🇧🇷</p>
          <div className="flex gap-4">
            {['Instagram', 'LinkedIn', 'YouTube'].map((social) => (
              <a key={social} href="#" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">{social}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
