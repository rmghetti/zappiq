'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import {
  LayoutDashboard, MessageSquare, Users, Megaphone, BarChart3,
  GitBranch, Settings, CreditCard, Target, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, FileLock, Sparkles, FileText, ListChecks,
  // Admin Plataforma (SUPERADMIN) icons
  Activity, TrendingUp, Bot, UserCheck, DollarSign, Building2,
  // FASE 2.2b — Qualidade da IA (cliente)
  Gauge,
  // Agendamento — agenda interna (hub)
  CalendarClock,
  // Cupons de desconto (SUPERADMIN)
  Ticket,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/contacts', label: 'Contatos', icon: Users },
  { href: '/crm', label: 'CRM', icon: Target },
  // Agendamento — agenda interna (hub). A IA grava aqui; calendários externos sincronizam.
  { href: '/crm/agenda', label: 'Agenda', icon: CalendarClock },
  // FEATURE 5b.5 — tela de Tarefas / follow-ups da IA. A automação (crmAutomationService)
  // já cria Tasks quando detecta intenção de compra; aqui a PME finalmente as vê e conclui.
  { href: '/tasks', label: 'Tarefas', icon: ListChecks },
  { href: '/campaigns', label: 'Zap Impulso', icon: Megaphone },
  // FEATURE 5b.2 — gestão de templates de WhatsApp (aprovados pela Meta;
  // alimentam o seletor de campanha e o reengajamento fora da janela de 24h).
  { href: '/templates', label: 'Templates', icon: FileText },
  // Maestro (GA 2026-05-22): builder de fluxos visível. Backend /api/flows pronto;
  // publicar liga maestro.enabled na org e o gate suporta FIRST_CONTACT/KEYWORD.
  { href: '/flows', label: 'Maestro', icon: GitBranch },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  // PR #106 — Treinar IA destacado: principal entry point pra evolução contínua do agente.
  { href: '/ai-training', label: 'Treinar IA', icon: Sparkles, highlight: true },
  // FASE 2.2b #244 — Qualidade da IA do cliente (dashboard + auto-fix + audit).
  { href: '/treinar/qualidade', label: 'Qualidade da IA', icon: Gauge },
];

// Itens restritos a ADMIN / AUDITOR — compliance e governança LGPD
const complianceItems = [
  { href: '/audit-logs', label: 'Auditoria', icon: ShieldCheck, roles: ['ADMIN', 'AUDITOR', 'SUPERADMIN'] },
  { href: '/dsr', label: 'Requisições LGPD', icon: FileLock, roles: ['ADMIN', 'AUDITOR', 'SUPERADMIN'] },
];

// Itens SUPERADMIN — visibilidade CROSS-TENANT da plataforma toda.
// Não confundir com `complianceItems` (admin do tenant). Aqui é admin da
// PLATAFORMA inteira — Rodrigo CEO vê dados de todos os clientes.
// Ordem: 2 itens de saúde da IA (mais críticos pro CEO no dia-a-dia) →
// pipeline comercial → finance. Garante que "Qualidade do Agente" não
// fique cortado pelo footer da sidebar em telas menores.
const platformAdminItems = [
  { href: '/admin/agent-quality', label: 'Qualidade do Agente', icon: Activity }, // FASE 2 / V4
  { href: '/admin/llm-health', label: 'LLM Health', icon: Bot },
  { href: '/admin/iza-conversations', label: 'Conversas Iza', icon: MessageSquare },
  { href: '/admin/quota-watch', label: 'Quota Watch', icon: Activity },
  { href: '/admin/unit-economics', label: 'Unit Economics', icon: DollarSign },
  { href: '/admin/coupons', label: 'Cupons de Descontos', icon: Ticket },
];

// Sub-grupo "Clientes" (Área Clientes / Fase 2, §2 proposedNav) — gestão da
// base instalada: contas, ciclo de vida, leads e financeiro. Absorve a antiga
// /admin/leads (agora /admin/clientes/leads com a taxonomia nova).
const platformClientesItems = [
  { href: '/admin/clientes', label: 'Visão Geral', icon: Building2 },
  { href: '/admin/clientes/leads', label: 'Leads & Signups', icon: UserCheck },
  { href: '/admin/clientes/financeiro', label: 'Financeiro', icon: DollarSign },
];

const bottomItems = [
  { href: '/settings', label: 'Configurações', icon: Settings },
  { href: '/billing', label: 'Plano & Fatura', icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, collapseSidebar, expandSidebar } = useUiStore();

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <aside className={`flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300 ${sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'}`}>
      {/* Logo ZappIQ + Patch MACHIA (sidebar não-colapsada) */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
        {!sidebarCollapsed ? (
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="ZappIQ — uma plataforma da MACHIA"
          >
            <Logo variant="positivo" height={32} />
            <span className="h-6 w-px bg-gray-200" aria-hidden />
            <Image
              src="/partners/machia/patch-machia.svg"
              alt="A Platform MACHIA Company"
              width={36}
              height={39}
              className="h-9 w-auto"
            />
          </Link>
        ) : (
          <Link href="/"><Logo variant="icon" height={28} /></Link>
        )}
        <button
          onClick={sidebarCollapsed ? expandSidebar : collapseSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, highlight }) => {
          const active = isActive(href);
          const baseClass = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors';
          let className = baseClass;
          if (active) {
            className += ' bg-primary-50 text-primary-700';
          } else if (highlight) {
            // Treinar IA destacado: gradiente suave + sparkle pra puxar o olho.
            className += ' bg-gradient-to-r from-emerald-50 to-violet-50 text-violet-700 hover:from-emerald-100 hover:to-violet-100';
          } else {
            className += ' text-gray-600 hover:bg-gray-50 hover:text-gray-900';
          }
          return (
            <Link
              key={href}
              href={href}
              className={className}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon size={20} className={`flex-shrink-0 ${highlight && !active ? 'text-violet-600' : ''}`} />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* Seção Compliance/LGPD — visível apenas para ADMIN/AUDITOR */}
        {complianceItems.some(i => i.roles.includes(user?.role ?? '')) && (
          <div className="pt-4 mt-4 border-t border-gray-100">
            {!sidebarCollapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Compliance</p>
            )}
            {complianceItems
              .filter(i => i.roles.includes(user?.role ?? ''))
              .map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={sidebarCollapsed ? label : undefined}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {!sidebarCollapsed && <span>{label}</span>}
                </Link>
              ))}
          </div>
        )}

        {/* Seção ADMIN PLATAFORMA — só SUPERADMIN (Rodrigo CEO + futuros) */}
        {user?.role === 'SUPERADMIN' && (
          <div className="pt-4 mt-4 border-t border-amber-100">
            {!sidebarCollapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={11} />
                Admin Plataforma
              </p>
            )}
            {platformAdminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                }`}
                title={sidebarCollapsed ? label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!sidebarCollapsed && <span>{label}</span>}
              </Link>
            ))}

            {/* Sub-grupo Clientes — Área Clientes / Fase 2 */}
            {!sidebarCollapsed && (
              <p className="px-3 mt-4 mb-2 text-[11px] font-semibold text-amber-500 uppercase tracking-wider">
                Clientes
              </p>
            )}
            {platformClientesItems.map(({ href, label, icon: Icon }) => {
              // /admin/clientes é prefixo dos filhos; usa exact-match nele.
              const active =
                href === '/admin/clientes' ? pathname === href : isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                  title={sidebarCollapsed ? label : undefined}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {!sidebarCollapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        {bottomItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive(href) ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
          </Link>
        ))}

        {/* User */}
        <div className={`flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg bg-gray-50 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button onClick={logout} className="p-1 text-gray-400 hover:text-red-500" title="Sair">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
