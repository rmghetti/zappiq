import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Política de Cookies — ZappIQ',
  description:
    'Política de Cookies da ZappIQ — categorias (estritamente necessários, analíticos, marketing), base legal, duração e instruções de revogação.',
};

/* V2-028: Política de Cookies obrigatória (LGPD + diretiva ANPD). */

export default function CookiesPage() {
  return (
    <PublicLayout>
      <article className="prose prose-lg mx-auto max-w-3xl px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider">Conformidade</p>
        <h1 className="font-display text-4xl font-extrabold text-gray-900">Política de Cookies</h1>
        <p className="text-gray-500">Última atualização: 18/04/2026 · Versão 1.0</p>

        <h2>1. O que são cookies</h2>
        <p>
          Cookies são pequenos arquivos de texto armazenados no seu navegador. Usamos cookies para
          operar, medir e melhorar o site e o produto ZappIQ. Esta política descreve categorias,
          finalidades, duração e como revogar consentimento a qualquer momento.
        </p>

        <h2>2. Categorias que utilizamos</h2>
        <h3>2.1 Estritamente necessários</h3>
        <p>
          Sem estes cookies o site não funciona. Incluem sessão autenticada, proteção contra CSRF e
          balanceamento de carga. Base legal: <strong>execução de contrato</strong> (LGPD Art. 7 V) e{' '}
          <strong>legítimo interesse em segurança</strong> (LGPD Art. 7 IX combinado com Art. 10).
          Não dependem de consentimento.
        </p>

        <h3>2.2 Analíticos</h3>
        <p>
          Medem uso agregado do site e do produto para identificar falhas e priorizar melhorias.
          Usamos coletores de telemetria com <strong>IP anonimizado</strong> e hash de identificadores
          de usuário. Base legal: <strong>consentimento</strong> (LGPD Art. 7 I). Podem ser bloqueados
          sem prejuízo da navegação.
        </p>

        <h3>2.3 Marketing</h3>
        <p>
          Pixels de conversão e retargeting usados em campanhas pagas. Base legal:{' '}
          <strong>consentimento explícito</strong> (LGPD Art. 7 I). Ativados somente após aceite no
          banner de cookies.
        </p>

        <h2>3. Tabela de cookies em uso</h2>
        <div className="not-prose my-6 overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Cookie</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Categoria</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Duração</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Finalidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr><td className="px-4 py-2 font-mono text-xs">zq_session</td><td className="px-4 py-2">Necessário</td><td className="px-4 py-2">Sessão</td><td className="px-4 py-2">Autenticação segura</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">zq_csrf</td><td className="px-4 py-2">Necessário</td><td className="px-4 py-2">Sessão</td><td className="px-4 py-2">Proteção CSRF</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">zq_consent</td><td className="px-4 py-2">Necessário</td><td className="px-4 py-2">12 meses</td><td className="px-4 py-2">Guarda a escolha do banner de cookies</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">zq_analytics</td><td className="px-4 py-2">Analítico</td><td className="px-4 py-2">13 meses</td><td className="px-4 py-2">Uso agregado (IP anonimizado)</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">_fbp / _gcl_*</td><td className="px-4 py-2">Marketing</td><td className="px-4 py-2">≤ 90 dias</td><td className="px-4 py-2">Atribuição de campanhas</td></tr>
            </tbody>
          </table>
        </div>

        <h2>4. Como revogar consentimento</h2>
        <p>
          Você pode revogar analytics e marketing a qualquer momento em{' '}
          <Link href="/configuracoes/privacidade">Configurações &gt; Privacidade</Link>. A revogação é
          aplicada imediatamente e registrada em log imutável ({' '}
          <code>/api/consent/export</code> devolve a trilha completa assinada).
        </p>

        <h2>5. Navegador e &quot;Do Not Track&quot;</h2>
        <p>
          Respeitamos a flag <strong>Do Not Track</strong> do navegador: quando ativada, categorias
          analíticos e marketing são tratadas como <em>opt-out</em> por padrão, independentemente do
          estado do nosso banner.
        </p>

        <h2>6. Contato</h2>
        <p>
          Dúvidas sobre esta política:{' '}
          <a href="mailto:dpo@zappiq.com.br">dpo@zappiq.com.br</a> · SLA 15 dias corridos (LGPD Art. 19).
        </p>
      </article>
    </PublicLayout>
  );
}
