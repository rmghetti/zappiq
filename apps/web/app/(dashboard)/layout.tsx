'use client';

import { useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { AuthGuard } from '../../components/AuthGuard';
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
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
