/**
 * Política de Privacidade — ZappIQ V3.2
 *
 * Aprovada pelo jurídico em 21/04/2026 (texto exato da minuta V3.2).
 * Vigência: 14/05/2026 (Onda 1).
 * Evidência: ZappIQ_V32_Actions/sprint_1_pricing_garantia_cloud_api/PRIVACY_V32_APROVADA_JURIDICO.md
 *
 * HOLD-FOR-RELEASE: este arquivo pode ser commitado, mas o merge pra main
 * SÓ deve acontecer no D-Day Onda 1 (14/05/2026) junto com o pricing V3.2.
 */

export const metadata = {
  title: 'Política de Privacidade — ZappIQ',
  description:
    'Política de Privacidade da ZappIQ (LGPD Art. 5º e Art. 7º): controladoria, operadoria, sub-processadores, retenção, direitos do titular e contato com o DPO.',
  alternates: {
    canonical: 'https://zappiq.com.br/legal/privacidade',
  },
};

export default function PrivacidadePage() {
  const lastUpdate = '14 de maio de 2026';

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

        <p>
          A ZappIQ Brasil Sistemas de IA LTDA (&ldquo;ZappIQ&rdquo; ou &ldquo;Empresa&rdquo;) valoriza a privacidade
          dos dados pessoais que trata. Esta Política descreve como coletamos, armazenamos, usamos,
          compartilhamos e protegemos dados pessoais dos nossos clientes (controladores dos dados dos
          seus end-users) e dos end-users que interagem com agentes de IA hospedados na plataforma
          ZappIQ.
        </p>

        <h2>1. Controladoria e Operadoria (LGPD Art. 5º)</h2>
        <p>A ZappIQ atua em duas figuras distintas conforme a natureza do dado:</p>
        <ul>
          <li>
            <strong>Controladora</strong> dos dados de cadastro e faturamento dos clientes
            contratantes (nome, CNPJ, e-mail, telefone, dados de pagamento via Stripe).
          </li>
          <li>
            <strong>Operadora</strong> dos dados dos end-users de nossos clientes (mensagens WhatsApp
            trocadas entre o cliente e seus contatos), agindo conforme instruções documentadas dos
            clientes como controladores.
          </li>
        </ul>
        <p>
          Distinção importante: a ZappIQ não é controladora dos dados dos end-users (pessoas que
          conversam com os agentes de IA dos nossos clientes). Essa responsabilidade primária cabe ao
          Cliente ZappIQ, titular da conta WhatsApp Business.
        </p>

        <h2>2. Processamento com modelos de IA</h2>
        <p>
          A ZappIQ processa prompts e gera respostas através de APIs de provedores de inteligência
          artificial (Anthropic Claude e, quando aplicável, OpenAI).{' '}
          <strong>
            A ZappIQ não treina modelos de inteligência artificial com dados de clientes ou
            end-users.
          </strong>{' '}
          Interações históricas são usadas exclusivamente pela lógica do agente do cliente em tempo
          de execução (retrieval-augmented generation sobre a base de conhecimento do próprio
          cliente), sem contribuir para treinamento de modelos fundacionais nem para personalização
          de modelos fora do tenant isolado daquele cliente. Os provedores de IA contratados operam
          sob Data Processing Agreements com cláusulas específicas que proíbem uso dos inputs e
          outputs para treinamento.
        </p>

        <h2>3. Dados coletados e finalidade</h2>
        <p>
          <strong>Dados do Cliente (contratante):</strong> nome completo, razão social, CNPJ,
          e-mail, telefone, endereço de cobrança, dados de cartão tokenizados (Stripe), histórico
          de assinaturas. Finalidade: execução de contrato (LGPD Art. 7º, V), comunicação
          operacional, cobrança, cumprimento de obrigação legal/regulatória.
        </p>
        <p>
          <strong>Dados de end-users (mensagens WhatsApp):</strong> texto, áudio, imagem,
          localização e metadados das conversas entre o Cliente e seus contatos via WhatsApp
          Business. Finalidade: operação do serviço de automação conforme instruções do Cliente
          controlador (LGPD Art. 7º, V — execução de contrato com o Cliente).
        </p>
        <p>
          <strong>Dados de uso e telemetria:</strong> IP, user-agent, identificadores de sessão,
          métricas de performance, logs de erro. Finalidade: operação, segurança e melhoria do
          serviço (LGPD Art. 7º, IX — interesse legítimo documentado).
        </p>

        <h2>4. Sub-processadores</h2>
        <p>
          A ZappIQ compartilha dados com os seguintes operadores para prestação do serviço, todos
          sob Data Processing Agreements que espelham ou superam as obrigações desta Política:
        </p>
        <ul>
          <li>
            <strong>Supabase, Inc.</strong> (banco de dados PostgreSQL e autenticação). Dados
            armazenados em região São Paulo, Brasil, com replicação controlada. SOC 2 Type II,
            HIPAA-ready.
          </li>
          <li>
            <strong>Upstash, Inc.</strong> (cache Redis e filas QStash). Dados efêmeros, sem
            persistência longa. Certificação SOC 2.
          </li>
          <li>
            <strong>Anthropic PBC</strong> (processamento de prompts via API Claude, modelo
            claude-sonnet-4-6). Operado sob contrato Enterprise com cláusulas contratuais
            específicas: zero treinamento em inputs/outputs, retenção efêmera (não persistência
            pós-inferência), isolamento por tenant. Transferência internacional legitimada por
            cláusulas contratuais padrão (ANPD/LGPD Art. 33, IV).
          </li>
          <li>
            <strong>OpenAI, LLC</strong> (processamento de áudio via APIs Whisper, para
            transcrição, e TTS, para síntese de voz, quando o Cliente ativa os add-ons de voz). Sob
            contrato Enterprise com mesma garantia de não-treinamento. Áudios são descartados em
            até 30 dias pelo OpenAI, conforme os termos de processamento de dados da API.
          </li>
          <li>
            <strong>Cloudflare, Inc.</strong> (CDN, proteção DDoS e Workers em edge para
            recebimento de webhooks Meta). Sem acesso ao conteúdo das conversas — apenas metadados
            de roteamento. Sob contrato DPA 2024 com certificação SOC 2 Type II.
          </li>
          <li>
            <strong>Stripe, Inc.</strong> (processamento de pagamentos). Dados de cartão nunca
            passam pelos servidores ZappIQ — são tokenizados direto no browser e enviados a
            Stripe. Certificação PCI-DSS Level 1.
          </li>
          <li>
            <strong>Resend, Inc.</strong> (envio de e-mails transacionais — confirmação de conta,
            recuperação de senha, notificações de cobrança). Recebe apenas endereço de e-mail e
            conteúdo específico do aviso.
          </li>
          <li>
            <strong>Meta Platforms Ireland Ltd.</strong> (WhatsApp Business Platform — Cloud API
            direta). A ZappIQ é parceira conectada via Cloud API oficial, sem intermediário BSP.
            Dados de mensagens trafegam pela infraestrutura Meta conforme WhatsApp Business Policy.
          </li>
          <li>
            <strong>Autoridades públicas</strong> quando exigido por lei, ordem judicial ou
            solicitação formal de autoridade competente (LGPD Art. 7º, VI).
          </li>
        </ul>

        <h2>5. Armazenamento e transferência internacional</h2>
        <p>
          Dados primários armazenados em região <strong>AWS sa-east-1 (São Paulo, Brasil)</strong>{' '}
          via Supabase. Processamento com Anthropic e OpenAI envolve transferência internacional
          para data centers dos EUA, legitimada por cláusulas contratuais padrão reconhecidas pela
          ANPD (LGPD Art. 33, IV). Transferências para Stripe (EUA) e Cloudflare (global) seguem a
          mesma base legal.
        </p>

        <h2>6. Retenção</h2>
        <ul>
          <li>
            <strong>Mensagens WhatsApp de end-users:</strong> 90 dias rolantes no banco
            operacional. Após, arquivadas em cold storage criptografado por mais 12 meses para
            auditoria, e depois anonimizadas irreversivelmente.
          </li>
          <li>
            <strong>Dados de cadastro do Cliente:</strong> enquanto a conta estiver ativa, mais 12
            meses pós-cancelamento para eventual reativação e cumprimento de obrigações
            fiscais/contratuais.
          </li>
          <li>
            <strong>Logs de sistema:</strong> 24 meses.
          </li>
          <li>
            <strong>Dados de pagamento:</strong> 5 anos, conforme exigência fiscal brasileira.
          </li>
        </ul>

        <h2>7. Segurança</h2>
        <p>
          Criptografia em trânsito (TLS 1.3) e em repouso (AES-256). Autenticação multifator
          obrigatória para colaboradores ZappIQ com acesso a dados de produção. Monitoramento
          contínuo de anomalias. Revisão trimestral de políticas de acesso. Testes anuais de
          penetração por terceiro independente.
        </p>

        <h2>8. Cookies</h2>
        <p>
          Usamos apenas cookies essenciais ao funcionamento do site. Cookies de analytics e
          marketing são opcionais e só ativados com consentimento explícito (LGPD Art. 7º, I).
          Detalhes na{' '}
          <a href="/legal/cookies" className="text-blue-600 hover:text-blue-700">
            Política de Cookies
          </a>
          .
        </p>

        <h2>9. Como exercer seus direitos de titular</h2>
        <p>
          Titulares de dados pessoais podem exercer os direitos previstos na LGPD Art. 18 —
          acesso, correção, anonimização, portabilidade, eliminação, revogação de consentimento —
          através dos seguintes canais:
        </p>
        <ul>
          <li>
            <strong>Autoatendimento (exclusão imediata):</strong> formulário público em{' '}
            <a href="/legal/deletar-dados" className="text-blue-600 hover:text-blue-700">
              zappiq.com.br/legal/deletar-dados
            </a>
            . Processamento em até 48 horas úteis.
          </li>
          <li>
            <strong>Via DPO:</strong> e-mail para{' '}
            <a
              href="mailto:rodrigo.ghetti@zappiq.com.br"
              className="text-blue-600 hover:text-blue-700"
            >
              rodrigo.ghetti@zappiq.com.br
            </a>{' '}
            com assunto &ldquo;Direitos LGPD — [tipo de solicitação]&rdquo;. Resposta em até 15 dias
            corridos (prazo ANPD).
          </li>
          <li>
            <strong>Via plataforma:</strong> Clientes ZappIQ ativos podem solicitar exclusão no
            fluxo de cancelamento do painel administrativo.
          </li>
        </ul>
        <p>
          Para end-users de Clientes ZappIQ (pessoas que conversam via WhatsApp com agentes de
          nossos clientes), a responsabilidade primária de atender os direitos é do{' '}
          <strong>Cliente como controlador</strong>, cabendo à ZappIQ atuar como operadora. A
          ZappIQ oferece endpoint de eliminação programática para que os Clientes integrem em seus
          próprios fluxos de atendimento de direitos do titular.
        </p>

        <h2>10. Encarregado pelo Tratamento (DPO)</h2>
        <p>
          <strong>Nome:</strong> Rodrigo Ghetti
          <br />
          <strong>E-mail:</strong>{' '}
          <a
            href="mailto:rodrigo.ghetti@zappiq.com.br"
            className="text-blue-600 hover:text-blue-700"
          >
            rodrigo.ghetti@zappiq.com.br
          </a>
          <br />
          <strong>Endereço postal:</strong> ZappIQ Brasil Sistemas de IA LTDA — consulte{' '}
          <a href="/legal/enderecos-comerciais" className="text-blue-600 hover:text-blue-700">
            endereços comerciais
          </a>
          .
        </p>

        <h2>11. Incidentes de segurança</h2>
        <p>
          Em caso de incidente envolvendo dados pessoais, a ZappIQ notifica a ANPD e os titulares
          afetados conforme LGPD Art. 48, no prazo de até 72 horas da constatação do incidente.
        </p>

        <h2>12. Comunicação com a Meta (WhatsApp Business Platform)</h2>
        <p>
          Como parceira oficial da Meta conectada via Cloud API direta ao WhatsApp Business
          Platform, a ZappIQ opera em conformidade com a WhatsApp Business Policy, a Meta Commerce
          Policy e os Termos de Serviço da Meta Platforms. Clientes ZappIQ são responsáveis por
          respeitar políticas de opt-in, consentimento e qualidade de conta WhatsApp. Violações
          podem resultar em suspensão da conta WhatsApp Business do Cliente pela Meta — situação
          alheia à responsabilidade da ZappIQ. Mais detalhes na{' '}
          <a href="/legal/parceria-meta" className="text-blue-600 hover:text-blue-700">
            página de Parceria Meta
          </a>
          .
        </p>

        <h2>13. Alterações desta Política</h2>
        <p>
          Modificações materiais serão comunicadas por e-mail aos Clientes com 30 dias de
          antecedência. O histórico de versões fica disponível sob solicitação ao DPO.
        </p>

        <h2>14. Contato</h2>
        <p>
          Para dúvidas, solicitações ou reclamações sobre privacidade:{' '}
          <a href="mailto:privacidade@zappiq.com.br" className="text-blue-600 hover:text-blue-700">
            privacidade@zappiq.com.br
          </a>
          .
        </p>

        <hr className="my-10" />
        <p className="text-xs text-gray-500 italic">
          Esta Política entra em vigor na data indicada no topo e substitui todas as versões
          anteriores.
        </p>
      </div>
    </div>
  );
}
