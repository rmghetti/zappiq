/* ══════════════════════════════════════════════════════════════════════════
 * app/page.tsx — root dispatcher (V5.3)
 * --------------------------------------------------------------------------
 * Renderiza PrelaunchPage ou LandingPage com base na env LAUNCH_MODE.
 *   LAUNCH_MODE=prelaunch (default até 04/05/2026) → PrelaunchPage
 *   LAUNCH_MODE=live (após lancamento)             → LandingPage
 *
 * /home segue sempre renderizando LandingPage (apps/web/app/home/page.tsx)
 * pra permitir preview da home V5 durante o periodo de teaser.
 *
 * IMPORTANTE: este arquivo e um Server Component (sem 'use client') porque
 * precisa ler process.env.LAUNCH_MODE em build-time / SSR. Os componentes
 * filhos podem ser client conforme necessario.
 *
 * Como flipar pra live no dia 04/05/2026:
 *   1. Vercel → Settings → Env Vars → LAUNCH_MODE = live
 *   2. Redeploy production
 *   3. (Opcional) Adicionar redirect 308 /home → / via next.config
 * ══════════════════════════════════════════════════════════════════════════ */

import { LandingPage } from '../components/landing/LandingPage';
import { PrelaunchPage } from '../components/prelaunch/PrelaunchPage';

/* Força dynamic rendering pra ler process.env.LAUNCH_MODE em request-time
 * (sem isso, Next prerenderiza static no build com env potencialmente vazio).
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Home() {
  const mode = process.env.LAUNCH_MODE?.toLowerCase().trim();
  if (mode === 'prelaunch') {
    return <PrelaunchPage />;
  }
  return <LandingPage />;
}
