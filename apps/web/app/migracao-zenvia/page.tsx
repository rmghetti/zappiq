import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Programa de Migração BSP → ZappIQ (Cloud API direto Meta)',
  description:
    'Migre da Zenvia, Twilio, 360Dialog, Yalo, Take Blip ou Sirena para Cloud API direto Meta. Serviço assistido por time ZappIQ em 30 dias. Sem fee de BSP, número WABA é seu.',
};

/* FASE 4 P7+ (2026-05-18 v2): reescrita honesta pos-questionamento CEO.
 * Decisão estratégica: A — programa ASSISTIDO POR HUMANO (não produto
 * auto-serviço). Pricing, owner, SLA, pre-requisitos explicitos.
 * Generalizado pra todos os 6 BSPs principais BR (não só Zenvia).
 * Migration Suite (wizard auto-serviço) fica em roadmap Q3. */

const BSPS_SUPORTADOS = [
  { name: 'Zenvia', note: 'Mais comum no SMB brasileiro' },
  { name: 'Twilio', note: 'Cobrança em USD, complexidade alta' },
  { name: '360Dialog', note: 'Pioneiro BSP Cloud API' },
  { name: 'Yalo', note: 'Foco em LATAM, custo médio' },
  { name: 'Take Blip', note: 'Líder enterprise BR' },
  { name: 'Sirena', note: 'Foco vendas LATAM' },
];

const TIERS = [
  {
    name: 'Migração Express',
    volume: 'Até 5.000 msgs/mês',
    price: 'R$ 2.900',
    pricingNote: 'one-shot · porta de entrada',
    includes: [
      'Re-templating de até 10 templates',
      'Migração de até 2.000 contatos (CSV)',
      'Cutover em até 15 dias',
      '1 sessão de treinamento (2h)',
    ],
  },
  {
    name: 'Migração Standard',
    volume: '5.000 – 25.000 msgs/mês',
    price: 'R$ 6.900',
    pricingNote: 'one-shot · mais escolhido',
    includes: [
      'Re-templating de até 30 templates',
      'Migração de até 10.000 contatos (CSV) + histórico de 30 dias',
      'Cutover em 30 dias com paralelo controlado manual',
      '3 sessões de treinamento',
      'Dashboard comparativo (montado manualmente pelo time)',
    ],
    highlight: true,
  },
  {
    name: 'Migração Scale',
    volume: '25.000 – 80.000 msgs/mês',
    price: 'R$ 14.900',
    pricingNote: 'one-shot · operação consolidada',
    includes: [
      'Re-templating ilimitado + revisão de copy por nosso time',
      'Migração de até 50.000 contatos + histórico de 90 dias',
      'Cutover em 30-45 dias com 2 owners ZappIQ dedicados',
      'Treinamento dedicado da operação cliente',
      'Suporte aumentado 60 dias pós-cutover',
    ],
  },
  {
    name: 'Migração Enterprise',
    volume: '+80.000 msgs/mês',
    price: 'Sob consulta',
    pricingNote: 'mín R$ 24.900',
    includes: [
      'Escopo customizado',
      'Time de migração dedicado (PM + 2 técnicos)',
      'Integração com CRM/ERP existente revisada',
      'SLA de migração contratualizado',
      'Roadmap pós-migração compartilhado',
    ],
  },
];

const GATILHOS_COMERCIAIS = [
  {
    name: 'Trade-in BSP',
    headline: 'Migração Express GRÁTIS',
    body: 'Prove com fatura que paga +R$ 2.000/mês de fee pro seu BSP atual. Cobrimos sua migração Express (até 5.000 msgs/mês) sem custo — economia mensal paga nosso investimento em 1 mês.',
  },
  {
    name: 'Founders Bonus',
    headline: '50% off na migração',
    body: 'Já tem ou está aplicando pro Cohort Founders 2026? Migração de qualquer tier sai pela metade do preço. Combinado com 30% off vitalício do plano, payback médio em 4 meses.',
  },
  {
    name: 'Plano Anual Upfront',
    headline: '30% off na migração',
    body: 'Assinou plano anual pago à vista? 30% de desconto em qualquer tier de migração. Custo do plano + migração desbloqueado de uma vez, sem surpresa pra controladoria.',
  },
  {
    name: 'Parcelamento Migração',
    headline: '3x sem juros',
    body: 'Ticket de migração acima de R$ 5.000 pode ser parcelado em 3x sem juros no cartão corporativo. Sem entrada, sem fiador.',
  },
];

const PHASES = [
  {
    phase: 'Fase 1 · Dias 1-5',
    title: 'Diagnóstico, contrato e export',
    items: [
      'NDA bilateral + DPA ZappIQ (LGPD) assinados',
      'Diagnóstico técnico: levantamento de templates, fluxos, integrações e volume real',
      'Você executa o export oficial pela UI do seu BSP atual (opt-in/opt-out, contatos, templates, histórico)',
      'Cronograma assinado com critérios de sucesso mensuráveis',
    ],
  },
  {
    phase: 'Fase 2 · Dias 6-15',
    title: 'WABA próprio + re-submissão de templates',
    items: [
      'Você abre o WhatsApp Business Account no SEU Meta Business Manager (1h, guiamos passo a passo)',
      'Nosso time re-submete os templates via Cloud API oficial (24-48h por template pra aprovação Meta)',
      'Configuração da plataforma ZappIQ com seus fluxos, KB e integrações',
      'Sessões de treinamento da sua operação (gravadas + suporte ao vivo)',
    ],
  },
  {
    phase: 'Fase 3 · Dias 16-25',
    title: 'Paralelo operacional controlado',
    items: [
      'Você decide o ritmo: começa com 10% do volume na ZappIQ + 90% no BSP atual',
      'Aumenta gradualmente conforme métricas (CSAT, TMR, taxa de resolução)',
      'Nosso time monta dashboard comparativo manual semanal (não é UI auto-serviço — ainda)',
      'Ajuste fino de prompts e guardrails do agente IA',
    ],
  },
  {
    phase: 'Fase 4 · Dias 26-30',
    title: 'Cutover e desligamento do BSP',
    items: [
      'Migração final do número WABA: do BSP para Cloud API direto Meta — sem perder o número, sem nova verificação verde',
      'Você notifica desligamento ao BSP atual (carta-modelo fornecida)',
      'Relatório executivo de ganho: economia mensal, CSAT, TMR comparados',
      'Suporte aumentado 30 dias pós-cutover (incluso) + SLA contratual regular',
    ],
  },
];

const FAQ_TECNICO = [
  {
    q: 'Vou perder a verificação verde (Green Tick)?',
    a: 'Não. O Green Tick é atrelado ao WABA e à marca, não ao BSP. Migrando para Cloud API direto, ele permanece.',
  },
  {
    q: 'Preciso trocar de número?',
    a: 'Não. O mesmo número segue ativo. O que muda é o controle técnico: do BSP atual para o seu Meta Business Manager.',
  },
  {
    q: 'Quanto economizo saindo do modelo BSP?',
    a: 'Depende do contrato do BSP atual. Em geral, o fee de plataforma BSP fica entre R$ 0,03 e R$ 0,15 por mensagem, além do preço Meta. Em 100 mil mensagens/mês isso são R$ 3.000 a R$ 15.000 mensais economizados. Enviamos cálculo personalizado no diagnóstico.',
  },
  {
    q: 'E os templates já aprovados no BSP atual?',
    a: 'A Meta não permite portar template ID entre BSPs ou entre BSP e Cloud API. Re-submetemos cópias idênticas pelo seu WABA novo (aprovação típica em 24-48h por template). O conteúdo do template é seu — não fica preso ao BSP.',
  },
  {
    q: 'Isso é wizard self-service no dashboard ou serviço assistido?',
    a: 'Hoje é assistido por humano — nosso time conduz contigo as 4 fases. Estamos planejando uma Migration Suite self-service para Q3/2026, mas enquanto isso a migração é executada por nós (com seu acompanhamento) usando os tiers de pricing acima.',
  },
  {
    q: 'Migração é incluída no Onboarding Zero ou cobrada à parte?',
    a: 'Onboarding Zero (setup inicial sem custo) é pra cliente novo que NUNCA teve WhatsApp Business automatizado. Migração de BSP existente é serviço à parte, com escopo e preço definidos nos tiers acima — porque envolve export/import de dados sensíveis, re-templating e paralelo controlado.',
  },
  {
    q: 'Atendem outros BSPs além dos 6 listados?',
    a: 'Sim. Os 6 cobrem ~95% do mercado BR, mas qualquer plataforma que use WhatsApp Cloud API ou WhatsApp Enterprise API pode ser migrada. Cite no email de diagnóstico qual é o seu provedor atual.',
  },
];

export default function MigracaoZenviaPage() {
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
          Programa de Migração BSP · Serviço assistido por nosso time
        </p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Pare de pagar pedágio. Você é dono do canal — não a gente.
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-3xl">
          Zenvia, Twilio, 360Dialog, Yalo, Take Blip e Sirena são BSPs (Business Solution Providers):
          cobram fee por mensagem, são donos contratuais do número WABA e prendem você em templates
          não-portáveis. ZappIQ é diferente: usamos <strong>Cloud API direto da Meta</strong>. O
          número WABA fica no SEU Meta Business Manager. Sem intermediário. Sem fee de plataforma.
          Sem lock-in.
        </p>

        {/* BSPs suportados */}
        <section className="mb-12">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">
            Migramos de qualquer um destes BSPs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {BSPS_SUPORTADOS.map((bsp) => (
              <div key={bsp.name} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-semibold text-gray-900">{bsp.name}</p>
                <p className="text-xs text-gray-500 mt-1">{bsp.note}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Atende ~95% do mercado BR. Outro BSP? Cite no email de diagnóstico que avaliamos.
          </p>
        </section>

        {/* Bloco comparativo BSP × Cloud API direto */}
        <section className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold text-red-900 mb-3">Modelo BSP (Zenvia/Twilio/360Dialog/Yalo/...)</h3>
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

        {/* Aviso de transparência */}
        <section className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 mb-12">
          <h3 className="font-display text-lg font-bold text-amber-900 mb-2">Importante: como funciona a migração hoje</h3>
          <p className="text-sm text-amber-900 leading-relaxed">
            Migração de BSP <strong>não é wizard self-service no dashboard ainda</strong> — é serviço
            assistido por humano. Nosso time executa contigo as 4 fases descritas abaixo, com escopo,
            pricing e SLA definidos. A Migration Suite self-service está no roadmap Q3/2026. Enquanto
            isso, o processo é manual mas estruturado, com owner ZappIQ dedicado e cronograma assinado
            em contrato.
          </p>
        </section>

        {/* Pricing por tier */}
        <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-6">Pricing do serviço de migração</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-5 ${
                tier.highlight
                  ? 'bg-primary-50 border-2 border-primary-300 relative'
                  : 'bg-white border border-gray-200'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full">
                  Mais escolhido
                </span>
              )}
              <p className="font-display text-base font-bold text-gray-900">{tier.name}</p>
              <p className="text-xs text-gray-500 mt-1">{tier.volume}</p>
              <p className="font-display text-2xl font-extrabold text-primary-700 mt-3">{tier.price}</p>
              <p className="text-[11px] text-gray-500 italic mt-0.5">{tier.pricingNote}</p>
              <ul className="text-xs text-gray-700 list-disc list-outside ml-4 space-y-1.5 mt-4">
                {tier.includes.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-12">
          ✓ Setup fee da plataforma ZappIQ continua zero (Onboarding Zero é padrão). O pricing acima
          é exclusivamente do serviço humano de migração — export, re-templating, paralelo controlado,
          cutover. Cliente Founders ou Business+ recebe desconto adicional (veja modelos comerciais abaixo).
        </p>

        {/* Modelos comerciais (gatilhos) */}
        <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-6">Modelos comerciais</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          {GATILHOS_COMERCIAIS.map((g) => (
            <div key={g.name} className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">{g.name}</p>
              <p className="font-display text-lg font-bold text-emerald-900 mb-2">{g.headline}</p>
              <p className="text-sm text-emerald-900/80 leading-relaxed">{g.body}</p>
            </div>
          ))}
        </div>

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

        {/* O que você precisa providenciar */}
        <section className="bg-gray-50 border border-gray-200 rounded-2xl p-8 mb-12">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">O que você precisa providenciar</h2>
          <ul className="text-sm text-gray-700 list-disc list-outside ml-5 space-y-2">
            <li>Acesso administrativo à conta do BSP atual (para export oficial)</li>
            <li>Acesso ao Meta Business Manager da empresa (criação do WABA próprio)</li>
            <li>Owner técnico do projeto pela sua parte (~4h/semana por 30 dias)</li>
            <li>Autorização para re-aprovar templates pelo Meta (Meta não preserva template ID entre BSPs)</li>
            <li>Aprovação do escopo e pricing pré-cutover (contrato curto, sem letra miúda)</li>
          </ul>
        </section>

        {/* SLA */}
        <section className="bg-[#1A1A2E] rounded-2xl p-8 text-white mb-12">
          <h2 className="font-display text-xl font-bold mb-4">SLA do programa de migração</h2>
          <ul className="text-sm text-white/80 list-disc list-outside ml-5 space-y-2">
            <li><strong className="text-white">Diagnóstico:</strong> resposta em até 2 dias úteis após envio do email</li>
            <li><strong className="text-white">Re-submissão de template:</strong> envio ao Meta em até 1 dia útil (aprovação depende da Meta, geralmente 24-48h)</li>
            <li><strong className="text-white">Suporte durante migração:</strong> resposta em até 4h em horário comercial via Slack/email</li>
            <li><strong className="text-white">Cutover:</strong> agendado com você, com janela de 4h máxima</li>
            <li><strong className="text-white">Pós-cutover:</strong> 30 dias de suporte aumentado incluso</li>
          </ul>
        </section>

        {/* FAQ técnico */}
        <section className="bg-gray-50 border border-gray-200 rounded-2xl p-8 mb-12">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">Perguntas técnicas e operacionais frequentes</h2>
          <dl className="space-y-4 text-sm">
            {FAQ_TECNICO.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-gray-900">{item.q}</dt>
                <dd className="text-gray-600 mt-1">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA Final */}
        <section className="bg-[#1A1A2E] rounded-2xl p-10 text-white">
          <h2 className="font-display text-2xl font-bold mb-3">Próximo passo: diagnóstico gratuito</h2>
          <p className="text-gray-400 mb-6">
            Envie um email com: (1) seu CNPJ, (2) qual BSP usa hoje (Zenvia, Twilio, 360Dialog, Yalo,
            Take Blip, Sirena ou outro), (3) volume mensal de mensagens, (4) número de templates ativos.
            Em 2 dias úteis devolvemos: economia mensal estimada, tier de migração indicado, cronograma
            preliminar e contrato.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="mailto:migração@zappiq.com.br?subject=Diagn%C3%B3stico%20BSP%20%E2%86%92%20ZappIQ"
              className="inline-flex items-center justify-center bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-6 py-3 rounded-xl"
            >
              migração@zappiq.com.br
            </a>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center border border-white/20 text-white hover:bg-white/10 font-semibold px-6 py-3 rounded-xl"
            >
              Ver demo da plataforma primeiro
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
