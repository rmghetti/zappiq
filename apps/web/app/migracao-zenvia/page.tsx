import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Migração Zenvia → ZappIQ — Saia do modelo BSP em 30 dias',
  description:
    'Pare de pagar pedágio por mensagem. Migre da Zenvia (BSP) para Cloud API direto Meta com ZappIQ. Você dono do número, sem fee de intermediário. Playbook em 30 dias.',
};

/* FASE 4 P7+ (2026-05-18): reescrita pos-auditoria.
 * Drift anterior: pagina dizia que ZappIQ era BSP usando 360Dialog (falso).
 * Stack real: Cloud API direto Meta. Cliente e dono do WABA. Sem fee BSP.
 * Posicionamento novo: "Voce e dono do canal — nao a gente." */

const PHASES = [
  {
    phase: 'Fase 1 · Dias 1–5',
    title: 'Diagnóstico, NDA e export Zenvia',
    items: [
      'Assinatura de NDA bilateral e DPA ZappIQ (LGPD)',
      'Export completo da Zenvia: opt-in/opt-out, contatos, histórico de conversas (até 90 dias) e templates aprovados',
      'Mapeamento 1:1 de fluxos, automações e integrações ativas',
      'Plano de migração com critérios de sucesso mensuráveis (CSAT, TMR, custo por mensagem)',
    ],
  },
  {
    phase: 'Fase 2 · Dias 6–15',
    title: 'WABA próprio + re-templating',
    items: [
      'Abertura do WhatsApp Business Account no SEU Meta Business Manager — você é o proprietário do número, não a ZappIQ',
      'Submissão dos templates direto à Meta via Cloud API oficial — aprovação típica em 24–48h',
      'Recriação dos fluxos no painel ZappIQ com histórico de versões e rollback',
      'Configuração de integrações (CRM, ERP, BI) via API REST e webhooks',
      'Treinamento operacional (4h gravadas + sessões ao vivo)',
    ],
  },
  {
    phase: 'Fase 3 · Dias 16–25',
    title: 'Paralelo controlado',
    items: [
      'Roteamento gradual: 10% → 30% → 60% do volume para ZappIQ',
      'Dashboard comparativo lado-a-lado: CSAT, tempo de resposta, taxa de resolução, custo por mensagem',
      'Validação em fluxos com mídia, áudio, listas e botões interativos',
      'Ajuste fino de prompts e guardrails do agente de IA',
    ],
  },
  {
    phase: 'Fase 4 · Dias 26–30',
    title: 'Cutover e desligamento Zenvia',
    items: [
      'Migração final do número WABA: do BSP Zenvia para Cloud API direto Meta — sem perder o número, sem nova verificação verde',
      'Desligamento contratual Zenvia com prova de encerramento de opt-ins',
      'Relatório executivo de ganho: custo por mensagem, CSAT, TMR, NPS do time interno',
      'Pós-cutover: 30 dias de suporte aumentado + SLA contratual regular',
    ],
  },
];

const FAQ_TECNICO = [
  {
    q: 'Vou perder a verificação verde (Green Tick)?',
    a: 'Não. O Green Tick está atrelado ao WABA, não ao BSP. Migrando para Cloud API direto, ele permanece.',
  },
  {
    q: 'Preciso trocar de número?',
    a: 'Não. O mesmo número segue ativo. O que muda é a integração técnica entre seu WABA e a plataforma.',
  },
  {
    q: 'Quanto economizo saindo do modelo BSP?',
    a: 'Depende do contrato Zenvia, mas o fee típico de BSP fica entre R$ 0,03 e R$ 0,15 por mensagem, além do preço Meta. Em 100 mil mensagens/mês isso são R$ 3.000–R$ 15.000 economizados. Enviamos cálculo personalizado no diagnóstico.',
  },
  {
    q: 'E os templates já aprovados na Zenvia?',
    a: 'A Meta não permite portar template ID entre BSP e Cloud API. Re-submetemos cópias idênticas no seu WABA — aprovação típica em 24–48h por template.',
  },
];

export default function MigracaoZenviaPage() {
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
          Playbook anti-BSP · Migração em 30 dias
        </p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Pare de pagar pedágio. Você é dono do canal — não a gente.
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-3xl">
          Zenvia, Twilio e 360Dialog são BSPs (Business Solution Providers): cobram fee por mensagem
          enviada, são donos contratuais do número WABA e prendem você em templates não-portáveis. ZappIQ
          é diferente: usamos <strong>Cloud API direto da Meta</strong>. O número WABA fica no SEU Meta
          Business Manager. Sem intermediário. Sem fee de plataforma. Sem lock-in.
        </p>

        {/* Bloco comparativo BSP × Cloud API direto */}
        <section className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold text-red-900 mb-3">Modelo BSP (Zenvia/Twilio/360Dialog)</h3>
            <ul className="text-sm text-red-900 list-disc list-outside ml-5 space-y-2">
              <li>Fee de plataforma por mensagem, somado ao custo Meta</li>
              <li>BSP é proprietário contratual do número WABA</li>
              <li>Templates aprovados não migram entre BSPs (você re-submete tudo a cada troca)</li>
              <li>Roadmap de features depende do ritmo do BSP</li>
              <li>Saída envolve &ldquo;BSP change&rdquo; formal com a Meta</li>
            </ul>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold text-emerald-900 mb-3">ZappIQ · Cloud API direto Meta</h3>
            <ul className="text-sm text-emerald-900 list-disc list-outside ml-5 space-y-2">
              <li>Você paga apenas Meta (preço de tabela) + assinatura ZappIQ. Zero fee por mensagem</li>
              <li>WABA fica no SEU Meta Business Manager. Acesso e propriedade totais</li>
              <li>Templates ficam atrelados ao seu WABA, não à plataforma</li>
              <li>Quiser sair? Desconecta a integração. O número permanece com você</li>
              <li>Conexão via API oficial homologada pela Meta</li>
            </ul>
          </div>
        </section>

        {/* O que trazemos × O que você precisa */}
        <section className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold text-primary-900 mb-2">O que a ZappIQ traz no programa</h3>
            <ul className="text-sm text-primary-900 list-disc list-outside ml-5 space-y-1.5">
              <li>Setup fee <strong>ZERO</strong> — Onboarding Zero é padrão, não promoção</li>
              <li>14 dias grátis, sem cartão de crédito</li>
              <li>Acompanhamento técnico dedicado durante os 30 dias de migração</li>
              <li>Re-submissão de templates priorizada via Cloud API</li>
              <li>Dashboard comparativo Zenvia × ZappIQ em tempo real durante o paralelo</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold text-amber-900 mb-2">O que você precisa providenciar</h3>
            <ul className="text-sm text-amber-900 list-disc list-outside ml-5 space-y-1.5">
              <li>Acesso administrativo à conta Zenvia (para export)</li>
              <li>Acesso ao Meta Business Manager da empresa (criação do WABA próprio)</li>
              <li>Owner técnico do projeto (~4h/semana por 30 dias)</li>
              <li>Autorização para re-aprovar templates (Meta não preserva template ID entre BSP e Cloud API)</li>
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

        {/* FAQ técnico curto */}
        <section className="bg-gray-50 border border-gray-200 rounded-2xl p-8 mb-12">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">Perguntas técnicas frequentes</h2>
          <dl className="space-y-4 text-sm">
            {FAQ_TECNICO.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-gray-900">{item.q}</dt>
                <dd className="text-gray-600 mt-1">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-[#1A1A2E] rounded-2xl p-10 text-white">
          <h2 className="font-display text-2xl font-bold mb-3">Próximo passo: diagnóstico gratuito</h2>
          <p className="text-gray-400 mb-6">
            Envie um email com seu CNPJ, plano Zenvia atual e volume mensal de mensagens. Em 2 dias
            úteis devolvemos: economia estimada saindo do modelo BSP, plano de migração customizado e
            cronograma de cutover.
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
