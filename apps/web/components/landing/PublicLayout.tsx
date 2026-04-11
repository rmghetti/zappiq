'use client';

import { Navbar } from './Navbar';
import { Footer } from './LandingFooter';
import { WhatsAppButton } from './WhatsAppButton';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden">
      <Navbar />
      <main className="pt-32">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
