// ── API Response types ─────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Auth ────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
  };
}

// ── Socket Events ──────────────────────────────
export interface SocketEvents {
  new_message: {
    conversationId: string;
    message: {
      id: string;
      content: string;
      direction: string;
      type: string;
      isFromBot: boolean;
      createdAt: string;
    };
  };
  conversation_assigned: {
    conversationId: string;
    agentId: string;
    agentName: string;
  };
  conversation_closed: {
    conversationId: string;
  };
  agent_typing: {
    conversationId: string;
    agentId: string;
  };
  notification: {
    type: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message: string;
  };
  dashboard_update: {
    metric: string;
    value: number;
  };
}
