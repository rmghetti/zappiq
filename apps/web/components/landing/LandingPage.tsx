'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * LandingPage — V3.2 (Onboarding Zero · Voz Nativa · Garantia 60d)
 * --------------------------------------------------------------------------
 * Ordem dos blocos reconstruída para a narrativa V3.2:
 *
 *   1. Hero                 → promessa canônica (IA + voz + 30d grátis / 60d garantia)
 *   2. SocialProof          → logos / provas sociais
 *   3. PorQueZappIQ         → 8 razões objetivas (Cloud API direto, Claude, LGPD, etc.)
 *   4. OnboardingZero       → diferenciador V3.2 #1 · R$ 0 vs R$ 3-8k do mercado
 *   5. VozNativa            → diferenciador V3.2 #2 · inbound incluso + outbound R$197/R$597
 *   6. HowItWorks           → como funciona (fluxo produto)
 *   7. Garantia60d          → diferenciador V3.2 #3 · 30 dias grátis + 60 dias garantia
 *   8. ROICalculator        → recomendador de tier + payback (inclui toggle voz)
 *   9. TrustAndCompliance   → LGPD · AES-256 · TLS 1.3 · BR · SLA Enterprise
 *  10. IzaEstaAqui          → ZappIQ se vende (dogfooding) — CTA Iza no WhatsApp
 *  11. Pricing              → 3 toggles (anual, Radar 360°, voz)
 *  12. LeadMagnetBanner     → lead magnet
 *  13. BlogPreview          → blog recente
 *  14. Testimonials         → depoimentos (movido para após BlogPreview, suavizar ritmo)
 *  15. FAQ                  → 25 Qs em 7 grupos com filtro
 *  16. CTAFinal             → fecho
 *  17. Footer + WAButton + Toast
 *
 * Blocos removidos do V3.2 (reduzir ruído pré-lançamento):
 *   - ProblemSolution → absorvido em PorQueZappIQ + OnboardingZero
 *   - Products        → movido para /#produtos via Footer (8 módulos canônicos)
 *   - Segments        → movido para /segmentos (página satélite · pós-D-Day)
 * ══════════════════════════════════════════════════════════════════════════ */

import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { SocialProof } from './SocialProof';
import { PorQueZappIQ } from './PorQueZappIQ';
import { OnboardingZero } from './OnboardingZero';
import { VozNativa } from './VozNativa';
import { HowItWorks } from './HowItWorks';
import { Garantia60d } from './Garantia60d';
import { ROICalculator } from './ROICalculator';
import { TrustAndCompliance } from './TrustAndCompliance';
import { IzaEstaAqui } from './IzaEstaAqui';
import { Pricing } from './Pricing';
import { LeadMagnetBanner } from './LeadMagnetBanner';
import { BlogPreview } from './BlogPreview';
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
      <Garantia60d />
      <ROICalculator />
      <TrustAndCompliance />
      <IzaEstaAqui />
      <Pricing />
      <LeadMagnetBanner />
      <BlogPreview />
      <Testimonials />
      <FAQ />
      <CTAFinal />
      <Footer />
      <WhatsAppButton />
      <SocialProofToast />
    </div>
  );
}
