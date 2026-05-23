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
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Plus, ArrowLeft, Save, Play, Upload, Trash2, Loader2,
  MessageSquare, GitBranch, Sparkles, Tag, BarChart2, Headset, Clock, PlayCircle, Info,
  BookOpen, Download, ArrowRight, X, Zap,
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
function MaestroNode({ id, type, data, selected }: NodeProps) {
  const meta = metaFor(type);
  const Icon = meta.icon;
  const summary = nodeSummary(type, data);
  const { deleteElements } = useReactFlow();
  return (
    <div
      className={`group relative rounded-lg border px-3 py-2 w-[180px] ${KIND_STYLE[meta.kind]} ${selected ? 'ring-2 ring-primary-400' : ''}`}
      style={{ fontSize: 12 }}
    >
      {type !== 'start' && <Handle type="target" position={Position.Top} />}
      {/* Excluir quadro — some no nó Início */}
      {type !== 'start' && (
        <button
          onClick={(e) => { e.stopPropagation(); deleteElements({ nodes: [{ id }] }); }}
          title="Excluir este quadro"
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-500 shadow-sm flex items-center justify-center text-[11px] leading-none opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-opacity"
        >
          ×
        </button>
      )}
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
  const [docType, setDocType] = useState<string | null>(null); // popup didático do nó
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
          {Object.entries(NODE_META).filter(([, m]) => m.palette).map(([type, m]) => (
            <PaletteItem key={type} type={type} meta={m} onAdd={addNode} onInfo={setDocType} />
          ))}
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
            deleteKeyCode={['Backspace', 'Delete']}
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

      {/* Popup didático do nó (#289) */}
      {docType && <NodeDocModal type={docType} onClose={() => setDocType(null)} />}
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
      {/* Intro Maestro — espelha o design (print): manual antes do 1º fluxo */}
      <div className="mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Construa o atendimento da sua IA</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Antes de montar seu primeiro fluxo, dá uma olhada no manual interativo. 10–15 minutos
          explicando o conceito das 4 cores, os 7 tipos de nó e como testar antes de publicar.
        </p>
      </div>

      {error && <div className="my-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}

      {/* Card: Manual interativo — Reja sua IA (Baixar PDF + Abrir tutorial) */}
      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-600">
              Recomendado · 10 a 15 min
            </p>
            <h2 className="text-lg font-bold text-gray-900 mt-1">Manual interativo — Reja sua IA</h2>
            <p className="text-sm text-gray-500 mt-0.5">As 4 cores, os 7 nós, os 2 caminhos. Tudo com tela ao vivo.</p>
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
          onClick={createFlow}
          disabled={creating}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Criar fluxo
        </button>
      </div>

      <div className="mt-6" />


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

      {/* Modal grande do tutorial interativo (iframe self-contained) */}
      {tutorialOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col sm:p-4 md:p-6" role="dialog" aria-modal="true">
          <div className="relative bg-white sm:rounded-2xl overflow-hidden shadow-2xl w-full h-full sm:max-w-6xl sm:mx-auto flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-white">
              <span className="text-xs font-medium text-gray-500">Manual interativo · ZappIQ Maestro</span>
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
              title="Manual interativo do ZappIQ Maestro — Reja sua IA"
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
