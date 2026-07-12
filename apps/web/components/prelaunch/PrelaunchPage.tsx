/* ══════════════════════════════════════════════════════════════════════════
 * PrelaunchPage: V5.3
 * --------------------------------------------------------------------------
 * Página de pré-lançamento (teaser) da ZappIQ.
 * Live até 04/05/2026. Depois desse dia, LAUNCH_MODE=live no Vercel
 * faz a home V5 voltar a renderizar em /.
 *
 * Estrutura:
 *   1. Header sticky (logo ZappIQ + onze&onze.ai prata + tag pill)
 *   2. Hero (countdown + iPhone mockup com Iza)
 *   3. Pillars (Iza · Voz · Radar 360°)
 *   4. Compare (Antes vs Com ZappIQ)
 *   5. EarlyAccess form (POST /api/leads)
 *   6. Footer
 * ══════════════════════════════════════════════════════════════════════════ */

import { PrelaunchHeader } from './PrelaunchHeader';
import { PrelaunchHero } from './PrelaunchHero';
import { PrelaunchPillars } from './PrelaunchPillars';
import { PrelaunchCompare } from './PrelaunchCompare';
import { EarlyAccessForm } from './EarlyAccessForm';
import { PrelaunchFooter } from './PrelaunchFooter';

export function PrelaunchPage() {
  return (
    <>
      <PrelaunchHeader />
      <main>
        <PrelaunchHero />
        <PrelaunchPillars />
        <PrelaunchCompare />
        <EarlyAccessForm />
      </main>
      <PrelaunchFooter />
    </>
  );
}
