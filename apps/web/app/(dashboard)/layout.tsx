'use client';

import { useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { AuthGuard } from '../../components/AuthGuard';
import { PaywallGate } from '../../components/shared/PaywallGate';
import { TreinarAgenteFAB } from '../../components/dashboard/TreinarAgenteFAB';
import { IzaAjuda } from '../../components/shared/IzaAjuda';
import { useAuthStore } from '../../stores/authStore';
import { connectSocket, disconnectSocket } from '../../lib/socket';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.organizationId) {
      connectSocket();
    }
    return () => { disconnectSocket(); };
  }, [user?.organizationId]);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <PaywallGate />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
        {/* PR #106 — FAB persistente "Treinar ${agentName}" em todas rotas */}
        <TreinarAgenteFAB />
        {/* Fase 2 — Iza Ajuda: chat de suporte da plataforma, canto inferior esquerdo */}
        <IzaAjuda />
      </div>
    </AuthGuard>
  );
}
