'use client';

/**
 * AI Training — Dashboard (/(dashboard)/ai-training)
 *
 * Página onde o cliente EXECUTA o self-service training narrado na landing.
 * Espelha o layout da seção SelfServiceTraining para reforçar continuidade
 * visual entre landing → app. Consome os endpoints /api/ai-training/*.
 *
 * Estrutura:
 *   ┌────────────────── AIReadinessCard (score + breakdown + CTA) ───────┐
 *   │ Próximas ações (checklist tipo Duolingo)                           │
 *   ├────────────── tabs ──────────────────────────────────────────────┤
 *   │ Documentos │ Q&A │ Identidade │                                    │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Princípio: cada ação devolve o novo readiness do backend, a UI atualiza
 * na hora. Loop de feedback imediato que converte intenção em ação.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  Upload,
  MessageSquareText,
  User,
  Trash2,
  FileText,
  Globe,
  Plus,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Gauge,
} from 'lucide-react';
import { api } from '../../../lib/api';
import ReadinessMilestoneNudge from '../../../components/shared/ReadinessMilestoneNudge';

// ── Tipos alinhados ao service backend ───────────────────
interface Readiness {
  score: number;
  level: 'initial' | 'learning' | 'ready' | 'expert';
  breakdown: {
    survey: number;
    identity: number;
    documents: number;
    qaPairs: number;
    channel: number;
  };
  nextActions: Array<{
    id: string;
    title: string;
    description: string;
    impact: number;
    cta: string;
    completed: boolean;
  }>;
  stats: {
    documentsCount: number;
    qaPairsCount: number;
    surveyAnswers: number;
    whatsappConnections: number;
  };
}

interface KBDocument {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl?: string | null;
  createdAt: string;
}

interface QAPair {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Metadados visuais por nível ──────────────────────────
const LEVEL_META: Record<Readiness['level'], { label: string; color: string; bg: string }> = {
  initial: { label: 'Começando', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  learning: { label: 'Aprendendo', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  ready: { label: 'Pronta', color: 'text-secondary-700', bg: 'bg-secondary-50 border-secondary-200' },
  expert: { label: 'Expert', color: 'text-primary-700', bg: 'bg-primary-50 border-primary-200' },
};

type TabKey = 'documents' | 'qa' | 'identity';

export default function AITrainingPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('documents');

  const refreshReadiness = useCallback(async () => {
    try {
      const data = await api.get<Readiness>('/api/ai-training/status');
      setReadiness(data);
    } catch (err) {
      console.warn('Falha ao carregar readiness:', err);
    }
  }, []);

  useEffect(() => {
    refreshReadiness().finally(() => setLoading(false));
  }, [refreshReadiness]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" /> Carregando readiness da IA...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">
          Treinamento da sua IA
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Tudo self-service. Sem consultor, sem setup pago, sem espera. Cada
          ação abaixo sobe o Readiness da sua IA em tempo real.
        </p>
      </div>

      {/* Readiness Card */}
      {readiness && <ReadinessCard readiness={readiness} />}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>
          <FileText size={16} /> Documentos
        </TabButton>
        <TabButton active={tab === 'qa'} onClick={() => setTab('qa')}>
          <MessageSquareText size={16} /> Perguntas & Respostas
        </TabButton>
        <TabButton active={tab === 'identity'} onClick={() => setTab('identity')}>
          <User size={16} /> Identidade do agente
        </TabButton>
      </div>

      {/* Tab panels */}
      {tab === 'documents' && <DocumentsPanel onChange={refreshReadiness} />}
      {tab === 'qa' && <QAPanel onChange={refreshReadiness} />}
      {tab === 'identity' && <IdentityPanel onChange={refreshReadiness} />}

      {/* Milestone nudge — dispara uma vez quando score cruza 60 */}
      <ReadinessMilestoneNudge score={readiness?.score} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Readiness Card
// ═════════════════════════════════════════════════════════
function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const level = LEVEL_META[readiness.level];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs opacity-80 font-medium uppercase tracking-wide">AI Readiness Score</p>
            <p className="text-4xl font-extrabold font-display">
              {readiness.score}
              <span className="text-xl opacity-60">/100</span>
            </p>
          </div>
          <div className={`px-4 py-2 rounded-full border ${level.bg} ${level.color} text-sm font-semibold`}>
            {level.label}
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="bg-white h-full rounded-full transition-all duration-700"
            style={{ width: `${readiness.score}%` }}
          />
        </div>
      </div>

      <div className="p-6 grid md:grid-cols-2 gap-6">
        {/* Breakdown */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Gauge size={16} /> Breakdown
          </h3>
          <div className="space-y-3">
            <BreakdownRow label="Survey de qualificação" score={readiness.breakdown.survey} max={30} />
            <BreakdownRow label="Identidade & tom" score={readiness.breakdown.identity} max={20} />
            <BreakdownRow label="Documentos" score={readiness.breakdown.documents} max={25} />
            <BreakdownRow label="Q&A ativos" score={readiness.breakdown.qaPairs} max={20} />
            <BreakdownRow label="WhatsApp conectado" score={readiness.breakdown.channel} max={5} />
          </div>
        </div>

        {/* Próximas ações */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles size={16} /> Próximas ações
          </h3>
          <div className="space-y-2">
            {readiness.nextActions.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-secondary-700 bg-secondary-50 rounded-lg p-3 border border-secondary-200">
                <CheckCircle2 size={18} />
                Sua IA está 100% treinada. Bom trabalho!
              </div>
            ) : (
              readiness.nextActions.slice(0, 3).map((action) => (
                <div
                  key={action.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    +{action.impact}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{action.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-gray-400 flex-shrink-0 mt-1" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = (score / max) * 100;
  const full = score >= max;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-700">{label}</span>
        <span className={full ? 'text-secondary-600 font-semibold' : 'text-gray-500'}>
          {score}/{max}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-full rounded-full transition-all ${
            full ? 'bg-secondary-500' : 'bg-gradient-to-r from-primary-400 to-secondary-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Documents panel
// ═════════════════════════════════════════════════════════
function DocumentsPanel({ onChange }: { onChange: () => void }) {
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    try {
      const data = await api.get<{ documents: KBDocument[] }>('/api/ai-training/documents');
      setDocs(data.documents);
    } catch (err) {
      console.warn('Falha ao listar documentos:', err);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('zappiq_token') : null;
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/ai-training/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Falha no upload (${res.status})`);
      }
      await loadDocs();
      onChange();
    } catch (err: any) {
      alert(`Erro no upload: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    try {
      await api.post('/api/ai-training/documents/url', { url: urlInput.trim() });
      setUrlInput('');
      await loadDocs();
      onChange();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setUrlLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este documento da base?')) return;
    try {
      await api.delete(`/api/ai-training/documents/${id}`);
      await loadDocs();
      onChange();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload box */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-dashed border-gray-300 hover:border-primary-400 rounded-xl p-6 text-center transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.docx,.doc,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <Upload size={28} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            Suba contratos, FAQs, políticas, catálogos
          </p>
          <p className="text-xs text-gray-500 mb-3">PDF, TXT, MD, CSV, DOCX, XLSX — até 20MB cada</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {uploading ? 'Enviando...' : 'Escolher arquivo'}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={18} className="text-primary-500" />
            <p className="text-sm font-medium text-gray-900">Ingerir URL do seu site</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Cole a URL. Nosso crawler lê e vetoriza automaticamente.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://seusite.com.br/sobre"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
            <button
              onClick={handleUrl}
              disabled={urlLoading || !urlInput.trim()}
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {urlLoading ? <Loader2 size={14} className="animate-spin" /> : 'Ingerir'}
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Base de conhecimento</h3>
          <span className="text-xs text-gray-500">{docs.length} documento(s)</span>
        </div>
        {docs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Nenhum documento ainda. Comece subindo seu primeiro PDF ou URL acima.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {docs.map((d) => (
              <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                  {d.sourceType === 'url' ? <Globe size={16} /> : <FileText size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.title}</p>
                  <p className="text-xs text-gray-500">
                    {d.sourceType === 'url' ? 'URL' : d.sourceType} · {new Date(d.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                  aria-label="Remover"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Q&A panel
// ═════════════════════════════════════════════════════════
function QAPanel({ onChange }: { onChange: () => void }) {
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ qaPairs: QAPair[] }>('/api/ai-training/qa');
      setPairs(data.qaPairs);
    } catch (err) {
      console.warn('Falha ao listar Q&A:', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/ai-training/qa', {
        question: question.trim(),
        answer: answer.trim(),
        category: category.trim() || undefined,
      });
      setQuestion('');
      setAnswer('');
      setCategory('');
      await load();
      onChange();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pair: QAPair) => {
    try {
      await api.put(`/api/ai-training/qa/${pair.id}`, { isActive: !pair.isActive });
      await load();
      onChange();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta pergunta?')) return;
    try {
      await api.delete(`/api/ai-training/qa/${id}`);
      await load();
      onChange();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Plus size={16} /> Nova pergunta & resposta
        </h3>
        <div className="space-y-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pergunta (ex.: Qual o horário de atendimento?)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Resposta exata que a IA deve dar. Seja específico — horários, valores, política."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none resize-none"
          />
          <div className="flex gap-3">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Categoria (opcional, ex.: Horários)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
            <button
              onClick={handleCreate}
              disabled={saving || !question.trim() || !answer.trim()}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Q&A cadastrados</h3>
          <span className="text-xs text-gray-500">
            {pairs.filter((p) => p.isActive).length} ativos · {pairs.length} total
          </span>
        </div>
        {pairs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Nenhuma Q&A cadastrada. Fixe respostas para perguntas que se repetem.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pairs.map((p) => (
              <li key={p.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {p.category && (
                        <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                          {p.category}
                        </span>
                      )}
                      {!p.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                          Desativada
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{p.question}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{p.answer}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(p)}
                      className="text-xs text-gray-600 hover:text-primary-600 border border-gray-200 px-2 py-1 rounded"
                    >
                      {p.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      aria-label="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Identity panel
// ═════════════════════════════════════════════════════════
function IdentityPanel({ onChange }: { onChange: () => void }) {
  const [form, setForm] = useState({
    agentName: '',
    tone: 'friendly' as 'friendly' | 'formal' | 'technical',
    greetingMessage: '',
    handoffMessage: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/ai-training/identity', form);
      onChange();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div>
        <label className="text-sm font-medium text-gray-900 block mb-1">Nome do agente</label>
        <p className="text-xs text-gray-500 mb-2">Como a IA se apresenta. Ex.: Bia, Marcos, Atendente Virtual.</p>
        <input
          value={form.agentName}
          onChange={(e) => setForm((f) => ({ ...f, agentName: e.target.value }))}
          placeholder="Ex.: Bia"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-900 block mb-1">Tom de voz</label>
        <p className="text-xs text-gray-500 mb-2">Define como a IA conversa. Pode mudar a qualquer momento.</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'friendly', label: 'Amigável' },
            { value: 'formal', label: 'Formal' },
            { value: 'technical', label: 'Técnico' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, tone: opt.value as any }))}
              className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                form.tone === opt.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-900 block mb-1">Mensagem de saudação</label>
        <p className="text-xs text-gray-500 mb-2">Primeira mensagem que o cliente recebe.</p>
        <textarea
          value={form.greetingMessage}
          onChange={(e) => setForm((f) => ({ ...f, greetingMessage: e.target.value }))}
          rows={2}
          placeholder="Ex.: Olá! Sou a Bia, assistente virtual da Loja X. Em que posso ajudar?"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none resize-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-900 block mb-1">Mensagem de transbordo</label>
        <p className="text-xs text-gray-500 mb-2">Quando a IA passa a conversa para um humano.</p>
        <textarea
          value={form.handoffMessage}
          onChange={(e) => setForm((f) => ({ ...f, handoffMessage: e.target.value }))}
          rows={2}
          placeholder="Ex.: Vou te conectar com um especialista agora. Em instantes você será atendido!"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none resize-none"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {saved && (
          <span className="text-sm text-secondary-700 flex items-center gap-1">
            <CheckCircle2 size={16} /> Atualizado
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar identidade'}
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Tab helper
// ═════════════════════════════════════════════════════════
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary-500 text-primary-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}
