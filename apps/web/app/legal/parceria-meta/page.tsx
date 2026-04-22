import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Parceria WhatsApp Business — ZappIQ via Cloud API direto',
  description:
    'ZappIQ integra WhatsApp Business Cloud API diretamente com a Meta, sem camada de BSP intermediário. Esclarecimento institucional sobre posicionamento, custos pass-through e obrigações contratuais.',
};

/* ══════════════════════════════════════════════════════════════════════════
 * /legal/parceria-meta — V3.2 (sem BSP)
 * --------------------------------------------------------------------------
 * V2-013 (histórico) criou esta página com foco em BSP 360Dialog. V3.2
 * migra para WhatsApp Cloud API direto Meta (sem BSP). Esta revisão
 * atualiza toda a narrativa.
 *
 * Mantém o espírito original: evitar publicidade enganosa sobre
 * "Parceria Oficial Meta" e deixar claro o status real da relação.
 * ══════════════════════════════════════════════════════════════════════════ */

export default function ParceriaMetaPage() {
  return (
    <PublicLayout>
      <article className="prose prose-lg mx-auto max-w-3xl px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider">Conformidade</p>
        <h1 className="font-display text-4xl font-extrabold text-gray-900">
          Integração WhatsApp Business via Cloud API direto da Meta
        </h1>
        <p className="text-gray-500">Última atualização: 21/04/2026 · Versão 2.0 (V3.2)</p>

        <h2>1. Posicionamento institucional</h2>
        <p>
          ZappIQ opera o WhatsApp Business Platform (WABA) por meio do{' '}
          <strong>WhatsApp Business Cloud API</strong>, hospedado e operado pela própria Meta. Não há
          BSP (Business Solution Provider) intermediário na nossa arquitetura V3.2 — a comunicação é
          direta entre ZappIQ e a infraestrutura oficial da Meta.
        </p>
        <p>
          Não nos apresentamos como &quot;Parceiro Oficial Meta&quot;, &quot;Meta Business Partner&quot;
          ou &quot;Tech Provider&quot; sem que a designação correspondente tenha sido concedida
          formalmente por escrito pela Meta Platforms Ireland Ltd. ou afiliada. Somos{' '}
          <strong>cliente da Cloud API</strong>, com conta WABA ativa e número verificado.
        </p>

        <h2>2. O que muda vs. modelo BSP antigo</h2>
        <ul>
          <li>
            <strong>Cobrança direta Meta:</strong> conversas utility/marketing/authentication/service são
            faturadas pela Meta ao ZappIQ no preço oficial, sem markup de intermediário. Repassamos o
            custo real ao cliente (sem mark-up adicional) conforme plano contratado.
          </li>
          <li>
            <strong>Recursos oficiais imediatos:</strong> templates aprovados, message_reactions, CTWA
            (Click-to-WhatsApp Ads), Flows e Payments ficam disponíveis assim que a Meta libera
            regionalmente — sem esperar repasse de BSP.
          </li>
          <li>
            <strong>Zero setup fee de BSP:</strong> o modelo V3.2 elimina a taxa de ativação cobrada por
            BSPs (tipicamente R$ 2.000 a R$ 5.000). Ativação WABA é feita pelo próprio cliente via
            onboarding ZappIQ em até 48h.
          </li>
          <li>
            <strong>Sem compromissos em nome da Meta:</strong> não garantimos SLAs da própria Meta e não
            firmamos acordos em nome dela. Responsabilidade ZappIQ é sobre nosso software e suporte.
          </li>
        </ul>

        <h2>3. Arquitetura técnica</h2>
        <p>
          ZappIQ V3.2 conecta-se à <code>graph.facebook.com</code> via API oficial Meta usando o{' '}
          <strong>WhatsApp Business Account (WABA) ID</strong> e <strong>Phone Number ID</strong>{' '}
          provisionados no próprio Business Manager do cliente. A autenticação é feita via access token
          de longa duração (System User token), renovável, armazenado criptografado (AES-256) no
          Supabase.
        </p>
        <p>
          Templates são submetidos diretamente ao painel Meta pelo cliente (com suporte do CSM ZappIQ) e
          aprovados pela Meta em 1 a 24h, conforme política oficial. Webhooks apontam para endpoints
          ZappIQ em <code>api.zappiq.com.br</code>.
        </p>

        <h2>4. Status de designação Tech Provider</h2>
        <p>
          A designação oficial <strong>Meta Tech Provider</strong> está em processo de aplicação
          (tracker interno: BLOCKER B-08 / BLOCKER DxComm). A aplicação é baseada em volume de tráfego
          WABA agregado através da Cloud API e conformidade com a política de plataforma Meta.
        </p>
        <p>
          Até a homologação formal, toda comunicação pública segue o rótulo{' '}
          <strong>&quot;via WhatsApp Business Cloud API oficial Meta&quot;</strong>. Quando a
          designação for concedida, esta página será atualizada com o certificado/ID oficial, um link
          para o diretório público da Meta e a data de concessão.
        </p>

        <h2>5. Portabilidade e saída</h2>
        <p>
          Caso um cliente ZappIQ queira migrar o número WABA para outro provedor (seja outro SaaS que use
          Cloud API, seja um BSP tradicional, seja infraestrutura própria), cooperamos integralmente com
          o processo oficial da Meta. <strong>Não retemos</strong> o número, o histórico de templates,
          o opt-in/opt-out history ou metadados da conta WABA — a conta WABA pertence ao cliente, está
          no Business Manager dele.
        </p>
        <p>
          Export de histórico via <code>/api/consent/export</code> e solicitação formal em{' '}
          <a href="mailto:suporte@zappiq.com.br">suporte@zappiq.com.br</a> · prazo: até 5 dias úteis
          para dados estruturados, até 15 dias para exports completos de conversa.
        </p>

        <h2>6. Conformidade com políticas Meta</h2>
        <p>
          ZappIQ cumpre integralmente as políticas da plataforma WhatsApp Business, incluindo:
        </p>
        <ul>
          <li>Janela de 24h para mensagens de sessão</li>
          <li>Uso obrigatório de templates aprovados fora da janela de sessão</li>
          <li>Respeito a opt-out explícito do usuário</li>
          <li>Proibição de spam, cold outbound sem consentimento documentado e conteúdo vedado pela Meta</li>
          <li>
            Política anti-impersonation: voz clonada (add-on V3.2 Premium) requer autorização por
            escrito do titular (ver <Link href="/voz">/voz</Link>)
          </li>
        </ul>
        <p>
          Violações por parte de clientes são tratadas com suspensão imediata + processo de remediação.
          Reincidência → desativação da conta WABA no nosso lado.
        </p>

        <h2>7. Disclaimers legais</h2>
        <p>
          <strong>WhatsApp</strong>, <strong>WhatsApp Business</strong>, <strong>Meta</strong>,{' '}
          <strong>Messenger</strong> e <strong>Instagram</strong> são marcas registradas de Meta
          Platforms, Inc. O uso dessas marcas nesta página é meramente descritivo-informativo e não
          implica endosso ou parceria formal.
        </p>
        <p>
          ZappIQ é marca comercial (d.b.a.) de <strong>Onze e Onze Consultoria Empresarial Ltda</strong>,
          CNPJ 46.788.145/0001-08, empresa independente com sede em São Paulo/SP.
        </p>

        <h2>8. Contato</h2>
        <p>
          Dúvidas sobre integração WABA, conformidade ou migração:{' '}
          <Link href="/contato">página de contato</Link> ·{' '}
          <a href="mailto:compliance@zappiq.com.br">compliance@zappiq.com.br</a>
          {' · '}
          Encarregado de Dados (DPO):{' '}
          <a href="mailto:rodrigo.ghetti@zappiq.com.br">rodrigo.ghetti@zappiq.com.br</a>.
        </p>
      </article>
    </PublicLayout>
  );
}
