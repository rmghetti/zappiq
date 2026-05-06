import { create } from 'zustand';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  avatar?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: any;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; organizationName: string }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isLoading: true,
  isAuthenticated: false,

  // ── PR #101 (Onda 2A) — P0 #3 AUTH BYPASS KILL ──────────────────────────
  // Mock fallback REMOVIDO. authStore agora propaga erro real do backend
  // /api/auth/login (e /register) pra UI. Antes: qualquer credencial fake
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
    set({ user: res.user, isAuthenticated: true, isLoading: false });
  },

  register: async (data) => {
    const res = await api.post('/api/auth/register', data);
    if (!res?.token || !res?.user) {
      throw new Error('Resposta inválida do servidor de cadastro');
    }
    localStorage.setItem('zappiq_token', res.token);
    if (res.refreshToken) localStorage.setItem('zappiq_refresh_token', res.refreshToken);
    set({ user: res.user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('zappiq_token');
    localStorage.removeItem('zappiq_refresh_token');
    localStorage.removeItem('zappiq_user');
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
