/**
 * /legal/deletar-dados — Endpoint público DSR LGPD Art. 18
 *
 * Criado pro D-Day Onda 1 (14/05/2026). A Política de Privacidade V3.2 referencia
 * esta URL como canal de autoatendimento para direitos do titular. Sem esta página,
 * a Política de Privacidade fica apontando pra 404 — gate obrigatório de compliance.
 *
 * Backend: POST /api/dsr/request (a ser implementado pelo dev lead antes do 14/05).
 * Se a rota ainda não existir em produção, o fallback no onSubmit aciona mailto
 * pra privacidade@zappiq.com.br com os dados pré-preenchidos no corpo do e-mail.
 *
 * Evidência de aprovação: ZappIQ_V32_Actions/sprint_1_pricing_garantia_cloud_api/PRIVACY_V32_APROVADA_JURIDICO.md
 */

'use client';

import { useState, type FormEvent } from 'react';

type RequestType =
  | 'EXCLUSAO'
  | 'ACESSO'
  | 'CORRECAO'
  | 'ANONIMIZACAO'
  | 'PORTABILIDADE'
  | 'REVOGACAO_CONSENTIMENTO';

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  EXCLUSAO: 'Exclusão de dados (Art. 18, VI)',
  ACESSO: 'Acesso aos dados (Art. 18, I e II)',
  CORRECAO: 'Correção de dados incompletos, inexatos ou desatualizados (Art. 18, III)',
  ANONIMIZACAO: 'Anonimização, bloqueio ou eliminação de dados desnecessários (Art. 18, IV)',
  PORTABILIDADE: 'Portabilidade de dados (Art. 18, V)',
  REVOGACAO_CONSENTIMENTO: 'Revogação de consentimento (Art. 18, IX)',
};

export default function DeletarDadosPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [protocolo, setProtocolo] = useState<string>('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      tipo: data.get('tipo') as RequestType,
      nomeCompleto: (data.get('nomeCompleto') as string).trim(),
      email: (data.get('email') as string).trim(),
      documento: (data.get('documento') as string).trim(),
      telefone: ((data.get('telefone') as string) || '').trim(),
      vinculo: data.get('vinculo') as string,
      detalhes: ((data.get('detalhes') as string) || '').trim(),
      confirmaIdentidade: data.get('confirmaIdentidade') === 'on',
    };

    if (!payload.confirmaIdentidade) {
      setStatus('error');
      setErrorMsg('Você precisa confirmar que é o titular dos dados ou representante legal.');
      return;
    }

    try {
      const res = await fetch('/api/dsr/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { protocolo?: string };
      setProtocolo(json.protocolo || '—');
      setStatus('success');
      form.reset();
    } catch (err) {
      // Fallback: abrir mailto pré-preenchido pro DPO
      const assunto = `Direitos LGPD — ${REQUEST_TYPE_LABELS[payload.tipo] || payload.tipo}`;
      const corpo = [
        `Tipo de solicitação: ${REQUEST_TYPE_LABELS[payload.tipo] || payload.tipo}`,
        `Nome completo: ${payload.nomeCompleto}`,
        `E-mail: ${payload.email}`,
        `CPF/CNPJ: ${payload.documento}`,
        payload.telefone ? `Telefone: ${payload.telefone}` : '',
        `Vínculo com a ZappIQ: ${payload.vinculo}`,
        '',
        'Detalhes adicionais:',
        payload.detalhes || '(não fornecido)',
        '',
        '---',
        'Confirmo que sou o titular dos dados ou representante legal autorizado.',
        `Data: ${new Date().toISOString()}`,
      ]
        .filter(Boolean)
        .join('\n');

      const mailto = `mailto:privacidade@zappiq.com.br?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
      window.location.href = mailto;

      setStatus('error');
      setErrorMsg(
        'Não conseguimos registrar a solicitação automaticamente. Abrimos seu cliente de e-mail como alternativa. Se não abrir, envie o pedido diretamente para privacidade@zappiq.com.br.',
      );
    }
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <a
            href="/legal/privacidade"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Política de Privacidade
          </a>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Exercer direitos sobre seus dados pessoais
        </h1>
        <p className="text-gray-600 mb-6">
          LGPD Art. 18. Preencha o formulário abaixo para solicitar acesso, correção, exclusão,
          anonimização, portabilidade ou revogação de consentimento.
        </p>

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-8">
          <p className="text-sm text-blue-900 mb-2">
            <strong>Prazo de resposta:</strong> até 48 horas úteis para exclusão imediata via
            autoatendimento; até 15 dias corridos para demais solicitações (prazo ANPD).
          </p>
          <p className="text-sm text-blue-900 m-0">
            <strong>Importante:</strong> para end-users de Clientes ZappIQ (pessoas que conversam
            via WhatsApp com agentes de nossos clientes), a responsabilidade primária de atender o
            direito é do <em>Cliente controlador</em>. A ZappIQ encaminha a solicitação ao
            Cliente e acompanha o atendimento.
          </p>
        </div>

        {status === 'success' ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-6">
            <h2 className="text-xl font-semibold text-green-900 mb-2">Solicitação recebida</h2>
            <p className="text-sm text-green-900 mb-2">
              Protocolo: <code className="font-mono font-bold">{protocolo}</code>
            </p>
            <p className="text-sm text-green-900 mb-0">
              Você receberá uma confirmação no e-mail informado. Guarde o protocolo para
              acompanhamento. Em caso de urgência ou dúvida, escreva para{' '}
              <a
                href="mailto:privacidade@zappiq.com.br"
                className="underline font-medium"
              >
                privacidade@zappiq.com.br
              </a>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de solicitação <span className="text-red-600">*</span>
              </label>
              <select
                id="tipo"
                name="tipo"
                required
                defaultValue="EXCLUSAO"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
              >
                {(Object.keys(REQUEST_TYPE_LABELS) as RequestType[]).map((k) => (
                  <option key={k} value={k}>
                    {REQUEST_TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="nomeCompleto"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nome completo <span className="text-red-600">*</span>
              </label>
              <input
                id="nomeCompleto"
                name="nomeCompleto"
                type="text"
                required
                maxLength={200}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail <span className="text-red-600">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={200}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
              <p className="text-xs text-gray-500 mt-1">
                Usaremos este e-mail para confirmar sua identidade e comunicar a resposta.
              </p>
            </div>

            <div>
              <label htmlFor="documento" className="block text-sm font-medium text-gray-700 mb-1">
                CPF ou CNPJ <span className="text-red-600">*</span>
              </label>
              <input
                id="documento"
                name="documento"
                type="text"
                required
                maxLength={20}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-1">
                Telefone (opcional)
              </label>
              <input
                id="telefone"
                name="telefone"
                type="tel"
                maxLength={20}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="vinculo" className="block text-sm font-medium text-gray-700 mb-1">
                Qual é o seu vínculo com a ZappIQ? <span className="text-red-600">*</span>
              </label>
              <select
                id="vinculo"
                name="vinculo"
                required
                defaultValue="CLIENTE"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
              >
                <option value="CLIENTE">Cliente ZappIQ (contratei a plataforma)</option>
                <option value="EX_CLIENTE">Ex-cliente ZappIQ</option>
                <option value="END_USER">
                  End-user (conversei via WhatsApp com um cliente ZappIQ)
                </option>
                <option value="LEAD">Apenas preenchi formulário/trial no site</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>

            <div>
              <label htmlFor="detalhes" className="block text-sm font-medium text-gray-700 mb-1">
                Detalhes da solicitação (opcional)
              </label>
              <textarea
                id="detalhes"
                name="detalhes"
                rows={4}
                maxLength={2000}
                placeholder="Descreva sua solicitação. Se for sobre conversa específica via WhatsApp, informe o nome do Cliente ZappIQ e a data aproximada."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                id="confirmaIdentidade"
                name="confirmaIdentidade"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="confirmaIdentidade" className="text-sm text-gray-700">
                Declaro, sob as penas da lei, que sou o titular dos dados pessoais indicados ou
                representante legalmente autorizado. Estou ciente de que a ZappIQ poderá solicitar
                comprovação adicional de identidade antes de atender a solicitação, conforme LGPD
                Art. 18, § 7º. <span className="text-red-600">*</span>
              </label>
            </div>

            {errorMsg && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? 'Enviando...' : 'Enviar solicitação'}
            </button>

            <p className="text-xs text-gray-500">
              Ao enviar, a ZappIQ registra sua solicitação no sistema interno de tratamento de
              direitos do titular. Para acompanhamento, use o protocolo que será gerado.
              Divergências não resolvidas podem ser comunicadas à ANPD.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
