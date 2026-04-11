'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Inbox, Brain, Megaphone, BarChart3, Users, Workflow, Headphones, ArrowRight } from 'lucide-react';
import { Logo } from '../Logo';

const PRODUCTS = [
  { icon: Inbox, name: 'ZappIQ Core', desc: 'Central de conversas unificada', href: '#produtos' },
  { icon: Brain, name: 'Pulse AI', desc: 'Agente de IA que atende 24/7', href: '#produtos' },
  { icon: Megaphone, name: 'Spark Campaigns', desc: 'Campanhas em massa no WhatsApp', href: '#produtos' },
  { icon: BarChart3, name: 'Radar Insights', desc: 'Analytics e relatórios em tempo real', href: '#produtos' },
  { icon: Users, name: 'Nexus CRM', desc: 'CRM nativo para WhatsApp', href: '#produtos' },
  { icon: Workflow, name: 'Forge Studio', desc: 'Automações visuais drag-and-drop', href: '#produtos' },
  { icon: Headphones, name: 'Echo Copilot', desc: 'Copiloto IA para atendentes', href: '#produtos' },
];

const NAV_ITEMS = [
  { label: 'Produtos', href: '#produtos', hasMegaMenu: true },
  { label: 'Segmentos', href: '#segmentos', hasMegaMenu: false },
  { label: 'Cases', href: '/cases', hasMegaMenu: false },
  { label: 'Preços', href: '#precos', hasMegaMenu: false },
  { label: 'FAQ', href: '#faq', hasMegaMenu: false },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const megaMenuTimeout = useRef<NodeJS.Timeout | null>(null);

  // Banner dismissível via sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('zappiq_banner_dismissed');
      if (dismissed === 'true') setBannerVisible(false);
    }
  }, []);

  const dismissBanner = () => {
    setBannerVisible(false);
    sessionStorage.setItem('zappiq_banner_dismissed', 'true');
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fechar mega menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(e.target as Node)) {
        setMegaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMegaMenuEnter = () => {
    if (megaMenuTimeout.current) clearTimeout(megaMenuTimeout.current);
    setMegaMenuOpen(true);
  };

  const handleMegaMenuLeave = () => {
    megaMenuTimeout.current = setTimeout(() => setMegaMenuOpen(false), 200);
  };

  return (
    <>
      {/* Banner promocional — PLACEHOLDER: substituir texto e datas por dados reais */}
      {bannerVisible && (
        <div className="bg-[#0F5132] text-white text-center text-sm py-2.5 px-6 relative z-[60]">
          <span className="inline-block mr-2">🚀</span>
          <span className="font-medium">Semana da Automação: 30 dias grátis + onboarding assistido.</span>
          <span className="text-white/70 ml-1">Válido até sexta-feira.</span>
          <button
            onClick={dismissBanner}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
            aria-label="Fechar banner"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <nav className={`fixed left-0 right-0 z-50 transition-all duration-300 ${bannerVisible ? 'top-[42px]' : 'top-0'} ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-[80px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <Logo variant="positivo" height={66} />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              item.hasMegaMenu ? (
                <div
                  key={item.href}
                  ref={megaMenuRef}
                  className="relative"
                  onMouseEnter={handleMegaMenuEnter}
                  onMouseLeave={handleMegaMenuLeave}
                >
                  <button className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
                    {item.label} <ChevronDown size={14} className={`transition-transform ${megaMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Mega Menu */}
                  {megaMenuOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[600px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      {PRODUCTS.map((p) => (
                        <a
                          key={p.name}
                          href={p.href}
                          onClick={() => setMegaMenuOpen(false)}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0 group-hover:shadow-md transition-shadow">
                            <p.icon size={20} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{p.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
                          </div>
                        </a>
                      ))}
                      <div className="col-span-2 border-t border-gray-100 pt-3 mt-2">
                        <a href="#produtos" onClick={() => setMegaMenuOpen(false)} className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                          Ver todos os recursos <ArrowRight size={14} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <a key={item.href} href={item.href} className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
                  {item.label}
                </a>
              )
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-primary-600 px-4 py-2">Entrar</Link>
            {/* PLACEHOLDER: substituir href por link real de agendamento */}
            <a href="#agendar-demo" className="text-sm font-semibold text-primary-600 border border-primary-300 hover:bg-primary-50 px-4 py-2.5 rounded-lg transition-colors">
              Agendar Demo
            </a>
            <Link href="/register" className="text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 px-5 py-2.5 rounded-lg transition-colors shadow-sm">
              Começar grátis
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1 shadow-lg max-h-[80vh] overflow-y-auto">
            {/* Produtos accordion mobile */}
            <button
              onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 py-3"
            >
              Produtos <ChevronDown size={14} className={`transition-transform ${mobileProductsOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileProductsOpen && (
              <div className="pl-4 space-y-1 pb-2">
                {PRODUCTS.map((p) => (
                  <a
                    key={p.name}
                    href={p.href}
                    onClick={() => { setMobileOpen(false); setMobileProductsOpen(false); }}
                    className="flex items-center gap-3 py-2.5 text-sm text-gray-600 hover:text-primary-600"
                  >
                    <p.icon size={16} className="text-primary-500" />
                    {p.name}
                  </a>
                ))}
              </div>
            )}

            {NAV_ITEMS.filter(i => !i.hasMegaMenu).map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 py-3">{item.label}</a>
            ))}

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <Link href="/login" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 py-2">Entrar</Link>
              <a href="#agendar-demo" onClick={() => setMobileOpen(false)} className="block text-center text-sm font-semibold text-primary-600 border border-primary-300 px-5 py-2.5 rounded-lg">Agendar Demo</a>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="block text-center text-sm font-semibold text-white bg-primary-500 px-5 py-2.5 rounded-lg">Começar grátis</Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
