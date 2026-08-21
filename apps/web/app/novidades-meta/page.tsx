import { PublicLayout } from '@/components/landing/PublicLayout';
import { OutubroSemSusto } from '@/components/landing/OutubroSemSusto';

/* ══════════════════════════════════════════════════════════════════════════
 * /novidades-meta: kit "Outubro sem susto" (20/08/2026)
 * --------------------------------------------------------------------------
 * A página foi transformada: deixou de ser a landing dos lançamentos do
 * Conversations Brasil 2026 (conteúdo anterior preservado em
 * components/landing/NovidadesMeta.tsx, hoje sem uso) e virou o kit da
 * mudança de preço da Meta em 01/10/2026: explicação da mudança, calculadora
 * estática da fatura Meta (client-side, sem backend), tradução por vertical,
 * FAQ do kit e CTA para o trial.
 *
 * Fonte: docs/resposta-meta-2026/comunicacao/kit-outubro-sem-susto-v1.md e
 * PLANO-RESPOSTA-META.md seção 7. Tarifas de referência de agosto/2026;
 * a tabela final da Meta sai até 01/09/2026 e a página deve ser atualizada
 * no mesmo dia (constantes no topo de OutubroSemSusto.tsx).
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Outubro sem susto: o que muda no preço do WhatsApp | ZappIQ',
  description:
    'Em 1º de outubro de 2026 a Meta passa a cobrar pelas respostas no WhatsApp. Sua mensalidade ZappIQ não muda: tarifa a custo, medidor e teto de gasto. Calcule a fatura Meta da sua operação.',
};

export default function NovidadesMetaPage() {
  return (
    <PublicLayout>
      <OutubroSemSusto />
    </PublicLayout>
  );
}
