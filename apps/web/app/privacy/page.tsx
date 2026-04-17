import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Privacy Policy | ZappIQ',
  description: 'ZappIQ Privacy Policy — LGPD compliant data protection.',
};

export default function PrivacyPage() {
  redirect('/lgpd');
}
