'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * LandingPage: V7 (curadoria pós-auditoria, 12/07/2026)
 * --------------------------------------------------------------------------
 * Hybrid cut (V4_DESIGN_REFERENCE.md Onda C seletiva):
 *   - REMOVIDO: LeadMagnetBanner (CTA band 202px, modelo não tem)
 *   - REMOVIDO: BlogPreview (teaser de blog, modelo não tem; /blog vive no nav)
 *   - MANTIDO: OnboardingZero + VozNativa + IzaEstaAqui (strategic commercial blocks)
 *   - MANTIDO: SocialProof (pode ser compactado via prop `compact` depois)
 *
 * Curadoria V7 (auditoria PhD, achado rank 13): a home contava a tese da
 * autonomia 3x (PlataformaAutonoma, JornadaLead, MaestroSection, HowItWorks
 * repetiam o mesmo argumento). Cortados do render (arquivos preservados, não
 * deletados, viram base de futuras páginas de produto):
 *   - HowItWorks   → redundante com PlataformaAutonoma + JornadaLead
 *   - MaestroSection → deep-dive de 1 produto só; melhor como página própria
 * AgentQualityProactive subiu pra logo após JornadaLead: vira a PROVA em
 * profundidade de um dos 3 pilares que PlataformaAutonoma acabou de prometer.
 *
 * Ordem dos blocos (5 atos, V7):
 *   Ato 1 · Promessa   → Hero, SocialProof
 *   Ato 2 · Operação   → PorQueZappIQ, ComVsSem, PlataformaAutonoma, JornadaLead, AgentQualityProactive
 *   Ato 3 · Extensões  → MiraProspects, VozNativa, OnboardingZero
 *   Ato 4 · Decisão    → ROICalculator, TrustAndCompliance, IzaEstaAqui, Pricing
 *   Ato 5 · Fecho      → FAQ, CTAFinal, Footer
 *
 * Programa Fundadores removido (13/07/2026, decisão do fundador): campanha
 * descontinuada. Bloco Testimonials (que era o convite Fundadores) fora do
 * render; arquivo preservado. Prova de cliente real virá em material proprio.
 * ══════════════════════════════════════════════════════════════════════════ */

import { Navbar } from './Navbar';
import { AnnouncementBanner } from './AnnouncementBanner';
import { Hero } from './Hero';
import { SocialProof } from './SocialProof';
import { PorQueZappIQ } from './PorQueZappIQ';
import { ComVsSem } from './ComVsSem';
import { OnboardingZero } from './OnboardingZero';
import { VozNativa } from './VozNativa';
import { PlataformaAutonoma } from './PlataformaAutonoma';
import { JornadaLead } from './JornadaLead';
import { MiraProspects } from './MiraProspects';
import { ROICalculator } from './ROICalculator';
import { AgentQualityProactive } from './AgentQualityProactive';
import { TrustAndCompliance } from './TrustAndCompliance';
import { IzaEstaAqui } from './IzaEstaAqui';
import { Pricing } from './Pricing';
import { FAQ } from './FAQ';
import { CTAFinal } from './CTAFinal';
import { Footer } from './LandingFooter';
import { WhatsAppButton } from './WhatsAppButton';
import { MobileStickyCTA } from './MobileStickyCTA';
import { SocialProofToast } from './SocialProofToast';
import { MetaNovidadesPopup } from './MetaNovidadesPopup';

export function LandingPage() {
  return (
    <div className="overflow-hidden">
      <AnnouncementBanner />
      <Navbar />
      <Hero />
      <SocialProof />
      <PorQueZappIQ />
      <ComVsSem />
      <PlataformaAutonoma />
      <JornadaLead />
      <AgentQualityProactive />
      <MiraProspects />
      <VozNativa />
      <OnboardingZero />
      <ROICalculator />
      <TrustAndCompliance />
      <IzaEstaAqui />
      <Pricing />
      <FAQ />
      <CTAFinal />
      <Footer />
      <WhatsAppButton />
      <MobileStickyCTA />
      <SocialProofToast />
      <MetaNovidadesPopup />
    </div>
  );
}
