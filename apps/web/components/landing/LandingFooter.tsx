import Link from 'next/link';
import { Logo } from '../Logo';
import { Shield, Lock, Server, Activity, Radar } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Footer — source of truth institucional                              */
/*                                                                     */
/* V2-024 Módulos canônicos: 8 módulos (ZappIQCore, PulseAI,           */
/*        SparkCampaigns, RadarInsights, NexusCRM, ForgeStudio,        */
/*        EchoCopilot, ShieldCompliance).                              */
/* V2-025 DPO externo: CEO deixa de figurar como DPO (LGPD Art. 41     */
/*        exige independência). Caixa genérica dpo@zappiq.com.br até   */
/*        contratação de DPO externo (BLOCKER B-03).                   */
/* V2-026 Razão social: "Onze e Onze Consultoria Empresarial Ltda"     */
/*        (d.b.a. ZappIQ) — migração para razão social própria         */
/*        registrada em BLOCKER B-04.                                  */
/* V2-028 Todos os 5 links legais reais e acessíveis (termos,          */
/*        privacidade, cookies, DPA, fair-use).                        */
/* V2-030 Ícones de rede social removidos até abertura dos perfis      */
/*        oficiais (BLOCKER B-06). Substituído por contato de          */
/*        marketing + placeholder informativo.                         */
/* V2-033 Coluna Empresa: todos os links resolvem para páginas reais   */
/*        (Sobre, Blog, Cases, Carreiras, Contato).                    */
/* V2-034 Coluna Recursos: Documentação e API apontam para subdomínios */
/*        reais (docs.zappiq.com.br / status.zappiq.com.br). Enquanto  */
/*        os subdomínios não estão publicados, /docs-prelaunch         */
/*        retorna página "em breve" com CTA para /contato.             */
/* V2-038 Status page com link real e rel="noopener".                  */
/* ------------------------------------------------------------------ */

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
      { label: 'Garantia 60 dias', href: '/garantia' },
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
            <p className="text-xs text-gray-500 leading-relaxed">
              Inteligência conversacional para PMEs brasileiras via WhatsApp.
            </p>
            <p className="text-[11px] text-gray-600 leading-relaxed mt-3">
              V3.2 — Onboarding Zero · Voz Nativa · Garantia 60 dias
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => {
                  const isExternal = link.href.startsWith('http') || link.href.startsWith('mailto:');
                  if (isExternal) {
                    return (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
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
                      <Link href={link.href} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-6 space-y-4">
          {/* V2-026: Razão social canônica */}
          <div className="text-xs text-gray-600 leading-relaxed text-center sm:text-left">
            <p className="font-semibold text-gray-500">
              ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA <span className="text-gray-600 font-normal">(d.b.a. ZappIQ)</span>
            </p>
            <p>CNPJ 46.788.145/0001-08 — detentora da marca ZappIQ</p>
            <p>Av. das Nações Unidas, 12901 — CENU Torre Norte, 25° andar — São Paulo/SP — CEP 04578-910</p>
            {/* V2-025: DPO externo — CEO removido como DPO (LGPD Art. 41).
                Caixa genérica até contratação do DPO externo (BLOCKER B-03). */}
            <p className="mt-2">
              Encarregado de Dados (DPO):{' '}
              <a href="mailto:rodrigo.ghetti@zappiq.com.br" className="text-gray-400 hover:text-gray-300">rodrigo.ghetti@zappiq.com.br</a>
              {' · '}
              <Link href="/legal/privacidade" className="text-gray-400 hover:text-gray-300">Política de Privacidade</Link>
              {' · '}
              <Link href="/legal/deletar-dados" className="text-gray-400 hover:text-gray-300">Deletar meus dados</Link>
              {' · '}
              <Link href="/legal/dpa" className="text-gray-400 hover:text-gray-300">DPA</Link>
            </p>
            <p className="text-[11px] text-gray-700 mt-1">
              DPO contatável diretamente conforme LGPD Art. 41. Prazo de resposta: 15 dias úteis (48h planos Business/Enterprise).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">
              © 2026 ZappIQ. Todos os direitos reservados. Produto brasileiro 🇧🇷
            </p>
            {/* V2-030: ícones sociais removidos. Substituído por contato marketing. */}
            <p className="text-xs text-gray-600">
              Imprensa e parcerias:{' '}
              <a href="mailto:marketing@zappiq.com.br" className="text-gray-500 hover:text-gray-300">
                marketing@zappiq.com.br
              </a>
              {' · '}
              <span className="text-gray-700">redes sociais oficiais em breve</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
