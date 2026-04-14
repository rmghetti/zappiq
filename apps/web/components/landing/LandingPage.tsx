'use client';

import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { SocialProof } from './SocialProof';
import { ProblemSolution } from './ProblemSolution';
import { Products } from './Products';
import { Segments } from './Segments';
import { HowItWorks } from './HowItWorks';
import { Testimonials } from './Testimonials';
import { ROICalculator } from './ROICalculator';
import { TrustAndCompliance } from './TrustAndCompliance';
import { Pricing } from './Pricing';
import { LeadMagnetBanner } from './LeadMagnetBanner';
import { BlogPreview } from './BlogPreview';
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
      <ProblemSolution />
      <Products />
      <Segments />
      <HowItWorks />
      <Testimonials />
      <ROICalculator />
      <TrustAndCompliance />
      <Pricing />
      <LeadMagnetBanner />
      <BlogPreview />
      <FAQ />
      <CTAFinal />
      <Footer />
      <WhatsAppButton />
      <SocialProofToast />
    </div>
  );
}
