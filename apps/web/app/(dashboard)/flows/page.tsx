'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * ZappIQ Maestro — Builder de fluxos (Fase 2 Bloco 2 / #285)
 * --------------------------------------------------------------------------
 * Canvas React Flow consumindo /api/flows (CRUD real). Substitui o antigo mock
 * localStorage. Híbrido: cada nó é trilho fixo (determinístico) OU nó-IA.
 * 4 cores semânticas: trilho fixo (slate), nó-IA (azul), ação (verde),
 * humano (âmbar). Início = neutro.
 *
 * Testar usa POST /api/flows/:id/test, que roda o MESMO engine da produção
 * (flowEngine.resolveFlowStep) — o que você testa é o que a Iza faz.
 * Publicar usa POST /:id/publish (garante 1 fluxo ativo por org).
 * ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Plus, ArrowLeft, Save, Play, Upload, Trash2, Loader2,
  MessageSquare, GitBranch, Sparkles, Tag, BarChart2, Headset, Clock, PlayCircle,
} from 'lucide-react';
import { api } from '../../../lib/api';

// ─── Tipos de nó → categoria + visual ───────────────────────────────────────
type NodeKind = 'start' | 'fixed' | 'ai' | 'action' | 'human';

const NODE_META: Record<string, { kind: NodeKind; label: string; icon: any; palette: boolean }> = {
  start:       { kind: 'start',  label: 'Início',         icon: PlayCircle,    palette: false },
  message:     { kind: 'fixed',  label: 'Mensagem',       icon: MessageSquare, palette: true },
  condition:   { kind: 'fixed',  label: 'Condição',       icon: GitBranch,     palette: true },
  ai:          { kind: 'ai',     label: 'Nó-IA',          icon: Sparkles,      palette: true },
  tag:         { kind: 'action', label: 'Marcar tag',     icon: Tag,           palette: true },
  update_lead: { kind: 'action', label: 'Atualizar lead', icon: BarChart2,     palette: true },
  transfer:    { kind: 'human',  label: 'Humano',         icon: Headset,       palette: true },
  wait:        { kind: 'fixed',  label: 'Aguardar',       icon: Clock,         palette: true },
};

const KIND_STYLE: Record<NodeKind, string> = {
  start:  'bg-gray-100 border-gray-300 text-gray-700',
  fixed:  'bg-slate-50 border-slate-300 text-slate-700',
  ai:     'bg-blue-50 border-blue-300 text-blue-700',
  action: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  human:  'bg-amber-50 border-amber-300 text-amber-700',
};

function metaFor(type: string) {
  return NODE_META[type] || { kind: 'fixed' as NodeKind, label: type, icon: MessageSquare, palette: true };
}

function nodeSummary(type: string, data: any): string {
  switch (type) {
    case 'message': return data?.text || '(mensagem vazia)';
    case 'condition': return 'Ramifica pela resposta';
    case 'ai': return data?.prompt || '(sem instrução)';
    case 'tag': return data?.tag ? `tag: ${data.tag}` : '(sem tag)';
    case 'update_lead': return data?.field ? `${data.field} = ${data.value ?? ''}` : '(sem campo)';
    case 'transfer': return 'Passa pro time';
    case 'wait': return data?.seconds ? `${data.seconds}s` : 'Pausa';
    case 'start': return 'Cliente inicia conversa';
    default: return '';
  }
}

// ─── Nó customizado React Flow ───────────────────────────────────────────────
function MaestroNode({ type, data, selected }: NodeProps) {
  const meta = metaFor(type);
  const Icon = meta.icon;
  const summary = nodeSummary(type, data);
  return (
    <div
      className={`rounded-lg border px-3 py-2 w-[180px] ${KIND_STYLE[meta.kind]} ${selected ? 'ring-2 ring-primary-400' : ''}`}
      style={{ fontSize: 12 }}
    >
      {type !== 'start' && <Handle type="target" position={Position.Top} />}
      <div className="flex items-center gap-1.5 font-medium">
        <Icon size={14} /> {data?.label || meta.label}
      </div>
      <div className="text-[11px] opacity-80 mt-0.5 truncate">{summary}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// ─── Shapes da API ───────────────────────────────────────────────────────────
interface ApiFlow {
  id: string;
  name: string;
  description?: string | null;
  nodes: any[];
  edges: any[];
  isActive: boolean;
  triggerType: string;
  version: number;
}

interface TestTurn {
  input: string;
  effects: { kind: string; [k: string]: any }[];
  next: 'await_input' | 'ai' | 'end';
  aiPrompt: string | null;
}

let nodeSeq = 1;
function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${nodeSeq++}`;
}

// ─── Editor (canvas) ─────────────────────────────────────────────────────────
function FlowEditor({ flow, onBack, onSaved }: { flow: ApiFlow; onBack: () => void; onSaved: () => void }) {
  const [name, setName] = useState(flow.name);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    (flow.nodes || []).map((n: any, i: number): Node => ({
      id: n.id || genId('n'),
      type: NODE_META[n.type] ? n.type : 'message',
      position: n.position && typeof n.position.x === 'number' ? n.position : { x: 120, y: 60 + i * 110 },
      data: { ...(n.data || {}), label: n.data?.label || n.label || metaFor(n.type).label },
    })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (flow.edges || []).map((e: any): Edge => ({
      id: e.id || genId('e'),
      source: e.source,
      target: e.target,
      label: e.data?.when?.value || undefined,
      data: e.data || {},
    })),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState('quero um orçamento\nsim, por favor');
  const [testTurns, setTestTurns] = useState<TestTurn[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nodeTypes = useMemo(
    () => Object.fromEntries(Object.keys(NODE_META).map((t) => [t, MaestroNode])),
    [],
  );

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, data: {} }, eds)),
    [setEdges],
  );

  function addNode(type: string) {
    const id = genId('n');
    setNodes((nds) => [
      ...nds,
      { id, type, position: { x: 360, y: 80 + nds.length * 30 }, data: { label: metaFor(type).label } },
    ]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }

  function updateNodeData(patch: Record<string, any>) {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }

  function setEdgeCondition(value: string) {
    if (!selectedEdgeId) return;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === selectedEdgeId
          ? { ...e, label: value || undefined, data: { ...e.data, when: value ? { match: 'contains', value } : undefined } }
          : e,
      ),
    );
  }

  // React Flow → shape da API (engine lê node.data.* e edge.data.when)
  function toApiGraph() {
    return {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, label: n.data?.label, data: n.data, position: n.position })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data || {} })),
    };
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const g = toApiGraph();
      await api.put(`/api/flows/${flow.id}`, { name, nodes: g.nodes, edges: g.edges });
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar');
    } finally { setSaving(false); }
  }

  async function publish() {
    setPublishing(true); setError(null);
    try {
      const g = toApiGraph();
      await api.put(`/api/flows/${flow.id}`, { name, nodes: g.nodes, edges: g.edges });
      await api.post(`/api/flows/${flow.id}/publish`);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Falha ao publicar');
    } finally { setPublishing(false); }
  }

  async function runTest() {
    setTesting(true); setError(null); setTestTurns(null);
    try {
      const g = toApiGraph();
      await api.put(`/api/flows/${flow.id}`, { name, nodes: g.nodes, edges: g.edges });
      const messages = testInput.split('\n').map((s) => s.trim()).filter(Boolean);
      const res = await api.post<{ success: boolean; data: { turns: TestTurn[] } }>(
        `/api/flows/${flow.id}/test`, { messages },
      );
      setTestTurns(res?.data?.turns || []);
    } catch (e: any) {
      setError(e?.message || 'Falha ao testar');
    } finally { setTesting(false); }
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-700"><ArrowLeft size={18} /></button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm font-semibold text-gray-900 border-none outline-none bg-transparent min-w-0"
          />
          {flow.isActive && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">Ativo</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runTest} disabled={testing} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Testar
          </button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
          <button onClick={publish} disabled={publishing} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 flex items-center gap-1.5 disabled:opacity-50">
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Publicar
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-2 bg-red-50 text-red-700 text-xs border-b border-red-100">{error}</div>}

      <div className="flex flex-1 min-h-0">
        {/* Paleta */}
        <div className="w-44 border-r border-gray-200 bg-gray-50 p-2 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 px-1 mb-1">Adicionar nó</p>
          {Object.entries(NODE_META).filter(([, m]) => m.palette).map(([type, m]) => {
            const Icon = m.icon;
            return (
              <button
                key={type}
                onClick={() => addNode(type)}
                className={`w-full mb-1.5 rounded-lg border px-2.5 py-2 text-left text-xs flex items-center gap-2 ${KIND_STYLE[m.kind]} hover:opacity-80`}
              >
                <Icon size={14} /> {m.label}
              </button>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0 bg-white">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => { setSelectedNodeId(n.id); setSelectedEdgeId(null); }}
            onEdgeClick={(_, e) => { setSelectedEdgeId(e.id); setSelectedNodeId(null); }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {/* Propriedades */}
        <div className="w-64 border-l border-gray-200 bg-white p-3 overflow-y-auto">
          {!selectedNode && !selectedEdge && (
            <p className="text-xs text-gray-400">Selecione um nó ou uma conexão para editar.</p>
          )}

          {selectedNode && (
            <NodeProperties
              key={selectedNode.id}
              type={selectedNode.type || 'message'}
              data={selectedNode.data}
              onChange={updateNodeData}
              onDelete={deleteSelectedNode}
            />
          )}

          {selectedEdge && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">Conexão</p>
              <label className="block text-xs text-gray-600 mb-1">Seguir por aqui quando a mensagem contiver:</label>
              <input
                value={selectedEdge.data?.when?.value || ''}
                onChange={(e) => setEdgeCondition(e.target.value)}
                placeholder="ex: sim"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400"
              />
              <p className="text-[10px] text-gray-400 mt-1.5">Vazio = conexão padrão (sem condição).</p>
            </div>
          )}
        </div>
      </div>

      {/* Painel de teste (replay no engine real) */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[11px] text-gray-500 mb-1">Mensagens de teste (uma por linha) — replay no motor real da produção</p>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>
          {testTurns && (
            <div className="flex-1 max-h-24 overflow-y-auto text-[11px] font-mono bg-white border border-gray-200 rounded p-2">
              {testTurns.length === 0 && <span className="text-gray-400">sem passos</span>}
              {testTurns.map((t, i) => (
                <div key={i} className="mb-1">
                  <span className="text-gray-400">você ›</span> {t.input}
                  <div className="text-gray-600">→ {t.effects.map((e) => e.kind).join(', ') || '(nada)'} · próximo: {t.next}{t.aiPrompt ? ' (Iza assume)' : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Painel de propriedades por tipo de nó ───────────────────────────────────
function NodeProperties({ type, data, onChange, onDelete }: {
  type: string; data: any; onChange: (p: Record<string, any>) => void; onDelete: () => void;
}) {
  const meta = metaFor(type);
  const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[11px] px-2 py-0.5 rounded-md border ${KIND_STYLE[meta.kind]}`}>{meta.label}</span>
        {type !== 'start' && (
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500" title="Excluir nó"><Trash2 size={14} /></button>
        )}
      </div>

      <label className="block text-xs text-gray-600 mb-1">Rótulo</label>
      <input value={data?.label || ''} onChange={(e) => onChange({ label: e.target.value })} className={`${inputCls} mb-3`} />

      {type === 'message' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Texto enviado ao cliente</label>
          <textarea value={data?.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={3} className={`${inputCls} resize-none`} />
        </>
      )}

      {type === 'ai' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Instrução do passo (a Iza assume)</label>
          <textarea value={data?.prompt || ''} onChange={(e) => onChange({ prompt: e.target.value })} rows={3} className={`${inputCls} resize-none mb-2`} />
          <label className="block text-xs text-gray-600 mb-1">Modelo</label>
          <select value={data?.model || ''} onChange={(e) => onChange({ model: e.target.value })} className={inputCls}>
            <option value="">Automático (cascade)</option>
            <option value="haiku">Haiku (rápido)</option>
            <option value="sonnet">Sonnet (forte)</option>
          </select>
          <p className="text-[10px] text-gray-400 mt-2">Reusa identidade + conhecimento (RAG) da sua Iza. Não reescreve o prompt-base.</p>
        </>
      )}

      {type === 'tag' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Tag a aplicar no contato</label>
          <input value={data?.tag || ''} onChange={(e) => onChange({ tag: e.target.value })} placeholder="ex: lead-quente" className={inputCls} />
        </>
      )}

      {type === 'update_lead' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Campo</label>
          <input value={data?.field || ''} onChange={(e) => onChange({ field: e.target.value })} placeholder="ex: origem" className={`${inputCls} mb-2`} />
          <label className="block text-xs text-gray-600 mb-1">Valor</label>
          <input value={data?.value || ''} onChange={(e) => onChange({ value: e.target.value })} className={inputCls} />
        </>
      )}

      {type === 'condition' && (
        <p className="text-[11px] text-gray-500">Conecte este nó a vários destinos e clique em cada conexão para definir a palavra-chave que leva por ela.</p>
      )}

      {type === 'transfer' && (
        <p className="text-[11px] text-gray-500">Transfere a conversa pro time, com todo o contexto. Sem campos.</p>
      )}

      {type === 'wait' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Segundos de pausa</label>
          <input type="number" value={data?.seconds || ''} onChange={(e) => onChange({ seconds: e.target.value })} className={inputCls} />
          <p className="text-[10px] text-gray-400 mt-1.5">Obs: timing entra na Fase 3 — hoje o motor passa direto.</p>
        </>
      )}
    </div>
  );
}

// ─── Lista de fluxos ─────────────────────────────────────────────────────────
// ─── "Maestro monta pra você" (#288) ─────────────────────────────────────────
type FlowDraft = {
  name: string;
  nodes: any[];
  edges: any[];
  triggerType: string;
  triggerConfig: Record<string, any>;
  rationale: { node: string; why: string }[];
  summary: string;
  blueprintLabel: string;
  source: 'ai' | 'fallback';
};

export default function FlowsPage() {
  const [flows, setFlows] = useState<ApiFlow[] | null>(null);
  const [editing, setEditing] = useState<ApiFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // gerador "monta pra você"
  const [genGoal, setGenGoal] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<FlowDraft | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: ApiFlow[] }>('/api/flows');
      setFlows(res?.data || []);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar fluxos');
      setFlows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createFlow() {
    setCreating(true); setError(null);
    try {
      const res = await api.post<{ success: boolean; data: ApiFlow }>('/api/flows', {
        name: 'Novo fluxo',
        triggerType: 'FIRST_CONTACT',
        nodes: [{ id: genId('n'), type: 'start', label: 'Início', data: { label: 'Início' }, position: { x: 120, y: 40 } }],
        edges: [],
      });
      if (res?.data) setEditing(res.data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao criar fluxo');
    } finally { setCreating(false); }
  }

  async function removeFlow(id: string) {
    try { await api.delete(`/api/flows/${id}`); load(); } catch { /* noop */ }
  }

  // Pede pro Maestro montar um fluxo (não persiste — abre o painel de revisão).
  async function generate() {
    setGenerating(true); setError(null);
    try {
      const res = await api.post<{ success: boolean; data: FlowDraft }>('/api/flows/generate', {
        goal: genGoal.trim() || undefined,
      });
      if (res?.data) setDraft(res.data);
    } catch (e: any) {
      setError(e?.message || 'O Maestro não conseguiu montar agora. Tente de novo.');
    } finally { setGenerating(false); }
  }

  // Aceita o draft: persiste como fluxo novo e abre o editor.
  async function acceptDraft() {
    if (!draft) return;
    setCreating(true); setError(null);
    try {
      const res = await api.post<{ success: boolean; data: ApiFlow }>('/api/flows', {
        name: draft.name,
        triggerType: draft.triggerType,
        triggerConfig: draft.triggerConfig || {},
        nodes: draft.nodes,
        edges: draft.edges,
      });
      setDraft(null); setGenGoal('');
      if (res?.data) setEditing(res.data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar o fluxo gerado');
    } finally { setCreating(false); }
  }

  if (editing) {
    return (
      <ReactFlowProvider>
        <FlowEditor flow={editing} onBack={() => { setEditing(null); load(); }} onSaved={load} />
      </ReactFlowProvider>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maestro — Fluxos</h1>
          <p className="text-sm text-gray-500">Construa o atendimento: trilho fixo onde precisa de controle, IA onde precisa de conversa.</p>
        </div>
        <button onClick={createFlow} disabled={creating} className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center gap-2 disabled:opacity-50">
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Novo fluxo
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}

      {/* Maestro monta pra você (#288) */}
      <div className="mb-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-indigo-50 to-white p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Não sabe como montar? O Maestro monta pra você 🎼</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Ele lê o segmento do seu negócio, monta um fluxo sob medida, explica como construiu e deixa você editar tudo. É só dizer o objetivo (ou deixar em branco que ele decide).
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <input
                value={genGoal}
                onChange={(e) => setGenGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !generating) generate(); }}
                placeholder="Ex: agendar consultas, qualificar leads, tirar dúvidas… (opcional)"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
              />
              <button
                onClick={generate}
                disabled={generating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generating ? 'Montando…' : 'Gerar meu fluxo'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {flows === null && (
        <div className="flex items-center gap-2 text-gray-500 p-8 justify-center"><Loader2 size={18} className="animate-spin" /> Carregando…</div>
      )}

      {flows && flows.length === 0 && (
        <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          Nenhum fluxo ainda. Clique em &quot;Novo fluxo&quot; pra começar.
        </div>
      )}

      {/* Painel de revisão do draft gerado — "Como o Maestro montou isto" */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDraft(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center text-white shrink-0"><Sparkles size={18} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">O Maestro montou pra você</h3>
                <p className="text-sm text-gray-600 mt-0.5">{draft.summary}</p>
                {draft.source === 'fallback' && (
                  <p className="text-[11px] text-amber-600 mt-1">Usei um modelo padrão como base — personalize à vontade.</p>
                )}
              </div>
              <button onClick={() => setDraft(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Como montei, nó a nó</p>
              <ol className="space-y-2.5">
                {draft.rationale.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.node}</p>
                      <p className="text-sm text-gray-600">{r.why}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-2 justify-end">
              <button onClick={generate} disabled={generating} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-50">
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Gerar outro
              </button>
              <button onClick={acceptDraft} disabled={creating} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Abrir e editar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {flows?.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200">
            <button onClick={() => setEditing(f)} className="flex items-center gap-3 text-left flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600"><GitBranch size={18} /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                <p className="text-xs text-gray-400">{(f.nodes?.length || 0)} nós · v{f.version}</p>
              </div>
            </button>
            <div className="flex items-center gap-3">
              {f.isActive && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">Ativo</span>}
              <button onClick={() => removeFlow(f.id)} className="p-1.5 text-gray-400 hover:text-red-500" title="Excluir"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
