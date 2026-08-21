/**
 * Subprocessadores: lista pública dos suboperadores da ZappIQ (LGPD).
 *
 * Criada em 20/08/2026 (plano Resposta Meta 2026, governança e cadastro).
 * Fontes internas: docs/LGPD-ROP.md (Seção D, operadores sub-encarregados),
 * DEPLOY.md e /legal/privacidade seção 4. Toda inclusão, troca ou remoção de
 * subprocessador deve ser registrada na seção "Histórico de alterações"
 * desta página e notificada com 30 dias de antecedência via dpo@zappiq.com.br.
 */

export const metadata = {
  title: 'Subprocessadores | ZappIQ',
  description:
    'Lista pública dos subprocessadores da ZappIQ: quem são, para que servem e onde os dados ficam. Compromisso de notificação com 30 dias de antecedência.',
  alternates: {
    canonical: 'https://zappiq.com.br/legal/subprocessadores',
  },
};

type Subprocessador = {
  nome: string;
  finalidade: string;
  localizacao: string;
};

const SUBPROCESSADORES: Subprocessador[] = [
  {
    nome: 'Anthropic',
    finalidade: 'Modelos de linguagem (API Claude) que geram as respostas da Iza.',
    localizacao: 'Estados Unidos',
  },
  {
    nome: 'OpenAI',
    finalidade: 'Transcrição e síntese de voz das mensagens de áudio (APIs Whisper e TTS).',
    localizacao: 'Estados Unidos',
  },
  {
    nome: 'AWS',
    finalidade: 'Infraestrutura de nuvem onde o banco de dados gerenciado opera e backups cifrados.',
    localizacao: 'Brasil (região sa-east-1, São Paulo)',
  },
  {
    nome: 'Cloudflare',
    finalidade: 'CDN, proteção DDoS e recebimento de webhooks na borda da rede.',
    localizacao: 'Rede global (edge)',
  },
  {
    nome: 'Supabase',
    finalidade: 'Banco de dados PostgreSQL e autenticação da plataforma.',
    localizacao: 'Brasil (AWS sa-east-1, São Paulo)',
  },
  {
    nome: 'Stripe',
    finalidade: 'Processamento de pagamentos e assinaturas (PCI-DSS Level 1).',
    localizacao: 'Estados Unidos',
  },
  {
    nome: 'Resend',
    finalidade: 'Envio de e-mails transacionais (confirmações, avisos e faturas).',
    localizacao: 'Estados Unidos',
  },
  {
    nome: 'Fly.io',
    finalidade: 'Hospedagem da API e dos serviços de backend da plataforma.',
    localizacao: 'Brasil (região GRU, São Paulo)',
  },
  {
    nome: 'Google Cloud',
    finalidade: 'Consultas a bases públicas de empresas (BigQuery, módulo Mira) e integração opcional de agenda (Google Calendar).',
    localizacao: 'Estados Unidos',
  },
  {
    nome: 'Upstash',
    finalidade: 'Cache Redis e filas de processamento (dados efêmeros, sem conteúdo de conversa).',
    localizacao: 'Brasil (região sa-east-1, São Paulo)',
  },
];

export default function SubprocessadoresPage() {
  const lastUpdate = '20 de agosto de 2026';

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-sm sm:prose">
        <div className="mb-8">
          <a href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Voltar ao início
          </a>
        </div>

        <h1>Subprocessadores</h1>
        <p className="text-gray-600 text-sm">Atualizado em {lastUpdate}</p>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 my-6">
          <p className="text-sm">
            Subprocessadores são as empresas que a ZappIQ contrata para operar partes do serviço e
            que, nesse papel, tratam dados pessoais em nome dos nossos clientes (na LGPD, os
            suboperadores). Esta página lista todos os que estão em uso hoje, com a finalidade de
            cada um e onde os dados ficam.
          </p>
        </div>

        <h2>Compromisso de notificação</h2>
        <p>
          Antes de adicionar ou trocar um subprocessador, a ZappIQ notifica os administradores das
          contas com <strong>30 dias de antecedência</strong>, com direito de oposição. Toda
          alteração também é registrada no histórico ao final desta página, com data. Dúvidas e
          objeções: <a href="mailto:dpo@zappiq.com.br">dpo@zappiq.com.br</a> (Encarregado de Dados,
          prazo de resposta de até 15 dias corridos).
        </p>

        <h2>Subprocessadores atuais</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Subprocessador</th>
                <th>Finalidade</th>
                <th>Localização dos dados</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSADORES.map((s) => (
                <tr key={s.nome}>
                  <td><strong>{s.nome}</strong></td>
                  <td>{s.finalidade}</td>
                  <td>{s.localizacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          Os dados primários da plataforma ficam no Brasil (região AWS sa-east-1, São Paulo).
          Transferências internacionais, quando ocorrem (processamento de IA, pagamentos e e-mail),
          seguem cláusulas contratuais e as salvaguardas da LGPD (Art. 33), conforme detalhado na{' '}
          <a href="/legal/privacidade">Política de Privacidade</a> e no{' '}
          <a href="/legal/dpa">DPA</a>.
        </p>

        <h2>Histórico de alterações</h2>
        <ul>
          <li>
            <strong>20/08/2026:</strong> página criada, com a lista completa dos subprocessadores em
            uso nesta data.
          </li>
        </ul>

        <hr className="my-8" />
        <p className="text-xs text-gray-500">
          Esta página complementa a{' '}
          <a href="/legal/privacidade">Política de Privacidade</a> e o{' '}
          <a href="/legal/dpa">Data Processing Agreement (DPA)</a>. Canal do Encarregado de Dados:
          dpo@zappiq.com.br.
        </p>
      </div>
    </div>
  );
}
