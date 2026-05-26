'use client';

/**
 * OrgSwitcher (CRM Onda 3b, PR #218)
 *
 * Dropdown no header visível APENAS pra usuários com role=SUPERADMIN.
 * Permite ver dados de qualquer org sem trocar de login.
 *
 * Como funciona:
 * - Carrega lista de orgs via GET /api/admin/organizations (já existe)
 * - Salva orgId selecionado em localStorage['zappiq_org_override']
 * - lib/api.ts injeta header X-Organization-Override em TODAS as requests
 * - Backend rlsTenant.ts valida user.role === 'SUPERADMIN' e usa o override
 *   no SET LOCAL app.current_organization_id (defesa em profundidade)
 * - Ao mudar, recarrega a página (mais simples que invalidar cache de query)
 */

import { useEffect, useState, useRef } from 'react';
import { ChevronDown, Shield, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

interface OrgLite {
  id: string;
  name: string;
  plan: string;
}

export function OrgSwitcher() {
  const { user, organization } = useAuthStore();
  const [orgs, setOrgs] = useState<OrgLite[]>([]);
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Só SUPERADMIN vê o switcher
  if (user?.role !== 'SUPERADMIN') {
    return null;
  }

  // Carrega override atual do localStorage
  useEffect(() => {
    setOverride(localStorage.getItem('zappiq_org_override'));
  }, []);

  // Carrega lista de orgs no primeiro abrir
  useEffect(() => {
    if (!open || orgs.length > 0) return;
    setLoading(true);
    api
      .get<{ organizations: OrgLite[] } | OrgLite[]>('/api/admin/organizations')
      .then((res: any) => {
        const list: OrgLite[] = Array.isArray(res) ? res : res?.organizations || res?.data || [];
        setOrgs(list);
      })
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, [open, orgs.length]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function switchTo(orgId: string | null) {
    if (orgId) {
      localStorage.setItem('zappiq_org_override', orgId);
    } else {
      localStorage.removeItem('zappiq_org_override');
    }
    // Reload pra invalidar todos os caches/queries com a nova org
    window.location.reload();
  }

  const currentOrg = override ? orgs.find((o) => o.id === override) : organization;
  const displayName = currentOrg?.name || (override ? '...' : organization?.name || 'Sua org');
  const isOverriding = !!override && override !== organization?.id;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          isOverriding
            ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
            : 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100'
        }`}
        title={
          isOverriding
            ? `Visualizando ${displayName} (override SUPERADMIN). Real: ${organization?.name}`
            : `SUPERADMIN — visualizando ${displayName}`
        }
      >
        <Shield size={12} />
        <span className="hidden md:inline max-w-[120px] truncate">{displayName}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[420px] overflow-y-auto">
          <div className="p-2 border-b border-gray-100">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold px-2 py-1">
              Org Switcher · SUPERADMIN
            </div>
            <button
              onClick={() => switchTo(null)}
              className={`w-full text-left px-2 py-2 rounded text-xs hover:bg-gray-50 flex items-center justify-between ${
                !override ? 'bg-purple-50 text-purple-900' : 'text-gray-700'
              }`}
            >
              <div>
                <div className="font-medium">Minha org (real)</div>
                <div className="text-[10px] text-gray-500">
                  {organization?.name} · {organization?.plan}
                </div>
              </div>
              {!override && <Check size={14} className="text-purple-700" />}
            </button>
          </div>

          <div className="p-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold px-2 py-1">
              Todas as orgs ({orgs.length})
            </div>
            {loading ? (
              <div className="px-2 py-3 text-xs text-gray-500 italic">Carregando…</div>
            ) : orgs.length === 0 ? (
              <div className="px-2 py-3 text-xs text-gray-500 italic">Nenhuma org encontrada.</div>
            ) : (
              orgs.map((o) => {
                const isActive = override === o.id;
                const isReal = o.id === organization?.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => switchTo(o.id === organization?.id ? null : o.id)}
                    className={`w-full text-left px-2 py-2 rounded text-xs hover:bg-gray-50 flex items-center justify-between ${
                      isActive ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 truncate">
                        {o.name}
                        {isReal && (
                          <span className="ml-1.5 text-[9px] text-purple-700 font-semibold uppercase">
                            real
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {o.plan} · {o.id.slice(0, 8)}…
                      </div>
                    </div>
                    {isActive && <Check size={14} className="text-amber-700 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
