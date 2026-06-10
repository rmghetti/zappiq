import { PublicLayout } from '@/components/landing/PublicLayout';
import { NovidadesMeta } from '@/components/landing/NovidadesMeta';

/* ══════════════════════════════════════════════════════════════════════════
 * /novidades-meta — Lançamentos Meta (Conversations Brasil 2026)
 * --------------------------------------------------------------------------
 * Landing de inovação: Meta Business Agent, Business Agent Platform,
 * usernames/BSUID, Marketing Messages API, pagamentos e playbook
 * Engajar→Converter. Posiciona a ZappIQ como uma das primeiras da América
 * Latina a implementar, com pilotos junto a clientes e à Meta.
 *
 * Conteúdo interativo (modais nos 6 cards) vive no client component
 * NovidadesMeta.tsx. Promovida na home via AnnouncementBanner (V3) e
 * MetaNovidadesPopup.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Novidades Meta 2026 — Business Agent, usernames e pagamentos | ZappIQ',
  description:
    'A Meta lançou o Business Agent, usernames e pagamentos sem atrito no WhatsApp. A ZappIQ é uma das primeiras da América Latina a implementar — com pilotos junto a clientes e à Meta.',
};

export default function NovidadesMetaPage() {
  return (
    <PublicLayout>
      <NovidadesMeta />
    </PublicLayout>
  );
}
