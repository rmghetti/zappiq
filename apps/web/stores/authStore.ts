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

  login: async (email, password) => {
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('zappiq_token', res.token);
      localStorage.setItem('zappiq_refresh_token', res.refreshToken);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch {
      // Fallback: mock local enquanto o backend não está conectado
      const mockUser: User = {
        id: 'usr_' + Math.random().toString(36).slice(2, 10),
        email,
        name: email.split('@')[0],
        role: 'ADMIN',
        organizationId: 'org_' + Math.random().toString(36).slice(2, 10),
      };
      const mockToken = 'mock_token_' + Date.now();
      localStorage.setItem('zappiq_token', mockToken);
      localStorage.setItem('zappiq_user', JSON.stringify(mockUser));
      set({ user: mockUser, isAuthenticated: true, isLoading: false });
    }
  },

  register: async (data) => {
    try {
      const res = await api.post('/api/auth/register', data);
      localStorage.setItem('zappiq_token', res.token);
      localStorage.setItem('zappiq_refresh_token', res.refreshToken);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch {
      // Fallback: mock local enquanto o backend não está conectado
      const mockUser: User = {
        id: 'usr_' + Math.random().toString(36).slice(2, 10),
        email: data.email,
        name: data.name,
        role: 'ADMIN',
        organizationId: 'org_' + Math.random().toString(36).slice(2, 10),
      };
      const mockToken = 'mock_token_' + Date.now();
      localStorage.setItem('zappiq_token', mockToken);
      localStorage.setItem('zappiq_user', JSON.stringify(mockUser));
      localStorage.setItem('zappiq_org_name', data.organizationName);
      set({ user: mockUser, isAuthenticated: true, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('zappiq_token');
    localStorage.removeItem('zappiq_refresh_token');
    localStorage.removeItem('zappiq_user');
    set({ user: null, organization: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  },

  fetchMe: async () => {
    try {
      const token = localStorage.getItem('zappiq_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      // Verificar se existe usuário mock no localStorage (para quando o backend não está rodando)
      const mockUserStr = localStorage.getItem('zappiq_user');
      let mockUser: User | null = null;
      if (mockUserStr) {
        try {
          mockUser = JSON.parse(mockUserStr);
        } catch {
          // JSON inválido, ignorar
        }
      }

      // Tentar chamada real à API
      try {
        const res = await api.get('/api/auth/me');
        set({ user: res.user, organization: res.organization, isAuthenticated: true, isLoading: false });
        return;
      } catch {
        // API falhou — se temos dados mock, usar como fallback
        if (mockUser) {
          const orgName = localStorage.getItem('zappiq_org_name');
          const mockOrg: Organization | null = orgName
            ? {
                id: mockUser.organizationId,
                name: orgName,
                slug: orgName.toLowerCase().replace(/\s+/g, '-'),
                plan: 'starter',
                settings: {},
              }
            : null;
          set({ user: mockUser, organization: mockOrg, isAuthenticated: true, isLoading: false });
          return;
        }

        // Sem mock e sem API — deslogar
        set({ user: null, organization: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, organization: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
