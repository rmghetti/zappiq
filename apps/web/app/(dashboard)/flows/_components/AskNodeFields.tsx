'use client';
import React from 'react';

export interface AskData {
  question?: string;
  varName?: string;
  crmField?: string;
  validation?: { type: 'text' | 'number' | 'email' | 'phone'; errorMessage: string; maxRetries: number };
}

const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';
const CRM_FIELDS = ['', 'name', 'email', 'company', 'funnelStage', 'leadScore'];

export function AskNodeFields({ data, onChange }: { data: AskData; onChange: (patch: Partial<AskData>) => void }) {
  const v = data.validation;
  const setValidationEnabled = (on: boolean) =>
    onChange({ validation: on ? { type: 'text', errorMessage: 'Resposta inválida, tente de novo.', maxRetries: 2 } : undefined });
  return (
    <div className="space-y-2">
      <div>
        <label className="text-[10px] text-gray-500">Pergunta (suporta {'{{var}}'})</label>
        <textarea className={inputCls} rows={2} value={data.question ?? ''}
          onChange={(e) => onChange({ question: e.target.value })} placeholder="Qual seu nome?" />
      </div>
      <div>
        <label className="text-[10px] text-gray-500">Salvar resposta na variável</label>
        <input className={inputCls} value={data.varName ?? ''}
          onChange={(e) => onChange({ varName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="nome" />
      </div>
      <div>
        <label className="text-[10px] text-gray-500">Gravar também no campo do lead (CRM)</label>
        <select className={inputCls} value={data.crmField ?? ''} onChange={(e) => onChange({ crmField: e.target.value || undefined })}>
          {CRM_FIELDS.map((f) => <option key={f} value={f}>{f === '' ? '— não gravar —' : f}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-gray-600">
        <input type="checkbox" checked={!!v} onChange={(e) => setValidationEnabled(e.target.checked)} />
        Validar a resposta
      </label>
      {v && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-100">
          <div>
            <label className="text-[10px] text-gray-500">Tipo</label>
            <select className={inputCls} value={v.type}
              onChange={(e) => onChange({ validation: { ...v, type: e.target.value as NonNullable<AskData['validation']>['type'] } })}>
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Mensagem se inválido</label>
            <input className={inputCls} value={v.errorMessage}
              onChange={(e) => onChange({ validation: { ...v, errorMessage: e.target.value } })} />
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Tentativas extras (maxRetries)</label>
            <input type="number" min={0} max={5} className={inputCls} value={v.maxRetries}
              onChange={(e) => onChange({ validation: { ...v, maxRetries: Math.max(0, Number(e.target.value) || 0) } })} />
          </div>
          <p className="text-[10px] text-gray-400">Esgotando as tentativas, o fluxo segue pela aresta "else" (ou encerra se não houver).</p>
        </div>
      )}
    </div>
  );
}
