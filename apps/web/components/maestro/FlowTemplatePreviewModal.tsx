'use client';

import { X, ArrowRight, Sparkles, Clock, Target, BarChart3, CheckCircle2, Lightbulb } from 'lucide-react';
import type { TemplateRichInfo } from '../../lib/templateVerticalMapping';

interface FlowNode {
  id: string;
  type: string;
  data: {
    label: string;
    /** Campos do vocabulário do motor (flowEngine.ts). */
    text?: string;
    question?: string;
    prompt?: string;
    tag?: string;
    field?: string;
    interactive?: { type: 'button' | 'list'; options: { id: string; title: string }[] };
    /** Vocabulário antigo — só aparece em linha ainda não regravada pelo bootstrap. */
    message?: string;
    intent?: string;
    action?: string;
    [k: string]: any;
  };
}

interface Template {
  id: string;
  name: string;
  description: string;
  vertical: string;
  category: string;
  nodes: FlowNode[];
  edges: any[];
}

interface FlowTemplatePreviewModalProps {
  template: Template;
  richInfo: TemplateRichInfo | null;
  verticalLabel: string;
  categoryLabel: string;
  duplicating: boolean;
  onClose: () => void;
  onUse: () => void;
}

// Mesmo vocabulário do editor (flows/page.tsx NODE_META) e do motor
// (flowEngine.ts). O preview mostra exatamente o que o cliente vai receber ao
// duplicar — se divergir daqui, volta o bug de "preview bonito, fluxo vazio".
const NODE_TYPE_META: Record<string, { color: string; icon: string; label: string }> = {
  start:       { color: 'bg-slate-100 text-slate-700 border-slate-300', icon: '*', label: 'Início' },
  message:     { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '>', label: 'Mensagem' },
  condition:   { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: '?', label: 'Condição' },
  ask:         { color: 'bg-sky-50 text-sky-700 border-sky-200', icon: '?', label: 'Perguntar e capturar' },
  ai:          { color: 'bg-violet-50 text-violet-700 border-violet-200', icon: '~', label: 'Nó-IA' },
  tag:         { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '+', label: 'Marcar tag' },
  update_lead: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '+', label: 'Atualizar lead' },
  transfer:    { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '@', label: 'Humano assume' },
  wait:        { color: 'bg-slate-50 text-slate-700 border-slate-200', icon: '.', label: 'Aguardar' },
  schedule:    { color: 'bg-slate-50 text-slate-700 border-slate-200', icon: '.', label: 'Agendar retomada' },
  goto_flow:   { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '>', label: 'Enviar para outro fluxo' },
  // Vocabulário antigo — some quando o upsert do bootstrap regravar as linhas
  // legadas (apps/api/src/bootstrap/seedFlowTemplates.ts). Mantido pra que uma
  // linha antiga apareça pelo que ela é, não como "Mensagem".
  input:         { color: 'bg-slate-100 text-slate-700 border-slate-300', icon: '*', label: 'Gatilho (formato antigo)' },
  ai_node:       { color: 'bg-violet-50 text-violet-700 border-violet-200', icon: '~', label: 'IA responde (formato antigo)' },
  action:        { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '+', label: 'Ação (formato antigo)' },
  human_handoff: { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '@', label: 'Humano assume (formato antigo)' },
};

/** Fallback honesto: mostra o tipo cru em vez de fingir que é "Mensagem". */
function metaFor(type: string) {
  return NODE_TYPE_META[type] ?? { color: 'bg-slate-50 text-slate-500 border-slate-200', icon: '?', label: type };
}

// Mesma sintaxe do renderTemplate do motor (apps/api/src/agents/flowInterpolate.ts).
const TOKEN = /\{\{\s*([a-zA-Z0-9_$.]+)\s*(?:\|\s*"([^"]*)"\s*)?\}\}/g;

/**
 * Deixa o texto legível no preview: o cliente é dono de clínica, não programador,
 * e não deveria ver {{system.businessName | "clínica"}} na vitrine. Mostra o
 * fallback (o mesmo que o motor usaria sem o dado) ou o nome da variável.
 */
function textoLegivel(texto: string): string {
  return texto.replace(TOKEN, (_m, caminho: string, fallback?: string) =>
    fallback ?? caminho.split('.').pop() ?? '',
  );
}

export function FlowTemplatePreviewModal({
  template, richInfo, verticalLabel, categoryLabel, duplicating, onClose, onUse,
}: FlowTemplatePreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-violet-50 via-white to-blue-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white shrink-0">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">{template.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{verticalLabel} &middot; {categoryLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Body scrollavel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {richInfo && (
            <>
              {/* Pitch */}
              <p className="text-base text-slate-700 leading-relaxed">{richInfo.shortPitch}</p>

              {/* 3 colunas: Indicado pra / Complexidade / Tempo setup */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <Target size={13} /> Indicado pra
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{richInfo.indicatedFor}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <BarChart3 size={13} /> Complexidade
                  </div>
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    richInfo.complexity === 'BAIXA' ? 'bg-emerald-100 text-emerald-700' :
                    richInfo.complexity === 'MEDIA' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {richInfo.complexity}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">Da pra configurar sozinho no Maestro.</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <Clock size={13} /> Tempo de setup
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{richInfo.estimatedSetupMinutes}<span className="text-sm font-normal text-slate-500 ml-1">min</span></p>
                  <p className="text-xs text-slate-600 mt-1">Inclui ajuste de tom e copy.</p>
                </div>
              </div>

              {/* O que faz */}
              <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl p-5 border border-violet-100">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-700 uppercase tracking-wide mb-3">
                  <CheckCircle2 size={13} /> O que esse template faz
                </div>
                <ul className="space-y-2">
                  {richInfo.whatItDoes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-violet-600 mt-1 shrink-0">&#x2713;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resultados esperados */}
              <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-3">
                  <BarChart3 size={13} /> Resultados esperados em clientes parecidos
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {richInfo.expectedMetrics.map((m, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-emerald-100">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">{m.label}</p>
                      <p className="text-base font-bold text-emerald-700 mt-1">{m.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-3 italic">
                  Estimativas baseadas em medias observadas. Resultado depende da sua oferta, base e ajustes de copy.
                </p>
              </div>

              {/* Best use case */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex gap-3">
                <Lightbulb size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Dica de uso</p>
                  <p className="text-sm text-slate-700">{richInfo.bestUseCase}</p>
                </div>
              </div>
            </>
          )}

          {/* Estrutura do fluxo */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Estrutura do fluxo ({template.nodes.length} nós)</h3>
            <div className="space-y-2">
              {template.nodes.map((node, i) => {
                const meta = metaFor(node.type);
                // data.text é o campo que o motor lê; data.message é o formato
                // antigo, ainda possível numa linha não regravada.
                const texto = node.data?.text ?? node.data?.message;
                const instrucao = node.data?.prompt ?? node.data?.intent;
                const botoes = node.data?.interactive?.options ?? [];
                return (
                  <div key={node.id} className={`flex items-start gap-3 p-3 rounded-lg border ${meta.color}`}>
                    <div className="w-7 h-7 rounded-full bg-white border border-current/30 flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold">{meta.label}</span>
                        <span className="text-sm font-medium text-slate-900">{node.data.label}</span>
                      </div>
                      {texto && (
                        <p className="text-xs text-slate-600 italic">&ldquo;{textoLegivel(texto)}&rdquo;</p>
                      )}
                      {node.data?.question && (
                        <p className="text-xs text-slate-600 italic">&ldquo;{textoLegivel(node.data.question)}&rdquo;</p>
                      )}
                      {instrucao && (
                        <p className="text-xs text-slate-600">Instrução: {instrucao}</p>
                      )}
                      {node.data?.tag && (
                        <p className="text-xs text-slate-600">Tag: <code className="bg-white/60 px-1 rounded">{node.data.tag}</code></p>
                      )}
                      {node.data?.field && (
                        <p className="text-xs text-slate-600">Grava no CRM: <code className="bg-white/60 px-1 rounded">{node.data.field}</code></p>
                      )}
                      {botoes.length > 0 && (
                        <p className="text-xs text-slate-600">
                          Botões: {botoes.map((o) => o.title).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer com CTA */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Ao usar, o template é copiado pro seu Maestro como rascunho. Você pode editar antes de publicar.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
              Fechar
            </button>
            <button onClick={onUse} disabled={duplicating}
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-60 inline-flex items-center gap-2">
              {duplicating ? 'Duplicando...' : <>Usar template <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
