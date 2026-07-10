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
  Settings, Users, Brain, Plus, Trash2,
  CheckCircle2, AlertCircle, Loader2, CreditCard, Plug, Clock, Zap, Copy, HelpCircle,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import ConectarCanais from '../../../components/dashboard/ConectarCanais';
import { BusinessHoursEditor, defaultBusinessHours, type BusinessHoursConfig } from '../flows/_components/BusinessHoursEditor';
import { IntegrationHelpModal, type HelpTopic } from '../../../components/settings/IntegrationHelpModal';

type Tab = 'general' | 'team' | 'canais' | 'ai' | 'billing' | 'flows' | 'integracoes';

// Zap Impulso — status das integrações do Loop de Receita (sem segredo em claro).
interface ImpulsoIntegrationStatus {
  capi: { datasetId: string | null; configured: boolean };
  asaas: { configured: boolean; webhookToken: string | null };
}

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
      if (h === 'team' || h === 'ai' || h === 'general' || h === 'billing' || h === 'canais' || h === 'flows' || h === 'integracoes') {
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

  // Integrações — Zap Impulso (Loop de Receita: Meta CAPI + Asaas Pix)
  const [impulsoStatus, setImpulsoStatus] = useState<ImpulsoIntegrationStatus | null>(null);
  const [capiDatasetId, setCapiDatasetId] = useState('');
  const [capiAccessToken, setCapiAccessToken] = useState('');
  const [savingCapi, setSavingCapi] = useState(false);
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [savingAsaas, setSavingAsaas] = useState(false);
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

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

      // Zap Impulso — status das integrações (best-effort; não bloqueia a página)
      api
        .get<{ data: ImpulsoIntegrationStatus }>('/api/settings/integrations/zap-impulso')
        .then((r) => {
          if (r.data) {
            setImpulsoStatus(r.data);
            setCapiDatasetId(r.data.capi?.datasetId || '');
          }
        })
        .catch(() => null);
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

  // ─── Zap Impulso — integrações (Loop de Receita) ─────────────
  // Os segredos (access token / API key) vão em texto puro no corpo do PUT,
  // via HTTPS, e o SERVIDOR cifra antes de gravar. O campo do segredo é limpo
  // após salvar para não deixar o valor na tela.
  async function handleSaveCapi() {
    if (!capiDatasetId.trim() || !capiAccessToken.trim()) {
      showToast('error', 'Informe o Dataset ID e o Access Token do Meta.');
      return;
    }
    setSavingCapi(true);
    try {
      const res = await api.put<{ data: ImpulsoIntegrationStatus }>('/api/settings/integrations/zap-impulso', {
        capiDatasetId: capiDatasetId.trim(),
        capiAccessToken: capiAccessToken.trim(),
      });
      if (res.data) setImpulsoStatus(res.data);
      setCapiAccessToken('');
      showToast('success', 'Meta CAPI conectado');
    } catch (err) {
      showToast('error', (err as { message?: string })?.message || 'Erro ao salvar');
    } finally {
      setSavingCapi(false);
    }
  }

  async function handleSaveAsaas() {
    if (!asaasApiKey.trim()) {
      showToast('error', 'Cole a API Key do Asaas.');
      return;
    }
    setSavingAsaas(true);
    try {
      const res = await api.put<{ data: ImpulsoIntegrationStatus }>('/api/settings/integrations/zap-impulso', {
        asaasApiKey: asaasApiKey.trim(),
      });
      if (res.data) setImpulsoStatus(res.data);
      setAsaasApiKey('');
      showToast('success', 'Asaas conectado');
    } catch (err) {
      showToast('error', (err as { message?: string })?.message || 'Erro ao salvar');
    } finally {
      setSavingAsaas(false);
    }
  }

  function copyToClipboard(value: string, label: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(
        () => showToast('success', `${label} copiado`),
        () => showToast('error', 'Não foi possível copiar'),
      );
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

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: 'general', label: 'Geral', icon: Settings },
    { key: 'team', label: 'Equipe', icon: Users },
    { key: 'canais', label: 'Canais', icon: Plug },
    { key: 'ai', label: 'IA / Agente', icon: Brain },
    { key: 'billing', label: 'Cobrança & Limites', icon: CreditCard },
    { key: 'flows', label: 'Fluxos', icon: Clock },
    ...(isAdmin ? [{ key: 'integracoes' as Tab, label: 'Integrações', icon: Zap }] : []),
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

      {tab === 'integracoes' && (
        <div className="max-w-2xl space-y-6">
          <div className="flex items-start gap-3 p-4 bg-violet-50 rounded-lg border border-violet-200">
            <Zap className="text-violet-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-violet-900">Zap Impulso — Loop de Receita</p>
              <p className="text-xs text-violet-700 mt-0.5">
                Conecte o Meta CAPI e o Asaas para fechar o ciclo: o anúncio traz o lead, a Iza
                vende no WhatsApp, o Pix confirma o pagamento e a venda volta para o Meta otimizar
                a campanha. Os tokens são cifrados no servidor e nunca aparecem de volta na tela.
              </p>
            </div>
          </div>

          {/* ── Meta CAPI ── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Meta CAPI (Conversions API)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Devolve as compras ao Meta para otimizar os anúncios Click-to-WhatsApp.</p>
                <button type="button" onClick={() => setHelpTopic('capi')} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700">
                  <HelpCircle size={13} /> Saiba mais e ver o passo a passo
                </button>
              </div>
              {impulsoStatus?.capi.configured ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                  <CheckCircle2 size={13} /> Configurado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                  <AlertCircle size={13} /> Não configurado
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dataset ID (ID do conjunto de dados)</label>
              <input
                type="text"
                value={capiDatasetId}
                onChange={(e) => setCapiDatasetId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="Ex: 1234567890123456"
              />
              <p className="text-xs text-gray-500 mt-1">Meta Events Manager → seu conjunto de dados → Configurações.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Token (token de acesso)</label>
              <input
                type="password"
                value={capiAccessToken}
                onChange={(e) => setCapiAccessToken(e.target.value)}
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none font-mono"
                placeholder={impulsoStatus?.capi.configured ? '•••••••• (já salvo — cole para substituir)' : 'Cole o token gerado no Events Manager'}
              />
              <p className="text-xs text-gray-500 mt-1">Gerado em Events Manager → Configurações → Gerar token de acesso. É secreto: cifrado ao salvar.</p>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleSaveCapi}
                disabled={savingCapi}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingCapi && <Loader2 size={14} className="animate-spin" />}
                {savingCapi ? 'Salvando...' : 'Conectar Meta CAPI'}
              </button>
            </div>
          </div>

          {/* ── Asaas Pix ── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Asaas (Pix na conversa)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Gera a cobrança Pix copia-e-cola direto no WhatsApp e confirma o pagamento.</p>
                <button type="button" onClick={() => setHelpTopic('asaas')} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700">
                  <HelpCircle size={13} /> Saiba mais e ver o passo a passo
                </button>
              </div>
              {impulsoStatus?.asaas.configured ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                  <CheckCircle2 size={13} /> Configurado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                  <AlertCircle size={13} /> Não configurado
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key do Asaas</label>
              <input
                type="password"
                value={asaasApiKey}
                onChange={(e) => setAsaasApiKey(e.target.value)}
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none font-mono"
                placeholder={impulsoStatus?.asaas.configured ? '•••••••• (já salvo — cole para substituir)' : 'Cole a API Key (Asaas → Integrações → API)'}
              />
              <p className="text-xs text-gray-500 mt-1">Asaas → Configurações → Integrações → Chave de API. É secreta: cifrada ao salvar.</p>
            </div>

            {impulsoStatus?.asaas.configured && impulsoStatus.asaas.webhookToken && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-gray-700">Configure o webhook no Asaas com estes dois valores:</p>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-0.5">URL do webhook</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1 truncate">{(process.env.NEXT_PUBLIC_API_URL || '') + '/api/webhook/asaas'}</code>
                    <button type="button" onClick={() => copyToClipboard((process.env.NEXT_PUBLIC_API_URL || '') + '/api/webhook/asaas', 'URL')} className="p-1.5 text-gray-500 hover:text-violet-600" title="Copiar URL"><Copy size={14} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Token de autenticação (Access Token do webhook)</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1 truncate font-mono">{impulsoStatus.asaas.webhookToken}</code>
                    <button type="button" onClick={() => copyToClipboard(impulsoStatus.asaas.webhookToken || '', 'Token')} className="p-1.5 text-gray-500 hover:text-violet-600" title="Copiar token"><Copy size={14} /></button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">No Asaas: Configurações → Integrações → Webhooks → Adicionar. Cole a URL, marque os eventos de pagamento e ponha o token no campo de autenticação.</p>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleSaveAsaas}
                disabled={savingAsaas}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingAsaas && <Loader2 size={14} className="animate-spin" />}
                {savingAsaas ? 'Salvando...' : 'Conectar Asaas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saiba mais das integrações (popup ilustrado) */}
      <IntegrationHelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />
    </div>
  );
}
