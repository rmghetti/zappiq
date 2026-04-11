'use client';

import { Bell, Search, Menu } from 'lucide-react';
import { useUiStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { ModuleLogo } from './ModuleLogo';

export function Header() {
  const { toggleSidebar } = useUiStore();
  const { organization } = useAuthStore();

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
      {/* Esquerda: botão mobile + logo dinâmico do módulo */}
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-gray-100 lg:hidden">
          <Menu size={20} />
        </button>
        <div className="flex items-center">
          <ModuleLogo />
        </div>
      </div>

      {/* Centro: busca */}
      <div className="flex-1 flex justify-center px-6 hidden sm:flex">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar conversas, contatos..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Direita: org info + notificações */}
      <div className="flex items-center gap-4">
        {organization && (
          <span className="text-sm text-gray-500 hidden md:block">
            {organization.name} · <span className="font-medium text-primary-600">{organization.plan}</span>
          </span>
        )}
        <button className="relative p-2 rounded-lg hover:bg-gray-100">
          <Bell size={20} className="text-gray-500" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
      </div>
    </header>
  );
}
