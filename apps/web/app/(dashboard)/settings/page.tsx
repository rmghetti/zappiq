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
  CheckCircle2, AlertCircle, Loader2, CreditCard, Plug, Clock,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import ConectarCanais from '../../../components/dashboard/ConectarCanais';
import { BusinessHoursEditor, defaultBusinessHours, type BusinessHoursConfig } from '../flows/_components/BusinessHoursEditor';

type Tab = 'general' | 'team' | 'canais' | 'whatsapp' | 'ai' | 'billing' | 'flows';

interface BillingSettings {
  autoOverage?: boolean;
  hardCeilingBrl?: number | null;
  notifyAtPercent?: number; // % do limite a notificar (default 80)
}

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
  businessHoursConfig?: BusinessHoursConfig;
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
  { value: 'psicólogo', label: 'Psicólogo' },
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

  // Deep-link por hash (ex.: /settings#whatsapp vindo do AI Readiness "Conectar
  // WhatsApp"). Lê o hash inicial e reage a mudanças.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      const h = window.location.hash.replace('#', '').toLowerCase();
      // #whatsapp foi unificado em "Canais" — deep-links antigos caem lá.
      if (h === 'whatsapp') { setTab('canais'); return; }
      if (h === 'team' || h === 'ai' || h === 'general' || h === 'billing' || h === 'canais' || h === 'flows') {
        setTab(h as Tab);
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

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

  const [agentName, setAgentName] = useState('');
  const [agentTone, setAgentTone] = useState('friendly');
  const [agentSegment, setAgentSegment] = useState('generic');
  const [agentHandoff, setAgentHandoff] = useState(
    'Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido!'
  );
  const [savingAI, setSavingAI] = useState(false);

  // Business hours (Maestro 1A — E4)
  const [businessHours, setBusinessHours] = useState<BusinessHoursConfig>(defaultBusinessHours());
  const [savingBusinessHours, setSavingBusinessHours] = useState(false);

  // Billing tab (Onda 6 — Quota Mgmt #4 + #5)
  const [autoOverage, setAutoOverage] = useState(false);
  const [hardCeilingBrl, setHardCeilingBrl] = useState<string>('');
  const [notifyAtPercent, setNotifyAtPercent] = useState<number>(80);
  const [savingBilling, setSavingBilling] = useState(false);

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
          setAgentName(agent.name || '');
          setAgentTone(agent.tone || 'friendly');
          setAgentSegment(agent.segment || 'generic');
          setAgentHandoff(
            agent.handoffMessage ||
              'Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido!'
          );
        }

        // PR #111 — billing (Quota Mgmt #4 + #5)
        const billing = (orgRes.data.settings as { billing?: BillingSettings } | null | undefined)?.billing;
        if (billing) {
          setAutoOverage(Boolean(billing.autoOverage));
          setHardCeilingBrl(
            billing.hardCeilingBrl != null ? String(billing.hardCeilingBrl) : ''
          );
          setNotifyAtPercent(
            typeof billing.notifyAtPercent === 'number' ? billing.notifyAtPercent : 80
          );
        }

        // Maestro 1A — business hours
        setBusinessHours(orgRes.data.settings?.businessHoursConfig ?? defaultBusinessHours());
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

  // ─── Billing (PR #111 — Quota Mgmt #4 + #5) ───────────────────
  async function handleSaveBilling() {
    // Validações
    const ceilingNum = hardCeilingBrl.trim() === '' ? null : Number(hardCeilingBrl);
    if (ceilingNum != null && (!Number.isFinite(ceilingNum) || ceilingNum < 0)) {
      showToast('error', 'Teto de gasto inválido. Use número positivo ou deixe vazio.');
      return;
    }
    if (notifyAtPercent < 50 || notifyAtPercent > 100) {
      showToast('error', 'Notificação deve estar entre 50% e 100%.');
      return;
    }
    setSavingBilling(true);
    try {
      const mergedSettings: OrgSettings = {
        ...(org?.settings || {}),
        billing: {
          autoOverage,
          hardCeilingBrl: ceilingNum,
          notifyAtPercent,
        } as BillingSettings,
      };
      const res = await api.put<{ data: Organization }>('/api/settings', { settings: mergedSettings });
      if (res.data) setOrg(res.data);
      showToast('success', 'Preferências de cobrança salvas');
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Erro ao salvar';
      showToast('error', msg);
    } finally {
      setSavingBilling(false);
    }
  }

  // ─── Business hours (Maestro 1A — E4) ────────────────────────
  async function handleSaveBusinessHours() {
    setSavingBusinessHours(true);
    try {
      const mergedSettings: OrgSettings = {
        ...(org?.settings || {}),
        businessHoursConfig: businessHours,
      };
      const res = await api.put<{ data: Organization }>('/api/settings', { settings: mergedSettings });
      if (res.data) setOrg(res.data);
      showToast('success', 'Horário comercial salvo');
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Erro ao salvar';
      showToast('error', msg);
    } finally {
      setSavingBusinessHours(false);
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
    { key: 'canais', label: 'Canais', icon: Plug },
    { key: 'ai', label: 'IA / Agente', icon: Brain },
    { key: 'billing', label: 'Cobrança & Limites', icon: CreditCard },
    { key: 'flows', label: 'Fluxos', icon: Clock },
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

      {/* Canais — UI self-service (#272): card do tutorial interativo + popup +
          cards de conexão WhatsApp/Instagram. O tab "WhatsApp" abaixo segue como
          entrada manual de IDs enquanto o Embedded Signup (config_id + Advanced
          Access) não está liberado. */}
      {tab === 'canais' && <ConectarCanais />}

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

          {/* Privacidade e dados (LGPD) */}
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Privacidade e dados (LGPD)</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href="/legal/privacidade" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 underline">
                Política de Privacidade
              </a>
              <a href="/legal/termos" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 underline">
                Termos de Uso
              </a>
              <a href="/legal/cookies" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 underline">
                Cookies
              </a>
            </div>
            <p className="text-xs text-gray-500">
              Para acessar, corrigir, exportar ou excluir seus dados (art. 18 da LGPD), use o canal
              abaixo. As solicitações são registradas e acompanhadas pelo nosso Encarregado (DPO).
            </p>
            <a
              href="/legal/deletar-dados"
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              <Trash2 size={14} /> Excluir minha conta e meus dados
            </a>
          </div>
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

      {/* Fluxos — Horário comercial (Maestro 1A — E4) */}
      {tab === 'flows' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Horário comercial</h3>
            <p className="text-xs text-gray-500 mb-4">
              Define os horários em que seu negócio está aberto. Usado pelas condições <span className="font-medium">"Horário comercial"</span> nos fluxos de automação.
            </p>
            <BusinessHoursEditor value={businessHours} onChange={setBusinessHours} />
          </div>
          <button
            onClick={handleSaveBusinessHours}
            disabled={savingBusinessHours}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {savingBusinessHours && <Loader2 size={14} className="animate-spin" />}
            {savingBusinessHours ? 'Salvando...' : 'Salvar horário'}
          </button>
        </div>
      )}

      {/* Billing & Limites (PR #111 — Quota Mgmt #4 + #5) */}
      {tab === 'billing' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl space-y-6">
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <CreditCard className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-blue-900">Controle de gastos do plano</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Defina como sua conta deve se comportar quando o limite de mensagens IA do plano for atingido.
                Você está no plano <span className="font-semibold">{org?.plan || '—'}</span>.
              </p>
            </div>
          </div>

          {/* Auto-overage toggle */}
          <div className="flex items-start justify-between gap-4 p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900">
                Auto-overage (continuar atendendo após limite)
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Quando ativo, a IA continua respondendo mesmo após o limite mensal — você paga apenas pelo excedente.
                Quando inativo, conversas extras são pausadas até o próximo ciclo ou upgrade.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoOverage}
              onClick={() => setAutoOverage((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                autoOverage ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  autoOverage ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Hard ceiling */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teto de gasto mensal em overage (R$)
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={hardCeilingBrl}
              onChange={(e) => setHardCeilingBrl(e.target.value)}
              disabled={!autoOverage}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="Ex: 200 (deixe vazio = sem teto)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ao atingir esse valor de gasto extra no mês, a IA é pausada automaticamente. Vazio = sem teto (ilimitado).
            </p>
          </div>

          {/* Notify at % */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notificar ao atingir <span className="font-semibold text-primary-600">{notifyAtPercent}%</span> do limite do plano
            </label>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={notifyAtPercent}
              onChange={(e) => setNotifyAtPercent(Number(e.target.value))}
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enviamos um aviso por e-mail ao admin quando o consumo IA do mês atingir esse percentual.
            </p>
          </div>

          {/* Save */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Faturas, planos e método de pagamento são gerenciados via Stripe (em breve dentro do dashboard).
            </p>
            <button
              onClick={handleSaveBilling}
              disabled={savingBilling}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
            >
              {savingBilling && <Loader2 size={14} className="animate-spin" />}
              {savingBilling ? 'Salvando...' : 'Salvar preferências'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
