import Link from 'next/link';
import { PublicLayout } from '@/components/landing/PublicLayout';
import {
  ClipboardList,
  Brain,
  MessageSquare,
  ArrowRight,
  Check,
  Clock,
  Shield,
  FileText,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════════
 * /como-funciona-survey — Onboarding Zero ZappIQ V3.2
 * --------------------------------------------------------------------------
 * Explica em detalhe o processo de Survey Onboarding Zero:
 *   • Self-service por padrão: lead responde um questionário de 30-90 min
 *   • Fallback humano: se lead não finalizar em 7 dias, CSM entra em contato
 *   • Gera base de conhecimento inicial da IA automaticamente
 *   • Zero consultor externo, zero R$ 3-8k de implementação
 *
 * Este é o coração do diferencial V3.2 #1: substitui setup fee por
 * questionário estruturado + IA que monta a base.
 * ══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Como funciona o Survey Onboarding Zero | ZappIQ V3.2',
  description:
    'Onboarding 100% self-service em 30–90 minutos, sem consultor. IA monta sua base de conhecimento a partir de um questionário estruturado. Se precisar, CSM acompanha.',
};

const STEPS = [
  {
    icon: ClipboardList,
    phase: 'Etapa 1',
    title: 'Questionário estruturado',
    time: '30–90 min',
    body:
      'Responda perguntas sobre: o que você vende, quem é seu cliente, quais objeções aparecem, quais são os 5 FAQs mais comuns, tom de voz da marca, regras de negócio (prazo, entrega, garantia, política de troca).',
  },
  {
    icon: Brain,
    phase: 'Etapa 2',
    title: 'IA monta a base de conhecimento',
    time: '~ 10 min após submit',
    body:
      'Claude processa suas respostas e gera automaticamente: a base de conhecimento estruturada, um system prompt com o tom da marca, árvores de decisão para os cenários mais comuns e 20 mensagens de teste para você revisar.',
  },
  {
    icon: MessageSquare,
    phase: 'Etapa 3',
    title: 'Você revisa e conecta o WhatsApp',
    time: '15–30 min',
    body:
      'Revise as 20 mensagens de teste, ajuste o que quiser, conecte seu WhatsApp Business (Cloud API oficial) e a IA começa a atender clientes reais.',
  },
  {
    icon: UserCheck,
    phase: 'Etapa 4 (se necessário)',
    title: 'Fallback humano',
    time: 'D+7 se lead não finalizar',
    body:
      'Se você travar em qualquer etapa e não finalizar em 7 dias, um CSM entra em contato para destravar — sem cobrança adicional, faz parte do onboarding.',
  },
];

const INCLUDED = [
  'Questionário estruturado com perguntas específicas pra sua vertical',
  'IA Claude gerando base de conhecimento automaticamente',
  'System prompt calibrado pro tom da sua marca',
  '20 mensagens de teste pré-geradas pra você revisar',
  'Conexão WhatsApp Business Cloud API (direto Meta, sem BSP)',
  'Suporte do CSM se você travar em qualquer etapa',
  'Revisão pós-ativação na 1ª semana pra calibrar IA com conversas reais',
];

const EXCLUDED = [
  {
    label: 'Consultoria externa',
    why: 'ZappIQ substitui por questionário + IA. Se você precisa de consultoria estratégica, indicamos parceiros.',
  },
  {
    label: 'Setup fee inicial',
    why: 'O que o mercado cobra R$ 3.000–R$ 8.000 pra fazer, a IA monta em 10 minutos.',
  },
  {
    label: 'Treinamento presencial',
    why: 'Tutoriais em vídeo no painel + CSM por vídeochamada sob demanda (incluso).',
  },
  {
    label: 'Integração de sistemas legados',
    why: 'Starter/Growth/Scale não incluem integrações via API custom. Business+ inclui via webhooks padrão.',
  },
];

const WHY_WORKS = [
  {
    title: 'IA aprende por exemplo, não por regra',
    body:
      'Claude é bom o suficiente pra montar base de conhecimento coerente a partir de respostas de negócio — sem precisar de analista de processo redigindo fluxogramas.',
  },
  {
    title: 'WhatsApp Cloud API é padronizado',
    body:
      'A Meta padronizou a API. Não há mais "integração customizada por cliente" como exigiam BSPs antigos. O que variava de cliente pra cliente sumiu.',
  },
  {
    title: 'Calibração acontece com conversas reais',
    body:
      'Em vez de 3 semanas simulando cenários em reunião, a IA começa a responder o cliente real no dia 1 e o CSM ajusta na semana 1 com base no que aconteceu de verdade.',
  },
];

export default function ComoFuncionaSurveyPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-primary-950 to-primary-900 pt-20 pb-24 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,211,102,0.12),_transparent_55%)]" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="inline-flex items-center gap-2 bg-primary-400/10 border border-primary-400/30 rounded-full px-4 py-1.5 mb-6">
            <ClipboardList size={14} className="text-primary-300" />
            <span className="text-xs font-semibold text-primary-200 uppercase tracking-wider">
              Onboarding Zero · diferencial V3.2
            </span>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl font-extrabold mb-6 max-w-4xl leading-tight">
            Implementação em <span className="text-primary-400">30–90 minutos</span>. Sem consultor.
            <br />
            Sem R$ 3–8 mil.
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mb-8 leading-relaxed">
            O mercado cobra setup fee pra montar sua base de conhecimento. Nós substituímos isso por um
            questionário estruturado + IA Claude. Você responde, a IA gera, você revisa, liga. Pronto.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="bg-primary-400 text-gray-900 font-semibold px-7 py-4 rounded-xl hover:bg-primary-300 transition-colors inline-flex items-center justify-center gap-2"
            >
              Começar 14 dias grátis <ArrowRight size={18} />
            </Link>
            <Link
              href="#etapas"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2"
            >
              Ver as 4 etapas
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 pt-10 border-t border-white/10">
            {[
              { value: '30-90min', label: 'Para concluir o survey' },
              { value: 'R$ 0', label: 'Setup fee · vs R$ 3-8k mercado' },
              { value: '100%', label: 'Self-service · CSM se travar' },
              { value: '~ 10min', label: 'IA gera base após submit' },
            ].map((kpi) => (
              <div key={kpi.label}>
                <div className="text-3xl lg:text-4xl font-extrabold text-primary-400 mb-1">{kpi.value}</div>
                <div className="text-xs text-gray-400">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 etapas */}
      <section id="etapas" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              Processo completo
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">
              4 etapas, do cadastro ao primeiro cliente atendido
            </h2>
          </div>
          <div className="space-y-6">
            {STEPS.map((s, i) => (
              <div
                key={s.phase}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-7 flex items-start gap-5 hover:border-primary-200 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                  <s.icon size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <p className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                      {s.phase}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-0.5">
                      <Clock size={10} /> {s.time}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-gray-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Incluso / não incluso */}
      <section className="py-20 bg-[#F8FAF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl border border-primary-200 p-8">
              <div className="flex items-center gap-2 mb-5">
                <Check size={20} className="text-primary-600" />
                <h3 className="font-display text-xl font-extrabold text-gray-900">
                  O que está incluso no Onboarding Zero
                </h3>
              </div>
              <ul className="space-y-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <div className="flex items-center gap-2 mb-5">
                <AlertCircle size={20} className="text-gray-600" />
                <h3 className="font-display text-xl font-extrabold text-gray-900">
                  O que NÃO está incluso (transparência)
                </h3>
              </div>
              <ul className="space-y-4">
                {EXCLUDED.map((item) => (
                  <li key={item.label} className="border-l-2 border-gray-200 pl-4">
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">{item.label}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Por que funciona */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              Por que funciona (e por que concorrente ainda cobra setup fee)
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">
              Três coisas mudaram nos últimos 18 meses
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {WHY_WORKS.map((w) => (
              <div key={w.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-7">
                <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center mb-4">
                  <Brain size={18} className="text-white" />
                </div>
                <h3 className="font-display text-base font-bold text-gray-900 mb-2">{w.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fallback humano */}
      <section className="py-16 bg-primary-50/60 border-y border-primary-200/60">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
              <UserCheck size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                Fallback humano se precisar
              </p>
              <h3 className="font-display text-2xl font-extrabold text-gray-900 mb-3">
                Sozinho, mas não abandonado.
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                Self-service é o padrão, não a regra absoluta. Se você não finalizar o survey em 7 dias
                corridos, um CSM ZappIQ liga (pelo WhatsApp mesmo) pra destravar. Faz parte do onboarding,
                sem cobrança adicional.
              </p>
              <p className="text-xs text-gray-500">
                O CSM pode: fazer o questionário com você em uma call de 30–45min · ajustar a base de
                conhecimento manualmente · fazer treinamento 1:1 do painel · validar a conexão WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LGPD / dados */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-start gap-4">
            <Shield size={24} className="text-primary-600 mt-1 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                LGPD desde o onboarding
              </p>
              <h3 className="font-display text-xl font-extrabold text-gray-900 mb-3">
                O que fazemos com suas respostas
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
                <li>
                  <strong className="text-gray-900">Finalidade específica:</strong> as respostas são usadas
                  EXCLUSIVAMENTE pra montar sua base de conhecimento. Não são usadas pra treinar modelos,
                  nem compartilhadas com terceiros.
                </li>
                <li>
                  <strong className="text-gray-900">Armazenamento:</strong> Supabase BR (AWS sa-east-1),
                  criptografia AES-256 em repouso, TLS 1.3 em trânsito.
                </li>
                <li>
                  <strong className="text-gray-900">Direito de exclusão:</strong> você pode solicitar
                  exclusão dos dados do survey a qualquer momento em{' '}
                  <Link href="/legal/deletar-dados" className="text-primary-600 hover:underline">
                    /legal/deletar-dados
                  </Link>{' '}
                  — resposta em até 15 dias úteis.
                </li>
                <li>
                  <strong className="text-gray-900">Se você não virar cliente:</strong> suas respostas ficam
                  retidas por 90 dias e depois são excluídas automaticamente.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-[#F8FAF9]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-gray-900 mb-4">
            Pronto em 30 a 90 minutos. Sem consultor.
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Zero setup fee, 14 dias grátis, sem fidelidade. Cancelamento em 1 clique.
            Se travar, CSM assume a partir do dia 7. Ao fim do trial, você escolhe a forma de pagamento.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-primary-500 hover:bg-primary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"
            >
              Começar Onboarding Zero <ArrowRight size={18} />
            </Link>
            <Link
              href="/contato"
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              Falar com CSM antes de começar
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
