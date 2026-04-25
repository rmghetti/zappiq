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
 * Ordem dos blocos (V5):
 *   1. Hero              → promessa canônica
 *   2. SocialProof       → logos / provas
 *   3. PorQueZappIQ      → bento razões
 *   4. ComVsSem          → antes vs depois (promovido V5)
 *   5. OnboardingZero    → diferenciador · R$ 0 setup
 *   6. VozNativa         → diferenciador · voz inbound/outbound
 *   7. HowItWorks        → fluxo produto
 *   8. ROICalculator     → payback + recomendador de tier
 *   9. TrustAndCompliance→ LGPD · segurança · SLA
 *  10. IzaEstaAqui       → dogfooding
 *  11. Pricing           → 5 tiers (sem Com vs Sem, agora standalone)
 *  12. Testimonials      → depoimentos + SLA badge
 *  13. FAQ               → Qs agrupadas
 *  14. CTAFinal          → fecho
 *  15. Footer + WAButton + Toast
 * ══════════════════════════════════════════════════════════════════════════ */

import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { SocialProof } from './SocialProof';
import { PorQueZappIQ } from './PorQueZappIQ';
import { ComVsSem } from './ComVsSem';
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
      <ComVsSem />
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
