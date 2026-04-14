'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import {
  LayoutDashboard, MessageSquare, Users, Megaphone, BarChart3,
  GitBranch, BookOpen, Settings, CreditCard, Target, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, FileLock,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/contacts', label: 'Contatos', icon: Users },
  { href: '/crm', label: 'CRM', icon: Target },
  { href: '/campaigns', label: 'Campanhas', icon: Megaphone },
  { href: '/flows', label: 'Fluxos', icon: GitBranch },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/knowledge-base', label: 'Base de Conhecimento', icon: BookOpen },
];

// Itens restritos a ADMIN / AUDITOR — compliance e governança LGPD
const complianceItems = [
  { href: '/audit-logs', label: 'Auditoria', icon: ShieldCheck, roles: ['ADMIN', 'AUDITOR'] },
  { href: '/dsr', label: 'Requisições LGPD', icon: FileLock, roles: ['ADMIN', 'AUDITOR'] },
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
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
        {!sidebarCollapsed ? (
          <Link href="/"><Logo variant="positivo" height={32} /></Link>
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
        {navItems.map(({ href, label, icon: Icon }) => (
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
