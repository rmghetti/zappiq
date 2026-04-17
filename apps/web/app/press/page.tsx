import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, Calendar, Download, ChevronDown } from 'lucide-react';

/* NOTA: Preços mencionados nesta página editorial devem acompanhar
   packages/shared/src/planConfig.ts (single source of truth).
   Valores atuais: STARTER=R$247, GROWTH=R$797, SCALE=R$1.697, BUSINESS=R$3.997. */

export const metadata: Metadata = {
  title: 'Press Kit · ZappIQ',
  description:
    'Recursos para jornalistas e criadores de conteúdo. Informações sobre ZappIQ, founder bio, assets e contato para imprensa.',
  openGraph: {
    title: 'Press Kit · ZappIQ',
    description:
      'Recursos para jornalistas e criadores de conteúdo. Informações sobre ZappIQ, founder bio, assets e contato para imprensa.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://zappiq.com.br/press',
    siteName: 'ZappIQ',
    images: ['/og-default.png'],
  },
};

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
            Recursos para jornalistas e criadores de conteúdo
          </p>
        </div>
      </section>

      {/* Sobre a empresa */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Sobre a empresa</h2>
          <div className="mt-8 space-y-4 text-base text-gray-700 leading-relaxed">
            <p>
              ZappIQ é uma plataforma brasileira de IA conversacional para WhatsApp Business,
              focada em PMEs que precisam automatizar atendimento, vendas e campanhas sem
              expertise em tecnologia e sem necessidade de consultor implementador.
            </p>
            <p>
              Fundada em 2026 por Rodrigo Ghetti, a ZappIQ nasceu de uma frustração pessoal
              com o modelo padrão do mercado: cobrar setup fees altos para tarefas que modernos
              LLMs e RAG tornam completamente automatizadas. Nossa tese é que a plataforma
              deve ser tão intuitiva que o cliente chegue a produção em 47 minutos, sem ajuda
              externa.
            </p>
            <p>
              O diferencial ZappIQ é zero setup fee, trial de 21 dias com proteção de margem,
              e Readiness Score em tempo real que guia cada ação de treinamento da IA. Hoje,
              centenas de empresas estão em produção gerando receita direta via WhatsApp através
              da plataforma.
            </p>
            <p>
              Baseada em São Paulo, a ZappIQ é uma solução 100% cloud-native que roda em
              infraestrutura escalável, com conformidade plena à LGPD e políticas de dados
              sensíveis.
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
              Rodrigo Ghetti é gestor sênior de vendas e pré-vendas com 10+ anos de experiência
              em soluções B2B de Digital Communications. Antes de fundar a ZappIQ, liderou
              estruturas de vendas e implementação em uma das maiores plataformas de comunicação
              omnichannel do Brasil, onde vivenciou na prática os problemas que levaram à criação
              de ZappIQ.
            </p>
            <p>
              Rodrigo é conhecido por seu foco obsessivo em simplificar produtos complexos e
              rejeitar padrões de mercado que cobram dos clientes por trabalho que a tecnologia
              deveria fazer automaticamente. A ZappIQ é sua resposta concreta a essa convicção.
            </p>
          </div>
        </div>
      </section>

      {/* Fatos rápidos */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Fatos rápidos</h2>
          <ul className="mt-8 space-y-3 text-base text-gray-700">
            <li>
              <strong>Ano de fundação:</strong> 2026
            </li>
            <li>
              <strong>Sede:</strong> São Paulo, Brasil
            </li>
            <li>
              <strong>Categoria:</strong> SaaS B2B (IA Conversacional)
            </li>
            <li>
              <strong>Tier inicial:</strong> R$ 247/mês (Starter)
            </li>
            <li>
              <strong>Trial:</strong> 21 dias com até US$ 15 em crédito LLM
            </li>
            <li>
              <strong>Diferencial:</strong> Zero setup fee, self-service completo, Readiness Score
            </li>
            <li>
              <strong>Conformidade:</strong> LGPD, privacidade de dados sensíveis, SLA disponível
            </li>
          </ul>
        </div>
      </section>

      {/* Assets */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Assets disponíveis</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-3">
                <Download className="mt-1 h-5 w-5 text-indigo-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Logo em alta resolução</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Logo ZappIQ em PNG e SVG para uso editorial
                  </p>
                  <a
                    href="/press/zappiq-logo.zip"
                    className="mt-3 inline-flex text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Download ZIP →
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-3">
                <Download className="mt-1 h-5 w-5 text-indigo-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Screenshots da plataforma</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Imagens da interface para ilustrar reportagens
                  </p>
                  <a
                    href="/press/screenshots.zip"
                    className="mt-3 inline-flex text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Download ZIP →
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-3">
                <Download className="mt-1 h-5 w-5 text-indigo-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Headshot do founder</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Foto profissional de Rodrigo Ghetti em alta resolução
                  </p>
                  <a
                    href="/press/headshot-rodrigo-ghetti.jpg"
                    className="mt-3 inline-flex text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Download JPG →
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-3">
                <Download className="mt-1 h-5 w-5 text-indigo-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Identidade visual</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Cores, tipografia e guia de marca
                  </p>
                  <a
                    href="/press/brand-guidelines.pdf"
                    className="mt-3 inline-flex text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Download PDF →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quotes */}
      <section className="border-b border-gray-200 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Quotes do founder</h2>
          <div className="mt-8 space-y-6">
            <blockquote className="border-l-4 border-indigo-600 pl-6 italic text-gray-700">
              "Setup fee em IA conversacional é fraude intelectual. Cobrar R$ 8 mil para fazer
              o que custa US$ 2 em compute só funciona enquanto o cliente não souber a verdade.
              A ZappIQ nasceu para mudar essa régua."
            </blockquote>

            <blockquote className="border-l-4 border-indigo-600 pl-6 italic text-gray-700">
              "O cliente sempre soube melhor que consultor externo como sua própria operação
              funciona. A plataforma deveria dar ferramentas para ele treinar a IA sozinho em
              47 minutos, não criar dependência de implementador."
            </blockquote>

            <blockquote className="border-l-4 border-indigo-600 pl-6 italic text-gray-700">
              "Vinte e um dias de trial grátis com proteção de margem é a prova viva de que o
              modelo funciona. Nenhuma plataforma que cobra setup fee consegue fazer isso."
            </blockquote>
          </div>
        </div>
      </section>

      {/* Contato para imprensa */}
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
              <a href="https://wa.me/5511945633305" className="hover:text-indigo-600">
                (11) 94563-3305 (WhatsApp)
              </a>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <a
                href="https://calendly.com/zappiq/press"
                className="hover:text-indigo-600"
                target="_blank"
                rel="noopener noreferrer"
              >
                Agendar entrevista
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
            <details className="group border border-gray-200 rounded-lg p-6">
              <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900">
                Qual o diferencial da ZappIQ?
                <ChevronDown className="h-5 w-5 text-gray-600 transition group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-gray-700">
                Zero setup fee escrito em contrato, self-service completo, Readiness Score em
                tempo real que guia cada ação de treinamento, e trial de 21 dias com proteção de
                margem. O cliente chega a produção em 47 minutos, sem consultor externo.
              </p>
            </details>

            <details className="group border border-gray-200 rounded-lg p-6">
              <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900">
                Qual o tamanho do mercado que vocês endereçam?
                <ChevronDown className="h-5 w-5 text-gray-600 transition group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-gray-700">
                PMEs brasileiras com volume entre 100 e 10 mil atendimentos/mês pelo WhatsApp.
                O mercado total de automação WhatsApp no Brasil em 2026 ultrapassa R$ 2 bilhões
                anuais, com crescimento de 40% year-over-year. ZappIQ endereça o segmento
                self-service que incumbentes negligenciaram.
              </p>
            </details>

            <details className="group border border-gray-200 rounded-lg p-6">
              <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900">
                Como foi o processo de fundação?
                <ChevronDown className="h-5 w-5 text-gray-600 transition group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-gray-700">
                Rodrigo Ghetti vivenciou pessoalmente o problema ao assinar contrato com
                plataforma incumbente: R$ 12 mil de setup fee para fazer upload de PDFs em um
                formulário. Isso o levou a estudar custos reais de LLM e RAG, comprovar que a
                operação custa centavos, e decidir criar ZappIQ em 2026 com modelo
                radicalmente diferente.
              </p>
            </details>

            <details className="group border border-gray-200 rounded-lg p-6">
              <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900">
                Quais são os planos para os próximos 12 meses?
                <ChevronDown className="h-5 w-5 text-gray-600 transition group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-gray-700">
                Roadmap 2026-2027: (1) atingir 5 mil clientes ativos; (2) integração nativa com
                CRMs e ERPs populares; (3) versão enterprise com contratos customizados; (4)
                marketplace de agentes especializados por vertical; (5) suite analítica de ROI
                por campanha.
              </p>
            </details>

            <details className="group border border-gray-200 rounded-lg p-6">
              <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900">
                Como a ZappIQ trata LGPD e dados sensíveis?
                <ChevronDown className="h-5 w-5 text-gray-600 transition group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-gray-700">
                100% conformidade com LGPD. Dados de clientes são armazenados em infraestrutura
                brasileira (AWS São Paulo), com criptografia em trânsito e em repouso. Termos de
                processamento de dados explícitos. Dados não são usados para treinar modelos.
                Conformidade auditada anualmente. Certificação ISO 27001 em roadmap Q3 2026.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-6 py-16 sm:px-8 sm:py-24 bg-gray-50">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">Quer saber mais?</h2>
          <p className="mt-4 text-gray-700">
            Conheça a plataforma, leia nosso blog e entenda por que estamos mudando a régua de
            preço em IA conversacional.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/comparativo"
              className="inline-flex justify-center rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 transition"
            >
              Ver comparativo
            </Link>
            <Link
              href="/blog/setup-fee-fraude-intelectual"
              className="inline-flex justify-center rounded-lg bg-white border border-gray-300 px-6 py-3 font-medium text-gray-900 hover:bg-gray-50 transition"
            >
              Ler artigo completo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl text-center text-sm text-gray-600">
          <p>ZappIQ © 2026. Todos os direitos reservados.</p>
        </div>
      </footer>
    </main>
  );
}
