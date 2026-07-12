import type { Metadata } from 'next';
import { PublicLayout } from '../../components/landing/PublicLayout';
import { DiagnosticoWizard } from './DiagnosticoWizard';

/* ══════════════════════════════════════════════════════════════════════════
 * /diagnostico: Diagnóstico de Perfil ZappIQ
 * --------------------------------------------------------------------------
 * Server Component. Renderiza o wizard (client) dentro do PublicLayout, no
 * design system da landing. O relatório aparece na própria página, na hora.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: 'Descubra seu plano ideal na ZappIQ',
  description:
    'Diagnóstico gratuito de 2 minutos que recomenda o plano ideal da ZappIQ para o seu negócio, com os produtos e add-ons certos para a sua operação de atendimento e vendas.',
  alternates: {
    canonical: 'https://zappiq.com.br/diagnostico',
  },
};

export default function DiagnosticoPage() {
  return (
    <PublicLayout>
      <DiagnosticoWizard />
    </PublicLayout>
  );
}
