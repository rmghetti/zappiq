'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';

// Rotas acessíveis mesmo com trial vencido (bloqueio 'hard'): a pessoa precisa
// conseguir escolher/pagar um plano e sair. Espelha a allowlist da API.
const PAYWALL_ALLOWLIST = ['/billing', '/logout'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, fetchMe, organization } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Trial Enforcement (UX): trial vencido/cancelado sem carência → paywall.
  // A verdade é imposta na API (402); aqui é só o redirecionamento suave.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !organization) return;
    const isAllowed = PAYWALL_ALLOWLIST.some((p) => pathname?.startsWith(p));
    if (organization.paywall === 'hard' && !isAllowed) {
      router.replace('/billing?reason=trial_expired');
    }
  }, [isLoading, isAuthenticated, organization, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
