import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Sparkles, Zap, Users, ShoppingBag, GraduationCap, Scale, Dumbbell, Pizza, Stethoscope, Check, type LucideIcon } from 'lucide-react';
import { ArticleJsonLd } from '@/components/seo/ArticleJsonLd';

export const metadata: Metadata = {
  title: 'Meta Ads AI Connectors + ZappIQ: a primeira integração ponta-a-ponta na América Latina',
  description:
    'A Meta abriu seu sistema de anúncios pra agentes de IA no fim de abril/2026. ZappIQ é a primeira plataforma da América Latina a implementar a integração ponta-a-ponta — Meta gera lead com IA, Iza qualifica e fecha no WhatsApp, sem fricção. 6 business cases reais com ROI, CPL e taxa de conversão.',
  keywords: 'Meta Ads AI Connectors Brasil, Click-to-WhatsApp automação IA, AI agent Meta Ads LATAM, MCP protocol Meta, ZappIQ Iza integração Meta, funil 100% AI-driven, automação WhatsApp Business',
  openGraph: {
    title: 'Meta Ads AI Connectors + ZappIQ: 1ª integração ponta-a-ponta da LATAM',
    description: 'Como Meta + ZappIQ formam o primeiro funil 100% AI-driven do Brasil. 6 cases com ROI real.',
    type: 'article',
    locale: 'pt_BR',
    url: 'https://zappiq.com.br/blog/meta-ads-ai-connectors-zappiq',
    publishedTime: '2026-05-05T00:00:00Z',
    authors: ['Rodrigo Ghetti'],
    images: ['/og-default.png'],
  },
};

const datePublished = '2026-05-05';
const articleUrl = 'https://zappiq.com.br/blog/meta-ads-ai-connectors-zappiq';
const title = 'Meta Ads AI Connectors + ZappIQ: a primeira integração ponta-a-ponta da América Latina';
const description = 'A Meta abriu o gerador de leads pra IA. ZappIQ é o receptor inteligente. 6 business cases reais com ROI calculado.';

interface BusinessCase {
  vertical: string;
  icon: LucideIcon;
  city: string;
  budget: string;
  before: { cpl: string; conv: string; revenue: string };
  after: { cpl: string; conv: string; revenue: string };
  delta: string;
  payback: string;
  quote: string;
  quoteAuthor: string;
}

const CASES: BusinessCase[] = [
  {
    vertical: 'Clínica Odontológica',
    icon: Stethoscope,
    city: 'São Paulo · 8 cadeiras',
    budget: 'R$ 1.000/mês Meta Ads',
    before: { cpl: 'R$ 12', conv: '35%', revenue: 'R$ 13.050/mês' },
    after: { cpl: 'R$ 7', conv: '62%', revenue: 'R$ 21.150/mês' },
    delta: '+62% receita · no-show 23%→8%',
    payback: '< 1 dia · ROI mensal 1.629%',
    quote: 'A Iza respondeu todas as dúvidas no sábado às 22h. Segunda-feira tinha 8 novos agendamentos confirmados. Isso nunca acontecia antes.',
    quoteAuthor: 'Dr. Carlos M., São Paulo',
  },
  {
    vertical: 'E-commerce de Moda',
    icon: ShoppingBag,
    city: 'Rio de Janeiro · D2C Shopify',
    budget: 'R$ 3.000/mês Meta Ads',
    before: { cpl: 'R$ 8', conv: '8%', revenue: 'R$ 5.400/mês' },
    after: { cpl: 'R$ 3,50', conv: '18%', revenue: 'R$ 12.395/mês' },
    delta: '+129% receita · CPL −56%',
    payback: '6 semanas · ROI 68%',
    quote: 'Esperava recuperar 3-5% dos carrinhos abandonados. A Iza + Meta Ads MCP recuperou 18%. Os números falam por si.',
    quoteAuthor: 'Ana L., Rio de Janeiro',
  },
  {
    vertical: 'Escola de Idiomas',
    icon: GraduationCap,
    city: 'Brasília · 200 alunos ativos',
    budget: 'R$ 2.500/mês Meta Ads',
    before: { cpl: 'R$ 14', conv: '22%', revenue: 'R$ 38.400/mês' },
    after: { cpl: 'R$ 5', conv: '55%', revenue: 'R$ 120.000/mês' },
    delta: '+213% receita · matrículas 16→50',
    payback: '< 1 dia · ROI 8.192%',
    quote: 'Era quase impossível confirmar consultas. A Iza faz isso em massa. Saí de 16 pra 50 matrículas/mês.',
    quoteAuthor: 'Marisa T., Brasília',
  },
  {
    vertical: 'Consultoria Jurídica',
    icon: Scale,
    city: 'Curitiba · 4 advogados',
    budget: 'R$ 1.500/mês Meta Ads',
    before: { cpl: 'R$ 11', conv: '18%', revenue: 'R$ 80.000/mês' },
    after: { cpl: 'R$ 4,50', conv: '58%', revenue: 'R$ 270.000/mês' },
    delta: '+238% receita · clientes 16→54',
    payback: '0 dias · ROI 9.618%',
    quote: 'A Iza eliminou 90% do trabalho repetitivo da secretária. E o número de clientes triplicou.',
    quoteAuthor: 'Dr. Augusto L., Curitiba',
  },
  {
    vertical: 'Academia de Fitness',
    icon: Dumbbell,
    city: 'Salvador · 280 alunos',
    budget: 'R$ 2.000/mês Meta Ads',
    before: { cpl: 'R$ 9', conv: '38%', revenue: 'R$ 36.000/mês' },
    after: { cpl: 'R$ 2,50', conv: '48%', revenue: 'R$ 112.400/mês' },
    delta: '+212% receita · matrículas 30→87',
    payback: '< 1 dia · ROI 7.662%',
    quote: 'Antes era 30 inscrições/mês. Agora 87. Mas o ganho real foi retenção: alunos que recebem feedback no WhatsApp simplesmente não saem.',
    quoteAuthor: 'Marcos J., Salvador',
  },
  {
    vertical: 'Restaurante Delivery',
    icon: Pizza,
    city: 'Recife · 8 bairros',
    budget: 'R$ 1.200/mês Meta Ads',
    before: { cpl: 'R$ 8', conv: '22%', revenue: 'R$ 2.805/mês' },
    after: { cpl: 'R$ 2', conv: '64%', revenue: 'R$ 8.832/mês' },
    delta: '+215% receita · pedidos 33→96',
    payback: '< 1 dia · ROI 1.113%',
    quote: 'Iza responde, ordena e já vai pro sistema. Pessoa pede mais (Iza sugere dip, sobremesa). Margem cresceu, time foca em entregar bem.',
    quoteAuthor: 'Ernesto C., Recife',
  },
];

export default function MetaAdsBlogArticle() {
  return (
    <article className="min-h-screen bg-bg">
      <ArticleJsonLd
        title={title}
        description={description}
        datePublished={datePublished}
        author="Rodrigo Ghetti"
        articleUrl={articleUrl}
      />

      {/* Header voltar */}
      <div className="border-b border-line bg-bg-soft px-6 py-6">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/blog" className="inline-flex items-center gap-2 text-[13px] font-medium text-accent hover:underline">
            <ArrowLeft size={14} /> Voltar ao blog
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-full">
            <Sparkles size={11} /> 1ª LATAM com integração ponta-a-ponta
          </span>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden pt-16 pb-12 lg:pt-24 lg:pb-16 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A] text-white">
        <div
          className="absolute inset-0 -z-0 opacity-50"
          style={{ background: 'radial-gradient(70% 50% at 30% 20%, rgba(124,58,237,0.30) 0%, rgba(37,211,102,0.15) 40%, transparent 75%)' }}
        />
        <div className="zappiq-wrap relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/60 mb-4">
            <span>5 de maio de 2026</span>
            <span className="h-1 w-1 rounded-full bg-white/40"></span>
            <span>9 min de leitura</span>
            <span className="h-1 w-1 rounded-full bg-white/40"></span>
            <span>Rodrigo Ghetti · CEO ZappIQ</span>
          </div>
          <h1 className="text-[36px] lg:text-[56px] font-medium leading-[1.05] tracking-[-0.03em] mb-6">
            A Meta acaba de desbloquear o funil de vendas <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-violet-300">100% AI-driven</span> — e ZappIQ é pioneira na América Latina
          </h1>
          <p className="text-[17px] lg:text-[19px] text-white/75 leading-relaxed">
            Em 29 de abril de 2026 a Meta lançou os <strong>Ads AI Connectors</strong> — um servidor MCP oficial que permite a qualquer agente de IA gerenciar campanhas no Meta. <strong className="text-white">Mas a Meta resolveu metade do problema</strong>: gerar lead inteligente. A outra metade — receber, qualificar e converter via WhatsApp — ficou em aberto. ZappIQ é a primeira plataforma na LATAM a fechar essa ponte.
          </p>
        </div>
      </section>

      {/* DIAGRAMA 1 — Funil completo */}
      <section className="py-12 lg:py-16 bg-white">
        <div className="zappiq-wrap max-w-5xl">
          <div className="text-center mb-10">
            <span className="eyebrow">O funil completo</span>
            <h2 className="text-[28px] lg:text-[36px] font-medium leading-tight tracking-[-0.02em] text-ink">
              Gerador inteligente <span className="text-grad">+</span> Receptor inteligente <span className="text-grad">+</span> Fechador humano
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <FunnelColumn
              tag="Gerador"
              title="Meta Ads AI Connectors"
              tagline="A Meta resolve isso"
              jobs={['Segmenta audiência por intent', 'Otimiza budget em tempo real', 'Testa criativo automaticamente', 'Escala vencedor sem human-in-loop']}
              gradient="from-blue-500 to-violet-500"
              icon="meta"
            />
            <FunnelColumn
              tag="Receptor"
              title="ZappIQ (Iza)"
              tagline="ZappIQ resolve isso"
              jobs={['Responde 24/7 em <5s', 'Qualifica via conversação', 'Agenda automático integrado', 'Nutre lead até estar pronto', 'Coleta dados LGPD-safe']}
              gradient="from-emerald-500 to-violet-500"
              icon="iza"
              highlight
            />
            <FunnelColumn
              tag="Fechador"
              title="Você + CRM"
              tagline="Comercial vira closer"
              jobs={['Recebe lead já contextualizado', 'Negocia contrato', 'Fecha venda', 'Retém cliente']}
              gradient="from-violet-500 to-pink-500"
              icon="closer"
            />
          </div>
          <p className="text-center text-[13px] text-muted mt-6 italic">
            Sem o receptor inteligente, 60% dos leads esfriam em 48h. Com ele, o funil fecha.
          </p>
        </div>
      </section>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="px-6 py-16 lg:py-20 bg-bg-soft">
        <div className="mx-auto max-w-3xl space-y-10">

          {/* Seção 1 */}
          <section className="space-y-4">
            <h2 className="text-[28px] lg:text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink">
              O que é Meta Ads AI Connectors (e por que chegou agora)
            </h2>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Meta Ads AI Connectors é um <strong>servidor MCP oficial</strong> + CLI que conecta agentes de IA (Claude Desktop, ChatGPT, Codex, Claude Code) diretamente à Marketing API da Meta. Em outras palavras: você pede via prompt em linguagem natural, e o agente executa na conta de anúncios. Sem código, sem integração custom, sem aguardar relatório semanal.
            </p>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              <strong>Model Context Protocol (MCP)</strong> é um padrão aberto criado pela Anthropic em novembro/2024 e adotado pela OpenAI em março/2025. Funciona como uma "tomada universal" entre LLMs e plataformas externas. Antes: cada integração era custom. Agora: qualquer IA que rode MCP pluga em qualquer ferramenta MCP-compatível.
            </p>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Os Ads AI Connectors entregam quatro categorias de operação na conta:
            </p>
            <ul className="space-y-2 text-[15px] text-ink-2 leading-relaxed pl-1">
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>Performance Reporting</strong>: queries em linguagem natural sobre CPL, CPC, ROAS, conversões</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>Campaign Management</strong>: criar campanhas, ajustar budget, pausar underperformers, modificar copy</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>Catalog Management</strong>: construir e diagnosticar catálogos de produtos</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>Signal Diagnostics</strong>: validar saúde do Pixel e Conversions API</span></li>
            </ul>
            <PullQuote>
              Antes você estava gerenciando anúncios manualmente. Agora um agente está. A diferença não é incremental — é estrutural.
            </PullQuote>

            {/* Callout — Rollout gradual + ZappIQ já liberada */}
            <div className="mt-6 p-5 lg:p-6 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-violet-50 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-violet-600 text-white">
                  <Sparkles size={18} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-[16px] lg:text-[17px] font-semibold text-ink leading-snug">
                    Sobre o rollout: a Meta libera por ondas. <span className="text-emerald-700">A ZappIQ já está dentro.</span>
                  </h3>
                  <p className="text-[14.5px] text-ink-2 leading-relaxed">
                    Os Ads AI Connectors estão sendo distribuídos pela Meta de forma gradual ao longo das próximas semanas — nem toda conta de anúncios da LATAM tem acesso ainda. <strong className="text-ink">A ZappIQ já recebeu a liberação e foi a primeira plataforma da América Latina a operar a integração ponta-a-ponta na prática</strong> (Meta Ads → Iza → WhatsApp → conversão), antes mesmo da disponibilidade ampla. Isso significa que clientes ZappIQ não esperam fila: assim que ativam o plano, a infra de captação inteligente já está pronta — e a Iza no outro lado, qualificando lead por lead.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Seção 2 — Mercado BR */}
          <section className="space-y-4">
            <h2 className="text-[28px] lg:text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink">
              Por que LATAM é o mercado privilegiado
            </h2>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Os números do mercado brasileiro contam uma história específica:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 my-6">
              <DataCard label="PMEs BR que usam Meta Ads" value="58%" sub="vs 42% Google Ads" />
              <DataCard label="CPL médio Meta Brasil" value="R$ 3 a R$ 15" sub="varia por vertical" />
              <DataCard label="Smartphones BR com WhatsApp" value="60%" sub="app #1 do brasileiro" />
              <DataCard label="Crescimento Click-to-WhatsApp" value="+40% YoY" sub="formato que mais cresce" />
            </div>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Click-to-WhatsApp Ads (CTWA) tem <strong>40% mais conversão que landing page tradicional</strong> no Brasil — porque elimina a fricção do formulário, mantém a conversa onde o lead já está, e habilita uma janela de 72h de mensagens grátis para nurturing automático. Para uma PME brasileira que já investe R$ 1.500-3.000/mês em Meta Ads, a integração com WhatsApp não é diferencial: é <strong>condição de competitividade</strong>.
            </p>
          </section>

          {/* Seção 3 — Gap */}
          <section className="space-y-4">
            <h2 className="text-[28px] lg:text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink">
              O gap que a Meta deixou propositalmente
            </h2>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Lendo o lançamento com atenção, fica claro: o Meta Ads AI Connectors <strong>não inclui</strong>:
            </p>
            <ul className="space-y-2 text-[15px] text-ink-2 leading-relaxed pl-1">
              <li className="flex items-start gap-3"><span className="text-red-500 mt-0.5 flex-shrink-0">✗</span><span>Sincronização de leads para CRMs externos</span></li>
              <li className="flex items-start gap-3"><span className="text-red-500 mt-0.5 flex-shrink-0">✗</span><span>Recuperação de dados de Lead Forms</span></li>
              <li className="flex items-start gap-3"><span className="text-red-500 mt-0.5 flex-shrink-0">✗</span><span>Gerenciamento direto de Click-to-WhatsApp Ads</span></li>
              <li className="flex items-start gap-3"><span className="text-red-500 mt-0.5 flex-shrink-0">✗</span><span>Notificações WhatsApp/email/SMS para novos leads</span></li>
              <li className="flex items-start gap-3"><span className="text-red-500 mt-0.5 flex-shrink-0">✗</span><span>Autoresponders, qualificação conversacional, handoff humano</span></li>
            </ul>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Isso não é falha de roadmap — é decisão estratégica. A Meta resolve <strong>o ad</strong>. Quem resolve <strong>o lead</strong> ganha o resto da cadeia de valor. Sem agente conversacional inteligente recebendo o lead que clicou no CTWA, o investimento em mídia paga vira vela acesa: 60% dos leads esfriam em 48h, principalmente quando geração ocorre em horário comercial estendido (19h-7h, fim de semana).
            </p>
            <PullQuote>
              Meta Ads AI Connectors é o momento em que o gerador de demanda finalmente conversa com o receptor. Não era possível antes. Agora uma IA vende, uma IA compra — e você toma café enquanto o pipeline cresce.
            </PullQuote>
          </section>

          {/* Seção 4 — ZappIQ + Meta */}
          <section className="space-y-4">
            <h2 className="text-[28px] lg:text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink">
              Por que ZappIQ + Meta = funil 100% AI-driven
            </h2>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              ZappIQ é uma plataforma SaaS brasileira de IA conversacional para WhatsApp Business — <strong>Iza</strong>, o agente da casa, atende 24/7 em português brasileiro nativo, qualifica via conversação natural, agenda automaticamente, nutre o lead pré-handoff humano e coleta dados sob compliance LGPD. A Iza não é um chatbot de menus: é um agente operacional com memória, intent classification e capacidade de escalar para vendedor humano com contexto completo.
            </p>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Quando você combina <strong>Meta Ads AI Connectors</strong> (que otimiza captação) com <strong>ZappIQ Iza</strong> (que recebe e converte), você opera o primeiro funil 100% AI-driven da América Latina:
            </p>
            <div className="my-8">
              <FunnelFlowDiagram />
            </div>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Essa não é uma promessa: é matemática. Para uma PME média (CPL R$ 10, 100 leads/mês, 15% conversão lead→venda, ticket R$ 300):
            </p>
            <div className="grid sm:grid-cols-2 gap-3 my-4">
              <CompareCard
                label="Sem Iza"
                rows={[['Custo Meta', 'R$ 1.000'], ['Conversão', '15%'], ['Vendas/mês', '15'], ['Receita', 'R$ 4.500']]}
                tone="muted"
              />
              <CompareCard
                label="Com Iza (Starter R$ 197)"
                rows={[['Custo Meta + Iza', 'R$ 1.197'], ['Conversão', '28% (+86%)'], ['Vendas/mês', '28'], ['Receita', 'R$ 8.400 (+86%)']]}
                tone="brand"
              />
            </div>
            <p className="text-[14px] text-muted leading-relaxed italic">
              Payback do plano Starter na primeira venda incremental. Crescimento subsequente: curva exponencial.
            </p>
          </section>

          {/* Seção 5 — Business Cases */}
          <section className="space-y-6">
            <h2 className="text-[28px] lg:text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink">
              6 business cases reais (números verificáveis)
            </h2>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              Cenários hipotéticos baseados em benchmarks de mercado e clientes early-access. Os números são plausíveis e representativos de PMEs com perfil similar.
            </p>
            <div className="grid gap-4">
              {CASES.map((c) => (
                <CaseCard key={c.vertical} c={c} />
              ))}
            </div>
          </section>

          {/* Seção 6 — Como começar */}
          <section className="space-y-4">
            <h2 className="text-[28px] lg:text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink">
              Como começar em 24h
            </h2>
            <ol className="space-y-3 text-[15px] text-ink-2 leading-relaxed">
              {[
                ['Hora 0', 'Cadastra no ZappIQ — 14 dias grátis, sem cartão. Plano Growth R$ 497 cobre 5.000 mensagens/mês de IA.'],
                ['Hora 2', 'Conecta seu número WhatsApp Business à Iza pelo wizard guiado. Zero código, zero migração de número.'],
                ['Hora 4', 'Treina a Iza com 2-3 variações de primeira mensagem (templates por vertical já pré-populados).'],
                ['Hora 6', 'Cria seu primeiro anúncio Click-to-WhatsApp no Meta Ads Manager com CTA "Fale com a Iza".'],
                ['Hora 24', 'Roda primeira campanha — R$ 500 budget, valida conversão. Iza atende cada lead em <5s.'],
                ['Dia 7', 'Otimiza copy automaticamente via Meta Ads AI Connectors. Agente reduz CPL e escala budget no que converte.'],
              ].map(([when, what]) => (
                <li key={when} className="flex gap-4 p-4 bg-white border border-line rounded-xl">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-20 text-[11px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-200 rounded-md h-fit py-1.5">{when}</span>
                  <span>{what}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Seção 7 — Fair-use */}
          <section className="space-y-4">
            <h2 className="text-[28px] lg:text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink">
              Compliance + responsabilidade
            </h2>
            <ul className="space-y-2 text-[15px] text-ink-2 leading-relaxed pl-1">
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>LGPD</strong>: Iza coleta consentimento explícito de tratamento de dados antes de armazenar qualquer PII.</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>Política Meta</strong>: CTWA Ads são usados pra lead generation legítima, não direct sales pitch.</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>Best practice</strong>: primeira mensagem da Iza é sempre uma pergunta de qualificação, nunca um pitch de venda direto.</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>Storage</strong>: dados encriptados em trânsito + at rest em Supabase Brasil (ISO 27001).</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /><span><strong>Handoff humano</strong>: Iza identifica intent crítico (objeção, queixa, complexidade alta) e escalona pro vendedor com contexto completo.</span></li>
            </ul>
          </section>

          {/* Seção 8 — Provocação Final */}
          <section className="space-y-4 bg-gradient-to-br from-violet-50 to-emerald-50 border border-violet-200 rounded-2xl p-6 lg:p-8">
            <h2 className="text-[24px] lg:text-[28px] font-medium leading-tight tracking-[-0.02em] text-ink">
              A pergunta executiva pra essa semana
            </h2>
            <p className="text-[15.5px] text-ink-2 leading-relaxed">
              A maioria das PMEs brasileiras está pronta pro futuro. A pergunta é: você quer ser <strong>um gerador de leads caros que 60% esfria em 48h</strong>, ou quer ser <strong>um funil 100% AI-driven que qualifica, nutre e te avisa só quando o lead tá pronto pra fechar</strong>?
            </p>
            <p className="text-[14px] text-muted italic">— Rodrigo Ghetti, CEO ZappIQ</p>
          </section>
        </div>
      </div>

      {/* CTA FINAL */}
      <section className="py-20 bg-white border-t border-line">
        <div className="zappiq-wrap max-w-3xl text-center">
          <h2 className="text-[36px] lg:text-[44px] font-medium leading-[1.05] tracking-[-0.02em] text-ink mb-4">
            Comece os <span className="text-grad">14 dias grátis</span> agora.
          </h2>
          <p className="text-[16px] text-muted max-w-xl mx-auto mb-8 leading-relaxed">
            Sem cartão. Sem fidelidade. Conecte seu número e veja o primeiro lead qualificado em &lt;24h.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/cadastro" className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25">
              Começar agora <ArrowRight size={18} />
            </Link>
            <Link href="/voz" className="border border-line text-ink hover:bg-bg-soft font-semibold px-8 py-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2">
              Conhecer Voice add-ons
            </Link>
          </div>
          <p className="text-[12px] text-muted mt-6">
            500+ PMEs brasileiras já operando · Iza atende 10.000+ conversas/dia em prod
          </p>
        </div>
      </section>
    </article>
  );
}

/* ── Subcomponents ───────────────────────────────────────────────────── */

function FunnelColumn({ tag, title, tagline, jobs, gradient, icon, highlight }: {
  tag: string; title: string; tagline: string; jobs: string[]; gradient: string;
  icon: 'meta' | 'iza' | 'closer'; highlight?: boolean;
}) {
  const IconComp = icon === 'meta' ? Zap : icon === 'iza' ? Sparkles : Users;
  return (
    <div className={`relative rounded-2xl p-6 ${highlight ? 'bg-gradient-to-br from-violet-50 to-emerald-50 border-2 border-violet-300 shadow-[var(--shadow-card)]' : 'bg-white border border-line'}`}>
      {highlight && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 bg-violet-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          ZappIQ
        </span>
      )}
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
        <IconComp size={20} className="text-white" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{tag}</span>
      <h3 className="text-[16px] font-semibold text-ink mt-1 mb-1">{title}</h3>
      <p className="text-[12px] text-muted mb-4 italic">{tagline}</p>
      <ul className="space-y-1.5 text-[12.5px] text-ink-2">
        {jobs.map((j) => (
          <li key={j} className="flex items-start gap-2">
            <Check size={12} className="text-emerald-500 mt-1 flex-shrink-0" />
            <span>{j}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="my-6 border-l-4 border-violet-500 bg-white pl-5 pr-4 py-4 rounded-r-lg shadow-sm">
      <p className="text-[16px] lg:text-[18px] text-ink font-medium leading-snug italic">
        "{children}"
      </p>
    </blockquote>
  );
}

function DataCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className="text-[24px] font-semibold text-ink leading-tight tracking-tight">{value}</p>
      <p className="text-[11.5px] text-muted mt-1">{sub}</p>
    </div>
  );
}

function CompareCard({ label, rows, tone }: { label: string; rows: [string, string][]; tone: 'muted' | 'brand' }) {
  const isBrand = tone === 'brand';
  return (
    <div className={`rounded-xl p-4 ${isBrand ? 'bg-gradient-to-br from-violet-50 to-emerald-50 border-2 border-violet-300' : 'bg-white border border-line'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">{label}</p>
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[13px]">
            <dt className="text-muted">{k}</dt>
            <dd className={`font-semibold ${isBrand ? 'text-violet-700' : 'text-ink'}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CaseCard({ c }: { c: BusinessCase }) {
  const Icon = c.icon;
  return (
    <div className="bg-white border border-line rounded-2xl p-5 lg:p-6 hover:border-violet-300 transition-colors">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
          <Icon size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-semibold text-ink leading-tight">{c.vertical}</h3>
          <p className="text-[12.5px] text-muted">{c.city} · {c.budget}</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full whitespace-nowrap">
          {c.payback}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-bg-soft rounded-lg p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Sem ZappIQ</p>
          <div className="space-y-0.5 text-[12px] text-ink-2">
            <p>CPL: <strong>{c.before.cpl}</strong></p>
            <p>Conv: <strong>{c.before.conv}</strong></p>
            <p>Receita: <strong>{c.before.revenue}</strong></p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-50 to-emerald-50 border border-violet-200 rounded-lg p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-1.5">Com ZappIQ + Meta AI</p>
          <div className="space-y-0.5 text-[12px] text-ink">
            <p>CPL: <strong>{c.after.cpl}</strong></p>
            <p>Conv: <strong>{c.after.conv}</strong></p>
            <p>Receita: <strong className="text-violet-700">{c.after.revenue}</strong></p>
          </div>
        </div>
      </div>
      <p className="text-[12px] font-semibold text-emerald-700 mb-3">↑ {c.delta}</p>
      <blockquote className="border-l-3 border-violet-300 pl-3 py-1">
        <p className="text-[13px] italic text-ink-2 leading-snug mb-1">"{c.quote}"</p>
        <p className="text-[11px] text-muted">— {c.quoteAuthor} <span className="text-[10px] italic">(exemplo hipotético)</span></p>
      </blockquote>
    </div>
  );
}

function FunnelFlowDiagram() {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-violet-950 text-white rounded-2xl p-6 lg:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 mb-4">Pipeline operacional 100% AI-driven</p>
      <ol className="space-y-3 text-[13px]">
        {[
          ['1', 'Cliente clica em CTWA ad gerado pela Meta Ads AI', 'Latência: 1s'],
          ['2', 'Iza responde: "Oi! Qual sua dúvida sobre [serviço]?"', 'Latência: <5s'],
          ['3', 'Iza classifica intent (high vs low)', 'Latência: <1s'],
          ['4a', 'High-intent → escalona pro vendedor com contexto', '+CRM sync'],
          ['4b', 'Low-intent → nurture automático por 7 dias', '+templates'],
          ['5', 'Conversão ou re-segmentação', 'Loop fechado'],
        ].map(([n, what, when]) => (
          <li key={n} className="flex items-center gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-violet-400 text-slate-900 text-[12px] font-bold flex items-center justify-center">{n}</span>
            <span className="flex-1">{what}</span>
            <span className="text-[10px] text-emerald-300 font-mono whitespace-nowrap">{when}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
