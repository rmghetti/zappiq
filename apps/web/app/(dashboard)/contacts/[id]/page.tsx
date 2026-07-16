'use client';

/**
 * Perfil do Contato (/(dashboard)/contacts/[id])
 *
 * Não existia — só a lista + modal de editar. O `TaskPanel` já linkava pra cá
 * (`/contacts/${id}`, seção "Ligada a") desde a primeira sessão do Tarefas, e
 * o link dava 404 em produção. Esta página fecha esse bug e entrega a seção
 * de Tarefas que o Rodrigo pediu no perfil do contato.
 *
 * Edição de nome/telefone/tags continua no modal existente (/contacts) — esta
 * página é o perfil (leitura + negócios + conversas + tarefas), não o form.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Loader2, Phone, Mail, Building2, ListChecks, Plus,
  PanelRightOpen, Clock, Check, MessageCircle, ExternalLink, Target,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { TaskPanel, type Task, type TaskTag } from '@/components/tasks/TaskPanel';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  QUALIFIED: 'bg-green-100 text-green-700',
  UNQUALIFIED: 'bg-red-100 text-red-700',
  CONVERTED: 'bg-purple-100 text-purple-700',
};

interface ContactDetail {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  leadStatus: string;
  leadScore: number;
  tags: string[];
  conversations: { id: string; status: string; channel: string; updatedAt: string }[];
  deals: { id: string; title: string; stage: string; value: number | string | null }[];
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tagsCatalog, setTagsCatalog] = useState<TaskTag[]>([]);
  const [panelTask, setPanelTask] = useState<Task | null>(null);
  const [panelMode, setPanelMode] = useState<'view' | 'create' | null>(null);

  const loadTasks = useCallback((id: string) => {
    setTasksLoading(true);
    api.get(`/api/tasks?contactId=${id}`)
      .then((res) => setTasks(res.data || []))
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, []);

  const loadTags = useCallback(() => {
    api.get('/api/tasks/tags')
      .then((res) => setTagsCatalog(res.data || []))
      .catch(() => setTagsCatalog([]));
  }, []);

  useEffect(() => {
    if (!params?.id) return;
    let alive = true;
    setLoading(true);
    api.get(`/api/contacts/${params.id}`)
      .then((res) => alive && setContact(res.data || res))
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [params?.id]);

  useEffect(() => {
    if (!params?.id) return;
    loadTasks(params.id);
    loadTags();
  }, [params?.id, loadTasks, loadTags]);

  async function completeTask(task: Task) {
    try {
      await api.put(`/api/tasks/${task.id}`, { status: 'DONE' });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'DONE', completedAt: new Date().toISOString() } : t)),
      );
    } catch {
      if (params?.id) loadTasks(params.id);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (notFound || !contact) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-24">
        <p className="text-gray-500 font-medium">Contato não encontrado.</p>
        <Link href="/contacts" className="text-primary-600 text-sm font-medium hover:underline mt-2 inline-block">
          Voltar para Contatos
        </Link>
      </div>
    );
  }

  const inicial = (contact.name || contact.phone || '?').charAt(0).toUpperCase();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/contacts" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={14} /> Contatos
      </Link>

      {/* Cabeçalho */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-primary-50 flex items-center justify-center shrink-0 font-bold text-primary-600">
              {inicial}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">{contact.name || contact.phone}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Phone size={12} />{contact.phone}</span>
                {contact.email && <span className="flex items-center gap-1"><Mail size={12} />{contact.email}</span>}
                {contact.company && <span className="flex items-center gap-1"><Building2 size={12} />{contact.company}</span>}
              </div>
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLORS[contact.leadStatus] || 'bg-gray-100 text-gray-600'}`}>
            {contact.leadStatus}
          </span>
        </div>
        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
            {contact.tags.map((t) => (
              <span key={t} className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Negócios */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Target size={14} />Negócios
          </h3>
          {contact.deals.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum negócio ligado a este contato.</p>
          ) : (
            <ul className="space-y-2">
              {contact.deals.map((d) => (
                <li key={d.id}>
                  <Link href="/crm" className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                    <span className="text-xs font-semibold text-gray-800 truncate">{d.title}</span>
                    <span className="text-[10px] font-medium text-gray-400 uppercase shrink-0">{d.stage}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Conversas recentes */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <MessageCircle size={14} />Conversas recentes
          </h3>
          {contact.conversations.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma conversa ainda.</p>
          ) : (
            <ul className="space-y-2">
              {contact.conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/conversations?id=${c.id}`} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                    <span className="text-xs font-medium text-gray-700 capitalize">{c.channel} · {c.status}</span>
                    <ExternalLink size={11} className="text-gray-400 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Tarefas */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <ListChecks size={14} />Tarefas
          </h3>
          <button
            onClick={() => { setPanelTask(null); setPanelMode('create'); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
          >
            <Plus size={12} />Nova tarefa
          </button>
        </div>
        {tasksLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma tarefa ligada a este contato ainda.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => {
              const done = t.status === 'DONE';
              return (
                <li key={t.id} className={`flex items-start gap-3 bg-gray-50 rounded-lg p-3 ${done ? 'opacity-60' : ''}`}>
                  <button
                    onClick={() => !done && completeTask(t)}
                    disabled={done}
                    aria-label={done ? 'Tarefa concluída' : 'Concluir tarefa'}
                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                      done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-primary-500'
                    }`}
                  >
                    <Check size={11} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold text-gray-800 ${done ? 'line-through' : ''}`}>{t.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        onClick={() => { setPanelTask(t); setPanelMode('view'); }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                      >
                        <PanelRightOpen size={11} />Ver tarefa
                      </button>
                      {t.dueDate && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={11} />
                          {new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {panelMode && (
        <TaskPanel
          task={panelTask}
          mode={panelMode}
          tags={tagsCatalog}
          prefillContactId={contact.id}
          onClose={() => setPanelMode(null)}
          onSaved={() => loadTasks(contact.id)}
          onTagsChanged={loadTags}
        />
      )}
    </div>
  );
}
