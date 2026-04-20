export const metadata = {
  title: 'Data Processing Agreement — ZappIQ',
  description: 'Data Processing Agreement (DPA) entre Cliente e ZappIQ.',
};

export default function DPAPage() {
  const lastUpdate = '15 de abril de 2026';

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-sm sm:prose">
        <div className="mb-8">
          <a href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Voltar ao início
          </a>
        </div>

        <h1>Data Processing Agreement (DPA)</h1>
        <p className="text-gray-600 text-sm">Atualizado em {lastUpdate}</p>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 my-6">
          <p className="text-sm">
            Este documento descreve a forma pela qual ZappIQ Brasil Sistemas de IA LTDA processa dados pessoais em nome de seus clientes, conforme Lei Geral de Proteção de Dados Pessoais (LGPD) e GDPR, quando aplicável.
          </p>
        </div>

        <h2>1. Definições</h2>
        <ul>
          <li><strong>Controlador:</strong> O Cliente, entidade responsável pelas decisões sobre tratamento de dados.</li>
          <li><strong>Operador:</strong> ZappIQ Brasil Sistemas de IA LTDA, responsável pelo processamento sob instruções do Controlador.</li>
          <li><strong>Dados Pessoais:</strong> Qualquer informação que identifica ou possa identificar pessoa física.</li>
          <li><strong>Processamento:</strong> Coleta, armazenagem, uso, análise, transferência ou exclusão de dados.</li>
        </ul>

        <h2>2. Objeto e Escopo</h2>
        <p>
          O Operador processa dados pessoais conforme instruções do Controlador, especificamente:
        </p>
        <ul>
          <li>Fornecimento e operação da plataforma ZappIQ.</li>
          <li>Processamento de conversas, mensagens e contexto de usuários finais (end-users) via WhatsApp Business API.</li>
          <li>Armazenamento seguro de dados de cadastro, configurações e histórico.</li>
          <li>Análise de uso e logs para segurança e conformidade.</li>
        </ul>

        <h2>3. Natureza e Categorias de Dados</h2>
        <ul>
          <li>Dados de identificação (nome, email, telefone).</li>
          <li>Dados de contato de end-users (números WhatsApp, nomes).</li>
          <li>Conteúdo de conversas e mensagens processadas via IA.</li>
          <li>Dados de comportamento e uso da plataforma.</li>
          <li>Dados de pagamento (tokenizados via Stripe).</li>
        </ul>

        <h2>4. Categorias de Titulares de Dados</h2>
        <ul>
          <li>Usuários finais do Cliente (clientes do Cliente que interagem via WhatsApp).</li>
          <li>Colaboradores do Cliente com acesso à plataforma.</li>
          <li>Contatos e leads gerenciados via CRM integrado.</li>
        </ul>

        <h2>5. Duração do Processamento</h2>
        <p>
          O Operador processará dados enquanto o Controlador mantiver assinatura ativa. Após rescisão, dados serão deletados conforme cronograma acordado (padrão: 30 dias úteis).
        </p>

        <h2>6. Medidas de Segurança Técnicas</h2>
        <ul>
          <li><strong>Criptografia em trânsito:</strong> TLS 1.3, HTTPS obrigatório.</li>
          <li><strong>Criptografia em repouso:</strong> AES-256 para dados sensíveis em PostgreSQL (Supabase).</li>
          <li><strong>Isolamento de dados:</strong> Separação de dados por organizationId em arquitetura multi-tenant.</li>
          <li><strong>Controle de acesso:</strong> Autenticação JWT + RBAC (Role-Based Access Control).</li>
          <li><strong>Logs de auditoria:</strong> Registro de todas as ações administrativas com timestamps.</li>
          <li><strong>Firewalls e WAF:</strong> Proteção contra acessos não autorizados.</li>
          <li><strong>Penetration testing:</strong> Testes de segurança trimestrais.</li>
        </ul>

        <h2>7. Medidas de Segurança Administrativas</h2>
        <ul>
          <li>Políticas de acesso restritivo (least privilege).</li>
          <li>Treinamento de segurança para funcionários.</li>
          <li>Acordo de confidencialidade obrigatório para staff.</li>
          <li>Processo de aprovação para acesso a dados de Clientes.</li>
          <li>Verificação de antecedentes para pessoal com acesso sensível.</li>
        </ul>

        <h2>8. Subprocessadores</h2>
        <p>
          O Operador utiliza os seguintes subprocessadores (processadores de dados):
        </p>
        <ul>
          <li><strong>Supabase:</strong> Banco de dados PostgreSQL hospedado em AWS us-east-1.</li>
          <li><strong>Upstash:</strong> Redis gerenciado para cache e filas.</li>
          <li><strong>Anthropic:</strong> Processamento de requisições Claude API (dados anônimos de contexto).</li>
          <li><strong>Stripe:</strong> Processamento e armazenamento tokenizado de pagamentos.</li>
          <li><strong>Resend:</strong> Envio de emails transacionais.</li>
          <li><strong>Meta/WhatsApp:</strong> Integração WhatsApp Business API para processamento de mensagens.</li>
        </ul>

        <p>
          O Controlador pode requerer lista atualizada de subprocessadores em qualquer momento. Notificação de mudanças será realizada com 30 dias de antecedência, com direito de oposição.
        </p>

        <h2>9. Direitos dos Titulares de Dados</h2>
        <p>
          O Operador, por solicitação do Controlador, facilitará o exercício de direitos dos titulares:
        </p>
        <ul>
          <li>Acesso e portabilidade de dados.</li>
          <li>Correção ou atualização.</li>
          <li>Exclusão (direito ao esquecimento).</li>
          <li>Limitação de processamento.</li>
          <li>Oposição ao processamento.</li>
        </ul>

        <p>
          O Controlador é responsável por fornecer mecanismos aos seus titulares para exercer estes direitos. O Operador responderá requisições do Controlador em até 10 dias úteis.
        </p>

        <h2>10. Transferência Internacional de Dados</h2>
        <p>
          Dados são armazenados em AWS us-east-1 (EUA) e processados por Anthropic (potencialmente em jurisdições distintas). Aplicam-se Cláusulas Contratuais Padrão (Standard Contractual Clauses — SCCs) aprovadas pela Comissão Europeia como mecanismo de adequação.
        </p>

        <h2>11. Notificação de Violação de Dados</h2>
        <p>
          O Operador notificará o Controlador de qualquer violação de segurança, vazamento ou acesso não autorizado em até 24 horas (ou 48 horas em caso de fim de semana/feriado). A notificação incluirá:
        </p>
        <ul>
          <li>Descrição da violação e dados afetados.</li>
          <li>Possível impacto para titulares.</li>
          <li>Medidas remediativas já implementadas.</li>
          <li>Contato para esclarecimentos.</li>
        </ul>

        <h2>12. Auditorias e Inspeções</h2>
        <p>
          O Controlador ou auditor independente pode solicitar auditoria anual de conformidade com este DPA. O Operador fornecerá documentação de medidas de segurança, logs de acesso, e relatório de conformidade no prazo de 30 dias.
        </p>

        <h2>13. Retenção e Deleção</h2>
        <p>
          Dados são retidos conforme necessário para fornecer o Serviço. Após rescisão do contrato:
        </p>
        <ul>
          <li>Período de 30 dias para exportação de dados pelo Controlador.</li>
          <li>Deleção segura após 30 dias (hard delete com certificação).</li>
          <li>Exceção: Dados necessários para conformidade legal retidos por 5 anos.</li>
        </ul>

        <h2>14. Conformidade com Regulamentações</h2>
        <p>
          Este DPA opera em conformidade com:
        </p>
        <ul>
          <li>Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018).</li>
          <li>Regulamento Geral sobre a Proteção de Dados — GDPR (UE 2016/679).</li>
          <li>Legislação de privacidade aplicável em outras jurisdições relevantes.</li>
        </ul>

        <h2>15. Responsabilidade e Indenização</h2>
        <p>
          O Operador é responsável por danos causados pelo não-cumprimento deste DPA. Responsabilidade se limita a valores compatíveis com Termos de Uso. O Controlador é responsável pela legalidade das instruções e conformidade com direitos de titulares.
        </p>

        <h2>16. Rescisão e Vigência</h2>
        <p>
          Este DPA vigora enquanto houver contrato de Serviço ativo. Rescisão do contrato principal resulta em fim do processamento conforme seção 13.
        </p>

        <h2>17. Emendas e Modificações</h2>
        <p>
          Alterações ao DPA que reduzem proteções requerem consentimento prévio do Controlador. Alterações por exigência legal podem ser aplicadas com notificação de 30 dias.
        </p>

        <h2>18. Contato — Data Protection Officer (Encarregado)</h2>
        {/* V2-025: DPO externo independente (LGPD Art. 41). Nome do encarregado
            será publicado após homologação do contrato (BLOCKER B-03). */}
        <ul>
          <li><strong>Encarregado:</strong> DPO externo em homologação — nome será publicado após assinatura do contrato de prestação de serviço de encarregado (compliance LGPD Art. 41 — independência em relação à área operacional)</li>
          <li><strong>Email:</strong> dpo@zappiq.com.br</li>
          <li><strong>Endereço postal:</strong> Av. das Nações Unidas, 12901 — CENU Torre Norte, 25° andar — São Paulo/SP — CEP 04578-910</li>
          <li><strong>Prazo de resposta (ANPD art. 19):</strong> até 15 dias corridos</li>
        </ul>

        <hr className="my-8" />
        <p className="text-xs text-gray-500">
          Este Data Processing Agreement é parte integral dos Termos de Uso de ZappIQ. Para cópias assinadas ou esclarecimentos legais, contate dpa@zappiq.com.br.
        </p>
      </div>
    </div>
  );
}
