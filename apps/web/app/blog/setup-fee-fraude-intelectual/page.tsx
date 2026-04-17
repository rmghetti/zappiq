import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Share2 } from 'lucide-react';
import { ArticleJsonLd } from '@/components/seo/ArticleJsonLd';

export const metadata: Metadata = {
  title: 'Por que cobrar setup fee de IA conversacional é fraude intelectual · ZappIQ',
  description:
    'Análise técnica e financeira sobre por que setup fees em IA conversacional não sobrevivem a um exame honesto. Leia o artigo completo de Rodrigo Ghetti, founder da ZappIQ.',
  openGraph: {
    title: 'Por que cobrar setup fee de IA conversacional é fraude intelectual',
    description:
      'Análise técnica e financeira sobre por que setup fees em IA conversacional não sobrevivem a um exame honesto.',
    type: 'article',
    locale: 'pt_BR',
    url: 'https://zappiq.com.br/blog/setup-fee-fraude-intelectual',
    publishedTime: '2026-04-24T00:00:00Z',
    authors: ['Rodrigo Ghetti'],
    images: ['/og-default.png'],
  },
};

const datePublished = '2026-04-24';
const author = 'Rodrigo Ghetti';
const title =
  'Por que cobrar setup fee de IA conversacional é fraude intelectual';
const description =
  'Análise técnica e financeira sobre por que setup fees em IA conversacional não sobrevivem a um exame honesto.';

export default function SetupFeeArticle() {
  const shareUrl = 'https://zappiq.com.br/blog/setup-fee-fraude-intelectual';
  const shareText = encodeURIComponent(title);

  return (
    <article className="min-h-screen bg-white">
      <ArticleJsonLd
        title={title}
        description={description}
        datePublished={datePublished}
        author={author}
        articleUrl={shareUrl}
      />

      {/* Header com voltar */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao blog
          </Link>
        </div>
      </div>

      {/* Artigo */}
      <div className="px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl prose prose-invert max-w-none">
          {/* Metadados do artigo */}
          <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-600 border-b border-gray-200 pb-6">
            <span>24 de abril de 2026</span>
            <span className="h-1 w-1 rounded-full bg-gray-300"></span>
            <span>8 min de leitura</span>
            <span className="h-1 w-1 rounded-full bg-gray-300"></span>
            <span>Rodrigo Ghetti</span>
          </div>

          {/* Título */}
          <h1 className="font-jakarta mb-6 text-4xl font-bold text-gray-900 sm:text-5xl">
            Por que cobrar setup fee de IA conversacional é fraude intelectual
          </h1>

          {/* Subtítulo */}
          <p className="text-xl text-gray-600 mb-8">
            Análise técnica e financeira sobre uma cobrança que não sobrevive a um exame honesto.
          </p>

          {/* Conteúdo principal */}
          <section className="space-y-6 text-gray-700 leading-relaxed">
            <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-10">
              Confissão: eu já paguei um
            </h2>
            <p>
              Em 2024, assinei um contrato com um fornecedor de plataforma de chatbot. Tier
              enterprise. Setup fee de R$ 12 mil, faturado na assinatura do contrato, "para
              treinar a IA com a base de conhecimento da sua empresa".
            </p>
            <p>
              Treze dias depois, recebi acesso ao painel com os PDFs que eu mesmo tinha mandado
              por e-mail já ingestados. Nenhum trabalho visível fora subir arquivo em formulário,
              rodar um script de parsing e clicar em "publicar".
            </p>
            <p>
              Naquele momento, a conta começou a não fechar na minha cabeça. E é dessa conta que
              saiu a ZappIQ.
            </p>

            <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-10">
              O que é setup fee em IA conversacional?
            </h2>
            <p>
              A cobrança aparece em algum canto do contrato com nomes diferentes: "onboarding
              fee", "implementation", "treinamento do modelo", "customização". O range que circula
              no mercado brasileiro em 2026 vai de R$ 3 mil a R$ 15 mil, dependendo do tier e de
              quanto o comprador tem de leverage na negociação.
            </p>
            <p>
              Na prática, o entregável é sempre o mesmo: a IA do fornecedor passa a responder com
              informação da sua empresa. Nada mais exótico do que isso.
            </p>

            <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-10">
              Por que essa cobrança virou padrão
            </h2>
            <p>
              Três razões, em ordem de peso. Primeiro, a dívida de modelo. Antes de LLMs
              comerciais existirem, "treinar um chatbot" exigia montar árvores de intent, escrever
              dezenas de fluxos condicionais, conectar APIs uma a uma e testar caminho por
              caminho. Isso era trabalho humano real, medido em semanas. O setup fee remunerava
              esse trabalho.
            </p>
            <p>
              Segundo, a margem do canal. Muitas plataformas de chatbot no Brasil são vendidas com
              implementação via integrador parceiro. O setup fee é o plat principal do parceiro,
              não da plataforma. Cortar a cobrança significaria quebrar a economia de centenas de
              integradores que dependem dela.
            </p>
            <p>
              Terceiro, a ancoragem comercial. Um ticket mensal de R$ 2 mil parece barato quando o
              comprador acabou de assinar R$ 12 mil de setup. É psicologia de venda básica — a
              cobrança grande legitima a cobrança contínua.
            </p>

            <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-10">
              O que mudou com LLMs e RAG
            </h2>
            <p>
              Em 2023, um documento PDF de 50 páginas passando por embeddings custava alguns
              centavos de dólar em compute, gerava chunks pesquisáveis em um vector store e virava
              contexto injetável em qualquer prompt. Essa operação hoje é o padrão técnico
              conhecido como RAG, Retrieval-Augmented Generation.
            </p>
            <p>
              O custo marginal real de ingestion de uma base de conhecimento em 2026 é próximo de
              zero. A matemática, expondo os números públicos:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                Embedding OpenAI <code className="bg-gray-100 px-2 py-1 rounded">text-embedding-3-small</code>: US$ 0,02 por 1 milhão de tokens. Base de
                conhecimento de uma PME média cabe em menos de 300 mil tokens. Custo unitário:
                menos de US$ 0,01.
              </li>
              <li>
                Storage do vector store (Weaviate, Pinecone, pgvector): US$ 0,04 a US$ 0,10 por 1
                milhão de vetores armazenados por mês. Uma PME inteira custa centavos.
              </li>
              <li>
                Compute de inferência: já é pago na mensalidade via consumo de tokens de LLM.
              </li>
            </ul>
            <p>
              A parte humana que restou é revisão de qualidade e ajuste de tom. Trinta minutos de
              trabalho quando a base é limpa. Duas horas no pior caso.
            </p>

            <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-10">
              A matemática exposta
            </h2>
            <p>
              Cliente paga R$ 8 mil em setup fee. Custo variável real na infraestrutura do
              fornecedor: menos de US$ 2. Trabalho humano residual: 30 minutos a 2 horas de
              revisão.
            </p>
            <p>
              Mesmo assumindo que o fornecedor queira margem bruta saudável na revisão — R$ 500
              por hora de um especialista sênior, duas horas de trabalho — o custo direto não passa
              de R$ 1 mil.
            </p>
            <p>
              Os R$ 7 mil restantes são lucro, canal ou ambos. Isso não é crime. Não é fraude
              jurídica. Mas é fraude intelectual: uma cobrança que se sustenta apenas enquanto o
              comprador não souber que a operação custa US$ 2.
            </p>

            <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-10">
              A objeção do consultor
            </h2>
            <p>
              A primeira defesa quando esse argumento é colocado em reunião é: "mas o consultor
              customiza a IA, adapta o tom, afina os fluxos".
            </p>
            <p>
              O problema é que o próprio cliente é quem conhece sua operação, seu tom, seus
              fluxos. Consultor externo faz a primeira versão pior do que o cliente faria em
              metade do tempo, e depois precisa de ciclos de ajuste onde o cliente corrige o
              consultor.
            </p>
            <p>
              Quando a plataforma expõe corretamente as ferramentas — upload de documentos,
              cadastro de pares de pergunta e resposta, configuração de identidade do agente,
              score de prontidão em tempo real — o cliente chega a um nível de treinamento
              equivalente em 30 a 90 minutos sozinho.
            </p>
            <p>
              No beta da ZappIQ, a média de tempo para atingir AI Readiness Score de 60 (threshold
              de "pronta para atender") foi de 47 minutos no primeiro acesso. Sem consultor, sem
              ligação de suporte, sem call de implementação.
            </p>

            <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-10">
              O que a ZappIQ faz diferente
            </h2>
            <p>Cinco decisões de produto deliberadas.</p>
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>
                <strong>Zero setup fee</strong>, escrito em contrato, sem asterisco. O cliente
                assina e já está treinando.
              </li>
              <li>
                <strong>Readiness Score visível</strong>, de 0 a 100, em tempo real. O cliente vê
                exatamente o que falta e quanto cada ação pesa no score. Decisão de onde investir
                tempo deixa de ser opaca.
              </li>
              <li>
                <strong>Upload de documentos</strong> com ingestion em segundos. PDF, DOCX, TXT,
                MD, URL. Sem planilha de intents, sem árvore de fluxo para modelar.
              </li>
              <li>
                <strong>Identidade do agente configurável</strong> em um formulário de três campos.
                Nome, tom, horário. Três minutos.
              </li>
              <li>
                <strong>Vinte e um dias de trial</strong> com cap de US$ 15 em custo de LLM. Se o
                cliente abusar, a plataforma protege a margem sem parar o trial — o fundador absorve
                a diferença nos primeiros 30 dias, porque o trial gratuito sem dor na margem é a
                prova de que o modelo funciona.
              </li>
            </ol>
            <p>
              O tier inicial é R$ 247 por mês. O que o cliente paga para ter a IA rodando é vinte
              vezes menor que o setup fee do fornecedor incumbente médio.
            </p>

            <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-10">
              Conclusão: a pergunta que derruba qualquer cotação
            </h2>
            <p>
              Se você está avaliando um fornecedor que cobra setup fee em 2026, faça exatamente
              esta pergunta na próxima reunião:
            </p>
            <blockquote className="border-l-4 border-indigo-600 pl-6 italic my-6">
              "O que esse setup fee está pagando que eu não consigo fazer em trinta minutos subindo
              meus próprios arquivos em um painel?"
            </blockquote>
            <p>
              Se a resposta vier com palavras como "expertise", "customização profunda",
              "integração com sua operação" sem um entregável concreto e mensurável, você está
              olhando para uma cobrança que não sobrevive a uma auditoria honesta.
            </p>
            <p>
              A ZappIQ nasceu para ser a resposta concreta dessa pergunta. Zero setup. Self-service
              completo. Vinte e um dias grátis para provar que funciona.
            </p>
            <p className="text-lg font-semibold text-gray-900">A régua mudou.</p>
          </section>

          {/* CTA */}
          <div className="mt-12 border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-600 mb-4">
              Pronto para testar ZappIQ sem setup fee?
            </p>
            <Link
              href="/"
              className="inline-flex rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 transition"
            >
              Começar 14 dias grátis →
            </Link>
          </div>

          {/* Compartilhar */}
          <div className="mt-12 border-t border-gray-200 pt-8">
            <p className="text-sm font-semibold text-gray-900 mb-4">Compartilhe este artigo:</p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition"
              >
                <Share2 className="h-4 w-4" />
                LinkedIn
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition"
              >
                <Share2 className="h-4 w-4" />
                Twitter
              </a>
              <a
                href={`https://api.whatsapp.com/send?text=${shareText}%20${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition"
              >
                <Share2 className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </div>

          {/* Autor */}
          <div className="mt-12 border-t border-gray-200 pt-8 bg-gray-50 -mx-6 sm:-mx-8 px-6 sm:px-8 py-8">
            <div className="max-w-3xl">
              <p className="text-sm text-gray-600 mb-2">Sobre o autor</p>
              <p className="text-base text-gray-900">
                <strong>Rodrigo Ghetti</strong> é founder da ZappIQ, plataforma brasileira de IA
                conversacional para WhatsApp. Antes da ZappIQ, liderou estruturas de vendas e
                pré-vendas em soluções de Digital Communications.
              </p>
            </div>
          </div>

          {/* Link de volta */}
          <div className="mt-12">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao blog
            </Link>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <section className="border-t border-gray-200 bg-gray-50 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-jakarta text-2xl font-bold text-gray-900">
            Pronto para mudar a régua?
          </h2>
          <p className="mt-4 text-gray-700">
            ZappIQ oferece IA conversacional para WhatsApp sem setup fee, sem consultor, sem
            dor de cabeça. 14 dias grátis.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 transition"
          >
            Começar agora
          </Link>
        </div>
      </section>
    </article>
  );
}
