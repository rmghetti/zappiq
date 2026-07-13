/**
 * Termos de Uso: ZappIQ V3.2
 *
 * Patch aplicado em 27/04/2026 para fechar inconsistência com Privacy V3.2 e
 * atender requisitos do Meta Tech Provider Program (WhatsApp Business Policy,
 * Meta Commerce Policy, Cloud API direta sem BSP).
 *
 * Substitui versão de 15/04/2026.
 *
 * Mudanças principais:
 *  - §5 (Propriedade Intelectual): removida cláusula "uso de agregados anônimos
 *    para melhorias contínuas do Serviço", que conflitava com a Privacy V3.2
 *    ("ZappIQ não treina modelos de IA com dados de clientes ou end-users").
 *  - §6 novo (Inteligência Artificial e Não-Treinamento): cláusula explícita
 *    espelhando Privacy V3.2 §2.
 *  - §7 novo (Conformidade com Políticas Meta/WhatsApp): WhatsApp Business
 *    Policy + Meta Commerce Policy + responsabilidades de opt-in e qualidade
 *    de conta WhatsApp Business pelo Cliente.
 *  - §8 novo (Cloud API direta sem BSP): declaração explícita.
 *  - §15 novo (LGPD e DPO): referência cruzada com Privacy.
 *  - Vigência separada de data de publicação.
 *
 * Aprovador: Rodrigo Ghetti (DPO ZappIQ).
 * Evidência: ZappIQ_V32_Actions/sprint_1_pricing_garantia_cloud_api/TERMOS_V32_APROVADA.md
 */

export const metadata = {
  title: 'Termos de Uso ZappIQ',
  description:
    'Termos de Uso da plataforma ZappIQ. Conformidade com WhatsApp Business Policy, Meta Commerce Policy, LGPD e Cloud API direta.',
  alternates: {
    canonical: 'https://zappiq.com.br/legal/termos',
  },
};

export default function TermosPage() {
  const publishedAt = '27 de abril de 2026';
  const effectiveAt = '14 de maio de 2026';

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-sm sm:prose">
        <div className="mb-8">
          <a href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Voltar ao início
          </a>
        </div>

        <h1>Termos de Uso</h1>
        <p className="text-gray-600 text-sm">
          Publicado em {publishedAt}. Entra em vigor em {effectiveAt}, substituindo a
          versão anterior de 15 de abril de 2026.
        </p>

        <h2>1. Objeto do Contrato</h2>
        <p>
          A ZappIQ Brasil Sistemas de IA LTDA (&quot;Empresa&quot; ou &quot;ZappIQ&quot;) oferece uma
          plataforma SaaS de inteligência artificial conversacional para automação de
          atendimento, vendas e campanhas no WhatsApp Business (&quot;Serviço&quot;), conectada
          diretamente ao WhatsApp Business Platform da Meta via Cloud API oficial,
          sem intermediários (BSP). Estes Termos regem o uso do Serviço por usuários
          e organizações (&quot;Cliente&quot; ou &quot;você&quot;).
        </p>

        <h2>2. Cadastro e Conta</h2>
        <p>
          Para acessar o Serviço, você deve criar uma conta com informações precisas,
          completas e atualizadas. Você é responsável por manter a confidencialidade
          de suas credenciais e pela segurança de sua conta. Você concorda em
          notificar a ZappIQ imediatamente em caso de acesso não autorizado. A ZappIQ
          pode suspender ou encerrar contas que violem estes Termos.
        </p>

        <h2>3. Obrigações da ZappIQ</h2>
        <ul>
          <li>Disponibilizar o Serviço conforme descrito na documentação fornecida.</li>
          <li>
            Tratar dados do Cliente e dos end-users em conformidade com a{' '}
            <a href="/legal/privacidade" className="text-blue-600 hover:text-blue-700">
              Política de Privacidade
            </a>{' '}
            e com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
          </li>
          <li>Fornecer suporte técnico através de canais documentados.</li>
          <li>
            Garantir disponibilidade de 99,5% (SLA), excluindo manutenção programada,
            falhas de terceiros (Meta, provedores de internet, sub-processadores) e
            força maior.
          </li>
          <li>
            Operar como parceira oficial da Meta conectada via Cloud API direta ao
            WhatsApp Business Platform, sem intermediários BSP.
          </li>
        </ul>

        <h2>4. Obrigações do Cliente</h2>
        <ul>
          <li>Usar o Serviço em conformidade com a legislação aplicável.</li>
          <li>
            Cumprir integralmente as políticas da Meta aplicáveis ao WhatsApp Business
            Platform, incluindo, sem limitação, a{' '}
            <em>WhatsApp Business Messaging Policy</em>, a{' '}
            <em>WhatsApp Business Policy</em> e a <em>Meta Commerce Policy</em>.
          </li>
          <li>
            Obter, manter e comprovar o opt-in válido (consentimento prévio,
            informado e específico) dos end-users antes de iniciar qualquer
            comunicação ativa via WhatsApp, conforme exigido pelas políticas da Meta
            e pela LGPD.
          </li>
          <li>
            Não enviar spam, mensagens não solicitadas, conteúdo ilícito, conteúdo
            proibido pela <em>Meta Commerce Policy</em>, malware, ou realizar ataques
            cibernéticos.
          </li>
          <li>
            Manter a confidencialidade de chaves de API, tokens e credenciais de
            integração.
          </li>
          <li>
            Ser responsável por todas as ações realizadas em sua conta e na conta
            WhatsApp Business (WABA) conectada à ZappIQ via Embedded Signup oficial
            da Meta.
          </li>
          <li>Não contornar ou violar mecanismos de segurança do Serviço.</li>
        </ul>

        <h2>5. Propriedade Intelectual e Licença sobre Seus Dados</h2>
        <p>
          Você retém a titularidade integral de todos os dados, conteúdo e materiais
          fornecidos ao Serviço (&quot;Seus Dados&quot;), incluindo o conteúdo das mensagens
          trocadas via WhatsApp Business com seus end-users. A ZappIQ é detentora de
          todos os direitos sobre a plataforma, código, arquitetura e funcionalidades
          do Serviço.
        </p>
        <p>
          Você concede à ZappIQ <strong>licença limitada, não exclusiva e
          intransferível</strong> para processar Seus Dados <strong>exclusivamente
          para a operação do Serviço contratado</strong> e para o cumprimento de
          obrigações legais. Esta licença é estritamente operacional e não autoriza
          a ZappIQ a (i) treinar modelos de inteligência artificial com Seus Dados,
          (ii) usar Seus Dados para finalidades publicitárias ou de marketing
          próprio, (iii) compartilhar Seus Dados com terceiros fora dos
          sub-processadores listados na Política de Privacidade.
        </p>

        <h2>6. Inteligência Artificial e Não-Treinamento</h2>
        <p>
          A ZappIQ processa requisições de IA via APIs de provedores especializados
          (Anthropic Claude e, quando aplicável, OpenAI), sob contratos Enterprise
          com cláusulas que <strong>proíbem expressamente o uso dos inputs e outputs
          para treinamento de modelos</strong>.{' '}
          <strong>
            A ZappIQ não treina modelos de inteligência artificial com dados do
            Cliente ou de end-users
          </strong>
          . Interações são utilizadas apenas em tempo de execução para a lógica do
          agente do Cliente (retrieval-augmented generation sobre a base de
          conhecimento isolada por tenant), sem contribuir para treinamento ou
          personalização de modelos fundacionais. Detalhes adicionais na{' '}
          <a href="/legal/privacidade#secao-2" className="text-blue-600 hover:text-blue-700">
            Política de Privacidade, §2
          </a>
          .
        </p>

        <h2>7. Conformidade com Políticas da Meta (WhatsApp Business Platform)</h2>
        <p>
          O Serviço opera sobre o WhatsApp Business Platform via Cloud API direta da
          Meta. Como condição de uso do Serviço, o Cliente declara estar ciente e se
          compromete a cumprir, em caráter contínuo:
        </p>
        <ul>
          <li>
            <strong>WhatsApp Business Messaging Policy</strong>: janela de
            atendimento de 24 horas, uso de templates aprovados pela Meta para
            mensagens fora da janela, restrições a categorias de conteúdo
            (financeiro regulado, saúde sensível, etc.).
          </li>
          <li>
            <strong>WhatsApp Business Policy</strong>: proibição de conteúdo
            ilegal, conteúdo enganoso, comércio de itens proibidos, e demais
            restrições publicadas pela Meta em{' '}
            <a
              href="https://business.whatsapp.com/policy"
              className="text-blue-600 hover:text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              business.whatsapp.com/policy
            </a>
            .
          </li>
          <li>
            <strong>Meta Commerce Policy</strong>: quando o Cliente utilizar
            funcionalidades de comércio (catálogo, carrinho, checkout WhatsApp),
            cumprir integralmente a política comercial publicada pela Meta.
          </li>
          <li>
            <strong>Qualidade de conta WhatsApp Business (WABA)</strong>: manter
            qualidade de mensagens em nível verde ou amarelo, evitando bloqueios por
            alta taxa de bloqueio/denúncia. Quedas de qualidade podem resultar em
            suspensão da WABA pela Meta, situação alheia à responsabilidade da
            ZappIQ.
          </li>
        </ul>
        <p>
          Violações das políticas da Meta pelo Cliente podem resultar, sem aviso
          prévio, em (i) suspensão imediata da WABA do Cliente pela Meta, (ii)
          suspensão da conta ZappIQ do Cliente, (iii) responsabilização do Cliente
          por danos causados a terceiros. Mais detalhes em{' '}
          <a href="/legal/parceria-meta" className="text-blue-600 hover:text-blue-700">
            /legal/parceria-meta
          </a>
          .
        </p>

        <h2>8. Cloud API Direta e Embedded Signup</h2>
        <p>
          A ZappIQ é parceira oficial da Meta conectada diretamente ao WhatsApp
          Business Platform via Cloud API, sem intermediários (BSP). A conexão da
          conta WhatsApp Business do Cliente (WABA) com a ZappIQ ocorre
          exclusivamente via fluxo Embedded Signup oficial da Meta. A ZappIQ não
          armazena senhas Meta do Cliente e opera a WABA mediante tokens de sistema
          escopo-limitados, autorizados pelo Cliente no fluxo Embedded Signup.
        </p>

        <h2>9. Disponibilidade e SLA</h2>
        <p>
          A ZappIQ se compromete a manter o Serviço disponível por no mínimo 99,5%
          do tempo em período mensal. Manutenções programadas serão comunicadas com
          antecedência de 48 horas. Falhas causadas por terceiros (Meta/WhatsApp,
          provedores de internet, sub-processadores), ataques DDoS de larga escala,
          ou força maior não contam para cálculo de SLA.
        </p>

        <h2>10. Limitação de Responsabilidade</h2>
        <p>
          A ZappIQ não será responsável por: (i) danos indiretos, incidentais,
          consequentes ou punitivos; (ii) perda de dados, lucros cessantes ou
          receita; (iii) interrupções causadas por terceiros (incluindo a Meta) ou
          força maior; (iv) suspensões ou bloqueios da WABA do Cliente decorrentes
          de violação pelo Cliente das políticas da Meta. A responsabilidade total
          da ZappIQ não ultrapassará o valor pago pelo Cliente nos últimos 12 meses
          imediatamente anteriores ao evento. Algumas jurisdições não permitem
          limitação de responsabilidade; nesses casos, aplica-se a máxima permitida
          por lei.
        </p>

        <h2>11. Interrupção e Suspensão</h2>
        <p>
          A ZappIQ pode suspender ou encerrar contas que violem estes Termos, sem
          aviso prévio quando necessário para proteger a plataforma, terceiros ou
          end-users. Contas ativas podem ser pausadas por inadimplência. Você será
          notificado sobre suspensões não imediatas com antecedência mínima de 5
          dias úteis.
        </p>

        <h2>12. Vigência e Rescisão</h2>
        <p>
          Este contrato vigora a partir da data de aceitação até rescisão por
          qualquer das partes. Você pode cancelar sua conta a qualquer momento, sem
          multa ou penalidade. O cancelamento não gera reembolso de períodos já
          pagos, salvo quando expressamente previsto na{' '}
          <a href="/garantia" className="text-blue-600 hover:text-blue-700">
            Garantia ZappIQ
          </a>
          . A ZappIQ pode rescindir por violação destes Termos com aviso de 30 dias,
          ou imediatamente em caso de violação grave. Dados serão tratados conforme
          a Política de Privacidade após o encerramento.
        </p>

        <h2>13. Modificações dos Termos</h2>
        <p>
          A ZappIQ pode modificar estes Termos a qualquer momento. Alterações
          materiais serão comunicadas por e-mail com 30 dias de antecedência. A
          continuidade do uso após a entrada em vigor da modificação significa
          aceitação. Você pode rescindir a conta sem penalidade caso discorde de
          alterações materiais.
        </p>

        <h2>14. Foro Competente</h2>
        <p>
          Estes Termos são regidos pela legislação da República Federativa do
          Brasil. Qualquer litígio será processado perante o Tribunal competente da
          comarca de São Paulo, Estado de São Paulo, ressalvado o direito do
          consumidor de optar pelo foro de seu domicílio.
        </p>

        <h2>15. LGPD, DPO e Direitos do Titular</h2>
        <p>
          A ZappIQ atua como controladora dos dados de cadastro do Cliente e como
          operadora dos dados de end-users do WhatsApp, conforme detalhado na{' '}
          <a href="/legal/privacidade" className="text-blue-600 hover:text-blue-700">
            Política de Privacidade
          </a>
          . O Encarregado pelo Tratamento de Dados (DPO) é Rodrigo Ghetti
          (rodrigo.ghetti@zappiq.com.br). Solicitações de exercício de direitos
          previstos no Art. 18 da LGPD podem ser feitas via{' '}
          <a href="/legal/deletar-dados" className="text-blue-600 hover:text-blue-700">
            zappiq.com.br/legal/deletar-dados
          </a>
          .
        </p>

        <h2>16. Cancelamento sem Multa</h2>
        <p>
          Você pode cancelar sua assinatura a qualquer momento, sem necessidade de
          justificativa ou multa. O cancelamento não gera reembolso de períodos já
          pagos, exceto quando coberto pela Garantia ZappIQ aplicável. Sua conta
          será encerrada ao final do ciclo de cobrança vigente.
        </p>

        <h2>17. Contato</h2>
        <p>
          Para dúvidas sobre estes Termos: <strong>legal@zappiq.com.br</strong>.
          Para assuntos de privacidade ou LGPD:{' '}
          <strong>privacidade@zappiq.com.br</strong>. Endereço postal e
          identificação completa em{' '}
          <a href="/legal/enderecos-comerciais" className="text-blue-600 hover:text-blue-700">
            /legal/enderecos-comerciais
          </a>
          .
        </p>

        <hr className="my-8" />
        <p className="text-xs text-gray-500">
          Ao usar a plataforma ZappIQ, você concorda com estes Termos de Uso e com a{' '}
          <a href="/legal/privacidade" className="text-blue-600 hover:text-blue-700">
            Política de Privacidade
          </a>
          . Se não concordar, descontinue o uso do Serviço.
        </p>
      </div>
    </div>
  );
}
