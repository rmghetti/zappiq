/* ══════════════════════════════════════════════════════════════════════════
 * app/home/page.tsx — Home V5 sempre acessível (V5.3)
 * --------------------------------------------------------------------------
 * Durante o periodo de teaser (LAUNCH_MODE=prelaunch), a home V5 fica
 * acessivel direto em /home. Util pra time interno e pra preview.
 *
 * Apos o lancamento (LAUNCH_MODE=live), considerar adicionar redirect
 * 308 /home → / via next.config.js pra evitar conteudo duplicado.
 * ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { LandingPage } from '../../components/landing/LandingPage';

export default function HomePage() {
  return <LandingPage />;
}
