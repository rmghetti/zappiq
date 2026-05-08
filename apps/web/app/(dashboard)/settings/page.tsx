'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * /settings — PR #103 (Onda 2B Settings persist)
 * --------------------------------------------------------------------------
 * Wire-up dos 4 tabs: General / Team / WhatsApp / AI.
 * Inputs controlled + handlers chamando backend Express já existente:
 *   PUT  /api/settings         → org name + whatsapp IDs + settings JSON (AI)
 *   GET  /api/settings/team    → lista membros
 *   POST /api/settings/team    → criar membro (ADMIN only)
 *   DELETE /api/settings/team/:id → remover (ADMIN only, não pode self)
 *
 * Toast inline (sem dep externa). Loading state per-action.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import {
  Settings, Users, Smartphone, Brain, Plus, Trash2,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';

type Tab = 'general' | 'team' | 'whatsapp' | 'ai';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isOnline: boolean;
}

interface AgentSettings {
  name?: string;
  tone?: string;
  segment?: string;
  handoffMessage?: string;
}

interface OrgSettings {
  agent?: AgentSettings;
  [key: string]: unknown;
}

interface Organization {
  id: string;
  name: string;
  plan: string;
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  settings?: OrgSettings | null;
}

type ToastKind = 'success' | 'error';
interface ToastState {
  kind: ToastKind;
  message: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  AGENT: 'Agente',
  AUDITOR: 'Auditor',
};

const TONE_OPTIONS = [
  { value: 'friendly', label: 'Amigável' },
  { value: 'formal', label: 'Formal' },
  { value: 'technical', label: 'Técnico' },
];

const SEGMENT_OPTIONS = [
  { value: 'dentista', label: 'Dentista' },
  { value: 'psicologo', label: 'Psicólogo' },
  { value: 'academia', label: 'Academia' },
  { value: 'advogado', label: 'Advogado' },
  { value: 'salao', label: 'Salão de Beleza' },
  { value: 'petshop', label: 'Pet Shop' },
  { value: 'imobiliaria', label: 'Imobiliária' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'ecommerce', label: 'Loja / E-commerce' },
  { value: 'generic', label: 'Genérico' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const { user } = useAuthStore();

  // ─── Form states (controlled) ─────────────────────────────────
  const [orgName, setOrgName] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);

  const [waPhone, setWaPhone] = useState('');
  const [waBiz, setWaBiz] = useState('');
  const [savingWhatsApp, setSavingWhatsApp] = useState(false);

  const [agentName, setAgentName] = useState('Iza');
  const [agentTone, setAgentTone] = useState('friendly');
  const [agentSegment, setAgentSegment] = useState('generic');
  const [agentHandoff, setAgentHandoff] = useState(
    'Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido!'
  );
  const [savingAI, setSavingAI] = useState(false);

  // Invite form (Team tab)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('AGENT');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviting, setInviting] = useState(false);

  // ─── Load data on mount ───────────────────────────────────────
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [orgRes, teamRes] = await Promise.all([
        api.get<{ data: Organization }>('/api/settings').catch(() => ({ data: null as unknown as Organization })),
        api.get<{ data: TeamMember[] }>('/api/settings/team').catch(() => ({ data: [] as TeamMember[] })),
      ]);

      if (orgRes.data) {
        setOrg(orgRes.data);
        setOrgName(orgRes.data.name || '');
        setWaPhone(orgRes.data.whatsappPhoneNumberId || '');
        setWaBiz(orgRes.data.whatsappBusinessAccountId || '');

        const agent = orgRes.data.settings?.agent;
        if (agent) {
          setAgentName(agent.name || 'Iza');
          setAgentTone(agent.tone || 'friendly');
          setAgentSegment(agent.segment || 'generic');
          setAgentHandoff(
            agent.handoffMessage ||
              'Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido!'
          );
        }
      }
      setTeam(teamRes.data || []);
    } finally {
      setLoading(false);
    }
  }

  // ─── Toast helpers ────────────────────────────────────────────
  function showToast(kind: ToastKind, message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Save handlers ────────────────────────────────────────────
  async function handleSaveGeneral() {
    if (!orgName.trim()) {
      showToast('error', 'Nome da organização é obrigatório');
      return;
    }
    setSavingGeneral(true);
    try {
      const res = await api.put<{ data: Organization }>('/api/settings', { name: orgName.trim() });
      if (res.data) setOrg(res.data);
      showToast('success', 'Configurações gerais salvas');
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Erro ao salvar';
      showToast('error', msg);
    } finally {
      setSavingGeneral(false);
    }
  }

  async function handleSaveWhatsApp() {
    setSavingWhatsApp(true);
    try {
      const res = await api.put<{ data: Organization }>('/api/settings', {
        whatsappPhoneNumberId: waPhone.trim() || null,
        whatsappBusinessAccountId: waBiz.trim() || null,
      });
      if (res.data) setOrg(res.data);
      showToast('success', 'Configurações WhatsApp salvas');
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Erro ao salvar';
      showToast('error', msg);
    } finally {
      setSavingWhatsApp(false);
    }
  }

  async function handleSaveAI() {
    if (!agentName.trim()) {
      showToast('error', 'Nome do agente é obrigatório');
      return;
    }
    setSavingAI(true);
    try {
      // Merge na chave settings.agent preservando outras chaves de settings
      const mergedSettings: OrgSettings = {
        ...(org?.settings || {}),
        agent: {
          name: agentName.trim(),
          tone: agentTone,
          segment: agentSegment,
          handoffMessage: agentHandoff.trim(),
        },
      };
      const res = await api.put<{ data: Organization }>('/api/settings', { settings: mergedSettings });
      if (res.data) setOrg(res.data);
      showToast('success', 'Configurações de IA salvas');
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Erro ao salvar';
      showToast('error', msg);
    } finally {
      setSavingAI(false);
    }
  }

  // ─── Team handlers ────────────────────────────────────────────
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !invitePassword) {
      showToast('error', 'Nome, e-mail e senha são obrigatórios');
      return;
    }
    if (invitePassword.length < 6) {
      showToast('error', 'Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setInviting(true);
    try {
      await api.post('/api/settings/team', {
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        password: invitePassword,
      });
      // Reload team list
      const teamRes = await api.get<{ data: TeamMember[] }>('/api/settings/team');
      setTeam(teamRes.data || []);
      // Reset form
      setInviteName('');
      setInviteEmail('');
      setInviteRole('AGENT');
      setInvitePassword('');
      setInviteOpen(false);
      showToast('success', 'Membro adicionado');
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Erro ao adicionar';
      showToast('error', msg);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string, memberName: string) {
    if (!window.confirm(`Remover ${memberName} da equipe?`)) return;
    try {
      await api.delete(`/api/settings/team/${memberId}`);
      setTeam((prev) => prev.filter((m) => m.id !== memberId));
      showToast('success', `${memberName} removido`);
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Erro ao remover';
      showToast('error', msg);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: 'general', label: 'Geral', icon: Settings },
    { key: 'team', label: 'Equipe', icon: Users },
    { key: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
    { key: 'ai', label: 'IA / Agente', icon: Brain },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="relative">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg max-w-sm ${
            toast.kind === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {toast.kind === 'success' ? (
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm font-medium ${toast.kind === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {toast.message}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da organização</label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano atual</label>
            <p className="text-sm text-primary-600 font-semibold">{org?.plan || '—'}</p>
          </div>
          <button
            onClick={handleSaveGeneral}
            disabled={savingGeneral}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {savingGeneral && <Loader2 size={14} className="animate-spin" />}
            {savingGeneral ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {/* Team */}
      {tab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-3xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Membros da equipe ({team.length})</h3>
            <button
              onClick={() => setInviteOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600"
            >
              <Plus size={14} /> {inviteOpen ? 'Cancelar' : 'Convidar'}
            </button>
          </div>

          {/* Invite form (collapse) */}
          {inviteOpen && (
            <form onSubmit={handleInvite} className="px-5 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nome"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="AGENT">Agente</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="AUDITOR">Auditor</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <input
                  type="password"
                  placeholder="Senha inicial (mín 6 chars)"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  required
                  minLength={6}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {inviting && <Loader2 size={14} className="animate-spin" />}
                {inviting ? 'Adicionando...' : 'Adicionar membro'}
              </button>
              <p className="text-xs text-gray-500">
                O membro poderá entrar com este e-mail e senha em zappiq.com.br/login. Recomende que ele troque a senha no
                primeiro acesso.
              </p>
            </form>
          )}

          <div className="divide-y divide-gray-50">
            {team.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Nenhum membro ainda. Use Convidar acima.</div>
            )}
            {team.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    {member.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.name}{' '}
                      {member.id === user?.id && <span className="text-xs text-gray-400">(você)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                  {member.id !== user?.id && (
                    <button
                      onClick={() => handleRemove(member.id, member.name)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Remover membro"
                    >
                      <Trash2 size={14} />
                    </button>
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
            <input
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ex: 123456789012345"
            />
            <p className="text-xs text-gray-500 mt-1">Disponível no Meta Business Suite, em WhatsApp → API Setup.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Account ID</label>
            <input
              value={waBiz}
              onChange={(e) => setWaBiz(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ex: 987654321098765"
            />
          </div>
          <button
            onClick={handleSaveWhatsApp}
            disabled={savingWhatsApp}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
          >
            {savingWhatsApp && <Loader2 size={14} className="animate-spin" />}
            {savingWhatsApp ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      )}

      {/* AI */}
      {tab === 'ai' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do agente</label>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">É o nome que aparece nas mensagens do WhatsApp.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tom de voz</label>
            <select
              value={agentTone}
              onChange={(e) => setAgentTone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
            <select
              value={agentSegment}
              onChange={(e) => setAgentSegment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              {SEGMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem de handoff</label>
            <textarea
              value={agentHandoff}
              onChange={(e) => setAgentHandoff(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">Texto enviado quando a IA passa o atendimento pra um humano.</p>
          </div>
          <button
            onClick={handleSaveAI}
            disabled={savingAI}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
          >
            {savingAI && <Loader2 size={14} className="animate-spin" />}
            {savingAI ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      )}
    </div>
  );
}
