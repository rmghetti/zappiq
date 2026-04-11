'use client';

import { useEffect, useState } from 'react';
import { Settings, Users, Smartphone, Brain, Shield, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatPhone } from '../../../lib/masks';
import { useAuthStore } from '../../../stores/authStore';

type Tab = 'general' | 'team' | 'whatsapp' | 'ai';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isOnline: boolean;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    Promise.all([
      api.get('/api/settings').catch(() => ({ data: null })),
      api.get('/api/settings/team').catch(() => ({ data: [] })),
    ]).then(([orgRes, teamRes]) => {
      setOrg(orgRes.data);
      setTeam(teamRes.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: 'general' as Tab, label: 'Geral', icon: Settings },
    { key: 'team' as Tab, label: 'Equipe', icon: Users },
    { key: 'whatsapp' as Tab, label: 'WhatsApp', icon: Smartphone },
    { key: 'ai' as Tab, label: 'IA / Agente', icon: Brain },
  ];

  const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', AGENT: 'Agente', AUDITOR: 'Auditor' };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && org && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da organização</label>
            <input defaultValue={org.name} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano atual</label>
            <p className="text-sm text-primary-600 font-semibold">{org.plan}</p>
          </div>
          <button className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">Salvar alterações</button>
        </div>
      )}

      {/* Team */}
      {tab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-3xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Membros da equipe ({team.length})</h3>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600">
              <Plus size={14} /> Convidar
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {team.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    {member.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name} {member.id === user?.id && <span className="text-xs text-gray-400">(você)</span>}</p>
                    <p className="text-xs text-gray-400">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{ROLE_LABELS[member.role] || member.role}</span>
                  {member.id !== user?.id && (
                    <button className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp */}
      {tab === 'whatsapp' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl space-y-5">
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <Smartphone className="text-green-600" size={24} />
            <div>
              <p className="text-sm font-semibold text-green-800">WhatsApp Business API</p>
              <p className="text-xs text-green-600">Configurado via Meta Cloud API</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
            <input defaultValue={org?.whatsappPhoneNumberId || ''} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Ex: 123456789012345" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Account ID</label>
            <input defaultValue={org?.whatsappBusinessAccountId || ''} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Ex: 987654321098765" />
          </div>
          <button className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">Salvar configurações</button>
        </div>
      )}

      {/* AI */}
      {tab === 'ai' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do agente</label>
            <input defaultValue="Bia" className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tom de voz</label>
            <select defaultValue="friendly" className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="friendly">Amigável</option>
              <option value="formal">Formal</option>
              <option value="technical">Técnico</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
            <select defaultValue="generic" className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="dentista">Dentista</option>
              <option value="psicologo">Psicólogo</option>
              <option value="academia">Academia</option>
              <option value="advogado">Advogado</option>
              <option value="salao">Salão de Beleza</option>
              <option value="petshop">Pet Shop</option>
              <option value="imobiliaria">Imobiliária</option>
              <option value="restaurante">Restaurante</option>
              <option value="ecommerce">Loja / E-commerce</option>
              <option value="generic">Genérico</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem de handoff</label>
            <textarea defaultValue="Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido!" rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
          </div>
          <button className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">Salvar configurações</button>
        </div>
      )}
    </div>
  );
}
