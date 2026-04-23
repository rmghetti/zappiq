'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * LandingPage — V4 Chatbase-style (Onboarding Zero · Voz Nativa · 14 dias grátis)
 * --------------------------------------------------------------------------
 * Ordem dos blocos para a narrativa V4:
 *
 *   1. Hero                 → promessa canônica (IA + voz + 14 dias grátis)
 *   2. SocialProof          → logos / provas sociais
 *   3. PorQueZappIQ         → bento razões (Cloud API direto, Claude, LGPD, etc.)
 *   4. OnboardingZero       → diferenciador V4 #1 · R$ 0 vs R$ 3-8k do mercado
 *   5. VozNativa            → diferenciador V4 #2 · inbound incluso + outbound R$197/R$597
 *   6. HowItWorks           → como funciona (fluxo produto)
 *   7. ROICalculator        → recomendador de tier + payback (inclui toggle voz)
 *   8. TrustAndCompliance   → LGPD · AES-256 · TLS 1.3 · BR · SLA Enterprise
 *   9. IzaEstaAqui          → ZappIQ se vende (dogfooding) — CTA Iza no WhatsApp
 *  10. Pricing              → 3 toggles (anual, Radar 360°, voz) + 5 tiers
 *  11. LeadMagnetBanner     → lead magnet
 *  12. BlogPreview          → blog recente
 *  13. Testimonials         → depoimentos
 *  14. FAQ                  → Qs em grupos com filtro (sem grupo Garantia)
 *  15. CTAFinal             → fecho
 *  16. Footer + WAButton + Toast
 *
 * Blocos removidos do V3.2 (reduzir ruído pré-lançamento):
 *   - ProblemSolution → absorvido em PorQueZappIQ + OnboardingZero
 *   - Products        → movido para /#produtos via Footer (8 módulos canônicos)
 *   - Segments        → movido para /segmentos (página satélite · pós-D-Day)
 *   - Garantia60d     → removido · trial 14 dias → escolha de pagamento, sem garantia
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
