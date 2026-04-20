import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Política de Fair-Use & Limites Técnicos — ZappIQ',
  description:
    'Política de fair-use da ZappIQ: limites por plano (mensagens, sessões, armazenamento, automações), hardcap de abuso e procedimento de upgrade.',
};

/* V2-020 · V2-028: fair-use obrigatório para justificar rate limits
 * e evitar disputas sobre "serviço ilimitado". */

const PLANS = [
  {
    plan: 'Starter',
    sessions: '1.000 / mês',
    agents: '3',
    storage: '2 GB',
    llmTokens: '500 mil / mês',
    webhooks: '50k disparos / dia',
    rate: '60 req/s',
  },
  {
    plan: 'Growth',
    sessions: '10.000 / mês',
    agents: '10',
    storage: '20 GB',
    llmTokens: '5 milhões / mês',
    webhooks: '500k disparos / dia',
    rate: '200 req/s',
  },
  {
    plan: 'Scale',
    sessions: '50.000 / mês',
    agents: '30',
    storage: '100 GB',
    llmTokens: '25 milhões / mês',
    webhooks: '2M disparos / dia',
    rate: '800 req/s',
  },
  {
    plan: 'Business',
    sessions: '200.000 / mês',
    agents: '100',
    storage: '500 GB',
    llmTokens: '100 milhões / mês',
    webhooks: '10M disparos / dia',
    rate: '3.000 req/s',
  },
  {
    plan: 'Enterprise',
    sessions: 'Custom',
    agents: 'Custom',
    storage: 'Custom',
    llmTokens: 'Custom',
    webhooks: 'Custom',
    rate: 'Custom',
  },
];

export default function FairUsePage() {
  return (
    <PublicLayout>
      <article className="prose prose-lg mx-auto max-w-4xl px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider">Conformidade</p>
        <h1 className="font-display text-4xl font-extrabold text-gray-900">Política de Fair-Use &amp; Limites Técnicos</h1>
        <p className="text-gray-500">Última atualização: 18/04/2026 · Versão 1.0</p>

        <h2>1. Princípio</h2>
        <p>
          ZappIQ não vende &quot;mensagens ilimitadas&quot;. Cada plano tem envelope claro de uso que
          cobre ≥ 99,5% dos clientes PME típicos. Esta política torna o envelope explícito, garante
          previsibilidade de custo operacional e evita que o uso abusivo de poucos contas degrade a
          experiência dos demais.
        </p>

        <h2>2. Envelope por plano</h2>
        <div className="not-prose my-8 overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Plano</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Sessões WhatsApp</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Atendentes</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Armazenamento</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Tokens LLM</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Webhooks</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Rate API</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {PLANS.map((p) => (
                <tr key={p.plan}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{p.plan}</td>
                  <td className="px-4 py-3">{p.sessions}</td>
                  <td className="px-4 py-3">{p.agents}</td>
                  <td className="px-4 py-3">{p.storage}</td>
                  <td className="px-4 py-3">{p.llmTokens}</td>
                  <td className="px-4 py-3">{p.webhooks}</td>
                  <td className="px-4 py-3">{p.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          &quot;Sessão WhatsApp&quot; = janela de conversa de 24h com um mesmo contato, conforme política Meta.
        </p>

        <h2>3. Mensagens utility vs marketing</h2>
        <p>
          Mensagens template categoria <strong>marketing</strong> têm cobrança adicional conforme a
          tabela oficial da Meta, repassada sem markup na sua fatura. Mensagens{' '}
          <strong>utility</strong> e <strong>service</strong> são cobertas pelo envelope do plano quando
          iniciadas em sessão de serviço válida.
        </p>

        <h2>4. Overage e upgrade</h2>
        <p>
          Ao exceder 80% do envelope mensal, enviamos notificação por email e banner no dashboard. Ao
          exceder 100%, oferecemos três opções: upgrade para plano superior (sem multa, cobrança
          proporcional), add-on pontual (R$ 0,008 por sessão extra até 1,5× do envelope), ou aceitar
          throttling temporário a 50% da rate normal.
        </p>

        <h2>5. Hardcap de abuso</h2>
        <p>
          Reservamo-nos o direito de aplicar throttling <em>defensive</em> em 2× do envelope mensal ou
          em uso que degrade a plataforma para outros clientes. Throttling defensive é sempre
          comunicado em até 2 horas por email + banner, com oferta de upgrade ou plano custom.
        </p>

        <h2>6. Uso vedado</h2>
        <ul>
          <li>Envio não solicitado em massa (spam) ou violação das políticas WABA da Meta</li>
          <li>Tentativas de ingeniaria reversa, extração de embeddings ou prompts do sistema</li>
          <li>Revenda não autorizada como white-label (requer contrato de partner explícito)</li>
          <li>Qualquer conduta que viole LGPD ou marco civil da internet</li>
        </ul>

        <h2>7. Contato</h2>
        <p>
          Dúvidas sobre limites ou solicitações de upgrade custom:{' '}
          <Link href="/contato">vendas@zappiq.com.br</Link>. Para disputas:{' '}
          <a href="mailto:juridico@zappiq.com.br">juridico@zappiq.com.br</a>.
        </p>
      </article>
    </PublicLayout>
  );
}
