const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Tipos de resposta padronizados
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: any;
}

interface RequestOptions extends RequestInit {
  data?: any;
}

// Interceptors
type RequestInterceptor = (config: { endpoint: string; options: RequestInit }) => { endpoint: string; options: RequestInit };
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

class ApiClient {
  private baseUrl: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Registrar interceptors
  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
    return () => {
      this.requestInterceptors = this.requestInterceptors.filter(i => i !== interceptor);
    };
  }

  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
    return () => {
      this.responseInterceptors = this.responseInterceptors.filter(i => i !== interceptor);
    };
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('zappiq_token');
  }

  private async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { data, headers: customHeaders, ...rest } = options;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders as Record<string, string>,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let config: RequestInit = {
      ...rest,
      headers,
      ...(data ? { body: JSON.stringify(data) } : {}),
    };

    // Aplicar request interceptors
    let finalEndpoint = endpoint;
    for (const interceptor of this.requestInterceptors) {
      const result = interceptor({ endpoint: finalEndpoint, options: config });
      finalEndpoint = result.endpoint;
      config = result.options;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${finalEndpoint}`, config);
    } catch (err) {
      const networkError: ApiError = {
        status: 0,
        message: 'Erro de conexão com o servidor. Verifique se o backend está rodando.',
        details: err,
      };
      throw networkError;
    }

    // Aplicar response interceptors
    for (const interceptor of this.responseInterceptors) {
      response = await interceptor(response);
    }

    // Tratamento de 401 — tentar refresh de token
    if (response.status === 401) {
      const refreshToken = typeof window !== 'undefined'
        ? localStorage.getItem('zappiq_refresh_token')
        : null;

      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${this.baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem('zappiq_token', refreshData.token);
            if (refreshData.refreshToken) {
              localStorage.setItem('zappiq_refresh_token', refreshData.refreshToken);
            }

            // Retry da requisição original com novo token
            const retryHeaders = { ...config.headers as Record<string, string> };
            retryHeaders['Authorization'] = `Bearer ${refreshData.token}`;
            const retryRes = await fetch(`${this.baseUrl}${finalEndpoint}`, {
              ...config,
              headers: retryHeaders,
            });

            if (!retryRes.ok) {
              const retryError = await retryRes.json().catch(() => ({ error: 'Requisição falhou após refresh de token' }));
              const apiError: ApiError = {
                status: retryRes.status,
                message: retryError.error || retryError.message || `HTTP ${retryRes.status}`,
                details: retryError,
              };
              throw apiError;
            }

            // Retornar corpo vazio caso 204
            if (retryRes.status === 204) return {} as T;
            return retryRes.json();
          }
        } catch (refreshErr) {
          // Se o erro já é um ApiError, propagar
          if ((refreshErr as ApiError).status !== undefined) throw refreshErr;
        }
      }

      // Limpar tokens e redirecionar para login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('zappiq_token');
        localStorage.removeItem('zappiq_refresh_token');
        window.location.href = '/login';
      }
      const unauthorizedError: ApiError = { status: 401, message: 'Não autorizado' };
      throw unauthorizedError;
    }

    // Outros erros HTTP
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Requisição falhou' }));
      const apiError: ApiError = {
        status: response.status,
        message: errorData.error || errorData.message || `HTTP ${response.status}`,
        details: errorData,
      };
      throw apiError;
    }

    // Retornar corpo vazio caso 204
    if (response.status === 204) return {} as T;
    return response.json();
  }

  get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'POST', data });
  }

  put<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'PUT', data });
  }

  patch<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'PATCH', data });
  }

  delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
