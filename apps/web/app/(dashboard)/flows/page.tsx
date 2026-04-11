'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GitBranch,
  Plus,
  ArrowLeft,
  Save,
  Play,
  Upload,
  Trash2,
  MessageSquare,
  HelpCircle,
  Bot,
  CalendarDays,
  UserCheck,
  Clock,
  Tag,
  BarChart2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  X,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Copy,
  MoreVertical,
  Zap,
  Search,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

interface FlowConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  connections: FlowConnection[];
  active: boolean;
  updatedAt: string;
  createdAt: string;
}

type NodeType =
  | 'start'
  | 'message'
  | 'condition'
  | 'ai'
  | 'schedule'
  | 'transfer'
  | 'wait'
  | 'tag'
  | 'update_lead';

type ViewMode = 'list' | 'editor';

// ─── Node registry ────────────────────────────────────────────────────────────

const NODE_TYPES: Record<
  NodeType,
  { label: string; icon: any; color: string; bg: string; border: string; emoji: string; description: string }
> = {
  start: {
    label: 'Gatilho',
    icon: Zap,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    emoji: '⚡',
    description: 'Ponto de entrada do fluxo',
  },
  message: {
    label: 'Mensagem',
    icon: MessageSquare,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    emoji: '💬',
    description: 'Envia texto ao cliente',
  },
  condition: {
    label: 'Condição',
    icon: HelpCircle,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    emoji: '❓',
    description: 'Ramificação if/else',
  },
  ai: {
    label: 'IA Pulse',
    icon: Bot,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    emoji: '🤖',
    description: 'IA responde automaticamente',
  },
  schedule: {
    label: 'Agendar',
    icon: CalendarDays,
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    emoji: '📅',
    description: 'Cria agendamento',
  },
  transfer: {
    label: 'Transferir',
    icon: UserCheck,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    emoji: '👤',
    description: 'Transfere para humano',
  },
  wait: {
    label: 'Aguardar',
    icon: Clock,
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    emoji: '⏰',
    description: 'Pausa por tempo',
  },
  tag: {
    label: 'Tag',
    icon: Tag,
    color: 'text-pink-700',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    emoji: '🏷️',
    description: 'Adiciona tag ao contato',
  },
  update_lead: {
    label: 'Atualizar Lead',
    icon: BarChart2,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    emoji: '📊',
    description: 'Atualiza score/estágio',
  },
};

// ─── Pallete node types (excluding start, which is auto-created) ─────────────

const PALETTE_TYPES: NodeType[] = [
  'message',
  'condition',
  'ai',
  'schedule',
  'transfer',
  'wait',
  'tag',
  'update_lead',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return 'n_' + Math.random().toString(36).slice(2, 10);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STORAGE_KEY = 'zappiq_flows';

function loadFlows(): Flow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return getDefaultFlows();
}

function saveFlows(flows: Flow[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
}

// ─── Default mock flows ───────────────────────────────────────────────────────

function getDefaultFlows(): Flow[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'flow_1',
      name: 'Boas-vindas',
      description: 'Fluxo de boas-vindas para novos contatos. Identifica a intenção e direciona.',
      active: true,
      createdAt: '2026-03-20T10:00:00Z',
      updatedAt: now,
      nodes: [
        { id: 'n1', type: 'start', label: 'Novo contato', data: { trigger: 'new_contact' }, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'message', label: 'Saudação', data: { text: 'Olá! 👋 Bem-vindo(a) à nossa empresa! Como posso ajudar?' }, position: { x: 0, y: 1 } },
        { id: 'n3', type: 'ai', label: 'Identificar intenção', data: { prompt: 'Classifique a intenção do cliente', model: 'haiku' }, position: { x: 0, y: 2 } },
        { id: 'n4', type: 'condition', label: 'Quer agendar?', data: { field: 'intent', operator: 'equals', value: 'agendar' }, position: { x: 0, y: 3 } },
        { id: 'n5', type: 'message', label: 'Resposta padrão', data: { text: 'Entendi! Vou te ajudar com isso.' }, position: { x: 0, y: 4 } },
      ],
      connections: [
        { id: 'c1', sourceId: 'n1', targetId: 'n2' },
        { id: 'c2', sourceId: 'n2', targetId: 'n3' },
        { id: 'c3', sourceId: 'n3', targetId: 'n4' },
        { id: 'c4', sourceId: 'n4', targetId: 'n5', label: 'Sim' },
      ],
    },
    {
      id: 'flow_2',
      name: 'Agendamento',
      description: 'Fluxo completo de agendamento de serviço com confirmação automática.',
      active: true,
      createdAt: '2026-03-18T14:00:00Z',
      updatedAt: '2026-03-25T09:30:00Z',
      nodes: [
        { id: 'n1', type: 'start', label: 'Intenção: agendar', data: { trigger: 'intent_schedule' }, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'message', label: 'Perguntar serviço', data: { text: 'Qual serviço você gostaria de agendar?' }, position: { x: 0, y: 1 } },
        { id: 'n3', type: 'message', label: 'Perguntar data', data: { text: 'Perfeito! Qual data e horário são melhores para você?' }, position: { x: 0, y: 2 } },
        { id: 'n4', type: 'condition', label: 'Horário disponível?', data: { field: 'slot_available', operator: 'equals', value: 'true' }, position: { x: 0, y: 3 } },
        { id: 'n5', type: 'schedule', label: 'Criar agendamento', data: { service: 'auto', confirmMessage: 'Agendado com sucesso! ✅' }, position: { x: 0, y: 4 } },
        { id: 'n6', type: 'message', label: 'Confirmação', data: { text: 'Pronto! Seu agendamento foi confirmado. Enviaremos um lembrete.' }, position: { x: 0, y: 5 } },
      ],
      connections: [
        { id: 'c1', sourceId: 'n1', targetId: 'n2' },
        { id: 'c2', sourceId: 'n2', targetId: 'n3' },
        { id: 'c3', sourceId: 'n3', targetId: 'n4' },
        { id: 'c4', sourceId: 'n4', targetId: 'n5', label: 'Sim' },
        { id: 'c5', sourceId: 'n5', targetId: 'n6' },
      ],
    },
    {
      id: 'flow_3',
      name: 'Qualificação de Lead',
      description: 'Qualifica o lead com perguntas e atualiza o score automaticamente.',
      active: false,
      createdAt: '2026-03-15T08:00:00Z',
      updatedAt: '2026-03-22T16:45:00Z',
      nodes: [
        { id: 'n1', type: 'start', label: 'Lead novo', data: { trigger: 'new_lead' }, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'ai', label: 'Perguntas qualificação', data: { prompt: 'Faça 3 perguntas para qualificar o lead: orçamento, urgência e decisão', model: 'sonnet' }, position: { x: 0, y: 1 } },
        { id: 'n3', type: 'update_lead', label: 'Atualizar score', data: { scoreField: 'auto', stage: 'qualified' }, position: { x: 0, y: 2 } },
        { id: 'n4', type: 'condition', label: 'Score > 70?', data: { field: 'lead_score', operator: 'greater_than', value: '70' }, position: { x: 0, y: 3 } },
      ],
      connections: [
        { id: 'c1', sourceId: 'n1', targetId: 'n2' },
        { id: 'c2', sourceId: 'n2', targetId: 'n3' },
        { id: 'c3', sourceId: 'n3', targetId: 'n4' },
      ],
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FlowsPage() {
  const [view, setView] = useState<ViewMode>('list');
  const [flows, setFlows] = useState<Flow[]>([]);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setFlows(loadFlows());
    setLoaded(true);
  }, []);

  // Persist
  useEffect(() => {
    if (loaded) saveFlows(flows);
  }, [flows, loaded]);

  const currentFlow = flows.find((f) => f.id === editingFlowId) || null;

  function openEditor(flowId: string) {
    setEditingFlowId(flowId);
    setView('editor');
  }

  function createFlow() {
    const id = 'flow_' + Date.now();
    const now = new Date().toISOString();
    const newFlow: Flow = {
      id,
      name: 'Novo Fluxo',
      description: '',
      nodes: [
        {
          id: uid(),
          type: 'start',
          label: 'Gatilho',
          data: { trigger: 'new_contact' },
          position: { x: 0, y: 0 },
        },
      ],
      connections: [],
      active: false,
      createdAt: now,
      updatedAt: now,
    };
    setFlows((prev) => [newFlow, ...prev]);
    openEditor(id);
  }

  function updateFlow(updated: Flow) {
    setFlows((prev) => prev.map((f) => (f.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : f)));
  }

  function deleteFlow(id: string) {
    setFlows((prev) => prev.filter((f) => f.id !== id));
  }

  function toggleFlowActive(id: string) {
    setFlows((prev) =>
      prev.map((f) => (f.id === id ? { ...f, active: !f.active, updatedAt: new Date().toISOString() } : f))
    );
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (view === 'editor' && currentFlow) {
    return (
      <FlowEditor
        flow={currentFlow}
        onSave={updateFlow}
        onBack={() => {
          setView('list');
          setEditingFlowId(null);
        }}
      />
    );
  }

  return <FlowList flows={flows} onCreate={createFlow} onOpen={openEditor} onDelete={deleteFlow} onToggle={toggleFlowActive} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FLOW LIST VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function FlowList({
  flows,
  onCreate,
  onOpen,
  onDelete,
  onToggle,
}: {
  flows: Flow[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = flows.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <GitBranch className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Construtor de Fluxos</h1>
            <p className="text-sm text-gray-500">Forge Studio — crie automações visuais para o Pulse</p>
          </div>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm"
        >
          <Plus size={16} /> Novo Fluxo
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar fluxos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <GitBranch size={32} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {search ? 'Nenhum fluxo encontrado' : 'Nenhum fluxo criado'}
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            {search ? 'Tente outra busca.' : 'Crie seu primeiro fluxo de automação visual.'}
          </p>
          {!search && (
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors"
            >
              <Plus size={16} /> Criar Fluxo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((flow) => (
            <div
              key={flow.id}
              className="group bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all duration-200 overflow-hidden"
            >
              {/* Mini flow preview */}
              <div
                className="px-5 pt-5 pb-3 cursor-pointer"
                onClick={() => onOpen(flow.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{flow.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {flow.description || 'Sem descrição'}
                    </p>
                  </div>
                  <span
                    className={`ml-3 shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      flow.active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${flow.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {flow.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Mini node preview chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {flow.nodes.slice(0, 5).map((node) => {
                    const nt = NODE_TYPES[node.type];
                    return (
                      <span
                        key={node.id}
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${nt.bg} ${nt.color} border ${nt.border}`}
                      >
                        {nt.emoji} {node.label}
                      </span>
                    );
                  })}
                  {flow.nodes.length > 5 && (
                    <span className="text-[10px] text-gray-400 px-2 py-0.5">
                      +{flow.nodes.length - 5}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-[11px] text-gray-400">
                  <span>{flow.nodes.length} nós</span>
                  <span>{flow.connections.length} conexões</span>
                  <span className="ml-auto">{formatDate(flow.updatedAt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center border-t border-gray-50 px-2 py-1.5">
                <button
                  onClick={() => onOpen(flow.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => onToggle(flow.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  {flow.active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  {flow.active ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => {
                    const clone: Flow = {
                      ...JSON.parse(JSON.stringify(flow)),
                      id: 'flow_' + Date.now(),
                      name: flow.name + ' (cópia)',
                      active: false,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    // This needs access to setFlows — handled via onDelete pattern not ideal.
                    // For simplicity, we use localStorage directly
                    const all = loadFlows();
                    all.unshift(clone);
                    saveFlows(all);
                    window.location.reload();
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  <Copy size={13} /> Duplicar
                </button>
                <div className="ml-auto">
                  {deleteConfirm === flow.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-red-600 font-medium">Excluir?</span>
                      <button
                        onClick={() => {
                          onDelete(flow.id);
                          setDeleteConfirm(null);
                        }}
                        className="text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-md transition-colors"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-[11px] font-medium text-gray-500 hover:text-gray-700 px-2 py-1"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(flow.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FLOW EDITOR VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function FlowEditor({
  flow,
  onSave,
  onBack,
}: {
  flow: Flow;
  onSave: (flow: Flow) => void;
  onBack: () => void;
}) {
  const [nodes, setNodes] = useState<FlowNode[]>(flow.nodes);
  const [connections, setConnections] = useState<FlowConnection[]>(flow.connections);
  const [flowName, setFlowName] = useState(flow.name);
  const [flowDesc, setFlowDesc] = useState(flow.description);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addNodeAfter, setAddNodeAfter] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [palletteCollapsed, setPaletteCollapsed] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Build ordered node chain for linear display
  const orderedNodes = buildNodeOrder(nodes, connections);

  function handleSave() {
    onSave({
      ...flow,
      name: flowName,
      description: flowDesc,
      nodes,
      connections,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleTest() {
    setTestRunning(true);
    setTimeout(() => setTestRunning(false), 3000);
  }

  function addNode(type: NodeType, afterNodeId?: string) {
    const newNode: FlowNode = {
      id: uid(),
      type,
      label: NODE_TYPES[type].label,
      data: getDefaultData(type),
      position: { x: 0, y: nodes.length },
    };

    if (afterNodeId) {
      // Insert after the specified node
      const existingConn = connections.find((c) => c.sourceId === afterNodeId);

      setNodes((prev) => [...prev, newNode]);

      if (existingConn) {
        // Rewire: afterNode → newNode → existingTarget
        setConnections((prev) => [
          ...prev.filter((c) => c.id !== existingConn.id),
          { id: uid(), sourceId: afterNodeId, targetId: newNode.id },
          { id: uid(), sourceId: newNode.id, targetId: existingConn.targetId, label: existingConn.label },
        ]);
      } else {
        setConnections((prev) => [...prev, { id: uid(), sourceId: afterNodeId, targetId: newNode.id }]);
      }
    } else {
      setNodes((prev) => [...prev, newNode]);
      // Connect to last node if exists
      if (nodes.length > 0) {
        const lastOrdered = orderedNodes[orderedNodes.length - 1];
        if (lastOrdered) {
          setConnections((prev) => [...prev, { id: uid(), sourceId: lastOrdered.id, targetId: newNode.id }]);
        }
      }
    }

    setAddNodeAfter(null);
    setSelectedNodeId(newNode.id);
  }

  function deleteNode(nodeId: string) {
    if (nodes.find((n) => n.id === nodeId)?.type === 'start') return; // Can't delete start

    // Rewire connections: if A→nodeId→B, create A→B
    const incoming = connections.filter((c) => c.targetId === nodeId);
    const outgoing = connections.filter((c) => c.sourceId === nodeId);

    const newConns = connections.filter((c) => c.sourceId !== nodeId && c.targetId !== nodeId);
    // Bridge each incoming to each outgoing
    for (const inc of incoming) {
      for (const out of outgoing) {
        newConns.push({ id: uid(), sourceId: inc.sourceId, targetId: out.targetId });
      }
    }

    setConnections(newConns);
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }

  function updateNodeData(nodeId: string, data: Partial<FlowNode>) {
    // Handle delete sentinel from properties panel
    if ((data as any).id === '__DELETE__') {
      deleteNode(nodeId);
      return;
    }
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...data } : n)));
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -m-6">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="w-px h-6 bg-gray-200" />
          {editingName ? (
            <input
              autoFocus
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              className="text-lg font-bold text-gray-900 bg-transparent border-b-2 border-primary-500 outline-none px-1"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-2 text-lg font-bold text-gray-900 hover:text-primary-600 transition-colors"
            >
              {flowName} <Pencil size={14} className="text-gray-400" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={testRunning}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              testRunning
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Play size={14} className={testRunning ? 'animate-pulse' : ''} />
            {testRunning ? 'Testando...' : 'Testar'}
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            <Save size={14} /> {saved ? 'Salvo!' : 'Salvar'}
          </button>
          <button
            onClick={() => {
              handleSave();
              // Would publish to production
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-secondary-500 text-white text-sm font-semibold rounded-lg hover:bg-secondary-600 transition-colors"
          >
            <Upload size={14} /> Publicar
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 min-h-0">
        {/* Left Palette */}
        <div
          className={`shrink-0 bg-white border-r border-gray-100 transition-all duration-200 ${
            palletteCollapsed ? 'w-12' : 'w-60'
          }`}
        >
          <button
            onClick={() => setPaletteCollapsed(!palletteCollapsed)}
            className="flex items-center gap-2 w-full px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 border-b border-gray-50"
          >
            {palletteCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <>
                <GripVertical size={14} />
                <span className="flex-1 text-left">Nós disponíveis</span>
                <ChevronDown size={14} />
              </>
            )}
          </button>

          {!palletteCollapsed && (
            <div className="p-2.5 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
              {PALETTE_TYPES.map((type) => {
                const nt = NODE_TYPES[type];
                const Icon = nt.icon;
                return (
                  <button
                    key={type}
                    onClick={() => addNode(type, addNodeAfter || undefined)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all hover:shadow-sm ${nt.bg} ${nt.border} border hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${nt.bg}`}>
                      <Icon size={16} className={nt.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${nt.color}`}>{nt.label}</p>
                      <p className="text-[10px] text-gray-500 leading-tight">{nt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#F8FAF9] overflow-y-auto relative">
          {/* Dot grid background */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 flex flex-col items-center py-8 px-4 min-h-full">
            {/* Description */}
            <div className="mb-6 w-full max-w-lg">
              <input
                value={flowDesc}
                onChange={(e) => setFlowDesc(e.target.value)}
                placeholder="Adicione uma descrição ao fluxo..."
                className="w-full text-center text-sm text-gray-500 bg-transparent border-none outline-none placeholder:text-gray-400 focus:text-gray-700"
              />
            </div>

            {/* Nodes chain */}
            {orderedNodes.map((node, index) => {
              const nt = NODE_TYPES[node.type];
              const Icon = nt.icon;
              const isSelected = selectedNodeId === node.id;
              const conn = connections.find((c) => c.sourceId === node.id);

              return (
                <div key={node.id} className="flex flex-col items-center">
                  {/* Node card */}
                  <div
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-80 bg-white rounded-xl border-2 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${
                      isSelected
                        ? `${nt.border} ring-2 ring-offset-2 ring-primary-500/30`
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {/* Node header */}
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-t-[10px] ${nt.bg}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/70`}>
                        <Icon size={15} className={nt.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${nt.color}`}>{node.label}</p>
                        <p className="text-[10px] text-gray-500">{nt.label}</p>
                      </div>
                      {node.type !== 'start' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNode(node.id);
                          }}
                          className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Node body preview */}
                    <div className="px-4 py-3">
                      <NodePreview node={node} />
                    </div>
                  </div>

                  {/* Connector arrow + add button */}
                  {index < orderedNodes.length - 1 || true ? (
                    <div className="flex flex-col items-center my-1">
                      {/* Vertical line */}
                      <div className="w-0.5 h-4 bg-gray-300" />

                      {/* Connection label */}
                      {conn?.label && (
                        <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 my-0.5">
                          {conn.label}
                        </span>
                      )}

                      {/* Add node button */}
                      <button
                        onClick={() => {
                          setAddNodeAfter(node.id);
                        }}
                        className={`group/add w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                          addNodeAfter === node.id
                            ? 'bg-primary-500 text-white scale-110 ring-4 ring-primary-100'
                            : 'bg-white border-2 border-dashed border-gray-300 text-gray-400 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50'
                        }`}
                      >
                        <Plus size={14} />
                      </button>

                      {/* Add node type picker */}
                      {addNodeAfter === node.id && (
                        <div className="mt-2 mb-1 bg-white rounded-xl border border-gray-200 shadow-lg p-2 w-72 animate-in fade-in zoom-in-95">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
                            Adicionar nó
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {PALETTE_TYPES.map((type) => {
                              const pnt = NODE_TYPES[type];
                              const PIcon = pnt.icon;
                              return (
                                <button
                                  key={type}
                                  onClick={() => addNode(type, node.id)}
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${pnt.bg} hover:opacity-80`}
                                >
                                  <PIcon size={14} className={pnt.color} />
                                  <span className={`text-xs font-medium ${pnt.color}`}>{pnt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => setAddNodeAfter(null)}
                            className="w-full mt-1.5 text-[11px] text-gray-400 hover:text-gray-600 py-1"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      <div className="w-0.5 h-4 bg-gray-300" />

                      {/* Arrow tip */}
                      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-300" />
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* Orphan nodes (not in chain) */}
            {nodes
              .filter((n) => !orderedNodes.find((o) => o.id === n.id))
              .map((node) => {
                const nt = NODE_TYPES[node.type];
                const Icon = nt.icon;
                const isSelected = selectedNodeId === node.id;

                return (
                  <div key={node.id} className="mt-4">
                    <div className="flex items-center justify-center mb-2">
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Desconectado</span>
                    </div>
                    <div
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-80 bg-white rounded-xl border-2 shadow-sm cursor-pointer transition-all hover:shadow-md opacity-70 ${
                        isSelected
                          ? `${nt.border} ring-2 ring-offset-2 ring-primary-500/30 opacity-100`
                          : 'border-dashed border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-t-[10px] ${nt.bg}`}>
                        <Icon size={15} className={nt.color} />
                        <p className={`text-sm font-semibold ${nt.color}`}>{node.label}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNode(node.id);
                          }}
                          className="ml-auto p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="px-4 py-3">
                        <NodePreview node={node} />
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* End of flow indicator */}
            <div className="mt-4 mb-8 flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-bold">FIM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Properties Panel */}
        {selectedNode && (
          <div className="w-80 shrink-0 bg-white border-l border-gray-100 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Propriedades</h3>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              >
                <X size={16} />
              </button>
            </div>
            <NodePropertiesEditor
              node={selectedNode}
              onChange={(data) => updateNodeData(selectedNode.id, data)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Node preview content ─────────────────────────────────────────────────────

function NodePreview({ node }: { node: FlowNode }) {
  switch (node.type) {
    case 'start':
      return (
        <p className="text-xs text-gray-500">
          Gatilho: <span className="font-medium text-gray-700">{node.data.trigger || 'new_contact'}</span>
        </p>
      );
    case 'message':
      return (
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-700 line-clamp-3">{node.data.text || 'Mensagem vazia'}</p>
        </div>
      );
    case 'condition':
      return (
        <p className="text-xs text-gray-500">
          Se <span className="font-medium text-purple-600">{node.data.field || '...'}</span>{' '}
          <span className="text-gray-400">{node.data.operator || '='}</span>{' '}
          <span className="font-medium text-purple-600">{node.data.value || '...'}</span>
        </p>
      );
    case 'ai':
      return (
        <p className="text-xs text-gray-500 line-clamp-2">
          {node.data.prompt || 'Prompt da IA'}
        </p>
      );
    case 'schedule':
      return (
        <p className="text-xs text-gray-500">
          Serviço: <span className="font-medium">{node.data.service || 'auto'}</span>
        </p>
      );
    case 'transfer':
      return (
        <p className="text-xs text-gray-500">
          Para: <span className="font-medium">{node.data.department || 'Atendimento'}</span>
        </p>
      );
    case 'wait':
      return (
        <p className="text-xs text-gray-500">
          Aguardar: <span className="font-medium">{node.data.duration || '5'} {node.data.unit || 'min'}</span>
        </p>
      );
    case 'tag':
      return (
        <p className="text-xs text-gray-500">
          Tag: <span className="inline-flex items-center bg-pink-100 text-pink-700 text-[10px] font-medium px-2 py-0.5 rounded-full">{node.data.tag || 'nova-tag'}</span>
        </p>
      );
    case 'update_lead':
      return (
        <p className="text-xs text-gray-500">
          Estágio: <span className="font-medium">{node.data.stage || 'qualified'}</span>
        </p>
      );
    default:
      return <p className="text-xs text-gray-400">Configurar nó</p>;
  }
}

// ─── Node properties editor ───────────────────────────────────────────────────

function NodePropertiesEditor({
  node,
  onChange,
}: {
  node: FlowNode;
  onChange: (data: Partial<FlowNode>) => void;
}) {
  const nt = NODE_TYPES[node.type];

  return (
    <div className="p-4 space-y-4">
      {/* Node type indicator */}
      <div className={`flex items-center gap-2 p-3 rounded-lg ${nt.bg} ${nt.border} border`}>
        <span className="text-lg">{nt.emoji}</span>
        <div>
          <p className={`text-sm font-semibold ${nt.color}`}>{nt.label}</p>
          <p className="text-[10px] text-gray-500">{nt.description}</p>
        </div>
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nome do nó</label>
        <input
          value={node.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      {/* Type-specific fields */}
      {node.type === 'start' && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Gatilho</label>
          <select
            value={node.data.trigger || 'new_contact'}
            onChange={(e) => onChange({ data: { ...node.data, trigger: e.target.value } })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
          >
            <option value="new_contact">Novo contato</option>
            <option value="keyword">Palavra-chave</option>
            <option value="intent_schedule">Intenção: Agendar</option>
            <option value="intent_buy">Intenção: Comprar</option>
            <option value="new_lead">Novo lead</option>
            <option value="tag_added">Tag adicionada</option>
            <option value="manual">Disparo manual</option>
          </select>
        </div>
      )}

      {node.type === 'message' && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Texto da mensagem</label>
          <textarea
            value={node.data.text || ''}
            onChange={(e) => onChange({ data: { ...node.data, text: e.target.value } })}
            rows={4}
            placeholder="Digite a mensagem..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
          />
          <p className="text-[10px] text-gray-400 mt-1">Use {'{{nome}}'} para personalizar</p>
        </div>
      )}

      {node.type === 'condition' && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Campo</label>
            <input
              value={node.data.field || ''}
              onChange={(e) => onChange({ data: { ...node.data, field: e.target.value } })}
              placeholder="ex: intent, lead_score"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Operador</label>
            <select
              value={node.data.operator || 'equals'}
              onChange={(e) => onChange({ data: { ...node.data, operator: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
            >
              <option value="equals">Igual a</option>
              <option value="not_equals">Diferente de</option>
              <option value="contains">Contém</option>
              <option value="greater_than">Maior que</option>
              <option value="less_than">Menor que</option>
              <option value="exists">Existe</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Valor</label>
            <input
              value={node.data.value || ''}
              onChange={(e) => onChange({ data: { ...node.data, value: e.target.value } })}
              placeholder="ex: agendar, true, 70"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </>
      )}

      {node.type === 'ai' && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Prompt</label>
            <textarea
              value={node.data.prompt || ''}
              onChange={(e) => onChange({ data: { ...node.data, prompt: e.target.value } })}
              rows={4}
              placeholder="Instrução para a IA..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Modelo</label>
            <select
              value={node.data.model || 'sonnet'}
              onChange={(e) => onChange({ data: { ...node.data, model: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
            >
              <option value="sonnet">Claude Sonnet (conversa)</option>
              <option value="haiku">Claude Haiku (rápido)</option>
            </select>
          </div>
        </>
      )}

      {node.type === 'schedule' && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Serviço</label>
            <input
              value={node.data.service || ''}
              onChange={(e) => onChange({ data: { ...node.data, service: e.target.value } })}
              placeholder="auto (detecta do contexto)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mensagem de confirmação</label>
            <input
              value={node.data.confirmMessage || ''}
              onChange={(e) => onChange({ data: { ...node.data, confirmMessage: e.target.value } })}
              placeholder="Agendado com sucesso!"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </>
      )}

      {node.type === 'transfer' && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Departamento</label>
            <select
              value={node.data.department || 'support'}
              onChange={(e) => onChange({ data: { ...node.data, department: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
            >
              <option value="support">Atendimento</option>
              <option value="sales">Vendas</option>
              <option value="finance">Financeiro</option>
              <option value="tech">Suporte técnico</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mensagem de transferência</label>
            <input
              value={node.data.message || ''}
              onChange={(e) => onChange({ data: { ...node.data, message: e.target.value } })}
              placeholder="Vou transferir você para..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </>
      )}

      {node.type === 'wait' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Duração</label>
            <input
              type="number"
              min="1"
              value={node.data.duration || '5'}
              onChange={(e) => onChange({ data: { ...node.data, duration: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Unidade</label>
            <select
              value={node.data.unit || 'min'}
              onChange={(e) => onChange({ data: { ...node.data, unit: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
            >
              <option value="sec">Segundos</option>
              <option value="min">Minutos</option>
              <option value="hour">Horas</option>
              <option value="day">Dias</option>
            </select>
          </div>
        </div>
      )}

      {node.type === 'tag' && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nome da tag</label>
          <input
            value={node.data.tag || ''}
            onChange={(e) => onChange({ data: { ...node.data, tag: e.target.value } })}
            placeholder="ex: cliente-vip, lead-quente"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
      )}

      {node.type === 'update_lead' && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Estágio</label>
            <select
              value={node.data.stage || 'qualified'}
              onChange={(e) => onChange({ data: { ...node.data, stage: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
            >
              <option value="new">Novo</option>
              <option value="contacted">Contatado</option>
              <option value="qualified">Qualificado</option>
              <option value="proposal">Proposta</option>
              <option value="negotiation">Negociação</option>
              <option value="won">Ganho</option>
              <option value="lost">Perdido</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Score</label>
            <select
              value={node.data.scoreField || 'auto'}
              onChange={(e) => onChange({ data: { ...node.data, scoreField: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
            >
              <option value="auto">Automático (IA calcula)</option>
              <option value="+10">+10 pontos</option>
              <option value="+25">+25 pontos</option>
              <option value="+50">+50 pontos</option>
              <option value="set_100">Definir como 100</option>
            </select>
          </div>
        </>
      )}

      {/* Delete node */}
      {node.type !== 'start' && (
        <div className="pt-3 border-t border-gray-100">
          <button
            onClick={() => {
              // This callback triggers up — handled by parent
              onChange({ id: '__DELETE__' } as any);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 size={14} /> Remover nó
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Build ordered nodes from connections ─────────────────────────────────────

function buildNodeOrder(nodes: FlowNode[], connections: FlowConnection[]): FlowNode[] {
  // Find start node
  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) return nodes;

  const ordered: FlowNode[] = [];
  const visited = new Set<string>();
  let currentId: string | null = startNode.id;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodes.find((n) => n.id === currentId);
    if (node) ordered.push(node);
    const nextConn = connections.find((c) => c.sourceId === currentId);
    currentId = nextConn ? nextConn.targetId : null;
  }

  return ordered;
}

// ─── Default data per node type ───────────────────────────────────────────────

function getDefaultData(type: NodeType): Record<string, any> {
  switch (type) {
    case 'start':
      return { trigger: 'new_contact' };
    case 'message':
      return { text: '' };
    case 'condition':
      return { field: '', operator: 'equals', value: '' };
    case 'ai':
      return { prompt: '', model: 'sonnet' };
    case 'schedule':
      return { service: 'auto', confirmMessage: '' };
    case 'transfer':
      return { department: 'support', message: '' };
    case 'wait':
      return { duration: '5', unit: 'min' };
    case 'tag':
      return { tag: '' };
    case 'update_lead':
      return { stage: 'qualified', scoreField: 'auto' };
    default:
      return {};
  }
}
