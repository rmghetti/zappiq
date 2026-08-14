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
import Link from 'next/link';
import {
  Settings, Users, Brain, Plus, Trash2,
  CheckCircle2, AlertCircle, Loader2, CreditCard, Plug, Clock, Zap, Copy, HelpCircle,
  Building2, ArrowRight, Power, KeyRound, Sparkles, BarChart3, Megaphone, Pencil,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import ConectarCanais from '../../../components/dashboard/ConectarCanais';
import { BusinessHoursEditor, defaultBusinessHours, type BusinessHoursConfig } from '../flows/_components/BusinessHoursEditor';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { IntegrationHelpModal, type HelpTopic } from '../../../components/settings/IntegrationHelpModal';
import { useAgentReadiness, readinessLevelColor, readinessLevelLabel } from '../../../hooks/useAgentReadiness';

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
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

// Saúde de canais (mesmo shape de GET /api/settings/channels/health)
interface ChannelHealthInfo {
  channel: 'whatsapp' | 'instagram';
  connected: boolean;
  viaGlobal?: boolean;
  qualityRating?: string | null;
}

// Uso do plano (GET /api/billing/usage); limit -1 = ilimitado
interface UsageMeter {
  used: number;
  limit: number;
}
interface BillingUsage {
  planId: string;
  period: string;
  conversas: UsageMeter;
  atendentes: UsageMeter;
  docs: UsageMeter;
  aiMessages: UsageMeter;
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
  slug?: string;
  createdAt?: string;
  billingCycle?: string | null;
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  settings?: OrgSettings | null;
}

type ToastKind = 'success' | 'error';
interface ToastState {
  kind: ToastKind;
  message: string;
}

// Perfis de acesso (14/08) — nomes, descrição do que cada um faz e cor do
// badge. Espelha a whitelist do backend (settings.team.ts): SUPERADMIN não é
// atribuível por org (papel de plataforma), mas tem label pra exibição.
const ROLE_INFO: Record<string, { label: string; desc: string; badge: string }> = {
  ADMIN: {
    label: 'Administrador',
    desc: 'Acesso total à organização: canais, IA, equipe, cobrança e configurações.',
    badge: 'bg-violet-50 text-violet-700 border border-violet-200',
  },
  SUPERVISOR: {
    label: 'Supervisor',
    desc: 'Comanda a operação: conversas, CRM, campanhas, treino da IA e relatórios. Não altera configurações estruturais nem cobrança.',
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  AGENT: {
    label: 'Atendente',
    desc: 'Atende as conversas e edita contatos. Sem acesso a configurações, equipe ou números do negócio.',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  AUDITOR: {
    label: 'Auditor',
    desc: 'Somente leitura de auditoria e requisições LGPD (compliance). Não atende nem configura.',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  SUPERADMIN: {
    label: 'Superadmin',
    desc: 'Administração da plataforma ZappIQ.',
    badge: 'bg-gray-900 text-white border border-gray-700',
  },
};

// "Último acesso" humano. Sem data = conta nunca entrou (convite parado).
function fmtRelative(iso?: string | null): string {
  if (!iso) return 'nunca entrou';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// Barra de consumo do plano (limit -1 = ilimitado).
function UsageBar({ label, meter }: { label: string; meter?: UsageMeter }) {
  if (!meter) return null;
  const unlimited = meter.limit < 0;
  const pct = unlimited || meter.limit === 0 ? 0 : Math.min(100, Math.round((meter.used / meter.limit) * 100));
  const tone = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary-500';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-medium text-gray-900 tabular-nums">
          {meter.used.toLocaleString('pt-BR')}
          <span className="text-gray-400"> / {unlimited ? 'ilimitado' : meter.limit.toLocaleString('pt-BR')}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${unlimited ? 'bg-emerald-400 w-1' : tone}`} style={unlimited ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
  // 14/08 — Equipe profissional: senha temporária gerada no servidor (padrão)
  // exibida UMA vez; edição de papel e ativar/desativar por membro.
  const [autoPassword, setAutoPassword] = useState(true);
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null);
  const [memberBusy, setMemberBusy] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  // 14/08 — Visão geral (aba Geral): fontes extras best-effort
  const [channels, setChannels] = useState<ChannelHealthInfo[]>([]);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const { readiness } = useAgentReadiness();

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

        // Prefere as chaves top-level (que o backend realmente lê); cai pro
        // objeto aninhado `agent` só como legado de orgs salvas antes do fix.
        const s = (orgRes.data.settings || {}) as Record<string, any>;
        const agent = s.agent || {};
        setAgentName(s.agentName ?? agent.name ?? '');
        setAgentTone(s.tone ?? agent.tone ?? 'friendly');
        setAgentSegment(s.segmento ?? s.niche ?? agent.segment ?? 'generic');
        setAgentHandoff(
          s.handoffMessage ??
            agent.handoffMessage ??
            'Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido!'
        );

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

      // Visão geral — saúde de canais + uso do plano (best-effort)
      api
        .get<{ data: ChannelHealthInfo[] }>('/api/settings/channels/health')
        .then((r) => setChannels(r.data || []))
        .catch(() => null);
      api
        .get<{ data: BillingUsage }>('/api/billing/usage')
        .then((r) => { if (r.data) setUsage(r.data); })
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
      // Grava nas chaves TOP-LEVEL que o backend realmente lê (tone, segmento,
      // niche, agentName, handoffMessage) — é isso que alimenta o prompt do
      // agente (fallback), o Maestro e o readiness. Mantém o objeto `agent`
      // aninhado por compatibilidade com telas que ainda o leem.
      const mergedSettings: OrgSettings = {
        ...(org?.settings || {}),
        agentName: agentName.trim(),
        tone: agentTone,
        segmento: agentSegment,
        niche: agentSegment,
        handoffMessage: agentHandoff.trim(),
        agent: {
          name: agentName.trim(),
          tone: agentTone,
          segment: agentSegment,
          handoffMessage: agentHandoff.trim(),
        },
      } as OrgSettings;
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
    if (!inviteName.trim() || !inviteEmail.trim()) {
      showToast('error', 'Nome e e-mail são obrigatórios');
      return;
    }
    if (!autoPassword && invitePassword.length < 8) {
      showToast('error', 'Senha deve ter no mínimo 8 caracteres');
      return;
    }
    setInviting(true);
    try {
      // Sem senha no corpo, o servidor gera a temporária e devolve UMA vez.
      const res = await api.post<{ data: TeamMember; tempPassword?: string }>('/api/settings/team', {
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        ...(autoPassword ? {} : { password: invitePassword }),
      });
      // Reload team list
      const teamRes = await api.get<{ data: TeamMember[] }>('/api/settings/team');
      setTeam(teamRes.data || []);
      if (res.tempPassword) {
        setTempCredentials({ email: inviteEmail.trim().toLowerCase(), password: res.tempPassword });
      }
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

  async function handleUpdateMember(memberId: string, patch: { role?: string; isActive?: boolean }) {
    setMemberBusy(memberId);
    try {
      const res = await api.put<{ data: Partial<TeamMember> }>(`/api/settings/team/${memberId}`, patch);
      setTeam((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...(res.data || patch) } : m)));
      setEditingRoleId(null);
      showToast(
        'success',
        patch.isActive === false ? 'Acesso desativado' : patch.isActive === true ? 'Acesso reativado' : 'Papel atualizado',
      );
    } catch (err) {
      showToast('error', (err as { message?: string })?.message || 'Erro ao atualizar membro');
    } finally {
      setMemberBusy(null);
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
  // 14/08 — ordem por frequência de uso (dia-a-dia primeiro, Equipe por
  // último) e visibilidade por papel: Supervisor opera canais/IA/fluxos;
  // Atendente e Auditor só enxergam a visão Geral (o backend já bloqueia as
  // escritas; esconder a aba é honestidade de UX, não a segurança em si).
  const roleNow = user?.role ?? '';
  const OPERATION_ROLES = ['ADMIN', 'SUPERADMIN', 'SUPERVISOR'];
  const allTabs: { key: Tab; label: string; icon: typeof Settings; roles?: string[] }[] = [
    { key: 'general', label: 'Geral', icon: Settings },
    { key: 'canais', label: 'Canais', icon: Plug, roles: OPERATION_ROLES },
    { key: 'ai', label: 'IA / Agente', icon: Brain, roles: OPERATION_ROLES },
    { key: 'flows', label: 'Fluxos', icon: Clock, roles: OPERATION_ROLES },
    { key: 'billing', label: 'Cobrança & Limites', icon: CreditCard, roles: ['ADMIN', 'SUPERADMIN'] },
    { key: 'integracoes', label: 'Integrações', icon: Zap, roles: ['ADMIN', 'SUPERADMIN'] },
    { key: 'team', label: 'Equipe', icon: Users, roles: ['ADMIN', 'SUPERADMIN'] },
  ];
  const tabs = allTabs.filter((t) => !t.roles || t.roles.includes(roleNow));
  // Deep-link pra aba sem permissão cai na Geral.
  const activeTab: Tab = tabs.some((t) => t.key === tab) ? tab : 'general';

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
              activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
      {activeTab === 'canais' && <ConectarCanais />}

      {/* General — visão geral completa (14/08): cartões com o estado real da
          conta (empresa, plano e uso, canais, IA, equipe, horário) + atalhos.
          Fontes: GET /settings (org), /settings/team, /settings/channels/health,
          /billing/usage e useAgentReadiness — nenhuma API nova. */}
      {activeTab === 'general' && (() => {
        const activeMembers = team.filter((m) => m.isActive !== false);
        const onlineCount = activeMembers.filter((m) => m.isOnline).length;
        const roleCounts = activeMembers.reduce<Record<string, number>>((acc, m) => {
          acc[m.role] = (acc[m.role] || 0) + 1;
          return acc;
        }, {});
        const wa = channels.find((c) => c.channel === 'whatsapp');
        const ig = channels.find((c) => c.channel === 'instagram');
        const daysCfg = (businessHours?.days ?? {}) as Record<number, { open: string; close: string } | null>;
        const today = daysCfg[new Date().getDay()] ?? null;
        const openDays = Object.values(daysCfg).filter(Boolean).length;
        const lvl = readiness ? readinessLevelColor(readiness.level) : null;
        const nextAction = readiness?.nextActions?.find((a) => !a.completed);
        const canGo = (key: Tab) => tabs.some((t) => t.key === key);
        return (
          <div className="space-y-4">
            {/* Linha 1 — Empresa + Plano e uso */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 size={16} className="text-gray-400" /> Empresa
                  </h3>
                  <span className="text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-100 rounded-full px-2.5 py-0.5">
                    {org?.plan || '—'}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome da organização</label>
                  <div className="flex gap-2">
                    <input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                    <button
                      onClick={handleSaveGeneral}
                      disabled={savingGeneral}
                      className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                    >
                      {savingGeneral && <Loader2 size={14} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-gray-500 mb-0.5">ID da conta</p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(org?.id || '', 'ID da conta')}
                      className="inline-flex items-center gap-1 font-mono text-gray-700 hover:text-primary-600 max-w-full"
                      title="Copiar ID da conta"
                    >
                      <span className="truncate">{org?.id || '—'}</span> <Copy size={12} className="flex-shrink-0" />
                    </button>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-0.5">No ZappIQ desde</p>
                    <p className="font-medium text-gray-700">
                      {org?.createdAt ? new Date(org.createdAt).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <CreditCard size={16} className="text-gray-400" /> Plano e uso do mês
                    <SaibaMais featureKey="settings.general.plano-atual" />
                  </h3>
                  <Link href="/billing" className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
                    Plano & Fatura <ArrowRight size={12} />
                  </Link>
                </div>
                {usage ? (
                  <div className="space-y-3">
                    <UsageBar label="Conversas" meter={usage.conversas} />
                    <UsageBar label="Mensagens de IA" meter={usage.aiMessages} />
                    <UsageBar label="Atendentes" meter={usage.atendentes} />
                    <UsageBar label="Documentos de treino" meter={usage.docs} />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Carregando consumo…</p>
                )}
              </div>
            </div>

            {/* Linha 2 — status: Canais, IA, Equipe, Horário */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => canGo('canais') && setTab('canais')}
                className={`text-left bg-white rounded-xl border border-gray-100 p-5 transition-shadow ${canGo('canais') ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Plug size={15} className="text-gray-400" /> Canais
                  </h3>
                  {canGo('canais') && <ArrowRight size={13} className="text-gray-300" />}
                </div>
                {[{ info: wa, label: 'WhatsApp' }, { info: ig, label: 'Instagram' }].map(({ info, label }) => (
                  <div key={label} className="flex items-center justify-between py-1">
                    <span className="text-xs text-gray-600">{label}</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${info?.connected ? 'text-green-700' : 'text-gray-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${info?.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {info ? (info.connected ? 'Conectado' : 'Desconectado') : '—'}
                    </span>
                  </div>
                ))}
              </button>

              <Link href="/ai-training" className="block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Brain size={15} className="text-gray-400" /> Agente de IA
                  </h3>
                  <ArrowRight size={13} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{agentName || 'Sem nome definido'}</p>
                {readiness && lvl ? (
                  <span className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-0.5 border ${lvl.bg} ${lvl.text} ${lvl.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${lvl.dot}`} />
                    {readiness.score}/100 · {readinessLevelLabel(readiness.level)}
                  </span>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Prontidão indisponível</p>
                )}
                {nextAction && (
                  <p className="text-[11px] text-gray-500 mt-2 line-clamp-2">Próximo passo: {nextAction.title}</p>
                )}
              </Link>

              <button
                type="button"
                onClick={() => canGo('team') && setTab('team')}
                className={`text-left bg-white rounded-xl border border-gray-100 p-5 transition-shadow ${canGo('team') ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users size={15} className="text-gray-400" /> Equipe
                  </h3>
                  {canGo('team') && <ArrowRight size={13} className="text-gray-300" />}
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {activeMembers.length} {activeMembers.length === 1 ? 'membro ativo' : 'membros ativos'}
                </p>
                <p className="text-xs text-gray-500">{onlineCount} online agora</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(roleCounts).map(([r, n]) => (
                    <span key={r} className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${ROLE_INFO[r]?.badge || 'bg-gray-100 text-gray-600'}`}>
                      {n} {ROLE_INFO[r]?.label || r}
                    </span>
                  ))}
                </div>
              </button>

              <button
                type="button"
                onClick={() => canGo('flows') && setTab('flows')}
                className={`text-left bg-white rounded-xl border border-gray-100 p-5 transition-shadow ${canGo('flows') ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Clock size={15} className="text-gray-400" /> Horário de atendimento
                  </h3>
                  {canGo('flows') && <ArrowRight size={13} className="text-gray-300" />}
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {today ? `Hoje: ${today.open} às ${today.close}` : 'Hoje: sem atendimento'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {openDays} {openDays === 1 ? 'dia' : 'dias'} por semana com atendimento
                </p>
              </button>
            </div>

            {/* Atalhos rápidos */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Atalhos rápidos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { href: '/ai-training', label: 'Treinar IA', icon: Sparkles },
                  { href: '/analytics', label: 'Radar 360°', icon: BarChart3 },
                  { href: '/campaigns', label: 'Zap Impulso', icon: Megaphone },
                  { href: '/billing', label: 'Plano & Fatura', icon: CreditCard },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-100 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Icon size={15} className="text-gray-400" /> {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Team — Equipe profissional (14/08): perfis com descrição, senha
          temporária exibida uma única vez, editar papel, ativar/desativar e
          último acesso. Guardas do backend em settings.team.ts. */}
      {activeTab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-w-3xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
              Membros da equipe ({team.length})
              <SaibaMais featureKey="settings.team.papeis" />
            </h3>
            {isAdmin && (
              <button
                onClick={() => setInviteOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600"
              >
                <Plus size={14} /> {inviteOpen ? 'Cancelar' : 'Convidar'}
              </button>
            )}
          </div>

          {/* Invite form (collapse) */}
          {inviteOpen && isAdmin && (
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil de acesso</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  {(['AGENT', 'SUPERVISOR', 'AUDITOR', 'ADMIN'] as const).map((r) => (
                    <option key={r} value={r}>{ROLE_INFO[r].label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{ROLE_INFO[inviteRole]?.desc}</p>
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="auto-pass"
                  type="checkbox"
                  checked={autoPassword}
                  onChange={(e) => setAutoPassword(e.target.checked)}
                  className="mt-0.5 accent-primary-500"
                />
                <label htmlFor="auto-pass" className="text-xs text-gray-600">
                  <span className="font-medium text-gray-800">Gerar senha temporária automaticamente</span> (recomendado):
                  a senha aparece uma única vez para você copiar e enviar ao membro.
                </label>
              </div>
              {!autoPassword && (
                <input
                  type="password"
                  placeholder="Senha inicial (mín 8 caracteres)"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              )}
              <button
                type="submit"
                disabled={inviting}
                className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {inviting && <Loader2 size={14} className="animate-spin" />}
                {inviting ? 'Adicionando...' : 'Adicionar membro'}
              </button>
              <p className="text-xs text-gray-500">
                O membro entra com o e-mail e a senha em zappiq.com.br/login e deve trocar a senha no primeiro acesso.
              </p>
            </form>
          )}

          <div className="divide-y divide-gray-50">
            {team.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Nenhum membro ainda. Use Convidar acima.</div>
            )}
            {team.map((member) => {
              const inactive = member.isActive === false;
              const isSelf = member.id === user?.id;
              const info = ROLE_INFO[member.role];
              return (
                <div key={member.id} className={`flex items-center justify-between px-5 py-3 gap-3 ${inactive ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      {member.isOnline && !inactive && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.name}{' '}
                        {isSelf && <span className="text-xs text-gray-400">(você)</span>}
                        {inactive && (
                          <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5">
                            Desativado
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {member.email} · último acesso: {fmtRelative(member.lastLoginAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingRoleId === member.id ? (
                      <select
                        autoFocus
                        value={member.role}
                        onChange={(e) => handleUpdateMember(member.id, { role: e.target.value })}
                        onBlur={() => setEditingRoleId(null)}
                        className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {(['AGENT', 'SUPERVISOR', 'AUDITOR', 'ADMIN'] as const).map((r) => (
                          <option key={r} value={r}>{ROLE_INFO[r].label}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${info?.badge || 'bg-gray-100 text-gray-500'}`}
                        title={info?.desc}
                      >
                        {info?.label || member.role}
                      </span>
                    )}
                    {isAdmin && !isSelf && member.role !== 'SUPERADMIN' && (
                      <>
                        <button
                          onClick={() => setEditingRoleId(editingRoleId === member.id ? null : member.id)}
                          disabled={memberBusy === member.id}
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title="Alterar papel"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleUpdateMember(member.id, { isActive: inactive })}
                          disabled={memberBusy === member.id}
                          className={`p-1 text-gray-400 ${inactive ? 'hover:text-green-600' : 'hover:text-amber-600'}`}
                          title={inactive ? 'Reativar acesso' : 'Desativar acesso'}
                        >
                          {memberBusy === member.id ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                        </button>
                        <button
                          onClick={() => handleRemove(member.id, member.name)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Remover membro"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI */}
      {activeTab === 'ai' && (
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
            <label className="text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
              Tom de voz
              <SaibaMais featureKey="settings.ai.tom-de-voz" />
            </label>
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
            <label className="text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
              Segmento
              <SaibaMais featureKey="settings.ai.segmento" />
            </label>
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
      {activeTab === 'flows' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1 inline-flex items-center gap-1">
              Horário comercial
              <SaibaMais featureKey="settings.flows.horario-comercial" />
            </h3>
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
      {activeTab === 'billing' && (
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
              <label className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
                Auto-overage (continuar atendendo após limite)
                <SaibaMais featureKey="settings.billing.auto-overage" />
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
            <label className="text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
              Teto de gasto mensal em overage (R$)
              <SaibaMais featureKey="settings.billing.teto-gasto" />
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

      {activeTab === 'integracoes' && (
        <div className="max-w-2xl space-y-6">
          <div className="flex items-start gap-3 p-4 bg-violet-50 rounded-lg border border-violet-200">
            <Zap className="text-violet-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-violet-900">Zap Impulso — Loop de Receita</p>
              <p className="text-xs text-violet-700 mt-0.5">
                Conecte o Meta CAPI e o Asaas para fechar o ciclo: o anúncio traz o lead, a IA
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

      {/* Senha temporária — exibida UMA única vez (fluxo sem servidor de e-mail) */}
      {tempCredentials && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <KeyRound size={18} className="text-primary-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Acesso criado</h3>
                <p className="text-xs text-gray-500">Envie estes dados ao novo membro pelo canal que preferir.</p>
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800 font-medium">
                Esta senha não será mostrada de novo. Copie agora e peça a troca no primeiro acesso.
              </p>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-0.5">E-mail de acesso</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 truncate">{tempCredentials.email}</code>
                  <button type="button" onClick={() => copyToClipboard(tempCredentials.email, 'E-mail')} className="p-1.5 text-gray-500 hover:text-primary-600" title="Copiar e-mail">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Senha temporária</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 font-mono">{tempCredentials.password}</code>
                  <button type="button" onClick={() => copyToClipboard(tempCredentials.password, 'Senha')} className="p-1.5 text-gray-500 hover:text-primary-600" title="Copiar senha">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `Acesso ZappIQ\nEntrar: zappiq.com.br/login\nE-mail: ${tempCredentials.email}\nSenha temporária: ${tempCredentials.password}\nTroque a senha no primeiro acesso.`,
                    'Dados de acesso',
                  )
                }
                className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
              >
                <Copy size={13} /> Copiar tudo
              </button>
              <button
                type="button"
                onClick={() => setTempCredentials(null)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800"
              >
                Concluir
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
