import { PublicLayout } from '@/components/landing/PublicLayout';

export const metadata = {
  title: 'Termos de Serviço | ZappIQ',
  description: 'Termos de Serviço da plataforma ZappIQ.',
};

export default function TermsPage() {
  return (
    <PublicLayout>
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Termos de Serviço</h1>
          <p className="text-gray-400 mb-6">Última atualização: 16 de abril de 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
            <h2 className="text-2xl font-semibold text-white">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma ZappIQ, você concorda em cumprir estes Termos de Serviço.
              Se você não concorda com algum dos termos, não utilize nossos serviços.
            </p>

            <h2 className="text-2xl font-semibold text-white">2. Descrição do Serviço</h2>
            <p>
              A ZappIQ é uma plataforma de atendimento inteligente via WhatsApp Business API que combina
              automação com inteligência artificial para empresas. Oferecemos funcionalidades de chatbot,
              atendimento humano, CRM conversacional e análise de dados.
            </p>

            <h2 className="text-2xl font-semibold text-white">3. Uso Aceitável</h2>
            <p>
              Você concorda em utilizar a plataforma apenas para fins legítimos e de acordo com as
              políticas do WhatsApp Business, as leis brasileiras aplicáveis e a LGPD (Lei nº 13.709/2018).
              É proibido o envio de spam, conteúdo ilegal ou mensagens não solicitadas.
            </p>

            <h2 className="text-2xl font-semibold text-white">4. Privacidade e Proteção de Dados</h2>
            <p>
              Tratamos seus dados conforme nossa Política de Privacidade e em conformidade com a LGPD.
              Para mais detalhes, consulte nossa <a href="/lgpd" className="text-emerald-400 hover:underline">página de conformidade LGPD</a>.
            </p>

            <h2 className="text-2xl font-semibold text-white">5. Disponibilidade e SLA</h2>
            <p>
              Nos esforçamos para manter a plataforma disponível 99,9% do tempo.
              Detalhes sobre nossos compromissos de nível de serviço estão disponíveis na <a href="/sla" className="text-emerald-400 hover:underline">página de SLA</a>.
            </p>

            <h2 className="text-2xl font-semibold text-white">6. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo, marca, código e tecnologia da ZappIQ são de propriedade exclusiva
              da ZappIQ. O uso da plataforma não confere a você qualquer direito de propriedade intelectual.
            </p>

            <h2 className="text-2xl font-semibold text-white">7. Limitação de Responsabilidade</h2>
            <p>
              A ZappIQ não se responsabiliza por danos indiretos, incidentais ou consequenciais
              decorrentes do uso da plataforma, exceto nos limites previstos pela legislação brasileira.
            </p>

            <h2 className="text-2xl font-semibold text-white">8. Contato</h2>
            <p>
              Para dúvidas sobre estes termos, entre em contato pelo e-mail{' '}
              <a href="mailto:legal@zappiq.com.br" className="text-emerald-400 hover:underline">legal@zappiq.com.br</a>.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
