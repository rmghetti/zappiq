import { create } from 'zustand';
import { api } from '../lib/api';
// A213: a chave do rascunho do cadastro (que já guardou senha em texto) sai
// do navegador no login e no logout.
import { armazenamentoDoNavegador, limparRascunho } from '../lib/onboardingDraft';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  avatar?: string;
}

export type PaywallMode = 'none' | 'soft' | 'hard' | 'past_due';
export type LifecycleStage =
  | 'CHURNED' | 'PAST_DUE' | 'ACTIVE' | 'TRIAL' | 'TRIAL_EXPIRED' | 'NOVO';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: any;
  // Trial Enforcement — vêm de GET /api/auth/me (fonte única: computeAccessState).
  lifecycleStage?: LifecycleStage;
  paywall?: PaywallMode;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  isTrialActive?: boolean;
  trialConverted?: boolean;
  billingCycle?: string | null;
  paywallGraceUntil?: string | null;
  // Troca de plano agendada (downgrade / anual travado) — faixa no dash.
  pendingPlanChange?: { plan: string; cycle: string; effectiveAt: string | null } | null;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

/**
 * Apaga a chave 'zappiq_onboarding'. Ela nasceu como backup de depuração,
 * nunca foi lida e guardava password e passwordConfirm em texto claro. Hoje
 * ela é o rascunho do questionário, sem senha, e some quando o cliente entra
 * (o rascunho já cumpriu o papel) ou sai.
 */
function limparRascunhoDoNavegador(): void {
  const storage = armazenamentoDoNavegador();
  if (storage) limparRascunho(storage);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isLoading: true,
  isAuthenticated: false,

  // ── PR #101 (Onda 2A) — P0 #3 AUTH BYPASS KILL ──────────────────────────
  // Mock fallback REMOVIDO. authStore agora propaga erro real do backend
  // /api/auth/login pra UI. Antes: qualquer credencial fake
  // logava com role ADMIN via mock — vulnerabilidade crítica de segurança.
  // Backend já existe e está completo (apps/api/src/routes/auth.ts) com
  // bcrypt + JWT + Prisma. Se /api/auth/login falhar (rede/server), erro
  // propaga e UI mostra ErrorBanner — NÃO loga user fake.
  login: async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    if (!res?.token || !res?.user) {
      throw new Error('Resposta inválida do servidor de autenticação');
    }
    localStorage.setItem('zappiq_token', res.token);
    if (res.refreshToken) localStorage.setItem('zappiq_refresh_token', res.refreshToken);
    limparRascunhoDoNavegador();
    set({ user: res.user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('zappiq_token');
    localStorage.removeItem('zappiq_refresh_token');
    localStorage.removeItem('zappiq_user');
    limparRascunhoDoNavegador();
    set({ user: null, organization: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  },

  // PR #101 — fetchMe sem mock fallback. Se backend down, deslogar.
  fetchMe: async () => {
    try {
      const token = localStorage.getItem('zappiq_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      // Limpar resíduos do mock antigo (caso ainda existam de sessão pré-PR #101)
      localStorage.removeItem('zappiq_user');
      localStorage.removeItem('zappiq_org_name');

      const res = await api.get('/api/auth/me');
      set({ user: res.user, organization: res.organization, isAuthenticated: true, isLoading: false });
    } catch {
      // Backend down ou token inválido — deslogar (não criar mock).
      localStorage.removeItem('zappiq_token');
      localStorage.removeItem('zappiq_refresh_token');
      set({ user: null, organization: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
