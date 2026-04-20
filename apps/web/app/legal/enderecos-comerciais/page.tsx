import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Endereços Comerciais — ZappIQ',
  description:
    'Endereços fiscais, técnicos e de atendimento da ZappIQ — Onze e Onze Consultoria Empresarial Ltda (CNPJ 46.788.145/0001-08).',
};

/* V2-027: registro público de endereços comerciais — exigência
 * CDC Art. 39 XII para venda à distância / contratação eletrônica. */

export default function EnderecosComerciaisPage() {
  return (
    <PublicLayout>
      <article className="prose prose-lg mx-auto max-w-3xl px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider">Conformidade</p>
        <h1 className="font-display text-4xl font-extrabold text-gray-900">Endereços Comerciais</h1>
        <p className="text-gray-500">Última atualização: 18/04/2026 · Versão 1.0</p>

        <h2>1. Razão social e identificação fiscal</h2>
        <p>
          <strong>ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA</strong> (d.b.a. ZappIQ)<br />
          CNPJ 46.788.145/0001-08<br />
          Inscrição Estadual: isento (prestadora de serviço)<br />
          Inscrição Municipal: em conformidade · CCM São Paulo
        </p>

        <h2>2. Endereço fiscal e correspondência</h2>
        <p>
          Av. das Nações Unidas, 12901 — CENU Torre Norte, 25° andar<br />
          Bairro Brooklin · São Paulo / SP · CEP 04578-910
        </p>
        <p className="text-sm text-gray-500">
          Este é o endereço oficial para correspondência, notificações extrajudiciais e documentação
          fiscal. Visitas presenciais exigem agendamento prévio — nossa operação é remote-first.
        </p>

        <h2>3. Endereço técnico (infraestrutura)</h2>
        <p>
          Dados de clientes ZappIQ são hospedados no Brasil em provedor de nuvem com residência de
          dados garantida em território nacional (região <em>BR/SA-East-1</em>). Backups replicados em
          segunda região brasileira. Mais detalhes em{' '}
          <Link href="/legal/dpa">DPA — Seção 5</Link>.
        </p>

        <h2>4. Endereço de atendimento</h2>
        <p>
          Não operamos central de atendimento presencial. Todo suporte é realizado por e-mail,
          WhatsApp e dashboard do produto. Canais oficiais:{' '}
          <Link href="/contato">página de contato</Link>.
        </p>

        <h2>5. Procurador para notificações processuais</h2>
        <p>
          Notificações judiciais e extrajudiciais podem ser endereçadas ao endereço fiscal acima ou
          por e-mail a <a href="mailto:juridico@zappiq.com.br">juridico@zappiq.com.br</a>, observando
          que a eficácia citatória por e-mail depende de aceite expresso nos termos aplicáveis.
        </p>

        <h2>6. Verificação</h2>
        <p className="text-sm text-gray-500">
          A situação cadastral da ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA pode ser consultada no
          portal oficial da Receita Federal pelo CNPJ informado. Em caso de divergência entre esta
          página e a consulta pública, prevalece a consulta pública.
        </p>
      </article>
    </PublicLayout>
  );
}
