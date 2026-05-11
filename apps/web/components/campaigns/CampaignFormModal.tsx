'use client';

/**
 * CampaignFormModal — modal pra criar nova campanha de WhatsApp.
 *
 * Campos:
 *   - Nome (obrigatório, min 2 chars)
 *   - Tipo: BROADCAST | TRIGGER | SEQUENCE
 *   - Template (opcional, carrega /api/templates)
 *   - Agendamento (datetime opcional) — se vazio = DRAFT, se preenchido = SCHEDULED
 *
 * POST /api/campaigns. Filtro de audiência (audienceFilter) inicia vazio
 * — versão MVP. Refinamento de público (segments, tags) vira PR futuro.
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, Calendar, Send, Repeat, GitBranch } from 'lucide-react';
import { api } from '../../lib/api';

interface Template {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const CAMPAIGN_TYPES = [
  {
    value: 'BROADCAST',
    label: 'Broadcast',
    description: 'Disparo único pra lista de contatos',
    icon: Send,
  },
  {
    value: 'TRIGGER',
    label: 'Trigger',
    description: 'Disparado por evento (ex: novo lead, abandono)',
    icon: Repeat,
  },
  {
    value: 'SEQUENCE',
    label: 'Sequência',
    description: 'Série de mensagens com intervalos definidos',
    icon: GitBranch,
  },
];

export function CampaignFormModal({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'BROADCAST' | 'TRIGGER' | 'SEQUENCE'>('BROADCAST');
  const [templateId, setTemplateId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setType('BROADCAST');
      setTemplateId('');
      setScheduledAt('');
      setError(null);
      setLoadingTemplates(true);
      api.get('/api/templates')
        .then((res) => setTemplates(res.data || []))
        .catch(() => setTemplates([]))
        .finally(() => setLoadingTemplates(false));
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit() {
    setError(null);
    if (name.trim().length < 2) {
      setError('Nome precisa ter no mínimo 2 caracteres.');
      return;
    }
    const payload: any = {
      name: name.trim(),
      type,
      audienceFilter: {},
    };
    if (templateId) payload.templateId = templateId;
    if (scheduledAt) {
      // Converte datetime-local pra ISO 8601
      payload.scheduledAt = new Date(scheduledAt).toISOString();
    }
    setSubmitting(true);
    try {
      await api.post('/api/campaigns', payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar campanha');
    } finally {
      setSubmitting(false);
    }
  }

  // Min datetime = agora (pra não permitir agendar no passado)
  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Nova campanha</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure um disparo de WhatsApp em massa ou automatizado.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Nome da campanha *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Promoção Volta às Aulas — Set/2025"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Tipo de campanha
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CAMPAIGN_TYPES.map((t) => {
                const Icon = t.icon;
                const active = type === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value as any)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={16} className={active ? 'text-primary-600' : 'text-gray-500'} />
                    <div className={`text-sm font-semibold mt-1 ${active ? 'text-primary-700' : 'text-gray-900'}`}>
                      {t.label}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Template aprovado (opcional)
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loadingTemplates}
            >
              <option value="">— Sem template (mensagem livre) —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {loadingTemplates && (
              <p className="text-[10px] text-gray-400 mt-1">Carregando templates...</p>
            )}
            {!loadingTemplates && templates.length === 0 && (
              <p className="text-[10px] text-gray-400 mt-1">
                Nenhum template cadastrado. Você pode prosseguir sem template.
              </p>
            )}
          </div>

          {/* Agendamento */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              <Calendar size={12} className="inline mr-1" />
              Agendar disparo (opcional)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minDateTime}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Vazio = salva como rascunho (DRAFT). Preenchido = SCHEDULED pra disparo automático.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {submitting ? 'Criando...' : scheduledAt ? 'Agendar campanha' : 'Salvar como rascunho'}
          </button>
        </div>
      </div>
    </div>
  );
}
