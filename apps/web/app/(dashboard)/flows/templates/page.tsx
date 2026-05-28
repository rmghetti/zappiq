'use client';

/* ════════════════════════════════════════════════════════════════════════════
 * /flows/templates — Biblioteca sinergica com survey do cliente (Patch C)
 *
 * Detecta vertical via organization.settings.niche e pre-filtra os templates
 * relevantes. Quem ainda nao tem template pronto vê CTA pro Maestro Inteligente.
 * Cards ricos: descricao, o que faz, indicado pra, metricas esperadas, complex,
 * tempo de setup. Modal de preview detalhado antes de "Usar".
 * ════════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Sparkles, Loader2, Copy, Check, Eye, Wand2, Target, Clock,
  Stethoscope, Scissors, Dumbbell, PawPrint, ShoppingBag, Filter, AlertCircle,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/authStore';
import {
  NICHE_TO_TEMPLATE_VERTICAL, NICHE_LABEL, VERTICAL_LABEL, CATEGORY_LABEL,
  getTemplateRichInfo, type FlowTemplateVertical,
} from '../../../../lib/templateVerticalMapping';
import { FlowTemplatePreviewModal } from '../../../../components/maestro/FlowTemplatePreviewModal';

interface Template {
  id: string;
  name: string;
  description: string;
  vertical: FlowTemplateVertical;
  category: 'BOAS_VINDAS_QUALIFICACAO' | 'AGENDAMENTO_RECUPERACAO' | 'NPS_POS_VENDA';
  nodes: any[];
  edges: any[];
  order: number;
}

const VERTICAL_ICON: Record<FlowTemplateVertical, React.ReactNode> = {
  DENTISTA: <Stethoscope size={16} />,
  SALAO_BELEZA: <Scissors size={16} />,
  ACADEMIA: <Dumbbell size={16} />,
  PETSHOP: <PawPrint size={16} />,
  ECOMMERCE_MODA: <ShoppingBag size={16} />,
};

const VERTICAL_GRADIENT: Record<FlowTemplateVertical, string> = {
  DENTISTA: 'from-cyan-50 to-blue-50 border-cyan-200',
  SALAO_BELEZA: 'from-pink-50 to-rose-50 border-pink-200',
  ACADEMIA: 'from-amber-50 to-orange-50 border-amber-200',
  PETSHOP: 'from-emerald-50 to-teal-50 border-emerald-200',
  ECOMMERCE_MODA: 'from-violet-50 to-purple-50 border-violet-200',
};

export default function TemplatesPage() {
  const router = useRouter();
  const { organization } = useAuthStore();

  // Detecta niche e vertical do cliente
  const clientNiche = (organization?.settings as any)?.niche as string | undefined;
  const clientVertical = clientNiche ? NICHE_TO_TEMPLATE_VERTICAL[clientNiche] : null;
  const clientVerticalHasTemplates = clientVertical !== null && clientVertical !== undefined;
  const clientNicheLabel = clientNiche ? NICHE_LABEL[clientNiche] : null;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [duplicated, setDuplicated] = useState<Record<string, string>>({});
  const [showAllVerticals, setShowAllVerticals] = useState(false);
  const [filterVertical, setFilterVertical] = useState<FlowTemplateVertical | 'ALL'>('ALL');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    api.get('/api/flows/templates').then((r) => {
      setTemplates(r.data || []);
    }).catch(() => {
      setTemplates([]);
    }).finally(() => setLoading(false));
  }, []);

  // Decide quais templates mostrar
  const visibleTemplates = useMemo(() => {
    if (!showAllVerticals && clientVertical) {
      return templates.filter((t) => t.vertical === clientVertical);
    }
    if (filterVertical !== 'ALL') {
      return templates.filter((t) => t.vertical === filterVertical);
    }
    return templates;
  }, [templates, showAllVerticals, clientVertical, filterVertical]);

  async function handleDuplicate(t: Template) {
    setDuplicating(t.id);
    try {
      const res = await api.post(`/api/flows/templates/${t.id}/duplicate`);
      setDuplicated((prev) => ({ ...prev, [t.id]: res.data.flowId }));
      setPreviewTemplate(null);
      // Redireciona pro Maestro com o flow ja aberto
      setTimeout(() => router.push(`/flows?flowId=${res.data.flowId}`), 500);
    } catch (err: any) {
      alert(err.message || 'Erro ao duplicar template');
    } finally {
      setDuplicating(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/flows" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={22} className="text-violet-600" />
            Biblioteca de Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Jornadas prontas, testadas em producao. Clique pra pre-visualizar; um clique copia pro seu Maestro como rascunho.
          </p>
        </div>
      </div>

      {/* BANNER SINERGICO */}
      {clientNicheLabel && (
        <div className={`mb-6 rounded-2xl p-5 border-2 ${
          clientVerticalHasTemplates
            ? `bg-gradient-to-r ${clientVertical ? VERTICAL_GRADIENT[clientVertical] : ''}`
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-700 shrink-0">
              {clientVerticalHasTemplates && clientVertical ? VERTICAL_ICON[clientVertical] : <AlertCircle size={20} className="text-amber-600" />}
            </div>
            <div className="flex-1 min-w-0">
              {clientVerticalHasTemplates ? (
                <>
                  <h2 className="text-base font-bold text-slate-900">
                    Mostrando templates pra {clientNicheLabel}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Detectamos sua vertical no cadastro. Esses templates sao otimizados pro seu segmento.{' '}
                    <button
                      onClick={() => setShowAllVerticals(!showAllVerticals)}
                      className="text-violet-700 font-medium hover:underline"
                    >
                      {showAllVerticals ? 'Ocultar outras verticais' : 'Ver templates de outras verticais'}
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-base font-bold text-slate-900">
                    Ainda nao temos templates prontos pra {clientNicheLabel}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    A Iza pode montar uma jornada personalizada pro seu negocio agora mesmo, baseada nas respostas do seu cadastro.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link
                      href="/flows?wizard=true"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-violet-700 hover:to-blue-700"
                    >
                      <Wand2 size={14} />
                      Pedir pra Iza montar (3min)
                    </Link>
                    <button
                      onClick={() => setShowAllVerticals(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
                    >
                      Ver templates de outras verticais
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtro secundario quando explorando todas */}
      {(showAllVerticals || !clientVertical) && !loading && templates.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 inline-flex items-center gap-1">
            <Filter size={12} /> Filtrar:
          </span>
          <button
            onClick={() => setFilterVertical('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filterVertical === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Todos ({templates.length})
          </button>
          {(Object.keys(VERTICAL_LABEL) as FlowTemplateVertical[]).map((v) => {
            const count = templates.filter((t) => t.vertical === v).length;
            if (count === 0) return null;
            return (
              <button
                key={v}
                onClick={() => setFilterVertical(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all inline-flex items-center gap-1.5 ${
                  filterVertical === v
                    ? 'bg-slate-900 text-white border-slate-900'
                    : `bg-white border-slate-200 text-slate-700 hover:bg-slate-50`
                }`}
              >
                {VERTICAL_ICON[v]} {VERTICAL_LABEL[v]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* GRID DE CARDS */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : visibleTemplates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Sparkles size={40} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-700 mb-2">Nenhum template pra essa selecao</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto">
            Tente ver todas as verticais ou peca pra Iza montar uma jornada personalizada do zero.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => { setShowAllVerticals(true); setFilterVertical('ALL'); }}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
            >
              Ver todas as verticais
            </button>
            <Link
              href="/flows?wizard=true"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-violet-700 hover:to-blue-700"
            >
              <Wand2 size={14} /> Pedir pra Iza montar
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleTemplates.map((t) => {
            const rich = getTemplateRichInfo(t.vertical, t.category);
            const isDup = !!duplicated[t.id];
            const gradient = VERTICAL_GRADIENT[t.vertical] || 'from-slate-50 to-slate-100 border-slate-200';

            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all flex flex-col"
              >
                {/* Header colorido por vertical */}
                <div className={`bg-gradient-to-br ${gradient} px-5 py-3 border-b`}>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      {VERTICAL_ICON[t.vertical]}
                      {VERTICAL_LABEL[t.vertical]}
                    </div>
                    {rich && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rich.complexity === 'BAIXA' ? 'bg-emerald-100 text-emerald-700' :
                        rich.complexity === 'MEDIA' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {rich.complexity}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 flex-1 flex flex-col">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
                    {CATEGORY_LABEL[t.category]}
                  </p>
                  <h3 className="text-sm font-bold text-slate-900 mb-2 leading-snug">{t.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3 flex-1">
                    {rich ? rich.shortPitch : t.description}
                  </p>

                  {/* Mini-metricas */}
                  {rich && (
                    <div className="grid grid-cols-2 gap-2 mb-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        <span className="text-[10px] text-slate-600">{rich.estimatedSetupMinutes}min setup</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Target size={12} className="text-slate-400" />
                        <span className="text-[10px] text-slate-600 truncate">{rich.expectedMetrics[0]?.value}</span>
                      </div>
                    </div>
                  )}

                  {/* Botoes */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewTemplate(t)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      <Eye size={12} /> Visualizar
                    </button>
                    {isDup ? (
                      <button
                        onClick={() => router.push(`/flows?flowId=${duplicated[t.id]}`)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                      >
                        <Check size={12} /> Aberto
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDuplicate(t)}
                        disabled={duplicating === t.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-60"
                      >
                        {duplicating === t.id ? <Loader2 size={12} className="animate-spin" /> : <><Copy size={12} /> Usar</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de preview */}
      {previewTemplate && (
        <FlowTemplatePreviewModal
          template={previewTemplate}
          richInfo={getTemplateRichInfo(previewTemplate.vertical, previewTemplate.category)}
          verticalLabel={VERTICAL_LABEL[previewTemplate.vertical]}
          categoryLabel={CATEGORY_LABEL[previewTemplate.category]}
          duplicating={duplicating === previewTemplate.id}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => handleDuplicate(previewTemplate)}
        />
      )}
    </div>
  );
}
