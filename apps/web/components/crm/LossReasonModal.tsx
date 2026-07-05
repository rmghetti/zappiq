'use client';

/**
 * LossReasonModal (CRM Onda 3c, PR #220)
 *
 * Abre quando usuário arrasta um deal pra coluna "Perdido". Captura o
 * motivo de perda (enum LossReason no schema) + nota opcional. Envia
 * via PUT /api/deals/:id/stage com body { stage: 'lost', lossReason }.
 *
 * Backend valida enum e persiste em Deal.lossReason — depois aparece
 * no rodapé do /crm (top 3 motivos de perda) e ajuda a entender churn.
 */

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

// Valores IDÊNTICOS ao enum LossReason (schema.prisma / Postgres, UPPERCASE).
const REASONS: Array<{ value: string; label: string; emoji: string }> = [
  { value: 'PRICE', label: 'Preço', emoji: '💸' },
  { value: 'COMPETITOR', label: 'Foi pra concorrente', emoji: '⚔️' },
  { value: 'TIMING', label: 'Timing errado', emoji: '⏰' },
  { value: 'NO_BUDGET', label: 'Sem orçamento', emoji: '💰' },
  { value: 'NO_DECISION', label: 'Não avançou a decisão', emoji: '🤔' },
  { value: 'NO_RESPONSE', label: 'Parou de responder', emoji: '🔕' },
  { value: 'OTHER', label: 'Outro motivo', emoji: '❓' },
];

export interface LossReasonModalProps {
  open: boolean;
  dealTitle: string;
  onCancel: () => void;
  onConfirm: (reason: string, note: string) => void;
}

export function LossReasonModal({ open, dealTitle, onCancel, onConfirm }: LossReasonModalProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (!open) return null;

  function handleConfirm() {
    if (!reason) return;
    onConfirm(reason, note);
    setReason(null);
    setNote('');
  }

  function handleCancel() {
    setReason(null);
    setNote('');
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-red-700" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900">Por que perdemos este deal?</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{dealTitle}</p>
            </div>
          </div>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Lista de motivos */}
        <div className="p-4 space-y-1.5">
          {REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                reason === r.value
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{r.emoji}</span>
              <span className="flex-1 font-medium">{r.label}</span>
              {reason === r.value && (
                <span className="text-xs font-semibold text-red-700">Selecionado</span>
              )}
            </button>
          ))}
        </div>

        {/* Nota opcional */}
        <div className="px-4 pb-4">
          <label className="block text-[10px] font-semibold uppercase text-gray-500 tracking-wide mb-1">
            Detalhes (opcional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="Ex: cliente achou caro o pacote anual, queria mensal mais barato"
            rows={2}
            className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-red-400"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">{note.length}/300</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason}
            className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Marcar como perdido
          </button>
        </div>
      </div>
    </div>
  );
}
