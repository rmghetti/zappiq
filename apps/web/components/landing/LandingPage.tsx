'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * LandingPage — V4 Chatbase-style (fidelidade modelo Claude Design)
 * --------------------------------------------------------------------------
 * Hybrid cut (V4_DESIGN_REFERENCE.md Onda C seletiva):
 *   - REMOVIDO: LeadMagnetBanner (CTA band 202px — modelo não tem)
 *   - REMOVIDO: BlogPreview (teaser de blog — modelo não tem; /blog vive no nav)
 *   - MANTIDO: OnboardingZero + VozNativa + IzaEstaAqui (strategic commercial blocks)
 *   - MANTIDO: SocialProof (pode ser compactado via prop `compact` depois)
 *
 * Ordem dos blocos:
 *   1. Hero              → promessa canônica
 *   2. SocialProof       → logos / provas
 *   3. PorQueZappIQ      → bento razões
 *   4. OnboardingZero    → diferenciador V4 · R$ 0 setup
 *   5. VozNativa         → diferenciador V4 · voz inbound/outbound
 *   6. HowItWorks        → fluxo produto
 *   7. ROICalculator     → payback + recomendador de tier
 *   8. TrustAndCompliance→ LGPD · AES-256 · SLA
 *   9. IzaEstaAqui       → dogfooding
 *  10. Pricing           → 5 tiers
 *  11. Testimonials      → depoimentos + SLA badge
 *  12. FAQ               → Qs agrupadas
 *  13. CTAFinal          → fecho
 *  14. Footer + WAButton + Toast
 * ══════════════════════════════════════════════════════════════════════════ */

import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { SocialProof } from './SocialProof';
import { PorQueZappIQ } from './PorQueZappIQ';
import { OnboardingZero } from './OnboardingZero';
import { VozNativa } from './VozNativa';
import { HowItWorks } from './HowItWorks';
import { ROICalculator } from './ROICalculator';
import { TrustAndCompliance } from './TrustAndCompliance';
import { IzaEstaAqui } from './IzaEstaAqui';
import { Pricing } from './Pricing';
import { Testimonials } from './Testimonials';
import { FAQ } from './FAQ';
import { CTAFinal } from './CTAFinal';
import { Footer } from './LandingFooter';
import { WhatsAppButton } from './WhatsAppButton';
import { SocialProofToast } from './SocialProofToast';

export function LandingPage() {
  return (
    <div className="overflow-hidden">
      <Navbar />
      <Hero />
      <SocialProof />
      <PorQueZappIQ />
      <OnboardingZero />
      <VozNativa />
      <HowItWorks />
      <ROICalculator />
      <TrustAndCompliance />
      <IzaEstaAqui />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTAFinal />
      <Footer />
      <WhatsAppButton />
      <SocialProofToast />
    </div>
  );
}
