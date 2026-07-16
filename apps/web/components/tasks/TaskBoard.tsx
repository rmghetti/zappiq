'use client';

/**
 * Quadro Kanban do Tarefas — estilo Planner.
 *
 * Colunas espelham TASK_BOARD_COLUMNS (apps/api/src/routes/tasks.util.ts):
 * PENDING / IN_PROGRESS / DONE. CANCELLED fica DE FORA do quadro de propósito
 * (coluna de canceladas só cresce e empurra o trabalho real pra fora da tela;
 * continua alcançável pelo filtro "Todas" da lista). Se o enum de status mudar
 * um dia, os dois lados precisam mudar juntos — não há como importar a const
 * do apps/api dentro do apps/web (pacotes separados no monorepo).
 *
 * MOVER TEM DUAS FORMAS DE PROPÓSITO: arraste-e-solte (HTML5 nativo, sem
 * biblioteca) E um seletor por card. Drag-and-drop sozinho excluiria quem usa
 * touch/teclado/leitor de tela — o seletor sempre funciona, é o caminho
 * garantido; o arraste é só o atalho de quem já usa mouse.
 */

import { useState } from 'react';
import { Loader2, Calendar, User, Tag as TagIcon, Radar, Megaphone, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import type { Task } from './TaskPanel';

const COLUMNS = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;
type ColumnStatus = (typeof COLUMNS)[number];

const COLUMN_LABEL: Record<ColumnStatus, string> = {
  PENDING: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
};

function formatDue(dueDate: string | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: '', overdue: false };
  const due = new Date(dueDate);
  return {
    label: due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    overdue: due.getTime() < Date.now(),
  };
}

interface Props {
  tasks: Task[];
  /** Chamado depois de mover um card (arraste ou seletor) pro pai refazer a busca. */
  onMoved: () => void;
  onOpenTask: (task: Task) => void;
  onCreateInColumn: (status: ColumnStatus) => void;
}

export function TaskBoard({ tasks, onMoved, onOpenTask, onCreateInColumn }: Props) {
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnStatus | null>(null);

  async function moveTo(taskId: string, status: ColumnStatus) {
    setMovingId(taskId);
    try {
      await api.put(`/api/tasks/${taskId}`, { status });
      onMoved();
    } finally {
      setMovingId(null);
    }
  }

  const byColumn: Record<ColumnStatus, Task[]> = { PENDING: [], IN_PROGRESS: [], DONE: [] };
  for (const t of tasks) {
    if (t.status === 'PENDING' || t.status === 'IN_PROGRESS' || t.status === 'DONE') {
      byColumn[t.status].push(t);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => (
        <div
          key={col}
          onDragOver={(e) => { e.preventDefault(); setDragOverCol(col); }}
          onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverCol(null);
            const taskId = e.dataTransfer.getData('text/plain');
            const dragged = tasks.find((t) => t.id === taskId);
            if (taskId && dragged && dragged.status !== col) moveTo(taskId, col);
          }}
          className={`rounded-xl border-2 border-dashed p-3 min-h-[200px] transition-colors ${
            dragOverCol === col ? 'border-primary-400 bg-primary-50/40' : 'border-transparent bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-gray-700">
              {COLUMN_LABEL[col]} <span className="font-normal text-gray-400">({byColumn[col].length})</span>
            </h3>
            <button
              onClick={() => onCreateInColumn(col)}
              aria-label={`Nova tarefa em ${COLUMN_LABEL[col]}`}
              className="p-1 text-gray-400 hover:text-primary-600 rounded"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {byColumn[col].length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Nenhuma tarefa aqui.</p>
            )}
            {byColumn[col].map((task) => {
              const { label: dueLabel, overdue } = formatDue(task.dueDate);
              const outras = COLUMNS.filter((c) => c !== col);
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                  onClick={() => onOpenTask(task)}
                  className={`bg-white border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow ${
                    movingId === task.id ? 'opacity-50' : ''
                  }`}
                >
                  <p className="text-xs font-semibold text-gray-900 flex items-start gap-1">
                    <span className="flex-1">{task.title}</span>
                    {task.origem === 'MIRA' && <Radar size={11} className="text-[#2F7FB5] shrink-0 mt-0.5" />}
                    {task.origem === 'IMPULSO' && <Megaphone size={11} className="text-amber-600 shrink-0 mt-0.5" />}
                  </p>

                  {task.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {task.tags.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                          style={{ backgroundColor: `${t.color}1a`, color: t.color }}
                        >
                          <TagIcon size={8} />{t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 min-w-0">
                      {task.assignedTo && (
                        <span className="flex items-center gap-0.5 truncate">
                          <User size={10} />{task.assignedTo.name}
                        </span>
                      )}
                      {dueLabel && (
                        <span className={`flex items-center gap-0.5 shrink-0 ${overdue && col !== 'DONE' ? 'text-red-600 font-medium' : ''}`}>
                          <Calendar size={10} />{dueLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Caminho garantido de mover — funciona sem mouse/drag. */}
                  <select
                    aria-label={`Mover "${task.title}" para outra coluna`}
                    value=""
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      if (e.target.value) moveTo(task.id, e.target.value as ColumnStatus);
                    }}
                    disabled={movingId === task.id}
                    className="mt-2 w-full text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-500"
                  >
                    <option value="">
                      {movingId === task.id ? 'Movendo…' : 'Mover para...'}
                    </option>
                    {outras.map((c) => (
                      <option key={c} value={c}>{COLUMN_LABEL[c]}</option>
                    ))}
                  </select>
                  {movingId === task.id && (
                    <div className="flex justify-center mt-1">
                      <Loader2 className="animate-spin text-gray-300" size={12} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
