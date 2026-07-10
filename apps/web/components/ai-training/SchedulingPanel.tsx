'use client';

/**
 * SchedulingPanel — aba "Agendamento" do /ai-training.
 *
 * O dono do negócio escolhe se oferece agendamento e, se sim, cadastra os
 * TIPOS que a IA pode marcar (Consulta, Reunião, Visita…) com as regras.
 * A config alimenta o RAG (a IA passa a saber o que pode agendar) e, na Fase 2,
 * é executada por tools + calendário. Tudo gerido na Agenda interna (CRM).
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Loader2, CheckCircle2, MapPin, Video, Phone, Building2, Calendar, Link2, Unlink, HelpCircle, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { GoogleConnectGuide } from './GoogleConnectGuide';
import { SaibaMais } from '../shared/SaibaMais';

type Modality = 'in_person' | 'online' | 'phone' | 'video';
interface BookingField { key: string; label: string; type: 'text' | 'phone' | 'email' | 'select'; required: boolean }
interface AppointmentType {
  id: string;
  name: string;
  icon?: string | null;
  durationMin: number;
  modality: Modality;
  locationText?: string | null;
  availability: { timezone: string; weekly: Record<string, [string, string][]> };
  minNoticeMin: number;
  futureHorizonDays: number;
  requiresConfirmation: boolean;
  bookingFields: BookingField[];
  cancelPolicyText?: string | null;
  active: boolean;
}

const MODALITY_META: Record<Modality, { label: string; icon: typeof Video }> = {
  online: { label: 'Online', icon: Video },
  in_person: { label: 'Presencial', icon: Building2 },
  phone: { label: 'Telefone', icon: Phone },
  video: { label: 'Vídeo', icon: Video },
};
const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Seg' }, { key: 'tue', label: 'Ter' }, { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' }, { key: 'fri', label: 'Sex' }, { key: 'sat', label: 'Sáb' }, { key: 'sun', label: 'Dom' },
];

const BLANK_TYPE = {
  name: '', durationMin: 30, modality: 'online' as Modality, locationText: '',
  availability: { timezone: 'America/Sao_Paulo', weekly: { mon: [['09:00', '18:00']], tue: [['09:00', '18:00']], wed: [['09:00', '18:00']], thu: [['09:00', '18:00']], fri: [['09:00', '18:00']] } as Record<string, [string, string][]> },
  minNoticeMin: 120, futureHorizonDays: 60, requiresConfirmation: false,
  bookingFields: [] as BookingField[], cancelPolicyText: '', active: true,
};

export function SchedulingPanel({ onChange }: { onChange: () => void }) {
  const [optOut, setOptOut] = useState(false);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [entitled, setEntitled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ ...BLANK_TYPE });
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [gcal, setGcal] = useState<{ configured: boolean; connected: boolean; email?: string | null }>({ configured: false, connected: false });
  const [gcalBusy, setGcalBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ optOut: boolean; types: AppointmentType[]; entitled?: boolean }>('/api/ai-training/scheduling');
      setOptOut(data.optOut);
      setTypes(data.types || []);
      setEntitled(data.entitled !== false);
    } catch (err) {
      console.warn('Falha ao carregar agendamento:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGcal = useCallback(async () => {
    try {
      const s = await api.get<{ configured: boolean; connected: boolean; email?: string | null }>('/api/integrations/google/status');
      setGcal(s);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { load(); loadGcal(); }, [load, loadGcal]);

  // Retorno do OAuth (#scheduling?gcal=ok|erro). Recarrega o status e limpa a URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash.includes('gcal=ok')) { loadGcal(); history.replaceState(null, '', window.location.pathname + '#scheduling'); }
    else if (hash.includes('gcal=erro')) { alert('Não foi possível conectar o Google Calendar. Tente novamente.'); history.replaceState(null, '', window.location.pathname + '#scheduling'); }
  }, [loadGcal]);

  const connectGoogle = async () => {
    setGcalBusy(true);
    try {
      const { authUrl } = await api.get<{ authUrl: string }>('/api/integrations/google/connect');
      window.location.href = authUrl; // vai pro consentimento do Google e volta no callback
    } catch (err: any) {
      alert(`Erro ao iniciar conexão: ${err.message}`);
      setGcalBusy(false);
    }
  };
  const disconnectGoogle = async () => {
    if (!confirm('Desconectar a agenda do Google? A IA volta a usar só a agenda interna.')) return;
    setGcalBusy(true);
    try {
      await api.delete('/api/integrations/google');
      await loadGcal();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setGcalBusy(false);
    }
  };

  const toggleOptOut = async (next: boolean) => {
    setOptOut(next);
    try {
      await api.put('/api/ai-training/scheduling', { optOut: next });
      onChange();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
      setOptOut(!next);
    }
  };

  const toggleDay = (key: string) => {
    setDraft((d) => {
      const weekly = { ...d.availability.weekly };
      if (weekly[key]) delete weekly[key];
      else weekly[key] = [['09:00', '18:00']];
      return { ...d, availability: { ...d.availability, weekly } };
    });
  };
  const setDayWindow = (key: string, idx: 0 | 1, value: string) => {
    setDraft((d) => {
      const weekly = { ...d.availability.weekly };
      const win = [...(weekly[key]?.[0] || ['09:00', '18:00'])] as [string, string];
      win[idx] = value;
      weekly[key] = [win];
      return { ...d, availability: { ...d.availability, weekly } };
    });
  };

  const addField = () => setDraft((d) => ({ ...d, bookingFields: [...d.bookingFields, { key: `campo${d.bookingFields.length + 1}`, label: '', type: 'text', required: false }] }));
  const updateField = (i: number, patch: Partial<BookingField>) => setDraft((d) => ({ ...d, bookingFields: d.bookingFields.map((f, idx) => idx === i ? { ...f, ...patch } : f) }));
  const removeField = (i: number) => setDraft((d) => ({ ...d, bookingFields: d.bookingFields.filter((_, idx) => idx !== i) }));

  const saveDraft = async () => {
    if (draft.name.trim().length < 2) return;
    setSaving(true);
    try {
      const payload = {
        ...draft,
        // limpa labels vazios dos campos custom
        bookingFields: draft.bookingFields.filter((f) => f.label.trim()),
        locationText: draft.locationText || undefined,
        cancelPolicyText: draft.cancelPolicyText || undefined,
      };
      await api.post('/api/ai-training/appointment-types', payload);
      setDraft({ ...BLANK_TYPE });
      setCreating(false);
      await load();
      onChange();
    } catch (err: any) {
      alert(`Erro ao salvar o tipo: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeType = async (id: string) => {
    if (!confirm('Remover este tipo de agendamento?')) return;
    try {
      await api.delete(`/api/ai-training/appointment-types/${id}`);
      await load();
      onChange();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-400"><Loader2 size={18} className="animate-spin mr-2" /> Carregando…</div>;
  }

  // Lite sem o add-on: mostra o upsell no lugar da configuração.
  if (!entitled) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-6 text-white">
            <div className="flex items-center gap-2 mb-1"><CalendarClock size={22} /><h3 className="text-lg font-display font-bold">Agendamento pela IA</h3></div>
            <p className="text-sm opacity-90">Deixe a sua IA marcar consultas, reuniões, ligações e visitas direto na conversa com o cliente.</p>
          </div>
          <div className="p-6 space-y-4">
            <ul className="space-y-2">
              {[
                'A IA oferece só horários realmente livres e agenda sozinha.',
                'Agenda interna no seu CRM, com confirmação e status.',
                'Conecte seu Google Calendar: a IA respeita seus compromissos e cria os eventos lá.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle2 size={16} className="text-secondary-600 flex-shrink-0 mt-0.5" /> {t}</li>
              ))}
            </ul>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm text-gray-900"><span className="font-semibold">Incluído a partir do plano Growth.</span> No seu plano, ative como add-on.</p>
                <p className="text-xs text-gray-500 mt-0.5">R$ 49/mês. No plano anual, 20% de desconto (R$ 39,20/mês).</p>
              </div>
              <a href="/billing#addons" className="inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">
                Ativar Agendamento <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletor mestre: opt-out */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="radio" checked={optOut} onChange={() => toggleOptOut(true)} className="mt-1" />
          <div>
            <p className="text-sm font-medium text-gray-900">Não desejo oferecer agendamento</p>
            <p className="text-xs text-gray-500">A IA não marca horários. Você pode ativar quando quiser.</p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="radio" checked={!optOut} onChange={() => toggleOptOut(false)} className="mt-1" />
          <div>
            <p className="text-sm font-medium text-gray-900">Quero que meu agente faça agendamentos</p>
            <p className="text-xs text-gray-500">Cadastre abaixo os tipos que a IA pode marcar com seu cliente.</p>
          </div>
        </label>
        {savedFlash && <span className="text-xs text-secondary-700 flex items-center gap-1"><CheckCircle2 size={13} /> Salvo</span>}
      </div>

      {!optOut && (
        <>
          {/* Conexão com o Google Calendar do cliente (self-service) */}
          {gcal.configured && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${gcal.connected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                <Calendar size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Sua agenda do Google</p>
                {gcal.connected ? (
                  <p className="text-xs text-green-700 truncate">Conectada{gcal.email ? ` (${gcal.email})` : ''}. A IA respeita seus compromissos e cria os eventos aí.</p>
                ) : (
                  <p className="text-xs text-gray-500">
                    Conecte para a IA ver seus horários ocupados e criar os agendamentos direto na sua agenda.{' '}
                    <button type="button" onClick={() => setGuideOpen(true)} className="inline-flex items-center gap-0.5 text-primary-600 hover:text-primary-700 hover:underline font-medium align-baseline">
                      <HelpCircle size={12} /> Saiba como conectar
                    </button>
                  </p>
                )}
              </div>
              {gcal.connected ? (
                <button onClick={disconnectGoogle} disabled={gcalBusy} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg px-3 py-2 disabled:opacity-50">
                  {gcalBusy ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />} Desconectar
                </button>
              ) : (
                <button onClick={connectGoogle} disabled={gcalBusy} className="inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                  {gcalBusy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Conectar Google Calendar
                </button>
              )}
            </div>
          )}

          {/* Lista de tipos */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <CalendarClock size={16} /> Tipos de agendamento
                <SaibaMais featureKey="ai-training.scheduling.tipo-agendamento" />
              </h3>
              <span className="text-xs text-gray-500">{types.length} tipo(s)</span>
            </div>
            {types.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Nenhum tipo ainda. Crie o primeiro abaixo (ex.: Consulta, Reunião, Visita).</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {types.map((t) => {
                  const M = MODALITY_META[t.modality];
                  const days = DAYS.filter((d) => t.availability?.weekly?.[d.key]?.length).map((d) => d.label).join(', ');
                  return (
                    <li key={t.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0"><M.icon size={16} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.icon ? `${t.icon} ` : ''}{t.name}</p>
                        <p className="text-xs text-gray-500">{t.durationMin} min · {M.label}{t.locationText ? ` (${t.locationText})` : ''}{days ? ` · ${days}` : ''}</p>
                      </div>
                      <button onClick={() => removeType(t.id)} className="text-gray-400 hover:text-red-500 p-2" aria-label="Remover"><Trash2 size={16} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Criar novo tipo */}
          {creating ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nome do tipo</label>
                  <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ex.: Consulta" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Duração (min)</label>
                  <input type="number" value={draft.durationMin} min={5} max={1440} onChange={(e) => setDraft((d) => ({ ...d, durationMin: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Modalidade</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['online', 'in_person', 'phone', 'video'] as Modality[]).map((m) => {
                    const M = MODALITY_META[m];
                    return (
                      <button key={m} type="button" onClick={() => setDraft((d) => ({ ...d, modality: m }))} className={`py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1 ${draft.modality === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
                        <M.icon size={13} /> {M.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(draft.modality === 'in_person') && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1"><MapPin size={12} /> Endereço</label>
                  <input value={draft.locationText} onChange={(e) => setDraft((d) => ({ ...d, locationText: e.target.value }))} placeholder="Rua, número, bairro, cidade" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 block mb-2">Dias e horários de atendimento</label>
                <div className="space-y-2">
                  {DAYS.map((d) => {
                    const win = draft.availability.weekly[d.key];
                    const on = Boolean(win);
                    return (
                      <div key={d.key} className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleDay(d.key)} className={`w-12 py-1.5 rounded-lg border text-xs font-medium ${on ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-400'}`}>{d.label}</button>
                        {on && (
                          <>
                            <input type="time" value={win![0][0]} onChange={(e) => setDayWindow(d.key, 0, e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
                            <span className="text-xs text-gray-400">às</span>
                            <input type="time" value={win![0][1]} onChange={(e) => setDayWindow(d.key, 1, e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Antecedência mínima (min)</label>
                  <input type="number" value={draft.minNoticeMin} min={0} onChange={(e) => setDraft((d) => ({ ...d, minNoticeMin: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Agenda até (dias à frente)</label>
                  <input type="number" value={draft.futureHorizonDays} min={1} max={365} onChange={(e) => setDraft((d) => ({ ...d, futureHorizonDays: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={draft.requiresConfirmation} onChange={(e) => setDraft((d) => ({ ...d, requiresConfirmation: e.target.checked }))} />
                Exigir minha confirmação antes de valer
                <SaibaMais featureKey="ai-training.scheduling.confirmacao-manual" />
              </label>

              {/* Campos que o cliente final preenche */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">O que perguntar ao cliente ao agendar</label>
                  <button type="button" onClick={addField} className="text-xs text-primary-600 flex items-center gap-1"><Plus size={12} /> campo</button>
                </div>
                {draft.bookingFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Ex.: Qual convênio?" className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as BookingField['type'] })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                      <option value="text">Texto</option><option value="phone">Telefone</option><option value="email">E-mail</option>
                    </select>
                    <label className="text-xs text-gray-500 flex items-center gap-1"><input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> obrig.</label>
                    <button type="button" onClick={() => removeField(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Política de cancelamento/remarcação (opcional)</label>
                <input value={draft.cancelPolicyText} onChange={(e) => setDraft((d) => ({ ...d, cancelPolicyText: e.target.value }))} placeholder="Ex.: cancele com até 24h de antecedência" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => { setCreating(false); setDraft({ ...BLANK_TYPE }); }} className="text-sm text-gray-600 px-3 py-2">Cancelar</button>
                <button onClick={saveDraft} disabled={saving || draft.name.trim().length < 2} className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Salvar tipo
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="w-full border-2 border-dashed border-gray-300 hover:border-primary-400 rounded-xl p-4 text-sm font-medium text-primary-600 flex items-center justify-center gap-2">
              <Plus size={16} /> Adicionar tipo de agendamento
            </button>
          )}
        </>
      )}

      <GoogleConnectGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
