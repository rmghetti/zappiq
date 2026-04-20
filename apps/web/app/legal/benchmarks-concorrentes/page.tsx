import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../../components/landing/PublicLayout';
import { COMPETITOR_BENCHMARKS } from '../../../content/competitor-benchmarks';

export const metadata: Metadata = {
  title: 'Metodologia de Benchmarks Concorrentes — ZappIQ',
  description:
    'Metodologia pública dos benchmarks entre ZappIQ e concorrentes. Fonte, data de captura, status de verificação e política de atualização.',
};

/* V2-010 · V2-050: transparência metodológica dos comparativos
 * ZappIQ × concorrentes. Evita alegações de publicidade comparativa
 * enganosa (CDC Art. 37) e reforça credibilidade. */

export default function BenchmarksPage() {
  return (
    <PublicLayout>
      <article className="prose prose-lg mx-auto max-w-4xl px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider">Conformidade</p>
        <h1 className="font-display text-4xl font-extrabold text-gray-900">
          Metodologia de Benchmarks Concorrentes
        </h1>
        <p className="text-gray-500">Última atualização: 18/04/2026 · Versão 1.0</p>

        <h2>1. Princípio editorial</h2>
        <p>
          Em páginas comparativas como <Link href="/comparativo">/comparativo</Link> e nas landing pages
          verticais, a ZappIQ apresenta benchmarks de preço, cobertura funcional e condições
          contratuais frente a concorrentes. Esta página torna público o método usado para coletar,
          verificar e atualizar cada comparação, em conformidade com o Art. 37 do Código de Defesa do
          Consumidor (vedação de publicidade enganosa) e com as boas práticas de publicidade
          comparativa (CONAR).
        </p>

        <h2>2. Fontes permitidas</h2>
        <ul>
          <li>Tabela pública de preços divulgada pelo concorrente no seu próprio site</li>
          <li>Proposta comercial recebida por cliente ZappIQ (com consentimento explícito para citação anônima)</li>
          <li>Documentação técnica pública do concorrente (API docs, changelog, white papers)</li>
          <li>Relatórios de analistas independentes (Gartner, G2, Capterra) com citação da edição</li>
        </ul>

        <h2>3. Fontes vedadas</h2>
        <ul>
          <li>Screenshots sem URL completa e data</li>
          <li>Relatos em redes sociais não verificáveis</li>
          <li>Informações obtidas sob NDA</li>
          <li>Dados de pesquisa própria sem registro metodológico reprodutível</li>
        </ul>

        <h2>4. Registro público</h2>
        <p>
          Cada linha da tabela comparativa corresponde a uma entrada no nosso registro interno, também
          auditado publicamente nesta página. Listamos abaixo os benchmarks ativos, status de
          verificação e link para evidência (quando autorizada pelo cliente que nos forneceu a
          proposta).
        </p>

        <div className="not-prose my-8 overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Concorrente</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Métrica</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Valor</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Captura</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {COMPETITOR_BENCHMARKS.map((b) => (
                <tr key={`${b.competitor}-${b.feature}`}>
                  <td className="px-4 py-3 font-semibold">{b.competitor}</td>
                  <td className="px-4 py-3">{b.feature}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.deltaSummary}</td>
                  <td className="px-4 py-3 text-gray-500">{b.capturedAt ?? '—'}</td>
                  <td className="px-4 py-3">
                    {b.verifiedBy ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 text-xs font-medium">
                        verificado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 text-xs font-medium">
                        em verificação
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>5. Atualização e erratas</h2>
        <p>
          Concorrentes podem atualizar tabelas e políticas. Revalidamos cada benchmark a cada 60 dias
          ou quando recebemos comunicação formal do concorrente apontando erro. Erratas são
          comunicadas por:
        </p>
        <ul>
          <li>Atualização imediata desta página</li>
          <li>Changelog em <Link href="/legal/benchmarks-concorrentes/changelog">/legal/benchmarks-concorrentes/changelog</Link> (em construção)</li>
          <li>Notificação por email aos clientes ativos se a alteração afetar comparação material</li>
        </ul>

        <h2>6. Direito de resposta</h2>
        <p>
          Qualquer concorrente citado nesta página pode enviar pedido de correção por e-mail a{' '}
          <a href="mailto:juridico@zappiq.com.br">juridico@zappiq.com.br</a>. Analisaremos em até 5 dias
          úteis e publicaremos correção ou resposta fundamentada conforme autorregulação CONAR.
        </p>
      </article>
    </PublicLayout>
  );
}
