'use client';

/**
 * Agenda interna (hub) — /crm/agenda.
 *
 * Fonte da verdade dos agendamentos. A IA grava aqui (via tools); o dono do
 * negócio gerencia (confirmar, cancelar, no-show, concluir); calendários
 * externos sincronizam com esta agenda. Visão de lista agrupada por dia.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock, Loader2, Check, X, UserX, CheckCheck, ChevronLeft, RefreshCw,
} from 'lucide-react';
import { api } from '../../../../lib/api';

type Status = 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed';
interface Appointment {
  id: string;
  status: Status;
  startAt: string;
  endAt: string;
  modality: string;
  customerName: string;
  customerPhone?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  source: string;
  appointmentType?: { name: string; icon?: string | null } | null;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pending: { label: 'Aguardando', cls: 'bg-amber-50 text-amber-700' },
  confirmed: { label: 'Confirmado', cls: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Concluído', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
  no_show: { label: 'Não compareceu', cls: 'bg-red-50 text-red-700' },
};

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 60);
      const data = await api.get<{ appointments: Appointment[] }>(
        `/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`,
      );
      setAppointments(data.appointments || []);
    } catch (err) {
      console.warn('Falha ao carregar agenda:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: Status) => {
    try {
      await api.patch(`/api/appointments/${id}`, { status });
      setAppointments((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  // Agrupa por dia (ISO date), mantendo ordem cronológica.
  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const day = a.startAt.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(a);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [appointments]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/crm" className="hover:text-gray-600 flex items-center gap-1"><ChevronLeft size={14} /> CRM</Link>
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock size={22} /> Agenda
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tudo o que a sua IA agendar aparece aqui. Confirme, remarque ou registre o comparecimento.
          </p>
        </div>
        <button onClick={load} className="text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400"><Loader2 size={18} className="animate-spin mr-2" /> Carregando…</div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <CalendarClock size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Nenhum agendamento nos próximos 60 dias.</p>
          <p className="text-xs text-gray-400 mt-1">
            Configure os tipos de agendamento em <Link href="/ai-training#scheduling" className="text-primary-600 hover:underline">Treinar IA → Agendamento</Link> para a IA começar a marcar.
          </p>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 capitalize">{fmtDay(day + 'T12:00:00')}</p>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {items.map((a) => {
                const S = STATUS_META[a.status];
                return (
                  <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="text-center flex-shrink-0 w-14">
                      <p className="text-sm font-semibold text-gray-900">{fmtTime(a.startAt)}</p>
                      <p className="text-[11px] text-gray-400">{fmtTime(a.endAt)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {a.appointmentType?.icon ? `${a.appointmentType.icon} ` : ''}
                        {a.appointmentType?.name || 'Agendamento'} · {a.customerName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {a.customerPhone || ''}{a.location ? ` · ${a.location}` : ''}
                        {a.source === 'ai' ? ' · via IA' : a.source === 'external_sync' ? ' · calendário externo' : ''}
                      </p>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${S.cls}`}>{S.label}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {a.status !== 'confirmed' && a.status !== 'completed' && (
                        <button onClick={() => setStatus(a.id, 'confirmed')} title="Confirmar" className="p-1.5 text-gray-400 hover:text-blue-600"><Check size={15} /></button>
                      )}
                      {a.status !== 'completed' && (
                        <button onClick={() => setStatus(a.id, 'completed')} title="Concluir" className="p-1.5 text-gray-400 hover:text-green-600"><CheckCheck size={15} /></button>
                      )}
                      {a.status !== 'no_show' && (
                        <button onClick={() => setStatus(a.id, 'no_show')} title="Não compareceu" className="p-1.5 text-gray-400 hover:text-red-600"><UserX size={15} /></button>
                      )}
                      {a.status !== 'cancelled' && (
                        <button onClick={() => setStatus(a.id, 'cancelled')} title="Cancelar" className="p-1.5 text-gray-400 hover:text-gray-600"><X size={15} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
