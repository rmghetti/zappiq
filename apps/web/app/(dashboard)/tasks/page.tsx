'use client';

/**
 * /tasks — Tarefas / follow-ups da IA (FEATURE 5b.5)
 *
 * A automação (crmAutomationService) já CRIA Tasks quando a IA detecta intenção
 * de compra e outros gatilhos, mas até agora não havia tela pra vê-las — o
 * gancho de ação diária da PME ficava perdido. Esta tela lista as tarefas
 * pendentes (título, contato/deal vinculado, prazo) com botão pra concluir.
 *
 * Backend: GET /api/tasks (filtrável por status) + PUT /api/tasks/:id.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ListChecks, Check, User, Target, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'DONE' | 'CANCELLED';
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  contact: { id: string; name: string; phone: string; avatarUrl?: string } | null;
  deal: { id: string; title: string; stage: string } | null;
}

type StatusFilter = 'PENDING' | 'DONE' | 'ALL';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'PENDING', label: 'Pendentes' },
  { key: 'DONE', label: 'Concluídas' },
  { key: 'ALL', label: 'Todas' },
];

// Prazo humanizado + sinal de atraso. dueDate null → sem prazo.
function formatDue(dueDate: string | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: 'Sem prazo', overdue: false };
  const due = new Date(dueDate);
  const now = new Date();
  const overdue = due.getTime() < now.getTime();
  const label = due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return { label, overdue };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    const qs = filter === 'ALL' ? '' : `?status=${filter}`;
    api.get(`/api/tasks${qs}`)
      .then((res) => setTasks(res.data || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function completeTask(task: Task) {
    setSavingId(task.id);
    try {
      await api.put(`/api/tasks/${task.id}`, { status: 'DONE' });
      // Se estamos na aba Pendentes, some da lista; senão, atualiza in-place.
      if (filter === 'PENDING') {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: 'DONE', completedAt: new Date().toISOString() } : t,
          ),
        );
      }
    } catch {
      // falha silenciosa — recarrega pra ficar consistente com o servidor
      fetchTasks();
    } finally {
      setSavingId(null);
    }
  }

  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <ListChecks className="text-primary-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tarefas</h1>
            <p className="text-sm text-gray-500">
              Follow-ups e ações criadas pela IA a partir das suas conversas.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-5">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        {filter === 'PENDING' && !loading && (
          <span className="ml-2 text-sm text-gray-400">
            {pendingCount} {pendingCount === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
          </span>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-xl">
          <ListChecks className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 font-medium">
            {filter === 'PENDING' ? 'Nenhuma tarefa pendente' : 'Nenhuma tarefa por aqui'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Conforme a IA identifica oportunidades nas conversas, os follow-ups aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((task) => {
            const { label: dueLabel, overdue } = formatDue(task.dueDate);
            const done = task.status === 'DONE';
            return (
              <li
                key={task.id}
                className={`flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl transition-shadow hover:shadow-sm ${
                  done ? 'opacity-60' : ''
                }`}
              >
                {/* Botão concluir */}
                <button
                  onClick={() => !done && completeTask(task)}
                  disabled={done || savingId === task.id}
                  aria-label={done ? 'Tarefa concluída' : 'Concluir tarefa'}
                  className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    done
                      ? 'bg-green-500 border-green-500 text-white cursor-default'
                      : 'border-gray-300 text-transparent hover:border-primary-500 hover:bg-primary-50'
                  }`}
                >
                  {savingId === task.id ? (
                    <Loader2 className="animate-spin text-primary-500" size={14} />
                  ) : (
                    <Check size={15} />
                  )}
                </button>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold text-gray-900 ${done ? 'line-through' : ''}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                  )}

                  {/* Metadados: contato, deal, prazo */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                    {task.contact && (
                      <Link
                        href="/contacts"
                        className="flex items-center gap-1 text-gray-500 hover:text-primary-600"
                      >
                        <User size={13} />
                        {task.contact.name || task.contact.phone}
                      </Link>
                    )}
                    {task.deal && (
                      <Link
                        href="/crm"
                        className="flex items-center gap-1 text-gray-500 hover:text-primary-600"
                      >
                        <Target size={13} />
                        {task.deal.title}
                      </Link>
                    )}
                    <span
                      className={`flex items-center gap-1 ${
                        overdue && !done ? 'text-red-600 font-medium' : 'text-gray-400'
                      }`}
                    >
                      {overdue && !done ? <AlertTriangle size={13} /> : <Clock size={13} />}
                      {dueLabel}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
