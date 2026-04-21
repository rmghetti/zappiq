export const metadata = {
  title: 'Termos de Uso — ZappIQ',
  description: 'Termos de Uso da plataforma ZappIQ. Leia os termos e condições.',
};

export default function TermosPage() {
  const lastUpdate = '15 de abril de 2026';

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-sm sm:prose">
        <div className="mb-8">
          <a href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Voltar ao início
          </a>
        </div>

        <h1>Termos de Uso</h1>
        <p className="text-gray-600 text-sm">Atualizado em {lastUpdate}</p>

        <h2>1. Objeto do Contrato</h2>
        <p>
          A ZappIQ Brasil Sistemas de IA LTDA ("Empresa") oferece uma plataforma SaaS de inteligência artificial conversacional para automação de atendimento, vendas e campanhas no WhatsApp Business ("Serviço"). Estes Termos regem o uso do Serviço por usuários e organizações ("Cliente" ou "você").
        </p>

        <h2>2. Cadastro e Conta</h2>
        <p>
          Para acessar o Serviço, você deve criar uma conta com informações precisas, completas e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais e pela segurança de sua conta. Você concorda em notificar-nos imediatamente de qualquer acesso não autorizado. A Empresa pode suspender ou encerrar contas que violem estes Termos.
        </p>

        <h2>3. Obrigações da Empresa</h2>
        <ul>
          <li>Disponibilizar o Serviço conforme descrito na documentação fornecida.</li>
          <li>Manter a confidencialidade de dados do Cliente (conforme Política de Privacidade).</li>
          <li>Fornecer suporte técnico através de canais documentados.</li>
          <li>Garantir disponibilidade de 99,5% (SLA), excluindo manutenção programada e falhas de terceiros.</li>
        </ul>

        <h2>4. Obrigações do Cliente</h2>
        <ul>
          <li>Usar o Serviço em conformidade com leis aplicáveis e políticas documentadas.</li>
          <li>Não enviar spam, conteúdo ilícito, malware ou realizar ataques cibernéticos.</li>
          <li>Manter a confidencialidade de chaves de API e credenciais de integração.</li>
          <li>Ser responsável por todas as ações realizadas em sua conta.</li>
          <li>Não contornar ou violar mecanismos de segurança do Serviço.</li>
        </ul>

        <h2>5. Propriedade Intelectual</h2>
        <p>
          Você retém a propriedade de todos os dados, conteúdo e materiais fornecidos ao Serviço ("Seus Dados"). A Empresa é detentora de todos os direitos sobre a plataforma, código, algoritmos e conteúdo gerado pelo sistema. Você concede à Empresa licença limitada e necessária para processar Seus Dados para fornecer o Serviço, incluindo uso de agregados anônimos para melhorias contínuas do Serviço.
        </p>

        <h2>6. Disponibilidade e SLA</h2>
        <p>
          A Empresa se compromete em manter o Serviço disponível por no mínimo 99,5% do tempo em período mensal. Manutenção programada será comunicada com antecedência de 48 horas. Falhas causadas por terceiros (provedores de internet, Meta/WhatsApp), ataques DDoS, ou força maior não contam para cálculo de SLA.
        </p>

        <h2>7. Limitação de Responsabilidade</h2>
        <p>
          A Empresa não será responsável por: (i) danos indiretos, incidentais, consequentes ou punitivos; (ii) perda de dados, lucros cessos ou receita; (iii) interrupções causadas por terceiros ou força maior. A responsabilidade total da Empresa não ultrapassará o valor pago pelo Cliente nos últimos 12 meses. Algumas jurisdições não permitem limitação de responsabilidade; neste caso, aplica-se a máxima permitida por lei.
        </p>

        <h2>8. Interrupção e Suspensão</h2>
        <p>
          A Empresa pode suspender ou encerrar contas que violem estes Termos, sem aviso prévio se necessário para proteger a plataforma ou terceiros. Contas ativas podem ser pausadas por não-pagamento. Você será notificado sobre suspensões não imediatas com antecedência de 5 dias úteis.
        </p>

        <h2>9. Vigência e Rescisão</h2>
        <p>
          Este contrato vigora a partir da data de aceitação até rescisão por qualquer parte. Você pode cancelar sua conta a qualquer momento, sem multa ou penalidade. A Empresa pode rescindir por violação destes Termos com aviso de 30 dias, ou imediatamente se a violação for grave. Dados serão deletados conforme Política de Privacidade após encerramento.
        </p>

        <h2>10. Modificações dos Termos</h2>
        <p>
          A Empresa pode modificar estes Termos a qualquer momento. Alterações material serão comunicadas por email com 30 dias de antecedência. Continuação do uso significa aceitação das alterações. Você pode rescindir a conta se discordar de mudanças material.
        </p>

        <h2>11. Foro Competente</h2>
        <p>
          Estes Termos são regidos pela legislação da República Federativa do Brasil. Qualquer litígio será processado perante os Juizados Especiais Cíveis ou Tribunal competente da comarca de São Paulo, Estado de São Paulo.
        </p>

        <h2>12. Cancelamento sem Multa</h2>
        <p>
          Você pode cancelar sua assinatura a qualquer momento, sem necessidade de justificativa ou multa. O cancelamento não gera reembolso de períodos já pagos. Sua conta será encerrada ao final do ciclo de cobrança.
        </p>

        <h2>13. Contato</h2>
        <p>
          Para dúvidas ou reclamações, contate: <strong>legal@zappiq.com.br</strong>
        </p>

        <hr className="my-8" />
        <p className="text-xs text-gray-500">
          Ao usar a plataforma ZappIQ, você concorda com os Termos de Uso e Política de Privacidade. Se não concordar, favor descontinuar o uso do Serviço.
        </p>
      </div>
    </div>
  );
}
