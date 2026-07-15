'use client';

/**
 * Painel "Ver tarefa" — o pedido do Rodrigo: abrir a tarefa completa, com prazo,
 * observação, responsável e etiquetas.
 *
 * Serve para VER/EDITAR e para CRIAR (mode='create'). É o mesmo formulário de
 * propósito: se criar e editar fossem telas diferentes, elas divergiriam na
 * primeira mudança de campo — a família de bug que mais custou neste projeto
 * (a mesma regra viva em dois lugares).
 *
 * A `description` é SOMENTE LEITURA quando veio da IA: aquele texto é o plano de
 * ação que a Mira escreveu. Quem quer anotar usa "Observações", que é campo
 * separado no banco justamente para não apagar a instrução original.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  X, Loader2, Trash2, Check, Calendar, User, Tag as TagIcon,
  Radar, Sparkles, AlertTriangle,
} from 'lucide-react';
import { api } from '../../lib/api';

export interface TaskTag {
  id: string;
  name: string;
  color: string;
  emUso?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  contact: { id: string; name: string; phone: string } | null;
  deal: { id: string; title: string; stage: string } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  tags: TaskTag[];
  origem?: 'CONVERSA' | 'MIRA';
  miraAlvoId?: string | null;
}

interface Membro {
  id: string;
  name: string;
  email: string;
}

const STATUS_LABEL: Record<Task['status'], string> = {
  PENDING: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
};

/** `dueDate` vem ISO e o <input type="date"> quer YYYY-MM-DD. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

interface Props {
  /** Tarefa a abrir; null + mode='create' = tarefa nova. */
  task: Task | null;
  mode: 'view' | 'create';
  tags: TaskTag[];
  onClose: () => void;
  /** Devolve a tarefa salva pra lista se reordenar/atualizar sem refetch. */
  onSaved: (task: Task) => void;
  onTagsChanged: () => void;
}

export function TaskPanel({ task, mode, tags, onClose, onSaved, onTagsChanged }: Props) {
  const criando = mode === 'create';

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'PENDING');
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate ?? null));
  const [assignedToId, setAssignedToId] = useState(task?.assignedTo?.id ?? '');
  const [tagIds, setTagIds] = useState<string[]>(task?.tags?.map((t) => t.id) ?? []);

  const [membros, setMembros] = useState<Membro[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criandoTag, setCriandoTag] = useState(false);
  const [novaTag, setNovaTag] = useState('');

  // A tarefa da IA traz a instrução em `description`. Deixar editar apagaria o
  // plano de ação; quem anota usa Observações.
  const descricaoDaIa = !criando && task?.origem === 'MIRA';

  useEffect(() => {
    api.get('/api/settings/team')
      .then((r) => setMembros(r.data || []))
      .catch(() => setMembros([])); // sem equipe, o seletor só some
  }, []);

  // Esc fecha — o painel cobre a tela e ficar preso nele é irritante.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleTag = useCallback((id: string) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }, []);

  async function criarTag() {
    const name = novaTag.trim();
    if (!name) return;
    setCriandoTag(true);
    setErro(null);
    try {
      // Cor sorteada de uma paleta fechada: pedir a cor na hora de criar trava o
      // fluxo, e hex livre deixaria etiqueta ilegível (branco no branco).
      const paleta = ['#2F7FB5', '#16a34a', '#ea580c', '#9333ea', '#dc2626', '#0891b2', '#ca8a04'];
      const color = paleta[Math.floor(Math.random() * paleta.length)];
      const r = await api.post('/api/tasks/tags', { name, color });
      setNovaTag('');
      onTagsChanged();
      setTagIds((prev) => [...prev, r.data.id]);
    } catch (e: any) {
      setErro(e?.message?.includes('409') ? 'Já existe uma etiqueta com esse nome' : 'Não deu para criar a etiqueta');
    } finally {
      setCriandoTag(false);
    }
  }

  async function salvar() {
    if (!title.trim()) {
      setErro('A tarefa precisa de um título');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const corpo: Record<string, unknown> = {
        title: title.trim(),
        notes: notes.trim() || null,
        status,
        dueDate: dueDate ? new Date(dueDate + 'T12:00:00').toISOString() : null,
        assignedToId: assignedToId || null,
        tagIds,
      };
      // Só manda description quando o humano pode mesmo editá-la.
      if (!descricaoDaIa) corpo.description = description.trim() || null;

      const r = criando
        ? await api.post('/api/tasks', corpo)
        : await api.put(`/api/tasks/${task!.id}`, corpo);
      onSaved(r.data);
      onClose();
    } catch (e: any) {
      // O servidor recusa vínculo de outra org com 400 e mensagem própria.
      setErro(e?.message || 'Não deu para salvar');
      setSalvando(false);
    }
  }

  const atrasada =
    dueDate && status !== 'DONE' && new Date(dueDate + 'T23:59:59') < new Date();

  return (
    // z-[60] e não z-50: o FAB "Treinar <agente>" é `fixed bottom-6 right-6
    // z-50` e, empatado no z-index, a ordem do DOM decidia — ele ficava POR
    // CIMA de "Salvar" e "Cancelar", e a pessoa não conseguia salvar a tarefa.
    // Modal ganha de botão flutuante. Pego só no navegador: tsc e os 56 testes
    // passavam com o bug no ar.
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />

      <aside
        role="dialog"
        aria-label={criando ? 'Nova tarefa' : 'Ver tarefa'}
        className="relative w-full max-w-lg h-full bg-white shadow-xl flex flex-col animate-in slide-in-from-right"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">
              {criando ? 'Nova tarefa' : 'Ver tarefa'}
            </h2>
            {!criando && task?.origem === 'MIRA' && (
              <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-[#2F7FB5]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2F7FB5]">
                <Radar size={10} />
                Prospecção · criada pela Mira
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label htmlFor="tf-title" className="block text-xs font-semibold text-gray-500 mb-1.5">
              Título
            </label>
            <input
              id="tf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="O que precisa ser feito?"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Descrição: da IA vira leitura; à mão, editável */}
          {(description || !descricaoDaIa) && (
            <div>
              <label htmlFor="tf-desc" className="block text-xs font-semibold text-gray-500 mb-1.5">
                {descricaoDaIa ? (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={11} />O que a Mira recomendou
                  </span>
                ) : (
                  'Descrição'
                )}
              </label>
              {descricaoDaIa ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg p-3">
                  {description}
                </p>
              ) : (
                <textarea
                  id="tf-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>
          )}

          <div>
            <label htmlFor="tf-notes" className="block text-xs font-semibold text-gray-500 mb-1.5">
              Observações
            </label>
            <textarea
              id="tf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="O que você descobriu, combinou ou precisa lembrar"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tf-status" className="block text-xs font-semibold text-gray-500 mb-1.5">
                Situação
              </label>
              <select
                id="tf-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Task['status'])}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {(['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tf-due" className="block text-xs font-semibold text-gray-500 mb-1.5">
                <span className="inline-flex items-center gap-1"><Calendar size={11} />Prazo</span>
              </label>
              <input
                id="tf-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  atrasada ? 'border-red-300 text-red-700' : 'border-gray-200'
                }`}
              />
              {atrasada && (
                <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                  <AlertTriangle size={11} />O prazo já passou
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="tf-assignee" className="block text-xs font-semibold text-gray-500 mb-1.5">
              <span className="inline-flex items-center gap-1"><User size={11} />Responsável</span>
            </label>
            <select
              id="tf-assignee"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sem responsável</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Etiquetas — catálogo, nunca texto livre */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              <span className="inline-flex items-center gap-1"><TagIcon size={11} />Etiquetas</span>
            </label>
            {tags.length === 0 && (
              <p className="text-xs text-gray-400 mb-2">
                Nenhuma etiqueta ainda. Crie a primeira abaixo e ela fica disponível para toda a equipe.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    aria-pressed={on}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors"
                    style={
                      on
                        ? { backgroundColor: t.color, borderColor: t.color, color: '#fff' }
                        : { borderColor: t.color, color: t.color, backgroundColor: 'transparent' }
                    }
                  >
                    {on && <Check size={11} />}
                    {t.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), criarTag())}
                placeholder="Criar etiqueta..."
                maxLength={40}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={criarTag}
                disabled={!novaTag.trim() || criandoTag}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                {criandoTag ? <Loader2 className="animate-spin" size={13} /> : 'Criar'}
              </button>
            </div>
          </div>

          {/* Vínculos: só leitura, definidos na criação */}
          {!criando && (task?.contact || task?.deal || task?.miraAlvoId) && (
            <div className="pt-1 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mt-3 mb-1.5">Ligada a</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {task?.miraAlvoId && (
                  <Link href={`/mira/alvos/${task.miraAlvoId}`} className="flex items-center gap-1 text-gray-600 hover:text-[#2F7FB5]">
                    <Radar size={12} />ver o dossiê
                  </Link>
                )}
                {task?.contact && (
                  <Link href={`/contacts/${task.contact.id}`} className="flex items-center gap-1 text-gray-600 hover:text-primary-600">
                    <User size={12} />{task.contact.name || task.contact.phone}
                  </Link>
                )}
                {task?.deal && (
                  <Link href="/crm" className="flex items-center gap-1 text-gray-600 hover:text-primary-600">
                    {task.deal.title}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
          {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {salvando && <Loader2 className="animate-spin" size={14} />}
              {criando ? 'Criar tarefa' : 'Salvar'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
