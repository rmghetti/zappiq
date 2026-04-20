import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Parceria WhatsApp Business — ZappIQ via BSP homologado',
  description:
    'Esclarecimento institucional: ZappIQ é cliente de BSP homologado Meta (360Dialog), não vende como "Parceira Oficial Meta". Como a integração funciona, SLAs e obrigações contratuais.',
};

/* V2-013: esclarecimento anti-publicidade enganosa sobre "Parceria Meta".
 * Referência contratual pública — evita disputa com Meta Business Legal. */

export default function ParceriaMetaPage() {
  return (
    <PublicLayout>
      <article className="prose prose-lg mx-auto max-w-3xl px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider">Conformidade</p>
        <h1 className="font-display text-4xl font-extrabold text-gray-900">Parceria WhatsApp Business via BSP homologado Meta</h1>
        <p className="text-gray-500">Última atualização: 18/04/2026 · Versão 1.0</p>

        <h2>1. Posicionamento institucional</h2>
        <p>
          ZappIQ opera o WhatsApp Business Platform (WABA) por meio de{' '}
          <strong>Business Solution Provider (BSP) homologado pela Meta</strong>. Atualmente nosso BSP
          parceiro é 360Dialog GmbH. Não nos apresentamos como &quot;Parceiro Oficial Meta&quot;,
          &quot;Meta Business Partner&quot; ou &quot;Tech Provider&quot; sem que essa designação tenha
          sido concedida formalmente por escrito pela Meta Platforms Ireland Ltd. ou afiliada.
        </p>

        <h2>2. O que isso significa na prática</h2>
        <ul>
          <li>
            <strong>Conformidade WABA integral:</strong> seu negócio opera dentro da política oficial da
            Meta para WhatsApp Business, via infraestrutura homologada.
          </li>
          <li>
            <strong>Cobrança utility/marketing transparente:</strong> repassamos exatamente a categoria
            e o preço praticados pela Meta, sem markup.
          </li>
          <li>
            <strong>Acesso a recursos oficiais:</strong> templates aprovados, message_reactions, CTWA
            (Click-to-WhatsApp Ads), Flows e Payments (conforme rollout regional da Meta).
          </li>
          <li>
            <strong>Sem compromissos não autorizados:</strong> não garantimos SLAs da própria Meta e não
            firmamos acordos em nome da Meta.
          </li>
        </ul>

        <h2>3. BSP homologado em uso</h2>
        <p>
          <strong>360Dialog GmbH</strong> · BSP Meta desde 2017 · sede Berlin/DE com presença Brasil.
          O contrato BSP cobre provisão de API WABA, templates, webhooks, relay de mensagens e
          suporte Tier-1. ZappIQ agrega inteligência conversacional, módulos de produto e suporte
          Tier-2 em pt-BR.
        </p>

        <h2>4. Status de designação &quot;Tech Provider&quot;</h2>
        <p>
          A designação oficial Meta Tech Provider está em processo de aplicação (BLOCKER B-08 do
          dossiê V2). Até a homologação formal, toda comunicação pública segue o rótulo &quot;via BSP
          homologado Meta (360Dialog)&quot;. Quando a designação for concedida, esta página será
          atualizada com o certificado/ID oficial e um link para o diretório público da Meta.
        </p>

        <h2>5. Portabilidade</h2>
        <p>
          Caso um cliente ZappIQ deseje migrar o número WABA para outro BSP, cooperamos integralmente
          com o processo oficial &quot;BSP change&quot; da Meta. Não retemos o número, o template
          history ou o opt-in/opt-out history. Export disponível via{' '}
          <code>/api/consent/export</code> e via solicitação a{' '}
          <a href="mailto:suporte@zappiq.com.br">suporte@zappiq.com.br</a>.
        </p>

        <h2>6. Disclaimers legais</h2>
        <p>
          <strong>WhatsApp</strong> e <strong>Meta</strong> são marcas registradas de Meta Platforms,
          Inc. O uso dessas marcas nesta página é meramente descritivo-informativo e não implica
          endosso. ZappIQ é marca de Onze e Onze Consultoria Empresarial Ltda (d.b.a. ZappIQ),
          empresa independente.
        </p>

        <h2>7. Contato</h2>
        <p>
          Dúvidas sobre integração WABA ou compliance:{' '}
          <Link href="/contato">página de contato</Link> ·{' '}
          <a href="mailto:compliance@zappiq.com.br">compliance@zappiq.com.br</a>.
        </p>
      </article>
    </PublicLayout>
  );
}
