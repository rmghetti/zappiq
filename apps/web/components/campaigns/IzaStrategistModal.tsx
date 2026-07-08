'use client';

/**
 * IzaStrategistModal — o wizard "objetivo -> campanha" do Impulso.
 *
 * O dono do negócio descreve o objetivo em linguagem natural; a Iza gera uma
 * campanha completa (segmento, canais, copy na voz de marca, horário, verba e
 * estimativa) chamando POST /api/impulso/draft. Um clique cria a campanha
 * (POST /api/impulso). É o pilar 1 (Iza Estrategista) do add-on Impulso.
 *
 * Gated no backend por requireImpulso(): se a conta não tiver o add-on ativo,
 * a geração retorna 403 e mostramos o aviso de ativação.
 */
import { useState } from 'react';
import { Sparkles, Loader2, X, Check, RefreshCw, AlertCircle, MessageCircle, Clock, Target, TrendingUp, Pencil, Instagram, Lock } from 'lucide-react';
import { api } from '../../lib/api';

interface ImpulsoDraft {
  name: string;
  segmentDescription: string;
  channels: string[];
  copy: { whatsapp?: string; email?: { subject: string; body: string }; sms?: string };
  suggestedSchedule: string;
  budgetPlan: { recommendedContacts?: number; recommendedAdSpendBrl?: number; note?: string };
  estimate: { reachContacts?: number; expectedReplies?: number; expectedSales?: number; estimatedCostBrl?: number };
  autonomyLevelSuggested: number;
  rationale: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Org tem Instagram conectado — libera o canal Instagram (política Meta + plano). */
  hasInstagram: boolean;
}

const GRAD = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0]';

const EXAMPLES = [
  'Reativar quem comprou nos últimos 6 meses e sumiu, com 15% de desconto',
  'Anunciar o lançamento da nova coleção para os clientes VIP',
  'Recuperar carrinhos abandonados da última semana',
];

export function IzaStrategistModal({ open, onClose, onCreated, hasInstagram }: Props) {
  const [objective, setObjective] = useState('');
  const [draft, setDraft] = useState<ImpulsoDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Texto do WhatsApp editável pelo cliente (a Iza sugere; o cliente ajusta e salva).
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  // Instagram só entra se a org tiver o IG conectado (hasInstagram).
  const [igOn, setIgOn] = useState(false);

  if (!open) return null;

  function resetAll() {
    setObjective('');
    setDraft(null);
    setError(null);
    setMsg('');
    setEditing(false);
    setIgOn(false);
  }

  // Canais efetivos: base da Iza sem instagram + whatsapp garantido + instagram se ligado.
  function effectiveChannels(d: ImpulsoDraft): string[] {
    const set = new Set((d.channels || []).filter((c) => c !== 'instagram'));
    set.add('whatsapp');
    if (igOn && hasInstagram) set.add('instagram');
    return Array.from(set);
  }

  function handleClose() {
    if (generating || creating) return;
    resetAll();
    onClose();
  }

  async function generate() {
    setError(null);
    if (objective.trim().length < 4) {
      setError('Descreva o objetivo da campanha em uma frase.');
      return;
    }
    setGenerating(true);
    setDraft(null);
    try {
      const res = await api.post('/api/impulso/draft', { objective: objective.trim() });
      const d = res.data as ImpulsoDraft;
      setDraft(d);
      setMsg(d.copy?.whatsapp || '');
      setEditing(false);
      setIgOn(hasInstagram && (d.channels?.includes('instagram') ?? false));
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('403') || msg.toLowerCase().includes('addon')) {
        setError('O módulo Impulso não está ativo nesta conta. Ative o add-on para usar a Iza Estrategista.');
      } else {
        setError(err?.message || 'Não foi possível gerar a campanha agora. Tente de novo.');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function createCampaign() {
    if (!draft) return;
    setCreating(true);
    setError(null);
    try {
      const channels = effectiveChannels(draft);
      await api.post('/api/impulso', {
        name: draft.name,
        objective: objective.trim(),
        type: 'BROADCAST',
        channels,
        audienceSegment: { description: draft.segmentDescription },
        budgetPlan: draft.budgetPlan,
        autonomyLevel: draft.autonomyLevelSuggested ?? 2,
        // Texto salvo/editado pelo cliente é o que vai de fato ser disparado.
        message: {
          whatsapp: msg,
          ...(channels.includes('instagram') ? { instagram: msg } : {}),
        },
      });
      onCreated();
      resetAll();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar a campanha.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className={`flex items-center justify-center w-9 h-9 rounded-xl text-white ${GRAD}`}>
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Criar com a Iza</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Descreva o objetivo. A Iza monta a campanha pronta pra você aprovar.
              </p>
            </div>
          </div>
          <button onClick={handleClose} disabled={generating || creating} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Objetivo */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Qual o objetivo da campanha?</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ex: reativar quem sumiu há 30 dias com uma oferta de 15%"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A52D0] resize-none"
              autoFocus
            />
            {!draft && !generating && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setObjective(ex)}
                    className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Estado de geração */}
          {generating && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
              <Loader2 size={18} className="animate-spin text-[#4A52D0]" />
              <span className="text-sm text-gray-600">A Iza está montando a campanha…</span>
            </div>
          )}

          {/* Rascunho gerado */}
          {draft && !generating && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className={`px-4 py-2.5 text-white ${GRAD}`}>
                  <div className="text-sm font-semibold">{draft.name}</div>
                  <div className="text-[11px] opacity-90 flex items-center gap-1.5 mt-0.5">
                    <Target size={11} /> {draft.segmentDescription}
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {/* Canais efetivos + horário */}
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveChannels(draft).map((c) => (
                      <span key={c} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#ECEDFA] text-[#3A3FA8] capitalize">
                        {c}
                      </span>
                    ))}
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                      <Clock size={10} /> {draft.suggestedSchedule}
                    </span>
                  </div>

                  {/* Instagram — só habilitado com o IG conectado (política Meta + plano) */}
                  {hasInstagram ? (
                    <button
                      type="button"
                      onClick={() => setIgOn((v) => !v)}
                      className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border w-full ${igOn ? 'border-[#C7B3F0] bg-[#F3EEFC] text-[#7A3FA8]' : 'border-gray-200 bg-white text-gray-600'}`}
                    >
                      <Instagram size={14} />
                      <span className="flex-1 text-left">Enviar também pelo Instagram Direct</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${igOn ? 'bg-[#7A3FA8] text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {igOn ? 'ATIVO' : 'OFF'}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
                      <Lock size={13} className="flex-shrink-0" />
                      <span>Instagram Direct: conecte uma conta Instagram no seu plano para usar este canal.</span>
                    </div>
                  )}

                  {/* Copy WhatsApp — editável pelo cliente */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1"><MessageCircle size={11} /> Mensagem no WhatsApp</span>
                      {!editing && (
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                          className="text-[11px] font-semibold text-[#3A3FA8] hover:underline flex items-center gap-1 normal-case tracking-normal"
                        >
                          <Pencil size={11} /> Editar
                        </button>
                      )}
                    </div>
                    {editing ? (
                      <div className="space-y-2">
                        <textarea
                          value={msg}
                          onChange={(e) => setMsg(e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A52D0] resize-none"
                          autoFocus
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg ${GRAD}`}
                          >
                            <Check size={12} /> Salvar mensagem
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-800 bg-[#E4F3EC] rounded-lg rounded-tl-none p-3 whitespace-pre-wrap">
                        {msg || <span className="text-gray-400 italic">Sem mensagem. Clique em Editar para escrever.</span>}
                      </div>
                    )}
                  </div>

                  {/* Estimativa (Coach) */}
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="Alcance" value={draft.estimate?.reachContacts} />
                    <Metric label="Vendas est." value={draft.estimate?.expectedSales} />
                    <Metric label="Custo est." value={draft.estimate?.estimatedCostBrl} prefix="R$ " />
                  </div>

                  {/* Racional do Coach */}
                  {draft.rationale && (
                    <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                      <TrendingUp size={14} className="text-[#2FB57A] flex-shrink-0 mt-0.5" />
                      <span>{draft.rationale}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
          {!draft ? (
            <button
              onClick={generate}
              disabled={generating || objective.trim().length < 4}
              className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${GRAD}`}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? 'Gerando…' : 'Gerar campanha'}
            </button>
          ) : (
            <>
              <button
                onClick={generate}
                disabled={creating}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
              >
                <RefreshCw size={13} /> Refazer
              </button>
              <button
                onClick={createCampaign}
                disabled={creating || editing || !msg.trim()}
                title={editing ? 'Salve a mensagem antes de criar' : !msg.trim() ? 'Escreva a mensagem antes de criar' : undefined}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${GRAD}`}
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {creating ? 'Criando…' : 'Criar campanha'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, prefix }: { label: string; value?: number; prefix?: string }) {
  return (
    <div className="text-center rounded-lg bg-gray-50 py-2">
      <div className="text-base font-bold text-gray-900 tabular-nums">
        {value != null ? `${prefix ?? ''}${value.toLocaleString('pt-BR')}` : '—'}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
