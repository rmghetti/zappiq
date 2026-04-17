'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  MessageSquareText,
  Upload,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Gauge,
  XCircle,
} from 'lucide-react';

/**
 * SelfServiceTraining — Seção "Você treina sua IA".
 *
 * Mensagem central: independência total do cliente na capacitação da IA.
 * Sem consultor, sem onboarding pago (que concorrentes cobram entre
 * R$ 3k e R$ 15k). O cliente responde o survey, sobe documentos/URLs,
 * cria Q&A e vê o AI Readiness Score subir em tempo real.
 *
 * Cada "card de passo" replica a UI do app — reforçando a percepção de
 * que o que está na landing é exatamente o que ele vai ver ao entrar
 * na plataforma. Isso reduz a fricção de conversão.
 */

const STEPS = [
  {
    icon: Sparkles,
    title: 'Survey inteligente por segmento',
    description:
      'Escolha seu segmento, sub-segmento e responda um questionário direcionado ao seu negócio. Quanto mais rico, melhor a IA.',
    deliverable: 'Tom de voz, horários e contexto do negócio',
    points: '+30 pontos no AI Readiness',
  },
  {
    icon: Upload,
    title: 'Upload de contratos e documentos',
    description:
      'PDFs, planilhas, FAQs, contratos, políticas, catálogos. Sua IA responde com base no SEU acervo — sem alucinação e sem limite de uploads.',
    deliverable: 'Base de conhecimento vetorizada automaticamente',
    points: '+25 pontos no AI Readiness',
  },
  {
    icon: MessageSquareText,
    title: 'Q&A editável a qualquer momento',
    description:
      'Fixe respostas exatas para perguntas recorrentes: horário, preço, prazo, política. Consistência garantida, sem depender de modelo generativo.',
    deliverable: 'Respostas determinísticas, auditáveis',
    points: '+20 pontos no AI Readiness',
  },
  {
    icon: FileText,
    title: 'URL do site ingerida automaticamente',
    description:
      'Cole a URL do seu site ou de páginas específicas. Nosso crawler monta o mapa de conhecimento sozinho — você não precisa mexer em nada.',
    deliverable: 'Crawler inteligente com respeito a robots.txt',
    points: 'Complemento à base documental',
  },
];

const COMPARISON = [
  {
    feature: 'Setup fee / fee de onboarding',
    zappiq: { text: 'R$ 0', positive: true },
    competitors: { text: 'R$ 3.000 a R$ 15.000', positive: false },
  },
  {
    feature: 'Treinamento da IA',
    zappiq: { text: 'Self-service, dentro da plataforma', positive: true },
    competitors: { text: 'Consultor terceirizado obrigatório', positive: false },
  },
  {
    feature: 'Tempo do contrato até a IA no ar',
    zappiq: { text: 'Minutos (mesmo dia)', positive: true },
    competitors: { text: '15 a 45 dias de setup', positive: false },
  },
  {
    feature: 'Reconfigurar tom / identidade',
    zappiq: { text: 'Um botão, sem retrabalho', positive: true },
    competitors: { text: 'Nova sessão paga de consultoria', positive: false },
  },
  {
    feature: 'Score de prontidão da IA visível',
    zappiq: { text: 'Dashboard em tempo real', positive: true },
    competitors: { text: 'Só com o consultor dizendo', positive: false },
  },
];

export function SelfServiceTraining() {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];

  return (
    <section id="voce-treina-sua-ia" className="relative py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <Sparkles size={14} />
            SEM CONSULTOR · SEM SETUP FEE · SEM ESPERA
          </div>
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
            Você treina a IA do seu negócio.{' '}
            <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
              Sozinho, no seu tempo.
            </span>
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Não precisa de especialista, consultor ou pacote de implantação pago.
            Você responde o survey de qualificação, sobe documentos e cria Q&A
            direto na plataforma. A IA aprende com o <strong>seu</strong> negócio,
            com os <strong>seus</strong> contratos, do <strong>seu</strong> jeito —
            e o dashboard te mostra exatamente o quanto ela já está pronta.
          </p>
        </div>

        {/* Steps interativos */}
        <div className="grid lg:grid-cols-2 gap-10 items-center mb-20">
          <div className="space-y-3">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = idx === activeStep;
              return (
                <button
                  key={s.title}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                    isActive
                      ? 'border-primary-500 bg-white shadow-xl shadow-primary-500/10'
                      : 'border-gray-200 bg-white/50 hover:border-primary-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? 'bg-gradient-to-br from-primary-500 to-secondary-500 text-white'
                          : 'bg-primary-50 text-primary-600'
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {idx + 1}. {s.title}
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {s.description}
                      </p>
                      {isActive && (
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          <span className="inline-flex items-center gap-1 bg-secondary-50 text-secondary-700 px-2.5 py-1 rounded-full font-medium">
                            <CheckCircle2 size={12} /> {s.deliverable}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">
                            <Gauge size={12} /> {s.points}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mock da tela de AI Readiness */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl shadow-primary-500/10 border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs opacity-80 font-medium">AI READINESS SCORE</p>
                    <p className="text-3xl font-extrabold font-display">72/100</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-80">NÍVEL ATUAL</p>
                    <p className="text-lg font-bold">READY</p>
                  </div>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                  <div className="bg-white h-full rounded-full" style={{ width: '72%' }} />
                </div>
              </div>

              <div className="p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Breakdown
                </p>
                {[
                  { label: 'Survey de qualificação', score: 28, max: 30 },
                  { label: 'Identidade & tom de voz', score: 20, max: 20 },
                  { label: 'Documentos ingeridos', score: 15, max: 25 },
                  { label: 'Q&A ativos', score: 4, max: 20 },
                  { label: 'WhatsApp conectado', score: 5, max: 5 },
                ].map((row) => {
                  const pct = (row.score / row.max) * 100;
                  const full = row.score === row.max;
                  return (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700">{row.label}</span>
                        <span className={full ? 'text-secondary-600 font-semibold' : 'text-gray-500'}>
                          {row.score}/{row.max}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-full rounded-full ${
                            full
                              ? 'bg-secondary-500'
                              : 'bg-gradient-to-r from-primary-400 to-secondary-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
                <Sparkles size={16} className="text-primary-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">
                  <strong className="text-gray-900">Próxima ação (+16 pts):</strong>{' '}
                  Crie 3 Q&As sobre política de trocas.
                </p>
              </div>
            </div>

            <div className="absolute -top-3 -right-3 bg-secondary-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
              EM TEMPO REAL
            </div>
          </div>
        </div>

        {/* Comparativo direto: ZappIQ vs. concorrentes que cobram setup */}
        <div className="bg-gray-900 rounded-3xl p-8 lg:p-12 text-white mb-10">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <h3 className="font-display text-2xl lg:text-3xl font-bold mb-3">
              Concorrentes cobram R$ 3.000 a R$ 15.000 só para treinar a IA.{' '}
              <span className="text-secondary-400">Aqui é zero.</span>
            </h3>
            <p className="text-gray-400 text-sm">
              Setup fee não é investimento. É barreira de entrada. A ZappIQ tira
              essa barreira e reinveste o que seria fee em produto para você.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-6 border border-secondary-500/30">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-secondary-400 font-bold">ZappIQ</span>
                <CheckCircle2 size={18} className="text-secondary-400" />
              </div>
              <ul className="space-y-3">
                {COMPARISON.map((row) => (
                  <li key={row.feature} className="flex gap-3 text-sm">
                    <CheckCircle2 size={16} className="text-secondary-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-white">{row.feature}</p>
                      <p className="text-secondary-300/80 text-xs mt-0.5">{row.zappiq.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-300 font-bold">Plataformas tradicionais</span>
                <XCircle size={18} className="text-gray-500" />
              </div>
              <ul className="space-y-3">
                {COMPARISON.map((row) => (
                  <li key={row.feature} className="flex gap-3 text-sm">
                    <XCircle size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-300">{row.feature}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{row.competitors.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-primary-500/25 hover:shadow-xl hover:-translate-y-0.5"
          >
            Treinar minha IA agora — grátis por 14 dias <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-gray-500 mt-3">
            Sem cartão de crédito. Sem consultor. Sem setup fee. Sem surpresa.
          </p>
        </div>
      </div>
    </section>
  );
}
