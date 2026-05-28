'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, Loader2, Stethoscope, Scissors, Dumbbell, PawPrint, ShoppingBag } from 'lucide-react';
import { api } from '../../../../lib/api';

interface Template {
  id: string;
  name: string;
  description: string;
  vertical: 'DENTISTA' | 'SALAO_BELEZA' | 'ACADEMIA' | 'PETSHOP' | 'ECOMMERCE_MODA';
  category: 'BOAS_VINDAS_QUALIFICACAO' | 'AGENDAMENTO_RECUPERACAO' | 'NPS_POS_VENDA';
  order: number;
}

const VERTICAL_META: Record<Template['vertical'], { label: string; icon: React.ReactNode; color: string }> = {
  DENTISTA:       { label: 'Dentista',  icon: <Stethoscope size={18} />, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  SALAO_BELEZA:   { label: 'Salao',     icon: <Scissors size={18} />,    color: 'bg-pink-50 text-pink-700 border-pink-200' },
  ACADEMIA:       { label: 'Academia',  icon: <Dumbbell size={18} />,    color: 'bg-amber-50 text-amber-700 border-amber-200' },
  PETSHOP:        { label: 'Petshop',   icon: <PawPrint size={18} />,    color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ECOMMERCE_MODA: { label: 'E-com Moda', icon: <ShoppingBag size={18} />, color: 'bg-violet-50 text-violet-700 border-violet-200' },
};

const CATEGORY_LABEL: Record<Template['category'], string> = {
  BOAS_VINDAS_QUALIFICACAO: 'Boas-vindas + Qualificacao',
  AGENDAMENTO_RECUPERACAO:  'Agendamento + Recuperacao',
  NPS_POS_VENDA:            'NPS pos-venda',
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [duplicated, setDuplicated] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Template['vertical'] | 'ALL'>('ALL');

  useEffect(() => {
    api.get('/api/flows/templates').then((r) => {
      setTemplates(r.data || []);
    }).finally(() => setLoading(false));
  }, []);

  async function handleDuplicate(t: Template) {
    setDuplicating(t.id);
    try {
      const res = await api.post(`/api/flows/templates/${t.id}/duplicate`);
      setDuplicated((prev) => ({ ...prev, [t.id]: res.data.flowId }));
    } catch (err: any) {
      alert(err.message || 'Erro ao duplicar template');
    }
    setDuplicating(null);
  }

  const filtered = filter === 'ALL' ? templates : templates.filter((t) => t.vertical === filter);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/flows" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates do Maestro</h1>
          <p className="text-sm text-gray-500 mt-1">15 jornadas prontas pra 5 verticais. Clica em "Usar" pra duplicar como rascunho no seu Maestro.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            filter === 'ALL' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >Todos ({templates.length})</button>
        {Object.entries(VERTICAL_META).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFilter(k as Template['vertical'])}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
              filter === k ? 'bg-gray-900 text-white border-gray-900' : `${v.color} hover:opacity-90`
            }`}
          >
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const meta = VERTICAL_META[t.vertical];
            const isDup = !!duplicated[t.id];
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border self-start mb-3 ${meta.color}`}>
                  {meta.icon} {meta.label}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{t.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{CATEGORY_LABEL[t.category]}</p>
                <p className="text-xs text-gray-600 leading-relaxed mb-4 flex-1">{t.description}</p>

                {isDup ? (
                  <button
                    onClick={() => router.push(`/flows?flowId=${duplicated[t.id]}`)}
                    className="w-full py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} /> Aberto no Maestro
                  </button>
                ) : (
                  <button
                    onClick={() => handleDuplicate(t)}
                    disabled={duplicating === t.id}
                    className="w-full py-2 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {duplicating === t.id ? (
                      <><Loader2 size={14} className="animate-spin" /> Duplicando...</>
                    ) : (
                      <><Copy size={14} /> Usar template</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="text-center py-20 text-gray-400 text-sm">
          Nenhum template nesta categoria ainda.
        </div>
      )}
    </div>
  );
}
