'use client';

/**
 * /tasks — Tarefas
 *
 * Era um MURAL DE RECADOS: a IA criava a tarefa por dentro (automação das
 * Conversas, Mira) e a tela só listava e concluía. Não dava pra criar, editar,
 * anotar, dar prazo, atribuir a alguém nem etiquetar — e `assignedToId` era
 * coluna morta, então toda tarefa nascia sem dono.
 *
 * Agora: criar/editar pelo painel "Ver tarefa" (prazo, observação, responsável,
 * etiquetas) e filtro por situação, etiqueta e responsável.
 *
 * Backend: GET/POST /api/tasks · GET/PUT /api/tasks/:id · /api/tasks/tags.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ListChecks, Check, User, Target, Clock, AlertTriangle, Loader2, Radar,
  Plus, Tag as TagIcon, PanelRightOpen, Rows3, Columns3,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { TaskPanel, type Task, type TaskTag } from '@/components/tasks/TaskPanel';
import { TaskBoard } from '@/components/tasks/TaskBoard';

type StatusFilter = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'ALL';
type AssigneeFilter = 'ALL' | 'me' | 'none';
type ViewMode = 'lista' | 'quadro';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'PENDING', label: 'A fazer' },
  { key: 'IN_PROGRESS', label: 'Em andamento' },
  { key: 'DONE', label: 'Concluídas' },
  { key: 'ALL', label: 'Todas' },
];

const ASSIGNEES: { key: AssigneeFilter; label: string }[] = [
  { key: 'ALL', label: 'Todo mundo' },
  { key: 'me', label: 'Minhas' },
  { key: 'none', label: 'Sem responsável' },
];

// Prazo humanizado + sinal de atraso. dueDate null → sem prazo.
function formatDue(dueDate: string | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: 'Sem prazo', overdue: false };
  const due = new Date(dueDate);
  const overdue = due.getTime() < Date.now();
  const label = due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return { label, overdue };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('ALL');
  const [savingId, setSavingId] = useState<string | null>(null);
  // Quadro agrupa por status nas 3 colunas de propósito — o pill de situação
  // da Lista não se aplica lá (ver comentário no TaskBoard sobre CANCELLED).
  const [view, setView] = useState<ViewMode>('lista');

  const [panelTask, setPanelTask] = useState<Task | null>(null);
  const [panelMode, setPanelMode] = useState<'view' | 'create' | null>(null);
  // Pré-seleciona a coluna ao criar a partir do quadro — "+" na coluna "Em
  // andamento" deveria criar já em andamento, não voltar pra "A fazer".
  const [createStatus, setCreateStatus] = useState<Task['status']>('PENDING');

  const fetchTags = useCallback(() => {
    api.get('/api/tasks/tags')
      .then((r) => setTags(r.data || []))
      .catch(() => setTags([]));
  }, []);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    // No quadro o agrupamento por coluna JÁ é o filtro de situação — aplicar
    // o pill da Lista por cima faria a coluna "Concluída" sumir ao entrar
    // filtrando por "A fazer", por exemplo.
    if (view === 'lista' && filter !== 'ALL') qs.set('status', filter);
    if (tagFilter) qs.set('tagId', tagFilter);
    if (assigneeFilter !== 'ALL') qs.set('assignedToId', assigneeFilter);
    const q = qs.toString();
    api.get(`/api/tasks${q ? `?${q}` : ''}`)
      .then((res) => setTasks(res.data || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [view, filter, tagFilter, assigneeFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  async function completeTask(task: Task) {
    setSavingId(task.id);
    try {
      await api.put(`/api/tasks/${task.id}`, { status: 'DONE' });
      // Se a tarefa não pertence mais ao filtro aberto, some da lista.
      if (filter !== 'ALL' && filter !== 'DONE') {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: 'DONE', completedAt: new Date().toISOString() } : t,
          ),
        );
      }
    } catch {
      fetchTasks(); // falhou: recarrega pra ficar consistente com o servidor
    } finally {
      setSavingId(null);
    }
  }

  // Depois de salvar, o filtro aberto pode não valer mais pra tarefa (mudou de
  // situação, de dono, de etiqueta). Refetch é mais honesto que remendar a
  // lista na mão e mostrar algo que o servidor não devolveria.
  const onSaved = useCallback(() => { fetchTasks(); fetchTags(); }, [fetchTasks, fetchTags]);

  const filtrando = filter !== 'ALL' || !!tagFilter || assigneeFilter !== 'ALL';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <ListChecks className="text-primary-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
              Tarefas
              <SaibaMais featureKey="tasks.overview" />
            </h1>
            <p className="text-sm text-gray-500">
              O que a IA levantou nas conversas e na prospecção, mais o que você anotar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Lista/Quadro — dois jeitos de olhar o MESMO dado, não duas telas. */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('lista')}
              aria-pressed={view === 'lista'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'lista' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Rows3 size={14} />Lista
            </button>
            <button
              onClick={() => setView('quadro')}
              aria-pressed={view === 'quadro'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'quadro' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Columns3 size={14} />Quadro
            </button>
          </div>
          <button
            onClick={() => { setPanelTask(null); setCreateStatus('PENDING'); setPanelMode('create'); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700"
          >
            <Plus size={16} />
            Nova tarefa
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {view === 'lista' && FILTERS.map(({ key, label }) => (
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

        {view === 'lista' && <span className="w-px h-5 bg-gray-200 mx-1" aria-hidden />}

        <select
          aria-label="Filtrar por responsável"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
          className="px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white text-gray-600"
        >
          {ASSIGNEES.map((a) => (
            <option key={a.key} value={a.key}>{a.label}</option>
          ))}
        </select>

        {tags.length > 0 && (
          <select
            aria-label="Filtrar por etiqueta"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white text-gray-600"
          >
            <option value="">Todas as etiquetas</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.emUso ? ` (${t.emUso})` : ''}</option>
            ))}
          </select>
        )}

        {!loading && (
          <span className="ml-1 text-sm text-gray-400">
            {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
          </span>
        )}
      </div>

      {view === 'quadro' ? (
        loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <TaskBoard
            tasks={tasks}
            onMoved={fetchTasks}
            onOpenTask={(t) => { setPanelTask(t); setPanelMode('view'); }}
            onCreateInColumn={(status) => {
              setPanelTask(null);
              setCreateStatus(status);
              setPanelMode('create');
            }}
          />
        )
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-xl">
          <ListChecks className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 font-medium">
            {filtrando ? 'Nenhuma tarefa com esses filtros' : 'Nenhuma tarefa por aqui'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {/* Honestidade: com filtro ligado, lista vazia é do FILTRO, não da
                conta. Sem esta distinção o cliente lê "a ferramenta não achou
                nada" e conclui que o produto não entrega. */}
            {filtrando
              ? 'Tente afrouxar os filtros acima.'
              : 'Conforme a IA identifica oportunidades, os follow-ups aparecem aqui. Você também pode criar a sua.'}
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
                  <p className={`text-sm font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap ${done ? 'line-through' : ''}`}>
                    {task.title}
                    {/* A origem muda o QUE a pessoa vai fazer: responder alguém
                        que chamou (Conversa) é diferente de abordar alguém que
                        nem sabe que você existe (Mira). */}
                    {task.origem === 'MIRA' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#2F7FB5]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2F7FB5] shrink-0">
                        <Radar size={10} />
                        Prospecção
                      </span>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                        Em andamento
                      </span>
                    )}
                  </p>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                  )}

                  {/* Etiquetas */}
                  {task.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {task.tags.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: `${t.color}1a`, color: t.color }}
                        >
                          <TagIcon size={9} />
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadados */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                    <button
                      onClick={() => { setPanelTask(task); setPanelMode('view'); }}
                      className="flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700"
                    >
                      <PanelRightOpen size={13} />
                      Ver tarefa
                    </button>
                    {task.origem === 'MIRA' && task.miraAlvoId && (
                      <Link
                        href={`/mira/alvos/${task.miraAlvoId}`}
                        className="flex items-center gap-1 text-gray-500 hover:text-[#2F7FB5]"
                      >
                        <Radar size={13} />
                        ver o dossiê
                      </Link>
                    )}
                    {task.assignedTo && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <User size={13} />
                        {task.assignedTo.name}
                      </span>
                    )}
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

      {panelMode && (
        <TaskPanel
          task={panelTask}
          mode={panelMode}
          tags={tags}
          createInitialStatus={createStatus}
          onClose={() => setPanelMode(null)}
          onSaved={onSaved}
          onTagsChanged={fetchTags}
        />
      )}
    </div>
  );
}
