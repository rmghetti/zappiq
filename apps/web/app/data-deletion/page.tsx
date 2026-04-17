import { PublicLayout } from '@/components/landing/PublicLayout';

export const metadata = {
  title: 'Exclusão de Dados | ZappIQ',
  description: 'Solicite a exclusão dos seus dados na plataforma ZappIQ conforme a LGPD.',
};

export default function DataDeletionPage() {
  return (
    <PublicLayout>
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Exclusão de Dados</h1>
          <p className="text-gray-400 mb-6">Conforme Art. 18 da LGPD (Lei nº 13.709/2018)</p>

          <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
            <h2 className="text-2xl font-semibold text-white">Como solicitar a exclusão dos seus dados</h2>
            <p>
              Você tem o direito de solicitar a exclusão dos seus dados pessoais armazenados pela ZappIQ.
              Para exercer esse direito, envie um e-mail para{' '}
              <a href="mailto:dpo@zappiq.com.br" className="text-emerald-400 hover:underline">dpo@zappiq.com.br</a>{' '}
              com o assunto &quot;Solicitação de Exclusão de Dados&quot;.
            </p>

            <h2 className="text-2xl font-semibold text-white">Prazo de atendimento</h2>
            <p>
              Sua solicitação será processada em até 15 dias corridos, conforme previsto na LGPD.
              Clientes do plano Enterprise têm atendimento prioritário em até 48 horas.
            </p>

            <h2 className="text-2xl font-semibold text-white">Dados que serão excluídos</h2>
            <p>
              Ao solicitar a exclusão, removeremos todos os dados pessoais identificáveis,
              incluindo nome, e-mail, telefone, histórico de conversas e metadados associados.
              Dados anonimizados para fins estatísticos poderão ser mantidos conforme Art. 16 da LGPD.
            </p>

            <h2 className="text-2xl font-semibold text-white">Contato do Encarregado (DPO)</h2>
            <p>
              E-mail: <a href="mailto:dpo@zappiq.com.br" className="text-emerald-400 hover:underline">dpo@zappiq.com.br</a>
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
