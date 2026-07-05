'use client';

/**
 * TemplateFormModal — FEATURE 5b.2. Cria/edita um template de WhatsApp.
 *
 * Campos:
 *   - Nome (obrigatório, min 2; a Meta exige snake_case minúsculo)
 *   - Categoria: MARKETING / UTILITY / AUTHENTICATION (categorias da Meta)
 *   - Idioma (default pt_BR)
 *   - Corpo (obrigatório) — usa {{1}}, {{2}}... pros parâmetros da Meta
 *   - Rodapé (opcional)
 *   - isReengagement: marca template usado pra REABRIR a janela de 24h
 *
 * POST /api/templates (criar) | PUT /api/templates/:id (editar).
 * metaStatus/submissão à Meta é feita na listagem (botão "Enviar à Meta").
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

export interface TemplateRecord {
  id: string;
  name: string;
  category: string;
  language: string;
  bodyText: string;
  footerText?: string | null;
  isReengagement?: boolean;
  metaStatus?: string;
}

interface Props {
  open: boolean;
  template?: TemplateRecord | null; // null/undefined = criar
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing', hint: 'Promoções, novidades, ofertas' },
  { value: 'UTILITY', label: 'Utilidade', hint: 'Atualizações de pedido, lembretes, avisos' },
  { value: 'AUTHENTICATION', label: 'Autenticação', hint: 'Códigos de verificação (OTP)' },
];

export function TemplateFormModal({ open, template, onClose, onSaved }: Props) {
  const isEdit = Boolean(template?.id);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('pt_BR');
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [isReengagement, setIsReengagement] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(template?.name ?? '');
      setCategory(template?.category ?? 'MARKETING');
      setLanguage(template?.language ?? 'pt_BR');
      setBodyText(template?.bodyText ?? '');
      setFooterText(template?.footerText ?? '');
      setIsReengagement(Boolean(template?.isReengagement));
      setError(null);
    }
  }, [open, template]);

  if (!open) return null;

  async function handleSubmit() {
    setError(null);
    if (name.trim().length < 2) {
      setError('Nome precisa ter no mínimo 2 caracteres.');
      return;
    }
    if (bodyText.trim().length < 1) {
      setError('O corpo do template não pode ficar vazio.');
      return;
    }
    const payload = {
      name: name.trim(),
      category,
      language: language.trim() || 'pt_BR',
      bodyText: bodyText.trim(),
      footerText: footerText.trim() || undefined,
      isReengagement,
    };
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/api/templates/${template!.id}`, payload);
      } else {
        await api.post('/api/templates', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar template');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Editar template' : 'Novo template'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Templates são aprovados pela Meta e usados em campanhas e fora da janela de 24h.
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nome do template *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: reengajamento_24h"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
            <p className="text-[10px] text-gray-400 mt-1">A Meta recomenda snake_case minúsculo (ex: promo_volta_aulas).</p>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Categoria (Meta)</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${active ? 'text-primary-700' : 'text-gray-900'}`}>
                      {c.label}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{c.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Idioma */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Idioma</label>
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="pt_BR"
              className="w-full max-w-[160px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Corpo */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Corpo da mensagem *</label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={4}
              placeholder={'Oi {{1}}! Faz um tempo que a gente não conversa. Posso te ajudar com algo?'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
            />
            <p className="text-[10px] text-gray-400 mt-1">Use {'{{1}}'}, {'{{2}}'}… para variáveis que a Meta preenche no envio.</p>
          </div>

          {/* Rodapé */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Rodapé (opcional)</label>
            <input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Ex: Responda SAIR para não receber mais mensagens."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Reengajamento 24h */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300">
            <input
              type="checkbox"
              checked={isReengagement}
              onChange={(e) => setIsReengagement(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <RefreshCw size={13} className="text-primary-600" />
                Template de reengajamento (reabre a janela de 24h)
              </span>
              <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">
                Fora da janela de 24h a Meta rejeita mensagem livre. Marque aqui os templates aprovados
                usados pra reabrir a conversa com contatos inativos.
              </span>
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !bodyText.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar template'}
          </button>
        </div>
      </div>
    </div>
  );
}
