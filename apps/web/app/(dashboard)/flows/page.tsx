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
  MessageSquare, GitBranch, Sparkles, Tag, BarChart2, BarChart3, Headset, Clock, CalendarClock, PlayCircle, Info,
  BookOpen, Download, ArrowRight, X, Zap, ChevronDown, Maximize2, Workflow, History, HelpCircle, TrendingUp, Users, FlaskConical,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { AskNodeFields } from './_components/AskNodeFields';
import { PredicateBuilder, summarizePredicates, type Predicate } from './_components/PredicateBuilder';
import { MessageRichFields } from './_components/MessageRichFields';
import { AiToolsFields, type WebhookTool } from './_components/AiToolsFields';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { TourLauncher } from '@/components/shared/GuidedTour';
import {
  apiNodesToCanvasNodes,
  canvasNodesToApiNodes,
  unsupportedNodeTypes,
} from './_lib/graphMapping';

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
  ask:         { kind: 'fixed',  label: 'Perguntar e capturar', icon: HelpCircle,    palette: true },
  ai:          { kind: 'ai',     label: 'Nó-IA',          icon: Sparkles,      palette: true },
  tag:         { kind: 'action', label: 'Marcar tag',     icon: Tag,           palette: true },
  update_lead: { kind: 'action', label: 'Atualizar lead', icon: BarChart2,     palette: true },
  transfer:    { kind: 'human',  label: 'Humano',         icon: Headset,       palette: true },
  wait:        { kind: 'fixed',  label: 'Aguardar',       icon: Clock,         palette: true },
  // Maestro v2 — timing real (engine: wait/schedule com data.delayMinutes/runAt).
  // Mesma família visual do wait (trilho fixo): controla QUANDO o fluxo retoma.
  schedule:    { kind: 'fixed',  label: 'Agendar retomada', icon: CalendarClock, palette: true },
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

// Um tipo é "suportado" quando esta tela sabe desenhá-lo e editá-lo. Tipo fora
// do NODE_META veio de uma versão do motor mais nova que a desta tela (ou de um
// fluxo escrito à mão): o editor o mostra como somente-leitura e o deixa
// atravessar o save intacto, em vez de reescrevê-lo como 'message'.
function isSupportedNodeType(type: string): boolean {
  return Boolean(NODE_META[type]);
}

function metaFor(type: string) {
  // Fallback do tipo não suportado: rótulo = o próprio tipo (honesto — mostra ao
  // cliente o que o nó é de verdade) e fora da paleta (não dá para criar um nó
  // cujos campos o editor não conhece).
  return NODE_META[type] || { kind: 'fixed' as NodeKind, label: type, icon: AlertTriangle, palette: false };
}

function nodeSummary(type: string, data: any): string {
  switch (type) {
    case 'message':
      if (data?.media) return data.media.type === 'image' ? '🖼 imagem' : data.media.type === 'document' ? '📄 documento' : '🔊 áudio';
      if (data?.interactive) return `${data.interactive.options.length} ${data.interactive.type === 'list' ? 'itens' : 'botões'}`;
      return data?.text || '(mensagem vazia)';
    case 'condition': return 'Ramifica pela resposta';
    case 'ask': return data?.varName ? `→ {{${data.varName}}}` : 'captura resposta';
    case 'ai': return data?.prompt || '(sem instrução)';
    case 'tag': return data?.tag ? `tag: ${data.tag}` : '(sem tag)';
    case 'update_lead': return data?.field ? `${data.field} = ${data.value ?? ''}` : '(sem campo)';
    case 'transfer': return 'Passa pro time';
    case 'goto_flow': {
      const name = data?.targetFlowName || '(sem fluxo de destino)';
      return data?.mode === 'call' ? `↪ chamar: ${name}` : `→ ${name}`;
    }
    case 'wait': {
      const m = Number(data?.delayMinutes);
      return m > 0 ? `⏳ espera ${m} min` : 'Passa direto (sem espera)';
    }
    case 'schedule': {
      // runAt vence sobre delayMinutes (mesma regra do engine).
      if (typeof data?.runAt === 'string' && data.runAt) {
        const d = new Date(data.runAt);
        if (!Number.isNaN(d.getTime())) return `⏰ ${d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
      }
      const m = Number(data?.delayMinutes);
      return m > 0 ? `⏰ ${m} min` : '(sem agendamento)';
    }
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
  ask: {
    short: 'Faz uma pergunta, espera a resposta do cliente, valida e salva numa variável (e opcionalmente no CRM).',
    whatFor: 'Use para coletar dados estruturados: nome, e-mail, telefone, empresa ou qualquer informação que precise ser guardada e reutilizada. Depois use {{a_variavel}} para personalizar mensagens.',
    how: 'Defina a pergunta, o nome da variável para salvar a resposta e, opcionalmente, um campo do CRM para gravar automaticamente. Ative a validação para checar o formato (texto, número, e-mail ou telefone) antes de avançar.',
    example: 'Pergunta: "Qual seu e-mail?" → salvar em {{email}} e gravar no campo "email" do lead.',
  },
  wait: {
    short: 'Espera a resposta do cliente por um prazo. Se ele não responder, o fluxo segue pelo ramo "Sem resposta" — perfeito pra follow-up automático.',
    whatFor: 'Use pra recuperar conversas paradas: pergunta enviada, cliente sumiu, o fluxo cobra sozinho depois do prazo. Com duas saídas, você define o caminho da resposta e o caminho do silêncio.',
    how: 'Defina o prazo em minutos. Conecte duas saídas: clique em cada conexão e marque uma como "Resposta do cliente" e a outra como "Sem resposta (timeout)". Com uma saída só, ela vira o destino do timer.',
    example: 'Enviar proposta → aguardar 60 min → sem resposta? → "Oi! Conseguiu ver a proposta? 😊"',
  },
  schedule: {
    short: 'Agenda a retomada do fluxo para depois: em X minutos ou numa data/hora específica.',
    whatFor: 'Use pra mensagens com hora marcada: lembrete de consulta, cobrança pós-evento, follow-up no dia seguinte. O fluxo dorme e acorda sozinho no momento certo.',
    how: 'Defina em quantos minutos retomar OU escolha data/hora exata (se preencher os dois, a data/hora vence). Conecte uma saída: é por ela que o fluxo continua quando o timer dispara.',
    example: 'Cliente agendou demonstração → agendar retomada pra véspera → "Lembrete: sua demonstração é amanhã às 14h!"',
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
  // Tipo não suportado: não tentamos adivinhar um resumo (nodeSummary não
  // conhece os campos dele) nem fingir que é um nó comum. Borda tracejada +
  // âmbar sinalizam "o editor não desenha isto", e o tipo cru fica à vista.
  const supported = isSupportedNodeType(type);
  const summary = supported ? nodeSummary(type, data) : 'Não suportado nesta versão do editor';
  const accent = supported ? KIND_ACCENT[meta.kind] : '#B45309';
  const { deleteElements } = useReactFlow();
  return (
    <div
      className="group relative w-[212px] rounded-2xl bg-white transition-all"
      style={{
        border: supported
          ? `1px solid ${selected ? accent : '#E8EDF4'}`
          : `1px dashed ${selected ? accent : '#FCD34D'}`,
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
      {data._metrics && (
        <div className="absolute -bottom-2 -right-2 flex gap-1 z-10">
          <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-semibold shadow">▶ {data._metrics.entries}</span>
          {data._metrics.ends > 0 && <span className="px-1.5 py-0.5 rounded-full bg-gray-700 text-white text-[10px] shadow">⏹ {data._metrics.ends}</span>}
        </div>
      )}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: supported ? KIND_BADGE[meta.kind] : 'linear-gradient(135deg,#FBBF24,#B45309)' }}
        >
          <Icon size={17} color="#fff" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{data?.label || meta.label}</p>
          <p className={`text-[11px] truncate mt-0.5 ${supported ? 'text-slate-400' : 'text-amber-700'}`}>{summary || meta.label}</p>
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
// O mapeamento em si vive em _lib/graphMapping.ts (puro e testado): é a parte
// capaz de destruir dado do cliente. Aqui só injetamos o que depende de React
// (rótulo vindo do NODE_META) e o gerador de id.
function apiNodesToCanvas(apiNodes: any[]): Node[] {
  return apiNodesToCanvasNodes(apiNodes, {
    labelFor: (t) => metaFor(t).label,
    genId: () => genId('n'),
  }) as Node[];
}
function apiEdgesToCanvas(apiEdges: any[]): Edge[] {
  return (apiEdges || []).map((e: any): Edge => ({
    id: e.id || genId('e'),
    source: e.source,
    target: e.target,
    // Label derivation:
    // - predicates → summarize
    // - else → 'padrão'
    // - timeout → 'sem resposta'
    // - legacy keyword when → value
    label: e.data?.predicates?.length
      ? summarizePredicates(e.data.predicates as Predicate[])
      : e.data?.when?.match === 'else'
        ? 'padrão'
        : e.data?.when?.match === 'timeout'
          ? 'sem resposta'
          : (e.data?.when?.value || undefined),
    data: e.data || {},
  }));
}

function FlowEditor({ flow, allFlows, onBack, onSaved }: { flow: ApiFlow; allFlows: ApiFlow[]; onBack: () => void; onSaved: () => void }) {
  // Nome do agente do tenant (organization.settings.agentName), mesma fonte do
  // AgentTrainingWidget. Nunca "Iza" hardcodado no painel do cliente.
  const organization = useAuthStore((s) => s.organization);
  const agentName: string = (organization?.settings as any)?.agentName || 'a IA';

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

  // S3 — simulação com personas sintéticas
  const [simReport, setSimReport] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Pacote 3.10 — Experimento A/B
  type AbExperiment = { active: boolean; variantFlowId: string; splitPercent: number; conversionNodeId?: string };
  type AbVariant = { variant: 'A' | 'B'; entries: number; conversions: number; conversionRate: number };
  type AbResults = { variants: AbVariant[]; winner: 'A' | 'B' | null; note: string } | null;
  const [abOpen, setAbOpen] = useState(false);
  const [abLoading, setAbLoading] = useState(false);
  const [abSaving, setAbSaving] = useState(false);
  const [abExperiment, setAbExperiment] = useState<AbExperiment>({ active: false, variantFlowId: '', splitPercent: 50 });
  const [abResults, setAbResults] = useState<AbResults>(null);

  async function openAbPanel() {
    setAbOpen(true);
    setAbLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: { experiment: AbExperiment | null; results: AbResults } }>(
        `/api/flows/${flow.id}/experiment?days=14`,
      );
      const d = res?.data;
      if (d?.experiment) {
        setAbExperiment({
          active: !!d.experiment.active,
          variantFlowId: d.experiment.variantFlowId || '',
          splitPercent: typeof d.experiment.splitPercent === 'number' ? d.experiment.splitPercent : 50,
          conversionNodeId: d.experiment.conversionNodeId,
        });
      }
      setAbResults(d?.results ?? null);
    } catch { /* fail-soft: leave defaults */ }
    finally { setAbLoading(false); }
  }

  async function saveAbExperiment() {
    setAbSaving(true);
    try {
      await api.put(`/api/flows/${flow.id}/experiment`, {
        active: abExperiment.active,
        variantFlowId: abExperiment.variantFlowId || null,
        splitPercent: abExperiment.splitPercent,
        conversionNodeId: abExperiment.conversionNodeId || null,
      });
      setAbOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar experimento A/B');
    } finally { setAbSaving(false); }
  }

  // 1B-analytics — toggle de métricas + badges por nó
  const [showMetrics, setShowMetrics] = useState(false);
  const [metrics, setMetrics] = useState<{ total: number; byNode: Record<string, { entries: number; ends: number }> } | null>(null);

  // Tipos do grafo que esta versão da tela não conhece. Sem um renderer
  // registrado, o React Flow cairia no nó 'default' e logaria erro — era isso
  // que a antiga coerção para 'message' escondia (ao custo de destruir o tipo
  // no save). Registramos MaestroNode para eles: ele já degrada via metaFor().
  const unsupportedTypes = useMemo(
    () => unsupportedNodeTypes(nodes as { type?: string }[], isSupportedNodeType),
    [nodes],
  );
  // Memo sobre a CHAVE (string), não sobre o array: `nodes` muda a cada arrastar
  // e recriar nodeTypes remontaria todo nó do canvas.
  const unsupportedKey = unsupportedTypes.join('|');
  const nodeTypes = useMemo(
    () => Object.fromEntries(
      [...Object.keys(NODE_META), ...(unsupportedKey ? unsupportedKey.split('|') : [])]
        .map((t) => [t, MaestroNode]),
    ),
    [unsupportedKey],
  );

  // 1B-analytics — busca métricas quando o toggle liga
  useEffect(() => {
    if (!showMetrics || !flow?.id) { return; }
    let cancelled = false;
    api.get<{ success: boolean; data: { totalEntries: number; byNode: { nodeId: string; entries: number; ends: number }[] } }>(
      `/api/flows/${flow.id}/analytics?days=7`,
    )
      .then((res: any) => {
        if (cancelled) return;
        const d = res?.data ?? res;
        const byNode: Record<string, { entries: number; ends: number }> = {};
        for (const n of (d?.byNode ?? [])) byNode[n.nodeId] = { entries: n.entries, ends: n.ends };
        setMetrics({ total: d?.totalEntries ?? 0, byNode });
      })
      .catch(() => { if (!cancelled) setMetrics(null); });
    return () => { cancelled = true; };
  }, [showMetrics, flow?.id]);

  // 1B-analytics — displayNodes injeta _metrics sem mutar o estado editável
  const displayNodes = useMemo(
    () =>
      showMetrics && metrics
        ? nodes.map((n) => ({ ...n, data: { ...n.data, _metrics: metrics.byNode[n.id] ?? { entries: 0, ends: 0 } } }))
        : nodes,
    [nodes, showMetrics, metrics],
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

  function setEdgePredicates(preds: Predicate[]) {
    setEdges((eds) => eds.map((e) => e.id === selectedEdgeId
      ? { ...e, label: preds.length ? summarizePredicates(preds) : undefined, data: { ...e.data, predicates: preds.length ? preds : undefined, when: undefined } }
      : e));
  }
  function setEdgeAsElse(on: boolean) {
    setEdges((eds) => eds.map((e) => e.id === selectedEdgeId
      ? { ...e, label: on ? 'padrão' : undefined, data: { ...e.data, predicates: undefined, when: on ? { match: 'else' } : undefined } }
      : e));
  }

  // Maestro v2 — saídas de nó 'wait': ramo de resposta vs ramo de timeout.
  // timeout → data.when = { match: 'timeout' } (engine dispara o timer por ela);
  // resposta → sem when (engine segue por ela quando o cliente responde).
  function setEdgeWaitBranch(branch: 'reply' | 'timeout') {
    if (!selectedEdgeId) return;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === selectedEdgeId
          ? (branch === 'timeout'
              ? { ...e, label: 'sem resposta', data: { ...e.data, when: { match: 'timeout' } } }
              : { ...e, label: undefined, data: { ...e.data, when: undefined } })
          : e,
      ),
    );
  }

  // React Flow → shape da API (engine lê node.data.* e edge.data.when)
  function toApiGraph() {
    return {
      // n.type é o tipo original: apiNodesToCanvas() não coage mais. Nó que o
      // editor não sabe desenhar atravessa o save intacto.
      nodes: canvasNodesToApiNodes(nodes as any),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data || {} })),
    };
  }

  // ─── Validação de publicação (E5 — guard-rails client-side) ─────────────────
  function validateGraph(ns: Node[], es: Edge[]): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const labelOf = (n: Node) => (n.data?.label as string) || n.type || n.id;
    for (const n of ns) {
      const d: any = n.data ?? {};
      if (n.type === 'ask') {
        if (!d.varName || !String(d.varName).trim()) errors.push(`Nó "${labelOf(n)}": defina a variável onde salvar a resposta.`);
      }
      if (n.type === 'ai' && Array.isArray(d.tools)) {
        for (const t of d.tools as any[]) {
          if (t?.type === 'webhook') {
            if (!t.name || !String(t.name).trim()) errors.push(`Nó "${labelOf(n)}": a ferramenta webhook precisa de um nome.`);
            const url = String(t.url ?? '').trim();
            if (!url) {
              errors.push(`Nó "${labelOf(n)}": a ferramenta webhook precisa de uma URL.`);
            } else if (!/^https?:\/\//i.test(url)) {
              errors.push(`Nó "${labelOf(n)}": URL da ferramenta webhook deve começar com http:// ou https://.`);
            }
          }
        }
      }
      if (n.type === 'message') {
        if (d.media && (!d.media.url || !String(d.media.url).trim())) errors.push(`Nó "${labelOf(n)}": a mídia precisa de uma URL.`);
        if (d.interactive) {
          const opts = (d.interactive.options ?? []) as { id: string; title: string }[];
          const lim = d.interactive.type === 'list' ? 10 : 3;
          if (opts.length === 0) errors.push(`Nó "${labelOf(n)}": adicione ao menos uma opção.`);
          if (opts.length > lim) errors.push(`Nó "${labelOf(n)}": ${d.interactive.type === 'list' ? 'listas' : 'botões'} aceitam no máximo ${lim} opções.`);
          if (opts.some((o) => !o.title || !o.title.trim())) errors.push(`Nó "${labelOf(n)}": toda opção precisa de um texto.`);
          const ids = opts.map((o) => o.id);
          if (new Set(ids).size !== ids.length) errors.push(`Nó "${labelOf(n)}": há opções com id duplicado.`);
        }
      }
    }
    // Nós que ramificam: condition/ask com saídas mas sem ramo padrão (else/bare) → aviso
    for (const n of ns) {
      if (n.type !== 'condition' && n.type !== 'ask') continue;
      const out = es.filter((e) => e.source === n.id);
      if (out.length === 0) continue;
      const hasDefault = out.some((e) => {
        const w = (e.data as any)?.when;
        const preds = (e.data as any)?.predicates;
        if (n.type === 'ask') return w?.match === 'else';
        return w?.match === 'else' || (!w && (!preds || preds.length === 0));
      });
      if (!hasDefault) warnings.push(`Nó "${labelOf(n)}": sem ramo padrão (else). Se nada casar, o fluxo encerra.`);
    }
    // Predicado custom field sem nome de campo
    for (const e of es) {
      const preds = ((e.data as any)?.predicates ?? []) as any[];
      for (const p of preds) {
        if (p.kind === 'contact_attr' && p.field === 'customFields.') errors.push('Uma condição de campo custom está sem o nome do campo.');
      }
    }
    // Quadro que esta versão do editor não sabe abrir: aviso, nunca erro. Bloquear
    // a publicação deixaria o cliente preso num fluxo que ele não tem como
    // consertar, por um desencontro de versão que é nosso. Ele é preservado no
    // save, então publicar é seguro.
    const naoSuportados = unsupportedNodeTypes(ns as { type?: string }[], isSupportedNodeType);
    if (naoSuportados.length > 0) {
      warnings.push(
        `Este fluxo tem quadro que esta versão do editor não sabe abrir (${naoSuportados.join(', ')}). ` +
        'Ele é salvo e publicado exatamente como está, sem alteração.',
      );
    }
    return { errors, warnings };
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
    const { errors: pubErrors, warnings: pubWarnings } = validateGraph(nodes, edges);
    if (pubErrors.length) {
      window.alert('Não foi possível publicar:\n\n' + pubErrors.map((e) => '• ' + e).join('\n'));
      return;
    }
    if (pubWarnings.length) {
      const ok = window.confirm('Avisos antes de publicar:\n\n' + pubWarnings.map((w) => '• ' + w).join('\n') + '\n\nPublicar mesmo assim?');
      if (!ok) return;
    }
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

  // S3 — roda simulação com personas sintéticas (draft atual, sem salvar)
  async function runSimulation() {
    if (!flow?.id) return;
    setSimulating(true);
    setError(null);
    try {
      const g = toApiGraph();
      const res: any = await api.post(`/api/flows/${flow.id}/simulate`, { nodes: g.nodes, edges: g.edges, personaCount: 3 });
      setSimReport(res?.data ?? res);
    } catch (e: any) {
      setError(e?.message || 'Não consegui simular agora. Tente de novo.');
    } finally {
      setSimulating(false);
    }
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
  // Tipo do nó de ORIGEM da aresta selecionada — saídas de 'wait' editam o ramo
  // (resposta vs timeout) em vez da condição por palavra-chave.
  const selectedEdgeSourceType = selectedEdge
    ? (nodes.find((n) => n.id === selectedEdge.source)?.type ?? null)
    : null;

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
          <SaibaMais featureKey="flows.editor.testar" />
          <button
            onClick={() => setShowMetrics((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${showMetrics ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            <BarChart3 size={13} /> Métricas{showMetrics && metrics ? ` · ${metrics.total} (7d)` : ''}
          </button>
          <SaibaMais featureKey="flows.editor.metricas-por-no" />
          <button onClick={runSimulation} disabled={simulating} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
            {simulating ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} {simulating ? 'Simulando…' : 'Simular'}
          </button>
          <SaibaMais featureKey="flows.editor.simular" />
          <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
          <button onClick={openHistory} disabled={historyLoading} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
            {historyLoading ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />} Histórico
          </button>
          <button onClick={openAbPanel} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-200 text-violet-700 hover:bg-violet-50 flex items-center gap-1.5">
            <FlaskConical size={14} /> A/B
          </button>
          <SaibaMais featureKey="flows.editor.experimento-ab" />
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
            nodes={displayNodes}
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

          {selectedEdge && selectedEdgeSourceType === 'wait' && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">Conexão</p>
              <label className="block text-xs text-gray-600 mb-1">Ramo deste caminho:</label>
              <select
                value={selectedEdge.data?.when?.match === 'timeout' ? 'timeout' : 'reply'}
                onChange={(e) => setEdgeWaitBranch(e.target.value as 'reply' | 'timeout')}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="reply">Resposta do cliente</option>
                <option value="timeout">Sem resposta (timeout)</option>
              </select>
              <p className="text-[10px] text-gray-400 mt-1.5">
                "Sem resposta" é o caminho seguido quando o prazo do nó Aguardar vence sem o cliente responder. "Resposta do cliente" é o caminho seguido quando ele responde a tempo.
              </p>
            </div>
          )}

          {selectedEdge && selectedEdgeSourceType !== 'wait' && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">Conexão</p>
              {/* Else checkbox */}
              <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEdge.data?.when?.match === 'else'}
                  onChange={(e) => setEdgeAsElse(e.target.checked)}
                  className="rounded"
                />
                Aresta padrão (else)
              </label>
              {selectedEdge.data?.when?.match !== 'else' && (() => {
                const legacyWhen = selectedEdge.data?.when as { match: string; value?: string } | undefined;
                const currentPreds: Predicate[] = (selectedEdge.data?.predicates as Predicate[] | undefined)
                  ?? (legacyWhen && legacyWhen.match !== 'else' && legacyWhen.match !== 'timeout'
                       ? [{ kind: 'keyword', match: legacyWhen.match as Extract<Predicate, { kind: 'keyword' }>['match'], value: legacyWhen.value ?? '' }]
                       : []);
                return <PredicateBuilder predicates={currentPreds} onChange={setEdgePredicates} />;
              })()}
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
                  <div className="text-gray-600">→ {t.effects.map((e) => e.kind).join(', ') || '(nada)'} · próximo: {t.next}{t.aiPrompt ? ` (${agentName} assume)` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Popup didático do nó (#289) */}
      {docType && <NodeDocModal type={docType} onClose={() => setDocType(null)} />}

      {/* S3 — Relatório de simulação com personas sintéticas */}
      {simReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSimReport(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Users size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">Simulação com clientes sintéticos</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {simReport.passed}/{simReport.total} personas atendidas bem
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* passRate badge */}
                {typeof simReport.passRate === 'number' && (
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                    simReport.passRate >= 70
                      ? 'bg-green-100 text-green-700'
                      : simReport.passRate >= 40
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {Math.round(simReport.passRate)}%
                  </span>
                )}
                <button onClick={() => setSimReport(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* byPersona list */}
              {Array.isArray(simReport.byPersona) && simReport.byPersona.length > 0 && (
                <ul className="space-y-2">
                  {simReport.byPersona.map((p: any, i: number) => (
                    <li key={i} className="rounded-xl border border-gray-100 p-3 flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${p.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {p.passed ? '✓' : '✗'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">
                          {p.persona?.name || 'Persona'}
                          {p.persona?.intent && (
                            <span className="ml-1.5 font-normal text-gray-400">{p.persona.intent}</span>
                          )}
                        </p>
                        {p.reason && <p className="text-xs text-gray-600 mt-0.5 leading-snug">{p.reason}</p>}
                        {typeof p.turns === 'number' && (
                          <p className="text-[10px] text-gray-400 mt-1">{p.turns} {p.turns === 1 ? 'turno' : 'turnos'}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Recommendations */}
              {Array.isArray(simReport.recommendations) && simReport.recommendations.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-2">Sugestões</p>
                  <ul className="space-y-1">
                    {simReport.recommendations.map((r: string, i: number) => (
                      <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[10px] text-gray-400 leading-snug border-t border-gray-100 pt-3">
                Simulação aproximada (clientes gerados por IA) — use como sinal, não como garantia.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pacote 3.10 — Experimento A/B */}
      {abOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!abSaving) setAbOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 shrink-0"><FlaskConical size={18} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">Experimento A/B</h3>
                <p className="text-sm text-gray-500 mt-0.5">Divida o tráfego entre este fluxo (A) e um fluxo variante (B) para comparar conversões.</p>
              </div>
              <button onClick={() => { if (!abSaving) setAbOpen(false); }} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {abLoading ? (
                <div className="flex items-center gap-2 text-gray-500 py-6 justify-center"><Loader2 size={18} className="animate-spin" /> Carregando…</div>
              ) : (
                <>
                  {/* Toggle ativo */}
                  <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-gray-200 p-3 hover:border-gray-300">
                    <div
                      onClick={() => setAbExperiment((p) => ({ ...p, active: !p.active }))}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer ${abExperiment.active ? 'bg-violet-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${abExperiment.active ? 'translate-x-4' : ''}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Ativar teste A/B</p>
                      <p className="text-xs text-gray-500">Quando ativo, o tráfego é dividido entre este fluxo e a variante B.</p>
                    </div>
                  </label>

                  {/* Fluxo variante B */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Fluxo variante (B)</label>
                    <select
                      value={abExperiment.variantFlowId}
                      onChange={(e) => setAbExperiment((p) => ({ ...p, variantFlowId: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <option value="">— escolher fluxo variante —</option>
                      {allFlows.filter((f) => f.id !== flow.id && f.isActive).map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">Apenas fluxos ativos da sua organização (exceto este).</p>
                  </div>

                  {/* % tráfego para B */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      % do tráfego para B — <span className="text-violet-600 font-bold">{abExperiment.splitPercent}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={abExperiment.splitPercent}
                      onChange={(e) => setAbExperiment((p) => ({ ...p, splitPercent: Number(e.target.value) }))}
                      className="w-full accent-violet-600"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>A: {100 - abExperiment.splitPercent}%</span>
                      <span>B: {abExperiment.splitPercent}%</span>
                    </div>
                  </div>

                  {/* Nó de conversão */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nó de conversão (opcional)</label>
                    <select
                      value={abExperiment.conversionNodeId || ''}
                      onChange={(e) => setAbExperiment((p) => ({ ...p, conversionNodeId: e.target.value || undefined }))}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <option value="">Conclusão do fluxo (padrão)</option>
                      {nodes.filter((n) => n.type !== 'start').map((n) => (
                        <option key={n.id} value={n.id}>{n.data?.label || n.type} ({n.id})</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">O nó atingido conta como conversão. Vazio = fim do fluxo.</p>
                  </div>

                  {/* Resultados */}
                  {abResults && (
                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Resultados (últimos 14 dias)</p>
                      {abResults.note && !abResults.variants?.length && (
                        <p className="text-sm text-gray-500">{abResults.note}</p>
                      )}
                      {abResults.variants && abResults.variants.length > 0 && (
                        <>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            {abResults.variants.map((v) => {
                              const isWinner = abResults.winner === v.variant;
                              return (
                                <div
                                  key={v.variant}
                                  className={`rounded-lg border p-3 ${isWinner ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-xs font-bold ${isWinner ? 'text-green-700' : 'text-gray-600'}`}>
                                      Variante {v.variant}
                                    </span>
                                    {isWinner && <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Vencedor</span>}
                                  </div>
                                  <p className={`text-2xl font-bold ${isWinner ? 'text-green-700' : 'text-gray-800'}`}>
                                    {(v.conversionRate * 100).toFixed(1)}%
                                  </p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">
                                    {v.conversions} conv. / {v.entries} entradas
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          {abResults.note && (
                            <p className="text-[11px] text-gray-500 border-t border-gray-100 pt-2">{abResults.note}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!abLoading && (
              <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => { if (!abSaving) setAbOpen(false); }} disabled={abSaving} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
                <button onClick={saveAbExperiment} disabled={abSaving} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 flex items-center gap-2 disabled:opacity-50">
                  {abSaving ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />} Salvar experimento
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

// ISO (engine, data.runAt) ↔ valor do <input type="datetime-local"> (hora local).
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Minutos de timing (wait/schedule): vazio = sem valor; senão inteiro 1..20160 (14 dias).
const MAX_DELAY_MINUTES = 20160;
function parseDelayMinutes(raw: string): number | undefined {
  if (raw === '') return undefined;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(MAX_DELAY_MINUTES, Math.max(1, n));
}

// ─── Painel de propriedades por tipo de nó ───────────────────────────────────
function NodeProperties({ type, data, otherFlows, onChange, onDelete }: {
  type: string; data: any; otherFlows?: { id: string; name: string }[];
  onChange: (p: Record<string, any>) => void; onDelete: () => void;
}) {
  // Nome do agente do tenant (organization.settings.agentName), mesma fonte do
  // AgentTrainingWidget. Nunca "Iza" hardcodado no painel do cliente.
  const organization = useAuthStore((s) => s.organization);
  const agentName: string = (organization?.settings as any)?.agentName || 'a IA';

  const meta = metaFor(type);
  const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';

  // Tipo não suportado: somente-leitura. Todo campo deste painel é específico de
  // um tipo, e este a tela não conhece; abrir os campos de 'message' aqui
  // gravaria dado de mensagem num nó que não é mensagem. Só excluir continua
  // disponível, porque é uma ação explícita e visível do usuário (ao contrário
  // da coerção silenciosa que este painel fazia antes).
  if (!isSupportedNodeType(type)) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] px-2 py-0.5 rounded-md border bg-amber-50 border-amber-300 text-amber-800">
            Nó não suportado
          </span>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500" title="Excluir nó"><Trash2 size={14} /></button>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 mb-3">
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Este quadro é do tipo <code className="px-1 rounded bg-amber-100 font-mono">{type}</code>, que esta versão do
            editor ainda não sabe abrir.
          </p>
          <p className="text-[11px] text-amber-800 leading-relaxed mt-1.5">
            Salvar não altera este quadro: ele é gravado exatamente como está. Você pode mover ele e ligar caminhos nele.
            Para editar o conteúdo, atualize a página. Se o aviso continuar, fale com o suporte.
          </p>
        </div>
        <label className="block text-xs text-gray-600 mb-1">Rótulo</label>
        <input
          value={data?.label || ''}
          disabled
          className={`${inputCls} mb-3 bg-gray-50 text-gray-400 cursor-not-allowed`}
        />
      </div>
    );
  }

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
          <MessageRichFields data={data ?? {}} onChange={onChange} />
        </>
      )}

      {type === 'ai' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Instrução do passo ({agentName} assume)</label>
          <AutoGrowTextarea
            value={data?.prompt || ''}
            onChange={(v) => onChange({ prompt: v })}
            placeholder="Ex: Tire dúvidas sobre os planos e ofereça agendar uma demonstração."
            className={`${inputCls} mb-2`}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            O nó usa o modelo de IA automaticamente (otimizado pela ZappIQ): {agentName} reaproveita a identidade + conhecimento (RAG) que você treinou. Você não precisa escolher modelo.
          </p>
          <AiToolsFields
            tools={data?.tools as WebhookTool[] | undefined}
            onChange={onChange}
          />
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

      {type === 'ask' && (
        <AskNodeFields data={data ?? {}} onChange={onChange} />
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
          <div className="mt-2">
            <label className="text-[10px] text-gray-500">Comportamento</label>
            <select className={inputCls} value={(data?.mode as string) || 'goto'} onChange={(e) => onChange({ mode: e.target.value })}>
              <option value="goto">Enviar para o fluxo (não volta)</option>
              <option value="call">Chamar e voltar quando terminar</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">A conversa continua no fluxo escolhido, sem o cliente perceber a troca.</p>
        </>
      )}

      {type === 'wait' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Esperar resposta por (minutos)</label>
          <input
            type="number"
            min={1}
            max={MAX_DELAY_MINUTES}
            value={data?.delayMinutes ?? ''}
            onChange={(e) => onChange({ delayMinutes: parseDelayMinutes(e.target.value) })}
            placeholder="ex: 60"
            className={inputCls}
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Se o cliente não responder nesse prazo, o fluxo segue pelo ramo "Sem resposta". Fora da janela de 24h da Meta a mensagem não é enviada.
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5">Vazio = sem espera real (o fluxo passa direto). Máximo: 20160 min (14 dias).</p>
        </>
      )}

      {type === 'schedule' && (
        <>
          <label className="block text-xs text-gray-600 mb-1">Retomar em (minutos)</label>
          <input
            type="number"
            min={1}
            max={MAX_DELAY_MINUTES}
            value={data?.delayMinutes ?? ''}
            onChange={(e) => onChange({ delayMinutes: parseDelayMinutes(e.target.value) })}
            placeholder="ex: 60"
            className={`${inputCls} mb-2`}
          />
          <label className="block text-xs text-gray-600 mb-1">Ou em data/hora específica</label>
          <input
            type="datetime-local"
            value={isoToLocalInput(data?.runAt)}
            onChange={(e) => onChange({ runAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
            className={inputCls}
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Se os dois estiverem preenchidos, a data/hora específica vence. O fluxo retoma pelo caminho conectado à saída deste nó. Fora da janela de 24h da Meta a mensagem não é enviada.
          </p>
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
          <SaibaMais featureKey="flows.mapa-operacao.arquitetar" variant="link" />
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
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
                Mapa da Operação
                <SaibaMais featureKey="flows.mapa-operacao.visao" />
              </h2>
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
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
              Mapa da Operação
              <SaibaMais featureKey="flows.mapa-operacao.visao" />
            </h1>

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
  // Pacote 2.7 — auto-otimização por funil (reusa o mesmo preview/apply do refresh)
  const [optimizing, setOptimizing] = useState(false);
  const [refreshMode, setRefreshMode] = useState<'refresh' | 'optimize'>('refresh');
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

  // Deep links (#W2.7): ?flowId=<id> abre o editor daquele fluxo; ?wizard=true
  // abre o wizard do MAESTRO INTELIGENTE. Os links da home e da biblioteca de
  // templates apontam pra cá. Roda uma vez no mount (lê window.location.search
  // pra evitar o Suspense do useSearchParams).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('wizard') === 'true') {
      setSmartOpen(true);
      setSmartDrafts(null);
      return;
    }
    const flowId = params.get('flowId');
    if (flowId) {
      let cancelled = false;
      api.get<{ success: boolean; data: ApiFlow }>(`/api/flows/${flowId}`)
        .then((res) => { if (!cancelled && res?.data) setEditing(res.data); })
        .catch(() => { /* fluxo inexistente/sem acesso: fica na lista */ });
      return () => { cancelled = true; };
    }
  }, []);

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
    setRefreshTarget(flow); setRefreshPreview(null); setRefreshing(true); setRefreshMode('refresh'); setError(null);
    try {
      const res = await api.post<{ success: boolean; data: FlowRefresh }>(`/api/flows/${flow.id}/refresh-suggestion`, {});
      if (res?.data) setRefreshPreview(res.data);
    } catch (e: any) {
      setError(e?.message || 'Não consegui gerar a sugestão agora.');
      setRefreshTarget(null);
    } finally { setRefreshing(false); }
  }

  // Pacote 2.7 — auto-otimização por funil (reusa preview/apply do refresh).
  async function requestOptimize(flow: ApiFlow) {
    setRefreshTarget(flow); setRefreshPreview(null); setOptimizing(true); setRefreshMode('optimize'); setError(null);
    try {
      const res = await api.post<{ success: boolean; data: FlowRefresh }>(`/api/flows/${flow.id}/optimize-suggestion`, {});
      if (res?.data) setRefreshPreview(res.data);
    } catch (e: any) {
      setError(e?.message || 'Não consegui gerar a otimização agora.');
      setRefreshTarget(null);
    } finally { setOptimizing(false); }
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
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Construa o atendimento da sua IA</h1>
          <TourLauncher tourKey="primeiro-fluxo-maestro" autoStart />
        </div>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Antes de montar, dá uma olhada no tutorial do MAESTRO INTELIGENTE 2.0. Em 5 a 7 minutos:
          a virada de chave, os 7 passos na tela e a prova de que ele desenha a operação inteira sozinho.
        </p>
      </div>

      {error && <div className="my-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}

      {/* Card: Manual interativo — Reja sua IA (Baixar PDF + Abrir tutorial) */}
      <div data-tour="maestro-tutorial" className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
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
      <div data-tour="maestro-novo-fluxo" className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
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
      <div data-tour="maestro-inteligente" className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-white p-5">
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
              <button
                onClick={() => requestOptimize(f)}
                disabled={optimizing}
                title="O Maestro analisa o funil e sugere melhorias de conversão"
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {optimizing ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />} Otimizar
              </button>
              {f.isActive && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">Ativo</span>}
              <button onClick={() => removeFlow(f.id)} className="p-1.5 text-gray-400 hover:text-red-500" title="Excluir"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: preview da atualização/otimização inteligente (Onda 3 + Pacote 2.7) */}
      {refreshTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!refreshing && !optimizing) { setRefreshTarget(null); setRefreshPreview(null); } }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 ${refreshMode === 'optimize' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-blue-600'}`}>
                {refreshMode === 'optimize' ? <TrendingUp size={18} /> : <Sparkles size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">
                  {refreshMode === 'optimize' ? 'Otimizar' : 'Atualizar'} &quot;{refreshTarget.name}&quot;
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {refreshMode === 'optimize'
                    ? 'O Maestro analisou o funil e preparou sugestões de otimização de conversão — você decide se aplica.'
                    : 'Seu treinamento mudou. O Maestro preparou uma atualização — você decide se aplica.'}
                </p>
              </div>
              <button onClick={() => { if (!refreshing && !optimizing) { setRefreshTarget(null); setRefreshPreview(null); } }} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              {!refreshPreview && (
                <div className="flex items-center gap-2 text-gray-500 py-6 justify-center">
                  <Loader2 size={18} className="animate-spin" />
                  {refreshMode === 'optimize' ? 'O Maestro está analisando o funil…' : 'O Maestro está revisando seu fluxo…'}
                </div>
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
              <button onClick={() => { setRefreshTarget(null); setRefreshPreview(null); }} disabled={refreshing || optimizing} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Agora não</button>
              <button onClick={applyRefresh} disabled={refreshing || optimizing || !refreshPreview || refreshPreview.source === 'fallback'} className={`px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 ${refreshMode === 'optimize' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {(refreshing || optimizing) ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {refreshMode === 'optimize' ? 'Aplicar otimização' : 'Aplicar atualização'}
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
