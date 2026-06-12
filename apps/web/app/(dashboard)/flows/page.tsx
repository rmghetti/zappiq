'use client';

import Link from 'next/link';

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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  MarkerType,
  ConnectionLineType,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Plus, ArrowLeft, Save, Play, Upload, Trash2, Loader2,
  MessageSquare, GitBranch, Sparkles, Tag, BarChart2, Headset, Clock, PlayCircle, Info,
  BookOpen, Download, ArrowRight, X, Zap, ChevronDown, Maximize2, Workflow, History,
} from 'lucide-react';
import { api } from '../../../lib/api';

// Tutorial interativo "Reja sua IA" (HTML self-contained do Claude Design) + PDF
// baixável. Servidos estaticamente de apps/web/public/tutoriais/. Mesmo padrão do
// tutorial de canais (WhatsApp/Instagram): modal grande com <iframe> same-origin.
const MAESTRO_TUTORIAL_HTML = '/tutoriais/maestro-tutorial.html';
const MAESTRO_TUTORIAL_PDF = '/tutoriais/maestro-reja-sua-ia.pdf';

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
  // Maestro v2 — salto entre fluxos (engine: goto_flow com data.targetFlowId).
  // Família âmbar (mesma do transfer/humano): "sai deste fluxo".
  goto_flow:   { kind: 'human',  label: 'Enviar para outro fluxo', icon: Workflow, palette: true },
};

const KIND_STYLE: Record<NodeKind, string> = {
  start:  'bg-gray-100 border-gray-300 text-gray-700',
  fixed:  'bg-slate-50 border-slate-300 text-slate-700',
  ai:     'bg-blue-50 border-blue-300 text-blue-700',
  action: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  human:  'bg-amber-50 border-amber-300 text-amber-700',
};

// Repaginação visual (premium): badge de ícone em gradiente + cor de destaque
// por categoria. Usado nos nós do editor e nos blocos da visão consolidada.
const KIND_BADGE: Record<NodeKind, string> = {
  start:  'linear-gradient(135deg,#64748B,#334155)',
  fixed:  'linear-gradient(135deg,#38BDF8,#2563EB)',
  ai:     'linear-gradient(135deg,#6366F1,#7C3AED)',
  action: 'linear-gradient(135deg,#34D399,#059669)',
  human:  'linear-gradient(135deg,#FBBF24,#EA580C)',
};
const KIND_ACCENT: Record<NodeKind, string> = {
  start:  '#475569', fixed: '#2563EB', ai: '#6366F1', action: '#059669', human: '#EA580C',
};
// Fundo premium do canvas (gradiente suave) — aplicado no container do ReactFlow.
const CANVAS_BG = 'linear-gradient(135deg,#EEF2FF 0%,#F5F3FF 45%,#ECFEFF 100%)';
const EDGE_BASE = { type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8', width: 16, height: 16 }, style: { stroke: '#94A3B8', strokeWidth: 2 } };

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
    case 'goto_flow': return data?.targetFlowName ? `→ ${data.targetFlowName}` : '(sem fluxo de destino)';
    case 'wait': return data?.seconds ? `${data.seconds}s` : 'Pausa';
    case 'start': return 'Cliente inicia conversa';
    default: return '';
  }
}

// ─── Conteúdo didático por tipo de nó (#289 tooltips) ────────────────────────
type NodeDoc = { short: string; whatFor: string; how: string; example: string };
const NODE_DOCS: Record<string, NodeDoc> = {
  message: {
    short: 'Envia um texto fixo, sempre igual, sem depender da IA. É o "trilho fixo" — controle total sobre o que o cliente recebe.',
    whatFor: 'Use para mensagens que precisam ser exatas: boas-vindas, confirmações, avisos, instruções, políticas. Como não passa pela IA, o texto nunca muda nem inventa nada.',
    how: 'Arraste o nó para o canvas, conecte-o ao fluxo e escreva o texto no painel da direita. Pode usar emojis.',
    example: '"Olá! 👋 Seja bem-vindo à Clínica X. Como posso te ajudar hoje?"',
  },
  condition: {
    short: 'Cria uma bifurcação: dependendo da resposta do cliente, o fluxo segue por um caminho ou por outro.',
    whatFor: 'Use para ramificar o atendimento de forma determinística (sem IA): menus, triagem, "se o cliente digitou X, vá por aqui; senão, por ali".',
    how: 'Conecte duas saídas e, em cada conexão (aresta), defina a palavra-chave que leva por aquele caminho.',
    example: 'Se a mensagem contém "orçamento" → caminho Comercial; senão → caminho Suporte.',
  },
  ai: {
    short: 'Entrega a conversa para a IA, que responde usando o conhecimento do seu negócio — a mesma base do seu agente.',
    whatFor: 'Use onde a conversa é aberta e imprevisível: dúvidas, negociação, suporte. A IA entende o contexto e responde naturalmente, sem você roteirizar cada frase.',
    how: 'Conecte ao fluxo e escreva a INSTRUÇÃO do passo (o que a IA deve fazer aqui). Ela combina isso com o conhecimento já treinado e o tom configurado.',
    example: 'Instrução: "Tire dúvidas sobre os planos e, se houver intenção de compra, ofereça agendar uma demonstração."',
  },
  tag: {
    short: 'Marca o contato com uma etiqueta para você organizar e segmentar depois — sem enviar nada ao cliente.',
    whatFor: 'Use para classificar leads automaticamente: "lead-quente", "quer-agendar", "pos-venda". As tags aparecem no CRM e podem alimentar campanhas.',
    how: 'Conecte no ponto do fluxo onde quer marcar e escreva o nome da tag (curto, em minúsculas, com hífens).',
    example: 'Quando o cliente pede orçamento, marque "lead-quente" para o time priorizar.',
  },
  update_lead: {
    short: 'Grava uma informação no cadastro do contato (um campo e um valor), automaticamente durante a conversa.',
    whatFor: 'Use para enriquecer o lead sem digitação manual: origem, interesse, etapa do funil ou qualquer campo personalizado.',
    how: 'Defina o campo (ex.: "origem") e o valor (ex.: "instagram"). Campos conhecidos vão para as colunas do contato; o resto entra em campos personalizados.',
    example: 'Atualizar "funil" = "qualificado" assim que o lead responde às perguntas-chave.',
  },
  transfer: {
    short: 'Transfere a conversa para um atendente humano e pausa a IA naquele contato.',
    whatFor: 'Use quando o caso exige uma pessoa: negociação sensível, reclamação, fechamento. Evita que a IA force algo fora do seu alcance.',
    how: 'Conecte no ponto de handoff. A conversa entra na fila do time e a IA para de responder até um humano assumir.',
    example: 'Se o cliente diz "quero falar com alguém", transfira para o time comercial.',
  },
  goto_flow: {
    short: 'Envia a conversa para outro fluxo da sua operação — o atendimento continua de lá, sem o cliente perceber a troca.',
    whatFor: 'Use para interligar especialistas: o fluxo de atendimento detecta intenção de compra e passa o bastão pro fluxo de vendas, por exemplo.',
    how: 'Conecte no ponto do salto e escolha o fluxo de destino no painel da direita. O motor segue no outro fluxo a partir do início dele.',
    example: 'No fluxo de Atendimento, se o cliente quer agendar, envie para o fluxo "Agendamento".',
  },
  wait: {
    short: 'Faz uma pausa antes do próximo passo — para dar ritmo natural à conversa ou esperar um intervalo.',
    whatFor: 'Use para não disparar tudo de uma vez: aguardar alguns segundos entre mensagens ou pausar antes de um follow-up.',
    how: 'Defina o tempo de espera. O fluxo retoma sozinho depois do intervalo.',
    example: 'Enviar boas-vindas, aguardar 3s e então mandar o menu de opções.',
  },
};

// Item da paleta com tooltip didático (hover ~1,2s) + atalho "Veja mais".
function PaletteItem({
  type, meta, onAdd, onInfo,
}: {
  type: string;
  meta: { kind: NodeKind; label: string; icon: any };
  onAdd: (t: string) => void;
  onInfo: (t: string) => void;
}) {
  // Tooltip posicionado com position:fixed (escapa do overflow da paleta, que
  // antes recortava a caixinha). Coordenadas calculadas a partir do botão.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const Icon = meta.icon;
  const doc = NODE_DOCS[type];
  const enter = () => {
    if (!doc) return;
    timer.current = setTimeout(() => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ x: r.right + 8, y: r.top });
    }, 600);
  };
  const leave = () => { if (timer.current) clearTimeout(timer.current); setPos(null); };
  return (
    <div onMouseEnter={enter} onMouseLeave={leave}>
      <button
        ref={btnRef}
        onClick={() => onAdd(type)}
        className={`w-full mb-1.5 rounded-lg border px-2.5 py-2 text-left text-xs flex items-center gap-2 ${KIND_STYLE[meta.kind]} hover:opacity-80`}
      >
        <Icon size={14} />
        <span className="flex-1 truncate">{meta.label}</span>
        {doc && (
          <span
            onClick={(e) => { e.stopPropagation(); onInfo(type); }}
            className="opacity-60 hover:opacity-100"
            title="O que é este nó?"
          >
            <Info size={13} />
          </span>
        )}
      </button>
      {pos && doc && (
        <div
          style={{ position: 'fixed', left: pos.x, top: pos.y }}
          className="z-50 w-60 rounded-lg border border-gray-200 bg-white shadow-xl p-3 text-xs"
        >
          <p className="font-semibold text-gray-900 mb-1">{meta.label}</p>
          <p className="text-gray-600 leading-snug">{doc.short}</p>
          <button
            onClick={(e) => { e.stopPropagation(); onInfo(type); }}
            className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Veja mais →
          </button>
        </div>
      )}
    </div>
  );
}

// Popup detalhado de um nó (o que faz / quando usar / como usar / exemplo).
function NodeDocModal({ type, onClose }: { type: string; onClose: () => void }) {
  const meta = metaFor(type);
  const doc = NODE_DOCS[type];
  if (!doc) return null;
  const Icon = meta.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${KIND_STYLE[meta.kind]}`}><Icon size={18} /></div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">{meta.label}</h3>
            <p className="text-xs text-gray-500">{doc.short}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Para que serve</p>
            <p className="text-gray-700 leading-relaxed">{doc.whatFor}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Como usar</p>
            <p className="text-gray-700 leading-relaxed">{doc.how}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Exemplo</p>
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-gray-700 italic">{doc.example}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Nó customizado React Flow ───────────────────────────────────────────────
const HANDLE_STYLE = { width: 9, height: 9, background: '#fff', border: '2px solid #94A3B8' } as const;

function MaestroNode({ id, type, data, selected }: NodeProps) {
  const meta = metaFor(type);
  const Icon = meta.icon;
  const summary = nodeSummary(type, data);
  const accent = KIND_ACCENT[meta.kind];
  const { deleteElements } = useReactFlow();
  return (
    <div
      className="group relative w-[212px] rounded-2xl bg-white transition-all"
      style={{
        border: `1px solid ${selected ? accent : '#E8EDF4'}`,
        boxShadow: selected
          ? `0 0 0 3px ${accent}22, 0 10px 24px -8px ${accent}55`
          : '0 6px 18px -10px rgba(15,23,42,0.25), 0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      {type !== 'start' && <Handle type="target" position={Position.Top} style={{ ...HANDLE_STYLE, borderColor: accent }} />}
      {type !== 'start' && (
        <button
          onClick={(e) => { e.stopPropagation(); deleteElements({ nodes: [{ id }] }); }}
          title="Excluir este quadro"
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 shadow-sm flex items-center justify-center text-[12px] leading-none opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-opacity z-10"
        >
          ×
        </button>
      )}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: KIND_BADGE[meta.kind] }}>
          <Icon size={17} color="#fff" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{data?.label || meta.label}</p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{summary || meta.label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...HANDLE_STYLE, borderColor: accent }} />
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
  // Maestro v2 — desempate do roteador multi-fluxo (0–999, maior ganha).
  priority?: number;
  // MAESTRO INTELIGENTE (Onda 3): treinamento mudou depois do fluxo ser gerado/editado.
  stale?: boolean;
}

// Preview da atualização inteligente (POST /:id/refresh-suggestion).
type FlowRefresh = {
  name: string;
  nodes: any[];
  edges: any[];
  changeNote: string;
  newWelcome?: string;
  oldWelcome?: string;
  source: 'ai' | 'fallback';
  // Maestro v2 — diff campo a campo do refresh multi-nó (quando disponível).
  diff?: { nodeId: string; field: string; before: string; after: string }[];
};

// Item do histórico de versões (GET /api/flows/:id/versions).
type FlowVersionItem = {
  id: string;
  version: number;
  name: string;
  source: string; // publish | refresh | restore
  createdById?: string | null;
  createdAt: string;
};

const VERSION_SOURCE_LABEL: Record<string, string> = {
  publish: 'Publicação',
  refresh: 'Atualização inteligente',
  restore: 'Restauração',
};

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
// API → React Flow (mesmo mapeamento do estado inicial; reusado pelo restore).
function apiNodesToCanvas(apiNodes: any[]): Node[] {
  return (apiNodes || []).map((n: any, i: number): Node => ({
    id: n.id || genId('n'),
    type: NODE_META[n.type] ? n.type : 'message',
    position: n.position && typeof n.position.x === 'number' ? n.position : { x: 120, y: 60 + i * 110 },
    data: { ...(n.data || {}), label: n.data?.label || n.label || metaFor(n.type).label },
  }));
}
function apiEdgesToCanvas(apiEdges: any[]): Edge[] {
  return (apiEdges || []).map((e: any): Edge => ({
    id: e.id || genId('e'),
    source: e.source,
    target: e.target,
    label: e.data?.when?.value || undefined,
    data: e.data || {},
  }));
}

function FlowEditor({ flow, allFlows, onBack, onSaved }: { flow: ApiFlow; allFlows: ApiFlow[]; onBack: () => void; onSaved: () => void }) {
  const [name, setName] = useState(flow.name);
  const [priority, setPriority] = useState<number>(flow.priority ?? 0);
  const [nodes, setNodes, onNodesChange] = useNodesState(apiNodesToCanvas(flow.nodes || []));
  const [edges, setEdges, onEdgesChange] = useEdgesState(apiEdgesToCanvas(flow.edges || []));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState('quero um orçamento\nsim, por favor');
  const [testTurns, setTestTurns] = useState<TestTurn[] | null>(null);
  const [docType, setDocType] = useState<string | null>(null); // popup didático do nó
  const [error, setError] = useState<string | null>(null);
  // Maestro v2 — histórico de versões + restore (modal)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<FlowVersionItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
      await api.put(`/api/flows/${flow.id}`, { name, priority, nodes: g.nodes, edges: g.edges });
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar');
    } finally { setSaving(false); }
  }

  async function publish() {
    setPublishing(true); setError(null);
    try {
      const g = toApiGraph();
      await api.put(`/api/flows/${flow.id}`, { name, priority, nodes: g.nodes, edges: g.edges });
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
      await api.put(`/api/flows/${flow.id}`, { name, priority, nodes: g.nodes, edges: g.edges });
      const messages = testInput.split('\n').map((s) => s.trim()).filter(Boolean);
      const res = await api.post<{ success: boolean; data: { turns: TestTurn[] } }>(
        `/api/flows/${flow.id}/test`, { messages },
      );
      setTestTurns(res?.data?.turns || []);
    } catch (e: any) {
      setError(e?.message || 'Falha ao testar');
    } finally { setTesting(false); }
  }

  // Maestro v2 — abre o histórico (snapshots imutáveis publish/refresh/restore).
  async function openHistory() {
    setHistoryOpen(true); setVersions(null); setHistoryError(null); setHistoryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: FlowVersionItem[] }>(`/api/flows/${flow.id}/versions`);
      setVersions(res?.data || []);
    } catch (e: any) {
      setHistoryError(e?.message || 'Falha ao carregar o histórico');
    } finally { setHistoryLoading(false); }
  }

  // Restaura uma versão (vira NOVA versão no histórico) e recarrega o canvas.
  async function restoreVersion(v: FlowVersionItem) {
    const ok = window.confirm(`Restaurar a versão ${v.version} ("${v.name}")? O fluxo atual vira uma nova versão no histórico — nada se perde.`);
    if (!ok) return;
    setRestoringId(v.id); setHistoryError(null);
    try {
      const res = await api.post<{ success: boolean; data: ApiFlow }>(`/api/flows/${flow.id}/restore/${v.id}`);
      const restored = res?.data;
      if (restored) {
        // Recarrega o fluxo restaurado no canvas (mesmo mapeamento do load inicial).
        setName(restored.name);
        setPriority(restored.priority ?? 0);
        setNodes(apiNodesToCanvas(restored.nodes || []));
        setEdges(apiEdgesToCanvas(restored.edges || []));
        setSelectedNodeId(null); setSelectedEdgeId(null);
      }
      setHistoryOpen(false); setVersions(null);
      onSaved();
    } catch (e: any) {
      setHistoryError(e?.message || 'Falha ao restaurar a versão');
    } finally { setRestoringId(null); }
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
          <button onClick={openHistory} disabled={historyLoading} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
            {historyLoading ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />} Histórico
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
          {Object.entries(NODE_META).filter(([, m]) => m.palette).map(([type, m]) => (
            <PaletteItem key={type} type={type} meta={m} onAdd={addNode} onInfo={setDocType} />
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0" style={{ background: CANVAS_BG }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={EDGE_BASE}
            connectionLineType={ConnectionLineType.SmoothStep}
            onNodeClick={(_, n) => { setSelectedNodeId(n.id); setSelectedEdgeId(null); }}
            onEdgeClick={(_, e) => { setSelectedEdgeId(e.id); setSelectedNodeId(null); }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#C7D2FE" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(99,102,241,0.08)" nodeColor="#A5B4FC" />
          </ReactFlow>
        </div>

        {/* Propriedades */}
        <div className="w-64 border-l border-gray-200 bg-white p-3 overflow-y-auto">
          {!selectedNode && !selectedEdge && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">Configurações do fluxo</p>
              <label className="block text-xs text-gray-600 mb-1">Prioridade (desempate do roteador)</label>
              <input
                type="number"
                min={0}
                max={999}
                value={priority}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  setPriority(Number.isFinite(n) ? Math.min(999, Math.max(0, n)) : 0);
                }}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400"
              />
              <p className="text-[10px] text-gray-400 mt-1.5 mb-4">Quando mais de um fluxo ativo pode atender a conversa, o de maior prioridade ganha. 0 a 999.</p>
              <p className="text-xs text-gray-400">Selecione um nó ou uma conexão para editar.</p>
            </div>
          )}

          {selectedNode && (
            <NodeProperties
              key={selectedNode.id}
              type={selectedNode.type || 'message'}
              data={selectedNode.data}
              otherFlows={allFlows.filter((f) => f.id !== flow.id)}
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

      {/* Popup didático do nó (#289) */}
      {docType && <NodeDocModal type={docType} onClose={() => setDocType(null)} />}

      {/* Maestro v2 — Histórico de versões + restore */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!restoringId) { setHistoryOpen(false); setVersions(null); } }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shrink-0"><History size={18} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">Histórico de versões</h3>
                <p className="text-sm text-gray-600 mt-0.5">Cada publicação, atualização inteligente ou restauração vira uma versão. Restaurar nunca apaga nada — cria uma versão nova.</p>
              </div>
              <button onClick={() => { if (!restoringId) { setHistoryOpen(false); setVersions(null); } }} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="p-5">
              {historyError && <div className="mb-3 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{historyError}</div>}
              {historyLoading && (
                <div className="flex items-center gap-2 text-gray-500 py-6 justify-center"><Loader2 size={18} className="animate-spin" /> Carregando histórico…</div>
              )}
              {!historyLoading && versions && versions.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">Ainda não há versões. Publique o fluxo pra criar a primeira.</p>
              )}
              {!historyLoading && versions && versions.length > 0 && (
                <ul className="space-y-2">
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">v{v.version} · {v.name}</p>
                        <p className="text-xs text-gray-400">
                          {VERSION_SOURCE_LABEL[v.source] || v.source} · {new Date(v.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreVersion(v)}
                        disabled={!!restoringId}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                      >
                        {restoringId === v.id ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />} Restaurar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Textarea que cresce com o conteúdo (sempre mostra o texto completo).
function AutoGrowTextarea({ value, onChange, className, placeholder }: {
  value: string; onChange: (next: string) => void; className?: string; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className={className}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  );
}

// ─── Painel de propriedades por tipo de nó ───────────────────────────────────
function NodeProperties({ type, data, otherFlows, onChange, onDelete }: {
  type: string; data: any; otherFlows?: { id: string; name: string }[];
  onChange: (p: Record<string, any>) => void; onDelete: () => void;
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
          <AutoGrowTextarea value={data?.text || ''} onChange={(v) => onChange({ text: v })} className={inputCls} />
        </>
      )}

      {type === 'ai' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Instrução do passo (a Iza assume)</label>
          <AutoGrowTextarea
            value={data?.prompt || ''}
            onChange={(v) => onChange({ prompt: v })}
            placeholder="Ex: Tire dúvidas sobre os planos e ofereça agendar uma demonstração."
            className={`${inputCls} mb-2`}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            A Iza usa o modelo de IA automaticamente (otimizado pela ZappIQ) e reaproveita a identidade + conhecimento (RAG) que você treinou. Você não precisa escolher modelo.
          </p>
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

      {type === 'goto_flow' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Fluxo de destino</label>
          <select
            value={data?.targetFlowId || ''}
            onChange={(e) => {
              const target = (otherFlows || []).find((f) => f.id === e.target.value);
              onChange({ targetFlowId: e.target.value || undefined, targetFlowName: target?.name || undefined });
            }}
            className={inputCls}
          >
            <option value="">— escolher fluxo —</option>
            {(otherFlows || []).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1.5">A conversa continua no fluxo escolhido, sem o cliente perceber a troca.</p>
        </>
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

// MAESTRO INTELIGENTE — objetivos oferecidos no wizard (chave = goal do backend).
const OBJECTIVE_OPTIONS: { goal: string; label: string; hint: string }[] = [
  { goal: 'atendimento', label: 'Atendimento & dúvidas', hint: 'Recebe o cliente e responde com o conhecimento do negócio.' },
  { goal: 'qualificação', label: 'Qualificação de leads', hint: 'Faz perguntas-chave pra entender necessidade e fit do lead.' },
  { goal: 'vendas', label: 'Vendas', hint: 'Conduz a compra, trata objeções e leva ao fechamento.' },
  { goal: 'agendamento', label: 'Agendamento', hint: 'Coleta serviço e melhor horário e confirma.' },
  { goal: 'faq', label: 'Tira-dúvidas (FAQ)', hint: 'Responde perguntas frequentes na base de conhecimento.' },
  { goal: 'posvenda', label: 'Suporte / Pós-venda', hint: 'Status de pedido, troca, dúvida de uso — tom acolhedor.' },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAPA DA OPERAÇÃO (Fluxos Consolidados) — MAESTRO INTELIGENTE 2.0
// Visão única, visual e editável, de TODOS os fluxos e de como se interligam
// (handoffs, cada conexão rotulada com a intenção que dispara o salto). Os nós
// de fluxo são EXPANSÍVEIS tipo mapa mental: clicar abre a cadeia de atividades
// daquele fluxo ali mesmo. Salva em settings.consolidatedMap. O roteamento ao
// vivo entre fluxos é a próxima onda dedicada (motor multi-fluxo).
// ═══════════════════════════════════════════════════════════════════════════
type ConsolidatedMapData = { positions?: Record<string, {x:number;y:number}>; edges?: any[] };

// Nó de entrada (cliente) — círculo em gradiente, estilo "hub" da operação.
function ClientEntryNode() {
  return (
    <div className="flex flex-col items-center" style={{ width: 150 }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg,#6366F1,#7C3AED)' }}>
        <MessageSquare size={28} color="#fff" />
      </div>
      <p className="mt-2 text-[12px] font-semibold text-slate-700 text-center leading-tight">Cliente<br/>Primeiro contato</p>
      <Handle type="source" position={Position.Right} style={{ ...HANDLE_STYLE, borderColor: '#6366F1' }} />
    </div>
  );
}
// Bloco de fluxo — card premium expansível (mapa mental). Header abre/fecha a
// cadeia de atividades do fluxo; botão interno abre o editor.
function FlowBlockNode({ data }: NodeProps) {
  const [open, setOpen] = useState(false);
  const active = !!data?.active;
  const acts: { type: string; summary: string }[] = Array.isArray(data?.activities) ? data.activities : [];
  return (
    <div className="relative w-[262px] rounded-2xl bg-white" style={{ border: open ? '1px solid #C7D2FE' : '1px solid #E8EDF4', boxShadow: open ? '0 14px 34px -12px rgba(79,70,229,0.45), 0 1px 2px rgba(15,23,42,0.05)' : '0 8px 22px -10px rgba(79,70,229,0.30), 0 1px 2px rgba(15,23,42,0.05)' }}>
      <Handle type="target" position={Position.Left} style={{ ...HANDLE_STYLE, borderColor: '#6366F1' }} />
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#6366F1,#7C3AED)' }}>
          <GitBranch size={17} color="#fff" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{data?.label}</p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: active ? '#059669' : '#94A3B8' }}>
            {active ? '● Ativo' : `${acts.length} ${acts.length === 1 ? 'atividade' : 'atividades'}`} · {open ? 'recolher' : 'ver a cadeia'}
          </p>
        </div>
        <ChevronDown size={16} className="text-slate-400 shrink-0" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100">
          <ol className="space-y-1.5 mt-2">
            {acts.map((a, i) => {
              const m = metaFor(a.type);
              const Icon = m.icon;
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: KIND_BADGE[m.kind] }}>
                    <Icon size={12} color="#fff" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-700 leading-tight">{m.label}</p>
                    <p className="text-[10px] text-slate-400 leading-snug" style={{ maxWidth: 200, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.summary}</p>
                  </div>
                </li>
              );
            })}
            {acts.length === 0 && <li className="text-[11px] text-slate-400">Sem atividades ainda.</li>}
          </ol>
          {typeof data?.onEdit === 'function' && (
            <button type="button" onClick={(e) => { e.stopPropagation(); data.onEdit(); }} className="mt-2.5 w-full text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg py-1.5 flex items-center justify-center gap-1 border border-indigo-100">
              <Play size={11} /> Abrir e editar fluxo
            </button>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ ...HANDLE_STYLE, borderColor: '#6366F1' }} />
    </div>
  );
}

function ConsolidatedMapInner({ flows, onBack, onEditFlow, inline, onArchitect, architecting, journeyNote, onExpandFull }: {
  flows: ApiFlow[];
  onBack?: () => void;
  onEditFlow: (f: ApiFlow) => void;
  inline?: boolean;
  onArchitect?: () => void;
  architecting?: boolean;
  journeyNote?: string;
  onExpandFull?: () => void;
}) {
  const [origSettings, setOrigSettings] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const cNodeTypes = useMemo(() => ({ clientEntry: ClientEntryNode, flowBlock: FlowBlockNode }), []);
  const nameOf = useCallback((id: string) => (id === 'entry' ? 'Cliente' : (nodes.find((n) => n.id === id)?.data as any)?.label || 'fluxo'), [nodes]);
  const selEdge = edges.find((e) => e.id === selEdgeId) || null;

  useEffect(() => {
    let cancel = false;
    (async () => {
      let map: ConsolidatedMapData = {};
      try {
        const res = await api.get<{ success: boolean; data: any }>('/api/settings');
        const st = (res?.data?.settings as any) || {};
        setOrigSettings(st);
        map = (st.consolidatedMap as ConsolidatedMapData) || {};
      } catch { /* fail-soft */ }
      if (cancel) return;
      const pos = map.positions || {};
      // Nó de entrada (cliente) + um nó por fluxo — tipos custom (premium).
      const initNodes: Node[] = [{
        id: 'entry', type: 'clientEntry', position: pos['entry'] || { x: 40, y: 240 },
        data: {},
      }];
      flows.forEach((f, i) => {
        const activities = (Array.isArray(f.nodes) ? f.nodes : [])
          .filter((n: any) => n?.type && n.type !== 'start')
          .map((n: any) => ({ type: n.type, summary: nodeSummary(n.type, n.data) }));
        initNodes.push({
          id: f.id, type: 'flowBlock', position: pos[f.id] || { x: 360, y: 40 + i * 150 },
          data: { label: f.name, active: f.isActive, activities, onEdit: () => onEditFlow(f) },
        });
      });
      // Edges salvas (handoffs com rótulo de intenção), OU default: entrada → cada fluxo.
      let initEdges: Edge[] = Array.isArray(map.edges) && map.edges.length
        ? map.edges.map((e:any)=>({ ...EDGE_BASE, ...e, animated:true, labelStyle:{ fontSize:10, fontWeight:600, fill:'#4F46E5' }, labelBgStyle:{ fill:'#EEF2FF', fillOpacity:0.95 }, labelBgPadding:[6,3] as [number,number], labelBgBorderRadius:6 }))
        : flows.map((f) => ({ id:`entry-${f.id}`, source:'entry', target:f.id, ...EDGE_BASE, animated:true }));
      // Garante que edges só referenciem nós existentes (fluxo pode ter sido excluído).
      const ids = new Set(initNodes.map(n=>n.id));
      initEdges = initEdges.filter((e:any)=>ids.has(e.source)&&ids.has(e.target));
      setNodes(initNodes); setEdges(initEdges); setLoaded(true);
    })();
    return () => { cancel = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flows]);

  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => addEdge({ ...c, animated:true, style:{stroke:'#4F46E5'}, label:'encaminha', data:{}, labelStyle:{ fontSize:10, fontWeight:600, fill:'#4F46E5' }, labelBgStyle:{ fill:'#EEF2FF', fillOpacity:0.95 } }, eds));
  }, [setEdges]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => { setSelEdgeId(edge.id); }, []);
  const updateSelEdge = useCallback((patch: { label?: string; why?: string }) => {
    if (!selEdgeId) return;
    setEdges((eds) => eds.map((e) => e.id === selEdgeId
      ? { ...e, ...(patch.label !== undefined ? { label: patch.label } : {}), data: { ...(e.data || {}), ...(patch.why !== undefined ? { why: patch.why } : {}) } }
      : e));
  }, [selEdgeId, setEdges]);
  const deleteSelEdge = useCallback(() => {
    if (!selEdgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== selEdgeId));
    setSelEdgeId(null);
  }, [selEdgeId, setEdges]);

  // Conexões com rótulo (handoffs) — alimenta o painel "por que o Maestro desenhou assim".
  const handoffEdges = edges.filter((e) => e.source !== 'entry' && e.label);

  async function save() {
    setSaving(true); setSavedMsg(false);
    try {
      const positions: Record<string,{x:number;y:number}> = {};
      nodes.forEach((n) => { positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) }; });
      const cleanEdges = edges.map((e) => ({ id:e.id, source:e.source, target:e.target, label:e.label, data:e.data || {}, style:e.style, animated:true }));
      await api.put('/api/settings', { settings: { ...origSettings, consolidatedMap: { positions, edges: cleanEdges } } });
      setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2500);
    } catch { /* noop */ } finally { setSaving(false); }
  }

  const canvas = (
    <div className={`rounded-2xl border border-gray-200 overflow-hidden ${inline ? 'h-[440px]' : 'flex-1'}`} style={{ background: CANVAS_BG }}>
      {!loaded ? (
        <div className="h-full flex items-center justify-center text-gray-500 gap-2"><Loader2 size={18} className="animate-spin" /> Montando o mapa…</div>
      ) : flows.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg,#6366F1,#7C3AED)' }}><Workflow size={24} color="#fff" /></div>
          <p className="text-sm text-gray-500 max-w-sm">Deixe o Maestro <strong>arquitetar sua operação inteira</strong> — do primeiro contato ao pós-venda — e veja tudo interligado aqui.</p>
          {onArchitect && (
            <button onClick={onArchitect} disabled={architecting} className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
              {architecting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {architecting ? 'O Maestro está desenhando…' : 'Maestro, arquitete minha operação'}
            </button>
          )}
        </div>
      ) : (
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onEdgeClick={onEdgeClick} nodeTypes={cNodeTypes}
          defaultEdgeOptions={EDGE_BASE} connectionLineType={ConnectionLineType.SmoothStep}
          fitView proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#C7D2FE" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable maskColor="rgba(99,102,241,0.08)" nodeColor="#A5B4FC" />
        </ReactFlow>
      )}
    </div>
  );

  // Editor da conexão selecionada + painel de racional do Maestro (compartilhado).
  const extras = flows.length > 0 ? (
    <>
      {selEdge && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <ArrowRight size={15} className="text-indigo-600" />
              {nameOf(selEdge.source)} <span className="text-indigo-400">→</span> {nameOf(selEdge.target)}
            </p>
            <button onClick={() => setSelEdgeId(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
          </div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Quando salta (condição/intenção)</label>
          <input
            value={typeof selEdge.label === 'string' ? selEdge.label : ''}
            onChange={(e) => updateSelEdge({ label: e.target.value })}
            placeholder="ex.: objeção de preço"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 mt-3">Por que o Maestro ligou assim</label>
          <textarea
            value={(selEdge.data as any)?.why || ''}
            onChange={(e) => updateSelEdge({ why: e.target.value })}
            rows={2}
            placeholder="Racional da conexão (opcional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <button onClick={deleteSelEdge} className="text-xs font-medium text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"><Trash2 size={13} /> Excluir conexão</button>
            <span className="text-[11px] text-gray-400">As mudanças entram ao clicar em “Salvar mapa”.</span>
          </div>
        </div>
      )}

      {handoffEdges.length > 0 && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white">
          <button onClick={() => setShowRationale((v) => !v)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Sparkles size={15} className="text-indigo-600" /> Por que o Maestro desenhou assim ({handoffEdges.length} transições)</span>
            <ChevronDown size={16} className="text-gray-400" style={{ transform: showRationale ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {showRationale && (
            <ul className="px-4 pb-3 space-y-2 border-t border-gray-100 pt-3">
              {handoffEdges.map((e) => (
                <li key={e.id} className="flex gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900">{nameOf(e.source)} → {nameOf(e.target)} <span className="text-indigo-600 font-normal">· {typeof e.label === 'string' ? e.label : ''}</span></p>
                    {(e.data as any)?.why && <p className="text-xs text-gray-500">{(e.data as any).why}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  ) : null;

  // ── Modo inline (painel-herói no /flows, abaixo do MAESTRO INTELIGENTE) ──
  if (inline) {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shrink-0"><Workflow size={20} /></div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">Mapa da Operação</h2>
              <p className="text-xs text-gray-500">Todos os seus fluxos e como se interligam, numa visão única. Clique num fluxo pra abrir a cadeia de atividades.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {flows.length > 0 && onArchitect && (
              <button onClick={onArchitect} disabled={architecting} title="Refazer a operação completa com o Maestro" className="px-3 py-2 rounded-lg text-xs font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 disabled:opacity-50">
                {architecting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Arquitetar
              </button>
            )}
            {flows.length > 0 && (
              <button onClick={save} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
              </button>
            )}
            {onExpandFull && flows.length > 0 && (
              <button onClick={onExpandFull} className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-black flex items-center gap-1.5"><Maximize2 size={14} /> Tela cheia</button>
            )}
          </div>
        </div>
        {savedMsg && <p className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full inline-block mb-2">Mapa salvo</p>}
        {journeyNote && <p className="text-sm text-gray-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3">{journeyNote}</p>}
        {canvas}
        {extras}
      </div>
    );
  }

  // ── Modo tela cheia ──
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {onBack && <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ArrowLeft size={18} /></button>}
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mapa da Operação</h1>
            
        <Link href="/flows/templates" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-full hover:bg-violet-100 mb-4">
          ✨ Ver 15 templates prontos por vertical
        </Link>
        <p className="text-xs text-gray-500">Como seus fluxos se interligam, numa visão única. Clique num fluxo pra abrir a cadeia de atividades; arraste conexões entre fluxos.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedMsg && <span className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full">Mapa salvo</span>}
          {onArchitect && (
            <button onClick={onArchitect} disabled={architecting} className="px-4 py-2 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 disabled:opacity-50">
              {architecting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Arquitetar com o Maestro
            </button>
          )}
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar mapa
          </button>
        </div>
      </div>
      {journeyNote && <p className="text-sm text-gray-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3">{journeyNote}</p>}
      {canvas}
      {extras}
      <p className="text-[11px] text-gray-400 mt-2">Dica: clique numa conexão pra editar a intenção que a dispara ou excluí-la. Cada Nó-IA já sai ciente dessas transições (handoff “quente”). O roteamento automático ao vivo entre fluxos chega na próxima atualização do Maestro.</p>
    </div>
  );
}

function ConsolidatedMap(props: {
  flows: ApiFlow[]; onBack?: () => void; onEditFlow: (f: ApiFlow) => void;
  inline?: boolean; onArchitect?: () => void; architecting?: boolean; journeyNote?: string; onExpandFull?: () => void;
}) {
  return <ReactFlowProvider><ConsolidatedMapInner {...props} /></ReactFlowProvider>;
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<ApiFlow[] | null>(null);
  const [editing, setEditing] = useState<ApiFlow | null>(null);
  const [view, setView] = useState<'list' | 'consolidated'>('list');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // MAESTRO INTELIGENTE — wizard que lê todo o ai-training e gera 1+ fluxos
  const [generating, setGenerating] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [objectives, setObjectives] = useState<string[]>(['atendimento']);
  const [multiAgent, setMultiAgent] = useState(false);
  const [smartDrafts, setSmartDrafts] = useState<FlowDraft[] | null>(null);
  const [smartNote, setSmartNote] = useState('');
  // MAESTRO INTELIGENTE 2.0 — Arquiteto de Jornada: desenha a operação inteira.
  const [architecting, setArchitecting] = useState(false);
  const [journeyNote, setJourneyNote] = useState('');
  // Atualização inteligente (Onda 3): treino mudou → sugerir + aplicar 1 clique
  const [refreshTarget, setRefreshTarget] = useState<ApiFlow | null>(null);
  const [refreshPreview, setRefreshPreview] = useState<FlowRefresh | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // tutorial interativo (modal iframe)
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // O tutorial roda dentro de um <iframe>; ele avisa o parent por postMessage
  // quando o usuário fecha/conclui. Esc também fecha.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e?.data === 'zappiq-tutorial-close') setTutorialOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setTutorialOpen(false);
    }
    if (tutorialOpen) {
      window.addEventListener('message', onMessage);
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('message', onMessage);
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [tutorialOpen]);

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
        priority: 0,
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

  function toggleObjective(goal: string) {
    setObjectives((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }

  // MAESTRO INTELIGENTE: gera 1+ fluxos lendo TODO o ai-training do cliente.
  async function runSmart() {
    if (objectives.length === 0) { setError('Escolha pelo menos um objetivo.'); return; }
    setGenerating(true); setError(null); setSmartDrafts(null);
    try {
      const res = await api.post<{ success: boolean; data: { drafts: FlowDraft[]; note: string } }>(
        '/api/flows/generate-smart',
        { objectives, multiAgent: multiAgent && objectives.length > 1 },
      );
      if (res?.data) { setSmartDrafts(res.data.drafts || []); setSmartNote(res.data.note || ''); }
    } catch (e: any) {
      setError(e?.message || 'O Maestro não conseguiu montar agora. Tente de novo.');
    } finally { setGenerating(false); }
  }

  // Aceita um draft: persiste como fluxo novo e abre o editor.
  async function acceptDraft(d: FlowDraft) {
    setCreating(true); setError(null);
    try {
      const res = await api.post<{ success: boolean; data: ApiFlow }>('/api/flows', {
        name: d.name,
        triggerType: d.triggerType,
        triggerConfig: d.triggerConfig || {},
        nodes: d.nodes,
        edges: d.edges,
      });
      setSmartOpen(false); setSmartDrafts(null);
      if (res?.data) setEditing(res.data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar o fluxo gerado');
    } finally { setCreating(false); }
  }

  // Cria TODOS os drafts gerados de uma vez (multi-agente). Persiste cada um e
  // volta pra lista — onde o cliente seleciona, edita ou exclui cada fluxo.
  async function createAllDrafts() {
    if (!smartDrafts || smartDrafts.length === 0) return;
    setCreating(true); setError(null);
    try {
      for (const d of smartDrafts) {
        await api.post('/api/flows', {
          name: d.name,
          triggerType: d.triggerType,
          triggerConfig: d.triggerConfig || {},
          nodes: d.nodes,
          edges: d.edges,
        });
      }
      setSmartOpen(false); setSmartDrafts(null);
      load();
    } catch (e: any) {
      setError(e?.message || 'Falha ao criar os fluxos gerados');
    } finally { setCreating(false); }
  }

  // MAESTRO INTELIGENTE 2.0 — Arquiteto de Jornada: gera a operação inteira
  // (1 fluxo por objetivo + malha de handoffs), persiste todos os fluxos e
  // salva o mapa de interligações (settings.consolidatedMap) com os rótulos de
  // intenção. Depois recarrega a lista e o Mapa da Operação mostra tudo.
  async function runJourney() {
    if (architecting) return;
    if (flows && flows.length > 0) {
      const ok = window.confirm('O Maestro vai desenhar a operação completa (Atendimento, Qualificação, Agendamento, Vendas, FAQ, Pós-venda) e criar esses fluxos interligados. Os fluxos atuais continuam na lista. Seguir?');
      if (!ok) return;
    }
    setArchitecting(true); setError(null); setJourneyNote('');
    try {
      const res = await api.post<{ success: boolean; data: { flows: { goal: string; draft: FlowDraft }[]; handoffs: { from: string; to: string; intent: string; why: string }[]; summary: string; note: string } }>(
        '/api/flows/generate-journey', {},
      );
      const data = res?.data;
      if (!data || !Array.isArray(data.flows) || data.flows.length === 0) {
        setError('O Maestro não conseguiu desenhar a operação agora. Tente de novo.');
        return;
      }
      // Persiste cada fluxo e mapeia objetivo → id criado (pra ligar os handoffs).
      const goalToId: Record<string, string> = {};
      let firstId: string | null = null;
      for (const jf of data.flows) {
        const created = await api.post<{ success: boolean; data: ApiFlow }>('/api/flows', {
          name: jf.draft.name,
          triggerType: jf.draft.triggerType,
          triggerConfig: jf.draft.triggerConfig || {},
          nodes: jf.draft.nodes,
          edges: jf.draft.edges,
        });
        const id = created?.data?.id;
        if (id) { goalToId[jf.goal] = id; if (!firstId) firstId = id; }
      }
      // Monta as arestas do Mapa: entrada → 1o contato + handoffs rotulados.
      const mapEdges: any[] = [];
      const entryTarget = goalToId['atendimento'] || firstId;
      if (entryTarget) mapEdges.push({ id: `entry-${entryTarget}`, source: 'entry', target: entryTarget, label: 'primeiro contato', style: { stroke: '#94A3B8', strokeDasharray: '5 4' } });
      for (const h of data.handoffs || []) {
        const s = goalToId[h.from]; const t = goalToId[h.to];
        if (s && t && s !== t) mapEdges.push({ id: `${s}-${t}`, source: s, target: t, label: h.intent, data: { why: h.why }, style: { stroke: '#6366F1' } });
      }
      // Salva o mapa (posições vazias → auto-layout). Preserva o resto do settings.
      try {
        const st = (await api.get<{ success: boolean; data: any }>('/api/settings'))?.data?.settings || {};
        await api.put('/api/settings', { settings: { ...st, consolidatedMap: { positions: {}, edges: mapEdges } } });
      } catch { /* fail-soft: fluxos já criados, mapa cai no default */ }
      setJourneyNote(`${data.summary || ''} ${data.note || ''}`.trim());
      setView('consolidated');
      load();
    } catch (e: any) {
      setError(e?.message || 'O Maestro não conseguiu desenhar a operação agora.');
    } finally { setArchitecting(false); }
  }

  // Onda 3: pede ao Maestro a sugestão de atualização (preview, não persiste).
  async function requestRefresh(flow: ApiFlow) {
    setRefreshTarget(flow); setRefreshPreview(null); setRefreshing(true); setError(null);
    try {
      const res = await api.post<{ success: boolean; data: FlowRefresh }>(`/api/flows/${flow.id}/refresh-suggestion`, {});
      if (res?.data) setRefreshPreview(res.data);
    } catch (e: any) {
      setError(e?.message || 'Não consegui gerar a sugestão agora.');
      setRefreshTarget(null);
    } finally { setRefreshing(false); }
  }

  // Onda 3: aplica a atualização (1 clique = autorização). Persiste via POST /refresh-apply
  // (snapshot prévio + validação de estrutura travada — 409 se divergente).
  async function applyRefresh() {
    if (!refreshTarget || !refreshPreview) return;
    setRefreshing(true); setError(null);
    try {
      await api.post(`/api/flows/${refreshTarget.id}/refresh-apply`, {
        nodes: refreshPreview.nodes,
        edges: refreshPreview.edges,
      });
      setRefreshTarget(null); setRefreshPreview(null);
      load();
    } catch (e: any) {
      setError(e?.message || 'Falha ao aplicar a atualização');
    } finally { setRefreshing(false); }
  }

  if (editing) {
    return (
      <ReactFlowProvider>
        <FlowEditor flow={editing} allFlows={flows || []} onBack={() => { setEditing(null); load(); }} onSaved={load} />
      </ReactFlowProvider>
    );
  }

  if (view === 'consolidated') {
    return (
      <ConsolidatedMap
        flows={flows || []}
        onBack={() => { setView('list'); load(); }}
        onEditFlow={(f) => setEditing(f)}
        onArchitect={runJourney}
        architecting={architecting}
        journeyNote={journeyNote}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-2">
      {/* Intro Maestro — espelha o design (print): manual antes do 1º fluxo */}
      <div className="mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Construa o atendimento da sua IA</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Antes de montar, dá uma olhada no tutorial do MAESTRO INTELIGENTE 2.0. Em 5 a 7 minutos:
          a virada de chave, os 7 passos na tela e a prova de que ele desenha a operação inteira sozinho.
        </p>
      </div>

      {error && <div className="my-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}

      {/* Card: Manual interativo — Reja sua IA (Baixar PDF + Abrir tutorial) */}
      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-600">
              Recomendado · 5 a 7 min
            </p>
            <h2 className="text-lg font-bold text-gray-900 mt-1">Tutorial — MAESTRO INTELIGENTE 2.0</h2>
            <p className="text-sm text-gray-500 mt-0.5">A virada de chave, os 7 passos na tela e a prova de que não é template.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={MAESTRO_TUTORIAL_PDF}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
            >
              <Download size={15} /> Baixar PDF
            </a>
            <button
              onClick={() => setTutorialOpen(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black flex items-center gap-2 whitespace-nowrap"
            >
              Abrir tutorial <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Card: Novo fluxo (do zero ou deixe o Maestro montar) */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary-500 flex items-center justify-center text-white shrink-0">
          <Zap size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Novo fluxo</p>
          <p className="text-xs text-gray-500 mt-0.5">Comece do zero ou deixe o Maestro montar</p>
        </div>
        <button
          onClick={() => setView('consolidated')}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 whitespace-nowrap"
        >
          <Workflow size={16} /> Mapa da Operação
        </button>
        <button
          onClick={createFlow}
          disabled={creating}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Criar fluxo
        </button>
      </div>

      <div className="mt-6" />


      {/* MAESTRO INTELIGENTE — gerador autônomo que lê todo o ai-training */}
      <div className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-white p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shrink-0">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900">MAESTRO INTELIGENTE 🎼</h2>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-indigo-600 text-white px-2 py-0.5 rounded-full">novo</span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              Ele lê <strong>tudo que você preencheu no treinamento da IA</strong> — seu negócio, segmento, serviços, perguntas & respostas — entende o contexto e monta o(s) fluxo(s) sob medida pra você. É só escolher os objetivos.
            </p>
            <button
              onClick={() => { setSmartOpen(true); setSmartDrafts(null); }}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
            >
              <Sparkles size={16} /> Deixar o Maestro montar pra mim
            </button>
          </div>
        </div>
      </div>

      {/* MAPA DA OPERAÇÃO (inline) — abaixo do MAESTRO INTELIGENTE, acima dos fluxos */}
      {flows !== null && (
        <div className="mb-6">
          <ConsolidatedMap
            flows={flows}
            inline
            onEditFlow={(f) => setEditing(f)}
            onArchitect={runJourney}
            architecting={architecting}
            journeyNote={journeyNote}
            onExpandFull={() => setView('consolidated')}
          />
        </div>
      )}

      {flows === null && (
        <div className="flex items-center gap-2 text-gray-500 p-8 justify-center"><Loader2 size={18} className="animate-spin" /> Carregando…</div>
      )}

      {flows && flows.length === 0 && (
        <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          Nenhum fluxo ainda. Clique em &quot;Novo fluxo&quot; pra começar.
        </div>
      )}

      {/* Wizard MAESTRO INTELIGENTE — questionário guiado → 1+ drafts */}
      {smartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSmartOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shrink-0"><Sparkles size={18} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">MAESTRO INTELIGENTE</h3>
                <p className="text-sm text-gray-600 mt-0.5">Eu uso tudo que você preencheu no treinamento da IA pra montar fluxo(s) sob medida. Escolha o que esse atendimento precisa fazer.</p>
              </div>
              <button onClick={() => setSmartOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            {/* Etapa 1: questionário (enquanto não há drafts) */}
            {!smartDrafts && (
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Qual o objetivo desse atendimento?</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {OBJECTIVE_OPTIONS.map((o) => {
                      const active = objectives.includes(o.goal);
                      return (
                        <button
                          key={o.goal}
                          type="button"
                          onClick={() => toggleObjective(o.goal)}
                          className={`text-left p-3 rounded-xl border transition-colors ${active ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-300' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${active ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                              {active && <span className="text-white text-[10px] leading-none">✓</span>}
                            </span>
                            <span className={`text-sm font-medium ${active ? 'text-indigo-700' : 'text-gray-800'}`}>{o.label}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-6">{o.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-agente — só quando >1 objetivo */}
                {objectives.length > 1 && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={multiAgent} onChange={(e) => setMultiAgent(e.target.checked)} className="mt-1" />
                      <span>
                        <span className="text-sm font-medium text-gray-900">Quero um especialista por objetivo</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          O Maestro monta <strong>um fluxo dedicado pra cada objetivo</strong> (ex.: um pra agendamento, outro pra dúvidas). Vantagem: cada fluxo fica mais focado e preciso. Você pública um por vez. Desmarcado, ele monta um único fluxo no objetivo principal.
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setSmartOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
                  <button onClick={runSmart} disabled={generating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
                    {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {generating ? 'Pensando no seu negócio…' : 'Gerar com inteligência'}
                  </button>
                </div>
              </div>
            )}

            {/* Etapa 2: resultados (1+ drafts) */}
            {smartDrafts && (
              <div className="p-5 space-y-4">
                {smartNote && <p className="text-sm text-gray-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">{smartNote}</p>}
                {smartDrafts.length === 0 && <p className="text-sm text-gray-500">Não consegui montar agora. Tente de novo.</p>}
                {smartDrafts.map((d, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                        <p className="text-xs text-indigo-600 font-medium">{d.blueprintLabel}</p>
                        <p className="text-sm text-gray-600 mt-1">{d.summary}</p>
                        {d.source === 'fallback' && <p className="text-[11px] text-amber-600 mt-1">Modelo padrão como base — personalize à vontade.</p>}
                      </div>
                      <button onClick={() => acceptDraft(d)} disabled={creating} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Abrir e editar
                      </button>
                    </div>
                    {d.rationale?.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer">Como o Maestro montou (nó a nó)</summary>
                        <ol className="space-y-2 mt-2">
                          {d.rationale.map((r, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                              <div><p className="text-xs font-medium text-gray-900">{r.node}</p><p className="text-xs text-gray-600">{r.why}</p></div>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </div>
                ))}
                {smartDrafts.length > 0 && (
                  <button onClick={createAllDrafts} disabled={creating} className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50">
                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {smartDrafts.length > 1 ? `Criar os ${smartDrafts.length} fluxos` : 'Criar este fluxo'}
                  </button>
                )}
                <p className="text-xs text-gray-500 text-center">Os fluxos vão pra sua lista — lá você seleciona, edita ou exclui cada um. Ou use “Abrir e editar” pra abrir um direto no editor.</p>
                <div className="flex justify-between gap-2 pt-1">
                  <button onClick={() => setSmartDrafts(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                    <ArrowRight size={15} className="rotate-180" /> Mudar objetivos
                  </button>
                  <button onClick={runSmart} disabled={generating} className="px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 disabled:opacity-50">
                    {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Gerar de novo
                  </button>
                </div>
              </div>
            )}
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
            <div className="flex items-center gap-2">
              {f.stale && (
                <button
                  onClick={() => requestRefresh(f)}
                  disabled={refreshing}
                  title="Seu treinamento mudou — o Maestro pode atualizar este fluxo"
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                  <Sparkles size={12} /> Atualizar com o Maestro
                </button>
              )}
              {f.isActive && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">Ativo</span>}
              <button onClick={() => removeFlow(f.id)} className="p-1.5 text-gray-400 hover:text-red-500" title="Excluir"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: preview da atualização inteligente (Onda 3) */}
      {refreshTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!refreshing) { setRefreshTarget(null); setRefreshPreview(null); } }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shrink-0"><Sparkles size={18} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">Atualizar &quot;{refreshTarget.name}&quot;</h3>
                <p className="text-sm text-gray-600 mt-0.5">Seu treinamento mudou. O Maestro preparou uma atualização — você decide se aplica.</p>
              </div>
              <button onClick={() => { if (!refreshing) { setRefreshTarget(null); setRefreshPreview(null); } }} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              {!refreshPreview && (
                <div className="flex items-center gap-2 text-gray-500 py-6 justify-center"><Loader2 size={18} className="animate-spin" /> O Maestro está revisando seu fluxo…</div>
              )}
              {refreshPreview && (
                <>
                  <p className="text-sm text-gray-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">{refreshPreview.changeNote}</p>
                  {/* Maestro v2 — diff campo a campo (multi-nó). Quando ausente, cai no antes/depois da mensagem de boas-vindas. */}
                  {Array.isArray(refreshPreview.diff) && refreshPreview.diff.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">O que muda ({refreshPreview.diff.length} {refreshPreview.diff.length === 1 ? 'alteração' : 'alterações'})</p>
                      <ul className="space-y-2">
                        {refreshPreview.diff.map((d, i) => (
                          <li key={i} className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                            <p className="text-[11px] font-semibold text-gray-500 mb-1">{d.nodeId} · {d.field}</p>
                            <p className="text-sm line-through text-gray-400">{d.before || '(vazio)'}</p>
                            <p className="text-sm text-emerald-700">{d.after || '(vazio)'}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(!refreshPreview.diff || refreshPreview.diff.length === 0) && refreshPreview.oldWelcome !== undefined && refreshPreview.newWelcome !== undefined && refreshPreview.oldWelcome !== refreshPreview.newWelcome && (
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Mensagem antes</p>
                        <p className="text-sm text-gray-500 line-through">{refreshPreview.oldWelcome || '(vazia)'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">Mensagem atualizada</p>
                        <p className="text-sm text-gray-900">{refreshPreview.newWelcome}</p>
                      </div>
                    </div>
                  )}
                  {refreshPreview.source === 'fallback' && (
                    <p className="text-[11px] text-amber-600">Não consegui gerar a atualização agora — tente de novo.</p>
                  )}
                </>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setRefreshTarget(null); setRefreshPreview(null); }} disabled={refreshing} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Agora não</button>
              <button onClick={applyRefresh} disabled={refreshing || !refreshPreview || refreshPreview.source === 'fallback'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
                {refreshing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Aplicar atualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal grande do tutorial interativo (iframe self-contained) */}
      {tutorialOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col sm:p-4 md:p-6" role="dialog" aria-modal="true">
          <div className="relative bg-white sm:rounded-2xl overflow-hidden shadow-2xl w-full h-full sm:max-w-6xl sm:mx-auto flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-white">
              <span className="text-xs font-medium text-gray-500">Tutorial · MAESTRO INTELIGENTE 2.0</span>
              <div className="flex items-center gap-2">
                <a
                  href={MAESTRO_TUTORIAL_PDF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <Download size={13} /> Baixar PDF
                </a>
                <button
                  onClick={() => setTutorialOpen(false)}
                  aria-label="Fechar tutorial"
                  className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={MAESTRO_TUTORIAL_HTML}
              title="Tutorial do ZappIQ Maestro — MAESTRO INTELIGENTE 2.0"
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
