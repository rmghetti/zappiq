'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * Navbar — Design V4 (Chatbase-style · Geist + gradient g→b→p)
 * --------------------------------------------------------------------------
 * Minimalista: wordmark ZappIQ, 7 links centrais, CTA dual (Entrar + Começar).
 * Sticky com backdrop-blur. Preserva mega menu de produtos (8 módulos) e
 * mobile menu com accordion (padrão V3.2).
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Menu,
  X,
  ChevronDown,
  Inbox,
  Brain,
  Megaphone,
  BarChart3,
  Users,
  Workflow,
  Headphones,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

const PRODUCTS = [
  { icon: Inbox,       name: 'ZappIQ Core',      desc: 'Central de conversas unificada',     href: '#produtos' },
  { icon: Brain,       name: 'Pulse AI',         desc: 'Agente IA que atende 24/7',          href: '#produtos' },
  { icon: Megaphone,   name: 'Spark Campaigns',  desc: 'Campanhas em massa no WhatsApp',     href: '#produtos' },
  { icon: BarChart3,   name: 'Radar 360°',       desc: 'Observabilidade + forecast ML',      href: '/observabilidade' },
  { icon: Users,       name: 'Nexus CRM',        desc: 'CRM nativo para WhatsApp',           href: '#produtos' },
  { icon: Workflow,    name: 'Forge Studio',     desc: 'Automações visuais drag-and-drop',   href: '#produtos' },
  { icon: Headphones,  name: 'Echo Copilot',     desc: 'Copiloto IA para atendentes',        href: '#produtos' },
  { icon: ShieldCheck, name: 'Shield Compliance',desc: 'LGPD · Art. 18/37/48 · DPA',         href: '/lgpd' },
];

const NAV_ITEMS: { label: string; href: string; mega?: boolean }[] = [
  { label: 'Produtos', href: '#produtos', mega: true },
  { label: 'Preços',   href: '#precos' },
  { label: 'Cases',    href: '/cases' },
  { label: 'Blog',     href: '/blog' },
  { label: 'Empresa',  href: '/enterprise' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const megaTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleMegaEnter = () => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current);
    setMegaOpen(true);
  };
  const handleMegaLeave = () => {
    megaTimeout.current = setTimeout(() => setMegaOpen(false), 180);
  };

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[rgba(250,250,250,0.85)] backdrop-blur-xl border-b border-line'
          : 'bg-transparent'
      }`}
    >
      <div className="zappiq-wrap flex items-center justify-between h-[68px]">
        {/* Logo (SVG real · /public/logo-positivo.svg) */}
        <Link href="/" className="flex items-center" aria-label="ZappIQ home">
          <Image
            src="/logo-positivo.svg"
            alt="ZappIQ"
            width={168}
            height={40}
            priority
            className="h-10 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) =>
            item.mega ? (
              <div
                key={item.href}
                ref={megaRef}
                className="relative"
                onMouseEnter={handleMegaEnter}
                onMouseLeave={handleMegaLeave}
              >
                <button
                  className="flex items-center gap-1 px-3 py-2 text-[14px] text-muted hover:text-ink transition-colors"
                  aria-expanded={megaOpen}
                >
                  {item.label}
                  <ChevronDown size={13} className={`transition-transform ${megaOpen ? 'rotate-180' : ''}`} />
                </button>

                {megaOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[640px] bg-white rounded-[20px] shadow-[0_30px_60px_-20px_rgba(17,17,17,0.18)] border border-line p-5 grid grid-cols-2 gap-2 animate-fade-in">
                    {PRODUCTS.map((p) => {
                      const Icon = p.icon;
                      const isInternal = p.href.startsWith('/');
                      const content = (
                        <>
                          <div className="w-10 h-10 rounded-[10px] bg-grad flex items-center justify-center flex-shrink-0 shadow-[0_8px_16px_-8px_rgba(74,82,208,0.4)]">
                            <Icon size={18} className="text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-medium text-ink leading-tight">{p.name}</div>
                            <div className="text-[12.5px] text-muted mt-0.5 leading-snug">{p.desc}</div>
                          </div>
                        </>
                      );
                      const cls =
                        'flex items-start gap-3 p-3 rounded-[14px] hover:bg-bg-soft transition-colors';
                      return isInternal ? (
                        <Link key={p.name} href={p.href} onClick={() => setMegaOpen(false)} className={cls}>
                          {content}
                        </Link>
                      ) : (
                        <a key={p.name} href={p.href} onClick={() => setMegaOpen(false)} className={cls}>
                          {content}
                        </a>
                      );
                    })}
                    <div className="col-span-2 border-t border-line pt-3 mt-1">
                      <a
                        href="#produtos"
                        onClick={() => setMegaOpen(false)}
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
                      >
                        Ver todos os módulos <ArrowRight size={13} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : item.href.startsWith('/') ? (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-[14px] text-muted hover:text-ink transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-[14px] text-muted hover:text-ink transition-colors"
              >
                {item.label}
              </a>
            )
          )}
        </div>

        {/* CTAs desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <Link
            href="/login"
            className="text-[14px] text-muted hover:text-ink transition-colors px-3 py-2"
          >
            Entrar
          </Link>
          <Link href="/register" className="btn btn-primary text-[14px]">
            Começar grátis
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 text-ink"
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-line px-6 py-4 space-y-1 shadow-lg max-h-[80vh] overflow-y-auto">
          <button
            onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
            className="flex items-center justify-between w-full text-[15px] font-medium text-ink py-3"
          >
            Produtos
            <ChevronDown size={14} className={`transition-transform ${mobileProductsOpen ? 'rotate-180' : ''}`} />
          </button>
          {mobileProductsOpen && (
            <div className="pl-4 space-y-1 pb-2">
              {PRODUCTS.map((p) => {
                const Icon = p.icon;
                const close = () => {
                  setMobileOpen(false);
                  setMobileProductsOpen(false);
                };
                const cls = 'flex items-center gap-3 py-2.5 text-[14px] text-muted hover:text-ink';
                return p.href.startsWith('/') ? (
                  <Link key={p.name} href={p.href} onClick={close} className={cls}>
                    <Icon size={16} className="text-accent" />
                    {p.name}
                  </Link>
                ) : (
                  <a key={p.name} href={p.href} onClick={close} className={cls}>
                    <Icon size={16} className="text-accent" />
                    {p.name}
                  </a>
                );
              })}
            </div>
          )}

          {NAV_ITEMS.filter((i) => !i.mega).map((item) =>
            item.href.startsWith('/') ? (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block text-[15px] font-medium text-ink py-3"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block text-[15px] font-medium text-ink py-3"
              >
                {item.label}
              </a>
            )
          )}

          <div className="border-t border-line pt-3 space-y-2">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-[15px] font-medium text-muted py-2"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="btn btn-primary w-full justify-center"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
