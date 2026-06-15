'use client';
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types — espelha WebhookToolConfig do backend (apps/api/src/agents/webhookTool.ts)
// ---------------------------------------------------------------------------
export interface WebhookTool {
  type: 'webhook';
  name?: string;
  description?: string;
  url?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Styles (igual ao inputCls de NodeProperties + AskNodeFields)
// ---------------------------------------------------------------------------
const inputCls =
  'w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';

// ---------------------------------------------------------------------------
// AiToolsFields
// ---------------------------------------------------------------------------
export function AiToolsFields({
  tools,
  onChange,
}: {
  tools: WebhookTool[] | undefined;
  onChange: (patch: { tools: WebhookTool[] | undefined }) => void;
}) {
  const tool: WebhookTool | undefined = Array.isArray(tools)
    ? tools.find((t) => t?.type === 'webhook')
    : undefined;

  const enabled = !!tool;

  // Toggle — ligar cria um webhook vazio, desligar remove tudo
  function handleToggle(on: boolean) {
    if (on) {
      onChange({
        tools: [
          { type: 'webhook', name: '', description: '', url: '', method: 'POST', headers: {} },
        ],
      });
    } else {
      onChange({ tools: undefined });
    }
  }

  // Atualiza campo direto do tool
  function setTool(patch: Partial<WebhookTool>) {
    onChange({ tools: [{ type: 'webhook', ...tool, ...patch }] });
  }

  // ── Helpers para edição de headers (lista de pares chave/valor) ──────────
  const headerEntries: [string, string][] = tool?.headers
    ? Object.entries(tool.headers)
    : [];

  function addHeader() {
    const next: Record<string, string> = { ...(tool?.headers ?? {}) };
    next[''] = '';
    setTool({ headers: next });
  }

  function updateHeader(idx: number, key: string, value: string) {
    const entries = Object.entries(tool?.headers ?? {});
    entries[idx] = [key, value];
    // Rebuild — garante ordem e evita chaves duplicadas do mesmo índice
    const next: Record<string, string> = {};
    for (const [k, v] of entries) next[k] = v;
    setTool({ headers: next });
  }

  function removeHeader(idx: number) {
    const entries = Object.entries(tool?.headers ?? {});
    entries.splice(idx, 1);
    const next: Record<string, string> = {};
    for (const [k, v] of entries) next[k] = v;
    setTool({ headers: next });
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Toggle principal */}
      <label className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          className="accent-primary-500"
        />
        <span className="font-medium">Usar uma ferramenta (webhook)</span>
      </label>
      <p className="text-[10px] text-gray-400 mt-0.5 ml-5">
        A IA pode chamar um endpoint externo durante a conversa.
      </p>

      {/* Campos do webhook — aparecem somente quando ativo */}
      {enabled && tool && (
        <div className="mt-3 space-y-2.5 pl-2 border-l-2 border-indigo-100">
          {/* Nome */}
          <div>
            <label className="text-[10px] text-gray-500">
              Nome da ferramenta{' '}
              <span className="text-gray-400">(letras, números, _; o LLM usa esse nome)</span>
            </label>
            <input
              className={inputCls}
              value={tool.name ?? ''}
              onChange={(e) =>
                setTool({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })
              }
              placeholder="ex: consultar_estoque"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[10px] text-gray-500">
              Descrição{' '}
              <span className="text-gray-400">(o que faz e quando usar; vai pro LLM decidir)</span>
            </label>
            <textarea
              className={inputCls}
              rows={2}
              value={tool.description ?? ''}
              onChange={(e) => setTool({ description: e.target.value })}
              placeholder="Consulta o estoque de um produto pelo SKU e retorna a quantidade disponível."
            />
          </div>

          {/* URL */}
          <div>
            <label className="text-[10px] text-gray-500">URL</label>
            <input
              className={inputCls}
              value={tool.url ?? ''}
              onChange={(e) => setTool({ url: e.target.value })}
              placeholder="https://api.meusite.com/webhook"
            />
          </div>

          {/* Método */}
          <div>
            <label className="text-[10px] text-gray-500">Método HTTP</label>
            <select
              className={inputCls}
              value={tool.method ?? 'POST'}
              onChange={(e) => setTool({ method: e.target.value as 'GET' | 'POST' })}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-gray-500">Headers (opcional)</label>
              <button
                type="button"
                onClick={addHeader}
                className="flex items-center gap-0.5 text-[10px] text-indigo-600 hover:text-indigo-800"
              >
                <Plus size={10} />
                Adicionar
              </button>
            </div>
            {headerEntries.length === 0 && (
              <p className="text-[10px] text-gray-400">Nenhum header configurado.</p>
            )}
            {headerEntries.map(([k, v], idx) => (
              <div key={idx} className="flex items-center gap-1 mb-1">
                <input
                  className={`${inputCls} flex-1`}
                  value={k}
                  onChange={(e) => updateHeader(idx, e.target.value, v)}
                  placeholder="Chave"
                />
                <input
                  className={`${inputCls} flex-1`}
                  value={v}
                  onChange={(e) => updateHeader(idx, k, e.target.value)}
                  placeholder="Valor"
                />
                <button
                  type="button"
                  onClick={() => removeHeader(idx)}
                  className="p-1 text-gray-400 hover:text-red-500 shrink-0"
                  title="Remover header"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Aviso de segurança */}
          <div className="flex items-start gap-1.5 p-2 rounded bg-amber-50 border border-amber-200">
            <span className="text-amber-500 text-xs leading-none mt-0.5">⚠</span>
            <p className="text-[10px] text-amber-700 leading-snug">
              A configuração (URL/headers) fica salva com o fluxo. Use um token de webhook
              dedicado, não um segredo mestre.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
