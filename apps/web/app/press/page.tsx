import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, Calendar, Download, ChevronDown } from 'lucide-react';

/* NOTA: Preços mencionados nesta página editorial acompanham
   packages/shared/src/planConfig.ts (single source of truth).
   Valores atuais: Starter R$ 197, Growth R$ 497, Scale R$ 997, Business R$ 1.997. */

export const metadata: Metadata = {
  title: 'Press Kit · ZappIQ',
  description:
    'Recursos para imprensa: dados corporativos, founder bio, kit visual e contato direto. ZappIQ é a plataforma SaaS de IA conversacional da MACHIA Tecnologia Disruptiva.',
  openGraph: {
    title: 'Press Kit · ZappIQ',
    description:
      'Recursos para imprensa: dados corporativos, founder bio, kit visual e contato direto. ZappIQ é a plataforma SaaS de IA conversacional da MACHIA Tecnologia Disruptiva.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://zappiq.com.br/press',
    siteName: 'ZappIQ',
    images: ['/og-default.png'],
  },
};

/* FASE 4 P7+ (2026-05-18): reescrita pos-auditoria.
 * Drift purgado: "21 dias trial", "US$ 15 LLM credit", "proteção de margem",
 * "Readiness Score", "5 mil clientes" (claims não verificáveis), "Onze e Onze".
 * Adicionado: razão social MACHIA + CNPJ, diferencial Cloud API direto,
 * roadmap factual, boilerplate corporativo. */

const FAQ = [
  {
    q: 'Qual o diferencial técnico da ZappIQ?',
    a: 'Três pontos. Primeiro: integração direta na WhatsApp Cloud API oficial da Meta, sem intermediação de BSP — o cliente é dono do próprio número WABA. Segundo: Onboarding Zero, com setup self-service em 30 a 90 minutos sem custo de implementação. Terceiro: Self-healing agent quality, mecanismo proprietário que monitora qualidade conversacional e corrige drift do agente de IA automaticamente.',
  },
  {
    q: 'Qual o mercado endereçável?',
    a: 'Pequenas e médias empresas brasileiras com volume entre algumas centenas e dezenas de milhares de atendimentos/mês pelo WhatsApp. O mercado de automação WhatsApp no Brasil cresce em ritmo consistente de dois dígitos ao ano, impulsionado pela penetração do aplicativo (95%+ dos brasileiros conectados) e pela maturação da Cloud API da Meta.',
  },
  {
    q: 'Como foi o processo de fundação?',
    a: 'Rodrigo Ghetti decidiu fundar a ZappIQ após repetidas frustrações comerciais como cliente de plataformas de IA conversacional incumbentes — incluindo setup fees de cinco dígitos para tarefas que, com LLMs modernos, são triviais. A ZappIQ foi estruturada em 2026 sob a holding MACHIA Tecnologia Disruptiva como resposta concreta a esse modelo.',
  },
  {
    q: 'Quais são os planos para os próximos 12 meses?',
    a: 'Roadmap público: (1) rollout do Instagram Direct para todos os clientes após App Review Meta concluída; (2) expansão de pacotes de voz outbound com vozes Neural2 adicionais; (3) deepening do Self-healing agent quality com novos sinais; (4) integrações nativas com CRMs e ERPs amplamente adotados pelo segmento PME; (5) plano Enterprise com SLAs customizados. Metas comerciais detalhadas não são divulgadas publicamente.',
  },
  {
    q: 'Como a ZappIQ trata LGPD e dados sensíveis?',
    a: 'Conformidade plena à LGPD. Dados de clientes ficam em infraestrutura brasileira, com criptografia em trânsito e em repouso. Termos de processamento de dados explícitos em contrato. Dados de clientes não são utilizados para treinar modelos de IA. Boas práticas de segurança operacional auditadas internamente, com roadmap de certificações formais em avaliação.',
  },
];

const QUOTES = [
  '"Setup fee em IA conversacional virou anacronismo. Cobrar R$ 8 mil para uma configuração que qualquer LLM moderno entrega em minutos é desrespeito com o cliente. A ZappIQ nasceu para recolocar o preço no lugar certo: na entrega de valor, não no atrito de implantação."',
  '"O dono do negócio sempre soube melhor que qualquer consultor externo como sua operação funciona. Nossa obrigação é dar uma plataforma que ele consiga colocar em produção sozinho — e que melhore sozinha, sem ele virar engenheiro de prompt."',
  '"Quem usa BSP está pagando pedágio para um intermediário ser dono do número da empresa dele. A gente faz o oposto: integração direta na Cloud API da Meta. O número é do cliente, sempre foi, sempre vai ser."',
];

const ASSETS = [
  { title: 'Logo em alta resolução', desc: 'Logo ZappIQ em PNG e SVG para uso editorial', href: '/press/zappiq-logo.zip', cta: 'Download ZIP →' },
  { title: 'Screenshots da plataforma', desc: 'Imagens da interface para ilustrar reportagens', href: '/press/screenshots.zip', cta: 'Download ZIP →' },
  { title: 'Headshot do founder', desc: 'Foto profissional de Rodrigo Ghetti em alta resolução', href: '/press/headshot-rodrigo-ghetti.jpg', cta: 'Download JPG →' },
  { title: 'Identidade visual', desc: 'Cores, tipografia e guia de marca', href: '/press/brand-guidelines.pdf', cta: 'Download PDF →' },
];

export default function PressPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="border-b border-gray-200 px-6 py-20 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-jakarta text-4xl font-bold text-gray-900 sm:text-5xl">
            Press Kit ZappIQ
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Recursos para jornalistas, analistas de mercado e criadores de conteúdo.
            Dados corporativos, founder bio, kit visual e contato direto.
          </p>
        </div>
      </section>

      {/* Sobre a empresa */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Sobre a empresa</h2>
          <div className="mt-8 space-y-4 text-base text-gray-700 leading-relaxed">
            <p>
              ZappIQ é a plataforma SaaS de IA conversacional para WhatsApp Business e Instagram
              Direct desenvolvida pela <strong>MACHIA Tecnologia Disruptiva Ltda</strong> (d.b.a.
              ZappIQ). A plataforma atende pequenas e médias empresas brasileiras que precisam
              automatizar atendimento, vendas e campanhas sem depender de consultor implementador
              ou setup fee.
            </p>
            <p>
              Diferente do mercado, a ZappIQ opera com integração direta na <strong>WhatsApp Cloud
              API oficial da Meta</strong> — sem intermediação de BSP (Business Solution Provider).
              O cliente é proprietário contratual do próprio número WABA, eliminando fees por
              mensagem e lock-in técnico de templates. A mesma agente de IA atende WhatsApp,
              Instagram Direct e chat in-page do site, com contexto unificado.
            </p>
            <p>
              Fundada em 2026 por Rodrigo Ghetti, a tese da ZappIQ é que LLMs modernos tornaram
              obsoleto o modelo de cobrança por setup e consultoria de implementação. A plataforma
              entrega <strong>Onboarding Zero</strong>: configuração self-service em 30 a 90
              minutos, sem custo de implementação.
            </p>
            <p>
              Sediada em São Paulo, a empresa opera 100% cloud-native, com infraestrutura
              escalável, conformidade à LGPD e dados armazenados em região brasileira.
            </p>
          </div>
        </div>
      </section>

      {/* Founder bio */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Founder: Rodrigo Ghetti</h2>
          <div className="mt-8 space-y-4 text-base text-gray-700 leading-relaxed">
            <p>
              Rodrigo Ghetti é executivo sênior de vendas e pré-vendas B2B com mais de 10 anos em
              Digital Communications e plataformas omnichannel. Antes de fundar a ZappIQ, liderou
              áreas de vendas e implementação em players brasileiros do setor, onde vivenciou de
              perto as fricções comerciais que motivaram a criação da plataforma.
            </p>
            <p>
              É reconhecido pelo foco em simplificar produtos técnicos complexos e por questionar
              publicamente o modelo de setup fee em IA conversacional, que considera incompatível
              com a realidade econômica dos LLMs atuais. A ZappIQ é a expressão concreta dessa
              convicção.
            </p>
          </div>
        </div>
      </section>

      {/* Fatos rápidos */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Fatos rápidos</h2>
          <ul className="mt-8 space-y-3 text-base text-gray-700">
            <li><strong>Razão social:</strong> MACHIA Tecnologia Disruptiva Ltda</li>
            <li><strong>Nome fantasia:</strong> ZappIQ</li>
            <li><strong>CNPJ:</strong> 46.788.145/0001-08</li>
            <li><strong>Ano de fundação:</strong> 2026</li>
            <li><strong>Sede:</strong> São Paulo, Brasil</li>
            <li><strong>Categoria:</strong> SaaS B2B · IA Conversacional · Mensageria</li>
            <li><strong>Canais suportados:</strong> WhatsApp Business (Cloud API direto Meta), Instagram Direct (piloto), chat in-page</li>
            <li><strong>Tier inicial:</strong> R$ 197/mês (Starter) · até Enterprise sob consulta</li>
            <li><strong>Trial:</strong> 14 dias grátis, sem cartão de crédito</li>
            <li><strong>Diferenciais técnicos:</strong> Cloud API direto Meta (sem BSP), Onboarding Zero (setup self-service em 30-90min), Self-healing agent quality, voz neural inbound e outbound</li>
            <li><strong>Conformidade:</strong> LGPD, dados em região BR, SLA contratual a partir do plano Business</li>
          </ul>
        </div>
      </section>

      {/* Assets */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Assets disponíveis</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ASSETS.map((asset) => (
              <div key={asset.title} className="rounded-lg border border-gray-200 p-6">
                <div className="flex items-start gap-3">
                  <Download className="mt-1 h-5 w-5 text-indigo-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{asset.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{asset.desc}</p>
                    <a
                      href={asset.href}
                      className="mt-3 inline-flex text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      {asset.cta}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quotes */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Quotes do founder</h2>
          <div className="mt-8 space-y-6">
            {QUOTES.map((q, i) => (
              <blockquote key={i} className="border-l-4 border-indigo-600 pl-6 italic text-gray-700">
                {q}
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Contato */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Contato para imprensa</h2>
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-gray-700">
              <Mail className="h-5 w-5 text-indigo-600" />
              <a href="mailto:press@zappiq.com.br" className="hover:text-indigo-600">
                press@zappiq.com.br
              </a>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Phone className="h-5 w-5 text-indigo-600" />
              <a href="https://wa.me/5511926160159" className="hover:text-indigo-600">
                (11) 92616-0159 · WhatsApp
              </a>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <a
                href="https://cal.com/rodrigoghetti/zappiq-demo"
                className="hover:text-indigo-600"
                target="_blank"
                rel="noopener noreferrer"
              >
                Agendar entrevista com o founder
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">
            Perguntas frequentes da imprensa
          </h2>
          <div className="mt-8 space-y-4">
            {FAQ.map((item) => (
              <details key={item.q} className="group border border-gray-200 rounded-lg p-6">
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900">
                  {item.q}
                  <ChevronDown className="h-5 w-5 text-gray-600 transition group-open:rotate-180" />
                </summary>
                <p className="mt-4 text-gray-700">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-6 py-16 sm:px-8 sm:py-24 bg-gray-50">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Quer entender mais?</h2>
          <p className="mt-4 text-gray-700">
            Conheça a plataforma, marque uma conversa com o founder ou leia o conteúdo editorial
            da ZappIQ sobre o futuro da IA conversacional no Brasil.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="inline-flex justify-center rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 transition"
            >
              Agendar demo
            </Link>
            <Link
              href="/comparativo"
              className="inline-flex justify-center rounded-lg bg-white border border-gray-300 px-6 py-3 font-medium text-gray-900 hover:bg-gray-50 transition"
            >
              Ver comparativo de mercado
            </Link>
          </div>
        </div>
      </section>

      {/* Footer + Boilerplate */}
      <footer className="border-t border-gray-200 px-6 py-12 sm:px-8 bg-gray-50">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-gray-700 leading-relaxed">
            <strong>Sobre a MACHIA Tecnologia Disruptiva.</strong> A MACHIA é uma holding
            brasileira de tecnologia que desenvolve produtos SaaS focados em automação
            inteligente para o segmento PME. ZappIQ é seu produto carro-chefe, dedicado a IA
            conversacional para canais de mensageria (WhatsApp Cloud API, Instagram Direct e
            chat web). MACHIA Tecnologia Disruptiva Ltda · CNPJ 46.788.145/0001-08 · São Paulo,
            Brasil.
          </p>
          <p className="text-xs text-gray-500 mt-6">
            © 2026 MACHIA Tecnologia Disruptiva Ltda. Todos os direitos reservados. ZappIQ é
            marca de titularidade da MACHIA. WhatsApp e Instagram são marcas registradas da
            Meta Platforms, Inc.
          </p>
        </div>
      </footer>
    </main>
  );
}
