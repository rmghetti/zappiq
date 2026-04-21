export const metadata = {
  title: 'Política de Privacidade — ZappIQ',
  description: 'Política de Privacidade e LGPD da plataforma ZappIQ.',
};

export default function PrivacidadePage() {
  const lastUpdate = '15 de abril de 2026';

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-sm sm:prose">
        <div className="mb-8">
          <a href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Voltar ao início
          </a>
        </div>

        <h1>Política de Privacidade</h1>
        <p className="text-gray-600 text-sm">Atualizado em {lastUpdate}</p>

        <h2>1. Dados Coletados</h2>
        <p>
          Coletamos dados pessoais em diferentes contextos:
        </p>
        <ul>
          <li><strong>Cadastro:</strong> Nome completo, email, telefone, empresa, cargo.</li>
          <li><strong>Uso da plataforma:</strong> Logs de acesso, interações, configurações, histórico de ações.</li>
          <li><strong>Conversas no WhatsApp:</strong> Mensagens de clientes finais (end-users) processadas via integração WhatsApp Business API, armazenadas temporariamente para contexto de IA.</li>
          <li><strong>Pagamento:</strong> Últimos dígitos de cartão, data de expiração (tokens seguros do Stripe).</li>
          <li><strong>Suporte:</strong> Tickets, emails, logs de conversa técnica.</li>
        </ul>

        <h2>2. Finalidades de Tratamento</h2>
        <p>
          Seus dados são utilizados para:
        </p>
        <ul>
          <li>Provision de acesso à plataforma e autenticação.</li>
          <li>Processamento de requisições de IA e treinamento de modelos personalizados.</li>
          <li>Cobrança e gestão de assinaturas.</li>
          <li>Comunicação de suporte, notificações de serviço e atualizações de segurança.</li>
          <li>Análise de uso para melhorias contínuas e desenvolvimento de recursos.</li>
          <li>Conformidade legal, auditoria e investigação de fraudes.</li>
        </ul>

        <h2>3. Base Legal</h2>
        <p>
          O tratamento de dados é realizado com base em:
        </p>
        <ul>
          <li><strong>Execução de contrato:</strong> Fornecimento do Serviço (LGPD art. 7º, inciso II).</li>
          <li><strong>Legítimo interesse:</strong> Melhoria de segurança, análise de comportamento, prevenção de fraudes (LGPD art. 7º, inciso IX).</li>
          <li><strong>Consentimento:</strong> Marketing e campanhas opcionais (LGPD art. 7º, inciso I).</li>
          <li><strong>Obrigação legal:</strong> Legislação fiscal e regulatória aplicável.</li>
        </ul>

        <h2>4. Compartilhamento com Terceiros</h2>
        <p>
          Seus dados podem ser compartilhados com os seguintes processadores de dados:
        </p>
        <ul>
          <li><strong>Supabase:</strong> Armazenamento de banco de dados em PostgreSQL (AWS us-east).</li>
          <li><strong>Upstash:</strong> Cache Redis e fila de mensagens.</li>
          <li><strong>Anthropic:</strong> Processamento de requisições Claude via API (mensagens de contexto anônimos).</li>
          <li><strong>Stripe:</strong> Processamento de pagamentos e faturamento.</li>
          <li><strong>Resend:</strong> Envio de emails transacionais e notificações.</li>
          <li><strong>Meta (WhatsApp):</strong> Conversas processadas via WhatsApp Business API.</li>
          <li><strong>Autoridades públicas:</strong> Quando exigido por lei ou ordem judicial.</li>
        </ul>

        <h2>5. Retenção de Dados</h2>
        <p>
          Dados são armazenados conforme necessário:
        </p>
        <ul>
          <li><strong>Conversas do WhatsApp:</strong> 90 dias (configurável via settings da organização).</li>
          <li><strong>Cadastro e acesso:</strong> Mantido durante a vigência da conta + 12 meses após rescisão.</li>
          <li><strong>Logs de auditoria:</strong> 24 meses.</li>
          <li><strong>Dados de pagamento:</strong> Conforme legislação fiscal (5 anos).</li>
        </ul>

        <h2>6. Direitos do Titular</h2>
        <p>
          Conforme LGPD, você possui os seguintes direitos:
        </p>
        <ul>
          <li><strong>Acesso:</strong> Solicitar cópia de seus dados pessoais.</li>
          <li><strong>Correção:</strong> Atualizar informações imprecisas ou incompletas.</li>
          <li><strong>Exclusão:</strong> Solicitar apagamento de dados (direito ao esquecimento).</li>
          <li><strong>Portabilidade:</strong> Transferência de dados em formato estruturado.</li>
          <li><strong>Revogação de consentimento:</strong> Retirar consentimento para marketing e campanhas.</li>
          <li><strong>Oposição:</strong> Opor-se ao tratamento em legítimo interesse.</li>
        </ul>

        <p>
          Para exercer seus direitos, contate: <strong>privacy@zappiq.com.br</strong>. Responderemos em até 15 dias úteis.
        </p>

        <h2>7. Segurança de Dados</h2>
        <p>
          Implementamos medidas técnicas e administrativas:
        </p>
        <ul>
          <li>Criptografia TLS 1.3 em trânsito (HTTPS).</li>
          <li>Criptografia AES-256 em repouso para dados sensíveis.</li>
          <li>Isolamento de dados por organização (organizationId) em banco multi-tenant.</li>
          <li>Controle de acesso baseado em papéis (RBAC).</li>
          <li>Logs de auditoria de todas as ações administrativas.</li>
          <li>Testes de segurança e penetration testing regular.</li>
        </ul>

        <h2>8. Transferência Internacional</h2>
        <p>
          Dados são armazenados em servidores AWS na região us-east-1 (EUA). Processadores como Anthropic podem residir em jurisdições diferentes. Aplicam-se Cláusulas Contratuais Padrão aprovadas pela Comissão Europeia (SCC).
        </p>

        <h2>9. Notificação de Incidente</h2>
        <p>
          Em caso de violação de segurança ou vazamento de dados pessoais, notificaremos os titulares e autoridades competentes em até 48 horas úteis, conforme LGPD art. 34.
        </p>

        <h2>10. Autoridade de Proteção de Dados</h2>
        <p>
          <strong>Encarregado de Proteção de Dados (DPO):</strong> rodrigo.ghetti@zappiq.com.br
        </p>
        <p>
          <strong>Autoridade Supervisora:</strong> Autoridade Nacional de Proteção de Dados (ANPD) — www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd
        </p>

        <h2>11. Cookies e Rastreamento</h2>
        <p>
          Usamos cookies técnicos (sessão, autenticação) e cookies analíticos (Google Analytics). Cookies de marketing são opcionais e exigem consentimento prévio. Você pode desabilitar cookies nas configurações do navegador.
        </p>

        <h2>12. Alterações na Política</h2>
        <p>
          Mudanças material na política serão comunicadas por email com 30 dias de antecedência. Continuação do uso significa aceitação.
        </p>

        <h2>13. Contato</h2>
        <p>
          Para dúvidas ou exercer direitos, contate:
        </p>
        <ul>
          <li><strong>Email:</strong> privacy@zappiq.com.br</li>
          <li><strong>DPO:</strong> rodrigo.ghetti@zappiq.com.br</li>
          <li><strong>Endereço:</strong> São Paulo, SP, Brasil</li>
        </ul>

        <hr className="my-8" />
        <p className="text-xs text-gray-500">
          Política de Privacidade em conformidade com Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018) e GDPR onde aplicável.
        </p>
      </div>
    </div>
  );
}
