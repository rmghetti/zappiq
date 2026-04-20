import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Migração Zenvia → ZappIQ — Playbook anti-lock-in em 30 dias',
  description:
    'Playbook completo de migração Zenvia → ZappIQ em 30 dias: export, re-template, paralelo controlado e cutover. Setup fee zero.',
};

/* V2-048: playbook anti-Zenvia · migração estruturada em 4 fases
 * Fonte canônica: /gtm/playbook_antizenvia.md */

const PHASES = [
  {
    phase: 'Fase 1 · Dias 1–5',
    title: 'Diagnóstico & export',
    items: [
      'Assinatura de NDA bilateral e DPA ZappIQ',
      'Export completo de opt-in/opt-out, contatos, histórico de conversas (até 90 dias) e templates aprovados',
      'Mapeamento 1:1 de fluxos e automações existentes',
      'Plano de migração com critérios de sucesso mensuráveis',
    ],
  },
  {
    phase: 'Fase 2 · Dias 6–15',
    title: 'Re-templating e configuração paralela',
    items: [
      'Submissão dos templates ao WABA pelo BSP ZappIQ (360Dialog) — aprovação típica 24–48h',
      'Recriação dos fluxos no ForgeStudio com histórico de versões',
      'Configuração de integrações (CRM, ERP, BI) via NexusCRM e Pulse API',
      'Training do time operacional (4h gravadas + sessões vivo)',
    ],
  },
  {
    phase: 'Fase 3 · Dias 16–25',
    title: 'Paralelo controlado',
    items: [
      'Roteamento de 10% → 30% → 60% do volume para ZappIQ',
      'Métricas paralelas: CSAT, tempo de resposta, taxa de resolução, custo por mensagem',
      'Validação de integridade em UGC (User Generated Content) e branches de fluxo',
      'Ajuste fino de prompts PulseAI e guardrails',
    ],
  },
  {
    phase: 'Fase 4 · Dias 26–30',
    title: 'Cutover e encerramento Zenvia',
    items: [
      'BSP change oficial Meta (número WABA transferido)',
      'Desligamento contratual Zenvia com prova de encerramento de opt-ins',
      'Relatório executivo de ganho: custo, CSAT, tempo de resposta, NPS time',
      'Pós-cutover: 30 dias de suporte aumentado + SLA contratual regular',
    ],
  },
];

export default function MigracaoZenviaPage() {
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Playbook de migração</p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Migração Zenvia → ZappIQ em 30 dias, com setup fee zero.
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-3xl">
          Playbook estruturado em 4 fases, com paralelo controlado e SLA contratual durante a transição.
          Importamos opt-ins, histórico e templates. Você decide o cutover — não a gente.
        </p>

        <section className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold text-emerald-900 mb-2">O que trazemos</h3>
            <ul className="text-sm text-emerald-900 list-disc list-outside ml-5 space-y-1.5">
              <li>Setup fee <strong>ZERO</strong> durante o programa</li>
              <li>3 meses do plano contratado com 50% de desconto</li>
              <li>BSP change Meta gerido pela ZappIQ</li>
              <li>Template re-aprovação priorizada</li>
              <li>Dashboard paralelo comparativo Zenvia × ZappIQ</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold text-amber-900 mb-2">O que você precisa ter</h3>
            <ul className="text-sm text-amber-900 list-disc list-outside ml-5 space-y-1.5">
              <li>Acesso administrativo à conta Zenvia (para export)</li>
              <li>Owner técnico do projeto (4h/semana por 30 dias)</li>
              <li>Autorização para recriação dos templates com pequenas diferenças (WABA não preserva template ID entre BSPs)</li>
              <li>Compromisso de 12 meses após cutover (renovação automática)</li>
            </ul>
          </div>
        </section>

        <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-6">Cronograma de 30 dias</h2>
        <div className="space-y-5 mb-16">
          {PHASES.map((p) => (
            <div key={p.phase} className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-1">{p.phase}</p>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-3">{p.title}</h3>
              <ul className="text-sm text-gray-600 list-disc list-outside ml-5 space-y-1.5">
                {p.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <section className="bg-[#1A1A2E] rounded-2xl p-10 text-white">
          <h2 className="font-display text-2xl font-bold mb-3">Próximo passo</h2>
          <p className="text-gray-400 mb-6">
            Envie um email com seu CNPJ, plano Zenvia atual e volume mensal de mensagens. Enviamos
            diagnóstico preliminar gratuito em 2 dias úteis.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="mailto:migracao@zappiq.com.br?subject=Diagn%C3%B3stico%20Zenvia%20%E2%86%92%20ZappIQ"
              className="inline-flex items-center justify-center bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-6 py-3 rounded-xl"
            >
              migracao@zappiq.com.br
            </a>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center border border-white/20 text-white hover:bg-white/10 font-semibold px-6 py-3 rounded-xl"
            >
              Ver demo primeiro
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
