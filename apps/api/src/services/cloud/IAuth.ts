/**
 * IAuth — interface cloud-agnostic pra autenticação.
 *
 * Hoje: Supabase Auth (signup/magic link/OAuth) + JWT próprio pós-onboarding.
 * Futuro: AWS Cognito, Firebase Auth, Auth0, Clerk — cada um wrappa atrás
 * dessa interface.
 *
 * Importante: o JWT proprietário emitido pelo backend ZappIQ (em
 * `apps/api/src/routes/auth.ts`) NÃO faz parte desta interface — ele é
 * stateless e cloud-agnostic por natureza. Aqui cobrimos só o IDP externo.
 */

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  provider: 'supabase' | 'cognito' | 'firebase' | 'auth0' | 'clerk';
  metadata?: Record<string, unknown>;
}

export interface IAuth {
  /**
   * Troca um auth code (PKCE/OAuth) por sessão. Usado em /api/auth/exchange-code.
   * Retorna user + JWT proprietário do backend.
   */
  exchangeCodeForSession(code: string): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken?: string;
  }>;

  /**
   * Envia magic link via email. Backend gera token, envia, retorna OK.
   * Throw em rate limit / email inválido.
   */
  sendMagicLink(email: string, redirectTo: string): Promise<void>;

  /**
   * Cria user admin-side (uso em /api/signup). Email verification depende
   * do provider — alguns mandam confirmation, outros auto-verificam.
   */
  createUser(email: string, options?: {
    emailVerified?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<AuthUser>;

  /**
   * Healthcheck — provider está respondendo?
   */
  ping(): Promise<boolean>;
}
